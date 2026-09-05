/**
 * Offline check of the space bar's synthetic shake (docs/todo.md entry 126):
 * does a real `ShakeSensor` see a single tap as one strong shake and a
 * two-second hold as several, does an unheld state feed it nothing at all,
 * does the peak clear the amplitude Decided names, does `hasMotionData()`
 * stay false throughout (the assertion that would fail if it still read the
 * sample count, as it did before this entry), and — entry 104's own
 * acceptance test, reused rather than re-invented — does the held bearing
 * this feeds `updateRgbSlip` survive a whole burst with zero direction
 * reversals.
 *
 * Drives the real `startShake(false)` — the exact object main.ts holds on
 * every desktop, `granted` false here because a probe has no permission
 * gesture to grant — through its own `pushSample`/`frame()` pair, fed by
 * `updateSynthShake`'s own output. Never a hand-rolled sine standing in for
 * either: this is the only assertion that actually proves the space bar
 * produces a real shake response through the real object, rather than a
 * plausible-looking synthetic one built to make a test pass. See
 * `probe-shake.ts`'s own file comment: a phone is the only thing that
 * produces real accelerometer data, and a laptop is exactly the opposite —
 * the one device this feature has to be tuned against without ever holding
 * one.
 *
 *   node --experimental-strip-types scripts/probe-synth-shake.ts
 */

import { startShake } from '../src/shake.ts'
import { createRgbSlipState, updateRgbSlip } from '../src/engine/rgb-slip.ts'
import { createSynthShake, startSynthShake, updateSynthShake } from '../src/engine/synth-shake.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const HZ = 60
const DT = 1 / HZ

/** Drives a real `ShakeSensor` (no `window`, `granted` false — the same
 *  object a desktop main.ts holds) for `seconds` held, then releases and
 *  keeps driving until the release tail (`updateSynthShake`'s own decay) is
 *  fully spent — the only way to see everything a press actually produces,
 *  tap or hold alike. */
function runHeld(seconds: number): {
  strongs: number
  doubles: number
  peakMag: number
  hasMotionData: boolean
} {
  const sensor = startShake(false)
  const state = createSynthShake()
  startSynthShake(state)

  let strongs = 0
  let doubles = 0
  let peakMag = 0

  const drain = (held: boolean): void => {
    const sample = updateSynthShake(state, DT, held)
    if (sample) {
      sensor.pushSample(sample, DT)
      peakMag = Math.max(peakMag, Math.hypot(sample.x, sample.y, sample.z))
    }
    const frame = sensor.frame(DT)
    const event = frame.events[0]
    if (event?.kind === 'double') doubles++
    else if (event?.kind === 'strong') strongs++
  }

  let t = 0
  while (t < seconds) {
    drain(true)
    t += DT
  }
  // The release tail: keep calling with held=false until updateSynthShake
  // stops producing anything, which is what a real key-up followed by
  // main.ts's own per-frame loop would do.
  for (let i = 0; i < HZ * 2; i++) {
    drain(false)
    if (updateSynthShake(state, DT, false) === null) break
  }

  return { strongs, doubles, peakMag, hasMotionData: sensor.hasMotionData() }
}

// 1. A tap — held for exactly one burst (Decided's own "0.35s") — produces
//    exactly one strong shake, not zero (too gentle to detect) and not
//    several (the reversal counter re-triggering within one gesture).
{
  const r = runHeld(0.35)
  check(
    'a single 0.35s burst produces exactly one strong event',
    r.strongs + r.doubles === 1,
    `strongs=${r.strongs} doubles=${r.doubles}`,
  )
}

// 2. Held for two seconds. docs/todo.md entry 126's own Done-when asks for
//    "at least three" shake events here — measured against the real
//    `Tumble` this entry feeds, that figure does not hold, and not because
//    of anything this file gets wrong.
//
//    `shake.ts`'s own QUIET_GAP (0.15s) exists specifically to stop a single
//    continuous shake from re-firing: its own comment records that without
//    it, "one long shake trips the reversal counter over and over inside
//    the cooldown", which the entry that added QUIET_GAP measured as four
//    spurious doubles from one sustained shake — a bug, not a feature. A
//    smooth, unbroken oscillation (this file's own synthetic signal, but
//    also `probe-shake.ts`'s own hand-authored `shaking()` — checked below,
//    independent of anything entry 126 built) never produces a contiguous
//    0.15s dip below `currentStrongDown()`, so `armedForDouble` never
//    becomes true and neither a second single nor a double ever fires: the
//    reversal counter completes its three crossings roughly every 0.6s at
//    5Hz, which keeps re-arming `cooldown`/`doubleWindow` before either can
//    lapse. One continuous press is therefore, correctly, one shake event —
//    not three, not repeating — for as long as it stays a single unbroken
//    gesture with no real pause in it. Held space is a repeating hard shake
//    in the sense that matters (the tumble keeps oscillating, disturb stays
//    high, the picture keeps moving) but it does not repeatedly re-seed
//    without an actual gap, which is the same thing a real, physically
//    continuous shake would also do against this exact mechanism.
//
//    Recorded here as a finding rather than forced: bending QUIET_GAP or the
//    escalation logic to make three fire in two seconds would undo a
//    deliberate, reasoned fix for a real, measured bug — CLAUDE.md's own
//    "a reasoned comment outranks an entry that did not know about it." See
//    docs/todo.md's own follow-up entry for the question this puts to
//    Victor: whether a held space bar should re-seed on a timer of its own
//    (which nothing here builds) or whether one shake per unbroken press,
//    exactly as a real continuous shake already behaves, is the right
//    reading of "repeating hard shake" after all.
{
  const r = runHeld(2.0)
  check(
    'two seconds held, unbroken, produces exactly one shake event — see the comment above on why entry 126\'s own "at least three" does not hold against the real, deliberately-protected Tumble',
    r.strongs + r.doubles === 1,
    `strongs=${r.strongs} doubles=${r.doubles}`,
  )
  // The amplitude Decided derives: 26 m/s², to clear the busy adaptive bar
  // (STRONG_UP_BUSY = 20) by 30% rather than only the resting one.
  // 1e-9 tolerance: AMPLITUDE * 1 * sin(...) at its own peak is 26 by
  // construction, and floating point can land a hair under it (25.999999…)
  // rather than exactly on it.
  check('the peak magnitude reaches at least 26 m/s²', r.peakMag >= 26 - 1e-9, `peak=${r.peakMag.toFixed(6)}`)
  // The one line that keeps a synthesised shake from telling entry 110's
  // Strata or entry 116's camera-arm that a desktop has an accelerometer.
  // This is the assertion that would have failed against the old
  // `tumble.diagnostics().samples > 0` implementation — every case here fed
  // the sensor plenty of samples, so a `hasMotionData` reading them would
  // read true throughout, exactly backwards from what a synthetic shake
  // should report.
  check('hasMotionData() stays false throughout, even mid-hold', r.hasMotionData === false, String(r.hasMotionData))
}

// The same property, against `probe-shake.ts`'s own hand-authored driving
// function rather than anything entry 126 built — confirms the finding
// above is a fact about `Tumble`, not an artefact of this file's synthesis.
{
  const G = 9.81
  const shaking = (t: number, amp: number, hz: number) => {
    const a = Math.sin(t * hz * Math.PI * 2) * amp
    return { x: a, y: -G, z: 0, spin: a * 0.1 }
  }
  const sensor = startShake(false)
  for (let i = 0; i < 30; i++) sensor.pushSample({ x: 0, y: -G, z: 0, spin: 0 }, DT)
  let strongs = 0
  let doubles = 0
  let t = 0
  while (t < 6) {
    sensor.pushSample(shaking(t, 28, 4), DT)
    const frame = sensor.frame(DT)
    if (frame.events[0]?.kind === 'double') doubles++
    else if (frame.events[0]?.kind === 'strong') strongs++
    t += DT
  }
  check(
    'a real, continuous, unbroken 28 m/s²/4Hz shake also fires exactly once in six seconds — not an artefact of this entry\'s own synthesis',
    strongs + doubles === 1,
    `strongs=${strongs} doubles=${doubles}`,
  )
}

// 4. Unheld, from a clean state, produces nothing at all — the identity
//    case. A `ShakeSensor` that is never pushed a sample reports exactly
//    `STILL_FRAME`'s own zeroes, which is what makes a desktop that never
//    touches the space bar indistinguishable from one running this entry's
//    code today.
{
  const sensor = startShake(false)
  const state = createSynthShake()
  let pushed = 0
  let disturb = -1
  for (let i = 0; i < HZ * 2; i++) {
    const sample = updateSynthShake(state, DT, false)
    if (sample) {
      pushed++
      sensor.pushSample(sample, DT)
    }
    disturb = sensor.frame(DT).disturb
  }
  check('an unheld state produces zero samples', pushed === 0 && sensor.diagnostics().samples === 0, `pushed=${pushed} samples=${sensor.diagnostics().samples}`)
  check('and leaves disturb at exactly 0', disturb === 0, String(disturb))
  check('and hasMotionData() is false', sensor.hasMotionData() === false, String(sensor.hasMotionData()))
}

// 5. entry 104's own acceptance test, reused rather than re-invented: the
//    held direction a burst feeds `updateRgbSlip` must survive the whole
//    burst with zero sign reversals — the "fold onto the axis already held"
//    fix entry 104 made, exercised here against a *synthesised* signal
//    rather than only the hand-written sine `probe-rgb-slip.ts` uses. A
//    fixed bearing per press is exactly what makes this hold: unlike a
//    bearing re-rolled every frame (the fault Decided names), one held for
//    the whole gesture is the same axis on every half-cycle.
{
  const sensor = startShake(false)
  const slip = createRgbSlipState()
  const state = createSynthShake()
  startSynthShake(state)

  let reversals = 0
  let lastSign = 0
  let peakLen = 0
  let t = 0
  const seconds = 2.0
  while (t < seconds) {
    const sample = updateSynthShake(state, DT, true)
    if (sample) sensor.pushSample(sample, DT)
    const frame = sensor.frame(DT)
    const off = updateRgbSlip(slip, DT, frame.disturb, frame.tumble.accelX, frame.tumble.accelY, 0)
    const len = Math.hypot(off.x, off.y)
    if (len > peakLen) peakLen = len
    if (len > 1e-7) {
      const sign = Math.sign(off.x) || Math.sign(off.y)
      if (sign !== 0) {
        if (lastSign !== 0 && sign !== lastSign) reversals++
        lastSign = sign
      }
    }
    t += DT
  }
  check(
    'the held bearing produces zero RGB-slip direction reversals through a two-second burst',
    reversals === 0,
    `reversals=${reversals} peak=${peakLen.toFixed(5)}`,
  )
}

console.log(failures === 0 ? '\nall synth-shake checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
