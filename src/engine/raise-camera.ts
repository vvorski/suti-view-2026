/**
 * Whether a shake should bring the room in — docs/todo.md entry 121.
 *
 * Victor: *"press and shake should activate the AR camera mode — so adds to
 * the shake action."* The AR camera is read as the **passthrough layer** —
 * the live room behind the picture, `prefs.passthrough`, the `cam` band —
 * not entry 87's photo-taking camera mode, which is a different feature on a
 * different gesture. If that reading is wrong the whole entry is wrong, so it
 * is said here rather than left to be inferred.
 *
 * **Why a finger changes what a shake is allowed to do.** Entry 22 licensed
 * a shake to raise the camera and then hit a wall it recorded in its own
 * Decided: *"a `devicemotion` event carries no user activation, so
 * `getUserMedia` called from the shake path has no gesture behind it."*
 * Entry 73 narrowed it further after a frozen-camera report — raise only over
 * a stream already live and playing, because `play()` was refused essentially
 * every time it was reached that way.
 *
 * A finger on the glass is exactly what that wall was missing. `pointerdown`
 * grants transient user activation, and a shake is recognised 0.5–0.75s after
 * it starts (three reversals inside a 1.2s window, `shake.ts`), well within
 * any browser's activation window. So this is not a fourth exception to the
 * capture rule — it is the one case where the shake path *has* the gesture
 * the rule demands, which is why it may open the camera for the first time
 * and put the browser's own prompt on screen. The prompt is the consent
 * point, and the finger is why there is one to consent to.
 *
 * Pure and parameterised, like `camera-arm.ts` and `posture.ts`: the whole of
 * this entry's new logic is the condition, and a condition that can only be
 * exercised by shaking a phone will not be exercised.
 */

/** What the `cam` band reads after a press-and-shake opens the room. Over
 *  `CAMERA_ROLL_MAX` (0.6) and over the stored `prefs.passthrough`: entry 22
 *  capped the shuffle's own roll at 0.6 because "passthrough at 1 leaves the
 *  room and no visualiser", and 0.5 is unambiguously both room and picture.
 *  A fixed figure also means the gesture always does the same visible thing,
 *  which a rolled one would not. The `cam` band adjusts it afterwards as
 *  ever. **Mine.** */
export const PRESS_SHAKE_PASSTHROUGH = 0.5

export interface RaiseCameraInput {
  /** Whether a `strong` or `double` shake event landed this frame. Both
   *  count: the entry asks for the camera on a shake, and a double is the
   *  harder of the two to produce by accident. */
  shake: boolean
  /** At least one non-chip contact is on the picture — the same population
   *  the shuffle already excludes chips and fullscreen-retry contacts from. */
  fingersDown: boolean
  /** The HUD is open. The shuffle stands down here (entry 102) and so does
   *  this, for the same reason: the picture is behind a panel and a gesture
   *  aimed at the panel is not aimed at the picture. */
  panelOpen: boolean
  /** Entry 87's photo mode is armed. The passthrough level is borrowed for
   *  the duration of that mode, so it is not this gesture's to set —
   *  `maybeRollCamera` already declines for the same reason. */
  cameraMode: boolean
  /** The camera stream is already open and playing. */
  live: boolean
}

/**
 * Activate-only, and that is deliberate rather than an omission: a shake with
 * the room already in should still be a shuffle, and a thumb resting on the
 * glass during an ordinary shake must not switch the room *off* — which would
 * be the same "control lying about its state" fault entry 102 avoids.
 *
 * A live stream returns false because raising an already-open camera is
 * entry 22's own path and `maybeRollCamera` still owns it; this exists for
 * the case that one cannot serve, which is the camera that is not open yet.
 */
export function shouldRaiseCamera(i: RaiseCameraInput): boolean {
  return i.shake && i.fingersDown && !i.panelOpen && !i.cameraMode && !i.live
}
