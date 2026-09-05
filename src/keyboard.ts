/**
 * The keyboard, for the machine that has one.
 *
 * Space bar is a shake — docs/todo.md entry 126, replacing what used to be a
 * direct `visualiser.randomise()` call. `shake.ts`'s `Tumble` runs on every
 * desktop already (no permission gate there), receiving nothing; holding
 * space feeds it a real synthetic accelerometer signal (`engine/synth-
 * shake.ts`) instead, so the space bar gets everything a real shake does —
 * the tumble, the RGB slip, the colour bias, and the re-seed *through* the
 * shake rather than as a second, separate effect. This file only ever
 * decides *when* a press starts and ends; the synthesis and the shake
 * response both live elsewhere. Entry 27 removed this file's own
 * pointer-swipe gesture; this is the desktop equivalent of a phone's shake,
 * for a machine with no accelerometer and therefore no other way to ask for
 * one outside the panel.
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
 * Start/end and the `blur` release are impure by nature (they are about
 * *when*, not *whether*) and live in `bindKeyboard` instead.
 */

/** What a key press means to this app, or `null` for every key that means
 *  nothing to it — which is almost all of them. */
export type KeyAction = 'shake' | 'stats'

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
  if (e.code === 'Space') return 'shake'
  if (e.key.toLowerCase() === 'd') return 'stats'
  return null
}

export interface KeyboardHandlers {
  /** Space went down (and it was not `e.repeat` — see `bindKeyboard`'s own
   *  comment on why auto-repeat is ignored). */
  onShakeStart(): void
  /** Space came back up, or the window lost focus while it was held. */
  onShakeEnd(): void
  onToggleStats(): void
}

export function bindKeyboard(handlers: KeyboardHandlers): void {
  const press = (e: KeyboardEvent): KeyPress => ({
    key: e.key,
    code: e.code,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    targetTag: (e.target as HTMLElement | null)?.tagName,
  })

  window.addEventListener('keydown', (e) => {
    const action = keyAction(press(e))
    if (action === null) return
    e.preventDefault()
    if (action === 'shake') {
      // docs/todo.md entry 126 — driven per frame, not by key auto-repeat:
      // auto-repeat's rate is an OS setting, so a shake built on it would be
      // a different shake on every machine. The browser still sends a
      // `keydown` every repeat while held; `e.repeat` is what tells a fresh
      // press from that, and the held flag this starts lives in main.ts,
      // read once a frame instead.
      if (!e.repeat) handlers.onShakeStart()
    } else {
      handlers.onToggleStats()
    }
  })

  window.addEventListener('keyup', (e) => {
    if (keyAction(press(e)) === 'shake') handlers.onShakeEnd()
  })

  // docs/todo.md entry 126 — a key released while the tab is not focused
  // sends no `keyup` at all. Without this the picture shakes forever with
  // nothing on screen explaining why and no way to stop it but a reload —
  // the exact bug `goFullscreen`'s own history (CLAUDE.md) warns a comment
  // like "there is no further gesture to hang it on" can quietly become.
  // Unconditional: a stray `blur` while space was never held is simply a
  // second `onShakeEnd()` on an already-clear flag, which costs nothing.
  window.addEventListener('blur', () => handlers.onShakeEnd())
}
