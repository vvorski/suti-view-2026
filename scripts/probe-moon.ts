/**
 * Offline check of the lunar cycle (docs/todo.md entry 96): does illuminated
 * fraction and waxing/waning track the real phase across a synodic month, do
 * presence's rise and fall land in the phase-appropriate window, and — the
 * claim that protects everything already shipped — does new moon or a moon
 * below the horizon leave every shape parameter exactly at today's constant.
 *
 * Pure function, no DOM and no clock of its own — `moonFor` takes a `Date`
 * rather than reading one — so this runs under plain Node exactly like
 * `probe-sky.ts` and the rest.
 *
 *   node --experimental-strip-types scripts/probe-moon.ts
 */

import { moonFor, moonForLocation, moonAltitudeDeg } from '../src/moon.ts'
import { solarAltitudeDeg } from '../src/sky.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const near = (a: number, b: number, eps = 0.02): boolean => Math.abs(a - b) < eps

// Same reference epoch as moon.ts's own KNOWN_NEW_MOON_MS, duplicated here
// by eye — the same convention probe-composite.ts already uses for
// composite.frag.glsl, needed for the same reason: a test that wants an
// *exact* age (new moon, first quarter, ...) has to agree with the
// implementation on which instant age zero actually is. A real almanac date
// was deliberately not used instead: this file's own header already
// disclaims "stylised, not astronomical", and hand-verifying a real new
// moon's exact minute against this simple mean-motion model, with no
// internet access from here to check one, would only replace a checkable
// constant with an unverifiable one.
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0)
const SYNODIC_MONTH_DAYS = 29.530588861
const SYNODIC_MONTH_MS = SYNODIC_MONTH_DAYS * 86_400_000

/** A date at exactly `quarters` quarter-months past a new moon (age exactly
 *  quarters * SYNODIC/4, by construction — adding a fixed number of
 *  milliseconds is exact regardless of the epoch's own odd 18:14 time of
 *  day). Whatever hour this lands on is whatever it is; section 1 and 2
 *  below don't depend on the hour, only on age. */
const atQuarters = (quarters: number): Date => new Date(KNOWN_NEW_MOON_MS + quarters * (SYNODIC_MONTH_MS / 4))

/** The same date, with its hour-of-day overridden — used only for
 *  presence, which is the one field that reads the clock hour. Moving the
 *  hour on an otherwise-fixed calendar day nudges age by at most half a
 *  day out of 29.53 (a small fraction of the cycle), which is why this
 *  section uses generous tolerances and finds a transit empirically
 *  instead of asserting one lands on a specific clock hour. */
const atHour = (base: Date, hour: number): Date => {
  const d = new Date(base)
  d.setUTCHours(hour, 0, 0, 0)
  return d
}

// 1. The four named phases land where a synodic month says they should,
//    both in illuminated fraction and in waxing's sign.
{
  const newMoon = moonFor(atQuarters(0))
  check('new moon: illuminated is 0', near(newMoon.illuminated, 0, 1e-6), String(newMoon.illuminated))
  check('new moon: waxing is 0 (a turning point, not a direction)', near(newMoon.waxing, 0, 1e-6), String(newMoon.waxing))

  const firstQuarter = moonFor(atQuarters(1))
  check('first quarter: illuminated is 0.5', near(firstQuarter.illuminated, 0.5, 1e-6), String(firstQuarter.illuminated))
  check('first quarter: waxing is 1 (fastest possible growth)', near(firstQuarter.waxing, 1, 1e-6), String(firstQuarter.waxing))

  const full = moonFor(atQuarters(2))
  check('full moon: illuminated is 1', near(full.illuminated, 1, 1e-6), String(full.illuminated))
  check('full moon: waxing is 0 (a turning point, not a direction)', near(full.waxing, 0, 1e-6), String(full.waxing))

  const lastQuarter = moonFor(atQuarters(3))
  check('last quarter: illuminated is 0.5', near(lastQuarter.illuminated, 0.5, 1e-6), String(lastQuarter.illuminated))
  check('last quarter: waxing is -1 (fastest possible shrink)', near(lastQuarter.waxing, -1, 1e-6), String(lastQuarter.waxing))
}

// 2. Illuminated fraction rises monotonically from new to full, and falls
//    monotonically from full back to new — the qualitative shape a real
//    lunation actually has, not just four points that happen to land right.
{
  let risingBroken = false
  let prev = moonFor(atQuarters(0)).illuminated
  for (let q = 0.05; q <= 2; q += 0.05) {
    const v = moonFor(atQuarters(q)).illuminated
    if (v < prev - 1e-9) risingBroken = true
    prev = v
  }
  check('illuminated rises monotonically from new to full', !risingBroken, 'a step backward was found')

  let fallingBroken = false
  prev = moonFor(atQuarters(2)).illuminated
  for (let q = 2.05; q <= 4; q += 0.05) {
    const v = moonFor(atQuarters(q)).illuminated
    if (v > prev + 1e-9) fallingBroken = true
    prev = v
  }
  check('illuminated falls monotonically from full back to new', !fallingBroken, 'a step forward was found')
}

// 3. Presence has exactly one daily peak, near where Decided says it
//    should be (new moon near local noon, full moon near local midnight),
//    and falls to (or stays at) the horizon roughly twelve hours later —
//    found empirically by scanning the day, per this section's own header
//    comment on why an exact clock hour isn't asserted directly.
{
  const scanDay = (base: Date): { peakHour: number; peakValue: number; values: number[] } => {
    const values: number[] = []
    for (let h = 0; h < 24; h++) values.push(moonFor(atHour(base, h)).presence)
    const peakHour = values.indexOf(Math.max(...values))
    return { peakHour, peakValue: values[peakHour], values }
  }

  const newDay = scanDay(atQuarters(0))
  check('new moon: presence peaks near local noon', Math.abs(newDay.peakHour - 12) <= 2, `peak at ${newDay.peakHour}:00`)
  check('new moon: the peak itself reaches near 1', newDay.peakValue > 0.9, String(newDay.peakValue))
  check(
    'new moon: presence is back near the horizon twelve hours from the peak',
    moonFor(atHour(atQuarters(0), (newDay.peakHour + 12) % 24)).presence < 0.05,
    String(moonFor(atHour(atQuarters(0), (newDay.peakHour + 12) % 24)).presence),
  )

  const fullDay = scanDay(atQuarters(2))
  const fullPeakDistanceFromMidnight = Math.min(fullDay.peakHour, 24 - fullDay.peakHour)
  check('full moon: presence peaks near local midnight', fullPeakDistanceFromMidnight <= 2, `peak at ${fullDay.peakHour}:00`)
  check('full moon: the peak itself reaches near 1', fullDay.peakValue > 0.9, String(fullDay.peakValue))
  check(
    'full moon: presence is back near the horizon twelve hours from the peak',
    moonFor(atHour(atQuarters(2), (fullDay.peakHour + 12) % 24)).presence < 0.05,
    String(moonFor(atHour(atQuarters(2), (fullDay.peakHour + 12) % 24)).presence),
  )

  // Rises into the peak and falls away from it, rather than merely
  // touching a high value somewhere in the scan.
  const rising = newDay.values.slice(Math.max(0, newDay.peakHour - 3), newDay.peakHour + 1)
  const falling = newDay.values.slice(newDay.peakHour, Math.min(24, newDay.peakHour + 4))
  check('new moon: presence rises into its own peak', rising.every((v, i) => i === 0 || v >= rising[i - 1] - 1e-9), JSON.stringify(rising))
  check('new moon: presence falls away from its own peak', falling.every((v, i) => i === 0 || v <= falling[i - 1] + 1e-9), JSON.stringify(falling))
}

// 4. Presence never leaves [0, 1] anywhere across a full month scanned
//    every three hours — the stylised proxy's own basic sanity, independent
//    of which phase or hour is being asked about.
{
  let minP = Infinity
  let maxP = -Infinity
  for (let q = 0; q < 4; q += 0.1) {
    for (let h = 0; h < 24; h += 3) {
      const p = moonFor(atHour(atQuarters(q), h)).presence
      minP = Math.min(minP, p)
      maxP = Math.max(maxP, p)
    }
  }
  check('presence never goes negative across a full month', minP >= 0, String(minP))
  check('presence never exceeds 1 across a full month', maxP <= 1 + 1e-9, String(maxP))
}

// 5. The identity claim that protects everything already shipped —
//    docs/todo.md entry 96's own "new moon, or moon down, is exactly
//    today's constants". `abundance`, `reach`, `life` and `cadence` below
//    reproduce the same product and the same swing formulas scene.ts and
//    engine/emitter.ts use (their own MOON_REACH_SWING / MOON_LIFE_SWING /
//    MOON_CADENCE_SWING), duplicated here by eye rather than imported,
//    since scene.ts cannot run under plain Node.
{
  const REACH_SWING = 0.25
  const LIFE_SWING = 0.25
  const CADENCE_SWING = 0.35
  const abundanceOf = (m: { illuminated: number; presence: number }): number => m.illuminated * m.presence
  const reachOf = (a: number): number => 1 + REACH_SWING * a
  const lifeOf = (a: number): number => 1 + LIFE_SWING * a
  const cadenceOf = (a: number): number => 1 - CADENCE_SWING * a

  // (a) Genuine new moon, at its own presence peak — illuminated is what
  //     zeroes this out, not presence. `atHour` nudges age by a small
  //     fraction of a day (see its own comment), so this checks "near",
  //     not bit-exact — the bit-exact claim (illuminated exactly 0 at
  //     exactly age 0) is already section 1's job, at a far tighter
  //     tolerance than here.
  const newMoonUp = moonFor(atHour(atQuarters(0), 12))
  const aNew = abundanceOf(newMoonUp)
  check('new moon at its own transit: abundance is near 0', near(aNew, 0, 0.01), String(aNew))
  check('new moon: reach multiplier is near 1', near(reachOf(aNew), 1, 0.01), String(reachOf(aNew)))
  check('new moon: life multiplier is near 1', near(lifeOf(aNew), 1, 0.01), String(lifeOf(aNew)))
  check('new moon: cadence multiplier is near 1', near(cadenceOf(aNew), 1, 0.01), String(cadenceOf(aNew)))

  // (b) Full moon, but twelve hours from its own transit — down by this
  //     file's own stylised reckoning, presence is what zeroes this out
  //     this time, not illuminated.
  const fullDayScan = (() => {
    const values: number[] = []
    for (let h = 0; h < 24; h++) values.push(moonFor(atHour(atQuarters(2), h)).presence)
    return values.indexOf(Math.max(...values))
  })()
  const fullMoonDown = moonFor(atHour(atQuarters(2), (fullDayScan + 12) % 24))
  const aDown = abundanceOf(fullMoonDown)
  check('full moon, twelve hours from transit: presence near 0', fullMoonDown.presence < 0.05, String(fullMoonDown.presence))
  check('full moon, moon down: abundance is near 0', near(aDown, 0, 0.05), String(aDown))
  check('full moon, moon down: reach multiplier is near 1', near(reachOf(aDown), 1, 0.02), String(reachOf(aDown)))

  // (c) The other end: full moon, at its own transit, pushes reach/life/
  //     cadence within Decided's own stated swings — "roughly ±25% on
  //     reach and life... ±35% on cadence... at full influence".
  const fullMoonUp = moonFor(atHour(atQuarters(2), fullDayScan))
  const aFull = abundanceOf(fullMoonUp)
  check('full moon at its own transit: abundance near 1', near(aFull, 1, 0.05), String(aFull))
  check('full moon high: reach multiplier reaches close to the stated +25%', reachOf(aFull) > 1.2, String(reachOf(aFull)))
  check('full moon high: life multiplier reaches close to the stated +25%', lifeOf(aFull) > 1.2, String(lifeOf(aFull)))
  check('full moon high: cadence multiplier drops close to the stated -35% (rings come more often)', cadenceOf(aFull) < 0.7, String(cadenceOf(aFull)))
}

// 6. `moonForLocation` — docs/todo.md entry 97's real-position addition.
//    No live almanac was reachable to check an exact moonrise minute
//    against, so this checks the same kind of thing section 5 of
//    probe-sky.ts does for the sun: identities that must hold regardless of
//    ephemeris precision, using this file's own `KNOWN_NEW_MOON_MS` — which
//    moon.ts's own header already asserts is a real new moon, not merely a
//    convenient number — as the one calibration point available.
{
  // At a genuine new moon, the moon sits very close to the sun in the sky
  // — near enough in elongation that its altitude, from anywhere on Earth,
  // should read close to the sun's own altitude at that same instant. This
  // needed no assumed lunar almanac to check: both altitudes come from this
  // codebase's own two independent position algorithms, and "the moon is
  // near the sun at new moon" is true regardless of either algorithm's
  // precision.
  const t = new Date(KNOWN_NEW_MOON_MS)
  for (const [name, latitude, longitude] of [
    ['New York', 40.7, -74.0],
    ['Greenwich', 51.5, 0],
    ['equator/prime meridian', 0, 0],
    ['Sydney', -33.9, 151.2],
  ] as [string, number, number][]) {
    const sunAlt = solarAltitudeDeg(t, { latitude, longitude })
    const moonAlt = moonAltitudeDeg(t, { latitude, longitude })
    check(`at the reference new moon, ${name}: moon altitude close to the sun's`, near(moonAlt, sunAlt, 3), `sun ${sunAlt.toFixed(2)}, moon ${moonAlt.toFixed(2)}`)
  }

  // Illuminated fraction from the real elongation should land near the
  // same landmarks section 1 already proved for the synodic-clock proxy —
  // two independently-modelled paths agreeing on the same real phases.
  const newMoonReal = moonForLocation(t, { latitude: 51.5, longitude: 0 })
  check('moonForLocation at the reference new moon: illuminated close to 0', near(newMoonReal.illuminated, 0, 0.02), String(newMoonReal.illuminated))

  const fullMoonReal = moonForLocation(new Date(KNOWN_NEW_MOON_MS + (SYNODIC_MONTH_DAYS / 2) * 86_400_000), {
    latitude: 51.5,
    longitude: 0,
  })
  check('moonForLocation half a synodic month later: illuminated close to 1', fullMoonReal.illuminated > 0.9, String(fullMoonReal.illuminated))

  const firstQuarterReal = moonForLocation(new Date(KNOWN_NEW_MOON_MS + (SYNODIC_MONTH_DAYS / 4) * 86_400_000), {
    latitude: 51.5,
    longitude: 0,
  })
  check('moonForLocation a quarter month later: illuminated close to 0.5', near(firstQuarterReal.illuminated, 0.5, 0.05), String(firstQuarterReal.illuminated))
  check('moonForLocation a quarter month later: waxing (growing toward full)', firstQuarterReal.waxing > 0.9, String(firstQuarterReal.waxing))

  // Presence is bounded and finite across a scattered lat/lon/time sweep —
  // the same basic sanity probe-sky.ts's own sweep checks for the sun.
  let minPresence = Infinity
  let maxPresence = -Infinity
  let anyNaN = false
  for (let i = 0; i < 200; i++) {
    const lat = -80 + ((i * 37) % 160)
    const lon = -170 + ((i * 53) % 340)
    const date = new Date(KNOWN_NEW_MOON_MS + i * 86_400_000 * 1.3)
    const m = moonForLocation(date, { latitude: lat, longitude: lon })
    if (Number.isNaN(m.presence) || Number.isNaN(m.illuminated) || Number.isNaN(m.waxing)) anyNaN = true
    minPresence = Math.min(minPresence, m.presence)
    maxPresence = Math.max(maxPresence, m.presence)
  }
  check('no NaN across a scattered moonForLocation sweep', !anyNaN, 'a NaN field was produced')
  check('presence stays within [0, 1] across the sweep', minPresence >= 0 && maxPresence <= 1, `${minPresence} .. ${maxPresence}`)
}

// 7. `moonFor` itself is untouched by entry 97 — the same regression guard
//    probe-sky.ts's own section 9 runs for `skyFor`, and for the same
//    reason: sections 1-5 above were written for entry 96 and would not by
//    themselves prove entry 97 left this function alone.
{
  const newMoonProxy = moonFor(atQuarters(0))
  check('moonFor still reads new moon at age 0 after entry 97\'s edit', near(newMoonProxy.illuminated, 0, 1e-6), String(newMoonProxy.illuminated))
  const fullMoonProxy = moonFor(atQuarters(2))
  check('moonFor still reads full moon at age 2 quarters after entry 97\'s edit', near(fullMoonProxy.illuminated, 1, 1e-6), String(fullMoonProxy.illuminated))
}

console.log(failures === 0 ? '\nall moon checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
