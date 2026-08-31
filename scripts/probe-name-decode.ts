/**
 * Offline check of the release-name decode's pure half (docs/todo.md entry
 * 99, absorbing entry 94): does the per-character lock advance monotonically
 * and land exactly on the target, is the locked prefix always exactly right
 * regardless of how the scramble's random draws land, is the unresolved
 * tail always drawn from the declared alphabet (never garbage, never blank),
 * and does the reduced-motion type-in run at the rate Decided actually
 * names.
 *
 * The CSS (the disc's glow pulse, the motion glyph) and the `requestAnimation
 * Frame` loop itself are not probed here — Decided's own words: "the decode
 * timing (pure); the CSS is verified on device." Nothing in this file opens
 * a browser or a DOM; `lockedCountAt`, `reducedLockedCountAt` and
 * `renderLockFrame` are plain functions of numbers and strings.
 *
 *   node --experimental-strip-types scripts/probe-name-decode.ts
 */

import { lockedCountAt, reducedLockedCountAt, renderLockFrame } from '../src/version.ts'
import { RELEASE_NAMES, RELEASE_NAME } from '../src/release-name.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const NAME_LOCK_STEP_MS = 55 // duplicated by eye from version.ts's own constant

// 1. lockedCountAt: 0 before any time has passed, exactly one more character
//    every NAME_LOCK_STEP_MS, and clamped at the target's own length rather
//    than overshooting into a bogus "locked" count past what the string has.
{
  const len = RELEASE_NAME.length
  check('locked count is 0 at elapsed 0', lockedCountAt(0, len) === 0, String(lockedCountAt(0, len)))
  check(
    'locked count is exactly 1 just after one step',
    lockedCountAt(NAME_LOCK_STEP_MS + 1, len) === 1,
    String(lockedCountAt(NAME_LOCK_STEP_MS + 1, len)),
  )
  check(
    'locked count reaches the full length well after enough steps',
    lockedCountAt(len * NAME_LOCK_STEP_MS + 1000, len) === len,
    String(lockedCountAt(len * NAME_LOCK_STEP_MS + 1000, len)),
  )
  check('locked count never exceeds the target length, however long elapsed runs', lockedCountAt(1_000_000, len) === len, String(lockedCountAt(1_000_000, len)))
  check('locked count never goes negative for a negative elapsed', lockedCountAt(-500, len) === 0, String(lockedCountAt(-500, len)))

  let prev = -1
  let broken = false
  for (let ms = 0; ms <= len * NAME_LOCK_STEP_MS + 200; ms += 5) {
    const v = lockedCountAt(ms, len)
    if (v < prev) broken = true
    prev = v
  }
  check('locked count is monotonically non-decreasing over time', !broken, 'a step backward was found')
}

// 2. renderLockFrame: the locked prefix is always exactly the target's own
//    characters — checked across many random draws, since the scramble tail
//    is randomised and a flaky implementation could get the prefix right by
//    accident on any single call.
{
  const target = RELEASE_NAME
  const alphabet = new Set(RELEASE_NAMES.join('').split(''))
  let prefixEverWrong = false
  let tailEverOutsideAlphabet = false
  let tailEverEqualsTargetSuffixExactlyEveryTime = true // see note below
  for (let locked = 0; locked <= target.length; locked++) {
    for (let trial = 0; trial < 50; trial++) {
      const frame = renderLockFrame(target, locked)
      if (frame.length !== target.length) {
        prefixEverWrong = true
        continue
      }
      if (frame.slice(0, locked) !== target.slice(0, locked)) prefixEverWrong = true
      for (let i = locked; i < frame.length; i++) {
        if (!alphabet.has(frame[i])) tailEverOutsideAlphabet = true
      }
      if (locked < target.length && frame.slice(locked) !== target.slice(locked)) {
        tailEverEqualsTargetSuffixExactlyEveryTime = false
      }
    }
  }
  check('the locked prefix always matches the target exactly, across many random draws', !prefixEverWrong, 'a wrong prefix character was produced')
  check('the unresolved tail is always drawn from the declared scramble alphabet', !tailEverOutsideAlphabet, 'a character outside RELEASE_NAMES\' own alphabet was produced')
  check(
    'the unresolved tail is not simply the target itself in disguise (it genuinely scrambles)',
    !tailEverEqualsTargetSuffixExactlyEveryTime,
    'the tail matched the real answer on every single one of 50 draws — suspiciously exact',
  )
}

// 3. reducedLockedCountAt: about 3 characters a second, per Decided's own
//    words, monotonic and bounded the same way as the full-motion lock.
{
  const len = RELEASE_NAME.length
  check('reduced: 0 characters locked at elapsed 0', reducedLockedCountAt(0, len) === 0, String(reducedLockedCountAt(0, len)))
  check(
    'reduced: about 3 characters locked after one second',
    reducedLockedCountAt(1000, len) === Math.min(len, 3),
    String(reducedLockedCountAt(1000, len)),
  )
  // At 3 characters/second, the longest name on record (18 characters,
  // release-name.ts's own stated ceiling) takes 6s; a fixed 3000ms was
  // wrong for anything longer than 9 characters and is not what this check
  // means to assert — the time is derived from the target's own length
  // instead, with headroom, so this stays correct regardless of which name
  // is currently live.
  const reducedFullyLockedMs = (len / 3) * 1000 + 500
  check(
    'reduced: the full name is fully locked shortly after its own expected typing time',
    reducedLockedCountAt(reducedFullyLockedMs, len) === len,
    String(reducedLockedCountAt(reducedFullyLockedMs, len)),
  )
  check('reduced: never exceeds the target length', reducedLockedCountAt(1_000_000, len) === len, String(reducedLockedCountAt(1_000_000, len)))

  let prev = -1
  let broken = false
  for (let ms = 0; ms <= 3000; ms += 10) {
    const v = reducedLockedCountAt(ms, len)
    if (v < prev) broken = true
    prev = v
  }
  check('reduced: locked count is monotonically non-decreasing over time', !broken, 'a step backward was found')
}

// 4. RELEASE_NAME's own characters are guaranteed present in RELEASE_NAMES'
//    combined alphabet, by construction (it is the array's own last
//    element) — the property renderLockFrame's correctness actually
//    depends on, checked directly rather than only trusted.
{
  const alphabet = new Set(RELEASE_NAMES.join('').split(''))
  const missing = [...RELEASE_NAME].filter((c) => !alphabet.has(c))
  check('every character in the current release name is in the combined scramble alphabet', missing.length === 0, `missing: ${JSON.stringify(missing)}`)
}

console.log(failures === 0 ? '\nall name-decode checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
