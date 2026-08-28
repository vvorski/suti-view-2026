/**
 * Headless exercise of the minutes tier.
 *
 * This one is not optional the way a visual check is optional. You cannot tune
 * a ninety-second behaviour by watching a screen — by the time you have seen
 * enough of it to judge, you have forgotten what it was doing at the start, and
 * a five-minute buffer takes five minutes to fill before it says anything at
 * all. So the whole thing runs against a synthetic arrangement at a few hundred
 * times real time.
 *
 * The arrangement is deliberately obvious: five sections that a person would
 * label without hesitating. If the analysis cannot find boundaries here it will
 * certainly not find them in real music, and if it fires the director between
 * sections it is firing on noise.
 *
 *   node --experimental-strip-types scripts/probe-slow.ts
 */

import type { AudioFrame } from '../src/audio.ts'
import { Director } from '../src/director.ts'
import { MAPPINGS } from '../src/mapping.ts'
import { SlowAnalysis } from '../src/slow.ts'
import type { AtmosphericViewName } from '../src/views.ts'
import type { GeoColour } from '../src/geo-colour.ts'

const SR = 48000
const BINS = 1024
const BIN_HZ = SR / (BINS * 2)
const FPS = 60
const DT = 1 / FPS

interface Section {
  name: string
  seconds: number
  /** Spectral slope: high is dark and steep, low is bright and flat. */
  slope: number
  /** 0 = pure partials, 1 = broadband noise. */
  noise: number
  /** Overall drive, 0-1. */
  level: number
  /** 0 means no pulse at all. */
  bpm: number
  /** Beats per bar that actually get a hit — density of the pattern. */
  hitsPerBeat: number
  /**
   * dB offsets at 60 Hz / 900 Hz / 12 kHz, interpolated across log frequency.
   *
   * This is the part the first version of this file got wrong, and the
   * analysis was blamed for it. Sections originally differed only by overall
   * spectral slope — and the band vectors are L2-normalised, which removes
   * scalar multiples, so a pure tilt change is very nearly invisible to
   * novelty by construction. Measured |mA-mB|² between "intro" and "drop" was
   * 0.017, indistinguishable from noise, and the conclusion "novelty is
   * broken" was wrong: novelty was correctly reporting that nothing had moved
   * between bands.
   *
   * Real sections change which bands are *occupied* — a breakdown drops the
   * highs, a drop adds sub and air. That is what these do.
   */
  shape: readonly [number, number, number]
}

/**
 * Intro and outro are the same material on purpose: the recurrence measure
 * should notice, and that is the one signal here that cannot be faked by a
 * loudness envelope.
 */
const ARRANGEMENT: Section[] = [
  { name: 'intro',     seconds: 60, slope: 2.0, noise: 0.15, level: 0.25, bpm: 0,   hitsPerBeat: 0, shape: [-4, 2, -20] },
  { name: 'build',     seconds: 60, slope: 1.6, noise: 0.35, level: 0.5,  bpm: 124, hitsPerBeat: 1, shape: [0, 4, -8] },
  { name: 'drop',      seconds: 90, slope: 1.2, noise: 0.6,  level: 0.9,  bpm: 124, hitsPerBeat: 2, shape: [10, 0, 6] },
  { name: 'breakdown', seconds: 50, slope: 1.9, noise: 0.2,  level: 0.3,  bpm: 0,   hitsPerBeat: 0, shape: [-8, 6, -14] },
  { name: 'outro',     seconds: 60, slope: 2.0, noise: 0.15, level: 0.25, bpm: 0,   hitsPerBeat: 0, shape: [-4, 2, -20] },
]

const freq = new Uint8Array(BINS)
const time = new Uint8Array(BINS)

/** Deterministic noise — Math.random would make two runs incomparable, which
 *  is the whole point of having a harness rather than a phone. */
let seed = 12345
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

/**
 * One frame of spectrum.
 *
 * Built in dB because that is what getByteFrequencyData returns — a synthetic
 * frame built in linear magnitude and then converted would exercise a different
 * curve from the one the analysers actually see.
 */
function makeFrame(sec: Section, hit: number): AudioFrame {
  const drive = sec.level * (0.75 + 0.25 * hit)
  for (let i = 1; i < BINS; i++) {
    const hz = i * BIN_HZ
    if (hz < 40 || hz > 16000) {
      freq[i] = 0
      continue
    }
    // Base 1/f slope.
    let db = -20 - sec.slope * 10 * Math.log10(hz / 60)
    // Partials: narrow peaks on a harmonic series, weighted by how tonal this
    // section is. Without these every section is broadband and spectral
    // flatness has nothing to measure.
    const f0 = 110
    const harm = hz / f0
    const near = Math.abs(harm - Math.round(harm))
    if (near < 0.04 && Math.round(harm) >= 1) db += (1 - sec.noise) * 22
    // Per-section band emphasis: three control points in log frequency.
    const u = Math.min(1, Math.max(0, Math.log10(hz / 60) / Math.log10(12000 / 60)))
    db +=
      u < 0.5
        ? sec.shape[0] + (sec.shape[1] - sec.shape[0]) * (u * 2)
        : sec.shape[1] + (sec.shape[2] - sec.shape[1]) * ((u - 0.5) * 2)
    // Broadband floor, raised by the noise level.
    db += sec.noise * 14 + (rnd() - 0.5) * 3
    // A hit is broadband and brief.
    db += hit * 16
    db += 20 * Math.log10(Math.max(drive, 1e-3))

    const byte = ((db + 95) / 85) * 255
    freq[i] = byte < 0 ? 0 : byte > 255 ? 255 : Math.round(byte)
  }
  return { freq, time, binCount: BINS, sampleRate: SR, dt: DT }
}

const mapping = MAPPINGS.relative()
const slow = new SlowAnalysis()
const director = new Director()

// What the app currently has on screen, so the director can be asked for a
// change rather than for an opinion.
const current: { geoColour: GeoColour; atmosphericView: AtmosphericViewName } = {
  geoColour: { r: 1, g: 1, b: 1 },
  atmosphericView: 'field',
}

const pct = (v: number): string => (v * 100).toFixed(0).padStart(3)

console.log(
  'time  section    bright noisy dense rhythm  nShort nMed nLong  recur dwell   bpm',
)

let t = 0
let sinceReport = 0
const decisions: string[] = []

for (const sec of ARRANGEMENT) {
  const beatSeconds = sec.bpm > 0 ? 60 / sec.bpm : 0
  const start = t

  while (t - start < sec.seconds) {
    // Hit envelope: a short broadband spike on the pattern's grid.
    let hit = 0
    if (beatSeconds > 0) {
      const step = beatSeconds / Math.max(1, sec.hitsPerBeat)
      const phase = (t % step) / step
      if (phase < 0.06) hit = 1 - phase / 0.06
    }

    const params = mapping.update(makeFrame(sec, hit))
    const c = slow.update({ freq, time, binCount: BINS, sampleRate: SR, dt: DT }, params)

    const next = director.update(c, DT, current)
    if (next) {
      const bits: string[] = []
      if (next.geoColour) {
        current.geoColour = next.geoColour
        const { r, g, b } = next.geoColour
        bits.push(`colour ${pct(r)}/${pct(g)}/${pct(b)}`)
      }
      if (next.atmosphericView) {
        current.atmosphericView = next.atmosphericView
        bits.push(`view ${next.atmosphericView}`)
      }
      decisions.push(
        `  ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}  ` +
          `${sec.name.padEnd(10)} ${bits.join('   ')}`,
      )
    }

    sinceReport += DT
    if (sinceReport >= 10) {
      sinceReport = 0
      console.log(
        `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')} `,
        sec.name.padEnd(10),
        pct(c.bright),
        pct(c.noisy),
        pct(c.dense),
        pct(c.rhythmic).padStart(6),
        pct(c.noveltyShort).padStart(7),
        pct(c.noveltyMedium).padStart(4),
        pct(c.noveltyLong).padStart(5),
        pct(c.recurrence).padStart(6),
        c.dwell.toFixed(0).padStart(5),
        c.bpm.toFixed(0).padStart(5),
        c.warm ? '' : ' (cold)',
      )
    }
    t += DT
  }
}

console.log('\nDirector decisions:')
console.log(decisions.length ? decisions.join('\n') : '  (none)')

// What this run is actually asserting. Everything above is for reading; these
// are the claims that would make the tier worthless if they failed.
const problems: string[] = []
if (decisions.length === 0) problems.push('director never acted across a whole arrangement')
if (decisions.length > 6) problems.push(`director acted ${decisions.length} times — too busy`)
console.log()
console.log(problems.length ? 'CHECK: ' + problems.join('; ') : 'PASS: director acted, and sparingly.')
