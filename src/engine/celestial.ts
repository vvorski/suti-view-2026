/**
 * The two natural clocks, turned into a pace and a reach — docs/todo.md
 * entry 100.
 *
 * Sun → rate. Moon → step. One sentence, and it is the whole entry: the sun
 * never changes how big a step is, the moon never changes how often one
 * happens, and neither touches the axis entries 47/53/71/96/97 already gave
 * the other (sun owns colour, moon owns shape) — cadence is a third axis
 * neither had claimed.
 *
 * A pure function of a `Date` and an optional location, so a whole year (the
 * rate term's own two-peak daily curve) and a full synodic month (the
 * moon's) can both be scrubbed headless in `scripts/probe-celestial.ts`,
 * exactly like `sky.ts` and `moon.ts` already are.
 */

import { skyFor, type Sky } from '../sky.ts'
import { moonFor, moonForLocation, type Moon } from '../moon.ts'
import type { GeoLocation } from '../geo-location.ts'

export interface CelestialInfluence {
  /** Multiplies `director.ts`'s own posture-scaled hold time, as a
   *  divisor — bounded [0.75, 1.25]. 1 is today's unmodified pace (a flat
   *  sky, `d(daylight)/dt` at 0). Above 1 near a twilight (shortens the
   *  hold — more frequent changes, "restless"); below 1 in the small hours
   *  or the flat afternoon (lengthens it — "calm"). See `director.ts`'s
   *  own comment on `update()` for why this divides rather than
   *  multiplies the hold. */
  sunRate: number
  /** Multiplies the colour-acceptance distance floor and gates whether the
   *  view axis takes its bold suggestion or the nearer runner-up — centred
   *  on 1 (today's unmodified reach: no moon data, or an exact quarter
   *  moon, `illuminated === 0.5`). Above 1 toward a full moon that is up
   *  (holds out for a bigger colour jump, keeps the bold view); below 1
   *  toward a new moon that is up (accepts a smaller colour move, prefers
   *  the safer view). */
  moonReach: number
  /** A small, signed nudge on `colourFor`'s own ramp position — positive
   *  (waxing) leans up the ramp toward jade/cold, negative (waning) leans
   *  down toward ember. 0 at new or full moon (a turning point, no lean —
   *  same reason `Moon.waxing` itself is 0 there) and 0 whenever the moon
   *  is below the horizon. Bounded well inside one ramp segment's own
   *  width, so it can only ever tip a close call, never manufacture a
   *  jump the audio did not ask for. */
  moonRampBias: number
}

/** Bounds on the sun's own rate term — Decided's own "×0.75 at the flattest
 *  hour, ×1.25 at peak twilight". */
const SUN_RATE_MIN = 0.75
const SUN_RATE_MAX = 1.25

/** How far the moon's reach multiplier swings either side of 1, at full
 *  presence and a full new/full moon. **Mine**: large enough to meaningfully
 *  move whether a step clears `COLOUR_MIN_STEP` (0.18 in director.ts),
 *  nowhere near large enough to double or zero the requirement outright. */
const MOON_REACH_SWING = 0.35

/** How far the ramp tie-break can move `colourFor`'s own `t`, at full
 *  presence and a full waxing or waning swing — see `colourFor`'s own
 *  comment on why this stays well inside one ramp segment's width (1.0).
 *  **Mine**. */
const MOON_RAMP_TIE_BIAS = 0.06

/**
 * The daylight curve's own steepest point — found once, by scanning a full
 * day at one-minute resolution, rather than hand-deriving it from
 * `DAYLIGHT_ANCHORS`. Self-correcting if that table is ever retuned, where a
 * hardcoded constant would silently go stale the next time someone touched
 * `sky.ts` without knowing this file leaned on its exact shape. Computed
 * once at module load: `Sky.slope` is a pure function of the clock, so this
 * value never changes while the module is loaded.
 */
const PEAK_DAYLIGHT_SLOPE: number = (() => {
  let peak = 0
  for (let minute = 0; minute < 24 * 60; minute++) {
    const date = new Date(2026, 0, 1, Math.floor(minute / 60), minute % 60)
    peak = Math.max(peak, Math.abs(skyFor(date).slope))
  }
  return peak
})()

function sunRateFor(slope: number): number {
  const restlessness = PEAK_DAYLIGHT_SLOPE > 0 ? Math.min(1, Math.abs(slope) / PEAK_DAYLIGHT_SLOPE) : 0
  return SUN_RATE_MIN + (SUN_RATE_MAX - SUN_RATE_MIN) * restlessness
}

/** Centred on `illuminated === 0.5` (a quarter moon) rather than on 0 — new
 *  moon is a real, active "small steps" state in Decided's own words, not
 *  merely an absence of moon data. That absence is what `presence === 0`
 *  (the moon below the horizon, or no moon data at all) already means, and
 *  it is `presence`, not `illuminated`, that gates this to exactly 1. */
function moonReachFor(moon: Moon): number {
  return 1 + MOON_REACH_SWING * (2 * moon.illuminated - 1) * moon.presence
}

function moonRampBiasFor(moon: Moon): number {
  return MOON_RAMP_TIE_BIAS * moon.waxing * moon.presence
}

/**
 * The director's own celestial inputs for a given instant. `location` is
 * whatever `geo-location.ts` currently holds for the session — `null` falls
 * back to the clock-only `moonFor`, which already exists and already works
 * (entry 96), so nothing here can ever block on a permission that was
 * refused or never resolved.
 *
 * `slope` always comes from `skyFor`'s own clock-based curve, never from a
 * real solar-altitude derivative, even when `location` is available and
 * `scene.ts` is using `skyForLocation` for the picture's actual colour —
 * Decided's own reasoning: "the slope is still meaningful even when its
 * absolute hours are wrong for the latitude," so differentiating the NOAA
 * algorithm was not needed to satisfy it.
 */
export function celestialFor(date: Date, location: GeoLocation | null): CelestialInfluence {
  const sky: Sky = skyFor(date)
  const moon: Moon = location ? moonForLocation(date, location) : moonFor(date)

  return {
    sunRate: sunRateFor(sky.slope),
    moonReach: moonReachFor(moon),
    moonRampBias: moonRampBiasFor(moon),
  }
}

/** Today's unmodified behaviour on every axis — the sun at its own flat
 *  midpoint, the moon at zero. Exported as a named constant rather than a
 *  literal repeated at every call site that has no `Date`-driven frame to
 *  offer yet (`director.ts`'s own default parameter, principally). */
export const CELESTIAL_IDENTITY: CelestialInfluence = { sunRate: 1, moonReach: 1, moonRampBias: 0 }
