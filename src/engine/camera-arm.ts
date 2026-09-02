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

/** Below this, per-axis tilt magnitude (`shake.ts`'s own -1..1 = sin(angle))
 *  reads as "flat", not "held up to aim". About 11.5° of tilt on either
 *  axis. **Mine** — the entry says "flat" without a number. */
const AIM_TILT_MIN = 0.2

/** How long the phone can read as neither `handled` nor tilted before the
 *  arm expires. Decided's own figure — "a phone flat and still for fifteen
 *  seconds ... is someone who has moved on". */
const QUIET_S = 15

/** The absolute ceiling regardless of posture — Decided's own figure,
 *  "five minutes, whatever the posture", so a phone propped up and
 *  vibrating on a table cannot hold the mode open indefinitely. */
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

/** Call once per rendered frame while camera mode is armed. `tiltX`/`tiltY`
 *  are `shake.ts`'s own uncapped `tilt()` pair. */
export function updateCameraArm(
  state: CameraArmState,
  now: number,
  posture: Posture,
  tiltX: number,
  tiltY: number,
): CameraArmReading {
  if (!state.armed) return { armed: false }

  const aimed = posture === 'handled' || Math.hypot(tiltX, tiltY) >= AIM_TILT_MIN

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
