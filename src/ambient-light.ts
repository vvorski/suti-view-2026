/**
 * The room's real light — docs/todo.md entry 98, generalising entry 23's
 * camera-only exposure envelope to the far more common case of no camera
 * at all: `scene.ts:786`'s `exposureEnvelope` already answers the room's
 * brightness while passthrough is on; this file is the same answer for
 * everyone else.
 *
 * `AmbientLightSensor` is the Generic Sensor API. Chrome on Android
 * implements it; Safari and iOS do not implement it at all — the same
 * footing the Vibration API was on before it was abandoned (`haptics.ts`:
 * "a bonus on one platform, absent on the other, and nothing may be built
 * to depend on it"). Nothing here may be depended on: the picture stays
 * complete and correct with this sensor entirely absent, which on iOS it
 * always is.
 *
 * The failure shape is different from `requestMotionAccess`'s, though the
 * spirit — refusal resolves to something a caller can use without a branch
 * for "did it work" — is the same. There is no separate "ask" step to
 * await: the constructor itself throws on an unsupported browser and on a
 * permissions-policy refusal, so the whole request is try/catch around
 * construction plus `start()`, not a promise waiting on a user's answer to
 * a dialog. A refusal that arrives later — the `error` event, which can
 * fire after `start()` has already succeeded — is handled the same way as
 * never having a reading at all: `lux()` simply keeps returning whatever
 * it last had (`null`, if no reading ever arrived), and every caller
 * already treats `null` as "no data available", not as a special case.
 */

export interface AmbientLight {
  /** Latest reading in lux, or `null` before the first one arrives — or
   *  forever, if the sensor errors before ever producing one. */
  lux(): number | null
  close(): void
}

/** The shape TypeScript's own DOM lib doesn't carry: the Generic Sensor
 *  API is too new, and too Chrome-only, to be in `lib.dom.d.ts`. Declared
 *  locally rather than globally — this is the one file that touches it. */
interface AmbientLightSensorLike {
  illuminance: number
  addEventListener(type: 'reading' | 'error', listener: () => void): void
  start(): void
  stop(): void
}

export async function requestAmbientLight(): Promise<AmbientLight | null> {
  if (typeof window === 'undefined' || !('AmbientLightSensor' in window)) return null

  const Ctor = (window as unknown as { AmbientLightSensor: new (opts?: { frequency?: number }) => AmbientLightSensorLike })
    .AmbientLightSensor

  let sensor: AmbientLightSensorLike
  try {
    // ~2Hz — plenty for a reading that only ever feeds a multi-second
    // envelope downstream (`scene.ts`'s own `exposureEnvelope`), and
    // gentler on battery than the sensor's own default frequency.
    sensor = new Ctor({ frequency: 2 })
  } catch {
    // Unsupported, or a permissions-policy refusal — Decided's own words:
    // "the constructor throws on unsupported and on policy refusal."
    return null
  }

  let currentLux: number | null = null
  sensor.addEventListener('reading', () => {
    currentLux = sensor.illuminance
  })
  // No handling beyond existing, deliberately: a refusal or hardware fault
  // arriving here just means `currentLux` stops updating (or never starts),
  // which every caller already reads as "no data" — see this file's own
  // header for why that is enough.
  sensor.addEventListener('error', () => {})

  try {
    sensor.start()
  } catch {
    return null
  }

  return {
    lux: () => currentLux,
    close: () => sensor.stop(),
  }
}

/** Below this, treated as dark enough that the picture should ease rather
 *  than assert — moonlight and unlit rooms both live down here. **Mine**. */
const LUX_FLOOR = 1
/** An ordinary lit room — ceiling lights, an evening indoors. The pivot
 *  point: this maps to exactly 0.5, the same "unchanged" value entry 23's
 *  own camera-luminance mapping already treats as neutral. **Mine**, from
 *  common indoor-lighting figures (typical living-room lighting sits in
 *  the low hundreds of lux). */
const LUX_ORDINARY_ROOM = 150
/** Bright daylight — direct sun or a sunlit window. Above this, the
 *  mapping is already at its ceiling. **Mine**. */
const LUX_BRIGHT_DAYLIGHT = 10_000

/**
 * Maps a lux reading onto the same 0-1 "pseudo-luminance" scale entry 23's
 * camera sampling already produces (0.5 the neutral, unchanged reading),
 * so both sources can feed the identical `exposureEnvelope` and the
 * identical `0.85 + x * 0.3` formula in `scene.ts` — one mapping to
 * exposure, not two independently tuned ones.
 *
 * Lux is "wildly nonlinear" (Decided's own words: moonlight ~1, a lit room
 * ~100, daylight ~10,000+) — spanning four orders of magnitude — so this
 * is piecewise-linear in `log10(lux)`, not in lux itself: linear-in-lux
 * would have almost the entire domain (everything short of direct
 * sunlight) crushed into the first percent of the range. Two segments
 * rather than one so the pivot lands exactly on 0.5 at an ordinary room's
 * own reading, matching the camera mapping's own neutral point, rather
 * than at whatever value a single log-linear span through the extremes
 * happens to produce there.
 */
export function luminanceFromLux(lux: number): number {
  const clampedLux = Math.max(LUX_FLOOR, lux)
  const logLux = Math.log10(clampedLux)
  const logFloor = Math.log10(LUX_FLOOR)
  const logMid = Math.log10(LUX_ORDINARY_ROOM)
  const logCeiling = Math.log10(LUX_BRIGHT_DAYLIGHT)

  if (logLux <= logMid) {
    return 0.5 * Math.max(0, (logLux - logFloor) / (logMid - logFloor))
  }
  return 0.5 + 0.5 * Math.min(1, (logLux - logMid) / (logCeiling - logMid))
}
