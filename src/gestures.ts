/**
 * Space bar and double-tap/double-click re-roll the current view's seed (see
 * scene.ts's `uSeed`) — a way to reach in and ask for a different look
 * without waiting for the music to change one for you. A horizontal swipe
 * swaps the atmospheric layer's programme — swipe left for the next one,
 * right for the previous — because double-click turned out not to be a good
 * fit for "change what's showing": it is small and easy to miss on a phone,
 * and it visually collides with the panel it also has to coexist with.
 * Swapping the visible layer front-to-back is exactly the gesture a page
 * carousel already trains people to reach for.
 *
 * This deliberately does not touch control-panel.ts's own single-tap-to-open
 * listener. Distinguishing a single tap from the first half of a double tap
 * requires holding every single tap for the double-tap window before acting
 * on it, and the panel exists specifically to open on tap with no delay (see
 * its own comment on pointerup vs click). So both listeners just watch the
 * same events independently: a double-tap still flashes the panel briefly
 * open-then-closed on its way past, which is a fair trade for keeping every
 * ordinary single tap instant. A swipe does not have this problem — the
 * panel's own tap-to-open listener checks the pointerdown-to-pointerup
 * distance and ignores anything that moved, so a swipe never pops it open.
 */

export interface GestureHandlers {
  onRandomise(): void
  /** direction: 1 to advance (swipe left), -1 to go back (swipe right). */
  onSwipeAtmospheric(direction: 1 | -1): void
}

export function bindGestures(handlers: GestureHandlers): void {
  const DOUBLE_MS = 350
  const DOUBLE_PX = 32
  // A swipe must travel further than this, mostly horizontally, and land
  // within SWIPE_MAX_MS — fast and deliberate, not a slow drag.
  const SWIPE_MIN_PX = 60
  const SWIPE_MAX_MS = 600

  let lastTapTime = 0
  let lastTapX = 0
  let lastTapY = 0
  let downX = 0
  let downY = 0
  let downTime = 0

  document.addEventListener('pointerdown', (e) => {
    downX = e.clientX
    downY = e.clientY
    downTime = performance.now()
  })

  document.addEventListener('pointerup', (e) => {
    // Ignore gestures spent operating the control panel itself. `target` is
    // not guaranteed to be an Element (it can be the document itself), so
    // check before reaching for `.closest`.
    if (e.target instanceof Element && e.target.closest('.cp-scrim')) return

    const dx = e.clientX - downX
    const dy = e.clientY - downY
    const dt = performance.now() - downTime

    if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < SWIPE_MAX_MS) {
      handlers.onSwipeAtmospheric(dx < 0 ? 1 : -1)
      lastTapTime = 0 // the swipe's endpoint should not chain into a double-tap
      return
    }

    const now = performance.now()
    const ddx = e.clientX - lastTapX
    const ddy = e.clientY - lastTapY
    const isDouble = now - lastTapTime < DOUBLE_MS && Math.hypot(ddx, ddy) < DOUBLE_PX

    // A third tap should start a fresh pair, not chain into another double.
    lastTapTime = isDouble ? 0 : now
    lastTapX = e.clientX
    lastTapY = e.clientY

    if (isDouble) handlers.onRandomise()
  })

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return
    // A focused control-panel button treats space as "activate me"; don't
    // steal that.
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA') return
    e.preventDefault()
    handlers.onRandomise()
  })
}
