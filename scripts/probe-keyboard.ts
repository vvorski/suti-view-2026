/**
 * Offline check of the keyboard map — docs/todo.md entry 116.
 *
 * Unlike `probe-tap.ts`, this imports the real thing rather than mirroring
 * it: entry 116 extracted the decision into a pure `keyAction` precisely so
 * it could be. The two rules a key binding actually gets wrong — a held
 * modifier belonging to the OS, and a focused control owning its own keys —
 * are invisible in review and trivial here.
 *
 *   node --experimental-strip-types scripts/probe-keyboard.ts
 */

import { keyAction, type KeyPress } from '../src/keyboard.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

/** A key press with nothing held and nothing focused. */
const press = (over: Partial<KeyPress> & { key: string; code: string }): KeyPress => ({
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...over,
})

const d = (over: Partial<KeyPress> = {}): KeyPress => press({ key: 'd', code: 'KeyD', ...over })
const space = (over: Partial<KeyPress> = {}): KeyPress => press({ key: ' ', code: 'Space', ...over })

// 1. The new binding, in both cases a keyboard actually produces.
check("'d' toggles the numbers", keyAction(d()) === 'stats', String(keyAction(d())))
check(
  "'D' does too — shift is not a modifier this app refuses",
  keyAction(press({ key: 'D', code: 'KeyD' })) === 'stats',
  String(keyAction(press({ key: 'D', code: 'KeyD' }))),
)

// 2. A letter binding follows the character, not the position. On AZERTY the
//    key that types a `d` is still `KeyD`, but on Dvorak it is `KeyE` — and
//    the physical `KeyD` there types an `h`. Matching by `key` is what makes
//    "press d" mean the same thing on every layout.
check(
  'a Dvorak d (key d, code KeyE) still toggles',
  keyAction(press({ key: 'd', code: 'KeyE' })) === 'stats',
  String(keyAction(press({ key: 'd', code: 'KeyE' }))),
)
check(
  'and the Dvorak KeyD, which types an h, does not',
  keyAction(press({ key: 'h', code: 'KeyD' })) === null,
  String(keyAction(press({ key: 'h', code: 'KeyD' }))),
)

// 3. Modifiers belong to the browser or the OS. Ctrl+D is a bookmark, Cmd+D
//    is a duplicate or a bookmark, Alt+D focuses the address bar.
check("Ctrl+d does nothing", keyAction(d({ ctrlKey: true })) === null, String(keyAction(d({ ctrlKey: true }))))
check("Cmd+d does nothing", keyAction(d({ metaKey: true })) === null, String(keyAction(d({ metaKey: true }))))
check("Alt+d does nothing", keyAction(d({ altKey: true })) === null, String(keyAction(d({ altKey: true }))))

// 4. The fix entry 116 made in passing. Ctrl+Space is an IME switch on
//    Windows and a Spotlight binding on macOS; before this entry it re-rolled
//    the seed as a side effect of someone changing input language, because
//    the space binding had no modifier guard at all.
check(
  'Space is still the shake binding',
  keyAction(space()) === 'shake',
  String(keyAction(space())),
)
check(
  'Ctrl+Space no longer does — the guard is shared, not new to `d`',
  keyAction(space({ ctrlKey: true })) === null,
  String(keyAction(space({ ctrlKey: true }))),
)
check(
  'nor Cmd+Space, which is Spotlight',
  keyAction(space({ metaKey: true })) === null,
  String(keyAction(space({ metaKey: true }))),
)

// 5. A focused control owns its own keys — a HUD button treats space as
//    "activate me", and a text field owns every letter there is.
for (const tag of ['BUTTON', 'INPUT', 'TEXTAREA']) {
  check(`'d' with ${tag} focused does nothing`, keyAction(d({ targetTag: tag })) === null, String(keyAction(d({ targetTag: tag }))))
  check(`Space with ${tag} focused does nothing`, keyAction(space({ targetTag: tag })) === null, String(keyAction(space({ targetTag: tag }))))
}
check(
  "'d' with an ordinary element focused still toggles",
  keyAction(d({ targetTag: 'DIV' })) === 'stats',
  String(keyAction(d({ targetTag: 'DIV' }))),
)

// 6. Everything else is silence — the identity claim. A build where somebody
//    types a sentence must do nothing at all, and the letters either side of
//    `d` on a QWERTY row are exactly where a fat-finger would land.
{
  const others = [
    press({ key: 's', code: 'KeyS' }),
    press({ key: 'f', code: 'KeyF' }),
    press({ key: 'Enter', code: 'Enter' }),
    press({ key: 'Escape', code: 'Escape' }),
    press({ key: 'ArrowLeft', code: 'ArrowLeft' }),
    press({ key: 'Tab', code: 'Tab' }),
    press({ key: '4', code: 'Digit4' }),
    press({ key: 'Shift', code: 'ShiftLeft' }),
  ]
  const noisy = others.filter((p) => keyAction(p) !== null)
  check('every other key means nothing', noisy.length === 0, noisy.map((p) => p.key).join(', '))
}

console.log(failures === 0 ? '\nall keyboard checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
