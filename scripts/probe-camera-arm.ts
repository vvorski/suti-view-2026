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

/** `motionAt` is docs/todo.md entry 120's sixth argument — whether a
 *  `devicemotion` sample has ever arrived. A function of time rather than a
 *  flag, so a run can start with a silent sensor and have data begin
 *  part-way through, which is what a real iOS grant looks like. Defaults to
 *  "always reporting", so every case written before entry 120 keeps exactly
 *  the meaning it had. */
function run(
  seconds: number,
  tiltAt: (t: number) => { x: number; y: number },
  motionAt: (t: number) => boolean = () => true,
): Result {
  const state = createCameraArmState()
  armCamera(state, 0)
  let disarmedAt = -1
  let t = 0
  let armedAtEnd = true
  while (t < seconds) {
    const tilt = tiltAt(t)
    const reading = updateCameraArm(state, t, 'still', tilt.x, tilt.y, motionAt(t))
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

// docs/todo.md entry 120 — the case there was no case for, which is how a
// mode that always died in fifteen seconds on every desktop shipped and
// passed. Every existing case above supplies tilt readings; none asked what
// happens when the sensor never speaks at all.
console.log()
console.log('A device that never reports motion — the entry-120 case:\n')
{
  const silent = run(320, () => ({ x: 0, y: 0 }), () => false)
  check(
    'with no motion data, the arm survives to the five-minute ceiling',
    silent.disarmedAt >= 300 - DT && silent.disarmedAt < 300 + 1,
    `disarmed at ${silent.disarmedAt.toFixed(2)}s`,
  )
  // The regression this fixes, stated as its own assertion so the number
  // that was wrong is written down: it used to die at QUIET_S.
  check(
    'and specifically not at fifteen seconds, which is what it did before',
    silent.disarmedAt > 60,
    `disarmed at ${silent.disarmedAt.toFixed(2)}s`,
  )
}
{
  // The handover. A sensor that starts reporting part-way through must open
  // the quiet window from *then*, not from arming — otherwise a grant
  // arriving at 20s would expire the arm instantly on a phone already lying
  // flat, which is a different bug in the same place.
  const late = run(60, () => ({ x: 0, y: 0 }), (t) => t >= 20)
  check(
    'motion starting at 20s expires the arm at 35s, not at 20s',
    late.disarmedAt >= 35 - DT * 2 && late.disarmedAt < 35 + 1,
    `disarmed at ${late.disarmedAt.toFixed(2)}s`,
  )
}

console.log()
console.log(
  failures.length === 0
    ? 'PASS: the arm tracks tilt, expires after the quiet window, and respects the ceiling.'
    : `CHECK: ${failures.length} failure(s)`,
)
if (failures.length > 0) process.exitCode = 1
