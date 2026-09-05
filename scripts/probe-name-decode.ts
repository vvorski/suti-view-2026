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
  renderReducedFrame,
  createDecodeClockState,
  advanceDecodeClock,
  NAME_FLIP_MS,
  NAME_LOCK_STEP_MS,
  MAX_FRAME_MS,
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
  // docs/todo.md entry 133 puts this path back to entry 99's own 3 characters
  // a second, undoing entry 113's decision to tie it to NAME_LOCK_STEP_MS.
  // The two branches are not the same kind of animation: the full path
  // scrambles in place and is legible at every instant, while this one
  // reveals and is legible only once it has arrived. 550ms a character meant
  // a median name took 6.6s to become readable on a gate people leave in two.
  check(
    'reduced: about 3 characters locked after one second, as entry 99 set it',
    reducedLockedCountAt(1000, len) === Math.min(len, 3),
    String(reducedLockedCountAt(1000, len)),
  )
  // Swept rather than sampled at one instant: the two step sizes coincide at
  // some elapsed times by arithmetic (both read 1 at exactly 550ms), so a
  // single sample can say "still tied" about a path that is not. What is
  // actually claimed is that reduced never falls behind and does get ahead.
  {
    const points = Array.from({ length: 60 }, (_, i) => i * 100)
    const behind = points.filter((ms) => reducedLockedCountAt(ms, len) < lockedCountAt(ms, len))
    const ahead = points.filter((ms) => reducedLockedCountAt(ms, len) > lockedCountAt(ms, len))
    check(
      'reduced: no longer tied to the full path’s step — never behind it, often ahead',
      behind.length === 0 && ahead.length > 0,
      `behind at ${behind.length} points, ahead at ${ahead.length}`,
    )
  }
  const reducedFullyLockedMs = (len / 3) * 1000 + 500
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

// docs/todo.md entry 133 — the regression itself, stated as the thing the eye
// failed at rather than as a timing property. `mountReleaseName`'s reduced
// branch called `step()` synchronously and rendered `target.slice(0, 0)`, an
// empty string, directly under a comment saying an unstarted decode must
// never leave the span empty. On any device matching `prefers-reduced-motion`
// the name was therefore blank for a full character-step — 333ms when entry
// 99 shipped it, 550ms after entry 113 — and that is what four separate
// reports of "the animation doesn't show" were looking at.
{
  // A minimal element stand-in: this file has no DOM, and the render only
  // needs `textContent`, `append` and a child that can carry a class.
  const made: { className: string; textContent: string }[] = []
  const el = {
    textContent: '',
    append(...parts: unknown[]): void {
      for (const p of parts) {
        this.textContent += typeof p === 'string' ? p : (p as { textContent: string }).textContent
      }
    },
  }
  ;(globalThis as { document?: unknown }).document = {
    createElement: () => {
      const node = { className: '', textContent: '' }
      made.push(node)
      return node
    },
  }

  const target = RELEASE_NAME
  renderReducedFrame(el as unknown as HTMLElement, target, 0)
  check(
    'reduced: at elapsed 0 the full name is on screen, not an empty span',
    el.textContent.length === target.length && el.textContent !== '',
    `rendered ${JSON.stringify(el.textContent)}`,
  )
  check(
    'reduced: and it is the name itself, dimmed — never a scramble',
    el.textContent === target,
    `rendered ${JSON.stringify(el.textContent)} for ${JSON.stringify(target)}`,
  )
  check(
    'reduced: the unresolved tail is marked so CSS can dim it',
    made.length === 1 && made[0].className === 'name-pending' && made[0].textContent === target,
    made.map((m) => `${m.className}:${m.textContent}`).join(', '),
  )

  // Every intermediate frame keeps the full width, which is what stops the
  // gate reflowing as it fills.
  let widthHeld = true
  for (let locked = 0; locked <= target.length; locked++) {
    el.textContent = ''
    made.length = 0
    renderReducedFrame(el as unknown as HTMLElement, target, locked)
    if (el.textContent !== target) widthHeld = false
  }
  check('reduced: every frame renders the whole name, so the width never changes', widthHeld, 'a frame was short')
}

// docs/todo.md entry 123 — the bounded clock's whole reason to exist: a
// stall between two frames (real device symptom: mountReleaseName() runs
// synchronously ahead of createVisualiser()'s shader compile) must pause
// the decode rather than let `now - start` read straight past frames it
// never painted. Mirrors phase one's own eased-index formula by eye
// (version.ts's `step()`, not exported — the formula itself is not what
// this entry changed) since only the clock arithmetic is under test here.
{
  const target = RELEASE_NAME
  const n = RELEASE_NAMES.length
  const phaseOneIndexAt = (elapsed: number): number => {
    const t = Math.min(1, elapsed / NAME_FLIP_MS)
    const eased = 1 - (1 - t) * (1 - t)
    return Math.min(n - 1, Math.floor(eased * n))
  }

  // Synthetic frame timestamps: a 60fps run for 100ms, then one frame that
  // arrives 2000ms late (the shader-compile stall), then 60fps again to
  // well past the whole decode's own length — long enough to cover
  // whichever name happens to be current, not a fixed guess. The stalled
  // run needs extra wall time budgeted on top of that: the bounded clock
  // only credits MAX_FRAME_MS of the 2000ms gap, so reaching the same
  // elapsed-clock finish line costs this run about (2000 - MAX_FRAME_MS)ms
  // of extra real frames the unstalled run never has to spend.
  const FPS_GAP = 1000 / 60
  const STALL_MS = 2000
  const totalDuration = NAME_FLIP_MS + target.length * NAME_LOCK_STEP_MS + STALL_MS + 1000
  function stalledFrames(): number[] {
    const frames: number[] = [0]
    let t = 0
    while (t < 100) {
      t += FPS_GAP
      frames.push(t)
    }
    t += STALL_MS // the stall — one frame arrives 2000ms later than the last
    frames.push(t)
    while (t < totalDuration) {
      t += FPS_GAP
      frames.push(t)
    }
    return frames
  }
  function unstalledFrames(): number[] {
    const frames: number[] = [0]
    let t = 0
    while (t < totalDuration) {
      t += FPS_GAP
      frames.push(t)
    }
    return frames
  }

  // Drives one frame sequence through the real bounded clock, returning the
  // phase-one indices and phase-two locked counts actually rendered, each
  // deduplicated to the *distinct* values reached (in order) — what a
  // person watching the gate would say they saw, not one entry per frame.
  function runBounded(frames: number[]): { indices: number[]; locked: number[] } {
    const clock = createDecodeClockState(frames[0])
    const indices: number[] = []
    const locked: number[] = []
    for (const t of frames) {
      const elapsed = advanceDecodeClock(clock, t)
      if (elapsed < NAME_FLIP_MS) {
        const idx = phaseOneIndexAt(elapsed)
        if (indices[indices.length - 1] !== idx) indices.push(idx)
      } else {
        const l = lockedCountAt(elapsed - NAME_FLIP_MS, target.length)
        if (locked[locked.length - 1] !== l) locked.push(l)
      }
    }
    return { indices, locked }
  }

  // The fault, reproduced directly: the old `now - start` arithmetic on the
  // same stalled sequence, with nothing capping the gap. Tracked as one
  // combined per-frame state (phase-one index, or phase-two locked count
  // once the flip hands over) so "how many distinct things did a person
  // watching actually see" is comparable to the bounded run above,
  // whichever phase this particular stall happens to land in — at this
  // repo's real NAME_FLIP_MS (8.5s), a 2.1s stall lands well inside phase
  // one, not phase two, so it is the *index* sequence this fault skips.
  function runUnbounded(frames: number[]): { states: number[] } {
    const start = frames[0]
    const states: number[] = []
    for (const t of frames) {
      const elapsed = t - start
      const v =
        elapsed < NAME_FLIP_MS
          ? phaseOneIndexAt(elapsed)
          : n + lockedCountAt(elapsed - NAME_FLIP_MS, target.length) // offset so the two phases can't collide
      if (states[states.length - 1] !== v) states.push(v)
    }
    return { states }
  }

  const stalled = runBounded(stalledFrames())
  const unstalled = runBounded(unstalledFrames())

  check(
    'bounded clock: phase one shows the identical sequence of names, stalled or not',
    JSON.stringify(stalled.indices) === JSON.stringify(unstalled.indices),
    `stalled ${JSON.stringify(stalled.indices)} vs unstalled ${JSON.stringify(unstalled.indices)}`,
  )
  check(
    'bounded clock: phase two locks every character from 0 to the target length, none skipped, stalled or not',
    JSON.stringify(stalled.locked) === JSON.stringify(unstalled.locked) &&
      stalled.locked[0] === 0 &&
      stalled.locked[stalled.locked.length - 1] === target.length,
    `stalled ${JSON.stringify(stalled.locked)} vs unstalled ${JSON.stringify(unstalled.locked)}`,
  )

  // The probe is shown to detect the fault it guards: run the *old*
  // `now - start` arithmetic over the same stalled sequence and confirm it
  // skips. At this repo's real NAME_FLIP_MS, a 100ms + 2000ms stall lands
  // inside phase one, so what the old arithmetic skips is names, not
  // characters — the "the animation didn't flip, it just jumped from an
  // old name to a much newer one" version of the same fault. `states`
  // counts distinct renders across both phases on the same footing, so
  // this compares directly against the bounded run's own total above.
  const unboundedStalled = runUnbounded(stalledFrames())
  const totalDistinctBounded = stalled.indices.length + stalled.locked.length
  check(
    'unbounded (old) arithmetic: the stall collapses several frames of names into one jump — the fault this entry fixes',
    unboundedStalled.states.length < totalDistinctBounded,
    `unbounded saw ${unboundedStalled.states.length} distinct renders across the whole decode; ` +
      `the bounded clock saw ${totalDistinctBounded} over the identical wall-clock frames`,
  )

  // Identity — Done-when's own words: unstalled, the accumulated clock
  // tracks wall time to within a millisecond at every frame. `MAX_FRAME_MS`
  // never binds at 60fps (16.7ms gaps), so this is really asserting the
  // clock adds nothing of its own; imported rather than restated so a
  // change to the cap here cannot silently stop being tested against.
  {
    const frames = unstalledFrames()
    const clock = createDecodeClockState(frames[0])
    let worstDrift = 0
    for (const t of frames) {
      const elapsed = advanceDecodeClock(clock, t)
      worstDrift = Math.max(worstDrift, Math.abs(elapsed - t))
    }
    check(
      `unstalled: the bounded clock matches wall time to within 1ms at every frame (cap is ${MAX_FRAME_MS}ms, frame gap is ~${FPS_GAP.toFixed(1)}ms)`,
      worstDrift < 1,
      `worst drift ${worstDrift.toFixed(3)}ms`,
    )
  }
}

console.log(failures === 0 ? '\nall name-decode checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
