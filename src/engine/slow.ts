/**
 * The minutes tier.
 *
 * `mapping.ts` reacts inside a second and `features.ts` looks back 1.6 of
 * them. Nothing in this app has ever had a memory longer than six seconds
 * (`longEnergy`, τ = 4 s, and a rolling ceiling at 6), which means it can tell
 * you a hit happened and cannot tell you that the last ninety seconds have all
 * sounded the same. This file is the part that can.
 *
 * Two kinds of output, and the distinction is the whole design:
 *
 *   STRUCTURE — where we are in the piece. Novelty at three scales, whether
 *   the present resembles the recorded past, and how long we have been here.
 *
 *   FLAVOUR — what kind of sound this is. Four named axes, each a real
 *   descriptor rather than a genre guess, each smoothed over tens of seconds.
 *
 * Neither is a uniform, and that is deliberate. A minutes-scale number read by
 * a shader every frame becomes *motion* — a drift nothing on screen explains,
 * which is the worst kind. So this tier reports, `director.ts` decides, and
 * decisions are applied through the same setters the HUD calls. It is an
 * autopilot on the existing controls, not a second bus into the shaders.
 *
 * Cost is not the constraint people expect. Everything here runs at 2 Hz, and
 * five minutes of history is 600 frames of twelve floats — 28.8 KB. The
 * expensive-looking part, a full self-similarity matrix, is never built: see
 * the note on half-means below.
 */

import { MAX_DB, MIN_DB, type AudioFrame } from './capture.ts'
import { bandVector, N_BANDS } from './features.ts'
import type { VisualParams } from './fast.ts'

/** Feature frames per second. Section boundaries do not move faster than this. */
const SLOW_HZ = 2
/** How far back the buffer reaches. Five minutes is about one long track. */
const BUFFER_SECONDS = 300
const BUFFER_N = BUFFER_SECONDS * SLOW_HZ

/**
 * Novelty half-windows, in feature frames. Three scales because "a change"
 * means different things at different distances: a phrase turning over, a
 * section changing, and the piece moving into a different movement entirely
 * are all real and a single window can only see one of them.
 */
const HALF_SHORT = 8 // 4 s
const HALF_MEDIUM = 30 // 15 s
const HALF_LONG = 120 // 60 s

/** A section boundary, for the purpose of "how long have we been here". */
const BOUNDARY = 0.45

/**
 * Recurrence has to ignore the recent past, or every frame matches the one
 * before it and the answer is always 1 — which is what the first version
 * reported, from thirty seconds in, for the rest of the run.
 *
 * A fixed cutoff is not enough either: inside a long section, everything just
 * past the cutoff is still the same section, so it still reads 1. The question
 * worth asking is "have we come back to something we *left*", so the cutoff is
 * the larger of this floor and however long the current section has run.
 */
const RECURRENCE_FLOOR = 45 * SLOW_HZ

/** Onset envelope for the tempo estimate. */
const ONSET_HZ = 50
const ONSET_SECONDS = 8
const ONSET_N = ONSET_HZ * ONSET_SECONDS
/** Lag range searched, in envelope samples: 60–180 BPM. */
const LAG_MIN = Math.floor((ONSET_HZ * 60) / 180)
const LAG_MAX = Math.ceil((ONSET_HZ * 60) / 60)

/** Axis smoothing, seconds. Flavour that changes inside a phrase is not
 *  flavour, it is just the fast tier with extra steps. */
const TAU_TIMBRE = 30
const TAU_RHYTHM = 20

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export interface Character {
  // --- flavour: what kind of sound this is, 0-1 each ---
  /** Dark and steep ↔ bright and flat. From the 1/f exponent. */
  bright: number
  /** Tonal ↔ noisy. From spectral flatness, which is the one descriptor here
   *  genuinely independent of the others. */
  noisy: number
  /** Sparse ↔ dense. Onsets per second. */
  dense: number
  /** Ambient ↔ rhythmic. Height of the onset autocorrelation peak. */
  rhythmic: number

  // --- structure: where we are ---
  /** Novelty at three scales, 0-1. Phrase, section, movement. */
  noveltyShort: number
  noveltyMedium: number
  noveltyLong: number
  /** How much the present resembles somewhere we have already been, 0-1. */
  recurrence: number
  /** Seconds since the last section boundary. */
  dwell: number
  /** Best tempo estimate, BPM, or 0 when there is no rhythmic peak to read. */
  bpm: number
  /** True once the buffer holds enough history for the long scale to mean
   *  anything. Everything above is reported before this; only the long-scale
   *  numbers are untrustworthy until it flips. */
  warm: boolean
}

export const BLANK: Character = {
  bright: 0.5,
  noisy: 0.5,
  dense: 0,
  rhythmic: 0,
  noveltyShort: 0,
  noveltyMedium: 0,
  noveltyLong: 0,
  recurrence: 0,
  dwell: 0,
  bpm: 0,
  warm: false,
}

/**
 * Spectral flatness — the geometric mean of the power spectrum over its
 * arithmetic mean. 1 is white noise, near 0 is a pure tone.
 *
 * This earns its place because it is the axis here least redundant with
 * spectral slope. Centroid, rolloff and the 1/f exponent are three views of
 * the same tilt and correlate almost perfectly with each other; flatness asks
 * a different question — is the energy spread evenly across the band or
 * concentrated into partials — and separates a distorted guitar from a clean
 * one where slope cannot.
 *
 * "Least redundant" rather than "independent", which is what this comment
 * claimed first: a steep spectrum is also, unavoidably, a less flat one, and
 * the probe shows `noisy` tracking `bright` at roughly half its amplitude.
 * The two are worth keeping apart, but they are not orthogonal and a director
 * rule that treats them as such will be surprised.
 *
 * The bytes are already logarithmic (see spectralBeta's note in features.ts),
 * so the mean of the dB values *is* the log of the geometric mean, and the
 * arithmetic mean has to be taken after converting back to power.
 *
 * Returns -1 rather than a number when there is too little signal to tell.
 * Silence reads as perfectly flat — every bin sitting on the analyser floor is
 * a spectrum with no shape at all — which would report a quiet room as maximum
 * noise. Refusing is the honest answer, and the caller holds its last value.
 */
function spectralFlatness(frame: AudioFrame): number {
  const binHz = frame.sampleRate / (frame.binCount * 2)
  const lo = Math.max(1, Math.floor(60 / binHz))
  const hi = Math.min(frame.binCount, Math.ceil(8000 / binHz))
  const dbRange = MAX_DB - MIN_DB

  let sumDb = 0
  let sumPower = 0
  let n = 0
  let live = 0

  for (let i = lo; i < hi; i++) {
    const byte = frame.freq[i]
    if (byte > 8) live++
    const db = MIN_DB + (byte / 255) * dbRange
    sumDb += db
    sumPower += Math.pow(10, db / 10)
    n++
  }

  if (n < 8 || live < n * 0.15) return -1

  const geo = Math.pow(10, sumDb / n / 10)
  const arith = sumPower / n
  if (arith < 1e-30) return -1
  return clamp01(geo / arith)
}

export class SlowAnalysis {
  /** Ring buffer of L2-normalised band vectors at SLOW_HZ. */
  private readonly history = new Float32Array(BUFFER_N * N_BANDS)
  private readonly scratch = new Float32Array(N_BANDS)
  private readonly meanA = new Float32Array(N_BANDS)
  private readonly meanB = new Float32Array(N_BANDS)
  private head = 0
  private filled = 0
  private accum = 0

  /** Onset strength envelope, its own ring at ONSET_HZ. */
  private readonly onsets = new Float32Array(ONSET_N)
  private onsetHead = 0
  private onsetAccum = 0
  private onsetPeak = 0

  private bright = 0.5
  private noisy = 0.5
  private dense = 0
  private rhythmic = 0
  private bpm = 0

  private nShort = 0
  private nMedium = 0
  private nLong = 0
  private recurrence = 0
  private dwell = 0

  /** Rising-edge state for counting onsets. */
  private wasAbove = false
  private onsetCount = 0
  private onsetWindow = 0

  /** Mean of `half` frames ending `back` frames before the newest, written
   *  into `out`. Not normalised: its length is itself the signal — a coherent
   *  stretch averages to something near unit length, a chaotic one to near
   *  nothing, and the novelty below wants that difference. */
  private halfMean(back: number, half: number, out: Float32Array): void {
    out.fill(0)
    for (let f = 0; f < half; f++) {
      // head points at the next slot to write, so head-1 is the newest.
      const idx = (this.head - 1 - back - f + BUFFER_N * 2) % BUFFER_N
      const base = idx * N_BANDS
      for (let k = 0; k < N_BANDS; k++) out[k] += this.history[base + k]
    }
    for (let k = 0; k < N_BANDS; k++) out[k] /= half
  }

  /**
   * Causal checkerboard novelty at an arbitrary scale.
   *
   * features.ts evaluates the same idea over all pairs in its window, which is
   * right at sixteen frames and impossible at two hundred and forty — the cost
   * is quadratic in the half-width and this file's widest scale is fifteen
   * times its widest. So the halves are collapsed to their mean vectors first
   * and compared once.
   *
   * That is not a different measurement dressed up. Expanding Foote's
   * within-minus-across contrast for mean vectors gives exactly
   *
   *   novelty = (|mA|² + |mB|²)/2 − mA·mB = |mA − mB|² / 2
   *
   * so the whole thing reduces to the squared distance between the two halves'
   * centroids: coherent halves that differ score high, and a half that is
   * internally incoherent averages towards zero length and cannot score high
   * whatever it is compared against. Linear in the window instead of
   * quadratic, and the same quantity.
   */
  private noveltyAt(half: number): number {
    if (this.filled < half * 2) return 0
    this.halfMean(0, half, this.meanB)
    this.halfMean(half, half, this.meanA)
    let d = 0
    for (let k = 0; k < N_BANDS; k++) {
      const v = this.meanA[k] - this.meanB[k]
      d += v * v
    }
    // The scale is large because the vectors are unit-length and mean-centred,
    // so two spectra with the same broad shape sit very close together whatever
    // their tilt: measured, a stationary stretch gives |mA-mB|² ≈ 0.0003 and an
    // unmistakable section change gives ≈ 0.05. The ratio is what carries the
    // information, not the magnitude, and 12 puts a real boundary near 0.6.
    //
    // Worth knowing what this measure is deliberately blind to: a pure change
    // of spectral *slope* is close to a scalar multiple of the same vector, and
    // L2 normalisation removes scalar multiples. That is not a defect — tilt is
    // already reported as `bright` — but it does mean novelty answers "did the
    // energy move to different bands", not "did it get brighter".
    return clamp01((d / 2) * 12)
  }

  /** Largest similarity between now and anything older than RECURRENCE_MIN_AGE. */
  private computeRecurrence(): number {
    const minAge = Math.max(RECURRENCE_FLOOR, Math.floor(this.dwell * SLOW_HZ))
    if (this.filled < minAge + 8) return 0
    const now = ((this.head - 1 + BUFFER_N) % BUFFER_N) * N_BANDS
    let best = -1
    let sum = 0
    let n = 0
    for (let age = minAge; age < this.filled; age++) {
      const base = (((this.head - 1 - age) % BUFFER_N) + BUFFER_N) % BUFFER_N
      let dot = 0
      for (let k = 0; k < N_BANDS; k++) {
        dot += this.history[now + k] * this.history[base * N_BANDS + k]
      }
      sum += dot
      n++
      if (dot > best) best = dot
    }
    if (n === 0) return 0
    // The contrast between the best match and the typical one, not the best
    // match itself. Reporting the raw maximum gave 96-100% for almost the whole
    // of a five-minute arrangement, because these vectors all correlate above
    // 0.9 with each other and the largest of many high numbers is always high.
    // What "we have been here before" actually means is that one moment in the
    // past resembles now *more than the rest of the past does*.
    return clamp01((best - sum / n) * 6)
  }

  /**
   * Tempo and rhythmic strength from the onset envelope's autocorrelation.
   *
   * Both fall out of one computation, which is the argument for doing it here
   * rather than adding a BPM library: the peak's *height* is how rhythmic the
   * music is and its *lag* is the tempo, and the height is the number this
   * file actually needs. The estimate is coarse — no octave-error correction,
   * no beat phase — and if a solid BPM ever matters, realtime-bpm-analyzer is
   * ~7 KB and does the job properly. This is enough to tell a pulse from an
   * ambient wash, which is what the flavour axis asks.
   *
   * Eight seconds of envelope is the floor, not a choice: below about four you
   * cannot separate a tempo from double it, and the search runs to 1 s of lag.
   */
  private computeTempo(): void {
    let mean = 0
    for (let i = 0; i < ONSET_N; i++) mean += this.onsets[i]
    mean /= ONSET_N

    let zero = 0
    for (let i = 0; i < ONSET_N; i++) {
      const v = this.onsets[i] - mean
      zero += v * v
    }
    const variance = zero / ONSET_N

    // An absolute floor, not just a relative one. The first version divided by
    // the variance and guarded only against exact zero, so an ambient passage —
    // whose onset envelope is nearly constant and *tiny* — produced a ratio of
    // two very small numbers and reported 80% rhythmic with a confident BPM.
    // No pulse must read as no pulse, not as noise amplified into a pulse.
    if (mean < 0.01 || Math.sqrt(variance) < 0.02) {
      this.rhythmic += (0 - this.rhythmic) * 0.2
      this.bpm = 0
      return
    }

    let bestLag = 0
    let bestVal = -Infinity
    let acfSum = 0
    let acfN = 0
    for (let lag = LAG_MIN; lag <= LAG_MAX; lag++) {
      let acc = 0
      for (let i = lag; i < ONSET_N; i++) {
        const a = this.onsets[(this.onsetHead + i) % ONSET_N] - mean
        const b = this.onsets[(this.onsetHead + i - lag) % ONSET_N] - mean
        acc += a * b
      }
      // Normalise by the overlap, or long lags are penalised for having fewer
      // terms and the search always prefers the fastest tempo it can see.
      acc /= ONSET_N - lag
      acfSum += acc
      acfN++
      if (acc > bestVal) {
        bestVal = acc
        bestLag = lag
      }
    }

    // What makes a pulse is a peak that stands *above the other lags*, not one
    // that is merely the largest. Comparing the winner against the mean across
    // the search range is what separates a real periodicity from the highest
    // bump on a noise floor.
    const contrast = (bestVal - acfSum / acfN) / variance
    const strength = clamp01(contrast * 2.2)
    this.rhythmic += (strength - this.rhythmic) * 0.2
    this.bpm = strength > 0.25 ? (ONSET_HZ * 60) / bestLag : 0
  }

  /**
   * Feed one rendered frame. Decimates internally, so this is safe to call at
   * whatever rate the render loop happens to be running at.
   *
   * Takes the fast tier's output as well as the raw frame: `transient`,
   * `roughness` and `level` are already computed and tuned, and recomputing
   * them here would be both wasted work and a second set of constants to keep
   * in step with the first.
   */
  update(frame: AudioFrame, motion: VisualParams): Character {
    const { dt } = frame

    // --- onset envelope, at its own rate ---
    this.onsetAccum += dt
    this.onsetPeak = Math.max(this.onsetPeak, motion.transient)
    if (this.onsetAccum >= 1 / ONSET_HZ) {
      this.onsetAccum %= 1 / ONSET_HZ
      this.onsets[this.onsetHead] = this.onsetPeak
      this.onsetHead = (this.onsetHead + 1) % ONSET_N
      this.onsetPeak = 0
    }

    // --- onset rate, from rising edges of the fast tier's transient ---
    const above = motion.transient > 0.45
    if (above && !this.wasAbove) this.onsetCount++
    this.wasAbove = above
    this.onsetWindow += dt

    this.dwell += dt

    // --- everything structural, at SLOW_HZ ---
    this.accum += dt
    if (this.accum < 1 / SLOW_HZ) return this.read()
    this.accum %= 1 / SLOW_HZ
    const slowDt = 1 / SLOW_HZ

    bandVector(frame, this.scratch)
    this.history.set(this.scratch, this.head * N_BANDS)
    this.head = (this.head + 1) % BUFFER_N
    this.filled = Math.min(this.filled + 1, BUFFER_N)

    this.nShort = this.noveltyAt(HALF_SHORT)
    this.nMedium = this.noveltyAt(HALF_MEDIUM)
    this.nLong = this.noveltyAt(HALF_LONG)
    this.recurrence = this.computeRecurrence()

    if (this.nMedium > BOUNDARY) this.dwell = 0

    // --- flavour axes ---
    const kT = 1 - Math.exp(-slowDt / TAU_TIMBRE)
    const kR = 1 - Math.exp(-slowDt / TAU_RHYTHM)

    // roughness already is (2.2 - beta)/2, i.e. flat-and-bright = 1. Reusing it
    // rather than re-fitting the slope here.
    this.bright += (motion.roughness - this.bright) * kT

    const flat = spectralFlatness(frame)
    if (flat >= 0) this.noisy += (flat - this.noisy) * kT

    if (this.onsetWindow > 0) {
      // Four onsets a second is busy; past that the difference stops reading.
      const rate = clamp01(this.onsetCount / this.onsetWindow / 4)
      this.dense += (rate - this.dense) * kR
      this.onsetCount = 0
      this.onsetWindow = 0
    }

    this.computeTempo()

    return this.read()
  }

  private read(): Character {
    return {
      bright: this.bright,
      noisy: this.noisy,
      dense: this.dense,
      rhythmic: this.rhythmic,
      noveltyShort: this.nShort,
      noveltyMedium: this.nMedium,
      noveltyLong: this.nLong,
      recurrence: this.recurrence,
      dwell: this.dwell,
      bpm: this.bpm,
      warm: this.filled >= HALF_LONG * 2,
    }
  }
}
