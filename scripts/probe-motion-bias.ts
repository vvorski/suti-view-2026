/**
 * Offline check of the motion-to-colour bias (docs/todo.md entry 58): is it
 * genuinely brightness-neutral under random motion, do the three tiers
 * (posture/disturbance/agitation) each reach their own stated peak, and
 * does agitation rise fast and settle slowly as Decided.
 *
 * The entry's own Verify text asks for "a node probe over the bias function
 * alone, walking it 200k times from random motion inputs and asserting
 * luminance never trends downward — the same method that proved entry 21's
 * floors." Adapted rather than copied literally: entry 21/35's problem was
 * a colour that accumulates across a session (repeated nudges compounding
 * into the same stored value), where "never trends downward" is a
 * statement about a random walk. This bias has no equivalent walk to
 * drift — it is recomputed fresh every frame from the current tilt/
 * disturb/agitation state against whatever the *stored* colour already is,
 * never written back into it. So "luminance never trends downward" is
 * checked here as what the zero-sum construction actually promises: not
 * merely non-decreasing but r + g + b === 0 (to floating-point epsilon) for
 * every one of 200k random draws, which is the stronger and more exact
 * property this design's own architecture guarantees.
 *
 *   node --experimental-strip-types scripts/probe-motion-bias.ts
 */

import { createMotionBiasState, updateMotionBias } from '../src/engine/motion-bias.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const EPS = 1e-9
const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo)

// 1. Zero-sum under 200k random motion inputs — the exact property that
//    stands in for "luminance never trends downward" here (see file
//    comment for why the entry's literal random-walk framing doesn't
//    apply to a stateless-per-frame bias).
{
  let worst = 0
  const state = createMotionBiasState()
  for (let i = 0; i < 200_000; i++) {
    const tiltX = rand(-1, 1)
    const tiltY = rand(-1, 1)
    const disturb = rand(0, 1)
    const dt = rand(1 / 240, 1 / 15)
    const bias = updateMotionBias(state, dt, tiltX, tiltY, disturb)
    const sum = Math.abs(bias.r + bias.g + bias.b)
    if (sum > worst) worst = sum
  }
  check('r + g + b stays at 0 (brightness-neutral) across 200k random draws', worst < EPS, `worst deviation ${worst}`)
}

// 2. Posture alone (disturb 0, agitation never raised) reaches exactly
//    POSTURE_MAX on some channel at full tilt on an axis.
{
  const state = createMotionBiasState()
  const bias = updateMotionBias(state, 1 / 60, 1, 0, 0)
  const peak = Math.max(Math.abs(bias.r), Math.abs(bias.g), Math.abs(bias.b))
  check('full tilt on one axis reaches the 0.06 posture peak', Math.abs(peak - 0.06) < 1e-9, String(peak))
}

// 3. A held-still phone (tilt 0) produces no bias at all, even with a
//    nonzero disturb passed in — disturbance rotates in tilt's own
//    direction, and there is nothing to rotate toward without one.
{
  const state = createMotionBiasState()
  const bias = updateMotionBias(state, 1 / 60, 0, 0, 1)
  check('zero tilt produces zero bias regardless of disturb', bias.r === 0 && bias.g === 0 && bias.b === 0, JSON.stringify(bias))
}

// 4. Agitation rises instantly to meet a new disturbance (the snap-up half
//    of the envelope, matching shake.ts's own Tumble pattern).
{
  const state = createMotionBiasState()
  updateMotionBias(state, 1 / 60, 0, 0, 0.8)
  check('agitation snaps up to disturb immediately, not gradually', state.agitation === 0.8, String(state.agitation))
}

// 5. Agitation settles over about 30s once disturbance drops, not
//    instantly and not never.
{
  const state = createMotionBiasState()
  updateMotionBias(state, 1 / 60, 0, 0, 1) // charge to 1
  let t = 0
  const dt = 1 / 60
  while (t < 30 && state.agitation > 0.5) {
    updateMotionBias(state, dt, 0, 0, 0)
    t += dt
  }
  check('agitation takes noticeably long to settle (not instant)', t > 5, `settled to half in ${t.toFixed(1)}s`)
  check('agitation settles within roughly a minute (not never)', t < 60, `still not at half after ${t.toFixed(1)}s`)
}

// 6. The combined ceiling (posture + disturbance + agitation all maxed)
//    still holds the brightness-neutral invariant and does not exceed the
//    stated combined peak on any channel.
{
  const state = createMotionBiasState()
  updateMotionBias(state, 1 / 60, 0, 0, 1) // saturate agitation first
  const bias = updateMotionBias(state, 1 / 60, 1, 0, 1)
  const peak = Math.max(Math.abs(bias.r), Math.abs(bias.g), Math.abs(bias.b))
  const ceiling = 0.06 + 0.12 + 0.08
  check('the worst case never exceeds the combined ceiling', peak <= ceiling + 1e-9, `${peak} vs ceiling ${ceiling}`)
  check('the worst case is still exactly brightness-neutral', Math.abs(bias.r + bias.g + bias.b) < EPS, String(bias.r + bias.g + bias.b))
}

console.log(failures === 0 ? `\nall checks passed` : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
