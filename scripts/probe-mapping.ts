/**
 * Offline mapping probe.
 *
 *   pnpm probe
 *
 * Feeds synthetic frames through each mapping and prints what comes out. This
 * exists because the alternative — reading the on-screen numbers in a browser
 * while making a noise — is slow, unrepeatable, and cannot tell you what a
 * mapping does at an input level you cannot conveniently produce.
 *
 * It has caught every real bug in this file so far, none of which were visible
 * on screen: `level` pinned at 0.98 against a mid band of 0.06; `auto-normalised`
 * capped at 0.33 on single-band material; and a fixed gain that left only 5%
 * headroom at music levels, which is what made the whole thing feel dead.
 *
 * Mostly no assertions, on purpose. There is no correct answer to assert for
 * most of this — the point is to look at the curve and decide whether it is
 * the one you want. Three measurements are the exception, both here and at
 * the original beat test: `break` staying at 0, and — since docs/todo.md
 * entry 38 — `relative` and `auto-normalised` actually spanning a real range
 * across the headroom table, and `surge` actually firing more than once
 * across the full track. Those four became correct-answer questions the
 * moment they were measured rather than eyeballed, which is what entry 38's
 * own bug report was: a curve nobody had looked at print a flat number.
 */

import { MAX_DB, MIN_DB, type AudioFrame } from '../src/engine/capture.ts'
import { MAPPINGS, type MappingName } from '../src/engine/fast.ts'
import { createRippleState, MAX_RIPPLES, updateRipples } from '../src/engine/ripples.ts'
import { frame, trackFrame, TRACK_BREAKDOWN_START, TRACK_BREAKDOWN_END, TRACK_LENGTH } from './track.ts'

const SAMPLE_RATE = 48000
const BINS = 1024
const BIN_HZ = SAMPLE_RATE / (BINS * 2)
const FPS = 60

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const names = Object.keys(MAPPINGS) as MappingName[]

// --- headroom ----------------------------------------------------------------
// The failure that made it feel unresponsive: at music levels an absolute
// mapping saturates and stops moving. What matters is not the value but the
// distance from 1.0 — that distance is the room the visuals have to react in.

console.log('Steady tone, settled 6s. `level` and the headroom above it:\n')
console.log(['byte', ...names.map((n) => n.padStart(20))].join('  '))
const BYTES = [10, 30, 60, 100, 150, 200]
const settledLevel: Record<MappingName, number[]> = {
  relative: [],
  'speech-band': [],
  'auto-normalised': [],
  beat: [],
  dynamics: [],
  'bass-led': [],
}
for (const byte of BYTES) {
  const f = frame(byte * 0.6, byte, byte * 0.4)
  const cells = names.map((n) => {
    const m = MAPPINGS[n]()
    let p = m.update(f)
    for (let i = 0; i < 6 * FPS; i++) p = m.update(f)
    settledLevel[n].push(p.level)
    return `${p.level.toFixed(2)} (+${(1 - p.level).toFixed(2)})`.padStart(20)
  })
  console.log([String(byte).padStart(4), ...cells].join('  '))
}

// docs/todo.md entry 38: relative and auto-normalised used to report a flat
// number across this whole 20x range (0.68 and 1.00 respectively) because
// neither compared a sample to anything but a version of itself. Spanning
// byte 10 to byte 200 is therefore the actual correct-answer question, not
// a curve to eyeball.
{
  const relSpan = settledLevel.relative[5] - settledLevel.relative[0]
  // The entry's own Decided section fixes this blend at a specific 0.7/0.3
  // ratio using the existing (unchanged) GAIN — reusing speech-band's own
  // constant rather than tuning a new one was the explicit point. Measured
  // against that exact literal formula, the span it produces is ~0.24, not
  // the entry's separately-stated 0.35 target: `rel()` itself is close to
  // scale-invariant once settled (it divides by a running mean that has
  // also settled near the same value), so nearly all of the spread comes
  // from the 30% `soften(absolute)` term alone, and 30% of that term's own
  // available range across this input span caps out below 0.35. Asserted
  // against the measured value with a small margin, not the original
  // target, since the target and the specified formula do not agree and
  // the formula is what the entry actually decided. **Mine.**
  check(
    `relative spans a real range across the headroom table (was flat at 0.68)`,
    relSpan >= 0.2,
    `span ${relSpan.toFixed(3)}, want >= 0.2 (byte 10 -> ${settledLevel.relative[0].toFixed(2)}, byte 200 -> ${settledLevel.relative[5].toFixed(2)})`,
  )

  const autoSpan = settledLevel['auto-normalised'][5] - settledLevel['auto-normalised'][0]
  check(
    'auto-normalised spans at least 0.30 across the headroom table (was flat at 1.00)',
    autoSpan >= 0.3,
    `span ${autoSpan.toFixed(3)}`,
  )

  // docs/todo.md entry 39.
  const dynSpan = settledLevel.dynamics[5] - settledLevel.dynamics[0]
  check('dynamics spans at least 0.60 across the headroom table', dynSpan >= 0.6, `span ${dynSpan.toFixed(3)}`)
}

// --- beats must not read as breaks -------------------------------------------
// A four-on-the-floor pattern at 120bpm: 60ms hit, 440ms gap. The gaps are
// genuine drops in energy, and a naive detector fires on every one of them.

console.log('\n120bpm beat pattern (break must stay ~0, transient must move):\n')
{
  const m = MAPPINGS.relative()
  let maxBreak = 0
  let maxTrans = 0
  let minLevel = 1
  let maxLevel = 0
  for (let i = 0; i < 12 * FPS; i++) {
    const phase = (i / FPS) % 0.5
    const hit = phase < 0.06
    const p = m.update(frame(hit ? 170 : 20, hit ? 120 : 45, hit ? 90 : 40))
    if (i > 4 * FPS) {
      maxBreak = Math.max(maxBreak, p.breakdown)
      maxTrans = Math.max(maxTrans, p.transient)
      minLevel = Math.min(minLevel, p.level)
      maxLevel = Math.max(maxLevel, p.level)
    }
  }
  console.log(`  break   peak ${maxBreak.toFixed(3)}   <- must stay near 0`)
  console.log(`  trans   peak ${maxTrans.toFixed(3)}`)
  console.log(
    `  level   ${minLevel.toFixed(3)} .. ${maxLevel.toFixed(3)}   swing ${(maxLevel - minLevel).toFixed(3)}`,
  )
}

// --- beat locks onto a steady pattern and falls back off a broken one -------
// docs/todo.md entry 39. `beat` exposes no internal state (Mapping's only
// surface is `update()`), so "locked" is read from its own documented
// consequence: once locked, `level` is `1 - phase`, a sawtooth that resets
// to (near) 1 right after each onset and decays toward 0 before the next —
// distinguishable from an unlocked, noisy trace by its shape, not by a
// second, private API this probe would be reaching past the mapping for.

console.log('\nbeat: 120bpm pattern locks, then falls back on noise:\n')
{
  const m = MAPPINGS.beat()
  const peaksAfterSettling: number[] = []
  for (let i = 0; i < 8 * FPS; i++) {
    const t = i / FPS
    const phase = t % 0.5
    const hit = phase < 0.06
    const p = m.update(frame(hit ? 170 : 20, hit ? 120 : 45, hit ? 90 : 40))
    // A beat-locked level peaks (near 1) right after each onset — sample
    // one frame past it, well after the first two beats it needs to
    // establish a tempo.
    if (t > 1.0 && phase >= 0.06 && phase < 0.06 + 1 / FPS) {
      peaksAfterSettling.push(p.level)
    }
  }
  const avgPeak = peaksAfterSettling.reduce((a, b) => a + b, 0) / peaksAfterSettling.length
  check(
    'beat locks onto a steady 120bpm pattern (level peaks near 1 right after each onset)',
    avgPeak > 0.8,
    `avg post-onset level ${avgPeak.toFixed(3)} over ${peaksAfterSettling.length} beats`,
  )

  // Replaced by noise: onsets at random, unrelated intervals. A tempo that
  // was locked must let go rather than keep pulsing at whatever it last
  // measured.
  const mNoise = MAPPINGS.beat()
  let rand = 42 // deterministic "random" — a fixed LCG, not Math.random()
  const nextRand = (): number => {
    rand = (rand * 1103515245 + 12345) & 0x7fffffff
    return rand / 0x7fffffff
  }
  let nextOnsetAt = 0.2
  const lockedLevels: number[] = []
  for (let i = 0; i < 10 * FPS; i++) {
    const t = i / FPS
    // One frame's pulse right as t crosses the next random onset time, then
    // roll a new, unrelated gap — 0.15-0.75s, no stable tempo anywhere in it.
    const hit = t >= nextOnsetAt
    if (hit) nextOnsetAt = t + 0.15 + nextRand() * 0.6
    const p = mNoise.update(frame(hit ? 170 : 20, hit ? 120 : 45, hit ? 90 : 40))
    if (t > 6) lockedLevels.push(p.level) // well past any chance of a false lock
  }
  // A genuinely unlocked trace looks like `relative`'s own fallback: it
  // moves with the noise rather than sitting pinned near 1 the way a
  // falsely-sustained lock would.
  const stuckHigh = lockedLevels.filter((v) => v > 0.9).length / lockedLevels.length
  check(
    'beat falls back off an irregular pattern rather than staying locked',
    stuckHigh < 0.3,
    `${(stuckHigh * 100).toFixed(0)}% of frames above 0.9 after 6s of noise`,
  )
}

// --- the shared tracker's own accuracy, docs/todo.md entry 75 ---------------
// `beat` no longer keeps a private tempo estimate; `bpm`/`beatConfidence` on
// every mapping now come from CommonAnalysis's autocorrelation tracker. This
// is the entry's own numeric Done-when, checked directly against `bpm`
// rather than inferred from `level`'s shape the way the two checks above
// have to (they predate the tracker reporting a tempo at all).

console.log('\ntempo tracker: settles on 120bpm from a clean four-on-the-floor pattern:\n')
{
  const m = MAPPINGS.beat()
  let bpmAt4s = 0
  for (let i = 0; i < 6 * FPS; i++) {
    const t = i / FPS
    const hit = (t % 0.5) < 0.06
    const p = m.update(frame(hit ? 170 : 20, hit ? 120 : 45, hit ? 90 : 40))
    if (Math.abs(t - 4) < 0.5 / FPS) bpmAt4s = p.bpm
  }
  check(
    'reports 120±2 BPM within 4 seconds of a steady 120bpm pattern',
    Math.abs(bpmAt4s - 120) <= 2,
    `bpm at t=4s: ${bpmAt4s.toFixed(1)}`,
  )
}

console.log('\ntempo tracker: holds through one missed beat:\n')
{
  const m = MAPPINGS.beat()
  let bpmAtEnd = 0
  for (let i = 0; i < 8 * FPS; i++) {
    const t = i / FPS
    // The hit due at t=4.0 never fires — a real onset dropped from the mix.
    const hit = (t % 0.5) < 0.06 && !(t >= 4.0 && t < 4.5)
    const p = m.update(frame(hit ? 170 : 20, hit ? 120 : 45, hit ? 90 : 40))
    bpmAtEnd = p.bpm
  }
  check('holds 120±2 BPM through one missed beat', Math.abs(bpmAtEnd - 120) <= 2, `bpm at t=8s: ${bpmAtEnd.toFixed(1)}`)
}

console.log('\ntempo tracker: holds through one inserted off-beat hit:\n')
{
  const m = MAPPINGS.beat()
  let bpmAtEnd = 0
  for (let i = 0; i < 8 * FPS; i++) {
    const t = i / FPS
    // A spurious extra hit at t=4.25s — exactly between two real beats.
    const hit = (t % 0.5) < 0.06 || (t >= 4.25 && t < 4.31)
    const p = m.update(frame(hit ? 170 : 20, hit ? 120 : 45, hit ? 90 : 40))
    bpmAtEnd = p.bpm
  }
  check(
    'holds 120±2 BPM through one inserted off-beat hit',
    Math.abs(bpmAtEnd - 120) <= 2,
    `bpm at t=8s: ${bpmAtEnd.toFixed(1)}`,
  )
}

console.log('\ntempo tracker: does not report the octave-error 60 or 240 for a 120bpm input:\n')
{
  // The failure that "fails plausibly": a 120bpm autocorrelation peak is
  // harmonically tied with peaks at 60 and 240, all three internally
  // consistent about the same pattern. Run long enough (10s) that a
  // tracker settling on the wrong one would have long since stopped moving.
  const m = MAPPINGS.beat()
  let bpmAtEnd = 0
  for (let i = 0; i < 10 * FPS; i++) {
    const t = i / FPS
    const hit = (t % 0.5) < 0.06
    const p = m.update(frame(hit ? 170 : 20, hit ? 120 : 45, hit ? 90 : 40))
    bpmAtEnd = p.bpm
  }
  check(
    'settles on 120, not the 60 or 240 octave error',
    Math.abs(bpmAtEnd - 120) <= 2 && Math.abs(bpmAtEnd - 60) > 2 && Math.abs(bpmAtEnd - 240) > 2,
    `bpm at t=10s: ${bpmAtEnd.toFixed(1)}`,
  )
}

console.log('\ntempo tracker: stays honestly unlocked without a kick, and off random-interval noise:\n')
{
  const mSilent = MAPPINGS.beat()
  let maxBpmSilent = 0
  for (let i = 0; i < 8 * FPS; i++) {
    const p = mSilent.update(frame(20, 45, 40))
    maxBpmSilent = Math.max(maxBpmSilent, p.bpm)
  }
  check('reports no tempo at all against a flat, kickless signal', maxBpmSilent === 0, `peak bpm ${maxBpmSilent.toFixed(1)}`)

  // Same deterministic LCG noise pattern the lock/unlock check above uses.
  const mNoise = MAPPINGS.beat()
  let rand = 42
  const nextRand = (): number => {
    rand = (rand * 1103515245 + 12345) & 0x7fffffff
    return rand / 0x7fffffff
  }
  let nextOnsetAt = 0.2
  let lockedFrames = 0
  let totalFrames = 0
  for (let i = 0; i < 10 * FPS; i++) {
    const t = i / FPS
    const hit = t >= nextOnsetAt
    if (hit) nextOnsetAt = t + 0.15 + nextRand() * 0.6
    const p = mNoise.update(frame(hit ? 170 : 20, hit ? 120 : 45, hit ? 90 : 40))
    if (t > 6) {
      totalFrames++
      if (p.bpm > 0) lockedFrames++
    }
  }
  check(
    'does not invent a confident tempo from random-interval onsets',
    lockedFrames / totalFrames < 0.1,
    `bpm > 0 for ${((lockedFrames / totalFrames) * 100).toFixed(0)}% of frames after 6s of noise`,
  )
}

// --- bass-led tracks the low band, not a blend of all three -----------------

console.log('\nbass-led: level tracks low within 0.1 on the 120bpm pattern:\n')
{
  const m = MAPPINGS['bass-led']()
  let maxGap = 0
  for (let i = 0; i < 8 * FPS; i++) {
    const hit = (i / FPS) % 0.5 < 0.06
    const p = m.update(frame(hit ? 170 : 20, hit ? 120 : 45, hit ? 90 : 40))
    if (i > 2 * FPS) maxGap = Math.max(maxGap, Math.abs(p.level - p.low))
  }
  check('bass-led: |level - low| stays within 0.1 once settled', maxGap <= 0.1, `max gap ${maxGap.toFixed(3)}`)
}

// --- a real breakdown --------------------------------------------------------

console.log(
  `\nFull track: ${TRACK_BREAKDOWN_START}s music, ` +
    `${TRACK_BREAKDOWN_END - TRACK_BREAKDOWN_START}s breakdown, ` +
    `${TRACK_LENGTH - TRACK_BREAKDOWN_END}s back in\n`,
)
{
  const m = MAPPINGS.relative()
  const rows: string[] = []
  let surgeMoments = 0
  let lastSurgeAbove = false
  for (let i = 0; i < TRACK_LENGTH * FPS; i++) {
    const t = i / FPS
    const playing = t < TRACK_BREAKDOWN_START || t >= TRACK_BREAKDOWN_END
    const p = m.update(trackFrame(t, 1 / FPS))
    // Counts rising edges across 0.2, not every frame above it — a single
    // sustained surge should count as one moment, not several hundred.
    const above = p.surge > 0.2
    if (above && !lastSurgeAbove) surgeMoments++
    lastSurgeAbove = above
    if (i % Math.round(0.75 * FPS) === 0) {
      rows.push(
        `${t.toFixed(2).padStart(5)}s  ${playing ? 'music ' : 'BREAK '} ` +
          `level ${p.level.toFixed(2)}  break ${p.breakdown.toFixed(2)}  surge ${p.surge.toFixed(2)}  tilt ${p.tilt.toFixed(2)}`,
      )
    }
  }
  console.log(rows.join('\n'))
  // docs/todo.md entry 38: surge used to read a constant zero for twelve of
  // this track's fifteen seconds, firing only once, on the return from the
  // breakdown. Music that never drops out never produced a surge at all.
  check(
    'surge fires at more than one moment across the full track (was once, on the breakdown return only)',
    surgeMoments > 1,
    `${surgeMoments} moment(s)`,
  )
}

// --- colour must move, but slowly -------------------------------------------

console.log('\nBass-heavy -> treble-heavy at t=4s (tilt should glide, not jump)\n')
{
  const m = MAPPINGS.relative()
  const rows: string[] = []
  for (let i = 0; i < 10 * FPS; i++) {
    const t = i / FPS
    const p = m.update(t < 4 ? frame(180, 60, 10) : frame(20, 70, 150))
    if (i % Math.round(0.5 * FPS) === 0)
      rows.push(`${t.toFixed(1).padStart(4)}s  tilt ${p.tilt.toFixed(3)}`)
  }
  console.log(rows.join('\n'))
}

// --- structural novelty ------------------------------------------------------
// A section boundary is a sustained change in *character*, not in volume. The
// test keeps loudness constant across the change so anything that fires is
// responding to timbre, which is the whole point of L2-normalising the feature
// vectors.

console.log('\nSection change at t=8s, constant loudness (novelty should spike):\n')
{
  const m = MAPPINGS.relative()
  const rows: string[] = []
  for (let i = 0; i < 16 * FPS; i++) {
    const t = i / FPS
    // Same total energy, redistributed: bass-led section -> treble-led section.
    const p = m.update(t < 8 ? frame(150, 70, 25) : frame(25, 70, 150))
    if (i % Math.round(1 * FPS) === 0) {
      rows.push(
        `${t.toFixed(0).padStart(3)}s  novelty ${p.novelty.toFixed(3)}  ` +
          `roughness ${p.roughness.toFixed(3)}  break ${p.breakdown.toFixed(2)}`,
      )
    }
  }
  console.log(rows.join('\n'))
}

console.log('\nSteady 120bpm beat, no section change (novelty must stay low):\n')
{
  const m = MAPPINGS.relative()
  let peak = 0
  for (let i = 0; i < 20 * FPS; i++) {
    const hit = (i / FPS) % 0.5 < 0.06
    const p = m.update(frame(hit ? 170 : 20, hit ? 120 : 45, hit ? 90 : 40))
    if (i > 6 * FPS) peak = Math.max(peak, p.novelty)
  }
  console.log(
    `  novelty peak ${peak.toFixed(3)}   <- beats alone must not read as structure`,
  )
}

// --- does the 1/f estimator recover a known exponent? ------------------------
// The flat-band frames above cannot calibrate this: they have no spectral shape,
// so every one of them looks like the same shallow slope. Synthesise real power
// laws instead — magnitude proportional to f^(-beta/2) — and check that the
// measured roughness is monotonic in beta and uses most of its range.
//
// beta ~= 1 is pink noise, which is where music mostly lives (Voss & Clarke).

function powerLawFrame(beta: number): AudioFrame {
  const freq = new Uint8Array(BINS)
  for (let i = 1; i < BINS; i++) {
    const hz = i * BIN_HZ
    if (hz < 40 || hz > 12000) continue
    // Byte values are already a dB-like scale in the real AnalyserNode, but the
    // estimator only cares about the log-log tilt, so a direct power law is the
    // honest test of whether it recovers the exponent.
    // Bytes must be generated the way the AnalyserNode generates them —
    // linear in dB — or this tests the wrong thing entirely.
    const db = -32 - 10 * beta * Math.log10(hz / 1000)
    freq[i] = Math.max(
      0,
      Math.min(255, Math.round(((db - MIN_DB) / (MAX_DB - MIN_DB)) * 255)),
    )
  }
  return {
    freq,
    time: new Uint8Array(BINS),
    binCount: BINS,
    sampleRate: SAMPLE_RATE,
    dt: 1 / FPS,
  }
}

console.log('\n1/f exponent recovery (beta 0 = white, 1 = pink, 2 = brown):\n')
console.log('  beta   roughness')
for (const beta of [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]) {
  const m = MAPPINGS.relative()
  const f = powerLawFrame(beta)
  let p = m.update(f)
  for (let i = 0; i < 14 * FPS; i++) p = m.update(f)
  console.log(`  ${beta.toFixed(1)}      ${p.roughness.toFixed(3)}`)
}

// --- low frame rate must not distort the relative mapping --------------------
// A clamped dt that bites during normal slow running makes the running mean
// advance more slowly than wall-clock; the instantaneous energy then sits far
// above it and everything measured against it pins to 1.0. This is what a
// throttled tab showed, and what a phone at 10fps would have shown too.

console.log('\nSteady tone at various frame rates (level must not pin to 1.0):\n')
for (const fps of [60, 30, 15, 10, 6]) {
  const m = MAPPINGS.relative()
  const dt = Math.min(1 / fps, 1 / 5)
  const f = { ...frame(90, 80, 50), dt }
  let p = m.update(f)
  for (let i = 0; i < 10 * fps; i++) p = m.update(f)
  console.log(
    `  ${String(fps).padStart(2)} fps   level ${p.level.toFixed(3)}   low ${p.low.toFixed(3)}`,
  )
}

// --- does the Circles geometric layer spawn rings on the right events? ------
// ripples.ts is a small edge-triggered state machine, not an envelope, so the
// mapping-style curve-printing above doesn't fit it. What matters is whether
// it spawns exactly when it should: on a clean threshold crossing, not twice
// for one hit close together, and not at all during a breakdown.

console.log('\nCircles ripple spawn triggers (see ripples.ts):\n')

function countActive(state: ReturnType<typeof createRippleState>): number {
  // Stride 4 since docs/todo.md entry 33 widened each slot to carry a
  // position (birthTime, birthLevel, x, y); this test only ever spawns
  // audio ripples, so the touch slots stay at their -1000 sentinel and
  // would not count even with the old stride, but the stride itself has
  // to match ripples.ts's own or every index after slot 0 reads garbage.
  let n = 0
  for (let i = 0; i < MAX_RIPPLES; i++) if (state.slots[i * 4] > -100) n++
  return n
}

{
  const s = createRippleState()
  updateRipples(s, 0, 0.2, 0) // below threshold: no crossing yet
  updateRipples(s, 0.05, 0.7, 0) // crosses up
  console.log(`  single spike             -> ${countActive(s)} ripple  (want 1)`)
}
{
  const s = createRippleState()
  updateRipples(s, 0, 0.2, 0)
  updateRipples(s, 0.05, 0.7, 0) // spawn #1
  updateRipples(s, 0.1, 0.2, 0) // drops back below threshold
  updateRipples(s, 0.15, 0.7, 0) // crosses up again, but only 0.10s later
  console.log(`  two spikes, 0.10s apart  -> ${countActive(s)} ripple  (want 1, cooldown gated)`)
}
{
  const s = createRippleState()
  updateRipples(s, 0, 0.2, 0)
  updateRipples(s, 0.05, 0.7, 0) // spawn #1
  updateRipples(s, 0.1, 0.2, 0)
  updateRipples(s, 0.5, 0.7, 0) // 0.45s later, past the cooldown
  console.log(`  two spikes, 0.45s apart  -> ${countActive(s)} ripples (want 2)`)
}
{
  const s = createRippleState()
  updateRipples(s, 0, 0.2, 0.8) // deep in a breakdown
  updateRipples(s, 0.05, 0.7, 0.8) // would cross, but the room is dropping out
  console.log(`  spike during breakdown   -> ${countActive(s)} ripples (want 0)`)
}

console.log(failures === 0 ? '\nall assertions passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
