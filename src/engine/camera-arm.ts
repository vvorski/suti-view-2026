/**
 * How long armed camera mode stays armed — docs/todo.md entry 109.
 *
 * Entry 87 timed this with a wall clock (10s, then 60s at build 369). A
 * clock is a poor proxy for "this was forgotten": it expires on someone
 * framing a long exposure and stays armed for a phone that went into a
 * pocket at second three. The app already has better signals — entry 90's
 * posture classifier and `shake.ts`'s own `tilt` — so this reads those
 * instead of counting seconds since arming.
 *
 * `disturb` cannot be one of those signals despite being the obvious first
 * guess: `shake.ts`'s own FLOOR is chosen so a hand holding the phone
 * steady reads at or near zero, identical to the phone lying still on a
 * table. Composing a shot is usually *held steady on purpose* to avoid
 * blur, so a level-only reading would time out the exact moment it most
 * needs not to. `tilt` is what actually separates the two: it is
 * meaningful while the phone is perfectly still, reading near zero flat on
 * a table (face up or down) and away from zero at any angle a phone is
 * actually raised to. Posture's own `handled` catches the other case this
 * needs — a phone being carried, adjusted or waved while framing — which a
 * tilt reading alone would miss on a phone held flat, screen up.
 *
 * Pure state and a pure update function, same discipline as `posture.ts`
 * and `motion-bias.ts`: no DOM, no clock of its own, `now` arrives from the
 * caller in seconds.
 */

import type { Posture } from './posture.ts'
import { isFlatTilt } from './tilt.ts'

/** How long the phone can read as neither `handled` nor tilted before the
 *  arm expires. Decided's own figure — "a phone flat and still for fifteen
 *  seconds ... is someone who has moved on".
 *
 *  Never reached on a device with no motion data: it would fire fifteen
 *  seconds after arming, every time, having measured nothing — see
 *  `updateCameraArm`'s own note on entry 120. */
const QUIET_S = 15

/** The absolute ceiling regardless of posture — Decided's own figure,
 *  "five minutes, whatever the posture", so a phone propped up and
 *  vibrating on a table cannot hold the mode open indefinitely. It is also
 *  the *only* bound on a device that reports no motion at all (entry 120),
 *  which is the same clause read literally rather than a second rule. */
const CEILING_S = 5 * 60

export interface CameraArmState {
  armed: boolean
  /** Seconds-since-epoch (whatever clock `now` uses) the arm started. */
  armedAt: number
  /** When the phone was last neither `handled` nor tilted, or `null` while
   *  it currently reads as one of those — the quiet window only accumulates
   *  while it holds continuously. */
  quietSince: number | null
}

export function createCameraArmState(): CameraArmState {
  return { armed: false, armedAt: 0, quietSince: null }
}

/** Called once, from the same gesture that used to start the wall-clock
 *  timeout. */
export function armCamera(state: CameraArmState, now: number): void {
  state.armed = true
  state.armedAt = now
  state.quietSince = null
}

/** Called on every exit that isn't this module's own expiry — a photo
 *  taken, or the chip's manual exit — so a later `armCamera` starts clean. */
export function disarmCamera(state: CameraArmState): void {
  state.armed = false
  state.quietSince = null
}

export interface CameraArmReading {
  /** False the instant this call decides the arm should end. The caller is
   *  what actually leaves camera mode and fades the glyph; this module only
   *  reports the decision. */
  armed: boolean
}

/**
 * Call once per rendered frame while camera mode is armed. `tiltX`/`tiltY`
 * are `shake.ts`'s own uncapped `tilt()` pair.
 *
 * `motionAvailable` is `shake.ts`'s `hasMotionData()` — whether a
 * `devicemotion` sample has ever arrived in this session. Read live every
 * frame rather than captured when the mode was armed: the first sample can
 * land a few hundred milliseconds after the gate, and a per-frame reading
 * hands over to the posture path the moment data starts, with no state to
 * reset.
 *
 * **Why it has to be a parameter at all — docs/todo.md entry 120.** Entry
 * 109 replaced a wall clock with this posture-and-tilt machine, and on a
 * device that never delivers a `devicemotion` event posture sits at its
 * initial `'still'` and tilt is a frozen zero, so `aimed` is never true, the
 * quiet window opens the instant the mode is armed, and the arm dies after
 * `QUIET_S`. Measured: 15.02s on a device with no motion data against
 * 300.00s on one reporting it. On a desktop it was therefore *always*
 * fifteen seconds and could never be more, and on iOS the same whenever the
 * motion permission was declined. The failure is indistinguishable from the
 * feature being absent — frame a shot, and the tap that should take it plays
 * a ripple instead.
 *
 * It is a parameter rather than something this module reads for itself so
 * the module stays pure and the probe can set it directly, which is the same
 * discipline `posture.ts` and `motion-bias.ts` keep.
 */
export function updateCameraArm(
  state: CameraArmState,
  now: number,
  posture: Posture,
  tiltX: number,
  tiltY: number,
  motionAvailable: boolean,
): CameraArmReading {
  if (!state.armed) return { armed: false }

  // A device that has never reported motion cannot be asked whether it is
  // being held, so the quiet path is not merely unreliable here — it is
  // reading a constant. Only the ceiling applies, which is entry 109's own
  // "five minutes, whatever the posture": a device that cannot report a
  // posture is exactly the case that clause describes, and a second figure
  // for it would be a third clock on one mode. Five minutes armed on a
  // laptop is not a hazard — arming is deliberate, the glyph is showing, and
  // the next click on the picture exits.
  if (!motionAvailable) {
    // Left null rather than stamped, so that if data does start arriving the
    // quiet window begins from *then* rather than from a stale mark laid
    // down while the sensor was silent.
    state.quietSince = null
    if (now - state.armedAt >= CEILING_S) state.armed = false
    return { armed: state.armed }
  }

  // The tilt half of this was this module's own `AIM_TILT_MIN` until entry
  // 110 needed the identical question answered elsewhere. Same number, same
  // meaning, now named once in `tilt.ts`. Entry 131 removed the view that
  // was the second reader; the constant stays there, since bringing it back
  // here would only re-create the duplication that moved it.
  const aimed = posture === 'handled' || !isFlatTilt(tiltX, tiltY)

  if (aimed) {
    state.quietSince = null
  } else if (state.quietSince === null) {
    state.quietSince = now
  }

  const quietElapsed = state.quietSince === null ? 0 : now - state.quietSince
  const armedElapsed = now - state.armedAt

  if (quietElapsed >= QUIET_S || armedElapsed >= CEILING_S) {
    state.armed = false
    state.quietSince = null
  }

  return { armed: state.armed }
}
