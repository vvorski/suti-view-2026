/**
 * Headless exercise of the camera-arm state machine — docs/todo.md entry
 * 109, and the first probe camera mode has ever had (see the entry's own
 * "process finding": the mode lived in a `main.ts` closure with DOM handles
 * and `window.setTimeout`, and every fault in it had been found by a person
 * using the app).
 *
 * Covers the Done-when clauses that are properties of the state machine
 * itself: held-and-moving stays armed past the old 60s figure, going still
 * expires it after the quiet window, and the five-minute ceiling holds
 * regardless of posture. The other two Done-when clauses — the glyph's fade
 * being visible, and a photo still exiting immediately — are DOM and touch
 * dispatch respectively, outside what this module knows about; those are
 * the phone check this entry's own Verify names.
 *
 *   node --experimental-strip-types scripts/probe-camera-arm.ts
 */

import { createCameraArmState, armCamera, updateCameraArm } from '../src/engine/camera-arm.ts'

const HZ = 60
const DT = 1 / HZ

interface Result {
  /** Seconds after arming that the arm first read as disarmed, or -1 if it
   *  never did within the run. */
  disarmedAt: number
  /** True if the arm was still reading armed at the very end of the run. */
  armedAtEnd: boolean
}

function run(seconds: number, tiltAt: (t: number) => { x: number; y: number }): Result {
  const state = createCameraArmState()
  armCamera(state, 0)
  let disarmedAt = -1
  let t = 0
  let armedAtEnd = true
  while (t < seconds) {
    const tilt = tiltAt(t)
    const reading = updateCameraArm(state, t, 'still', tilt.x, tilt.y)
    if (!reading.armed && disarmedAt < 0) disarmedAt = t
    armedAtEnd = reading.armed
    t += DT
  }
  return { disarmedAt, armedAtEnd }
}

const failures: string[] = []
const check = (name: string, ok: boolean, detail: string): void => {
  if (!ok) failures.push(`${name} — ${detail}`)
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

console.log('Held up and moving stays armed past the old 60s figure:\n')

// A phone raised well past the flat threshold and never wavering — tilt
// alone, `posture` held at 'still' throughout, to isolate the tilt half of
// "handled or plainly being aimed" from the posture half (probe-posture.ts
// already covers posture's own classification).
const heldStill = run(90, () => ({ x: 0.5, y: 0 }))
check(
  'a phone tilted well past flat stays armed for the whole 90s run',
  heldStill.disarmedAt < 0 && heldStill.armedAtEnd,
  `disarmed at ${heldStill.disarmedAt}s`,
)

console.log('\nGoing still expires the arm after the quiet window:\n')

// Tilted (aimed) for the first 5s, then laid flat — tilt magnitude 0, the
// same reading a phone face-up or face-down on a table gives.
const goneFlat = run(40, (t) => (t < 5 ? { x: 0.5, y: 0 } : { x: 0, y: 0 }))
check(
  'expires between 15 and 16 quiet seconds after going flat, not immediately and not late',
  goneFlat.disarmedAt >= 5 + 15 && goneFlat.disarmedAt < 5 + 16,
  `disarmed at ${goneFlat.disarmedAt}s (armed at t=0, went flat at t=5)`,
)

// A momentary dip below the tilt threshold — one frame flat, then aimed
// again — must not start (or survive) a quiet window: only a *continuous*
// flat reading should count.
const flicker = run(30, (t) => {
  const inDip = t >= 10 && t < 10 + DT * 3
  return inDip ? { x: 0, y: 0 } : { x: 0.5, y: 0 }
})
check(
  'a three-frame dip below the tilt threshold does not expire the arm',
  flicker.disarmedAt < 0 && flicker.armedAtEnd,
  `disarmed at ${flicker.disarmedAt}s`,
)

console.log('\nThe five-minute ceiling holds regardless of posture:\n')

// Tilted (aimed) continuously for the entire run — the quiet path never
// engages, so only the absolute ceiling can end this one.
const ceiling = run(320, () => ({ x: 0.5, y: 0 }))
check(
  'a continuously aimed phone is disarmed by the five-minute ceiling, not held forever',
  ceiling.disarmedAt >= 300 - DT && ceiling.disarmedAt < 300 + 1,
  `disarmed at ${ceiling.disarmedAt}s`,
)

console.log()
console.log(
  failures.length === 0
    ? 'PASS: the arm tracks tilt, expires after the quiet window, and respects the ceiling.'
    : `CHECK: ${failures.length} failure(s)`,
)
if (failures.length > 0) process.exitCode = 1
