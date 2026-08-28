/**
 * Longer-timescale music analysis: timbre features, structural novelty, and
 * spectral fractal character.
 *
 * Everything in `mapping.ts` reacts within a second or less. That is enough for
 * beats and breaks and nothing else — it has no idea whether the last thirty
 * seconds were a verse or a build, because it never looks further back than its
 * own envelopes. This file is the memory.
 *
 * The method is Foote's (2000) self-similarity novelty, adapted to run live.
 * Offline you build a full self-similarity matrix over the whole track and
 * convolve a Gaussian-tapered checkerboard kernel down its diagonal; peaks in
 * the result are section boundaries. That kernel is centred, so it needs half a
 * window of *future* audio — about a second of lag before the visuals could
 * react to a change that already happened.
 *
 * So the kernel here is evaluated with the boundary at "now": compare the most
 * recent half-window against the one before it. High novelty means both halves
 * are internally consistent and unlike each other, which is the same
 * checkerboard shape, just causal. It gives up the ability to refine a boundary
 * after the fact — irrelevant when there is no "after the fact" — and buys back
 * the entire lag.
 */

import { MAX_DB, MIN_DB, type AudioFrame } from './audio.ts'

/** Log-spaced band edges in Hz. Twelve bands is enough to tell timbre apart. */
const BAND_EDGES = [
  60, 100, 160, 250, 400, 600, 900, 1400, 2200, 3400, 5200, 8000, 12000,
] as const
const N_BANDS = BAND_EDGES.length - 1

/** Feature frames per second. Foote-style analysis wants ~10 Hz, not 60. */
const FEATURE_HZ = 10
/** Half-window, in feature frames. 8 frames = 0.8s each side, 1.6s total. */
const HALF = 8

export interface Features {
  /**
   * Structural novelty, 0-1. Rises when the character of the sound changes in
   * a sustained way — a section boundary, a new instrument, the drop. Distinct
   * from `transient` (a single hit) and from `breakdown` (energy falling).
   */
  novelty: number
  /**
   * Spectral roughness, 0-1, from the 1/f exponent of the spectrum.
   *
   * Voss and Clarke showed musical audio power follows roughly 1/f — pink
   * noise. The exponent is a genuine timbral descriptor: a steep slope means
   * energy concentrated low and a smooth, dark sound; a shallow one means
   * energy spread up the spectrum, bright and noisy. Because the shader is
   * built on fractal noise, this maps onto it directly — the audio's spectral
   * self-similarity drives the visual's.
   */
  roughness: number
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Log-band magnitudes, L2-normalised so the vector describes timbre not volume. */
function bandVector(frame: AudioFrame, out: Float32Array): void {
  const binHz = frame.sampleRate / (frame.binCount * 2)

  for (let b = 0; b < N_BANDS; b++) {
    const lo = Math.max(0, Math.floor(BAND_EDGES[b] / binHz))
    const hi = Math.min(frame.binCount, Math.ceil(BAND_EDGES[b + 1] / binHz))
    let sum = 0
    for (let i = lo; i < hi; i++) sum += frame.freq[i]
    // Log scale: perceived timbre is closer to log magnitude, and it stops one
    // loud band from dominating the direction of the whole vector.
    out[b] = Math.log1p(hi > lo ? sum / (hi - lo) : 0)
  }

  // Mean-variance normalise, then L2. Both steps matter and for different
  // reasons.
  //
  // Removing the mean is the one that is easy to skip and fatal to skip. Log
  // magnitudes are all positive and land in a narrow range, so the cosine
  // similarity between *any* two frames sits around 0.9 and the measurement
  // cannot discriminate — measured novelty peaked at 0.13 on a change from a
  // bass-led to a treble-led section, which is a change you could not miss by
  // ear. Centring turns the dot product into a correlation coefficient that
  // spans -1..1 and actually responds to shape.
  //
  // The L2 step then makes it a comparison of character rather than of
  // loudness: without it, every loud passage resembles every other loud
  // passage and the novelty function just retraces the volume envelope.
  let mean = 0
  for (let b = 0; b < N_BANDS; b++) mean += out[b]
  mean /= N_BANDS

  let norm = 0
  for (let b = 0; b < N_BANDS; b++) {
    out[b] -= mean
    norm += out[b] * out[b]
  }
  norm = Math.sqrt(norm)
  if (norm > 1e-6) for (let b = 0; b < N_BANDS; b++) out[b] /= norm
}

/**
 * The 1/f exponent: least-squares slope of level-in-dB against log frequency.
 *
 * The subtlety that makes or breaks this: `getByteFrequencyData` returns values
 * already linear in **decibels**, not in magnitude. Taking `log(byte/255)` — the
 * obvious thing, and what this did at first — is a second logarithm on top of
 * the first, which compresses the whole measurement. Recovery of a known
 * exponent went from 0.06 to 0.5 units of output per unit of beta once the
 * extra log came out.
 *
 * For a power law |X(f)| proportional to f^(-beta/2), level in dB falls as
 * -10*beta*log10(f), so beta = -slope/10 with no further correction.
 *
 * Computed over the 12 log-spaced bands rather than all 1024 bins: the bins are
 * far noisier frame to frame, and the regression only needs the overall tilt.
 */
function spectralBeta(frame: AudioFrame): number {
  const binHz = frame.sampleRate / (frame.binCount * 2)
  const dbRange = MAX_DB - MIN_DB
  let n = 0
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0

  for (let b = 0; b < N_BANDS; b++) {
    const lo = Math.max(0, Math.floor(BAND_EDGES[b] / binHz))
    const hi = Math.min(frame.binCount, Math.ceil(BAND_EDGES[b + 1] / binHz))
    if (hi <= lo) continue

    let sum = 0
    for (let i = lo; i < hi; i++) sum += frame.freq[i]
    const byte = sum / (hi - lo)
    // Skip the rails. A band sitting at 0 is below the analyser floor and a band
    // at 255 is clipped against its ceiling; both would flatten the fitted slope
    // towards zero while looking like perfectly good data.
    if (byte < 4 || byte > 250) continue

    const x = Math.log10(Math.sqrt(BAND_EDGES[b] * BAND_EDGES[b + 1]))
    const y = MIN_DB + (byte / 255) * dbRange
    n++
    sx += x
    sy += y
    sxx += x * x
    sxy += x * y
  }

  if (n < 4) return 1 // too little signal to tell; assume pink
  const denom = n * sxx - sx * sx
  if (Math.abs(denom) < 1e-9) return 1
  return -((n * sxy - sx * sy) / denom) / 10
}

export class StructureAnalysis {
  /** Ring buffer of the last 2*HALF feature vectors. */
  private readonly history = new Float32Array(2 * HALF * N_BANDS)
  private readonly scratch = new Float32Array(N_BANDS)
  private head = 0
  private filled = 0
  private accum = 0

  private noveltyValue = 0
  private roughnessValue = 0.5

  /** Cosine similarity of two stored feature frames (already L2-normalised). */
  private sim(a: number, b: number): number {
    const ia = a * N_BANDS
    const ib = b * N_BANDS
    let dot = 0
    for (let k = 0; k < N_BANDS; k++) dot += this.history[ia + k] * this.history[ib + k]
    return dot
  }

  /**
   * Causal checkerboard: recent half-window vs the one before it.
   *
   *   novelty = mean(sim within A) + mean(sim within B) - 2 * mean(sim A,B)
   *
   * Exactly the +1/-1 quadrant structure of Foote's kernel, evaluated with the
   * boundary at the newest sample instead of at the kernel's centre.
   */
  private computeNovelty(): number {
    // Index 0 is the oldest of the 2*HALF frames, 2*HALF-1 the newest.
    const at = (i: number) => (this.head + i) % (2 * HALF)

    let within = 0
    let withinN = 0
    let across = 0
    let acrossN = 0

    for (let i = 0; i < 2 * HALF; i++) {
      for (let j = i + 1; j < 2 * HALF; j++) {
        const sameHalf = i < HALF === j < HALF
        // Taper towards the window edges. Frames far from the boundary say less
        // about it, and without this a single odd frame at either end swings the
        // whole measurement.
        const w =
          (1 - Math.abs(i - (HALF - 0.5)) / HALF) *
          (1 - Math.abs(j - (HALF - 0.5)) / HALF)
        const s = this.sim(at(i), at(j)) * w

        if (sameHalf) {
          within += s
          withinN += w
        } else {
          across += s
          acrossN += w
        }
      }
    }

    if (withinN < 1e-6 || acrossN < 1e-6) return 0
    // Both terms are mean cosine similarities in [-1, 1]; the difference is the
    // contrast across the boundary. Scaled because real music rarely exceeds
    // ~0.3 here even at an obvious section change.
    return clamp01((within / withinN - across / acrossN) * 3.2)
  }

  update(frame: AudioFrame): Features {
    const { dt } = frame

    // Spectral slope is cheap and benefits from every frame, so it is not
    // decimated — just heavily smoothed, since it describes timbre and timbre
    // should not flicker.
    // beta is the 1/f exponent: ~1 is pink (typical music), larger means energy
    // falling away steeply with frequency, smaller means a flat, noisy spectrum.
    //
    // Roughness runs the *opposite* way to beta, which is easy to get backwards
    // and was: a steep spectrum is dark and smooth, so it should produce smooth
    // visual structure, while a flat one is bright and noisy and should produce
    // fine detail. Inverted, dark music rendered as the roughest possible field.
    const beta = spectralBeta(frame)
    const roughTarget = clamp01((2.2 - beta) / 2.0)
    this.roughnessValue += (roughTarget - this.roughnessValue) * (1 - Math.exp(-dt / 1.8))

    // The structural analysis runs at FEATURE_HZ. Running it per render frame
    // would cost 6x more and measure nothing extra: section boundaries do not
    // move at 60 Hz.
    this.accum += dt
    if (this.accum >= 1 / FEATURE_HZ) {
      this.accum %= 1 / FEATURE_HZ

      bandVector(frame, this.scratch)
      this.history.set(this.scratch, this.head * N_BANDS)
      this.head = (this.head + 1) % (2 * HALF)
      this.filled = Math.min(this.filled + 1, 2 * HALF)

      if (this.filled === 2 * HALF) {
        const raw = this.computeNovelty()
        // Rise quickly, fall slowly: a boundary is an event worth holding on
        // screen for a moment, not a spike to be smoothed away.
        this.noveltyValue = raw > this.noveltyValue ? raw : this.noveltyValue
      }
    }

    // Decay happens per render frame so it is smooth regardless of feature rate.
    this.noveltyValue *= Math.exp(-dt / 1.6)

    return { novelty: this.noveltyValue, roughness: this.roughnessValue }
  }
}
