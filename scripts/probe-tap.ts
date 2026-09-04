/**
 * Offline check of the single/double-tap resolver — docs/todo.md entry 67,
 * extended by entry 78 for the separate two-finger-simultaneous open path,
 * and by entry 103 for the removal of the single tap's save.
 *
 * A plain JS re-implementation of `resolveTapDown`'s state machine, rather
 * than importing main.ts directly: that file runs its own bootstrap at
 * module load and reaches for `document` immediately, which does not exist
 * here — the same reason probe-nudge.ts gives for re-implementing
 * `shuffled()`'s helpers instead of importing main.ts. Kept in lockstep with
 * main.ts by eye; a change to TAP_RESOLVE_MS or DOUBLE_TAP_RADIUS_PX there
 * needs the same change made here.
 *
 * Entry 103 removed the single tap's save outright, which is also what
 * removed the timer this file used to need: with nothing to commit once a
 * tap's window closes, there is nothing to fire and nothing to fire it at a
 * given time, only a position and a down-time to compare the *next*
 * qualifying down against. `down(...)` is therefore synchronous — it either
 * pairs with the remembered tap and opens, or becomes the new remembered
 * tap — and every check below supplies `now` only to place taps in time
 * relative to each other, not to drive a clock forward.
 *
 * The entry's own "Lands in" names scripts/probe-touch-stream.ts for
 * touch-stream checks, which tests engine/touch.ts's touch→atmosphere
 * envelope — an unrelated pure module with no tap-resolution logic in it at
 * all. **Mine**: this stays its own file, named for what it actually tests.
 *
 *   node --experimental-strip-types scripts/probe-tap.ts
 */

import { CHARGE_TIME } from '../src/engine/emitter.ts'

// Mirrors main.ts's own constants — see this file's own docstring.
const TAP_RESOLVE_MS = 400
const DOUBLE_TAP_RADIUS_PX = 30
// docs/todo.md entries 115 and 125. CHARGE_TIME + 1.0, and imported rather than
// re-typed as 3.5 — main.ts derives it from the emitter's own saturation
// point, so a copy here would stop meaning "just past full charge" the
// moment that moved. The two above stay hand-mirrored (see the docstring);
// this one did not have to be.
const HOLD_ARM_S = CHARGE_TIME + 1.0
const HOLD_ARM_SLOP_PX = 24

interface LastTap {
  x: number
  y: number
  t: number
  pointerId: number
}

function makeResolver() {
  let lastTap: LastTap | null = null
  let opened = 0
  let armed = 0

  // docs/todo.md entry 125 — the double tap opens the menu again and the
  // hold arms the camera, swapping what entry 115 shipped. Counted
  // separately rather than renamed, because both outcomes exist and a probe
  // that could not tell them apart would pass just as happily with the two
  // wired to each other — which is exactly the mistake a swap invites.
  const down = (pointerId: number, x: number, y: number, now: number): void => {
    if (
      lastTap !== null &&
      now - lastTap.t <= TAP_RESOLVE_MS &&
      Math.hypot(x - lastTap.x, y - lastTap.y) <= DOUBLE_TAP_RADIUS_PX
    ) {
      lastTap = null
      if (!calm) return
      opened++
      return
    }
    lastTap = { x, y, t: now, pointerId }
  }

  /**
   * The still hold, mirroring main.ts's own check in the per-frame sample
   * loop: a contact held past HOLD_ARM_S without travelling past
   * HOLD_ARM_SLOP_PX arms the camera once, and once only, however long the
   * finger stays down after that. It opened the menu at build 407; entry 125
   * swapped it.
   */
  let holdFiredBy: number | null = null
  const hold = (pointerId: number, downFor: number, travelPx: number): void => {
    if (holdFiredBy !== null) return
    if (downFor < HOLD_ARM_S || travelPx > HOLD_ARM_SLOP_PX) return
    if (!calm) return
    holdFiredBy = pointerId
    lastTap = null
    armed++
  }
  const release = (pointerId: number): void => {
    if (holdFiredBy === pointerId) holdFiredBy = null
  }

  // Mirrors cancelPendingTap: a drag (or a cancelled contact) forgets its
  // own down's remembered tap so it cannot later pair with an unrelated one.
  const cancel = (pointerId: number): void => {
    if (lastTap !== null && lastTap.pointerId === pointerId) lastTap = null
  }

  // docs/todo.md entry 125's calm gate. `main.ts` derives this from
  // `latestShake.disturb` against GESTURE_CALM_MAX and a 0.4s settle; here it
  // is simply set, because what is under test is that both gestures consult
  // it, not how the disturbance is measured (which is probe-shake.ts's).
  let calm = true
  const setCalm = (v: boolean): void => {
    calm = v
  }

  return {
    down,
    cancel,
    hold,
    release,
    setCalm,
    opened: () => opened,
    armed: () => armed,
    remembered: () => lastTap !== null,
  }
}

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

// 1. Human timing, down-to-down: a real double has non-zero contact
//    durations, and the window is measured from first-down to second-down,
//    not release-to-release. 90ms and 240ms are the entry's own figures.
{
  const r = makeResolver()
  r.down(1, 100, 100, 0) // first tap's down
  // The first tap's own release at 90ms — well within TAP_SLOP_PX, so no
  // cancel() call, exactly as a clean single-finger tap would produce.
  r.down(2, 102, 101, 240) // second tap's down, a different pointerId, 240ms later
  check('a real double (down 0, up 90, down 240) opens the menu', r.opened() === 1, `opened=${r.opened()}`)
  check('and does not arm the camera', r.armed() === 0, `armed=${r.armed()}`)
  check('nothing is left remembered once the pair has resolved', !r.remembered(), 'still remembered')
}

// 2. docs/todo.md entry 103's own point: a lone tap, whatever else happens
//    to it, never opens the panel and never does anything else — there is
//    no window closing to commit it as anything. Ten independent taps,
//    each too late to pair with the one before it, still open nothing.
{
  const r = makeResolver()
  for (let i = 0; i < 10; i++) {
    r.down(i, 100, 100, i * (TAP_RESOLVE_MS + 50))
  }
  check('ten independent, unpaired taps open the menu zero times', r.opened() === 0, `opened=${r.opened()}`)
  check('and arm the camera zero times', r.armed() === 0, `armed=${r.armed()}`)
}

// 3. A second tap arriving too late (past the window) does not pair — it is
//    its own, independent single, and simply replaces what is remembered.
{
  const r = makeResolver()
  r.down(1, 100, 100, 0)
  r.down(2, 101, 100, TAP_RESOLVE_MS + 50)
  check('a late second tap does not open the menu', r.opened() === 0, `opened=${r.opened()}`)
  check('the late tap is now what is remembered, not nothing', r.remembered(), 'nothing remembered')
}

// 4. A second tap too far away does not pair, even inside the window — and,
//    docs/todo.md entry 103's own simplification, it replaces the first
//    rather than the two coexisting: one remembered tap, not a list.
{
  const r = makeResolver()
  r.down(1, 50, 50, 0)
  r.down(2, 50 + DOUBLE_TAP_RADIUS_PX + 1, 50, 100)
  check('a second tap outside the radius does not open the menu', r.opened() === 0, `opened=${r.opened()}`)
  check('only the second tap remains remembered', r.remembered(), 'nothing remembered')
}

// 5. A drag forgets its own down's remembered tap — the release travelling
//    past TAP_SLOP_PX (checked by the caller, not this module — see
//    cancelPendingTap's own comment) must stop it from later pairing.
{
  const r = makeResolver()
  r.down(1, 100, 100, 0)
  r.cancel(1)
  check('a cancelled (dragged-away) tap leaves nothing remembered', !r.remembered(), 'still remembered')
  r.down(2, 100, 100, 100) // a second tap at the same spot, well inside the window
  check('and so cannot pair with a later tap at the same spot', r.opened() === 0, `opened=${r.opened()}`)
}

// 6. docs/todo.md entry 125 deleted entry 78's two-finger opener, so the bug
//    it guarded against — a first finger's remembered tap surviving the menu
//    opening and pairing with a later, unrelated one — is now the double
//    tap's own to answer. Two fingers do nothing at all, which is the
//    replacement assertion: the gesture is gone, not merely gated.
{
  const r = makeResolver()
  r.down(1, 100, 100, 0)
  r.down(2, 300, 300, 150) // a second finger elsewhere, well outside the radius
  check('two fingers landing apart open nothing', r.opened() === 0, `opened=${r.opened()}`)
  check('and arm nothing', r.armed() === 0, `armed=${r.armed()}`)
}

// docs/todo.md entry 125 — the still hold arms the camera. Every clause of
// its Done-when that is a property of the gesture rather than of a phone.
{
  const r = makeResolver()
  r.hold(1, 3.0, 0)
  check('a 3.0s hold does not arm', r.armed() === 0, `armed=${r.armed()}`)
  r.hold(1, HOLD_ARM_S, 0)
  check(`a ${HOLD_ARM_S}s still hold does`, r.armed() === 1, `armed=${r.armed()}`)
  r.hold(1, 6.0, 0)
  check('and holding on past that does not arm again', r.armed() === 1, `armed=${r.armed()}`)
  check('and the menu never opened', r.opened() === 0, `opened=${r.opened()}`)
}
{
  const r = makeResolver()
  r.hold(1, 10.0, 40)
  check('a hold that has drifted 40px never arms, however long', r.armed() === 0, `armed=${r.armed()}`)
  r.hold(1, 60.0, 25)
  check('nor one a single pixel past the slop', r.armed() === 0, `armed=${r.armed()}`)
}
{
  const r = makeResolver()
  r.down(1, 100, 100, 0)
  check('a hold begins as an ordinary remembered tap', r.remembered(), 'nothing remembered')
  r.hold(1, HOLD_ARM_S, 2)
  check('arming supersedes the tap still waiting to pair', !r.remembered(), 'still remembered')
  check('and it did not also open the menu', r.opened() === 0, `opened=${r.opened()}`)
}
{
  // The latch is per-contact: a finger still resting on the glass must not
  // arm twice, but the next contact must work.
  const r = makeResolver()
  r.hold(1, HOLD_ARM_S, 0)
  r.hold(1, 20.0, 0)
  check('one contact arms once', r.armed() === 1, `armed=${r.armed()}`)
  r.release(1)
  r.hold(2, HOLD_ARM_S, 0)
  check('a fresh contact arms again', r.armed() === 2, `armed=${r.armed()}`)
}

// docs/todo.md entry 125's calm gate — the part that answers the actual
// report. The stillness test above cannot see a shake, because the finger
// and the screen move together; these are the assertions that would fail
// against a build without the gate.
{
  const r = makeResolver()
  r.setCalm(false)
  r.hold(1, 10.0, 0) // a perfectly still thumb on a violently shaken phone
  check('a thumb held on a shaken phone does not arm', r.armed() === 0, `armed=${r.armed()}`)
  r.down(1, 100, 100, 0)
  r.down(2, 101, 100, 200) // two bounces inside entry 67's window
  check('and a double tap mid-shake does not open the menu', r.opened() === 0, `opened=${r.opened()}`)
  // The gate opens again the moment the phone settles, and the same
  // gestures work — a gate that latched would be worse than no gate.
  r.setCalm(true)
  r.hold(3, 10.0, 0)
  check('once it settles, the hold arms', r.armed() === 1, `armed=${r.armed()}`)
  r.down(4, 200, 200, 1000)
  r.down(5, 201, 200, 1200)
  check('and the double tap opens the menu', r.opened() === 1, `opened=${r.opened()}`)
}

console.log(failures === 0 ? '\nall tap checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
