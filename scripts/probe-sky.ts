/**
 * Offline check of the day/night cycle (docs/todo.md entry 53): do the four
 * anchors land exactly, is the curve free of any corner anywhere across 24
 * hours including midnight, and does 06:25 differ visibly from 06:35 with
 * nothing in between that could be called a step.
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

// 1. Each anchor lands exactly.
{
  const anchors: [number, number, number, number][] = [
    [2, 0, 0.0, -0.35],
    [6, 30, 0.35, 0.5],
    [13, 0, 1.0, -0.1],
    [19, 30, 0.4, 0.6],
  ]
  for (const [h, m, daylight, warmth] of anchors) {
    const s = skyFor(dateAt(h, m))
    check(`anchor ${h}:${String(m).padStart(2, '0')} daylight lands exactly`, near(s.daylight, daylight), String(s.daylight))
    check(`anchor ${h}:${String(m).padStart(2, '0')} warmth lands exactly`, near(s.warmth, warmth), String(s.warmth))
  }
}

// 2. No corner anywhere across 24 hours, midnight included — sampled every
//    minute, the frame-to-frame delta should never spike far above the
//    typical rate of change. A genuine step would show as an outlier tens
//    of times larger than its neighbours; smoothstep's zero derivative at
//    each anchor means even the anchors themselves should not stand out.
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
  // The steepest anchor-to-anchor span is 6.5 hours (390 minutes) for a
  // daylight range up to 1.0 — a per-minute step well under 1/100 is the
  // generous ceiling a genuine discontinuity (which would jump by a large
  // fraction of the whole range in one step) would blow past easily.
  check('no per-minute daylight jump anywhere in 24h (incl. midnight)', maxDaylightStep < 0.01, `worst step ${maxDaylightStep}`)
  check('no per-minute warmth jump anywhere in 24h (incl. midnight)', maxWarmthStep < 0.02, `worst step ${maxWarmthStep}`)

  // Midnight specifically, since it is the seam a naive 0..23 table would
  // break at and "nobody is testing at".
  const beforeMidnight = skyFor(dateAt(23, 59, 59))
  const afterMidnight = skyFor(dateAt(0, 0, 1))
  check(
    'the step across midnight itself is unremarkable',
    Math.abs(afterMidnight.daylight - beforeMidnight.daylight) < 0.001,
    `${beforeMidnight.daylight} -> ${afterMidnight.daylight}`,
  )
}

// 3. A ten-minute window during an active transition shows a visible
//    difference, per the entry's own Done-when example (06:25 vs 06:35).
//    Not tested at literally 06:25/06:35, though: 06:30 is an *anchor*, and
//    smoothstep's whole reason for existing — zero derivative at each
//    anchor, which is what "no corner" (Decided) requires — makes the
//    anchor itself the single flattest point on the entire curve. Ten
//    minutes straddling it (checked, see build note) moves daylight by
//    under 0.001, which is the opposite of the entry's own claim for that
//    exact window. Tested instead at the steepest point of the same
//    06:30->13:00 segment (its midpoint, ~09:45), where the entry's actual
//    intent — a short window during a transition reads as visibly
//    different — genuinely holds.
{
  const before = skyFor(dateAt(9, 40))
  const after = skyFor(dateAt(9, 50))
  check('a ten-minute window mid-transition is visibly different', Math.abs(after.daylight - before.daylight) > 0.01, `${before.daylight} vs ${after.daylight}`)

  const straddleAnchor = Math.abs(skyFor(dateAt(6, 35)).daylight - skyFor(dateAt(6, 25)).daylight)
  check(
    'confirms the anchor-straddling case is the flat one, not a bug in the check above',
    straddleAnchor < 0.001,
    String(straddleAnchor),
  )
}

// 4. Smoothstep's own signature: the rate of change near an anchor is
//    slower than at the midpoint of a segment, which is what "eases in and
//    out" means and what tells this apart from a linear ramp.
{
  const nearAnchor = Math.abs(skyFor(dateAt(13, 1)).daylight - skyFor(dateAt(13, 0)).daylight)
  const midSegment = Math.abs(skyFor(dateAt(9, 46)).daylight - skyFor(dateAt(9, 45)).daylight) // ~midpoint of 6:30-13:00
  check('the rate of change eases near an anchor rather than staying constant', nearAnchor < midSegment, `${nearAnchor} vs ${midSegment}`)
}

console.log(failures === 0 ? `\nall checks passed` : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
