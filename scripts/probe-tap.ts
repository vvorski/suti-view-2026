/**
 * Offline check of the single/double-tap resolver — docs/todo.md entry 67,
 * extended by entry 78 for the separate two-finger-simultaneous open path.
 *
 * A plain JS re-implementation of `resolveTapDown`'s state machine, rather
 * than importing main.ts directly: that file runs its own bootstrap at
 * module load and reaches for `document` immediately, which does not exist
 * here — the same reason probe-nudge.ts gives for re-implementing
 * `shuffled()`'s helpers instead of importing main.ts. Kept in lockstep with
 * main.ts by eye; a change to TAP_RESOLVE_MS or DOUBLE_TAP_RADIUS_PX there
 * needs the same change made here.
 *
 * The entry's own "Lands in" names scripts/probe-touch-stream.ts for these
 * two checks, which tests engine/touch.ts's touch→atmosphere envelope — an
 * unrelated pure module with no tap-resolution logic in it at all. **Mine**:
 * a new file, named for what it actually tests, rather than adding an
 * unrelated state machine to a file whose own docstring scopes it to a
 * different concern.
 *
 * Time-driven rather than real-timer-driven, so "down 0, up 90, down 240"
 * can be asserted exactly rather than raced against real setTimeout jitter:
 * `tick(now)` fires anything whose deadline has passed, and the test
 * supplies `now` itself.
 *
 *   node --experimental-strip-types scripts/probe-tap.ts
 */

// Mirrors main.ts's own two constants — see this file's own docstring.
const TAP_RESOLVE_MS = 400
const DOUBLE_TAP_RADIUS_PX = 30

interface PendingTap {
  x: number
  y: number
  pointerId: number
  firesAt: number
}

function makeResolver() {
  const pendingTaps: PendingTap[] = []
  let opened = 0
  let saved = 0

  const down = (pointerId: number, x: number, y: number, now: number): void => {
    const i = pendingTaps.findIndex((p) => Math.hypot(x - p.x, y - p.y) <= DOUBLE_TAP_RADIUS_PX)
    if (i !== -1) {
      pendingTaps.splice(i, 1)
      opened++
      return
    }
    pendingTaps.push({ x, y, pointerId, firesAt: now + TAP_RESOLVE_MS })
  }

  // Mirrors cancelPendingTap: a drag (or a cancelled contact) removes its
  // own down's pending entry before it can fire as a save.
  const cancel = (pointerId: number): void => {
    const i = pendingTaps.findIndex((p) => p.pointerId === pointerId)
    if (i !== -1) pendingTaps.splice(i, 1)
  }

  // docs/todo.md entry 78 — the separate two-finger-simultaneous open path
  // (unrelated to the proximity-matched double above: this one fires the
  // instant a second contact is down at all, wherever it lands), mirroring
  // the fix's own `for (const p of [...pendingTaps]) cancelPendingTap(...)`.
  // A first finger's earlier `down` already started a pending single (its
  // own `nonChipDown` read 1 before the second finger landed); left running,
  // it fires as a save 400ms later regardless of the menu having opened in
  // between.
  const openTwoFinger = (): void => {
    for (const p of [...pendingTaps]) cancel(p.pointerId)
    opened++
  }

  const tick = (now: number): void => {
    for (let i = pendingTaps.length - 1; i >= 0; i--) {
      if (now >= pendingTaps[i].firesAt) {
        pendingTaps.splice(i, 1)
        saved++
      }
    }
  }

  return {
    down,
    cancel,
    openTwoFinger,
    tick,
    opened: () => opened,
    saved: () => saved,
    pending: () => pendingTaps.length,
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
  check('the double does not also save', r.saved() === 0, `saved=${r.saved()}`)
}

// 2. The bounded negative, restated per entry 66's own rule (a check whose
//    name is a negative must say under what condition the behaviour
//    resumes): "a lone tap does not open the panel *within its window*" —
//    not "does not open the panel", which is trivially true forever and
//    asserts nothing.
{
  const r = makeResolver()
  r.down(1, 50, 50, 0)
  r.tick(TAP_RESOLVE_MS - 1)
  check('a lone tap has not committed one frame before its window closes', r.saved() === 0 && r.opened() === 0, `saved=${r.saved()} opened=${r.opened()}`)
  r.tick(TAP_RESOLVE_MS)
  check('a lone tap commits as a save once its window closes', r.saved() === 1 && r.opened() === 0, `saved=${r.saved()} opened=${r.opened()}`)
}

// 3. A second tap arriving too late (past the window) does not open the
//    panel — it is its own, independent single, and the first has already
//    committed.
{
  const r = makeResolver()
  r.down(1, 100, 100, 0)
  r.tick(TAP_RESOLVE_MS)
  check('the first tap already saved', r.saved() === 1, `saved=${r.saved()}`)
  r.down(2, 101, 100, TAP_RESOLVE_MS + 50)
  check('a late second tap does not retroactively open the panel', r.opened() === 0, `opened=${r.opened()}`)
}

// 4. A second tap too far away does not pair, even inside the window.
{
  const r = makeResolver()
  r.down(1, 50, 50, 0)
  r.down(2, 50 + DOUBLE_TAP_RADIUS_PX + 1, 50, 100)
  check('a second tap outside the radius does not open the panel', r.opened() === 0, `opened=${r.opened()}`)
  check('both remain independently pending', r.pending() === 2, `pending=${r.pending()}`)
}

// 5. A drag cancels its own pending single — the down started a timer, and
//    the release travelling past TAP_SLOP_PX (checked by the caller, not
//    this module — see cancelPendingTap's own comment) must stop it firing.
{
  const r = makeResolver()
  r.down(1, 100, 100, 0)
  r.cancel(1)
  r.tick(TAP_RESOLVE_MS)
  check('a cancelled (dragged-away) tap never saves', r.saved() === 0, `saved=${r.saved()}`)
}

// 6. docs/todo.md entry 78's own bug: a first finger lands, is still short
//    of its own 400ms window, and a second finger landing elsewhere opens
//    the menu — the first finger's pending single must not survive to fire
//    a stray save after the menu has already opened.
{
  const r = makeResolver()
  r.down(1, 100, 100, 0) // finger 1's own down — starts a pending single
  r.openTwoFinger() // finger 2 lands 150ms later, the ordinary two-finger open
  check('the two-finger open itself opens exactly once', r.opened() === 1, `opened=${r.opened()}`)
  check('finger 1 has no pending tap left to fire', r.pending() === 0, `pending=${r.pending()}`)
  r.tick(TAP_RESOLVE_MS)
  check(
    'no stray save fires 400ms after the menu already opened',
    r.saved() === 0,
    `saved=${r.saved()}`,
  )
}

console.log(failures === 0 ? '\nall tap checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
