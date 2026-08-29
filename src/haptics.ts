/**
 * Haptic confirmation.
 *
 * The visualiser is meant to be used without looking at the controls — a
 * phone propped up, or held and shaken. A shake that re-rolls the seed is
 * the one action with no obvious cause-and-effect on screen: the picture was
 * already moving, and it changes to a different picture that is also moving.
 * A short buzz is what tells you the phone heard you rather than the image
 * happening to wander.
 *
 * Deliberately narrow. This is not a "vibrate on every interaction" layer:
 * the HUD's controls are things you are already looking at and touching, and
 * buzzing on each one turns a quiet instrument into a pager.
 *
 * Support is one-sided in a way worth stating plainly, because it decides
 * what this can be used for: Android Chrome implements the Vibration API,
 * and Safari — iPhone and iPad both — does not implement it at all. There is
 * no polyfill; iOS exposes haptics only to native code and, narrowly, to a
 * `<label>`/switch trick that is not usable here. So this is a bonus on one
 * platform, absent on the other, and nothing may be built to depend on it.
 */

// .ts extension kept explicit: a probe script needs to import this file
// directly under `node --experimental-strip-types`, which requires it for
// any value import inside src/ — see CLAUDE.md.
import { STRONG_UP } from './shake.ts'

/**
 * A short confirmation buzz, as a pattern rather than one pulse.
 *
 * The history matters, because each step was reasonable and each was still
 * imperceptible. 22ms first, on the reasoning that anything under ~15 cannot
 * be felt and a confirmation should not read as an alert. Then 40ms, once it
 * was clear that plenty of Android actuators are rotational-mass motors
 * needing 30-40ms simply to spin up far enough to be felt — so 22 was a
 * request the hardware honoured by doing almost nothing. 40 was still not
 * felt on Victor's phone.
 *
 * The mistake in both was reaching for duration. A rotational-mass motor
 * spends most of a short pulse accelerating, so a flat pulse is mostly
 * spin-up and barely any output whatever its length; making it longer buys a
 * bigger buzz, not a *sharper* one, and a long single buzz reads as an error
 * rather than a confirmation. A short pulse followed by a longer one solves
 * the actual problem: the first primes the motor, the gap lets it settle, and
 * the second lands on a mass already moving.
 *
 * The gap is the load-bearing number and it is deliberately short. Two pulses
 * separated by less than roughly 50ms fuse into one textured event rather
 * than reading as two, which is what keeps this a confirmation and not a
 * double-tap — and, more to the point, keeps the *deliberate* double buzz
 * that a double shake will want (see docs/todo.md entry 6) distinguishable
 * from this one. If this pattern already felt like two things, that gesture
 * would have nothing left to say.
 *
 * The earlier comment here claimed a double-buzz "reads as an error on most
 * phones". That is true of two equal pulses far apart and not of this, and it
 * was written before there was any reason to want a second signal.
 */
const CONFIRM_PATTERN = [26, 34, 62]

/**
 * Scaling the pattern by how hard the shake was.
 *
 * `CONFIRM_PATTERN`/`DOUBLE_PATTERN` above are hard-won: two previous
 * durations were tried and neither was felt, and these were the first that
 * were. That makes them a floor, not a baseline to shrink from — scaling
 * intensity *down* for a merely-qualifying shake would reintroduce the exact
 * imperceptibility bug builds 68 and 76 were about. So intensity only ever
 * scales the patterns *up*: 1x at the quietest shake that still fires at all,
 * up to MAX_SCALE at a shake as hard as this app has been tested with.
 *
 * `STRONG_UP` (imported from shake.ts, not duplicated) is the least peak that
 * can ever reach here — Tumble never sets `strongPending`/`doublePending`
 * below it — so it is the correct zero point for "gentlest qualifying",
 * rather than an arbitrary guess. `PEAK_CEILING` matches probe-shake.ts's own
 * "violent shake" case (45 m/s², 6 Hz): the hardest shake this app's test
 * suite models, not a real physical limit, which does not exist.
 */
// Exported so scripts/probe-haptics.ts can compute expected values from the
// real numbers rather than duplicating them as a second copy that could
// silently drift out of step with this file.
export const PEAK_CEILING = 45
export const MAX_SCALE = 1.8

/**
 * `peak` in, a 1..MAX_SCALE multiplier out. Kept separate from the pattern
 * scaling itself so the WICG Web Haptics proposal's `intensity` (a plain
 * 0-1 number, see docs/todo.md entry 8) has somewhere to plug in later
 * without this file's internal pattern-scaling logic changing at all.
 */
function intensityMultiplier(peak: number): number {
  const t = Math.min(1, Math.max(0, (peak - STRONG_UP) / (PEAK_CEILING - STRONG_UP)))
  return 1 + t * (MAX_SCALE - 1)
}

/**
 * Stretches only the *on* pulses, at even indices — a vibrate() pattern
 * always starts with an on duration and alternates. The gaps (odd indices)
 * are left untouched: `CONFIRM_PATTERN`'s 34ms and `DOUBLE_PATTERN`'s 130ms
 * are what make a single read as one event and a double read as two, and
 * that signal must survive at any intensity, not just the one it was tuned at.
 */
function scalePattern(pattern: readonly number[], multiplier: number): number[] {
  return pattern.map((ms, i) => (i % 2 === 0 ? Math.round(ms * multiplier) : ms))
}

/**
 * Two events, deliberately — the double shake's confirmation.
 *
 * The gap is 130ms where CONFIRM_PATTERN's is 34, and that difference is the
 * entire signal. Under roughly 50ms two pulses fuse into one textured buzz;
 * well above it they read as two separate things. So a single shake feels like
 * one confirmation and a double feels like two, and you can tell which
 * happened without looking — which matters precisely because the picture
 * changed either way and the buzz is the only thing that says how much.
 */
const DOUBLE_PATTERN = [26, 34, 62, 130, 26, 34, 62]

/** Whether the platform has a vibrator we are allowed to use. Read once:
 *  this cannot change within a session, and `vibrate` being present is a
 *  property of the browser, not of the moment. */
const supported =
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

/**
 * Someone asked for reduced motion.
 *
 * Not obviously a haptics setting, and it is the closest thing the platform
 * offers: there is no `prefers-reduced-haptics`. The people who set it
 * include those who find device vibration unpleasant or physically
 * difficult, and a silent buzz costs them more than it costs us to skip it.
 * Queried live rather than cached, because unlike vibrator support this can
 * be changed mid-session from the OS.
 */
function reducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Confirm a gesture the user made without looking.
 *
 * Silent everywhere it is not supported, and never throws: Chrome rejects a
 * vibrate() call made without a prior user gesture on the page by returning
 * false, and some embedded webviews throw outright. Neither is worth a
 * branch at the call site — a missing buzz is a missing nicety.
 */
export function confirmBuzz(peak: number): void {
  buzz(scalePattern(CONFIRM_PATTERN, intensityMultiplier(peak)))
}

/** Confirm the bigger gesture. See DOUBLE_PATTERN. */
export function doubleBuzz(peak: number): void {
  buzz(scalePattern(DOUBLE_PATTERN, intensityMultiplier(peak)))
}

function buzz(pattern: readonly number[]): void {
  attempts++
  if (!supported) return
  if (reducedMotion()) {
    suppressed++
    return
  }
  try {
    // vibrate() returns false when the browser declines — most often for want
    // of a prior user gesture on the page. Recorded rather than ignored: a
    // declined call and a call the hardware fulfilled but the user could not
    // feel are different faults with different fixes.
    accepted += navigator.vibrate([...pattern]) ? 1 : 0
  } catch {
    // No vibrator, or a webview that lied about having one.
  }
}

let attempts = 0
let accepted = 0
let suppressed = 0

/**
 * Why there was no buzz.
 *
 * "No haptics on shake" has at least four causes and they are identical from
 * the outside: the shake never fired so nothing was requested; the platform
 * has no Vibration API; reduced-motion is suppressing it; or the browser
 * accepted the call and the phone's own settings or actuator produced nothing
 * anyone could feel. The first two are in this app, the third is an OS
 * accessibility setting, the fourth is out of reach entirely — and only the
 * numbers separate them.
 *
 * `attempts` rising with `accepted` while nothing is felt means the software
 * is doing its job and the phone is not: check that the device is not in a
 * silent profile with vibration off.
 */
export function hapticStatus(): {
  supported: boolean
  attempts: number
  accepted: number
  suppressed: number
} {
  return { supported, attempts, accepted, suppressed }
}
