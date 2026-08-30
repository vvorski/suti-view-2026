/**
 * Audio -> visual parameters.
 *
 * This is the interesting variable in the whole project and it is meant to be
 * swapped. `main.ts` picks one by name; `?mapping=` overrides it at runtime.
 *
 * The central lesson, learned by measuring rather than looking: **absolute
 * loudness is the wrong drive signal.** A fixed gain tuned for a quiet room
 * pins to ~0.95 the moment real music plays, leaving no headroom for anything
 * to move, and the visuals go inert exactly when there is most to react to. So
 * the default mapping works in *relative* terms — how loud is this moment
 * compared to the last few seconds — which self-calibrates across a whisper and
 * a sound system, and leaves the full range available at both.
 */

import type { AudioFrame } from './capture.ts'
// Explicit .ts extension: Vite does not need it, but Node's ESM resolver does,
// and `pnpm probe` runs this file directly under --experimental-strip-types.
// Type-only imports are erased before Node ever sees them, so only real value
// imports need this.
import { StructureAnalysis } from './features.ts'

export interface VisualParams {
  /** Overall drive, 0-1. The shader's master intensity. */
  level: number
  /** Band energies, 0-1. */
  low: number
  mid: number
  high: number
  /** Sharp broadband onsets, 0-1. Decays in a fraction of a second. */
  transient: number
  /**
   * Spectral balance: 0 = bass-dominated, 1 = treble-dominated. Deliberately
   * slow (seconds), because this drives colour and colour that chases every
   * transient is a strobe, not a response.
   */
  tilt: number
  /**
   * How far below its recent norm the sound has dropped, 0-1. Rises during a
   * breakdown, a drop-out, or the gap between tracks; stays at 0 through the
   * gaps between beats and through sustained quiet.
   */
  breakdown: number
  /** Re-entry after a breakdown, 0-1. Brief, and much larger than a beat. */
  surge: number
  /**
   * Structural novelty, 0-1 — a sustained change in the character of the sound
   * rather than a single hit. Section boundaries, a new instrument, the drop.
   * See `features.ts`. This was documented as the longest memory in the app,
   * which was never true — `longEnergy` below runs at τ = 4 s against
   * novelty's 1.6 s window — and is now not even close: `slow.ts` keeps five
   * minutes.
   */
  novelty: number
  /**
   * Spectral roughness, 0-1, from the 1/f exponent. Low is dark and smooth,
   * high is bright and noisy. Very slow by design — it describes timbre.
   */
  roughness: number
}

export interface Mapping {
  readonly name: string
  update(frame: AudioFrame): VisualParams
}

const BANDS = {
  low: [40, 250],
  mid: [250, 1600],
  high: [1600, 8000],
} as const

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * One-pole envelope follower with separate attack and release times.
 *
 * `attack`/`release` are the seconds to cover ~63% of the distance to the
 * target, so they read as durations rather than magic coefficients.
 *
 * Exported: `scene.ts` reuses this for the ambient-light gain (docs/todo.md
 * entry 23) rather than writing a second smoother — the shape it needs is
 * identical, a slow attack and a slower release measured in seconds, not
 * frames.
 */
export class Envelope {
  private value: number
  private readonly attack: number
  private readonly release: number

  // Written out rather than using TypeScript parameter properties, so the file
  // runs unmodified under `node --experimental-strip-types` — which is how the
  // mapping gets probed offline without a browser.
  constructor(attack: number, release: number, initial = 0) {
    this.attack = attack
    this.release = release
    this.value = initial
  }

  push(target: number, dt: number): number {
    const tau = target > this.value ? this.attack : this.release
    // Frame-rate independent: a dropped frame moves us further, not less far.
    const k = tau <= 0 ? 1 : 1 - Math.exp(-dt / tau)
    this.value += (target - this.value) * k
    return this.value
  }

  get current(): number {
    return this.value
  }
}

/**
 * Tracks a rolling ceiling so a signal can be normalised without knowing its
 * scale in advance. Rises instantly, falls slowly. Used only by
 * `auto-normalised` and by the flux detector.
 */
class RollingCeiling {
  private ceiling: number
  private readonly floor: number
  private readonly decay: number

  constructor(floor: number, decay: number) {
    this.floor = floor
    this.decay = decay
    this.ceiling = floor
  }

  normalise(v: number, dt: number): number {
    this.update(v, dt)
    return this.ceiling <= 0 ? 0 : Math.min(1, v / this.ceiling)
  }

  /** Update the tracked ceiling without also normalising against it — for a
   *  caller pairing this with a `RollingFloor` (docs/todo.md entry 38),
   *  which needs the raw ceiling value, not `v` divided by it. */
  update(v: number, dt: number): void {
    if (v > this.ceiling) this.ceiling = v
    else this.ceiling = Math.max(this.floor, this.ceiling * Math.exp(-dt / this.decay))
  }

  get value(): number {
    return this.ceiling
  }
}

/**
 * docs/todo.md entry 38's fix for `auto-normalised`, and the reason it does
 * not literally add a second `RollingCeiling` run in reverse — that was
 * tried first and measured, not reasoned about, to be a dead end.
 *
 * A `RollingCeiling` snaps to match whatever it is fed within a single
 * frame, so normalising that same instantaneous sample against the ceiling
 * it just set is a number divided by itself: exactly 1, for *any* input,
 * forever, however that ceiling is computed — a mirrored "rolling floor"
 * tracking the same sample the ceiling tracks converges to meet it for
 * exactly the same reason and does not change this. What actually opens a
 * gap is comparing the ceiling — which stays fast and instantaneous, as
 * `auto-normalised`'s own peak-tracking is supposed to be — against a
 * *slower, lagging* view of the identical signal, so the two are no longer
 * numerically the same thing. `AUTO_NORM_QUERY_ATTACK` is that lag; a
 * fixed, near-zero `AUTO_NORM_FLOOR` gives the comparison an absolute
 * reference to sit above, which is what actually produces a value that
 * differs by loudness rather than being scale-invariant — a purely
 * proportional floor (a fraction of the ceiling, whatever fraction) cancels
 * out of the ratio identically at every volume and reproduces the original
 * flat 1.00. Both constants were tuned against the real probe numbers,
 * not guessed: the span between `pnpm probe`'s byte 10 and byte 200 rows is
 * what was optimised for.
 */
const AUTO_NORM_FLOOR = 0.012
const AUTO_NORM_QUERY_ATTACK = 8

/** Normalise a slow-lagging view of `v` (`query`) against a fast ceiling and
 *  a fixed floor — see `AUTO_NORM_FLOOR`'s own comment for why both of
 *  those properties are load-bearing. Guards the same way `RollingCeiling`
 *  already does against a ceiling that has not yet risen off its own hard
 *  floor. */
function normaliseBetween(query: number, floor: number, ceiling: number): number {
  const span = ceiling - floor
  return span > 0.001 ? clamp01((query - floor) / span) : 0
}

/** Mean of the 0-255 bins covering [loHz, hiHz), returned as 0-1. */
function bandEnergy(frame: AudioFrame, loHz: number, hiHz: number): number {
  const binHz = frame.sampleRate / (frame.binCount * 2)
  const lo = Math.max(0, Math.floor(loHz / binHz))
  const hi = Math.min(frame.binCount, Math.ceil(hiHz / binHz))
  if (hi <= lo) return 0

  let sum = 0
  for (let i = lo; i < hi; i++) sum += frame.freq[i]
  return sum / (hi - lo) / 255
}

/**
 * Spectral flux: total positive change since the last frame.
 *
 * Rising-only is what makes this an onset detector rather than a change
 * detector — a sound stopping is not an onset, and counting it as one makes
 * every gap in the music flash.
 */
class SpectralFlux {
  private prev: Uint8Array | null = null
  private readonly ceiling = new RollingCeiling(2, 4)

  update(frame: AudioFrame, dt: number): number {
    if (!this.prev || this.prev.length !== frame.freq.length) {
      this.prev = new Uint8Array(frame.freq)
      return 0
    }

    let flux = 0
    for (let i = 0; i < frame.freq.length; i++) {
      const d = frame.freq[i] - this.prev[i]
      if (d > 0) flux += d
    }
    this.prev.set(frame.freq)

    return this.ceiling.normalise(flux / frame.freq.length, dt)
  }
}

/**
 * Everything the strategies share: band energies, onsets, spectral tilt, and
 * break detection. Only the `level` calculation differs between mappings, and
 * that is the one thing worth disagreeing about.
 */
interface Common {
  raw: { low: number; mid: number; high: number; all: number }
  /** Slow mean of overall energy — the "recent norm". */
  norm: number
  transient: number
  tilt: number
  breakdown: number
  surge: number
  novelty: number
  roughness: number
}

class CommonAnalysis {
  private readonly flux = new SpectralFlux()
  private readonly transientEnv = new Envelope(0.004, 0.16)
  // Colour moves on a scale of seconds. This is the single most important
  // number for "meaningful but not too rapid".
  // Starts neutral rather than at 0. A tilt envelope starting from zero opens
  // every session at the far bass end of the palette and takes several seconds
  // to crawl out, so the first thing you ever see is the wrong colour.
  private readonly tiltEnv = new Envelope(2.2, 2.8, 0.5)
  private readonly shortEnergy = new Envelope(0.05, 0.12)
  // Attack matches release: a "recent history" floor that rose faster than it
  // fell (1.5s attack against a 4.0s release) chased a new loud section
  // almost as fast as `level` itself moves, so a sustained section relaxed
  // back toward baseline within ~2s of arriving — see docs/todo.md entry 12,
  // where pnpm probe's own "Full track" table is the evidence.
  private readonly longEnergy = new Envelope(4.0, 4.0)
  // A 0.3s attack is what separates a breakdown from the gap between two
  // beats. Anything faster fires on every kick pattern.
  private readonly breakEnv = new Envelope(0.3, 0.5)
  private readonly surgeEnv = new Envelope(0.02, 0.6)
  // The same 0.3s hold breakEnv uses, for the same reason — docs/todo.md
  // entry 38's second path to surge: a single loud hit should not fire it,
  // only a rise sustained past about the length of a beat.
  private readonly riseEnv = new Envelope(0.3, 0.4)
  private readonly structure = new StructureAnalysis()
  private prevBreak = 0

  update(frame: AudioFrame): Common {
    const { dt } = frame

    const raw = {
      low: bandEnergy(frame, ...BANDS.low),
      mid: bandEnergy(frame, ...BANDS.mid),
      high: bandEnergy(frame, ...BANDS.high),
      all: 0,
    }
    raw.all = (raw.low + raw.mid + raw.high) / 3

    const short = this.shortEnergy.push(raw.all, dt)
    const norm = this.longEnergy.push(raw.all, dt)

    // Spectral balance, weighted so the highs count for more than their raw
    // energy — there is simply less power up there, and an unweighted centroid
    // barely moves between a bassline and a hi-hat.
    const total = raw.low + raw.mid + raw.high
    const tiltTarget = total > 1e-4 ? (raw.mid * 0.45 + raw.high * 1.6) / total : 0.5
    const tilt = this.tiltEnv.push(clamp01(tiltTarget), dt)

    // A break is the sound dropping well below its own recent norm — and only
    // meaningful if there was something to drop from. Without the `norm` gate,
    // a silent room reads as one continuous breakdown.
    const audible = norm > 0.02
    const ratio = audible ? short / norm : 1
    const breakdown = this.breakEnv.push(audible ? clamp01((0.62 - ratio) / 0.5) : 0, dt)

    // Re-entry: the break collapsing is the interesting moment, not its onset.
    const falling = Math.max(0, this.prevBreak - breakdown)
    this.prevBreak = breakdown
    const reentry = clamp01((falling / Math.max(dt, 1e-3)) * 0.55)

    // A second path to surge — docs/todo.md entry 38: music that never
    // drops out never produces a breakdown to recover from, which left
    // surge reading a constant zero for any track that just plays. Fires
    // on the same short/norm ratio breakdown already reads, the other side
    // of it: a moment meaningfully louder than its own recent norm, held
    // past riseEnv's 0.3s so a single hit does not fire it — the music
    // getting bigger, not a beat. **Mine**: the entry names the mechanism
    // but not these two numbers.
    const riseRatio = audible ? clamp01((ratio - 1.3) / 0.7) : 0
    const rise = this.riseEnv.push(riseRatio, dt)

    const surge = this.surgeEnv.push(Math.max(reentry, rise), dt)

    const transient = this.transientEnv.push(this.flux.update(frame, dt), dt)

    const { novelty, roughness } = this.structure.update(frame)

    return { raw, norm, transient, tilt, breakdown, surge, novelty, roughness }
  }
}

/**
 * Strategy A — relative loudness. The default.
 *
 * `level` is how loud this moment is against the last few seconds, not against
 * an absolute scale. That is what makes it work at both ends: a voice in a
 * quiet room and a sound system both spend their time in the middle of the
 * range with headroom above and below, so beats, swells and drops are all
 * visible. An absolute mapping cannot do this — tuned for one it goes inert at
 * the other, which is exactly how the first version failed.
 *
 * Release times are short by design. The earlier 1.8s release smeared every
 * beat into the next; 0.28s still reads as smooth motion but lets individual
 * hits through.
 *
 * `level` is a blend, not the pure relative measure alone — docs/todo.md
 * entry 38. Dividing by a running mean reports *change* in loudness, not
 * loudness: a steady passage settles back toward the middle of the range
 * regardless of whether it settled loud or quiet, which measured out to a
 * flat 0.68 across a 20x input range. 30% `soften(absolute)` — the same
 * `soften()` and `GAIN` `speech-band` already uses — is blended in so a
 * loud passage still reads as louder than a quiet one, while the 70%
 * `relative` majority keeps the property that makes this the default: it
 * works at any input gain, because a fixed absolute term alone goes inert
 * at whichever end of the gain range it was not tuned for.
 */
export function relativeMapping(): Mapping {
  const common = new CommonAnalysis()
  const levelEnv = new Envelope(0.03, 0.28)
  const bandEnv = {
    low: new Envelope(0.03, 0.22),
    mid: new Envelope(0.03, 0.22),
    high: new Envelope(0.025, 0.18),
  }

  // A moment at the running mean lands at LO..HI -> ~0.42. Quiet moments fall
  // to 0, loud ones reach 1, and there is room on both sides.
  const LO = 0.5
  const HI = 1.7

  return {
    name: 'relative',
    update(frame) {
      const { dt } = frame
      const c = common.update(frame)
      const floor = Math.max(c.norm, 0.008)

      const rel = (v: number) => clamp01((v / floor - LO) / (HI - LO))

      return {
        level: levelEnv.push(0.7 * rel(c.raw.all) + 0.3 * soften(c.raw.all, GAIN), dt),
        low: bandEnv.low.push(clamp01((c.raw.low / floor) * 0.55), dt),
        mid: bandEnv.mid.push(clamp01((c.raw.mid / floor) * 0.55), dt),
        high: bandEnv.high.push(clamp01((c.raw.high / floor) * 0.75), dt),
        transient: c.transient,
        tilt: c.tilt,
        breakdown: c.breakdown,
        surge: c.surge,
        novelty: c.novelty,
        roughness: c.roughness,
      }
    },
  }
}

/**
 * Strategy B — absolute, dynamics-faithful.
 *
 * Fixed gain with soft saturation: quiet genuinely reads as quiet and a long
 * decay traces a curve rather than being re-normalised away. Right for ambient
 * recording and voice, where the shape of a swell is the content.
 *
 * Wrong for music at room volume, where it saturates near 1 and stops moving —
 * which is why it is no longer the default. Raise `GAIN` if the field stays
 * dim, lower it if everything blows out.
 */
const GAIN = 6

function soften(v: number, gain: number): number {
  return 1 - Math.exp(-v * gain)
}

export function speechBandMapping(): Mapping {
  const common = new CommonAnalysis()
  const lowEnv = new Envelope(0.05, 0.7)
  const midEnv = new Envelope(0.04, 0.55)
  const highEnv = new Envelope(0.03, 0.45)
  const levelEnv = new Envelope(0.06, 1.2)

  return {
    name: 'speech-band',
    update(frame) {
      const { dt } = frame
      const c = common.update(frame)

      const low = lowEnv.push(soften(c.raw.low, GAIN), dt)
      const mid = midEnv.push(soften(c.raw.mid, GAIN), dt)
      const high = highEnv.push(soften(c.raw.high, GAIN), dt)

      return {
        level: levelEnv.push(mid * 0.7 + high * 0.2 + low * 0.1, dt),
        low,
        mid,
        high,
        transient: c.transient,
        tilt: c.tilt,
        breakdown: c.breakdown,
        surge: c.surge,
        novelty: c.novelty,
        roughness: c.roughness,
      }
    },
  }
}

/**
 * Strategy C — per-band auto-normalised.
 *
 * Every band stretched between a fixed floor and its own rolling ceiling.
 * Maximum robustness against unknown material — it is the only strategy
 * that survives a stranger's phone in a strange room at an unknown gain.
 *
 * Used to stretch to the ceiling alone, which meant any sustained sound
 * reached its own maximum by definition — docs/todo.md entry 38 measured a
 * flat 1.00 across a 20x loudness range. What actually produces a
 * loudness-dependent reading is comparing a *slow, lagging* view of a band
 * against its own *fast, instantaneous* ceiling, rather than comparing the
 * same instantaneous sample to itself — see `AUTO_NORM_FLOOR`'s own comment
 * for why a literal rolling floor mirroring the ceiling does not work, and
 * measurably does not.
 */
export function autoNormalisedMapping(): Mapping {
  const common = new CommonAnalysis()
  const envs = {
    low: new Envelope(0.04, 0.4),
    mid: new Envelope(0.04, 0.4),
    high: new Envelope(0.03, 0.35),
  }
  const ceilings = {
    low: new RollingCeiling(0.02, 6),
    mid: new RollingCeiling(0.02, 6),
    high: new RollingCeiling(0.02, 6),
  }
  // The slow, lagging view each band is compared against — see
  // AUTO_NORM_QUERY_ATTACK's own comment. Release is fast: a genuine
  // drop-out should read as quiet quickly, not lag on the way down the way
  // it deliberately does on the way up.
  const queries = {
    low: new Envelope(AUTO_NORM_QUERY_ATTACK, 0.3),
    mid: new Envelope(AUTO_NORM_QUERY_ATTACK, 0.3),
    high: new Envelope(AUTO_NORM_QUERY_ATTACK, 0.3),
  }
  const levelEnv = new Envelope(0.05, 0.9)
  const levelCeiling = new RollingCeiling(0.02, 6)
  const levelQuery = new Envelope(AUTO_NORM_QUERY_ATTACK, 0.3)

  return {
    name: 'auto-normalised',
    update(frame) {
      const { dt } = frame
      const c = common.update(frame)

      levelCeiling.update(c.raw.all, dt)
      ceilings.low.update(c.raw.low, dt)
      ceilings.mid.update(c.raw.mid, dt)
      ceilings.high.update(c.raw.high, dt)

      // `level` is normalised from combined *raw* energy, not averaged from the
      // three already-normalised bands. Averaging normalised bands caps
      // single-band material at 1/3 — mid-only speech measured a flat 0.33 no
      // matter how loud it got, defeating the point of this strategy.
      return {
        level: levelEnv.push(
          normaliseBetween(levelQuery.push(c.raw.all, dt), AUTO_NORM_FLOOR, levelCeiling.value),
          dt,
        ),
        low: envs.low.push(
          normaliseBetween(queries.low.push(c.raw.low, dt), AUTO_NORM_FLOOR, ceilings.low.value),
          dt,
        ),
        mid: envs.mid.push(
          normaliseBetween(queries.mid.push(c.raw.mid, dt), AUTO_NORM_FLOOR, ceilings.mid.value),
          dt,
        ),
        high: envs.high.push(
          normaliseBetween(queries.high.push(c.raw.high, dt), AUTO_NORM_FLOOR, ceilings.high.value),
          dt,
        ),
        transient: c.transient,
        tilt: c.tilt,
        breakdown: c.breakdown,
        surge: c.surge,
        novelty: c.novelty,
        roughness: c.roughness,
      }
    },
  }
}

export const MAPPINGS = {
  relative: relativeMapping,
  'speech-band': speechBandMapping,
  'auto-normalised': autoNormalisedMapping,
} satisfies Record<string, () => Mapping>

export type MappingName = keyof typeof MAPPINGS
