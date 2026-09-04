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

import {
  lockedCountAt,
  reducedLockedCountAt,
  renderLockFrame,
  NAME_FLIP_MS,
  NAME_LOCK_STEP_MS,
} from '../src/version.ts'
import { RELEASE_NAMES, RELEASE_NAME } from '../src/release-name.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

// Imported, not copied — docs/todo.md entry 113. This line used to read
// `const NAME_LOCK_STEP_MS = 55 // duplicated by eye from version.ts's own
// constant`, and that duplication was the reason entry 113 could not be a
// two-character edit: with its own copy, this file's assertions are
// self-consistent against a stale number and stay green while testing
// nothing at all. The one gate that would catch a half-applied timing
// change was the one thing guaranteed not to.

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
  // docs/todo.md entry 113 re-anchored this path to the shared step rather
  // than its own hardcoded 1000/3, so the two rates are now equal rather
  // than the reduced one being three times faster than the normal one would
  // have become. What makes the reduced path reduced is that it never
  // scrambles — it types — and that is asserted in `mountReleaseName`'s own
  // code path, not by a rate here.
  check(
    'reduced: one character locked after one step',
    reducedLockedCountAt(NAME_LOCK_STEP_MS + 1, len) === Math.min(len, 1),
    String(reducedLockedCountAt(NAME_LOCK_STEP_MS + 1, len)),
  )
  check(
    'reduced: the two paths now share a step and agree at every millisecond tested',
    Array.from({ length: 400 }, (_, i) => i * 137).every(
      (ms) => reducedLockedCountAt(ms, len) === lockedCountAt(ms, len),
    ),
    'the reduced and full-motion paths disagreed',
  )
  const reducedFullyLockedMs = len * NAME_LOCK_STEP_MS + NAME_LOCK_STEP_MS
  check(
    'reduced: the full name is fully locked shortly after its own expected typing time',
    reducedLockedCountAt(reducedFullyLockedMs, len) === len,
    String(reducedLockedCountAt(reducedFullyLockedMs, len)),
  )
  check('reduced: never exceeds the target length', reducedLockedCountAt(1_000_000, len) === len, String(reducedLockedCountAt(1_000_000, len)))

  let prev = -1
  let broken = false
  // Swept past the full decode's own length rather than a fixed 3000ms,
  // which stopped covering the whole animation the moment entry 113 made it
  // ten times longer.
  for (let ms = 0; ms <= reducedFullyLockedMs + 1000; ms += 10) {
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

// docs/todo.md entry 113's own acceptance figures, asserted at the literal
// values the entry names rather than only against whatever name happens to
// be current — a check written purely in terms of RELEASE_NAME would pass
// against any step size at all, which is the failure mode this whole entry
// is about.
check('a 12-character name locks its first character just after 551ms', lockedCountAt(551, 12) === 1, String(lockedCountAt(551, 12)))
check(
  'and its last just after 12 steps',
  lockedCountAt(550 * 12 + 1, 12) === 12,
  String(lockedCountAt(550 * 12 + 1, 12)),
)

// The whole animation's length, printed rather than asserted: it is a
// consequence of two constants and the current name's length, and what it
// wants is a person reading it and deciding whether that is too long — which
// is exactly the judgement entry 113 says a probe cannot make.
{
  const totalMs = NAME_FLIP_MS + RELEASE_NAME.length * NAME_LOCK_STEP_MS
  const longest = RELEASE_NAMES.reduce((a, b) => (a.length >= b.length ? a : b))
  console.log(
    `\nThe opening decode runs ${(totalMs / 1000).toFixed(1)}s for "${RELEASE_NAME}" ` +
      `(${NAME_FLIP_MS / 1000}s flip + ${RELEASE_NAME.length} x ${NAME_LOCK_STEP_MS}ms), ` +
      `and ${((NAME_FLIP_MS + longest.length * NAME_LOCK_STEP_MS) / 1000).toFixed(1)}s for the longest name on record ("${longest}").`,
  )
}

console.log(failures === 0 ? '\nall name-decode checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
