/**
 * Audio -> visual parameters.
 *
 * This is the interesting variable in the whole project and it is meant to be
 * swapped. Two strategies ship; `main.ts` picks one by name. Add a third rather
 * than editing one in place, so they can be compared against the same recording.
 *
 * Both strategies end at the same place — an asymmetric envelope with a fast
 * attack and a slow release — because the reference recording's character is a
 * quick swell followed by a long irregular decay, and a symmetric smoother
 * renders that as a flat smear.
 */

import type { AudioFrame } from './audio'

export interface VisualParams {
  /** Overall drive, 0-1. The shader's master intensity. */
  level: number
  /** Band energies, 0-1. */
  low: number
  mid: number
  high: number
  /** Sharp broadband onsets, 0-1. Decays much faster than `level`. */
  transient: number
}

export interface Mapping {
  readonly name: string
  update(frame: AudioFrame): VisualParams
}

/** Band edges in Hz. Low stops at 120 because phone mics give us nothing below it. */
const BANDS = {
  low: [40, 250],
  mid: [250, 1600],
  high: [1600, 8000],
} as const

/**
 * One-pole envelope follower with separate attack and release times.
 *
 * `attack`/`release` are the time in seconds to cover ~63% of the distance to
 * the target, so they read as musical durations rather than magic coefficients.
 */
class Envelope {
  private value = 0
  private readonly attack: number
  private readonly release: number

  // Written out rather than using TypeScript parameter properties, so the file
  // runs unmodified under `node --experimental-strip-types` — which is how the
  // mapping gets probed offline without a browser.
  constructor(attack: number, release: number) {
    this.attack = attack
    this.release = release
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
 * Tracks a rolling ceiling for a signal so it can be normalised to 0-1 without
 * knowing its absolute scale in advance.
 *
 * The ceiling rises instantly and falls slowly. That asymmetry is the whole
 * point: a sudden loud sound immediately expands the range (so it doesn't clip
 * to a flat 1.0), and the range then creeps back down over ~10s of quiet so a
 * whisper eventually fills the screen again.
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

/**
 * Soft saturation: 0 stays 0, small values are amplified roughly linearly by
 * `gain`, and the curve flattens towards 1 instead of clipping.
 *
 * This is what lets a mapping have fixed sensitivity without a hard ceiling. A
 * loud room pushes towards 1 and compresses gracefully rather than clamping to
 * a flat maximum, and — crucially — a quiet passage still reads as quiet, which
 * a normaliser cannot offer.
 */
function soften(v: number, gain: number): number {
  return 1 - Math.exp(-v * gain)
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
 * every gap in speech flash.
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
 * Strategy A — speech-band and transients, fixed sensitivity.
 *
 * Built for the reference recording: energy concentrated in 250-1600Hz, no
 * usable sub-bass, no beat grid. Drive comes from the mid band, and the low
 * band contributes almost nothing to `level`, so an empty bottom end does not
 * read as silence.
 *
 * Deliberately NOT normalised. An earlier version ran `level` through a rolling
 * ceiling and it pinned to 0.98 against a steady tone whose mid band was only
 * 0.06 — which is what an AGC is *for*, and exactly wrong here. The brief is
 * swell and decay, and a normaliser's whole job is to erase the difference
 * between loud and quiet. Fixed gain plus soft saturation keeps it.
 *
 * `GAIN` is the one number to touch when tuning against a real room: raise it
 * if the field stays dim, lower it if everything saturates. Use
 * `auto-normalised` instead when the input level is genuinely unknown.
 */
const GAIN = 6

export function speechBandMapping(): Mapping {
  const lowEnv = new Envelope(0.05, 0.9)
  const midEnv = new Envelope(0.04, 0.7)
  const highEnv = new Envelope(0.03, 0.5)
  const levelEnv = new Envelope(0.08, 1.8)
  const transientEnv = new Envelope(0.005, 0.22)
  const flux = new SpectralFlux()

  return {
    name: 'speech-band',
    update(frame) {
      const { dt } = frame
      const low = lowEnv.push(soften(bandEnergy(frame, ...BANDS.low), GAIN), dt)
      const mid = midEnv.push(soften(bandEnergy(frame, ...BANDS.mid), GAIN), dt)
      const high = highEnv.push(soften(bandEnergy(frame, ...BANDS.high), GAIN), dt)

      // Weighted towards the mids, where a voice actually lives.
      const level = levelEnv.push(mid * 0.7 + high * 0.2 + low * 0.1, dt)
      const transient = transientEnv.push(flux.update(frame, dt), dt)

      return { level, low, mid, high, transient }
    },
  }
}

/**
 * Strategy B — full spectrum, auto-normalised per band.
 *
 * Each band gets its own rolling ceiling, so a quiet voice memo and a loud
 * music track both reach the top of the visual range.
 *
 * The trade is the one `speech-band` refuses to make: this cannot tell loud
 * from quiet, because it rescales until whatever is arriving fills the range.
 * Sustained material sits near maximum by construction. That is the right
 * behaviour when the input level is unknown or wildly variable, and the wrong
 * one when dynamics are the point.
 */
export function autoNormalisedMapping(): Mapping {
  const envs = {
    low: new Envelope(0.04, 0.6),
    mid: new Envelope(0.04, 0.6),
    high: new Envelope(0.03, 0.45),
  }
  const ceilings = {
    low: new RollingCeiling(0.02, 6),
    mid: new RollingCeiling(0.02, 6),
    high: new RollingCeiling(0.02, 6),
  }
  const levelEnv = new Envelope(0.06, 1.2)
  const levelCeiling = new RollingCeiling(0.02, 6)
  const transientEnv = new Envelope(0.005, 0.22)
  const flux = new SpectralFlux()

  return {
    name: 'auto-normalised',
    update(frame) {
      const { dt } = frame

      const raw = {
        low: bandEnergy(frame, ...BANDS.low),
        mid: bandEnergy(frame, ...BANDS.mid),
        high: bandEnergy(frame, ...BANDS.high),
      }
      const band = (k: keyof typeof envs) =>
        envs[k].push(ceilings[k].normalise(raw[k], dt), dt)

      // `level` is normalised from the combined *raw* energy, not averaged from
      // the three already-normalised bands. Averaging normalised bands caps
      // single-band material at 1/3 — mid-only speech measured a flat 0.33 no
      // matter how loud it got, which defeats the entire point of this strategy.
      const level = levelEnv.push(
        levelCeiling.normalise((raw.low + raw.mid + raw.high) / 3, dt),
        dt,
      )
      const transient = transientEnv.push(flux.update(frame, dt), dt)

      return { level, low: band('low'), mid: band('mid'), high: band('high'), transient }
    },
  }
}

export const MAPPINGS = {
  'speech-band': speechBandMapping,
  'auto-normalised': autoNormalisedMapping,
} satisfies Record<string, () => Mapping>

export type MappingName = keyof typeof MAPPINGS
