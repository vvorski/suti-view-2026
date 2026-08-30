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
 * No assertions on purpose. There is no correct answer to assert — the point is
 * to look at the curve and decide whether it is the one you want. The one thing
 * that *is* close to a pass/fail is the beat test: break must stay at 0.
 */

import { MAX_DB, MIN_DB, type AudioFrame } from '../src/engine/capture.ts'
import { MAPPINGS, type MappingName } from '../src/engine/fast.ts'
import { createRippleState, MAX_RIPPLES, updateRipples } from '../src/engine/ripples.ts'

const SAMPLE_RATE = 48000
const BINS = 1024
const BIN_HZ = SAMPLE_RATE / (BINS * 2)
const FPS = 60

/** A frame with flat energy in each named band, given as 0-255 byte levels. */
function frame(low: number, mid: number, high: number): AudioFrame {
  const freq = new Uint8Array(BINS)
  for (let i = 0; i < BINS; i++) {
    const hz = i * BIN_HZ
    if (hz >= 40 && hz < 250) freq[i] = low
    else if (hz >= 250 && hz < 1600) freq[i] = mid
    else if (hz >= 1600 && hz < 8000) freq[i] = high
  }
  return {
    freq,
    time: new Uint8Array(BINS),
    binCount: BINS,
    sampleRate: SAMPLE_RATE,
    dt: 1 / FPS,
  }
}

const names = Object.keys(MAPPINGS) as MappingName[]

// --- headroom ----------------------------------------------------------------
// The failure that made it feel unresponsive: at music levels an absolute
// mapping saturates and stops moving. What matters is not the value but the
// distance from 1.0 — that distance is the room the visuals have to react in.

console.log('Steady tone, settled 6s. `level` and the headroom above it:\n')
console.log(['byte', ...names.map((n) => n.padStart(20))].join('  '))
for (const byte of [10, 30, 60, 100, 150, 200]) {
  const f = frame(byte * 0.6, byte, byte * 0.4)
  const cells = names.map((n) => {
    const m = MAPPINGS[n]()
    let p = m.update(f)
    for (let i = 0; i < 6 * FPS; i++) p = m.update(f)
    return `${p.level.toFixed(2)} (+${(1 - p.level).toFixed(2)})`.padStart(20)
  })
  console.log([String(byte).padStart(4), ...cells].join('  '))
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

// --- a real breakdown --------------------------------------------------------

console.log('\nFull track: 6s music, 3s breakdown, 6s back in\n')
{
  const m = MAPPINGS.relative()
  const rows: string[] = []
  for (let i = 0; i < 15 * FPS; i++) {
    const t = i / FPS
    const playing = t < 6 || t >= 9
    const hit = playing && t % 0.5 < 0.06
    const p = m.update(
      playing ? frame(hit ? 170 : 20, hit ? 120 : 45, hit ? 90 : 40) : frame(2, 3, 2),
    )
    if (i % Math.round(0.75 * FPS) === 0) {
      rows.push(
        `${t.toFixed(2).padStart(5)}s  ${playing ? 'music ' : 'BREAK '} ` +
          `level ${p.level.toFixed(2)}  break ${p.breakdown.toFixed(2)}  surge ${p.surge.toFixed(2)}  tilt ${p.tilt.toFixed(2)}`,
      )
    }
  }
  console.log(rows.join('\n'))
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
