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
  /**
   * Position within the current beat, 0→1, docs/todo.md entry 75. 0 while
   * unlocked — geometry driven by this is an event (spawn a ring, step a
   * rotation, advance a colour) and an unlocked 0 is silence, not a guess at
   * where the beat would have been.
   */
  beatPhase: number
  /** Estimated tempo in BPM, 0 while unlocked. For the readout — a tempo
   *  nobody can see cannot be debugged. */
  bpm: number
  /**
   * How much to trust `beatPhase`/`bpm`, 0-1 and continuous rather than a
   * boolean lock — this is what lets a shader blend between beat-driven and
   * energy-driven instead of switching between them. At 0, every existing
   * view must render exactly as it does today.
   */
  beatConfidence: number
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

  /** `loHz`/`hiHz` restrict the flux to a band — docs/todo.md entry 75 reuses
   *  this scoped to the low band for `beatStrength`, so a kick sets off the
   *  beat tracker without a hi-hat or a vocal doing the same. Defaults cover
   *  the whole spectrum, which keeps every existing call site (the broadband
   *  `transient`) byte-identical. */
  update(frame: AudioFrame, dt: number, loHz = 0, hiHz = Infinity): number {
    if (!this.prev || this.prev.length !== frame.freq.length) {
      this.prev = new Uint8Array(frame.freq)
      return 0
    }

    const binHz = frame.sampleRate / (frame.binCount * 2)
    const lo = Math.max(0, Math.floor(loHz / binHz))
    const hi = hiHz === Infinity ? frame.freq.length : Math.min(frame.freq.length, Math.ceil(hiHz / binHz))

    let flux = 0
    for (let i = lo; i < hi; i++) {
      const d = frame.freq[i] - this.prev[i]
      if (d > 0) flux += d
    }
    this.prev.set(frame.freq)

    return hi > lo ? this.ceiling.normalise(flux / (hi - lo), dt) : 0
  }
}

/**
 * Tracks a rolling median over a fixed window — the adaptive floor for the
 * beat onset threshold, docs/todo.md entry 75. Re-sorts a small array on
 * every push rather than keeping a running structure: the window is a few
 * dozen samples, so the sort is microseconds, and there is no reason to
 * build a heap for that.
 */
class RollingMedian {
  private readonly buf: number[] = []
  private readonly size: number

  constructor(size: number) {
    this.size = size
  }

  push(v: number): number {
    this.buf.push(v)
    if (this.buf.length > this.size) this.buf.shift()
    const sorted = [...this.buf].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }
}

/**
 * docs/todo.md entry 75 — a tempo every mapping can see, promoted out of
 * `beatMapping()`'s own private two-gap estimator into something shared.
 *
 * Onset strength is resampled onto a fixed-rate ring buffer (autocorrelation
 * needs a uniform time base; frame `dt` is not one), then autocorrelated to
 * find candidate periods. Each candidate is scored by how well it lines up
 * with a pulse train at its *best* phase offset — this is what tells a true
 * 120bpm apart from its 60 and 240bpm harmonics, which score just as well
 * under plain autocorrelation (fragility 2 in the entry): among candidates
 * that tie on that score, the one nearest a resting tempo of 120bpm wins.
 *
 * Phase is nudged toward each real onset rather than reset to it (fragility
 * 3): a hit landing right where the clock predicted is trusted almost
 * fully; one landing mid-cycle — syncopation — barely moves the clock, so
 * the picture keeps time *through* an off-beat instead of being pulled by
 * it.
 */
const BEAT_BUCKET_S = 0.02
const BEAT_WINDOW_S = 3.2
const BEAT_BUCKETS = Math.round(BEAT_WINDOW_S / BEAT_BUCKET_S)
/** 40-300bpm — the same bounds the old two-gap tracker used. */
const BEAT_MIN_BPM = 40
const BEAT_MAX_BPM = 300
/** How often to re-run the autocorrelation. The ring buffer only advances by
 *  one bucket every `BEAT_BUCKET_S`, so recomputing every frame would spend
 *  cycles re-deriving a near-identical answer. **Mine**. */
const BEAT_REFRESH_S = 0.5
/** Minimum buffer fill before a first estimate is attempted, rather than
 *  waiting for the full window — short enough that "120±2bpm within 4s"
 *  has real margin, long enough to hold several cycles at the fastest
 *  plausible tempo. **Mine**. */
const BEAT_MIN_FILL_S = 2.0
/** A candidate lag enters the nearest-120bpm tie-break once its pulse-train
 *  score clears this absolute floor — deliberately not a fraction of the
 *  best-scoring candidate. A single missed onset can let a subharmonic's
 *  comb dodge the gap at some phase offset and score higher than the true
 *  fundamental's, which necessarily samples every onset including the
 *  missing one; a *relative* tolerance judged against that inflated best
 *  score would then wrongly exclude the fundamental. An absolute floor
 *  still excludes lags that never lined up with anything, while accepting
 *  every octave that is genuinely, if imperfectly, periodic — found by
 *  testing the entry's own "holds through a missed beat" case, which this
 *  fixes. **Mine**. */
const BEAT_CANDIDATE_FLOOR = 0.75
/** Rolling-median onset threshold: window and margin above it. Both
 *  **Mine** — the entry asks for the mechanism (median plus a delta, 0.5
 *  kept as the floor) but not an exact window or margin. */
const BEAT_MEDIAN_WINDOW = 90
const BEAT_THRESHOLD_DELTA = 0.12
const BEAT_ONSET_FLOOR = 0.5
const BEAT_MIN_ONSET_GAP = 0.2
/** Confidence above which `bpm`/`beatPhase` are reported at all, and the
 *  same switch `beatMapping` used to make on a boolean `locked` — now made
 *  on a threshold over the continuous replacement. **Mine**. */
const BEAT_LOCK_CONFIDENCE = 0.5

function bpmFromLag(lag: number): number {
  return 60 / (lag * BEAT_BUCKET_S)
}

/** A phase offset needs at least this many confirming comb positions before
 *  its average counts for anything — without a floor, a long-period
 *  candidate near `BEAT_MAX_INTERVAL` can have as few as two comb positions
 *  in the buffer, and searching every phase offset for the best of only two
 *  samples finds a spuriously perfect "period" in outright noise almost
 *  every time. Found by testing against random-interval onsets, which kept
 *  reporting a confident, invented tempo before this. **Mine**. */
const BEAT_MIN_COMB_SAMPLES = 4

/** Best-phase-offset comb score against `buf` at spacing `lag` — the octave
 *  disambiguator: a true fundamental scores as well as its harmonics under
 *  plain autocorrelation, but only the fundamental (and its harmonics) score
 *  well here at *every* multiple simultaneously checked from a shared best
 *  phase. */
function pulseTrainScore(buf: Float32Array, lag: number): number {
  let best = 0
  for (let phase = 0; phase < lag; phase++) {
    let sum = 0
    let count = 0
    for (let i = phase; i < buf.length; i += lag) {
      sum += buf[i]
      count++
    }
    if (count >= BEAT_MIN_COMB_SAMPLES) best = Math.max(best, sum / count)
  }
  return best
}

/** Parabolic interpolation around an integer-lag autocorrelation peak, for
 *  sub-bucket tempo precision — `BEAT_BUCKET_S` alone is too coarse to hit
 *  ±2bpm at typical tempos. */
function parabolicRefine(ac: Float64Array, lag: number): number {
  if (lag <= 0 || lag >= ac.length - 1) return lag
  const y0 = ac[lag - 1]
  const y1 = ac[lag]
  const y2 = ac[lag + 1]
  const denom = y0 - 2 * y1 + y2
  if (Math.abs(denom) < 1e-9) return lag
  const offset = Math.max(-1, Math.min(1, (0.5 * (y0 - y2)) / denom))
  return lag + offset
}

function estimateTempo(buf: Float32Array): { periodS: number; confidence: number } | null {
  const n = buf.length
  const minLag = Math.max(1, Math.round(60 / BEAT_MAX_BPM / BEAT_BUCKET_S))
  const maxLag = Math.min(n - 2, Math.round(60 / BEAT_MIN_BPM / BEAT_BUCKET_S))
  if (maxLag <= minLag + 1) return null

  const ac = new Float64Array(maxLag + 2)
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let sum = 0
    for (let i = lag; i < n; i++) sum += buf[i] * buf[i - lag]
    ac[lag] = sum
  }

  const peakLags: number[] = []
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1] && ac[lag] > 0) peakLags.push(lag)
  }
  if (peakLags.length === 0) return null

  const candidates = peakLags.map((lag) => ({ lag, pulse: pulseTrainScore(buf, lag) }))
  const contenders = candidates.filter((c) => c.pulse >= BEAT_CANDIDATE_FLOOR)
  if (contenders.length === 0) return null
  contenders.sort((a, b) => Math.abs(bpmFromLag(a.lag) - 120) - Math.abs(bpmFromLag(b.lag) - 120))
  const chosen = contenders[0]

  const refinedLag = parabolicRefine(ac, chosen.lag)
  return { periodS: refinedLag * BEAT_BUCKET_S, confidence: clamp01(chosen.pulse) }
}

class BeatTracker {
  private readonly ring = new Float32Array(BEAT_BUCKETS)
  private writeIdx = 0
  private filledBuckets = 0
  private bucketPeak = 0
  private bucketElapsed = 0
  private readonly median = new RollingMedian(BEAT_MEDIAN_WINDOW)
  private lastStrength = 0
  private sinceOnset = 1000
  private timeSinceRefresh = 1000
  private interval = 0 // seconds; 0 = no tempo estimate yet
  private phase = 0
  private confidence = 0
  private readonly confidenceEnv = new Envelope(0.4, 0.6)

  private linearize(): Float32Array {
    const out = new Float32Array(this.filledBuckets)
    const start = (this.writeIdx - this.filledBuckets + this.ring.length) % this.ring.length
    for (let i = 0; i < this.filledBuckets; i++) out[i] = this.ring[(start + i) % this.ring.length]
    return out
  }

  update(beatStrength: number, dt: number): { phase: number; bpm: number; confidence: number } {
    // Onset detection against an adaptive threshold: a rolling median of
    // beatStrength itself plus a fixed margin, floored so a dead-quiet
    // source cannot cross on its own noise floor.
    const threshold = Math.max(BEAT_ONSET_FLOOR, this.median.push(beatStrength) + BEAT_THRESHOLD_DELTA)
    const crossedUp = beatStrength > threshold && this.lastStrength <= threshold
    this.lastStrength = beatStrength
    this.sinceOnset += dt
    const isOnset = crossedUp && this.sinceOnset > BEAT_MIN_ONSET_GAP
    if (isOnset) this.sinceOnset = 0

    // Resample onset strength onto the fixed-rate ring buffer. The bucket
    // takes the loudest sample seen in its span rather than a time-weighted
    // average — onsets are brief spikes, and an average would blur one
    // toward invisibility against a bucket mostly full of silence.
    this.bucketPeak = Math.max(this.bucketPeak, beatStrength)
    this.bucketElapsed += dt
    while (this.bucketElapsed >= BEAT_BUCKET_S) {
      this.ring[this.writeIdx] = this.bucketPeak
      this.writeIdx = (this.writeIdx + 1) % this.ring.length
      this.filledBuckets = Math.min(this.ring.length, this.filledBuckets + 1)
      this.bucketPeak = 0
      this.bucketElapsed -= BEAT_BUCKET_S
    }

    this.timeSinceRefresh += dt
    if (this.timeSinceRefresh >= BEAT_REFRESH_S && this.filledBuckets * BEAT_BUCKET_S >= BEAT_MIN_FILL_S) {
      this.timeSinceRefresh = 0
      const estimate = estimateTempo(this.linearize())
      this.interval = estimate ? estimate.periodS : this.interval
      // The envelope only moves once per refresh, so it has to be pushed
      // with the time actually elapsed since the last push (BEAT_REFRESH_S)
      // rather than this frame's dt — pushing with dt made confidence climb
      // at roughly 1/30th its intended rate, found by testing against the
      // entry's own "within 4 seconds" figure before this shipped.
      this.confidence = this.confidenceEnv.push(estimate ? estimate.confidence : 0, BEAT_REFRESH_S)
    }

    // Phase runs continuously at the current estimate rather than freezing
    // between onsets — it is a prediction, not just a record of the last
    // hit. A real onset then nudges it toward 0 in proportion to how close
    // it already was to a cycle boundary (0 or 1, the same instant): a hit
    // right on the predicted beat all but resets it, one at phase 0.5 —
    // exactly mid-cycle, maximally syncopated — barely moves it at all.
    if (this.interval > 0) {
      this.phase = (this.phase + dt / this.interval) % 1
      if (isOnset) {
        const distanceFromBoundary = Math.min(this.phase, 1 - this.phase)
        const nearness = clamp01(1 - distanceFromBoundary * 2)
        this.phase *= 1 - nearness
      }
    }

    const locked = this.confidence > BEAT_LOCK_CONFIDENCE
    return {
      phase: locked ? this.phase : 0,
      bpm: locked && this.interval > 0 ? 60 / this.interval : 0,
      confidence: this.confidence,
    }
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
  beatPhase: number
  bpm: number
  beatConfidence: number
}

class CommonAnalysis {
  private readonly flux = new SpectralFlux()
  private readonly beatFlux = new SpectralFlux()
  private readonly beatTracker = new BeatTracker()
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

    // Weighted toward the low band, where the kick is — `transient` above
    // keeps its own broadband meaning for everything else, docs/todo.md
    // entry 75.
    const beatStrength = this.beatFlux.update(frame, dt, BANDS.low[0], BANDS.low[1])
    const beat = this.beatTracker.update(beatStrength, dt)

    const { novelty, roughness } = this.structure.update(frame)

    return {
      raw,
      norm,
      transient,
      tilt,
      breakdown,
      surge,
      novelty,
      roughness,
      beatPhase: beat.phase,
      bpm: beat.bpm,
      beatConfidence: beat.confidence,
    }
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
        beatPhase: c.beatPhase,
        bpm: c.bpm,
        beatConfidence: c.beatConfidence,
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
        beatPhase: c.beatPhase,
        bpm: c.bpm,
        beatConfidence: c.beatConfidence,
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
        beatPhase: c.beatPhase,
        bpm: c.bpm,
        beatConfidence: c.beatConfidence,
      }
    },
  }
}

/**
 * Strategy D — beat-synced. docs/todo.md entry 39.
 *
 * The first three mappings all differ only in how loudness is scaled; this
 * is the first to vary a different axis entirely — time. `level` and the
 * bands are driven by a phase that runs 0->1 across each beat, rather than
 * from instantaneous energy — the picture then moves *with* the music
 * through a bar where the energy sits flat, not merely at it.
 *
 * Degrades honestly: without a stable interval this reads exactly as
 * `relative` does, rather than free-running at a guessed tempo. A
 * visualiser pulsing confidently at the wrong tempo is a legible error; one
 * that has stopped pulsing is not.
 *
 * docs/todo.md entry 75 promoted the tempo estimate itself into
 * `CommonAnalysis` — every mapping gets one now — so this keeps only the
 * `locked ? beatEnv : fallbackLevel` shape that made it "beat-synced" in
 * the first place, reading `phase`/`bpm` from the shared tracker instead of
 * keeping its own private two-gap copy.
 */
function beatMapping(): Mapping {
  const common = new CommonAnalysis()
  const levelEnv = new Envelope(0.03, 0.28)
  const bandEnv = {
    low: new Envelope(0.03, 0.22),
    mid: new Envelope(0.03, 0.22),
    high: new Envelope(0.025, 0.18),
  }
  const LO = 0.5
  const HI = 1.7

  return {
    name: 'beat',
    update(frame) {
      const { dt } = frame
      const c = common.update(frame)

      const locked = c.bpm > 0
      const phase = c.beatPhase

      const floor = Math.max(c.norm, 0.008)
      const rel = (v: number) => clamp01((v / floor - LO) / (HI - LO))
      const fallbackLevel = 0.7 * rel(c.raw.all) + 0.3 * soften(c.raw.all, GAIN)
      const beatEnv = 1 - phase

      const low = clamp01((c.raw.low / floor) * 0.55)
      const mid = clamp01((c.raw.mid / floor) * 0.55)
      const high = clamp01((c.raw.high / floor) * 0.75)

      return {
        level: levelEnv.push(locked ? beatEnv : fallbackLevel, dt),
        low: bandEnv.low.push(locked ? low * beatEnv : low, dt),
        mid: bandEnv.mid.push(locked ? mid * beatEnv : mid, dt),
        high: bandEnv.high.push(locked ? high * beatEnv : high, dt),
        transient: c.transient,
        tilt: c.tilt,
        breakdown: c.breakdown,
        surge: c.surge,
        novelty: c.novelty,
        roughness: c.roughness,
        beatPhase: c.beatPhase,
        bpm: c.bpm,
        beatConfidence: c.beatConfidence,
      }
    },
  }
}

/**
 * Strategy E — dynamics-faithful, recalibrated for music. docs/todo.md
 * entry 39.
 *
 * Fixed gain, no normalisation of any kind: quiet reads as quiet and loud
 * reads as loud across a whole track. The same `soften()`-shaped fixed
 * gain `speech-band` already uses, calibrated for music at room volume
 * instead of a voice at a metre.
 *
 * No separate ceiling logic for clipping, despite the entry's own framing
 * of one: `soften()`'s exponential already saturates at 1.0 by
 * construction and cannot exceed it, which already *is* "prevent
 * clipping" — a second mechanism on top of an already-bounded curve would
 * have nothing left to do. **Mine.**
 */
const DYNAMICS_GAIN = 10

function dynamicsMapping(): Mapping {
  const common = new CommonAnalysis()
  const lowEnv = new Envelope(0.05, 0.6)
  const midEnv = new Envelope(0.04, 0.5)
  const highEnv = new Envelope(0.03, 0.4)
  const levelEnv = new Envelope(0.06, 1.0)

  return {
    name: 'dynamics',
    update(frame) {
      const { dt } = frame
      const c = common.update(frame)

      return {
        level: levelEnv.push(soften(c.raw.all, DYNAMICS_GAIN), dt),
        low: lowEnv.push(soften(c.raw.low, DYNAMICS_GAIN), dt),
        mid: midEnv.push(soften(c.raw.mid, DYNAMICS_GAIN), dt),
        high: highEnv.push(soften(c.raw.high, DYNAMICS_GAIN), dt),
        transient: c.transient,
        tilt: c.tilt,
        breakdown: c.breakdown,
        surge: c.surge,
        novelty: c.novelty,
        roughness: c.roughness,
        beatPhase: c.beatPhase,
        bpm: c.bpm,
        beatConfidence: c.beatConfidence,
      }
    },
  }
}

/**
 * Strategy F — bass-led. docs/todo.md entry 39.
 *
 * `level` weighted toward `low` and `transient`; `high` left to do little.
 * For anything kick-driven this is the honest mapping, and the cheapest of
 * the three to build: a re-weighting of numbers `relative`'s own machinery
 * already produces, not a new analysis.
 */
function bassLedMapping(): Mapping {
  const common = new CommonAnalysis()
  const bandEnv = {
    low: new Envelope(0.03, 0.22),
    mid: new Envelope(0.03, 0.22),
    high: new Envelope(0.025, 0.18),
  }

  return {
    name: 'bass-led',
    update(frame) {
      const { dt } = frame
      const c = common.update(frame)
      const floor = Math.max(c.norm, 0.008)

      const low = bandEnv.low.push(clamp01((c.raw.low / floor) * 0.55), dt)
      const mid = bandEnv.mid.push(clamp01((c.raw.mid / floor) * 0.55), dt)
      // High is scaled down rather than dropped — "do little", not nothing.
      const high = bandEnv.high.push(clamp01((c.raw.high / floor) * 0.75) * 0.3, dt)

      // Built directly from the already-smoothed `low`, with no envelope of
      // its own on top — a second, separately-timed smoothing on `level`
      // measurably drifted apart from `low`'s own during a beat's decay,
      // even with near-identical time constants, which is exactly the kind
      // of gap "tracking low" is supposed to rule out. **Mine.**
      return {
        level: clamp01(low * 0.95 + c.transient * 0.05),
        low,
        mid,
        high,
        transient: c.transient,
        tilt: c.tilt,
        breakdown: c.breakdown,
        surge: c.surge,
        novelty: c.novelty,
        roughness: c.roughness,
        beatPhase: c.beatPhase,
        bpm: c.bpm,
        beatConfidence: c.beatConfidence,
      }
    },
  }
}

export const MAPPINGS = {
  relative: relativeMapping,
  'speech-band': speechBandMapping,
  'auto-normalised': autoNormalisedMapping,
  beat: beatMapping,
  dynamics: dynamicsMapping,
  'bass-led': bassLedMapping,
} satisfies Record<string, () => Mapping>

export type MappingName = keyof typeof MAPPINGS
