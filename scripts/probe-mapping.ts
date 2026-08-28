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

import type { AudioFrame } from '../src/audio.ts'
import { MAPPINGS, type MappingName } from '../src/mapping.ts'

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
