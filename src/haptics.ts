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

/** A short confirmation buzz, in ms. Long enough to feel deliberate on a
 *  phone's actuator — below about 15ms most Android hardware produces
 *  nothing perceptible at all — and short enough not to read as an alert.
 *  A pattern rather than a single pulse is tempting here and wrong: a
 *  double-buzz reads as an error on most phones. */
const CONFIRM_MS = 22

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
  if (!supported || reducedMotion()) return
  try {
    navigator.vibrate(CONFIRM_MS)
  } catch {
    // No vibrator, or a webview that lied about having one.
  }
}
