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

import type { AudioFrame } from '../src/engine/capture.ts'
import { Director } from '../src/director.ts'
import { MAPPINGS } from '../src/engine/fast.ts'
import { BLANK, SlowAnalysis } from '../src/engine/slow.ts'
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

    const next = director.update(c, DT, current, params.beatPhase, params.beatConfidence)
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

// docs/todo.md entry 81 — the bar-quantisation logic in isolation. The
// arrangement above exercises it incidentally (the "drop"/"build" sections
// are genuinely rhythmic and can lock a real tempo), but only this direct
// drive proves the specific claims Decided makes: immediate at zero
// confidence, held for a bar at high confidence, released quickly rather
// than stranded if confidence drops mid-wait, and discarded outright by a
// manual suspend.
console.log('\nBar-quantisation (entry 81), driven directly:\n')
{
  let failures = 0
  const check = (name: string, ok: boolean, detail: string): void => {
    if (!ok) failures++
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
  }

  // A Character that is due a colour change on the very first call: `warm`,
  // maximum novelty (so requiredNovelty's own floor is trivially cleared —
  // sinceColour has barely moved past COLOUR_HOLD, where the floor is
  // still its full, un-decayed BOUNDARY), and a `bright` far enough from
  // white to clear COLOUR_MIN_STEP. No warm-up needed: `sinceColour` starts
  // at exactly COLOUR_HOLD (director.ts's own field default), already
  // satisfying that half of the due-check on a fresh Director.
  const dueCharacter = { ...BLANK, warm: true, bright: 1, noveltyMedium: 1 }
  const idleCurrent = { geoColour: { r: 1, g: 1, b: 1 }, atmosphericView: 'field' as AtmosphericViewName }

  // 1. Zero confidence: fires the instant it becomes due, unchanged from
  //    before this entry.
  {
    const d = new Director()
    const next = d.update(dueCharacter, DT, idleCurrent, 0, 0)
    check('confidence 0 fires immediately', next?.geoColour !== undefined, `next=${JSON.stringify(next)}`)
  }

  // 2. Full confidence, a bar boundary already on the due frame: also fires
  //    immediately — holding would only cost a full extra bar for nothing.
  //    Three zero-dt calls walk beatsIntoBar from 0 to 3 without touching
  //    sinceColour/sinceView at all, so the due-check itself is reached in
  //    exactly the same state as case 1 — only the bar clock differs.
  {
    const d = new Director()
    let phase = 0
    for (let i = 0; i < 3; i++) {
      phase = 0.9
      d.update({ ...BLANK, warm: true }, 0, idleCurrent, phase, 1)
      phase = 0.1
      d.update({ ...BLANK, warm: true }, 0, idleCurrent, phase, 1)
    }
    // The fourth wrap lands on the actual due-check call itself.
    const next = d.update(dueCharacter, DT, idleCurrent, 0.9, 1)
    const arrived = d.update(dueCharacter, DT, idleCurrent, 0.1, 1)
    check(
      'confidence 1, bar arriving on the due frame, fires immediately',
      next === null && arrived?.geoColour !== undefined,
      `next=${JSON.stringify(next)} arrived=${JSON.stringify(arrived)}`,
    )
  }

  // 3. Full confidence, no bar yet: held rather than fired, and released
  //    exactly when the bar arrives.
  {
    const d = new Director()
    const first = d.update(dueCharacter, DT, idleCurrent, 0, 1)
    check('confidence 1, no bar yet, holds rather than firing', first === null, `next=${JSON.stringify(first)}`)
    check('holding is visible on status()', d.status().waitingForBar, 'waitingForBar was false')

    // Advance the bar clock four beats without ever reaching a fresh due
    // condition (idleCurrent never changes, and nothing here raises
    // noveltyMedium again).
    let phase = 0
    let released: ReturnType<Director['update']> = null
    for (let i = 0; i < 4 && !released; i++) {
      phase = 0.9
      d.update({ ...BLANK, warm: true }, DT, idleCurrent, phase, 1)
      phase = 0.1
      const r = d.update({ ...BLANK, warm: true }, DT, idleCurrent, phase, 1)
      if (r) released = r
    }
    check('released once the bar line arrives', released?.geoColour !== undefined, `released=${JSON.stringify(released)}`)
  }

  // 4. Decided's own explicit worry: a tempo that drops mid-wait must not
  //    strand the decision. Confidence falling to 0 while still waiting
  //    releases it within a frame rather than never.
  {
    const d = new Director()
    const first = d.update(dueCharacter, DT, idleCurrent, 0, 1)
    check('holds at full confidence', first === null, `next=${JSON.stringify(first)}`)
    // Confidence collapses (tempo lost) without a bar ever arriving.
    const second = d.update({ ...BLANK, warm: true }, DT, idleCurrent, 0, 0)
    check('a dropped lock releases the held decision rather than stranding it', second?.geoColour !== undefined, `second=${JSON.stringify(second)}`)
  }

  // 5. A manual change discards a held decision outright — "never fight
  //    the user" applies to a decision not yet landed too.
  {
    const d = new Director()
    const first = d.update(dueCharacter, DT, idleCurrent, 0, 1)
    check('holds before the manual change', first === null, `next=${JSON.stringify(first)}`)
    d.suspend()
    check('suspend clears the pending decision', d.status().waitingForBar === false, 'still waiting after suspend')
    // Even once suspend clears and a bar arrives, the discarded decision
    // does not reappear on its own — a fresh due-check would be needed,
    // and idleCurrent/BLANK together are not due for anything.
    let phase = 0
    let reappeared = false
    for (let i = 0; i < 400; i++) {
      phase = (phase + 0.05) % 1
      const r = d.update({ ...BLANK, warm: true }, DT, idleCurrent, phase, 1)
      if (r) reappeared = true
    }
    check('the discarded decision never reappears on its own', !reappeared, 'a stale decision fired after suspend')
  }

  console.log(failures === 0 ? '\nall bar-quantisation checks passed' : `\n${failures} check(s) failed`)
  if (failures > 0) process.exitCode = 1
}
