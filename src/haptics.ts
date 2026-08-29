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

/** A short confirmation buzz, in ms.
 *
 *  Was 22, on the reasoning that anything under ~15 is imperceptible and a
 *  confirmation should not read as an alert. The floor was the right idea and
 *  the margin above it was far too thin: plenty of Android actuators are
 *  rotational-mass motors that need 30-40ms simply to spin up far enough to
 *  be felt, so 22 is a request the hardware honours by doing almost nothing.
 *  A buzz that fires correctly and cannot be felt is indistinguishable from
 *  no buzz at all, and that is how this shipped.
 *
 *  40 is still one short pulse, not a pattern — a double-buzz reads as an
 *  error on most phones. */
const CONFIRM_MS = 40

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
export function confirmBuzz(): void {
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
    accepted += navigator.vibrate(CONFIRM_MS) ? 1 : 0
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
