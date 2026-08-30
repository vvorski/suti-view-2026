/**
 * Offline check of the RGB channel slip (docs/todo.md entry 76): does the
 * spring stay silent at rest, does it genuinely overshoot and ring back
 * rather than merely decay, does it reach but never exceed its cap under a
 * hard shake, and does it settle back toward zero across every handling
 * case `probe-shake.ts` already established.
 *
 * Modelled on `probe-motion-bias.ts` for the pure-function checks, and reuses
 * `probe-shake.ts`'s own `still()`/`shaking()` driving functions (kept in
 * lockstep by eye, the same precedent `probe-nudge.ts` and `probe-tap.ts`
 * already set for local test helpers that aren't meant to be exported from a
 * production script) to feed real `Tumble.disturb` output through
 * `updateRgbSlip` rather than inventing a second synthetic disturb shape.
 *
 * Deliberately narrower than `probe-shake.ts`'s full table: rows that only
 * vary the *sensor sample rate* against the same physical motion exist there
 * to test shake.ts's own detection thresholds, which `updateRgbSlip` never
 * sees — it only ever reads the single `disturb` number `advance()` already
 * produces. What is covered here is every *distinct physical scenario* in
 * that table once, at 60Hz.
 *
 *   node --experimental-strip-types scripts/probe-rgb-slip.ts
 */

import { createRgbSlipState, updateRgbSlip, MAX_SLIP } from '../src/engine/rgb-slip.ts'
import { Tumble, type MotionSample } from '../src/shake.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const G = 9.81
function still(): MotionSample {
  return { x: 0, y: -G, z: 0, spin: 0 }
}
function shaking(t: number, amp: number, hz: number): MotionSample {
  const a = Math.sin(t * hz * Math.PI * 2) * amp
  return { x: a, y: -G, z: 0, spin: a * 0.1 }
}

// --- 1. A still phone produces no slip at all, ever ------------------------

{
  const state = createRgbSlipState()
  let worst = 0
  const dt = 1 / 60
  for (let i = 0; i < 300; i++) worst = Math.max(worst, Math.abs(updateRgbSlip(state, dt, 0)))
  check('a still phone (disturb always 0) never produces any slip', worst === 0, `worst ${worst}`)
}

// --- 2. Genuine overshoot against a gradually-decaying disturbance --------
//
// `amount` is floored at 0 (a magnitude, not a signed displacement — see
// rgb-slip.ts's own comment on why), which rules out the classic "rings
// negative before settling" signature an unclamped spring would show for an
// instant on/off pulse. Overshoot is still observable and still means
// something real, though: fed a disturb signal that decays the way
// shake.ts's own `Tumble.disturb` actually does (a 0.7s time constant,
// never an instant drop to 0), an underdamped spring chasing that as a
// moving target *overtakes* it during the catch-up phase — `amount` reads
// briefly higher than the `disturb` it is chasing — before both settle to
// zero together. A critically- or over-damped spring would never overtake
// the target it is chasing; only an underdamped one rings past it.

{
  const state = createRgbSlipState()
  const dt = 1 / 60
  let disturb = 1
  let overtook = false
  let overtookBy = 0
  // Long enough that the disturb signal itself (decaying at the same 0.7s
  // constant shake.ts uses) has genuinely reached zero, not merely a value
  // this test's own threshold happened to be looser than.
  for (let i = 0; i < 8 * 60; i++) {
    updateRgbSlip(state, dt, disturb)
    if (state.amount > disturb) {
      overtook = true
      overtookBy = Math.max(overtookBy, state.amount - disturb)
    }
    disturb *= Math.exp(-dt / 0.7) // shake.ts's own disturb decay constant
  }
  check(
    'chasing a decaying disturb signal, the spring overtakes it — genuine overshoot',
    overtook,
    overtook ? `overtook by up to ${overtookBy.toFixed(4)}` : 'never exceeded the target it was chasing',
  )
  check('the ring settles back to (near) zero within 8s', state.amount < 1e-4, `settled at ${state.amount}`)
}

// --- 3. A sustained hard disturbance reaches the cap, and the resulting uv
//        offset never exceeds MAX_SLIP under any input --------------------

{
  const state = createRgbSlipState()
  const dt = 1 / 60
  let worst = 0
  let reachedCap = false
  for (let i = 0; i < 2 * 60; i++) {
    const off = updateRgbSlip(state, dt, 1)
    worst = Math.max(worst, off)
    if (state.amount >= 1 - 1e-6) reachedCap = true
  }
  check('a sustained hard disturbance reaches the cap', reachedCap, `amount reached ${state.amount}`)
  check('the uv offset never exceeds MAX_SLIP', worst <= MAX_SLIP + 1e-9, `worst ${worst} vs cap ${MAX_SLIP}`)
}

// --- 4. Every distinct handling case in probe-shake.ts's own table: the
//        spring never exceeds its cap and returns to (near) zero once the
//        motion stops --------------------------------------------------

interface Case {
  name: string
  seconds: number
  motion: (t: number) => MotionSample
  settle?: number
}

const cases: Case[] = [
  { name: 'still on a table', seconds: 4, motion: still },
  { name: 'held in a hand (0.4 m/s² tremor)', seconds: 4, motion: (t) => shaking(t, 0.4, 3) },
  { name: 'walking (3 m/s², 2 Hz)', seconds: 4, motion: (t) => shaking(t, 3, 2) },
  { name: 'a nudge (8 m/s², 1 cycle)', seconds: 0.4, motion: (t) => shaking(t, 8, 2.5) },
  { name: 'a jolt (10 m/s², half cycle)', seconds: 0.2, motion: (t) => shaking(t, 10, 2.5) },
  { name: 'deliberate shake (28 m/s², 4 Hz)', seconds: 1.2, motion: (t) => shaking(t, 28, 4) },
  { name: 'violent shake (45 m/s², 6 Hz)', seconds: 1.5, motion: (t) => shaking(t, 45, 6) },
  {
    name: 'single hard knock (30 m/s², one hit)',
    seconds: 3,
    motion: (t) => (t < 0.09 ? shaking(t, 30, 5.5) : still()),
  },
  {
    name: 'knock + rebound (30 m/s², two hits)',
    seconds: 3,
    motion: (t) => (t < 0.18 ? shaking(t, 30, 5.5) : still()),
  },
  { name: 'sustained low agitation (5 m/s², 2.5 Hz)', seconds: 3, motion: (t) => shaking(t, 5, 2.5) },
]

console.log('\nHandling table — peak slip (uv) and rest slip after settling:\n')
for (const { name, seconds, motion, settle = 4 } of cases) {
  const dt = 1 / 60
  const tumble = new Tumble()
  const slip = createRgbSlipState()

  // Half a second of stillness first, matching probe-shake.ts's own run() —
  // lets the gravity estimate settle before the motion under test starts.
  for (let i = 0; i < 30; i++) tumble.sample(still(), dt)

  let peak = 0
  let t = 0
  while (t < seconds) {
    tumble.sample(motion(t), dt)
    const s = tumble.advance(dt)
    peak = Math.max(peak, updateRgbSlip(slip, dt, s.disturb))
    t += dt
  }
  for (let i = 0; i < settle * 60; i++) {
    tumble.sample(still(), dt)
    const s = tumble.advance(dt)
    peak = Math.max(peak, updateRgbSlip(slip, dt, s.disturb))
  }

  const rest = slip.amount * MAX_SLIP
  console.log(`  ${name.padEnd(38)} peak ${peak.toFixed(5)}  rest ${rest.toFixed(6)}`)
  check(`${name}: never exceeds MAX_SLIP`, peak <= MAX_SLIP + 1e-9, `peak ${peak} vs cap ${MAX_SLIP}`)
  check(`${name}: settles back to (near) zero`, rest < MAX_SLIP * 0.01, `rest ${rest}`)
}

console.log(failures === 0 ? `\nall checks passed` : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
