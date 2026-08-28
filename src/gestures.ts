/**
 * Space bar or a vertical swipe re-roll the current view's seed (see
 * scene.ts's `uSeed`) — a way to reach in and ask for a different look
 * without waiting for the music or a structural boundary to change one for
 * you. A horizontal swipe swaps the atmospheric layer's programme instead —
 * left for the next one, right for the previous.
 *
 * This used to be double-tap/double-click, and it did not actually work.
 * control-panel.ts's tap-to-open listener has zero delay by design — the
 * panel exists specifically to open on a tap with no wait — so the first tap
 * of an intended double tap already opened the panel before a second tap
 * could ever be compared against it. By the time the second tap landed, it
 * was landing on the now-visible scrim, which this file deliberately ignores
 * (see the exclusion check below, needed so operating the panel itself never
 * also triggers a gesture underneath it). The double tap could never
 * complete; it just looked like the panel opening on a single tap, because
 * that is exactly what was happening. There is no way to tell "one tap" from
 * "the first half of two taps" without either holding every single tap for
 * the double-tap window before acting on it (which defeats the reason the
 * panel uses a zero-delay tap in the first place) or picking a gesture a tap
 * cannot be mistaken for. A swipe already has to clear a distance threshold
 * to register at all, so it sidesteps the ambiguity instead of resolving it.
 */

export interface GestureHandlers {
  onRandomise(): void
  /** direction: 1 to advance (swipe left), -1 to go back (swipe right). */
  onSwipeAtmospheric(direction: 1 | -1): void
}

export function bindGestures(handlers: GestureHandlers): void {
  // A swipe must travel further than this, mostly along one axis, and land
  // within SWIPE_MAX_MS — fast and deliberate, not a slow drag.
  const SWIPE_MIN_PX = 60
  const SWIPE_MAX_MS = 600
  // One axis must beat the other by this factor to count as that axis's
  // swipe, rather than a diagonal drag that could be either.
  const AXIS_DOMINANCE = 1.5

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

    const dt = performance.now() - downTime
    if (dt >= SWIPE_MAX_MS) return // too slow to be a deliberate swipe

    const dx = e.clientX - downX
    const dy = e.clientY - downY
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDx > SWIPE_MIN_PX && absDx > absDy * AXIS_DOMINANCE) {
      handlers.onSwipeAtmospheric(dx < 0 ? 1 : -1)
    } else if (absDy > SWIPE_MIN_PX && absDy > absDx * AXIS_DOMINANCE) {
      handlers.onRandomise()
    }
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
