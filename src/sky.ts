/**
 * The picture follows the sky — docs/todo.md entry 53, reshaped by entry 71.
 *
 * A stylised, not astronomical, day/night cycle from the local clock alone:
 * `new Date()` needs no permission and already runs once, for the
 * screenshot's filename. Reading real sunrise/sunset would mean a
 * geolocation prompt on a page whose one promise is that nothing leaves the
 * device — disproportionate for a lighting effect, and the wrong kind of
 * ask here regardless. The honest cost: in Reykjavík in June this will call
 * 2am night while it is broad daylight outside. That is the correct trade
 * for a toy, and it is written here rather than "fixed" later with a
 * location call.
 *
 * Anchors on a 24-hour circle, smoothstepped between neighbours rather than
 * linearly interpolated: linear interpolation between a handful of points is
 * a triangle wave, and a triangle wave has a sharp corner at every anchor —
 * exactly the "sharp jumps" this entry exists to avoid, just relocated. The
 * last anchor interpolates forward into the first across midnight, so there
 * is no seam at the one hour nobody is testing at.
 *
 * Entry 71's own finding, from scrubbing the original four-anchor curve over
 * 24 hours: four anchors smoothstepped pairwise cannot produce a plateau —
 * every anchor is a peak or a valley, so "day" and "night" were each an
 * instant, not a state, and the picture spent sixteen of the twenty-four
 * hours in between. Daylight now has six anchors — a night floor held from
 * 23:00 to 04:00, a day plateau held from 10:30 to 15:30, and the original
 * warm dawn/dusk anchors carrying the transitions between them — so day and
 * night are states again and the crossover is what it should be: an event,
 * not most of the day. Warmth keeps its original four anchors unchanged;
 * that curve was already right, and this entry's finding was about the
 * shape of daylight specifically.
 *
 * A pure function of a `Date`, so it can be scrubbed through 24 hours in a
 * headless harness (`scripts/probe-sky.ts`) exactly like `probe-slow.ts` and
 * the rest already run without a browser.
 */

export interface Sky {
  /** 0-1. Rides entry 47's own `uDay` control. */
  daylight: number
  /** -1 (cool) .. 1 (warm). */
  warmth: number
}

interface Anchor {
  hour: number
  value: number
}

/** Six anchors, holding both ends rather than only touching them — entry
 *  71's own finding. 04:00 and 23:00 are both 0.0 (adjacent, so the curve
 *  between them holds flat at the night floor rather than easing anywhere);
 *  10:30 and 15:30 are both 1.0 for the same reason, at the day plateau.
 *  06:30 and 19:30 are the original dawn/dusk anchors, unmoved, carrying the
 *  shape of the rise and fall between the two held ends. Hours settled by
 *  eye, per this file's own house style — see the original ANCHORS comment
 *  this table replaces. **Mine** as to the specific hours. */
const DAYLIGHT_ANCHORS: readonly Anchor[] = [
  { hour: 4, value: 0.0 },
  { hour: 6.5, value: 0.35 },
  { hour: 10.5, value: 1.0 },
  { hour: 15.5, value: 1.0 },
  { hour: 19.5, value: 0.4 },
  { hour: 23, value: 0.0 },
]

/** Warm at both ends, coolest in the small hours — what a sky actually
 *  does. Unchanged by entry 71: this shape was already right. */
const WARMTH_ANCHORS: readonly Anchor[] = [
  { hour: 2, value: -0.35 },
  { hour: 6.5, value: 0.5 },
  { hour: 13, value: -0.1 },
  { hour: 19.5, value: 0.6 },
]

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

/** Smoothstepped interpolation on a wrapped 24-hour circle, generic over
 *  either anchor table — the two curves are independent (different anchor
 *  counts, different hours) but the wrap-and-segment-search logic they each
 *  need is identical, so this is written once rather than twice. */
function interpolate(anchors: readonly Anchor[], rawHour: number): number {
  // Shifted into the same wrapped frame the segment search below expects:
  // anything before the first anchor is really inside the segment that
  // wraps across midnight from the last anchor to the first.
  const hour = rawHour < anchors[0].hour ? rawHour + 24 : rawHour

  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i]
    const bIndex = (i + 1) % anchors.length
    const b = anchors[bIndex]
    const bHour = bIndex === 0 ? b.hour + 24 : b.hour
    if (hour >= a.hour && hour < bHour) {
      const t = smoothstep((hour - a.hour) / (bHour - a.hour))
      return a.value + (b.value - a.value) * t
    }
  }
  // Unreachable given the wrap above covers the full circle, but a pure
  // function should not have a path that can throw.
  return anchors[0].value
}

export function skyFor(date: Date): Sky {
  const rawHour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  return {
    daylight: interpolate(DAYLIGHT_ANCHORS, rawHour),
    warmth: interpolate(WARMTH_ANCHORS, rawHour),
  }
}
