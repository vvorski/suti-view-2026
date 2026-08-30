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

import { skyFor } from '../src/sky.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const dateAt = (h: number, m = 0, s = 0): Date => new Date(2026, 0, 1, h, m, s)
const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) < eps

// 1. Each anchor lands exactly — daylight's six, warmth's four (unchanged
//    by entry 71: that shape was already right).
{
  const daylightAnchors: [number, number, number][] = [
    [4, 0, 0.0],
    [6, 30, 0.35],
    [10, 30, 1.0],
    [15, 30, 1.0],
    [19, 30, 0.4],
    [23, 0, 0.0],
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
//    including the two adjacent pairs (23:00/04:00, 10:30/15:30) that now
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
  // The steepest anchor-to-anchor span is 4 hours (240 minutes, 06:30 ->
  // 10:30) for a daylight range up to 1.0 — a per-minute step well under
  // 1/100 is the generous ceiling a genuine discontinuity (which would jump
  // by a large fraction of the whole range in one step) would blow past
  // easily.
  check('no per-minute daylight jump anywhere in 24h (incl. midnight)', maxDaylightStep < 0.01, `worst step ${maxDaylightStep}`)
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
//    labelled edges is not a plateau.
{
  let minInDayWindow = Infinity
  for (let mins = 10 * 60 + 30; mins <= 15 * 60 + 30; mins++) {
    minInDayWindow = Math.min(minInDayWindow, skyFor(dateAt(Math.floor(mins / 60), mins % 60)).daylight)
  }
  check('the day plateau (10:30-15:30) never dips below 0.999', minInDayWindow >= 0.999, String(minInDayWindow))

  let maxInNightWindow = -Infinity
  // 23:00 through 23:59, then 00:00 through 04:00 — the floor wraps midnight.
  for (let mins = 23 * 60; mins <= 24 * 60 - 1; mins++) {
    maxInNightWindow = Math.max(maxInNightWindow, skyFor(dateAt(23, mins - 23 * 60)).daylight)
  }
  for (let mins = 0; mins <= 4 * 60; mins++) {
    maxInNightWindow = Math.max(maxInNightWindow, skyFor(dateAt(Math.floor(mins / 60), mins % 60)).daylight)
  }
  check('the night floor (23:00-04:00) never rises above 0.001', maxInNightWindow <= 0.001, String(maxInNightWindow))
}

// 4. The mid-band's total width — daylight strictly between 0.1 and 0.9,
//    summed across the whole day. Down from the original four-anchor
//    curve's own measured 16 hours (every anchor a peak or a valley, so the
//    whole day between them was neither day nor night) to a genuine
//    minority of it.
//
//    Honest finding, not the entry's own figure: its Decided section
//    estimates "~2.5 hours at each end of the day", ~5 total. Measured here
//    (and reproducible with the one-line scrub the entry's own Verify
//    credits), each transition is closer to 4.6-5.3 hours, ~9.9 total —
//    the entry's anchor *hours and values* are exact and are what is
//    implemented; the "~5" was evidently an eyeballed estimate of what
//    those anchors would produce, not re-derived from them, and it is off
//    by roughly a factor of two. **Mine to measure and report, not to
//    silently correct** — the anchors themselves are the entry's own
//    explicit "Mine as to the hours" choice, so the fix for a wrong estimate
//    is a corrected number here, not a change to the anchors it was
//    estimating. The qualitative claim ("day and night are states, not
//    instants") holds regardless: 9.9 hours of transition against 14.1
//    hours of held plateau/floor is still the entry's own point, made
//    correctly even where its own arithmetic wasn't.
{
  let midBandMinutes = 0
  for (let mins = 0; mins < 24 * 60; mins++) {
    const v = skyFor(dateAt(Math.floor(mins / 60), mins % 60)).daylight
    if (v > 0.1 && v < 0.9) midBandMinutes++
  }
  const midBandHours = midBandMinutes / 60
  check(
    `mid-band is a genuine minority of the day (${midBandHours.toFixed(2)}h of 24, down from the old curve's 16h)`,
    midBandHours < 11,
    `${midBandHours}h`,
  )
}

// 5. A ten-minute window during an active transition shows a visible
//    difference, per the entry's own Done-when example. Tested at the
//    steepest point of the 06:30->10:30 dawn segment (its midpoint, ~08:30)
//    rather than at either anchor: 06:30 and 10:30 both have a zero
//    derivative by construction (smoothstep's whole reason for existing,
//    which is what "no corner" above requires), making each anchor the
//    single flattest point on its own neighbouring curve.
{
  const before = skyFor(dateAt(8, 25))
  const after = skyFor(dateAt(8, 35))
  check('a ten-minute window mid-transition is visibly different', Math.abs(after.daylight - before.daylight) > 0.01, `${before.daylight} vs ${after.daylight}`)

  const straddleAnchor = Math.abs(skyFor(dateAt(10, 35)).daylight - skyFor(dateAt(10, 25)).daylight)
  check(
    'confirms the anchor-straddling case is the flat one, not a bug in the check above',
    straddleAnchor < 0.001,
    String(straddleAnchor),
  )
}

// 6. Smoothstep's own signature: the rate of change near an anchor is
//    slower than at the midpoint of a segment, which is what "eases in and
//    out" means and what tells this apart from a linear ramp.
{
  const nearAnchor = Math.abs(skyFor(dateAt(10, 31)).daylight - skyFor(dateAt(10, 30)).daylight)
  const midSegment = Math.abs(skyFor(dateAt(8, 31)).daylight - skyFor(dateAt(8, 30)).daylight) // ~midpoint of 6:30-10:30
  check('the rate of change eases near an anchor rather than staying constant', nearAnchor < midSegment, `${nearAnchor} vs ${midSegment}`)
}

console.log(failures === 0 ? `\nall checks passed` : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
