/**
 * Headless exercise of the mouse-hover emitter — docs/todo.md entry 112.
 *
 * Everything worth asserting here is a question about *elapsed time*: does a
 * parked cursor go quiet after a second and a half, does leaving the window
 * stop it on the next frame, is a hover's ring genuinely quieter than the
 * briefest tap. None of those can be answered by moving a mouse and looking,
 * which is exactly why `hover.ts` is a pure module with the clock passed in.
 *
 * What this cannot answer, and does not pretend to: whether a cursor sweeping
 * across the canvas feels like playing with the thing. That is a desktop
 * browser, and for once the device the entry is about is the one sitting in
 * front of whoever reads this.
 *
 *   node --experimental-strip-types scripts/probe-hover.ts
 */

import {
  createHoverState,
  moveHover,
  hoverLeft,
  updateHover,
  HOVER_QUIET,
  HOVER_CHARGE_CAP,
  PRESENCE_TAU,
} from '../src/engine/hover.ts'
import { createEmitterState, updateEmitter } from '../src/engine/emitter.ts'
import { createRippleState } from '../src/engine/ripples.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const DT = 1 / 60

// --- 1. A cursor that enters and then never moves again -------------------
//
// The entry's own acceptance clause: "a hover that never moves after
// entering produces exactly one active period ending at 1.5s". Counted as
// transitions rather than sampled at a moment, so a flicker back to active
// would fail even if the endpoint happened to be right.
{
  const hover = createHoverState()
  let now = 0
  moveHover(hover, now, 0.1, 0.1)

  let periods = 0
  let wasActive = false
  let lastActiveAt = 0
  for (let i = 0; i < Math.round(5 / DT); i++) {
    now += DT
    const r = updateHover(hover, now)
    if (r.active && !wasActive) periods++
    if (r.active) lastActiveAt = now
    wasActive = r.active
  }
  check('a cursor that enters and parks has exactly one active period', periods === 1, `${periods} periods`)
  check(
    `and it ends at ${HOVER_QUIET}s, not before and not after`,
    Math.abs(lastActiveAt - HOVER_QUIET) < DT * 1.5,
    `last active at ${lastActiveAt.toFixed(3)}s`,
  )
}

// --- 2. Movement keeps it alive indefinitely ------------------------------
{
  const hover = createHoverState()
  let now = 0
  let inactiveFrames = 0
  for (let i = 0; i < Math.round(10 / DT); i++) {
    now += DT
    moveHover(hover, now, 0.1 + i * 0.001, 0.1)
    if (!updateHover(hover, now).active) inactiveFrames++
  }
  check('a continuously moving cursor never goes quiet', inactiveFrames === 0, `${inactiveFrames} inactive frames`)
}

// --- 3. Leaving the window stops it on the next frame ---------------------
//
// Regardless of how recently it moved — which is the whole difference
// between leaving and parking, and the reason they are two mechanisms.
{
  const hover = createHoverState()
  let now = 0
  moveHover(hover, now, 0.2, 0.2)
  now += DT
  check('moving, so active before leaving', updateHover(hover, now).active, 'was already inactive')
  hoverLeft(hover)
  now += DT
  check(
    'leaving the window stops it on the very next frame, however recently it moved',
    !updateHover(hover, now).active,
    'still active after hoverLeft',
  )
}

// --- 4. A hover is quieter than the briefest tap --------------------------
//
// The entry's own comparison, run through the real `updateEmitter` rather
// than asserted from the constants: a 0.1s finger tap against a hover of the
// same duration, both spawning into their own ripple state.
{
  const tapRipples = createRippleState()
  const tap = createEmitterState()
  let now = 0
  for (let i = 0; i < Math.round(0.1 / DT); i++) {
    now += DT
    updateEmitter(tap, tapRipples, now, true, 0, 0)
  }

  const hoverRipples = createRippleState()
  const hovered = createEmitterState()
  now = 0
  for (let i = 0; i < Math.round(0.1 / DT); i++) {
    now += DT
    updateEmitter(hovered, hoverRipples, now, true, 0, 0, 0, 0, { x: 0, y: 0 }, { x: 0.5, y: 0.5 }, HOVER_CHARGE_CAP)
  }

  check(
    "a hover's ring is strictly quieter than a 0.1s tap's",
    hovered.releaseCharge < tap.releaseCharge,
    `hover ${hovered.releaseCharge.toFixed(4)} vs tap ${tap.releaseCharge.toFixed(4)}`,
  )
  check(
    `and never exceeds the cap of ${HOVER_CHARGE_CAP}`,
    hovered.releaseCharge <= HOVER_CHARGE_CAP + 1e-9,
    String(hovered.releaseCharge),
  )
}

// --- 5. Speed still rides along, under the cap ----------------------------
//
// This is the clause the entry's own two Decided bullets pulled against — a
// hard clamp would have pinned every hover at exactly the cap and made "a
// fast sweep throws brighter rings" quietly false. Asserted, because the
// version that fails it looks identical from outside.
{
  const make = (speed: number): number => {
    const ripples = createRippleState()
    const e = createEmitterState()
    let now = 0
    for (let i = 0; i < Math.round(0.3 / DT); i++) {
      now += DT
      updateEmitter(e, ripples, now, true, 0, 0, speed, 0, { x: 0, y: 0 }, { x: 0.5, y: 0.5 }, HOVER_CHARGE_CAP)
    }
    return e.releaseCharge
  }
  const still = make(0)
  const swept = make(1.5)
  check('a swept cursor throws a brighter ring than a slow one', swept > still * 1.2, `${still.toFixed(4)} -> ${swept.toFixed(4)}`)
  check('and the swept one is still under the cap', swept <= HOVER_CHARGE_CAP + 1e-9, String(swept))
}

// --- 6. The afterlife runs rather than the emitter dying on the spot ------
//
// `lifeFor` had to be floored at 0 for this: a capped charge sits below
// CHARGE_FLOOR, which ran the life arithmetic negative and handed back an
// emitter the release branch read as already dead. That is a silent deletion
// of the behaviour the entry asks for by name, and this is the check that
// would have caught it.
{
  const ripples = createRippleState()
  const e = createEmitterState()
  let now = 0
  for (let i = 0; i < Math.round(0.5 / DT); i++) {
    now += DT
    updateEmitter(e, ripples, now, true, 0.1, 0.1, 0, 0, { x: 0, y: 0 }, { x: 0.5, y: 0.5 }, HOVER_CHARGE_CAP)
  }
  check('a hover emitter has a real afterlife to run down', e.life > 1, `life ${e.life.toFixed(3)}s`)

  // Now go inactive, as a parked or departed cursor does, and confirm the
  // life actually decays rather than being cut off.
  const atRelease = e.life
  for (let i = 0; i < Math.round(0.5 / DT); i++) {
    now += DT
    updateEmitter(e, ripples, now, false, 0, 0, 0, 0, { x: 0, y: 0 }, { x: 0.5, y: 0.5 }, HOVER_CHARGE_CAP)
  }
  check(
    'and it thins out over that life rather than stopping dead',
    e.life > 0 && e.life < atRelease,
    `${atRelease.toFixed(3)}s -> ${e.life.toFixed(3)}s`,
  )
}

// --- 7. A device that has never hovered is bit-identical ------------------
//
// The identity claim, and the one that matters most: a touch-only phone
// never fires a mouse pointermove, so this emitter is ticked inactive at
// zero life for the whole session. Compared against a state that is never
// ticked at all, field for field.
{
  const ripples = createRippleState()
  const untouched = createEmitterState()
  const ticked = createEmitterState()
  let now = 0
  for (let i = 0; i < Math.round(30 / DT); i++) {
    now += DT
    updateEmitter(ticked, ripples, now, false, 0, 0, 0, 0, { x: 0, y: 0 }, { x: 0.5, y: 0.5 }, HOVER_CHARGE_CAP)
  }
  const differing = (Object.keys(untouched) as (keyof typeof untouched)[]).filter(
    (k) => k !== 'lastTick' && untouched[k] !== ticked[k],
  )
  check(
    'thirty seconds of ticking an unused hover emitter changes nothing but its clock',
    differing.length === 0,
    differing.join(', '),
  )
  // Compared against a pristine RippleState rather than against zeros: the
  // slots are seeded to a birth time of -1000, not 0, so "no ripple" is
  // "identical to a state nothing has touched". Asserting zeros instead was
  // this probe's own first version, and it failed against perfectly correct
  // code — the kind of plausible-looking wrong answer that gets read as a
  // bug in the thing under test.
  const pristine = createRippleState()
  check(
    'and spawns no ripple at all',
    ripples.slots.every((v, i) => v === pristine.slots[i]) && ripples.touchCursor === pristine.touchCursor,
    'the ripple state moved',
  )

  const hover = createHoverState()
  check('a hover that never happened reports inactive', !updateHover(hover, 100).active, 'reported active')
}

// --- 8. The default chargeCap leaves the touch path exactly as it was -----
//
// Not a restatement of probe-emitter.ts: that file asserts the touch path is
// *correct*, this asserts the new parameter's default is *inert*, which is a
// different claim and the one a future edit to the cap could break.
{
  const run = (cap: number | undefined): number[] => {
    const ripples = createRippleState()
    const e = createEmitterState()
    let now = 0
    const trace: number[] = []
    for (let i = 0; i < Math.round(1 / DT); i++) {
      now += DT
      if (cap === undefined) updateEmitter(e, ripples, now, true, 0.1, 0.2, 0.4)
      else updateEmitter(e, ripples, now, true, 0.1, 0.2, 0.4, 0, { x: 0, y: 0 }, { x: 0.5, y: 0.5 }, cap)
      trace.push(e.releaseCharge, e.life)
    }
    return trace
  }
  const omitted = run(undefined)
  const explicit = run(1)
  check(
    'omitting chargeCap and passing 1 are the same gesture, frame for frame',
    omitted.every((v, i) => v === explicit[i]),
    'traces diverged',
  )
}

// --- 9. Presence, for the lattice's lens — docs/todo.md entry 114 ---------
//
// Its two acceptance figures land at exactly three time constants, where
// 1 - e^-3 is 0.9502 against a required 0.95 — a margin of two
// ten-thousandths. That is precisely the kind of number nobody should be
// re-deriving by hand later, so both ends are asserted here.
{
  const hover = createHoverState()
  let now = 0
  // One tick to seed lastUpdate, then the cursor arrives.
  updateHover(hover, now)
  let atArrival = 0
  for (let i = 0; i < Math.round(0.75 / DT); i++) {
    now += DT
    moveHover(hover, now, 0.1, 0.1)
    atArrival = updateHover(hover, now).presence
  }
  check(
    'presence passes 0.95 within 0.75s of the cursor arriving',
    atArrival >= 0.95,
    `${atArrival.toFixed(4)} after 0.75s (tau ${PRESENCE_TAU})`,
  )

  hoverLeft(hover)
  let atDeparture = 1
  for (let i = 0; i < Math.round(0.75 / DT); i++) {
    now += DT
    atDeparture = updateHover(hover, now).presence
  }
  check(
    'and falls below 0.05 within 0.75s of it leaving',
    atDeparture < 0.05,
    `${atDeparture.toFixed(4)} after 0.75s`,
  )
}

// The identity the lattice's lens rests on: a device that has never seen a
// mouse reports presence exactly 0, so `uv += (uv - P) * (PULL * 0 * lens)`
// is `uv + 0.0`, which is bit-identical rather than nearly so.
{
  const hover = createHoverState()
  let now = 0
  let worst = 0
  for (let i = 0; i < Math.round(30 / DT); i++) {
    now += DT
    worst = Math.max(worst, updateHover(hover, now).presence)
  }
  check('a cursor that never existed leaves presence at exactly 0', worst === 0, String(worst))
}

// Easing is frame-rate independent: the exact exponential factor composes,
// so a 30fps run and a 120fps run reach the same place. Without this the
// warp would arrive at different speeds on different machines.
{
  const at = (dt: number): number => {
    const hover = createHoverState()
    let now = 0
    updateHover(hover, now)
    for (let i = 0; i < Math.round(0.5 / dt); i++) {
      now += dt
      moveHover(hover, now, 0.1, 0.1)
      updateHover(hover, now)
    }
    return hover.presence
  }
  const slow = at(1 / 30)
  const fast = at(1 / 120)
  check(
    'presence eases at the same rate whatever the frame rate',
    Math.abs(slow - fast) < 1e-9,
    `${slow.toFixed(9)} at 30fps vs ${fast.toFixed(9)} at 120fps`,
  )
}

console.log(failures === 0 ? '\nall hover checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
