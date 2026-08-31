/**
 * Offline check of `luminanceFromLux` (docs/todo.md entry 98) — the pure
 * half of the ambient-light feature: does an ordinary room land on exactly
 * the same neutral 0.5 entry 23's own camera-luminance mapping already
 * treats as unchanged, is the mapping monotonic and bounded across the
 * full lux range Decided names (moonlight to bright daylight), and does it
 * actually behave log-shaped rather than linear (the entire point of using
 * log10 instead of raw lux).
 *
 * The sensor itself — `requestAmbientLight` — is deliberately not probed
 * here. Decided's own words: "the mapping is probeable; the sensor is not."
 * There is no `AmbientLightSensor` on the machine running this script, and
 * mocking one would test the mock, not the code; the sensor's own contract
 * (constructor-throw refusal, `error`-event silence) is exercised only by
 * a real browser, on Android, with or without the permission granted.
 *
 *   node --experimental-strip-types scripts/probe-ambient-light.ts
 */

import { luminanceFromLux } from '../src/ambient-light.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) < eps

// 1. The pivot: an ordinary room lands exactly on 0.5, the same neutral
//    value entry 23's `0.85 + x * 0.3` formula already treats as "exactly
//    1, unchanged" — the whole reason both sources can share one formula.
{
  const ordinary = luminanceFromLux(150)
  check('an ordinary room (150 lux) lands exactly on the neutral 0.5', near(ordinary, 0.5), String(ordinary))
}

// 2. The two named extremes from Decided's own text: moonlight (~1 lux)
//    reads near the floor, bright daylight (~10,000+ lux) reads at the
//    ceiling.
{
  const moonlight = luminanceFromLux(1)
  check('moonlight (1 lux) reads at the floor', near(moonlight, 0), String(moonlight))
  const daylight = luminanceFromLux(10_000)
  check('bright daylight (10,000 lux) reads at the ceiling', near(daylight, 1), String(daylight))
  const noonSun = luminanceFromLux(100_000)
  check('direct sun (100,000 lux) still clamps at the ceiling, not past it', near(noonSun, 1), String(noonSun))
  const pitchDark = luminanceFromLux(0)
  check('literal darkness (0 lux) still clamps at the floor, not below it', near(pitchDark, 0), String(pitchDark))
  const negative = luminanceFromLux(-5)
  check('a negative reading (should never happen, but bounded anyway) clamps at the floor', near(negative, 0), String(negative))
}

// 3. Monotonic and bounded across the whole named range — sampled
//    log-densely, since the domain itself spans orders of magnitude.
{
  let prev = -Infinity
  let broken = false
  let outOfBounds = false
  for (let logLux = -1; logLux <= 6; logLux += 0.05) {
    const v = luminanceFromLux(10 ** logLux)
    if (v < prev - 1e-9) broken = true
    if (v < 0 || v > 1) outOfBounds = true
    prev = v
  }
  check('monotonically non-decreasing across six decades of lux', !broken, 'a step backward was found')
  check('stays within [0, 1] across six decades of lux', !outOfBounds, 'a value left [0, 1]')
}

// 4. Genuinely log-shaped, not linear: equal ratios of lux (not equal
//    differences) should produce roughly equal steps in the mapped value.
//    A 10x jump from 15->150 and the same 10x jump from 150->1500 should
//    land close to the same size step; the equivalent linear-lux jumps
//    (150-15=135 vs 1500-150=1350, a 10x difference in step size) would not.
{
  const stepLow = luminanceFromLux(150) - luminanceFromLux(15)
  const stepHigh = luminanceFromLux(1500) - luminanceFromLux(150)
  check(
    'equal log-ratio steps (15->150, 150->1500) produce comparable-sized jumps',
    Math.abs(stepLow - stepHigh) < 0.05,
    `${stepLow} vs ${stepHigh}`,
  )
}

console.log(failures === 0 ? '\nall ambient-light checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
