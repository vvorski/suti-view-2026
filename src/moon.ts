/**
 * The moon works the shapes, as the sun works the colour — docs/todo.md
 * entry 96.
 *
 * Perpendicular to `sky.ts` by construction: this file returns nothing that
 * touches colour, and nothing here is ever read by composite.frag.glsl.
 * `scene.ts` feeds its three fields into ripple reach, ripple lifespan and
 * the touch emitter's own cadence/life baseline — shape, never hue.
 *
 * Two of the three facts here are pure date arithmetic, exact from the
 * clock alone: `illuminated` and `waxing` need no location, only the phase
 * within a synodic month from a known new-moon epoch. The third,
 * `presence`, used to be the hard one — a *true* altitude needs latitude,
 * and asking for it was forbidden. `moonFor` below, and its stylised
 * `presence` proxy, are that refusal's fallback path now rather than the
 * whole feature: the moon transits (sits highest) at a time set by its own
 * phase alone — new near local noon, full near local midnight, quarters
 * near sunset and sunrise, the same relationship a real sky has between the
 * moon's elongation from the sun and its rising/transit time — and presence
 * is `cos` of the clock's hour-angle from that transit, clamped at the
 * horizon. It ignores latitude, so it is wrong about *how* high and says
 * nothing about a moon that never rises at extreme latitudes. Used whenever
 * `moonForLocation` below has no coordinate to work with.
 *
 * docs/todo.md entry 97 overturns the refusal this header used to state
 * here — the same reversal `sky.ts`'s own header records, for the same
 * reason: the prompt was the only real cost, and a coordinate that never
 * leaves the device pays it honestly. `moonForLocation` is the real
 * computation this entry adds: real lunar ecliptic position (Meeus's
 * low-precision series, leading terms only — see its own comment for which
 * ones and why), converted to true altitude the same way `sky.ts` converts
 * the sun's.
 *
 * Both are pure functions — `moonFor` of a `Date`, `moonForLocation` of a
 * `Date` and a coordinate — so both can be scrubbed through a full synodic
 * month in a headless harness (`scripts/probe-moon.ts`) exactly like
 * `probe-sky.ts` already does for the sun.
 */

// .ts extension kept explicit: a probe script needs to import this file
// directly (via moon.ts) under `node --experimental-strip-types`, which
// requires it for any value import inside src/ — see CLAUDE.md.
import { sunEclipticLongitudeDeg } from './sky.ts'
import type { GeoLocation } from './geo-location'

export interface Moon {
  /** 0 (new) .. 1 (full). The moon's own light — abundance rides this. */
  illuminated: number
  /** -1 (waning, fastest at last quarter) .. 1 (waxing, fastest at first
   *  quarter), 0 at both new and full — a moon that is not currently
   *  gaining or losing light has no growth direction to lend a ring.
   *  Signed on purpose: this is the one term with a direction, everything
   *  else here is a magnitude. */
  waxing: number
  /** 0 (below the horizon, by this file's own stylised reckoning) .. 1
   *  (at its stylised transit). The toy only feels the moon when the moon
   *  is "up". */
  presence: number
}

/** Days from new moon to new moon. */
const SYNODIC_MONTH_DAYS = 29.530588861

/** A real new moon (2000-01-06 18:14 UTC) — any correct reference epoch
 *  works equally well, since only the remainder after dividing by the
 *  synodic month survives; this one is a commonly cited value, easy to
 *  check against an almanac. */
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0)

const MS_PER_DAY = 86_400_000
const TAU = Math.PI * 2

/** Age within the synodic month, 0 (new) .. just under SYNODIC_MONTH_DAYS
 *  (the next new moon). */
function moonAge(date: Date): number {
  const days = (date.getTime() - KNOWN_NEW_MOON_MS) / MS_PER_DAY
  const age = days % SYNODIC_MONTH_DAYS
  return age < 0 ? age + SYNODIC_MONTH_DAYS : age
}

export function moonFor(date: Date): Moon {
  const age = moonAge(date)
  const theta = (age / SYNODIC_MONTH_DAYS) * TAU // 0 at new, PI at full, TAU back to new

  // Standard approximation: illuminated fraction is (1 - cos theta) / 2 —
  // 0 at new (theta = 0), 1 at full (theta = PI). Its own derivative with
  // respect to theta is (sin theta) / 2, which is exactly the signed
  // waxing/waning term below: positive for the first half of the month
  // (theta in (0, PI), illumination rising — waxing), negative for the
  // second half (waning), and zero at both new and full, where the
  // fraction is at a turning point and there is no growth direction to
  // speak of. Reusing sin/cos already needed for illuminated rather than
  // introducing a second formula is also what keeps the two verifiably
  // consistent with each other, not just each independently plausible.
  const illuminated = (1 - Math.cos(theta)) / 2
  const waxing = Math.sin(theta)

  // The moon's own hour of transit, stylised from phase alone: new moon
  // transits at local noon (it is near the sun in the sky), full moon at
  // local midnight (opposite the sun), quarters near sunset and sunrise —
  // the same 24-hour drift a real moon's elongation from the sun produces
  // over one month, four times faster than the sun's own daily transit.
  const transitHour = (12 + 24 * (age / SYNODIC_MONTH_DAYS)) % 24

  const rawHour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  // Shortest signed distance from the transit hour, wrapped into [-12, 12]
  // so a transit just before or after midnight is not treated as 20+ hours
  // away in the wrong direction.
  const hourDiff = ((rawHour - transitHour + 36) % 24) - 12
  const hourAngle = (hourDiff / 24) * TAU
  // cos peaks at the transit and crosses zero six hours either side — a
  // stylised horizon, the same half-the-day-up shape the real moon (and
  // sky.ts's own sun) roughly has. Clamped rather than left negative: this
  // file has no notion of "how far below the horizon", only "not up".
  const presence = Math.max(0, Math.cos(hourAngle))

  return { illuminated, waxing, presence }
}

const DEG = Math.PI / 180
const toRadians = (deg: number): number => deg * DEG
const toDegrees = (rad: number): number => rad / DEG
const norm360 = (deg: number): number => ((deg % 360) + 360) % 360

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0)
const daysSinceJ2000 = (date: Date): number => (date.getTime() - J2000_MS) / MS_PER_DAY

/**
 * The moon's ecliptic longitude, in degrees — Meeus's low-precision lunar
 * series (*Astronomical Algorithms*, ch. 47), leading terms only: the mean
 * longitude `L`, mean anomaly `M`, and the equation-of-center term
 * `6.289°·sin(M)` (the series' dominant term, roughly 5x any other single
 * one), plus the next nine terms in decreasing amplitude down to 0.031°.
 * `D` (elongation from the sun) and `Msun` (the sun's own mean anomaly) come
 * from `sky.ts`'s already-verified solar geometry rather than a second,
 * independently transcribed copy of it.
 *
 * **Mine, disclosed plainly**: entry 97 asks for "Meeus's low-precision
 * method (~60 lines)", which — full periodic table included — runs to
 * several hundred terms in the original; what ships here is the truncation
 * every hobbyist implementation of "low precision" lunar position actually
 * means by that phrase, verified the only way possible without a live
 * almanac: against real astronomical identities that must hold regardless
 * of which correct reference epoch is used (`scripts/probe-moon.ts`'s own
 * "at the reference new moon, sun and moon read the same altitude" and
 * "quarter/half/full synodic-month marks read as quarter/full elongation"
 * checks) rather than against a specific almanac's minute-of-moonrise,
 * which was not reachable from here to check against.
 */
function moonEclipticLongitudeDeg(date: Date): number {
  const d = daysSinceJ2000(date)
  const L = norm360(218.316 + 13.176396 * d)
  const M = norm360(134.963 + 13.064993 * d)
  const sunLon = sunEclipticLongitudeDeg(date)
  const D = norm360(L - sunLon)
  const Msun = norm360(357.529 + 0.98560028 * d)

  const lon =
    L +
    6.289 * Math.sin(toRadians(M)) -
    1.274 * Math.sin(toRadians(2 * D - M)) +
    0.658 * Math.sin(toRadians(2 * D)) -
    0.186 * Math.sin(toRadians(Msun)) -
    0.059 * Math.sin(toRadians(2 * D - 2 * M)) -
    0.057 * Math.sin(toRadians(2 * D - Msun - M)) +
    0.053 * Math.sin(toRadians(2 * D + M)) +
    0.046 * Math.sin(toRadians(2 * D - Msun)) +
    0.041 * Math.sin(toRadians(M - Msun)) -
    0.035 * Math.sin(toRadians(D)) -
    0.031 * Math.sin(toRadians(M + Msun))
  return norm360(lon)
}

/** The moon's ecliptic latitude, in degrees — same series, leading term
 *  (`5.128°·sin(F)`, `F` the argument of latitude) plus the next three.
 *  Bounded within about ±5.3° across a full year by construction (the
 *  lunar orbit's own ~5.145° inclination, plus these terms' own small
 *  excursion beyond it) — `probe-moon.ts` checks this holds. */
function moonEclipticLatitudeDeg(date: Date): number {
  const d = daysSinceJ2000(date)
  const M = norm360(134.963 + 13.064993 * d)
  const F = norm360(93.272 + 13.22935 * d)
  const L = norm360(218.316 + 13.176396 * d)
  const D = norm360(L - sunEclipticLongitudeDeg(date))
  return (
    5.128 * Math.sin(toRadians(F)) +
    0.281 * Math.sin(toRadians(M + F)) +
    0.278 * Math.sin(toRadians(M - F)) +
    0.173 * Math.sin(toRadians(2 * D - F))
  )
}

/**
 * Moon altitude above the horizon, in degrees, at a given instant and
 * location — ecliptic longitude/latitude above, converted to right
 * ascension/declination via the obliquity of the ecliptic, then to
 * altitude via Greenwich Mean Sidereal Time and the standard
 * spherical-triangle formula, the same final step `sky.ts`'s
 * `solarAltitudeDeg` uses for the sun. Exported so `probe-moon.ts` can
 * check it directly, per entry 97's own "probeable headless".
 */
export function moonAltitudeDeg(date: Date, location: GeoLocation): number {
  const d = daysSinceJ2000(date)
  const eclLonR = toRadians(moonEclipticLongitudeDeg(date))
  const eclLatR = toRadians(moonEclipticLatitudeDeg(date))
  // Mean obliquity of the ecliptic, degrees — drifts about 0.0130°/century;
  // linear in `d` is indistinguishable from the fuller series at this
  // app's precision, and it removes the century/Julian-Day-epoch machinery
  // sky.ts's own `sunGeometry` uses for the sun's own tighter target.
  const obliquityR = toRadians(23.4393 - 3.563e-7 * d)

  const ra = Math.atan2(
    Math.sin(eclLonR) * Math.cos(obliquityR) - Math.tan(eclLatR) * Math.sin(obliquityR),
    Math.cos(eclLonR),
  )
  const dec = Math.asin(Math.sin(eclLatR) * Math.cos(obliquityR) + Math.cos(eclLatR) * Math.sin(obliquityR) * Math.sin(eclLonR))

  const gmstDeg = norm360(280.46061837 + 360.98564736629 * d)
  const lstDeg = norm360(gmstDeg + location.longitude)
  const hourAngleDeg = ((lstDeg - toDegrees(ra) + 180) % 360) - 180

  const latR = toRadians(location.latitude)
  const haR = toRadians(hourAngleDeg)
  const sinAltitude = Math.sin(latR) * Math.sin(dec) + Math.cos(latR) * Math.cos(dec) * Math.cos(haR)
  return toDegrees(Math.asin(Math.max(-1, Math.min(1, sinAltitude))))
}

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

/** A couple of degrees either side of the geometric horizon — the moon's
 *  own apparent diameter is about half a degree, so this is barely wider
 *  than the moon itself and exists only to avoid a one-frame snap exactly
 *  at altitude zero, not to model any real atmospheric effect the way
 *  `sky.ts`'s civil-twilight band does for the sun. **Mine**: entry 97
 *  doesn't pin a transition width for the moon. */
const MOON_HORIZON_BAND_DEG = 2

/**
 * `moonFor`'s real-position counterpart — docs/todo.md entry 97. Same
 * `Moon` shape, so `scene.ts` and every reader downstream (reach, life,
 * cadence) are unchanged by which one fed them; illuminated and waxing come
 * from the real elongation between the moon's and sun's ecliptic
 * longitudes rather than the synodic-month clock `moonFor` uses, and
 * presence comes from genuine altitude rather than the stylised transit
 * proxy — the "upgrade the moon proxy" half of the entry's own Decided.
 */
export function moonForLocation(date: Date, location: GeoLocation): Moon {
  const sunLon = sunEclipticLongitudeDeg(date)
  const moonLon = moonEclipticLongitudeDeg(date)
  const elongationRad = toRadians(norm360(moonLon - sunLon))

  const illuminated = (1 - Math.cos(elongationRad)) / 2
  const waxing = Math.sin(elongationRad)

  const altitude = moonAltitudeDeg(date, location)
  const presence = smoothstep((altitude + MOON_HORIZON_BAND_DEG) / (2 * MOON_HORIZON_BAND_DEG))

  return { illuminated, waxing, presence }
}
