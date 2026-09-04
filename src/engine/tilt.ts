/**
 * What counts as "flat" — one notion of it, for everything that asks.
 *
 * `shake.ts`'s `tilt()` returns an in-plane pair, -1..1 per axis, which is
 * `sin(angle)` about each axis: `(0, 0)` lying flat on a table, unit length
 * held upright, and every angle between correct without a case for it. Two
 * features now need to ask that pair the same yes/no question — is this
 * phone lying down, or is it being held up:
 *
 * - `camera-arm.ts` uses it as "not being aimed", one half of the test that
 *   expires an armed camera (docs/todo.md entry 109);
 * - `sediment.ts` uses it as "nothing falls", the state where Strata's sand
 *   holds its pile and new grains hang as dust (entry 110).
 *
 * The threshold lived in `camera-arm.ts` while it had one reader. It has two
 * now, and the second arriving is what turns "a number one module happens to
 * use" into a notion the app has — so it is named here and read from here,
 * rather than copied and then drifting apart the first time either is tuned.
 *
 * Pure, no DOM, no clock: the same discipline as every other module here.
 */

/** Below this, in-plane tilt magnitude reads as flat rather than held up.
 *  About 11.5° — entry 109's own choice, made when this was the camera's
 *  aim threshold and kept unchanged by entry 110, which explicitly wanted
 *  the app to have one notion of flat rather than a second nearby number.
 *  Lower and a phone resting on a slightly uneven table reads as held;
 *  higher and a phone genuinely tipped up in a hand reads as put down. */
export const FLAT_TILT_MIN = 0.2

/** True when the phone is lying down rather than being held up. Takes
 *  `shake.ts`'s own uncapped `tilt()` pair. */
export function isFlatTilt(tiltX: number, tiltY: number): boolean {
  return Math.hypot(tiltX, tiltY) < FLAT_TILT_MIN
}
