/**
 * The keyboard, for the machine that has one.
 *
 * Space bar re-rolls the current view's seed (see scene.ts's `uSeed`) — a way
 * to reach in and ask for a different look without waiting for the music or a
 * structural boundary to change one for you. The shake is this same gesture
 * for a device that has one (docs/todo.md entry 27, which also removed this
 * file's own pointer-swipe half of it — this is the desktop equivalent, for a
 * machine with no accelerometer and therefore no other way to ask for a
 * re-seed outside the panel).
 *
 * `d` toggles the numeric readout — docs/todo.md entry 116. On a desktop that
 * readout is the debugging surface, and reaching it otherwise costs a gesture,
 * a menu and a chip.
 *
 * **There is no desktop check here and there does not need to be.** A device
 * with no keyboard sends no `keydown`. A phone with a Bluetooth keyboard
 * attached gets both keys, which is correct rather than a leak.
 *
 * The decision half is `keyAction` below: pure, no DOM, no listener, so the
 * two rules that actually get a key binding wrong — the modifier guard and
 * the focused-control exclusion — are testable rather than only reviewable.
 */

/** What a key press means to this app, or `null` for every key that means
 *  nothing to it — which is almost all of them. */
export type KeyAction = 'randomise' | 'stats'

/** Just the fields `keyAction` reads, so a probe can pose a key press without
 *  constructing a `KeyboardEvent` and a DOM to fire it at. */
export interface KeyPress {
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  /** `event.target`'s tag name, or undefined when there is no target. */
  targetTag?: string
}

export function keyAction(e: KeyPress): KeyAction | null {
  // A held modifier means the key belongs to the browser or the OS, never to
  // this app. Applied to both bindings rather than only the new one, and it
  // is a fix as much as a rule: the space bar had no such guard, so
  // Ctrl+Space — an IME switch on Windows, a Spotlight binding on macOS —
  // re-rolled the seed as a side effect of someone changing input language.
  if (e.ctrlKey || e.metaKey || e.altKey) return null

  // A focused control owns its own keys: a HUD button treats space as
  // "activate me", and a text field owns every letter there is.
  if (e.targetTag === 'BUTTON' || e.targetTag === 'INPUT' || e.targetTag === 'TEXTAREA') return null

  // Space by `code`, `d` by `key`, and the difference is not an
  // inconsistency. Space is a *position* — the long bar at the bottom, on
  // every layout — so the physical key is what is meant. "Pressing d" means
  // the key that types a d, which on AZERTY or Dvorak is not where `KeyD`
  // sits; a letter binding follows the character.
  if (e.code === 'Space') return 'randomise'
  if (e.key.toLowerCase() === 'd') return 'stats'
  return null
}

export interface KeyboardHandlers {
  onRandomise(): void
  onToggleStats(): void
}

export function bindKeyboard(handlers: KeyboardHandlers): void {
  window.addEventListener('keydown', (e) => {
    const action = keyAction({
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      targetTag: (e.target as HTMLElement | null)?.tagName,
    })
    if (action === null) return
    e.preventDefault()
    if (action === 'randomise') handlers.onRandomise()
    else handlers.onToggleStats()
  })
}
