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
 * `presence`, is the hard one — a *true* altitude needs latitude, and
 * asking for it is forbidden (see sky.ts's own header: "disproportionate
 * for a lighting effect, and the wrong kind of ask here regardless" — the
 * same promise, the same refusal). So `presence` is a stylised,
 * location-free proxy: the moon transits (sits highest) at a time set by
 * its own phase alone — new near local noon, full near local midnight,
 * quarters near sunset and sunrise, the same relationship a real sky has
 * between the moon's elongation from the sun and its rising/transit time —
 * and presence is `cos` of the clock's hour-angle from that transit,
 * clamped at the horizon. It ignores latitude, so it is wrong about *how*
 * high and says nothing about a moon that never rises at extreme
 * latitudes — the same trade sky.ts makes for the sun, stated in the same
 * spirit, and for the same reason: this is written loudly so no future
 * session "fixes" it with a location prompt. That would not be an
 * improvement. It would be breaking the promise the gate makes.
 *
 * A pure function of a `Date`, so it can be scrubbed through a full
 * synodic month in a headless harness (`scripts/probe-moon.ts`) exactly
 * like `probe-sky.ts` already does for the sun.
 */

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
