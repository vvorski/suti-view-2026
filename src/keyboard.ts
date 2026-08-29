/**
 * Space bar re-rolls the current view's seed (see scene.ts's `uSeed`) — a way
 * to reach in and ask for a different look without waiting for the music or a
 * structural boundary to change one for you.
 *
 * The shake is this same gesture for a device that has one (docs/todo.md
 * entry 27, which also removed this file's own pointer-swipe half of it —
 * this is the desktop equivalent, for a machine with no accelerometer and
 * therefore no other way to ask for a re-seed outside the panel).
 */

export interface KeyboardHandlers {
  onRandomise(): void
}

export function bindKeyboard(handlers: KeyboardHandlers): void {
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return
    // A focused HUD button treats space as "activate me"; don't
    // steal that.
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA') return
    e.preventDefault()
    handlers.onRandomise()
  })
}
