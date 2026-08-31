/**
 * The picture follows the sky — docs/todo.md entry 53, reshaped by entry 71.
 *
 * A stylised, not astronomical, day/night cycle from the local clock alone
 * — the fallback for a visitor who never grants location, or whose browser
 * has none to give. `new Date()` needs no permission and already runs once,
 * for the screenshot's filename. The honest cost, unchanged since entry 71:
 * in Reykjavík in June this will call 2am night while it is broad daylight
 * outside — a fine trade for a toy, and the correct floor to fall back to.
 *
 * Entry 97 overturns what this file used to say here: that reading real
 * sunrise/sunset would mean a geolocation prompt disproportionate to a
 * lighting effect. The prompt was never the actual cost — a coordinate that
 * never leaves the device is no different from the clock this file already
 * reads with no prompt at all. `skyForLocation` below is the real-position
 * counterpart, used whenever `geo-location.ts` has a coordinate to give it;
 * `skyFor` stays exactly as it always has, for everyone else.
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

import type { GeoLocation } from './geo-location'

export interface Sky {
  /** 0-1. Rides entry 47's own `uDay` control. */
  daylight: number
  /** -1 (cool) .. 1 (warm). */
  warmth: number
  /** docs/todo.md entry 100 — `daylight`'s own derivative, in daylight-units
   *  per hour, always computed from the clock anchors below regardless of
   *  which of `skyFor`/`skyForLocation` produced this `Sky` — real solar
   *  altitude was never differentiated for this, since "the slope is still
   *  meaningful even when its absolute hours are wrong for the latitude"
   *  (Decided's own words) already covers the clock-only case, and
   *  `engine/celestial.ts` is the one reader. */
  slope: number
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

/**
 * `interpolate`'s own analytic derivative, at the same wrapped hour —
 * docs/todo.md entry 100. `smoothstep(u) = 3u² - 2u³` has derivative
 * `6u(1-u)` with respect to `u`; the chain rule through
 * `u = (hour - a.hour) / (bHour - a.hour)` divides by the segment's own
 * width in hours. Exact, not a finite-difference approximation: a numeric
 * difference would introduce noise right at a segment's own two ends,
 * where `interpolate`'s own "no corner" property (the thing `probe-sky.ts`
 * already checks for `daylight` itself) needs the derivative to land on a
 * true zero, not something merely close to it — `6u(1-u)` is exactly 0 at
 * `u = 0` and `u = 1` by construction, with no rounding involved.
 */
function interpolateSlope(anchors: readonly Anchor[], rawHour: number): number {
  const hour = rawHour < anchors[0].hour ? rawHour + 24 : rawHour

  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i]
    const bIndex = (i + 1) % anchors.length
    const b = anchors[bIndex]
    const bHour = bIndex === 0 ? b.hour + 24 : b.hour
    if (hour >= a.hour && hour < bHour) {
      const width = bHour - a.hour
      const u = (hour - a.hour) / width
      const dSmoothstepDu = 6 * u * (1 - u)
      return ((b.value - a.value) * dSmoothstepDu) / width
    }
  }
  return 0
}

export function skyFor(date: Date): Sky {
  const rawHour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  return {
    daylight: interpolate(DAYLIGHT_ANCHORS, rawHour),
    slope: interpolateSlope(DAYLIGHT_ANCHORS, rawHour),
    warmth: interpolate(WARMTH_ANCHORS, rawHour),
  }
}

const DEG = Math.PI / 180
const toRadians = (deg: number): number => deg * DEG
const toDegrees = (rad: number): number => rad / DEG

/** Days since the Unix epoch, expressed as a Julian Day — the clock the
 *  solar position algorithm below actually runs on. UTC midnight
 *  1970-01-01 is JD 2440587.5 by definition, so this needs no calendar
 *  arithmetic beyond the millisecond count `Date` already gives for free. */
function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5
}

interface SunGeometry {
  /** Nutation-corrected apparent ecliptic longitude, degrees, 0-360. */
  apparentLongitudeDeg: number
  /** Obliquity of the ecliptic, corrected for nutation, degrees. */
  obliquityDeg: number
  declinationRad: number
  eqTimeMinutes: number
}

/**
 * The NOAA solar position algorithm's own middle section (the same one
 * behind NOAA's published sunrise/sunset calculator) — Julian Century, the
 * sun's geometric mean longitude and anomaly, orbital eccentricity, the
 * equation of center, true and apparent longitude (nutation-corrected), the
 * obliquity of the ecliptic, declination and the equation of time. Shared
 * by `solarAltitudeDeg` below and by `moon.ts`'s own real-position path,
 * which needs the sun's ecliptic longitude to compute lunar phase — one
 * orbit computation, not two independently transcribed ones.
 */
function sunGeometry(date: Date): SunGeometry {
  const jd = julianDay(date)
  const T = (jd - 2451545.0) / 36525

  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T)
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)

  const Mr = toRadians(M)
  const C =
    Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mr) * 0.000289

  const trueLongitude = L0 + C
  const omega = 125.04 - 1934.136 * T
  const apparentLongitudeDeg = trueLongitude - 0.00569 - 0.00478 * Math.sin(toRadians(omega))

  const meanObliquity = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60
  const obliquityDeg = meanObliquity + 0.00256 * Math.cos(toRadians(omega))

  const declinationRad = Math.asin(Math.sin(toRadians(obliquityDeg)) * Math.sin(toRadians(apparentLongitudeDeg)))

  const y = Math.tan(toRadians(obliquityDeg) / 2) ** 2
  const eqTimeMinutes =
    4 *
    toDegrees(
      y * Math.sin(2 * toRadians(L0)) -
        2 * e * Math.sin(Mr) +
        4 * e * y * Math.sin(Mr) * Math.cos(2 * toRadians(L0)) -
        0.5 * y * y * Math.sin(4 * toRadians(L0)) -
        1.25 * e * e * Math.sin(2 * Mr),
    )

  return { apparentLongitudeDeg, obliquityDeg, declinationRad, eqTimeMinutes }
}

/** The sun's own apparent ecliptic longitude, degrees, 0-360 — exported for
 *  `moon.ts`'s real-position path, which needs it to compute lunar phase
 *  (elongation is just the two bodies' ecliptic longitudes subtracted). */
export function sunEclipticLongitudeDeg(date: Date): number {
  return ((sunGeometry(date).apparentLongitudeDeg % 360) + 360) % 360
}

/**
 * Sun altitude above the horizon, in degrees, at a given instant and
 * location — `sunGeometry` above plus true solar time, the hour angle, and
 * altitude via the standard spherical-triangle formula.
 *
 * True solar time is derived from longitude directly rather than the
 * browser's timezone — `Date`'s own UTC fields plus `4 * longitude` minutes
 * is the sun's actual local time at that meridian, and it needs the device
 * to agree with nothing about *which* zone the place uses, only its clock.
 * No atmospheric refraction correction: the few arcminutes it would add
 * near the horizon are smaller than the ±6° band `skyForLocation` already
 * treats as one continuous transition below.
 */
export function solarAltitudeDeg(date: Date, location: GeoLocation): number {
  const { declinationRad, eqTimeMinutes } = sunGeometry(date)

  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60
  let trueSolarTime = (utcMinutes + eqTimeMinutes + 4 * location.longitude) % 1440
  if (trueSolarTime < 0) trueSolarTime += 1440

  const hourAngleDeg = trueSolarTime / 4 - 180

  const latR = toRadians(location.latitude)
  const haR = toRadians(hourAngleDeg)
  const sinAltitude = Math.sin(latR) * Math.sin(declinationRad) + Math.cos(latR) * Math.cos(declinationRad) * Math.cos(haR)
  return toDegrees(Math.asin(Math.max(-1, Math.min(1, sinAltitude))))
}

/** Civil twilight's own band — the same ±6° aviation and photography
 *  already treat as "usable light without direct sun". **Mine**: entry 97's
 *  Decided doesn't pin an exact bound, and a real sky doesn't switch at the
 *  geometric horizon (0°) either; civil twilight is visibly not night. */
const CIVIL_TWILIGHT_DEG = 6

function smoothstepRange(value: number, lo: number, hi: number): number {
  return smoothstep((value - lo) / (hi - lo))
}

interface AltitudeAnchor {
  altitude: number
  value: number
}

/** Altitude-keyed, not hour-keyed: warmth follows how high the sun actually
 *  is, symmetric between morning and evening — an altitude alone can't tell
 *  which side of noon it is, and a real sky's colour at a given sun height
 *  doesn't much care either. Anchors picked to land close to the existing
 *  hour-based `WARMTH_ANCHORS`' own values at the altitudes those clock
 *  hours reach near the equinox: same cool floor deep in the night, warmest
 *  near the horizon, cool again at midday. **Mine**: the specific altitudes,
 *  and averaging dawn's and dusk's slightly different original peaks
 *  (0.5 / 0.6) into the one symmetric curve altitude has to use. */
const WARMTH_ALTITUDE_ANCHORS: readonly AltitudeAnchor[] = [
  { altitude: -90, value: -0.35 },
  { altitude: -6, value: -0.35 },
  { altitude: 5, value: 0.55 },
  { altitude: 45, value: -0.1 },
  { altitude: 90, value: -0.1 },
]

/** Like `interpolate` above, but over altitude rather than a wrapped
 *  24-hour circle: altitude has real, non-wrapping ends (straight down,
 *  straight up), so this clamps at the anchor table's edges instead of
 *  segment-searching around a wraparound. */
function interpolateClamped(anchors: readonly AltitudeAnchor[], altitude: number): number {
  if (altitude <= anchors[0].altitude) return anchors[0].value
  const last = anchors[anchors.length - 1]
  if (altitude >= last.altitude) return last.value
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]
    const b = anchors[i + 1]
    if (altitude >= a.altitude && altitude <= b.altitude) {
      const t = smoothstep((altitude - a.altitude) / (b.altitude - a.altitude))
      return a.value + (b.value - a.value) * t
    }
  }
  return last.value
}

/**
 * `skyFor`'s real-position counterpart — entry 97. Same `Sky` shape, so
 * every consumer (`uDay`, atmosphere warmth) is unchanged by which one fed
 * it; `scene.ts` alone decides which to call, based on whether
 * `geo-location.ts` was granted a coordinate this session.
 */
export function skyForLocation(date: Date, location: GeoLocation): Sky {
  const altitude = solarAltitudeDeg(date, location)
  const rawHour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  return {
    daylight: smoothstepRange(altitude, -CIVIL_TWILIGHT_DEG, CIVIL_TWILIGHT_DEG),
    warmth: interpolateClamped(WARMTH_ALTITUDE_ANCHORS, altitude),
    // docs/todo.md entry 100 — the clock curve's own slope, same as
    // `skyFor` uses, not a derivative of real solar altitude — see
    // `Sky.slope`'s own comment for why.
    slope: interpolateSlope(DAYLIGHT_ANCHORS, rawHour),
  }
}
