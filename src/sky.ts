/**
 * The picture follows the sky — docs/todo.md entry 53.
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
 * Four anchors on a 24-hour circle, smoothstepped between neighbours rather
 * than linearly interpolated: linear interpolation between four points is a
 * triangle wave, and a triangle wave has a sharp corner at every anchor —
 * exactly the "sharp jumps" this entry exists to avoid, just relocated. The
 * last anchor interpolates forward into the first across midnight, so there
 * is no seam at the one hour nobody is testing at.
 *
 * A pure function of a `Date`, so it can be scrubbed through 24 hours in a
 * headless harness (`views-probe.html`) exactly like `probe-slow.ts` and
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
  daylight: number
  warmth: number
}

/** Warm at both ends, coolest in the small hours — what a sky actually
 *  does. Starting points, settled by eye rather than measured. */
const ANCHORS: readonly Anchor[] = [
  { hour: 2, daylight: 0.0, warmth: -0.35 },
  { hour: 6.5, daylight: 0.35, warmth: 0.5 },
  { hour: 13, daylight: 1.0, warmth: -0.1 },
  { hour: 19.5, daylight: 0.4, warmth: 0.6 },
]

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

export function skyFor(date: Date): Sky {
  const rawHour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  // Shifted into the same wrapped frame the segment search below expects:
  // anything before the first anchor is really inside the segment that
  // wraps across midnight from the last anchor to the first.
  const hour = rawHour < ANCHORS[0].hour ? rawHour + 24 : rawHour

  for (let i = 0; i < ANCHORS.length; i++) {
    const a = ANCHORS[i]
    const bIndex = (i + 1) % ANCHORS.length
    const b = ANCHORS[bIndex]
    const bHour = bIndex === 0 ? b.hour + 24 : b.hour
    if (hour >= a.hour && hour < bHour) {
      const t = smoothstep((hour - a.hour) / (bHour - a.hour))
      return {
        daylight: a.daylight + (b.daylight - a.daylight) * t,
        warmth: a.warmth + (b.warmth - a.warmth) * t,
      }
    }
  }
  // Unreachable given the wrap above covers the full circle, but a pure
  // function should not have a path that can throw.
  return { daylight: ANCHORS[0].daylight, warmth: ANCHORS[0].warmth }
}
