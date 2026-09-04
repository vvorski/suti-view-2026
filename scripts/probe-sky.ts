/**
 * Offline check of the day/night cycle (docs/todo.md entry 53, reshaped by
 * entry 71): do the anchors land exactly, is the curve free of any corner
 * anywhere across 24 hours including midnight, does day hold as a plateau
 * and night as a floor rather than each being a single instant, and does an
 * active transition still read as visibly different across ten minutes.
 *
 * Pure function, no DOM and no clock of its own — `skyFor` takes a `Date`
 * rather than reading one — so this runs under plain Node exactly like
 * `probe-slow.ts` and the rest.
 *
 *   node --experimental-strip-types scripts/probe-sky.ts
 */

import { skyFor, skyForLocation, solarAltitudeDeg } from '../src/sky.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const dateAt = (h: number, m = 0, s = 0): Date => new Date(2026, 0, 1, h, m, s)
const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) < eps

// 1. Each anchor lands exactly — daylight's six (re-timed by entry 108),
//    warmth's four (unchanged by entry 71: that shape was already right).
{
  const daylightAnchors: [number, number, number][] = [
    [5, 30, 0.0],
    [7, 0, 0.35],
    [8, 30, 1.0],
    [17, 45, 1.0],
    [19, 30, 0.4],
    [21, 45, 0.0],
  ]
  for (const [h, m, daylight] of daylightAnchors) {
    const s = skyFor(dateAt(h, m))
    check(`daylight anchor ${h}:${String(m).padStart(2, '0')} lands exactly`, near(s.daylight, daylight), String(s.daylight))
  }
  const warmthAnchors: [number, number, number][] = [
    [2, 0, -0.35],
    [6, 30, 0.5],
    [13, 0, -0.1],
    [19, 30, 0.6],
  ]
  for (const [h, m, warmth] of warmthAnchors) {
    const s = skyFor(dateAt(h, m))
    check(`warmth anchor ${h}:${String(m).padStart(2, '0')} lands exactly`, near(s.warmth, warmth), String(s.warmth))
  }
}

// 2. No corner anywhere across 24 hours, midnight included — sampled every
//    minute, the frame-to-frame delta should never spike far above the
//    typical rate of change. A genuine step would show as an outlier tens
//    of times larger than its neighbours; smoothstep's zero derivative at
//    each anchor means even the anchors themselves should not stand out —
//    including the two adjacent pairs (21:45/05:30, 08:30/17:45) that now
//    hold a flat plateau between them rather than crossing anything.
{
  const samples: { daylight: number; warmth: number }[] = []
  for (let mins = 0; mins < 24 * 60; mins++) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    samples.push(skyFor(dateAt(h, m)))
  }
  let maxDaylightStep = 0
  let maxWarmthStep = 0
  for (let i = 1; i < samples.length; i++) {
    maxDaylightStep = Math.max(maxDaylightStep, Math.abs(samples[i].daylight - samples[i - 1].daylight))
    maxWarmthStep = Math.max(maxWarmthStep, Math.abs(samples[i].warmth - samples[i - 1].warmth))
  }
  // Entry 108 shortened every dawn/dusk span from ~4 hours to 1.5, so the
  // curve rises the same 0.65-1.0 of daylight in roughly a third of the
  // time — measured peak per-minute step 0.01083, at 07:44, against the
  // previous table's 0.00407. 0.01 (this check's threshold before entry
  // 108) was never a perceptual limit, only headroom over whatever curve
  // was shipped; 0.015 keeps a comparable margin over the new peak while
  // still catching a genuine discontinuity, which would blow past either
  // number easily.
  check('no per-minute daylight jump anywhere in 24h (incl. midnight)', maxDaylightStep < 0.015, `worst step ${maxDaylightStep}`)
  check('no per-minute warmth jump anywhere in 24h (incl. midnight)', maxWarmthStep < 0.02, `worst step ${maxWarmthStep}`)

  // Midnight specifically, since it is the seam a naive 0..23 table would
  // break at and "nobody is testing at". Also inside the night floor now
  // (23:00-04:00), so both sides should read as exactly 0, not merely close.
  const beforeMidnight = skyFor(dateAt(23, 59, 59))
  const afterMidnight = skyFor(dateAt(0, 0, 1))
  check(
    'the step across midnight itself is unremarkable',
    Math.abs(afterMidnight.daylight - beforeMidnight.daylight) < 0.001,
    `${beforeMidnight.daylight} -> ${afterMidnight.daylight}`,
  )
  check('midnight itself sits at the night floor, both sides', near(beforeMidnight.daylight, 0, 0.001) && near(afterMidnight.daylight, 0, 0.001), `${beforeMidnight.daylight}, ${afterMidnight.daylight}`)
}

// 3. The plateau and the floor — entry 71's own acceptance test, and the
//    actual point of the six-anchor table: day and night are states held
//    for hours, not instants touched once. Sampled throughout each window,
//    not only at its own boundary, since a plateau that only holds at its
//    labelled edges is not a plateau. Windows re-timed by entry 108 to
//    08:30-17:45 and 21:45-05:30 — both verified to still hold exactly
//    (plateau min 1.000000, floor max 0.000000).
{
  let minInDayWindow = Infinity
  for (let mins = 8 * 60 + 30; mins <= 17 * 60 + 45; mins++) {
    minInDayWindow = Math.min(minInDayWindow, skyFor(dateAt(Math.floor(mins / 60), mins % 60)).daylight)
  }
  check('the day plateau (08:30-17:45) never dips below 0.999', minInDayWindow >= 0.999, String(minInDayWindow))

  let maxInNightWindow = -Infinity
  // 21:45 through 23:59, then 00:00 through 05:30 — the floor wraps midnight.
  for (let mins = 21 * 60 + 45; mins <= 24 * 60 - 1; mins++) {
    maxInNightWindow = Math.max(maxInNightWindow, skyFor(dateAt(Math.floor(mins / 60), mins % 60)).daylight)
  }
  for (let mins = 0; mins <= 5 * 60 + 30; mins++) {
    maxInNightWindow = Math.max(maxInNightWindow, skyFor(dateAt(Math.floor(mins / 60), mins % 60)).daylight)
  }
  check('the night floor (21:45-05:30) never rises above 0.001', maxInNightWindow <= 0.001, String(maxInNightWindow))
}

// 4. The mid-band's total width — daylight strictly between 0.1 and 0.9,
//    summed across the whole day. This is the check that should have caught
//    entry 71's own miscount and did not: it asserted `< 11`, loose enough
//    to pass at the 9.95 hours that table actually produced against a
//    Done-when promising "no more than ~5". A threshold sized to pass
//    whatever ships is a worse failure than no check at all — see entry
//    108, which found the gap.
//
//    Entry 108 re-timed the same six anchors (shorter dawn/dusk spans, same
//    held values) for a measured 4.90 hours here. The new threshold, 5.2, is
//    sized to that figure with a few minutes of headroom for arithmetic
//    slack across leap years and DST-free clock math — not to whatever the
//    table happens to produce — so any future drift of more than a few
//    minutes fails the gate the way 9.95 always should have.
{
  let midBandMinutes = 0
  for (let mins = 0; mins < 24 * 60; mins++) {
    const v = skyFor(dateAt(Math.floor(mins / 60), mins % 60)).daylight
    if (v > 0.1 && v < 0.9) midBandMinutes++
  }
  const midBandHours = midBandMinutes / 60
  check(
    `mid-band is a genuine minority of the day (${midBandHours.toFixed(2)}h of 24, down from entry 71's shipped 9.95h)`,
    midBandHours < 5.2,
    `${midBandHours}h`,
  )
}

// 5. A ten-minute window during an active transition shows a visible
//    difference, per the entry's own Done-when example. Tested at the
//    steepest point of the 07:00->08:30 dawn segment rather than at either
//    anchor: entry 108's re-timed table peaks near 07:45 (delta 0.10789
//    across ten minutes either side of it) rather than the old table's
//    ~08:30, because the dawn span is now half as long and its middle
//    moved with it.
{
  const before = skyFor(dateAt(7, 40))
  const after = skyFor(dateAt(7, 50))
  check('a ten-minute window mid-transition is visibly different', Math.abs(after.daylight - before.daylight) > 0.01, `${before.daylight} vs ${after.daylight}`)

  // The anchor-straddling window used to be flat to under 0.001 absolute,
  // because the old segments either side were four-plus hours wide and an
  // anchor's zero derivative dominated a ±5 minute window completely. Entry
  // 108's segments are 1.5 hours wide, so the same window now moves 0.00580
  // — a real, measured effect of the shorter segments, not a regression.
  // Made relative rather than loosening the absolute number: the check's
  // actual meaning is "an anchor is flat *compared to* the middle of a
  // segment", and 0.00580 against the 0.10789 mid-transition delta above is
  // 18.6x, which is what that comparison should show regardless of segment
  // width.
  const straddleAnchor = Math.abs(skyFor(dateAt(8, 35)).daylight - skyFor(dateAt(8, 25)).daylight)
  const midTransitionDelta = Math.abs(after.daylight - before.daylight)
  check(
    'confirms the anchor-straddling case is flat relative to a mid-transition window, not a bug in the check above',
    straddleAnchor < midTransitionDelta / 10,
    `${straddleAnchor} vs ${midTransitionDelta / 10}`,
  )
}

// 6. Smoothstep's own signature: the rate of change near an anchor is
//    slower than at the midpoint of a segment, which is what "eases in and
//    out" means and what tells this apart from a linear ramp. Re-timed to
//    the day-plateau anchor (08:30) and the steepest point of the dawn
//    segment (07:45, per check 5 above) rather than the old 10:30/08:30
//    pair.
{
  const nearAnchor = Math.abs(skyFor(dateAt(8, 31)).daylight - skyFor(dateAt(8, 30)).daylight)
  const midSegment = Math.abs(skyFor(dateAt(7, 46)).daylight - skyFor(dateAt(7, 45)).daylight) // steepest point, dawn segment
  check('the rate of change eases near an anchor rather than staying constant', nearAnchor < midSegment, `${nearAnchor} vs ${midSegment}`)
}

// 7. `solarAltitudeDeg` — docs/todo.md entry 97's real-position addition,
//    unlike everything above with no live almanac to check an exact minute
//    against. Checked instead against identities that hold regardless of
//    ephemeris precision: axial tilt itself (obliquity ~23.44°, which does
//    not depend on which exact instant "the solstice" is), and the
//    algorithm's own internal consistency between longitude and time —
//    neither needs an external reference to be verifiable.
{
  // Near the June solstice, the sub-solar point sits at the Tropic of
  // Cancer: local noon there should read close to straight up. "Close",
  // not exact — the sampled instant is a fixed clock time, not the
  // solstice's own exact moment (which drifts a few hours year to year),
  // and 12:00 UTC at longitude 0 is only within the equation of time's own
  // few minutes of true local solar noon. Both slack sources are small
  // near a solstice, where declination changes slowest of the whole year.
  const juneNoonAtTropic = solarAltitudeDeg(new Date('2026-06-21T12:00:00Z'), { latitude: 23.4367, longitude: 0 })
  check('June solstice, noon, Tropic of Cancer: sun close to overhead', near(juneNoonAtTropic, 90, 3), String(juneNoonAtTropic))

  // Same instant, at the equator instead: altitude should be ~(90 -
  // obliquity) — the sun sits obliquity degrees off overhead in latitude.
  const juneNoonAtEquator = solarAltitudeDeg(new Date('2026-06-21T12:00:00Z'), { latitude: 0, longitude: 0 })
  check(
    'June solstice, noon, equator: altitude close to 90 - 23.44',
    near(juneNoonAtEquator, 90 - 23.4367, 3),
    String(juneNoonAtEquator),
  )

  // December solstice flips the hemisphere: same near-overhead reading, now
  // at the Tropic of Capricorn.
  const decNoonAtTropic = solarAltitudeDeg(new Date('2026-12-21T12:00:00Z'), { latitude: -23.4367, longitude: 0 })
  check('December solstice, noon, Tropic of Capricorn: sun close to overhead', near(decNoonAtTropic, 90, 3), String(decNoonAtTropic))

  // Near an equinox, the sub-solar point sits on the equator: noon there
  // should also read close to overhead. Slacker tolerance than the
  // solstice checks — declination moves at its fastest through the year
  // right at an equinox, so a fixed clock time is less forgiving here.
  const marchNoonAtEquator = solarAltitudeDeg(new Date('2026-03-20T12:00:00Z'), { latitude: 0, longitude: 0 })
  check('March equinox, noon, equator: sun close to overhead', near(marchNoonAtEquator, 90, 5), String(marchNoonAtEquator))

  // An identity that needs no ephemeris at all: 15° of longitude is exactly
  // one hour of true solar time, and going *east* moves local solar noon
  // *earlier* in UTC — so the same latitude one UTC hour earlier at a
  // location 15° further east sees (to a first approximation — declination
  // itself creeps a little in an hour, which is what the tolerance covers)
  // the same sun height as the origin.
  const base = solarAltitudeDeg(new Date('2026-05-01T12:00:00Z'), { latitude: 45, longitude: 0 })
  const shifted = solarAltitudeDeg(new Date('2026-05-01T11:00:00Z'), { latitude: 45, longitude: 15 })
  check('15° east, 1 hour earlier UTC, reads the same sun height as the origin', near(base, shifted, 0.1), `${base} vs ${shifted}`)

  // Bounded and finite across a scattered sweep of lat/lon/time — the basic
  // sanity a spherical-trig formula can silently fail (a sign flip putting
  // the sun below the horizon at local noon on the equator, a NaN from an
  // out-of-domain asin) without any single check above catching it.
  let minAlt = Infinity
  let maxAlt = -Infinity
  let anyNaN = false
  for (let i = 0; i < 200; i++) {
    const lat = -80 + ((i * 37) % 160)
    const lon = -170 + ((i * 53) % 340)
    const date = new Date(Date.UTC(2026, i % 12, 1 + (i % 27), i % 24, (i * 7) % 60))
    const alt = solarAltitudeDeg(date, { latitude: lat, longitude: lon })
    if (Number.isNaN(alt)) anyNaN = true
    minAlt = Math.min(minAlt, alt)
    maxAlt = Math.max(maxAlt, alt)
  }
  check('no NaN across a scattered lat/lon/time sweep', !anyNaN, 'a NaN altitude was produced')
  check('altitude stays within [-90, 90] across the sweep', minAlt >= -90 && maxAlt <= 90, `${minAlt} .. ${maxAlt}`)
}

// 8. `skyForLocation` — the same `Sky` shape `skyFor` returns, so this only
//    needs to check its own mapping from altitude, not re-derive daylight
//    or warmth from scratch. The near-overhead instants from section 7 are
//    reused as "definitely full daylight, definitely near the midday
//    warmth anchor" fixtures, and a definite night instant for the other end.
{
  const overhead = skyForLocation(new Date('2026-06-21T12:00:00Z'), { latitude: 23.4367, longitude: 0 })
  check('sun near overhead: daylight is fully 1', near(overhead.daylight, 1, 1e-6), String(overhead.daylight))
  check('sun near overhead: warmth sits at the clamped midday value', near(overhead.warmth, -0.1, 0.02), String(overhead.warmth))

  // Local midnight at the same place: the sun is on the far side of the
  // Earth, altitude deep below the -6° civil-twilight floor.
  const midnight = skyForLocation(new Date('2026-06-22T00:00:00Z'), { latitude: 23.4367, longitude: 0 })
  check('local midnight: daylight is fully 0', near(midnight.daylight, 0, 1e-6), String(midnight.daylight))
  check('local midnight: warmth sits at the clamped night floor', near(midnight.warmth, -0.35, 0.02), String(midnight.warmth))

  // Bounds hold across the same sweep section 7 used for solarAltitudeDeg.
  let minDay = Infinity
  let maxDay = -Infinity
  let minWarm = Infinity
  let maxWarm = -Infinity
  for (let i = 0; i < 200; i++) {
    const lat = -80 + ((i * 37) % 160)
    const lon = -170 + ((i * 53) % 340)
    const date = new Date(Date.UTC(2026, i % 12, 1 + (i % 27), i % 24, (i * 7) % 60))
    const sky = skyForLocation(date, { latitude: lat, longitude: lon })
    minDay = Math.min(minDay, sky.daylight)
    maxDay = Math.max(maxDay, sky.daylight)
    minWarm = Math.min(minWarm, sky.warmth)
    maxWarm = Math.max(maxWarm, sky.warmth)
  }
  check('daylight stays within [0, 1] across the sweep', minDay >= 0 && maxDay <= 1, `${minDay} .. ${maxDay}`)
  check('warmth stays within the anchor table\'s own [-0.35, 0.55] across the sweep', minWarm >= -0.35 - 1e-9 && maxWarm <= 0.55 + 1e-9, `${minWarm} .. ${maxWarm}`)
}

// 9. `skyFor` itself is untouched by any of the above — same anchors, same
//    values, re-checked here as a regression guard specifically against
//    entry 97's edit rather than relying on sections 1-6 having already
//    covered it (they were written for entry 71 and would not by
//    themselves prove entry 97 left this function alone).
{
  const noon = skyFor(dateAt(12, 0))
  check('skyFor still reports the day plateau at noon after entry 97\'s edit', near(noon.daylight, 1, 1e-6), String(noon.daylight))
  const midnightClock = skyFor(dateAt(0, 30))
  check('skyFor still reports the night floor after entry 97\'s edit', near(midnightClock.daylight, 0, 1e-6), String(midnightClock.daylight))
}

console.log(failures === 0 ? `\nall checks passed` : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
