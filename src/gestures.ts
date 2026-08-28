/**
 * Space bar, double-tap, and double-click all re-roll the current view's seed
 * (see scene.ts's `uSeed`) — a way to reach in and ask for a different look
 * without waiting for the music to change one for you.
 *
 * This deliberately does not touch control-panel.ts's own single-tap-to-open
 * listener. Distinguishing a single tap from the first half of a double tap
 * requires holding every single tap for the double-tap window before acting
 * on it, and the panel exists specifically to open on tap with no delay (see
 * its own comment on pointerup vs click). So both listeners just watch the
 * same events independently: a double-tap still flashes the panel briefly
 * open-then-closed on its way past, which is a fair trade for keeping every
 * ordinary single tap instant.
 */
export function bindRandomiseGestures(onRandomise: () => void): void {
  const DOUBLE_MS = 350
  const DOUBLE_PX = 32
  let lastTime = 0
  let lastX = 0
  let lastY = 0

  document.addEventListener('pointerup', (e) => {
    // Ignore taps spent operating the control panel itself. `target` is not
    // guaranteed to be an Element (it can be the document itself), so check
    // before reaching for `.closest`.
    if (e.target instanceof Element && e.target.closest('.cp-scrim')) return

    const now = performance.now()
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    const isDouble = now - lastTime < DOUBLE_MS && Math.hypot(dx, dy) < DOUBLE_PX

    // A third tap should start a fresh pair, not chain into another double.
    lastTime = isDouble ? 0 : now
    lastX = e.clientX
    lastY = e.clientY

    if (isDouble) onRandomise()
  })

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return
    // A focused control-panel button treats space as "activate me"; don't
    // steal that.
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA') return
    e.preventDefault()
    onRandomise()
  })
}
