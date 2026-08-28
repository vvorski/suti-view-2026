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

import type { AudioFrame } from './audio'

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
 */
class Envelope {
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
    if (v > this.ceiling) this.ceiling = v
    else this.ceiling = Math.max(this.floor, this.ceiling * Math.exp(-dt / this.decay))
    return this.ceiling <= 0 ? 0 : Math.min(1, v / this.ceiling)
  }
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
  private readonly longEnergy = new Envelope(1.5, 4.0)
  // A 0.3s attack is what separates a breakdown from the gap between two
  // beats. Anything faster fires on every kick pattern.
  private readonly breakEnv = new Envelope(0.3, 0.5)
  private readonly surgeEnv = new Envelope(0.02, 0.6)
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
    const surge = this.surgeEnv.push(clamp01((falling / Math.max(dt, 1e-3)) * 0.55), dt)

    const transient = this.transientEnv.push(this.flux.update(frame, dt), dt)

    return { raw, norm, transient, tilt, breakdown, surge }
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
        level: levelEnv.push(rel(c.raw.all), dt),
        low: bandEnv.low.push(clamp01((c.raw.low / floor) * 0.55), dt),
        mid: bandEnv.mid.push(clamp01((c.raw.mid / floor) * 0.55), dt),
        high: bandEnv.high.push(clamp01((c.raw.high / floor) * 0.75), dt),
        transient: c.transient,
        tilt: c.tilt,
        breakdown: c.breakdown,
        surge: c.surge,
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
      }
    },
  }
}

/**
 * Strategy C — per-band auto-normalised.
 *
 * Every band stretched to fill its own range. Maximum robustness against
 * unknown material, at the cost of being unable to tell loud from quiet:
 * sustained sound sits near maximum by construction.
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
  const levelEnv = new Envelope(0.05, 0.9)
  const levelCeiling = new RollingCeiling(0.02, 6)

  return {
    name: 'auto-normalised',
    update(frame) {
      const { dt } = frame
      const c = common.update(frame)

      // `level` is normalised from combined *raw* energy, not averaged from the
      // three already-normalised bands. Averaging normalised bands caps
      // single-band material at 1/3 — mid-only speech measured a flat 0.33 no
      // matter how loud it got, defeating the point of this strategy.
      return {
        level: levelEnv.push(levelCeiling.normalise(c.raw.all, dt), dt),
        low: envs.low.push(ceilings.low.normalise(c.raw.low, dt), dt),
        mid: envs.mid.push(ceilings.mid.normalise(c.raw.mid, dt), dt),
        high: envs.high.push(ceilings.high.normalise(c.raw.high, dt), dt),
        transient: c.transient,
        tilt: c.tilt,
        breakdown: c.breakdown,
        surge: c.surge,
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
