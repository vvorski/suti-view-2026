/**
 * Offline check of the RGB channel slip (docs/todo.md entry 76, given its
 * own held direction by entry 104): does the magnitude spring stay silent
 * at rest, does it genuinely overshoot and ring back rather than merely
 * decay, does it reach but never exceed its cap under a hard shake, does it
 * settle back toward zero across every handling case `probe-shake.ts`
 * already established, and — entry 104's own acceptance test — does the
 * held direction survive a single decay with zero sign reversals, unlike
 * the tumble's own offset spring it used to be read from.
 *
 * Modelled on `probe-motion-bias.ts` for the pure-function checks, and reuses
 * `probe-shake.ts`'s own `still()`/`shaking()` driving functions (kept in
 * lockstep by eye, the same precedent `probe-nudge.ts` and `probe-tap.ts`
 * already set for local test helpers that aren't meant to be exported from a
 * production script) to feed real `Tumble` output — `disturb` and, since
 * entry 104, the raw `accelX`/`accelY` behind it — through `updateRgbSlip`
 * rather than inventing a second synthetic shape.
 *
 * Sections 1-3 drive `updateRgbSlip` directly with a fixed, arbitrary
 * accelX/accelY (1, 0) — they exist to check the magnitude spring alone,
 * which never reads direction, so any non-degenerate direction does. Only
 * section 5 needs a real `Tumble` to drive genuine accelerometer samples.
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

/** Magnitude of the uv offset `updateRgbSlip` returns — sections 1-3 only
 *  ever check the magnitude spring, never the direction. */
function len(off: { x: number; y: number }): number {
  return Math.hypot(off.x, off.y)
}

// --- 1. A still phone produces no slip at all, ever ------------------------

{
  const state = createRgbSlipState()
  let worst = 0
  const dt = 1 / 60
  for (let i = 0; i < 300; i++) worst = Math.max(worst, len(updateRgbSlip(state, dt, 0, 1, 0, 0)))
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
    updateRgbSlip(state, dt, disturb, 1, 0, 0)
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
  // What "settles" means had to be restated for docs/todo.md entry 111's
  // response curve, and the restatement is the honest one rather than a
  // loosened threshold. This section feeds a *pure exponential* disturb that
  // approaches zero without ever arriving; `pow(x, 0.6)` decays at 0.6 of
  // that rate, so after 8s the spring's own target is still 0.00105 and the
  // spring is sitting on it correctly. Nothing is ringing. The old `< 1e-4`
  // was measuring the target's tail, not the spring's behaviour, and it only
  // ever passed because a linear target decayed faster.
  //
  // Two claims replace it. The spring has converged on whatever it is
  // chasing — that is the property this section exists to prove — and the
  // residue is invisible: 0.02px of separation on a 1080px phone. The real
  // signal does reach exactly zero, because `shake.ts`'s `FLOOR` subtracts
  // before clamping, which is why every row of the handling table below
  // prints a rest of 0.000000 against real `Tumble` output.
  const finalTarget = Math.pow(disturb, 0.6)
  check(
    'the ring converges onto its target rather than ringing on',
    Math.abs(state.amount - finalTarget) < 1e-4,
    `amount ${state.amount.toExponential(3)} vs target ${finalTarget.toExponential(3)}`,
  )
  check(
    'and what is left is invisible — under a tenth of a pixel on a 1080px phone',
    2 * state.amount * MAX_SLIP * 1080 < 0.1,
    `${(2 * state.amount * MAX_SLIP * 1080).toFixed(3)}px`,
  )
}

// --- 3. A sustained hard disturbance reaches the cap, and the resulting uv
//        offset never exceeds MAX_SLIP under any input --------------------

{
  const state = createRgbSlipState()
  const dt = 1 / 60
  let worst = 0
  let reachedCap = false
  for (let i = 0; i < 2 * 60; i++) {
    const off = updateRgbSlip(state, dt, 1, 1, 0, 0)
    worst = Math.max(worst, len(off))
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

// docs/todo.md entry 111 — the table is printed at three busyness levels
// rather than one, because the whole of that entry's second half is a claim
// about what busyness does to this table and a single column cannot show it.
// `busyness` is passed directly rather than driven through `Tumble`'s own
// 25-second EMA: reaching a genuine sqrt(calm) of 1.0 would need minutes of
// synthetic violence per row, and what is under test here is `rgb-slip.ts`'s
// use of the number, not `shake.ts`'s production of it (which is entry 88's
// and `probe-shake.ts`'s, and still passes unchanged).
const BUSYNESS_LEVELS = [0, 0.5, 1]

/** What every row is measured against at each level — MAX_SLIP stretched by
 *  exactly the formula rgb-slip.ts applies. Recomputed here from MAX_SLIP
 *  rather than hard-coded, so raising the cap again cannot leave the probe
 *  asserting yesterday's number. */
const capAt = (busyness: number): number => MAX_SLIP + busyness * 0.010

const peaks = new Map<string, number[]>()

for (const busyness of BUSYNESS_LEVELS) {
  const cap = capAt(busyness)
  console.log(
    `\nHandling table at busyness ${busyness.toFixed(1)} (cap ${cap.toFixed(3)} uv, ${(2 * cap * 1080).toFixed(1)}px total on a 1080px phone) — peak slip (uv) and rest slip after settling:\n`,
  )
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
      peak = Math.max(peak, len(updateRgbSlip(slip, dt, s.disturb, s.accelX, s.accelY, busyness)))
      t += dt
    }
    for (let i = 0; i < settle * 60; i++) {
      tumble.sample(still(), dt)
      const s = tumble.advance(dt)
      peak = Math.max(peak, len(updateRgbSlip(slip, dt, s.disturb, s.accelX, s.accelY, busyness)))
    }

    const rest = slip.amount * cap
    console.log(`  ${name.padEnd(38)} peak ${peak.toFixed(5)}  rest ${rest.toFixed(6)}`)
    check(`${name} @ ${busyness}: never exceeds the cap`, peak <= cap + 1e-9, `peak ${peak} vs cap ${cap}`)
    check(`${name} @ ${busyness}: settles back to (near) zero`, rest < cap * 0.01, `rest ${rest}`)
    if (!peaks.has(name)) peaks.set(name, [])
    peaks.get(name)!.push(peak)
  }
}

// Entry 111's own acceptance figures. The three rows it names are the ones
// ordinary handling actually produces — the entry's whole complaint is that
// these, not the violent cases, are what "doesn't appear strong" means — and
// the figures are what entry 104's build printed for them.
{
  const BEFORE: Record<string, number> = {
    'a nudge (8 m/s², 1 cycle)': 0.00307,
    'a jolt (10 m/s², half cycle)': 0.00368,
    'sustained low agitation (5 m/s², 2.5 Hz)': 0.00171,
  }
  for (const [name, before] of Object.entries(BEFORE)) {
    const now = peaks.get(name)![0]
    check(
      `${name}: at least 1.8x its pre-entry-111 peak, at rest-level busyness`,
      now >= before * 1.8,
      `${before.toFixed(5)} -> ${now.toFixed(5)} (${(now / before).toFixed(2)}x)`,
    )
  }
  // The floor is the other half of the claim, and the more important half:
  // a curve that front-loads small disturbances must not turn a phone lying
  // on a table, or a hand's own tremor, into a visible effect. Checked at
  // every busyness level, since the cap stretching is exactly what would
  // make a leaked floor visible.
  for (const name of ['still on a table', 'held in a hand (0.4 m/s² tremor)']) {
    const all = peaks.get(name)!
    check(
      `${name}: still exactly zero at every busyness level`,
      all.every((p) => p === 0),
      all.map((p) => p.toFixed(5)).join(', '),
    )
  }
  // And the stretch itself: the same gesture must reach further on a phone
  // that has been moving. Compared on a case violent enough to be near the
  // cap, where the stretch is the whole difference.
  const violent = peaks.get('violent shake (45 m/s², 6 Hz)')!
  check(
    'the same violent shake reaches further at higher busyness',
    violent[1] > violent[0] * 1.3 && violent[2] > violent[1] * 1.2,
    violent.map((p) => p.toFixed(5)).join(' -> '),
  )
}

// --- 5. docs/todo.md entry 104's own acceptance test: a single decay
//        produces zero direction reversals, and the pixel measurement -----
//
// "Single hard knock" is a half-cycle impulse (t < 0.09s at 5.5Hz never
// crosses the sine's zero, so the raw accelerometer sample keeps one sign
// throughout) followed by 3s of stillness — physically one push, one
// direction. Entry 76's original design read direction from the tumble's
// own offset spring (uTumble.yz), which *rings* at its own ω ≈ 8.9 rad/s
// (≈ 1.4Hz) after any kick, single or not — several sign crossings inside
// this same 3s tail, which is the "roughly three or four reversals" Decided
// predicts for the pre-fix design. Entry 104's direction reads the raw
// sample instead, which has nothing left to ring: it eases toward the
// knock's own bearing while the knock lasts, then holds there — literally
// nothing left to flip once the knock ends and disturb starts decaying.
function countReversals(amp: number, hz = 5.5, knockSeconds = 0.09, seconds = 3): { reversals: number; peakLen: number } {
  const dt = 1 / 60
  const tumble = new Tumble()
  const slip = createRgbSlipState()
  for (let i = 0; i < 30; i++) tumble.sample(still(), dt)

  let reversals = 0
  let lastSign = 0
  let peakLen = 0
  let t = 0
  while (t < seconds) {
    tumble.sample(t < knockSeconds ? shaking(t, amp, hz) : still(), dt)
    const s = tumble.advance(dt)
    const off = updateRgbSlip(slip, dt, s.disturb, s.accelX, s.accelY, 0)
    const l = len(off)
    if (l > peakLen) peakLen = l
    // Read off the held direction itself, not the magnitude-scaled offset —
    // a reversal is a property of dirX/dirY, and reading it directly avoids
    // any ambiguity from off briefly rounding through ~0 as the magnitude
    // spring itself crosses a tiny value.
    if (l > 1e-7) {
      const sign = Math.sign(off.x) || Math.sign(off.y)
      if (sign !== 0) {
        if (lastSign !== 0 && sign !== lastSign) reversals++
        lastSign = sign
      }
    }
    t += dt
  }
  return { reversals, peakLen }
}

{
  const { reversals, peakLen } = countReversals(30)
  check(
    'a single knock produces a slip with zero direction reversals through its own decay',
    reversals === 0,
    `reversals=${reversals}, peak=${peakLen}`,
  )

  // The bug actually found building this entry, kept as an explicit
  // regression guard: the first attempt gated the held direction on a
  // *fixed* absolute deadzone, which caught this exact case's own gravity-
  // estimate rebound (shake.ts's GRAVITY_TAU, 0.5s) at 30 m/s² by luck of
  // the tuning, then failed it again at 60 m/s² and above — the rebound
  // scales with the kick, a fixed absolute threshold does not. PEAK_RATIO
  // (a threshold relative to the gesture's own recent peak) is what
  // actually fixes it, and this checks that fix at kick sizes well past
  // the handling table's own most violent case (45 m/s²).
  for (const amp of [45, 60, 90, 120]) {
    const r = countReversals(amp)
    check(`a ${amp} m/s² knock also produces zero reversals`, r.reversals === 0, `reversals=${r.reversals}, peak=${r.peakLen}`)
  }

  // The gap this section originally had, found by /ccc reviewing entry 104
  // after it shipped: every case above is a *single half-cycle* knock, which
  // by construction never reverses its own raw sample. Entry 104's Done-when
  // says "a synthetic shake", and a shake is an oscillation — measured on the
  // shipped build, two seconds of sustained shaking gave 19 reversals at 5Hz,
  // 11 at 3Hz and 7 at a 2Hz wave. The probe passed throughout, because it
  // never drove more than one half-cycle. These are the cases it was missing.
  for (const [label, amp, hz] of [
    ['a 5 Hz shake', 30, 5],
    ['a 3 Hz shake', 20, 3],
    ['a 2 Hz wave', 16, 2],
  ] as const) {
    const r = countReversals(amp, hz, 2.0, 2.0)
    check(
      `${label} sustained for two seconds produces zero direction reversals`,
      r.reversals === 0,
      `reversals=${r.reversals}`,
    )
  }

  // And the reverse case, restated. This was originally "a genuine second,
  // oppositely-aimed hit still counts as one reversal" — a guard that the
  // peak-ratio gate is not so aggressive it swallows real input, checked by
  // asserting the held direction flips. The guard is still wanted; the
  // assertion is no longer meaningful, because the held direction is now an
  // *axis* rather than an arrow. A hit aimed 180° away is the same line, the
  // shader draws it identically with red and blue swapped, and treating it as
  // opposing evidence is exactly the fault above. So the gate is checked the
  // way it can still be checked: a second hit aimed *across* the first must
  // move the axis, while one aimed back along it must not disturb it.
  {
    const dt = 1 / 60
    const tumble = new Tumble()
    const slip = createRgbSlipState()
    for (let i = 0; i < 30; i++) tumble.sample(still(), dt)
    // 0.09s along x, 1s of quiet, then 0.09s along y.
    let acrossMoved = false
    let firstAxis = { x: 0, y: 0 }
    let t = 0
    while (t < 2.0) {
      const along = t < 0.09
      const across = t >= 1.0 && t < 1.09
      const a = along || across ? Math.sin((t - (across ? 1.0 : 0)) * 5.5 * Math.PI * 2) * 30 : 0
      tumble.sample(
        along ? { x: a, y: -G, z: 0, spin: a * 0.1 }
          : across ? { x: 0, y: -G + a, z: 0, spin: a * 0.1 }
            : still(),
        dt,
      )
      const st = tumble.advance(dt)
      const off = updateRgbSlip(slip, dt, st.disturb, st.accelX, st.accelY, 0)
      // Sampled while the first knock is still live. By 0.9s `disturb` has
      // decayed to zero and `updateRgbSlip` returns an exact (0,0) — the held
      // axis survives (deliberately; it is never reset), but the *offset* it
      // scales does not, so a later sample point reads nothing at all.
      if (Math.abs(t - 0.05) < dt / 2) firstAxis = { x: off.x, y: off.y }
      if (t > 1.02 && len(off) > 1e-7 && len(firstAxis) > 1e-7) {
        const cos = Math.abs(
          (off.x * firstAxis.x + off.y * firstAxis.y) / (len(off) * len(firstAxis)),
        )
        if (cos < 0.9) acrossMoved = true
      }
      t += dt
    }
    check('a second hit aimed across the first re-aims the axis', acrossMoved, '')
  }

  {
    const r = countReversals(30, 5.5, 0.18)
    check(
      'a second hit aimed back along the first is the same axis, not a reversal',
      r.reversals === 0,
      `reversals=${r.reversals}`,
    )
  }

  // The measurement entry 104 added and entry 111 raised: the compositor's
  // uv spans 0-1 across the *full* frame width (not the aspect-normalised uv
  // the geometric shaders use), so on Decided's own 1080px worked example
  // 0.010 uv is 10.8px each way. Printed rather than argued about, because
  // this is the number a comment got wrong once already.
  const PHONE_WIDTH_PX = 1080
  const perChannelPx = MAX_SLIP * PHONE_WIDTH_PX
  const totalSeparationPx = 2 * perChannelPx
  console.log(
    `\nAt MAX_SLIP on a ${PHONE_WIDTH_PX}px-wide phone: ${perChannelPx.toFixed(1)}px per channel, ${totalSeparationPx.toFixed(1)}px total R-to-B separation.`,
  )
  for (const busyness of [0, 0.5, 1]) {
    const px = 2 * capAt(busyness) * PHONE_WIDTH_PX
    console.log(`  busyness ${busyness.toFixed(1)}: cap ${capAt(busyness).toFixed(3)} uv, ${px.toFixed(1)}px total`)
  }
  check(
    'the measured separation at rest is 21.6px — entry 111\'s own figure',
    Math.abs(totalSeparationPx - 21.6) < 0.5,
    `${totalSeparationPx.toFixed(2)}px`,
  )
  check(
    'and 43.2px at full busyness, the doubling entry 111 asks for',
    Math.abs(2 * capAt(1) * PHONE_WIDTH_PX - 43.2) < 0.5,
    `${(2 * capAt(1) * PHONE_WIDTH_PX).toFixed(2)}px`,
  )
}

console.log(failures === 0 ? `\nall checks passed` : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
