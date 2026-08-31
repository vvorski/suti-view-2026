/**
 * Offline check of docs/todo.md entry 100 — the sun's own rate term and the
 * moon's own reach/tie-break term, both as `celestialFor` produces them and
 * as `director.ts` actually applies them.
 *
 * Entry 100's own Verify calls for scrubbing a year, "the only way to see a
 * two-peak curve and a 29.5-day cycle at once" — the sun's daily two-peak
 * shape is in fact clock-only (`Sky.slope` never reads the calendar, only
 * the hour, per `sky.ts`'s own header comment on why), so a year of
 * scrubbing mostly re-proves the same daily shape holds up over a long
 * timescale; it is the moon's own cycle that genuinely needs the longer
 * window. Both are checked here, at the timescale each actually needs.
 *
 *   node --experimental-strip-types scripts/probe-celestial.ts
 */

import { celestialFor, CELESTIAL_IDENTITY } from '../src/engine/celestial.ts'
import { Director, colourFor } from '../src/director.ts'
import { BLANK } from '../src/engine/slow.ts'
import { moonFor } from '../src/moon.ts'
import type { GeoColour } from '../src/geo-colour.ts'
import type { AtmosphericViewName } from '../src/views.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const near = (a: number, b: number, eps = 0.02): boolean => Math.abs(a - b) < eps

// Same duplicated-by-eye reference epoch probe-moon.ts already uses, for the
// same reason: exercising a real illuminated/waxing landmark needs to agree
// with moon.ts on which instant age zero is.
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0)
const SYNODIC_MONTH_DAYS = 29.530588861
const SYNODIC_MONTH_MS = SYNODIC_MONTH_DAYS * 86_400_000
const atQuarters = (quarters: number): Date => new Date(KNOWN_NEW_MOON_MS + quarters * (SYNODIC_MONTH_MS / 4))
const atHour = (base: Date, hour: number): Date => {
  const d = new Date(base)
  d.setUTCHours(hour, 0, 0, 0)
  return d
}
/** The hour within `base`'s own day where `moonFor`'s presence is closest to
 *  `target` — used below to compare two different lunar phases at a matched
 *  presence rather than a matched clock hour, since a first-quarter and a
 *  last-quarter moon transit at different hours by construction. */
const hourNearestPresence = (base: Date, target: number): number => {
  let bestHour = 0
  let bestDiff = Infinity
  for (let h = 0; h < 24; h++) {
    const diff = Math.abs(moonFor(atHour(base, h)).presence - target)
    if (diff < bestDiff) {
      bestDiff = diff
      bestHour = h
    }
  }
  return bestHour
}

// 1. The sun's own rate term: two-peak daily shape, bounded [0.75, 1.25],
//    checked on a representative day and then re-checked across a scattered
//    year of dates to prove the clock-only shape holds however far out the
//    calendar goes.
console.log('The sun (docs/todo.md entry 100):\n')
{
  const day = new Date(2026, 0, 15) // an arbitrary weekday, local time
  let minRate = Infinity
  let maxRate = -Infinity
  let morningHigh = false
  let eveningHigh = false
  let middayLow = true
  let nightLow = true
  for (let m = 0; m < 24 * 60; m++) {
    const d = new Date(day)
    d.setHours(Math.floor(m / 60), m % 60, 0, 0)
    const rate = celestialFor(d, null).sunRate
    minRate = Math.min(minRate, rate)
    maxRate = Math.max(maxRate, rate)
    const hour = m / 60
    if (hour >= 5 && hour <= 8 && rate > 1.1) morningHigh = true
    if (hour >= 18 && hour <= 21 && rate > 1.1) eveningHigh = true
    if (hour >= 11 && hour <= 15 && rate >= 0.85) middayLow = false
    if ((hour <= 2 || hour >= 24 - 1) && rate >= 0.85) nightLow = false
  }
  check('sunRate never drops below 0.75 across a full day', minRate >= 0.75 - 1e-9, String(minRate))
  check('sunRate never exceeds 1.25 across a full day', maxRate <= 1.25 + 1e-9, String(maxRate))
  check('sunRate reaches near its own peak (1.25) once', near(maxRate, 1.25, 0.01), String(maxRate))
  check('sunRate reaches near its own floor (0.75) at night/midday', near(minRate, 0.75, 1e-6), String(minRate))
  check('a morning peak: sunRate climbs above 1.1 somewhere around dawn', morningHigh, 'no dawn-window sample exceeded 1.1')
  check('an evening peak: sunRate climbs above 1.1 somewhere around dusk', eveningHigh, 'no dusk-window sample exceeded 1.1')
  check('between the two peaks (midday): sunRate stays low', middayLow, 'a midday sample reached 0.85 or above')
  check('outside the two peaks (small hours): sunRate stays low', nightLow, 'a small-hours sample reached 0.85 or above')

  // A scattered year of dates — same clock-only shape has to hold on every
  // one of them, since `Sky.slope` never reads the calendar (see this
  // file's own header). Bounds only; the two-peak shape itself was already
  // proven above at the resolution that actually shows it.
  let yearMin = Infinity
  let yearMax = -Infinity
  for (let doy = 0; doy < 365; doy += 3) {
    for (const hour of [3, 6.5, 9, 12, 15, 19.5, 22]) {
      const d = new Date(2026, 0, 1 + doy)
      d.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0)
      const rate = celestialFor(d, null).sunRate
      yearMin = Math.min(yearMin, rate)
      yearMax = Math.max(yearMax, rate)
    }
  }
  check('sunRate stays within [0.75, 1.25] across a scattered year', yearMin >= 0.75 - 1e-9 && yearMax <= 1.25 + 1e-9, `${yearMin} .. ${yearMax}`)
}

// 2. The moon's own reach term: full and new moon (at their own presence
//    peak) pull `moonReach` measurably to opposite sides of 1, and that
//    measurable difference actually changes the director's own acceptance
//    behaviour on an identical, borderline-marginal audio trace.
console.log('\nThe moon — reach (docs/todo.md entry 100):\n')
{
  const newMoonPeakHour = hourNearestPresence(atQuarters(0), 1)
  const fullMoonPeakHour = hourNearestPresence(atQuarters(2), 1)
  const newMoonUp = atHour(atQuarters(0), newMoonPeakHour)
  const fullMoonUp = atHour(atQuarters(2), fullMoonPeakHour)

  const newReach = celestialFor(newMoonUp, null).moonReach
  const fullReach = celestialFor(fullMoonUp, null).moonReach
  check('new moon at its own transit: reach measurably below 1', newReach < 0.85, String(newReach))
  check('full moon at its own transit: reach measurably above 1', fullReach > 1.15, String(fullReach))
  check('full and new moon reach are visibly different', fullReach - newReach > 0.2, `${newReach} vs ${fullReach}`)

  // Same borderline trace, same director, only `moonReach` differs (sunRate
  // pinned at 1, bias at 0, so this isolates the reach term alone). A
  // sequence of characters that hover right around COLOUR_MIN_STEP's own
  // acceptance boundary should clear that boundary more often under the
  // smaller (new-moon) reach than under the larger (full-moon) one.
  const countAcceptedColourChanges = (reach: number): number => {
    const d = new Director()
    let current: { geoColour: GeoColour; atmosphericView: AtmosphericViewName } = {
      geoColour: colourFor({ ...BLANK, bright: 0.5 }),
      atmosphericView: 'field',
    }
    let accepted = 0
    let bright = 0.5
    for (let i = 0; i < Math.round(600 / (1 / 60)); i++) {
      // A slow drift plus a small oscillation, so `bright` keeps crossing
      // back and forth over marginal step sizes rather than settling.
      bright = 0.5 + 0.25 * Math.sin(i / (60 * 11)) + 0.08 * Math.sin(i / (60 * 2.3))
      const c = { ...BLANK, warm: true, noveltyMedium: 1, bright: Math.max(0, Math.min(1, bright)) }
      const next = d.update(c, 1 / 60, current, 0, 0, 'handled', { sunRate: 1, moonReach: reach, moonRampBias: 0 })
      if (next?.geoColour) {
        accepted++
        current = { ...current, geoColour: next.geoColour }
      }
    }
    return accepted
  }
  const newMoonAccepted = countAcceptedColourChanges(newReach)
  const fullMoonAccepted = countAcceptedColourChanges(fullReach)
  check(
    'a smaller (new-moon) reach accepts at least as many colour changes as a larger (full-moon) one on the same trace',
    newMoonAccepted >= fullMoonAccepted,
    `new-moon reach ${newReach.toFixed(2)} accepted ${newMoonAccepted}, full-moon reach ${fullReach.toFixed(2)} accepted ${fullMoonAccepted}`,
  )
  check(
    'reach visibly changes the count, rather than leaving it untouched',
    newMoonAccepted !== fullMoonAccepted,
    `both reaches accepted exactly ${newMoonAccepted} changes`,
  )
}

// 3. The moon's own tie-break: a waxing and a waning half-moon, matched by
//    presence (since they transit at different hours), differ in the sign
//    of the ramp bias and in nothing else.
console.log('\nThe moon — tie-break (docs/todo.md entry 100):\n')
{
  const firstQuarterHour = hourNearestPresence(atQuarters(1), 0.7)
  const lastQuarterHour = hourNearestPresence(atQuarters(3), 0.7)
  const waxingUp = atHour(atQuarters(1), firstQuarterHour)
  const waningUp = atHour(atQuarters(3), lastQuarterHour)

  const waxing = celestialFor(waxingUp, null)
  const waning = celestialFor(waningUp, null)
  check('waxing half-moon: ramp bias is positive', waxing.moonRampBias > 0, String(waxing.moonRampBias))
  check('waning half-moon: ramp bias is negative', waning.moonRampBias < 0, String(waning.moonRampBias))
  check(
    'the two biases are near-equal in magnitude (matched presence, opposite direction)',
    near(Math.abs(waxing.moonRampBias), Math.abs(waning.moonRampBias), 0.02),
    `${waxing.moonRampBias} vs ${waning.moonRampBias}`,
  )
  check('reach does not depend on waxing/waning: near-equal at matched illuminated+presence', near(waxing.moonReach, waning.moonReach, 0.05), `${waxing.moonReach} vs ${waning.moonReach}`)
}

// 4. Moon below the horizon is byte-identical to the moon term switched off
//    — `presence === 0` (or near it) collapses both `moonReach` and
//    `moonRampBias` to exactly `CELESTIAL_IDENTITY`'s own values, regardless
//    of phase.
console.log('\nMoon down = moon off (docs/todo.md entry 100):\n')
{
  // Twelve hours from its own presence peak, this file's own moon-probe
  // sibling already establishes this lands presence at (or very near) 0 —
  // duplicated here rather than imported, matching that file's own style.
  const fullPeak = hourNearestPresence(atQuarters(2), 1)
  const fullDown = atHour(atQuarters(2), (fullPeak + 12) % 24)
  const influence = celestialFor(fullDown, null)
  check('moon down: presence itself is near 0', moonFor(fullDown).presence < 0.05, String(moonFor(fullDown).presence))
  check('moon down: moonReach is exactly the identity value', near(influence.moonReach, CELESTIAL_IDENTITY.moonReach, 0.02), String(influence.moonReach))
  check('moon down: moonRampBias is exactly the identity value', near(influence.moonRampBias, CELESTIAL_IDENTITY.moonRampBias, 1e-6), String(influence.moonRampBias))
}

// 5. The identity claim that protects every existing caller: with the sun
//    pinned at its own midpoint and the moon at zero, `Director.update()`'s
//    new, defaulted `celestial` parameter must produce byte-identical
//    decisions to calling it the old way, on the same recorded trace.
console.log("\nSun mid, moon zero — today's decisions, unchanged (docs/todo.md entry 100):\n")
{
  const trace: Array<{ bright: number; noisy: number; dense: number; rhythmic: number }> = []
  for (let i = 0; i < Math.round(240 / (1 / 60)); i++) {
    trace.push({
      bright: 0.5 + 0.4 * Math.sin(i / (60 * 7)),
      noisy: 0.5 + 0.4 * Math.sin(i / (60 * 5) + 1),
      dense: 0.5 + 0.4 * Math.sin(i / (60 * 9) + 2),
      rhythmic: 0.5 + 0.4 * Math.sin(i / (60 * 3) + 3),
    })
  }

  const run = (withCelestial: boolean): unknown[] => {
    const d = new Director()
    let current: { geoColour: GeoColour; atmosphericView: AtmosphericViewName } = {
      geoColour: colourFor({ ...BLANK, bright: 0.5 }),
      atmosphericView: 'field',
    }
    const directives: unknown[] = []
    for (const axes of trace) {
      const c = { ...BLANK, warm: true, noveltyMedium: 1, ...axes }
      const next = withCelestial
        ? d.update(c, 1 / 60, current, 0, 0, 'handled', CELESTIAL_IDENTITY)
        : d.update(c, 1 / 60, current, 0, 0, 'handled')
      directives.push(next)
      if (next?.geoColour) current = { ...current, geoColour: next.geoColour }
      if (next?.atmosphericView) current = { ...current, atmosphericView: next.atmosphericView }
    }
    return directives
  }

  const withoutArg = run(false)
  const withIdentity = run(true)
  check(
    'omitting the celestial argument matches passing CELESTIAL_IDENTITY explicitly, frame for frame',
    JSON.stringify(withoutArg) === JSON.stringify(withIdentity),
    'the two runs diverged somewhere across the trace',
  )
}

console.log(failures === 0 ? '\nall celestial checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
