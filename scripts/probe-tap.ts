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

// Mirrors main.ts's own two constants — see this file's own docstring.
const TAP_RESOLVE_MS = 400
const DOUBLE_TAP_RADIUS_PX = 30

interface LastTap {
  x: number
  y: number
  t: number
  pointerId: number
}

function makeResolver() {
  let lastTap: LastTap | null = null
  let opened = 0

  const down = (pointerId: number, x: number, y: number, now: number): void => {
    if (
      lastTap !== null &&
      now - lastTap.t <= TAP_RESOLVE_MS &&
      Math.hypot(x - lastTap.x, y - lastTap.y) <= DOUBLE_TAP_RADIUS_PX
    ) {
      lastTap = null
      opened++
      return
    }
    lastTap = { x, y, t: now, pointerId }
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
    openTwoFinger,
    opened: () => opened,
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
  check('a real double (down 0, up 90, down 240) opens the panel', r.opened() === 1, `opened=${r.opened()}`)
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
  check('ten independent, unpaired taps open the panel zero times', r.opened() === 0, `opened=${r.opened()}`)
}

// 3. A second tap arriving too late (past the window) does not pair — it is
//    its own, independent single, and simply replaces what is remembered.
{
  const r = makeResolver()
  r.down(1, 100, 100, 0)
  r.down(2, 101, 100, TAP_RESOLVE_MS + 50)
  check('a late second tap does not open the panel', r.opened() === 0, `opened=${r.opened()}`)
  check('the late tap is now what is remembered, not nothing', r.remembered(), 'nothing remembered')
}

// 4. A second tap too far away does not pair, even inside the window — and,
//    docs/todo.md entry 103's own simplification, it replaces the first
//    rather than the two coexisting: one remembered tap, not a list.
{
  const r = makeResolver()
  r.down(1, 50, 50, 0)
  r.down(2, 50 + DOUBLE_TAP_RADIUS_PX + 1, 50, 100)
  check('a second tap outside the radius does not open the panel', r.opened() === 0, `opened=${r.opened()}`)
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

console.log(failures === 0 ? '\nall tap checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
