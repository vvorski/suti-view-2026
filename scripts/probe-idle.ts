/**
 * Headless exercise of the gate's idle preview throttle.
 *
 * Neither of the two primitives this behaviour is built from can be trusted
 * in this harness: `requestAnimationFrame` never fires in a non-frontmost
 * automation window, and `setTimeout` is throttled to roughly 1Hz there too.
 * The decision logic in `idle-preview.ts` has no dependency on either — it
 * takes plain timestamps — so it is driven with synthetic ones instead, the
 * same way `probe-shake.ts` drives `Tumble` with synthetic accelerometer
 * samples.
 *
 *   node --experimental-strip-types scripts/probe-idle.ts
 */

import { IdlePreview } from '../src/idle-preview.ts'

const FRAME_MS = 1000 / 30
const TIMEOUT_MS = 60_000

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

// 1. Thinned to ~30fps against a 60Hz display, not the display's own rate.
//
// A wide tolerance band, not a tight one, and deliberately so: `1000/30` is
// mathematically exactly `2 * (1000/60)`, so every render boundary sits on a
// knife-edge tie between two consecutive 60Hz ticks. Accumulating `t += 1000/60`
// in a loop drifts by a few ulps each step, and whichever way that drift
// leans occasionally turns a tie into a miss — a 3-tick gap instead of 2 — the
// first time this ran it produced 53 renders, not 60. That is a fact about
// floating-point accumulation, not about the throttle: check 2, on an
// unrelated cadence, is the one that pins down the guarantee that actually
// matters (never faster than FRAME_MS), and it has no such tie to land on.
{
  const idle = new IdlePreview(0, FRAME_MS, TIMEOUT_MS)
  let rendered = 0
  let ticks = 0
  for (let t = 0; t < 2000; t += 1000 / 60) {
    ticks++
    if (idle.tick(t)) rendered++
  }
  check(
    'thinned to roughly half the raw 60Hz ticks',
    rendered >= ticks * 0.4 && rendered <= ticks * 0.55,
    `${rendered} renders from ${ticks} ticks, expected 40-55%`,
  )
}

// 2. Never renders faster than FRAME_MS apart, whatever the input rate.
{
  const idle = new IdlePreview(0, FRAME_MS, TIMEOUT_MS)
  let last = -Infinity
  let violation = -1
  for (let t = 0; t < 2000; t += 1000 / 120) {
    if (idle.tick(t)) {
      if (t - last < FRAME_MS - 0.001 && last !== -Infinity) violation = t
      last = t
    }
  }
  check('no two renders closer than FRAME_MS apart', violation < 0, `violated at t=${violation}`)
}

// 3. Stops after TIMEOUT_MS of no activity, and stays stopped.
{
  const idle = new IdlePreview(0, FRAME_MS, TIMEOUT_MS)
  let stillTicking = true
  for (let t = 0; t < TIMEOUT_MS + 5000; t += FRAME_MS) {
    idle.tick(t)
    if (t > TIMEOUT_MS + 1000 && !idle.isStopped) stillTicking = false
  }
  check('stops within the timeout', idle.isStopped, 'never set isStopped')
  check('does not un-stop on its own', stillTicking, 'isStopped flapped back to false')
}

// 4. Activity before the timeout postpones it indefinitely.
{
  const idle = new IdlePreview(0, FRAME_MS, TIMEOUT_MS)
  for (let t = 0; t < TIMEOUT_MS * 3; t += FRAME_MS) {
    // A touch every 10 seconds — comfortably inside the 60s window.
    if (Math.round(t) % 10_000 < FRAME_MS) idle.touch(t)
    idle.tick(t)
  }
  check('regular activity prevents stopping', !idle.isStopped, 'stopped despite touches')
}

// 5. touch() after stopping clears the flag, so the caller knows to restart
//    the frame chain it deliberately stopped scheduling.
{
  const idle = new IdlePreview(0, FRAME_MS, TIMEOUT_MS)
  idle.tick(TIMEOUT_MS + 100)
  const wasStopped = idle.isStopped
  idle.touch(TIMEOUT_MS + 200)
  check('was actually stopped first', wasStopped, 'test setup did not reach stopped state')
  check('touch() clears isStopped', !idle.isStopped, 'still stopped after touch()')
  check('renders again after resuming', idle.tick(TIMEOUT_MS + 250), 'no render on the resuming tick')
}

console.log(failures === 0 ? '\nall idle-preview checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
