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
// docs/todo.md entry 115. CHARGE_TIME + 1.0, and imported rather than
// re-typed as 3.5 — main.ts derives it from the emitter's own saturation
// point, so a copy here would stop meaning "just past full charge" the
// moment that moved. The two above stay hand-mirrored (see the docstring);
// this one did not have to be.
const HOLD_MENU_S = CHARGE_TIME + 1.0
const HOLD_MENU_SLOP_PX = 24

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

  // docs/todo.md entry 115 — the double tap arms the camera now; the menu
  // moved to the still hold below. Counted separately from `opened` rather
  // than renaming it, because both outcomes still exist and a probe that
  // could not tell them apart would pass just as happily with the two wired
  // to each other.
  const down = (pointerId: number, x: number, y: number, now: number): void => {
    if (
      lastTap !== null &&
      now - lastTap.t <= TAP_RESOLVE_MS &&
      Math.hypot(x - lastTap.x, y - lastTap.y) <= DOUBLE_TAP_RADIUS_PX
    ) {
      lastTap = null
      armed++
      return
    }
    lastTap = { x, y, t: now, pointerId }
  }

  /**
   * docs/todo.md entry 115's still hold, mirroring main.ts's own check in
   * the per-frame sample loop: a contact held past HOLD_MENU_S without
   * travelling past HOLD_MENU_SLOP_PX opens the menu once, and once only,
   * however long the finger stays down after that.
   */
  let holdOpenedBy: number | null = null
  const hold = (pointerId: number, downFor: number, travelPx: number): void => {
    if (holdOpenedBy !== null) return
    if (downFor < HOLD_MENU_S || travelPx > HOLD_MENU_SLOP_PX) return
    holdOpenedBy = pointerId
    lastTap = null
    opened++
  }
  const release = (pointerId: number): void => {
    if (holdOpenedBy === pointerId) holdOpenedBy = null
  }

  // Mirrors cancelPendingTap: a drag (or a cancelled contact) forgets its
  // own down's remembered tap so it cannot later pair with an unrelated one.
  const cancel = (pointerId: number): void => {
    if (lastTap !== null && lastTap.pointerId === pointerId) lastTap = null
  }

  // docs/todo.md entry 78 — the separate two-finger-simultaneous open path
  // (unrelated to the proximity-matched double above: this one fires the
  // instant a second contact is down at all, wherever it lands), mirroring
  // the fix's own `lastTap = null` before opening. A first finger's earlier
  // `down` may already be sitting here as a remembered tap; left in place,
  // it could still pair with some later, unrelated tap after the menu has
  // opened.
  const openTwoFinger = (): void => {
    lastTap = null
    opened++
  }

  return {
    down,
    cancel,
    hold,
    release,
    openTwoFinger,
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
  check('a real double (down 0, up 90, down 240) arms the camera', r.armed() === 1, `armed=${r.armed()}`)
  check('and does not open the menu', r.opened() === 0, `opened=${r.opened()}`)
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
  check('ten independent, unpaired taps arm the camera zero times', r.armed() === 0, `armed=${r.armed()}`)
  check('and open the menu zero times', r.opened() === 0, `opened=${r.opened()}`)
}

// 3. A second tap arriving too late (past the window) does not pair — it is
//    its own, independent single, and simply replaces what is remembered.
{
  const r = makeResolver()
  r.down(1, 100, 100, 0)
  r.down(2, 101, 100, TAP_RESOLVE_MS + 50)
  check('a late second tap does not arm', r.armed() === 0, `armed=${r.armed()}`)
  check('the late tap is now what is remembered, not nothing', r.remembered(), 'nothing remembered')
}

// 4. A second tap too far away does not pair, even inside the window — and,
//    docs/todo.md entry 103's own simplification, it replaces the first
//    rather than the two coexisting: one remembered tap, not a list.
{
  const r = makeResolver()
  r.down(1, 50, 50, 0)
  r.down(2, 50 + DOUBLE_TAP_RADIUS_PX + 1, 50, 100)
  check('a second tap outside the radius does not arm', r.armed() === 0, `armed=${r.armed()}`)
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
  check('and so cannot pair with a later tap at the same spot', r.armed() === 0, `armed=${r.armed()}`)
}

// 6. docs/todo.md entry 78's own bug: a first finger lands, is still short
//    of its own window, and a second finger landing elsewhere opens the
//    menu — the first finger's remembered tap must not survive to pair with
//    some later, unrelated tap after the menu has already opened.
{
  const r = makeResolver()
  r.down(1, 100, 100, 0) // finger 1's own down — remembered as a candidate
  r.openTwoFinger() // finger 2 lands 150ms later, the ordinary two-finger open
  check('the two-finger open itself opens exactly once', r.opened() === 1, `opened=${r.opened()}`)
  check('finger 1 has nothing left remembered', !r.remembered(), 'still remembered')
  r.down(3, 100, 100, 200) // a later, unrelated tap at the same spot
  check('it does not retroactively pair into a second open', r.opened() === 1, `opened=${r.opened()}`)
}

// docs/todo.md entry 115 — the still hold that replaced the double tap as
// the way into the menu. Every clause of its Done-when that is a property
// of the gesture rather than of a phone.
{
  const r = makeResolver()
  r.hold(1, 3.0, 0)
  check('a 3.0s hold does not open the menu', r.opened() === 0, `opened=${r.opened()}`)
  r.hold(1, HOLD_MENU_S, 0)
  check(`a ${HOLD_MENU_S}s still hold does`, r.opened() === 1, `opened=${r.opened()}`)
  r.hold(1, 6.0, 0)
  check('and holding on past that does not open it again', r.opened() === 1, `opened=${r.opened()}`)
}
{
  const r = makeResolver()
  r.hold(1, 10.0, 40)
  check('a hold that has drifted 40px never opens the menu, however long', r.opened() === 0, `opened=${r.opened()}`)
  r.hold(1, 60.0, 25)
  check('nor one a single pixel past the slop', r.opened() === 0, `opened=${r.opened()}`)
}
{
  const r = makeResolver()
  r.down(1, 100, 100, 0)
  check('a hold begins as an ordinary remembered tap', r.remembered(), 'nothing remembered')
  r.hold(1, HOLD_MENU_S, 2)
  check('opening the menu supersedes the tap still waiting to pair', !r.remembered(), 'still remembered')
  check('and it did not also arm the camera', r.armed() === 0, `armed=${r.armed()}`)
}
{
  // The latch is per-contact: a finger still resting on the glass after the
  // menu is dismissed must not reopen it, but the *next* hold must work.
  const r = makeResolver()
  r.hold(1, HOLD_MENU_S, 0)
  r.hold(1, 20.0, 0)
  check('one contact opens the menu once', r.opened() === 1, `opened=${r.opened()}`)
  r.release(1)
  r.hold(2, HOLD_MENU_S, 0)
  check('a fresh contact opens it again', r.opened() === 2, `opened=${r.opened()}`)
}

console.log(failures === 0 ? '\nall tap checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
