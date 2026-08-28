/**
 * Offline mapping probe.
 *
 *   node --experimental-strip-types scripts/probe-mapping.ts
 *
 * Feeds synthetic frames through each mapping and prints what comes out. This
 * exists because the alternative — reading the on-screen numbers in a browser
 * while making a noise — is slow, unrepeatable, and cannot tell you what a
 * mapping does at an input level you cannot conveniently produce.
 *
 * It caught two real bugs the browser could not have shown clearly: `level`
 * pinned at 0.98 against a mid band of 0.06 (an AGC erasing the dynamics the
 * whole design depends on), and `auto-normalised` capped at 0.33 for
 * single-band material.
 *
 * No assertions on purpose. There is no correct answer to assert — the point is
 * to look at the curve and decide whether it is the one you want.
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

/** Hold a steady input for `seconds` and return the settled output. */
function settle(name: MappingName, f: AudioFrame, seconds = 5) {
  const m = MAPPINGS[name]()
  let out = m.update(f)
  for (let i = 0; i < seconds * FPS; i++) out = m.update(f)
  return out
}

const names = Object.keys(MAPPINGS) as MappingName[]

console.log('Steady mid-band tone, settled for 5s:\n')
console.log(['byte', 'raw'.padStart(6), ...names.map((n) => n.padStart(17))].join('  '))
for (const byte of [0, 5, 15, 30, 60, 100, 160, 220]) {
  const f = frame(0, byte, 0)
  const cells = names.map((n) => {
    const p = settle(n, f)
    return `${p.level.toFixed(3)} (mid ${p.mid.toFixed(2)})`.padStart(17)
  })
  console.log(
    [String(byte).padStart(4), (byte / 255).toFixed(3).padStart(6), ...cells].join('  '),
  )
}

// The reference recording's shape: ~2s swell, then a long decay. A mapping that
// preserves dynamics traces a curve here; one that normalises reports a plateau.
console.log('\nSwell (2s) then exponential decay (tau 7s), peak byte 90:\n')
console.log(['t', ...names.map((n) => n.padStart(16))].join('     '))

const running = names.map((n) => ({ n, m: MAPPINGS[n]() }))
for (let i = 0; i <= 24 * FPS; i++) {
  const t = i / FPS
  const byte = Math.round(t < 2 ? (t / 2) * 90 : 90 * Math.exp(-(t - 2) / 7))
  const f = frame(0, byte, 0)
  const out = running.map(({ m }) => m.update(f))
  if (i % (2 * FPS) === 0) {
    console.log(
      [
        `${t.toFixed(0).padStart(2)}s`,
        ...out.map((p) =>
          `${String(byte).padStart(3)} -> ${p.level.toFixed(3)}`.padStart(16),
        ),
      ].join('     '),
    )
  }
}
