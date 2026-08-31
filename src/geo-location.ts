/**
 * A one-time, coarse location — docs/todo.md entry 97.
 *
 * Overturns what sky.ts (entries 53, 71) and moon.ts (entry 96) used to
 * refuse, on a premise entry 97's own Decided calls out as wrong: asking
 * for location and location *leaving the device* are different things.
 * Solar and lunar altitude are pure local trigonometry from latitude,
 * longitude and time — nothing computed here is ever sent anywhere, put in
 * a URL, or stored at more than coarse precision. Same discipline
 * `share.ts` already states for its own sensor: "nothing leaves the device
 * on our say-so."
 *
 * Shaped like `shake.ts`'s `requestMotionAccess`: refusal, an absent API,
 * and a timeout all resolve to `null` rather than throwing — a missing
 * location is a missing feature, not a failure, and every caller already
 * has a clock-only fallback that works today.
 *
 * Not persisted. Once a browser has granted this origin location access,
 * asking again on a later visit is silent — no second prompt — so caching
 * across sessions in `prefs` would trade a `localStorage` write for a
 * saving that doesn't exist. **Mine**: entry 97's own hard-stop answer
 * ("prefs yes... persisted only if a re-ask is not cheaper") is
 * conditional, and a granted permission's own re-ask genuinely is cheap.
 */

export interface GeoLocation {
  latitude: number
  longitude: number
}

/** ~0.1°, ~11km — entry 97's own figure. Astronomy needs almost none of a
 *  real GPS fix's precision: a degree of latitude moves sunrise by a few
 *  minutes, and a precise coordinate is a privacy cost this file's whole
 *  reason for existing says to avoid paying. Rounded the instant a
 *  position arrives, before it touches anything else. */
function coarsen(value: number): number {
  return Math.round(value * 10) / 10
}

let cached: GeoLocation | null = null
// Asked at most once per page load, granted or not — a refusal is not
// retried every time the sky happens to sample again a second later.
let attempted = false

/**
 * Ask for location, once. Resolves the coarse coordinate on success, or
 * `null` on refusal, timeout, or an absent `navigator.geolocation` (SSR,
 * an embedded webview without the permission, or simply not implemented).
 * Every caller already has a clock-only fallback for the `null` case.
 */
export async function requestLocation(): Promise<GeoLocation | null> {
  if (cached) return cached
  if (attempted) return null
  attempted = true

  if (typeof navigator === 'undefined' || !navigator.geolocation) return null

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        // A hint, not a requirement — an hour-old fix is astronomically
        // indistinguishable from a fresh one for anything this app does
        // with it, and reusing one already cached by the OS avoids waking
        // the radio for a lighting effect.
        maximumAge: 3_600_000,
        timeout: 10_000,
      })
    })
    cached = { latitude: coarsen(position.coords.latitude), longitude: coarsen(position.coords.longitude) }
    return cached
  } catch {
    return null
  }
}
