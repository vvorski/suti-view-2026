/**
 * The phone itself as an input.
 *
 * Two responses, on two intensities, because one threshold would make the
 * device feel like a switch rather than something holding a live picture:
 *
 *   Any disturbance tumbles the image. Rotation and drift, kicked by the
 *   actual motion and sprung back to rest, so a nudge produces a nudge and
 *   the frame settles on its own. This is continuous and has no threshold to
 *   cross — walking with the phone should show, faintly.
 *
 *   A hard, deliberate shake re-rolls the seed. Discrete, and it has to be
 *   earned: see the oscillation counter below.
 *
 * Splitting them this way means the small response is always available to
 * confirm the device is being listened to, and the large one never fires by
 * accident while the small one is happening.
 *
 * Everything here except `startShake` is a pure function of samples and dt,
 * with no DOM and no clock of its own — same discipline as mapping.ts and
 * features.ts, and for the same reason: it can then be driven from synthetic
 * data in a headless harness, which is the only practical way to tune
 * thresholds for a sensor that needs a physical phone to exercise.
 */

/** What the renderer needs to draw the tumble. */
export interface TumbleState {
  /** 0-1, how agitated the device is. Reported for tuning; nothing draws it. */
  disturb: number
  /** Image rotation, radians. */
  angle: number
  /** Image drift, in uv units. */
  offsetX: number
  offsetY: number
  /** Overscan that keeps the rotated, drifted frame from showing its edges. */
  zoom: number
  /**
   * docs/todo.md entry 104 — the raw in-plane acceleration (m/s², gravity
   * already subtracted, screen x/y axes) behind the most recent sample, held
   * at that value between samples rather than decayed or zeroed. This is the
   * same `ax`/`ay` the offset spring's own kicks are built from, exposed
   * before it becomes a spring: `offsetX`/`offsetY` above oscillate through
   * zero as that spring rings, which is exactly what a direction taken from
   * them cannot survive (see rgb-slip.ts). A raw sample has no such
   * oscillation — it is only ever as noisy as the sensor itself.
   */
  accelX: number
  accelY: number
}

/** One accelerometer reading. Units are m/s², as DeviceMotionEvent reports. */
export interface MotionSample {
  x: number
  y: number
  z: number
  /** Rotation about the screen normal, radians/s. 0 when unavailable. */
  spin: number
}

// --- Disturbance -----------------------------------------------------------

/** Below this much AC acceleration the device is treated as still. A phone
 *  face-up on a table reads a few hundredths; a hand holding it reads a few
 *  tenths. 1.2 sits above both without needing real movement to clear it. */
const FLOOR = 1.2
/** AC acceleration at which `disturb` saturates. A brisk wave of the arm. */
const FULL = 14

/** Gravity is estimated as the slow-moving part of the raw reading and
 *  subtracted, rather than differencing consecutive samples. Differencing also
 *  removes gravity but it is a high-pass with a very high corner, so it turns
 *  sensor noise into signal and loses the direction of the motion — and the
 *  direction is exactly what the tumble is kicked with. */
const GRAVITY_TAU = 0.5

// --- Strong shake ----------------------------------------------------------

/**
 * A shake is oscillatory; a knock is not. Setting a bar on peak acceleration
 * alone cannot tell them apart — putting the phone down hard clears any
 * threshold a real shake clears. So this counts direction reversals instead:
 * the magnitude has to cross UP, fall back below DOWN, and do that
 * REVERSALS times inside WINDOW seconds. A single impact gives one crossing
 * and its rebound gives at most two; three means the phone is being shaken.
 */
// Exported: haptics.ts's intensity scaling reads this as its own scale's
// zero-point. docs/todo.md entry 88 — this is no longer literally "the bar
// a shake has to clear to fire" (STRONG_UP_CALM/BUSY below are, and they can
// sit under this); it stays fixed as the scale's own reference regardless,
// which envelopePeak()'s own floor (always >= this) is what actually
// guarantees: whatever a caller receives is never below this value, however
// low the adaptive bar that let the shake through happened to be.
export const STRONG_UP = 18
/**
 * The hardest shake this app is calibrated against, not a real physical
 * limit (none exists). Exported alongside `intensity()` below rather than
 * left for `haptics.ts` to recompute a second time from the same two
 * numbers.
 *
 * Was 45 — probe-shake.ts's own "violent shake" case sampled at 6 Hz. That
 * was the wrong thing to calibrate against: a shake's *reported* peak falls
 * as sampling rate rises (an accelerometer that reads faster catches less
 * of any single spike), so 45 was the best-sampled case in the suite, not
 * the ceiling real hardware produces. The same violent shake sampled at
 * 12 Hz reports 40.6, and `intensity()`'s top rung needed 42.3 — unreachable
 * in practice, not merely hard. docs/todo.md entry 36 lowers it to 36,
 * which saturates both violent cases at 1.00 (the 12 Hz one clears the rung
 * by 6.4 m/s² rather than missing it) while a deliberate shake still lands
 * at 0.54 — short of the top two rungs, so "everything" still has to be
 * meant. **Mine** as to the exact value.
 */
export const PEAK_CEILING = 36

/**
 * A shake's peak (m/s²), scaled to 0-1: 0 at STRONG_UP (the least peak that
 * can ever reach a caller — nothing fires below it), 1 at PEAK_CEILING.
 *
 * One scale, two consumers: the buzz's intensity (haptics.ts) and the
 * shuffle's depth (main.ts, docs/todo.md entry 15) both derive from this
 * rather than each calibrating their own copy of "how hard was that".
 */
export function intensity(peak: number): number {
  return Math.min(1, Math.max(0, (peak - STRONG_UP) / (PEAK_CEILING - STRONG_UP)))
}

/**
 * docs/todo.md entry 85. A stand-in "peak" for `intensity()` above, derived
 * from the `disturb` envelope rather than an instantaneous sample maximum —
 * see `SUSTAIN_LEVEL`'s own comment for why the envelope, and only the
 * envelope, does not care what rate the sensor reports at.
 *
 * Called at both `detectSustained`'s and `detectStrong`'s own peak snapshots
 * (`Math.max(this.peak, envelopePeak(this.envelope))`), never in place of
 * `this.peak` outright: a hard shake's own instantaneous peak is already
 * correct and already above what this ever produces, so the max leaves it
 * exactly as it read before this entry, and only a shake whose true peak
 * the sensor never actually caught — because it was gentle (defect 1) or
 * because the sample rate missed it (defect 2) — is lifted by this at all.
 *
 * Calibrated, not derived: `SUSTAIN_LEVEL` (0.55, the least envelope that
 * can ever reach here) maps to 0.30 on `intensity()`'s own 0-1 scale — just
 * past `SHUFFLE_RESEED` in main.ts, never below it — and full saturation
 * (envelope 1) maps to 0.55, close to what a genuinely hard shake's own raw
 * peak already reports natively. **Mine** — the entry names the target
 * range (0.35-0.5 for a gentle sustained shake) but not these two numbers;
 * probe-shake.ts's own new checks are what actually pins them down.
 */
function envelopePeak(envelope: number): number {
  const ENVELOPE_DEPTH_FLOOR = 0.3
  const ENVELOPE_DEPTH_SPAN = 0.25
  const depth = clamp01(ENVELOPE_DEPTH_FLOOR + (ENVELOPE_DEPTH_SPAN * (envelope - SUSTAIN_LEVEL)) / (1 - SUSTAIN_LEVEL))
  return STRONG_UP + depth * (PEAK_CEILING - STRONG_UP)
}

/**
 * docs/todo.md entry 88 — the reversal path's own bar moves with how much
 * the phone has been moving lately, between these two bounds, rather than
 * sitting at a flat 18 always. `STRONG_UP` above (18) is deliberately left
 * exactly where it was: `intensity()` and `envelopePeak()` still anchor
 * their own 0-1 scale to it, so a shake that clears the *lowered* bar in a
 * quiet room reports proportionately low on that scale rather than a
 * moving zero-point retuning the buzz and the shuffle depth underneath
 * this entry's own feet. Only the fire-or-not decision moves; what a fired
 * shake is worth once it does never does.
 *
 * 13 calm, 20 busy — Decided's own numbers, not derived. `STRONG_DOWN`
 * below is a ratio of whichever of these is currently in force, not a
 * third independent bound.
 */
const STRONG_UP_CALM = 13
const STRONG_UP_BUSY = 20

/** docs/todo.md entry 88 — SUSTAIN_LEVEL's own calm/busy bounds, same
 *  reasoning as STRONG_UP_CALM/BUSY above: the constant `SUSTAIN_LEVEL`
 *  (0.55) stays put as envelopePeak()'s own calibration floor. */
const SUSTAIN_LEVEL_CALM = 0.45
const SUSTAIN_LEVEL_BUSY = 0.6

/** docs/todo.md entry 88 — how long a slow mean of `disturb` takes to
 *  follow a change in how much the phone has been moving: long enough that
 *  walking to a stage raises the bar rather than a moment's fidget, short
 *  enough that setting the phone down for half a minute makes it eager
 *  again. Decided's own number. */
const CALM_TAU = 25

const STRONG_DOWN = 7
/** docs/todo.md entry 88 — STRONG_DOWN's own ratio to STRONG_UP (today's
 *  fixed 18, the same reference `intensity()` uses), reapplied to whichever
 *  bar is currently in force so the hysteresis band narrows and widens with
 *  it rather than staying fixed while the top of the band moves — a fixed
 *  STRONG_DOWN against a lowered bar would start counting the same swing as
 *  more than one reversal. */
const STRONG_DOWN_RATIO = STRONG_DOWN / STRONG_UP
const STRONG_REVERSALS = 3
const STRONG_WINDOW = 1.2
/** Long enough that one shake cannot read as two, short enough that shaking
 *  again immediately still works. */
const STRONG_COOLDOWN = 1.5

/**
 * How long the escalation stays armed for a second shake to land inside.
 *
 * Separate from STRONG_COOLDOWN on purpose — that constant was doing two
 * unrelated jobs. One shake earning three reversals at a hand's ~4Hz takes
 * about 0.75s by itself, so a 1.5s cooldown left under 0.75s of actual pause
 * available before the second shake had to be fully earned too — less than a
 * deliberate pause between two shakes, which is why a real double never
 * escalated on a phone even though every synthetic one in probe-shake.ts did
 * (its only double case spaces the two bursts 0.35s apart, faster than a hand
 * can pause).
 *
 * 3.0s: enough to hold a pause (~1s) plus the second shake earning itself
 * (~0.75s) plus hesitation, which 2.0 barely covers. Above ~4s a person who
 * shakes, looks at the result, and shakes again unrelated gets an unasked-for
 * shuffle; 3.0 sits below that.
 */
const DOUBLE_WINDOW = 3.0

/**
 * How long the motion has to fall quiet before a second shake counts as one.
 *
 * Without this the escalation fires on *continued* shaking rather than on a
 * second gesture: one long shake trips the reversal counter over and over
 * inside the cooldown, and the probe duly reported four doubles from a single
 * sustained shake and two more from a pair spaced two seconds apart.
 *
 * A gap is what makes two shakes two. 0.15s is chosen against the oscillation
 * rather than picked round: during a 4 Hz shake the magnitude sits below
 * STRONG_DOWN for only about 0.04s per half-cycle, so a continuous shake can
 * never accumulate this much quiet, while an actual pause between two shakes
 * clears it almost immediately.
 */
const QUIET_GAP = 0.15

/**
 * The second way to earn a re-roll: sustained agitation, rather than counted
 * peaks.
 *
 * The reversal counter above is precise and brittle. It asks the *instant-
 * aneous* magnitude to exceed 18, fall under 7, and do so three times — and
 * every one of those numbers is a thing that can quietly not happen on a real
 * handset. A device whose accelerometer reads low never reaches 18. A device
 * that reports only `acceleration` rather than `accelerationIncludingGravity`
 * delivered nothing at all until this was fixed. A device that samples slowly
 * can land between a shake's peaks. Each failure is invisible and each one
 * presents identically: shaking the phone does nothing, forever.
 *
 * So this path asks a much weaker question that is far harder to answer
 * accidentally: has the device been *continuously agitated* for a moment?
 * `disturb` is already normalised against FLOOR and FULL, so it does not care
 * what absolute numbers the sensor reports, and it is computed from every
 * sample regardless of rate.
 *
 * The levels come straight from the probe table, which is why they reject
 * what they need to reject: walking peaks at disturb 0.15, well under LEVEL.
 * A nudge reaches 0.54 and a hard jolt 0.57, but both are over inside 0.2s,
 * well under TIME. A single knock and a knock-plus-rebound both hit 0.98 and
 * last 0.09s and 0.18s respectively — the two cases the whole design exists
 * to reject, and TIME is more than twice the longer of them. A deliberate
 * shake holds 0.98 for as long as it goes on.
 *
 * TIME is therefore the load-bearing value, not LEVEL: it is what separates
 * an impact from shaking, and shortening it toward 0.3 lets a knock and its
 * rebound through.
 *
 * The level is tested against a decaying envelope of `disturb`, not against
 * `disturb` itself. That is not a refinement, it is the difference between
 * working and not: acceleration magnitude is oscillatory, so during a real
 * shake `disturb` returns to near zero twice per cycle. Timing the raw signal
 * above a level therefore resets every ~0.17s at 3 Hz and never accumulates,
 * and the first version of this fired on nothing at all. The probe's gentle-
 * shake rows are what showed it.
 *
 * ENVELOPE_TAU is then constrained from both sides. Too fast and it tracks
 * those same dips and nothing accumulates; too slow and an impact's decay
 * tail keeps the envelope up long enough to look sustained. At 0.5s a 3 Hz
 * shake stays above LEVEL between peaks, while a knock plus its rebound tops
 * out around 0.47s of apparent agitation — which is why TIME is 0.6 and not
 * the 0.45 it was before the tail was accounted for.
 */
const SUSTAIN_LEVEL = 0.55
const SUSTAIN_TIME = 0.6
const ENVELOPE_TAU = 0.5

// --- Tumble spring ---------------------------------------------------------

/**
 * Both axes are damped harmonic oscillators pulled back to rest, not decays.
 * A decay would slide the image back to centre and stop, which reads as an
 * animation playing; a spring overshoots and settles, which reads as something
 * with weight being disturbed. Damping ratios are deliberately under 1 so the
 * overshoot is visible.
 *
 * STIFF is ω², DAMP is 2ζω. Rotation sits at ω ≈ 12.6 rad/s (a 0.5 s period),
 * drift lower at ω ≈ 8.9, so the two do not move as one rigid object.
 *
 * ζ is 0.4 on both. That is a deliberate compromise rather than the prettiest
 * number: ζ ≈ 0.25 gives a nicer overshoot, but the rotation spring's natural
 * frequency is ~2 Hz, which is also the frequency of walking, and at ζ = 0.25
 * the resonant gain is 2× — carrying the phone would slowly wind the image up
 * to its cap. At 0.4 the gain is ~1.25 and it still visibly overshoots.
 */
const ROT_STIFF = 158
const ROT_DAMP = 10.1
const OFF_STIFF = 80
const OFF_DAMP = 7.1

/** How hard motion kicks each spring. Tuned so an ordinary handling nudge is
 *  clearly visible and a hard shake reaches the caps below without pinning. */
const ROT_KICK = 18.0
const OFF_KICK = 0.20

/** Caps. Past these the image reads as broken rather than disturbed, and the
 *  overscan needed to hide the edges would be a visible zoom. */
const MAX_ANGLE = 0.26
// Exported: docs/todo.md entry 30 sums a steady gravity offset onto this
// same spring-driven one and needs the identical cap, in scene.ts, so a
// tilted-and-shaken phone still clamps to one shared edge rather than two
// slightly different ones.
export const MAX_OFFSET = 0.055

/** A nominal 1g in the units DeviceMotionEvent reports (m/s²). Used only to
 *  turn the gravity estimate's horizontal component into -1..1 = sin(tilt) —
 *  see `gravity()`. Not a claim about the local gravitational constant,
 *  which no phone accelerometer is precise enough to need. */
const EARTH_G = 9.81

/** How far a full 90° tilt may push the picture, as a fraction of
 *  MAX_OFFSET — docs/todo.md entry 30. **Mine**: leaves the remaining 40%
 *  of the cap for a shake to still visibly kick into on top of a held tilt,
 *  rather than the spring pinning against a cap gravity already occupies. */
const GRAVITY_FRACTION = 0.6

/** Motion smaller than this does not kick at all, so a phone held still is
 *  perfectly still rather than jittering on sensor noise. */
const KICK_DEADZONE = 0.35

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
const clampAbs = (v: number, max: number): number =>
  v > max ? max : v < -max ? -max : v

/**
 * Enough overscan to cover the corner a rotated, drifted frame exposes.
 * Rotating a unit-square frame by θ about its centre needs roughly θ of
 * extra scale at these small angles; drift needs twice its own size, being
 * one-sided.
 *
 * Exported and shared rather than kept private to `advance()`: docs/todo.md
 * entry 30 adds a steady gravity offset to the spring's own in scene.ts,
 * after `advance()` has already returned, so the overscan for the *combined*
 * offset — which can be larger than the spring's own alone — has to be
 * recomputed there from the same formula rather than a second copy of it.
 */
export function overscanFor(angle: number, offsetX: number, offsetY: number): number {
  return Math.min(0.3, Math.abs(angle) * 0.8 + (Math.abs(offsetX) + Math.abs(offsetY)) * 2.2)
}

/**
 * Turns a stream of accelerometer samples into a tumble, and raises an edge
 * when the device is shaken hard.
 *
 * Samples and frames are separate calls because they arrive at different
 * rates: `devicemotion` fires at its own cadence (~60 Hz on iOS, wildly
 * variable on Android) while the tumble has to advance once per rendered
 * frame whether a sample arrived or not.
 */
export class Tumble {
  private gravX = 0
  private gravY = 0
  private gravZ = 0
  private seeded = false

  private disturb = 0
  /** docs/todo.md entry 104 — the raw in-plane acceleration behind the most
   *  recent sample. See TumbleState's own `accelX`/`accelY` comment. */
  private accelX = 0
  private accelY = 0
  /** Kicks accumulated since the last frame, applied on advance. */
  private pendingSpin = 0
  private pendingX = 0
  private pendingY = 0

  private angle = 0
  private angVel = 0
  private offX = 0
  private offY = 0
  private velX = 0
  private velY = 0

  private above = false
  private reversals = 0
  private windowLeft = 0
  private cooldown = 0
  /** Counts down from DOUBLE_WINDOW alongside `cooldown`, but on its own
   *  clock — see DOUBLE_WINDOW's comment for why one timer had to become two. */
  private doubleWindow = 0
  private strongPending = false
  private doublePending = false
  /** `peak` at the instant each pending flag above was set, so the caller can
   *  tell a shake that barely qualified from one that nearly threw the phone.
   *  Snapshotted rather than read fresh in `takeStrong`/`takeDouble`, because
   *  `peak` keeps decaying every `advance()` between the sample that detected
   *  the shake and whichever later frame actually polls for it. */
  private strongPeak = 0
  private doublePeak = 0
  /** Quiet accumulated since the last time the motion was above STRONG_DOWN.
   *  Only meaningful inside a cooldown; see QUIET_GAP. */
  private quietFor = 0
  /** The motion has stopped since the last shake, so the next one is a second
   *  gesture rather than a continuation of the first. */
  private armedForDouble = false

  /**
   * A steady offset from how the phone is being held, independent of
   * motion — docs/todo.md entry 30. In the same uv units as `TumbleState`'s
   * own `offsetX`/`offsetY`, so the caller can add them directly.
   *
   * `gravX`/`gravY` are the low-pass DC estimate `sample()` already
   * maintains purely so it can be subtracted back out; the direction it
   * points is thrown away everywhere else. Dividing by EARTH_G turns "how
   * many g's of horizontal component" into -1..1 = sin(tilt), which is 0
   * face-up and ±1 at a 90° tilt — the entry's own "up to 0.6 × MAX_OFFSET
   * at 90° of tilt".
   *
   * The sign against screen axes is deliberately not asserted here — see
   * the entry's own note that it needs confirming against `?debug` on a
   * real handset rather than reasoned out from memory.
   */
  gravity(): { x: number; y: number } {
    const cap = MAX_OFFSET * GRAVITY_FRACTION
    const t = this.tilt()
    return { x: t.x * cap, y: t.y * cap }
  }

  /**
   * The uncapped tilt itself, -1..1 = sin(tilt) per axis — docs/todo.md
   * entry 46. `gravity()` above is this multiplied by a cap that means
   * something to the tumble (`MAX_OFFSET * GRAVITY_FRACTION`) and nothing to
   * a grain of powder, which wants the raw figure to accelerate by instead.
   * `gravity()` is expressed in terms of this rather than the reverse —
   * dividing a capped value back out at a call site is how two meanings of
   * "tilt" start drifting apart.
   */
  tilt(): { x: number; y: number } {
    return {
      x: clampAbs(this.gravX / EARTH_G, 1),
      y: clampAbs(this.gravY / EARTH_G, 1),
    }
  }

  /** Diagnostics, not physics.
   *
   *  "The shake doesn't work" has two causes that are indistinguishable from
   *  outside: no `devicemotion` events arriving at all, or events arriving
   *  from a shake that never reaches the current bar. Guessing between them
   *  means either chasing a permission problem that is not there, or
   *  second-guessing a threshold — docs/todo.md entry 88 makes the threshold
   *  itself move with context rather than staying a single fixed guess, but
   *  the underlying worry this comment names is unchanged: dropping it too
   *  far would buy back knocks and set-downs firing a re-roll, which the
   *  reversal counter (not the bar's height) is what actually prevents — see
   *  `detectStrong`'s own comment.
   *
   *  With all three numbers on screen it is one glance: `samples` still at 0
   *  is a dead sensor; a `peak` well under `bar` (`diagnostics()`'s own
   *  report of `currentStrongUp()`) is a real sensor and a shake that is not
   *  hard enough for whatever context the phone is currently in. */
  private samples = 0
  private peak = 0

  /** Seconds of unbroken agitation above SUSTAIN_LEVEL. */
  private sustained = 0
  /** Peak-hold envelope of `disturb`, so a shake's own half-cycle dips do not
   *  read as the shake stopping. See SUSTAIN_LEVEL. */
  private envelope = 0

  /** docs/todo.md entry 88 — a slow mean of `disturb`, 0-1, the "how much has
   *  the phone been moving lately" this entry's whole adaptive range reads
   *  from. Starts at 0 (calm), matching a real device that has not moved
   *  yet — and matching what a fresh `Tumble` should report before its
   *  first sample regardless. */
  private calm = 0

  /**
   * docs/todo.md entry 88 — 0-1, how far between calm and busy the current
   * bars sit. `sqrt(calm)` rather than `calm` itself: `disturb` spends most
   * of an ordinary walking gait's cycle near or under `FLOOR` (only the
   * peak of each stride clears it at all), so its time-average — which is
   * what the EMA in `updateCalm` converges toward — undersells how much the
   * phone has actually been moving. The probe is what surfaced this: 30s of
   * the walking case already in this file's own table (disturb peaking at
   * 0.15) converged `calm` to under 0.05, which barely nudged a *linear*
   * bar (13.0 → 13.3) — nowhere near enough separation for a shake that is
   * meant to read as clearly different in the two contexts. The square root
   * front-loads the response to exactly the small-`calm` regime ordinary
   * motion like walking lives in, without moving `CALM_TAU` itself off the
   * value Decided argues for on its own terms (long enough that a fidget
   * doesn't count, short enough that stillness forgives quickly). **Mine**
   * — Decided names the four bounds, not this curve; the walking-then-shake
   * probe case below is what this is tuned against.
   *
   * Public since docs/todo.md entry 111, which stretches the RGB slip's cap
   * by exactly this reading. It is deliberately the *same* number the
   * adaptive shake bar uses rather than a second slow envelope at a second
   * time constant: two estimates of "how busy has this phone been" would
   * drift apart and give the app two disagreeing opinions about one
   * question. Note what that shares, and what it does not — the freeze in
   * `updateCalm` during a detection comes along for free, which is what
   * stops a gesture from inflating its own cap while it is still happening.
   */
  busyness(): number {
    return Math.sqrt(this.calm)
  }

  /** docs/todo.md entry 88 — the reversal path's own current bar, between
   *  STRONG_UP_CALM and STRONG_UP_BUSY. A pure function of `calm` via
   *  `busyness()`, which is itself what freezes during a detection — see
   *  `updateCalm` — so this needs no freeze logic of its own. */
  private currentStrongUp(): number {
    return STRONG_UP_CALM + this.busyness() * (STRONG_UP_BUSY - STRONG_UP_CALM)
  }

  /** docs/todo.md entry 88 — reapplies STRONG_DOWN_RATIO to the current
   *  bar, so the hysteresis band scales with it rather than narrowing as
   *  the bar falls. */
  private currentStrongDown(): number {
    return this.currentStrongUp() * STRONG_DOWN_RATIO
  }

  /** docs/todo.md entry 88 — the sustained path's own current bar, between
   *  SUSTAIN_LEVEL_CALM and SUSTAIN_LEVEL_BUSY. */
  private currentSustainLevel(): number {
    return SUSTAIN_LEVEL_CALM + this.busyness() * (SUSTAIN_LEVEL_BUSY - SUSTAIN_LEVEL_CALM)
  }

  /**
   * docs/todo.md entry 88 — advance the slow mean, unless a detection is
   * currently in progress or cooling down. Without the freeze the feature
   * eats itself: a shake is by definition a large `disturb`, so it would
   * raise its own bar mid-gesture and the second half of a shake could fail
   * to qualify against a bar its own first half just raised. `above` covers
   * the reversal path from its first crossing (Decided's own "freeze on the
   * first reversal"); `sustained > 0` covers the sustained path the same
   * way, from the moment it starts accumulating rather than only once it
   * fires; `cooldown`/`doubleWindow` cover the aftermath of either,
   * including the gap before a possible second shake of a double — Decided
   * is explicit that the second shake of a double must face the same bar as
   * the first, and freezing through `doubleWindow` is what guarantees it.
   */
  private updateCalm(dt: number): void {
    if (this.above || this.sustained > 0 || this.cooldown > 0 || this.doubleWindow > 0) return
    const k = 1 - Math.exp(-dt / CALM_TAU)
    this.calm += (this.disturb - this.calm) * k
  }

  /**
   * Feed one sensor reading. `dt` is the time since the previous sample.
   */
  sample(s: MotionSample, dt: number): void {
    // Seed the gravity estimate from the first reading rather than from zero,
    // or the first half-second of every session is a 9.8 m/s² "shake".
    if (!this.seeded) {
      this.gravX = s.x
      this.gravY = s.y
      this.gravZ = s.z
      this.seeded = true
      return
    }

    const k = 1 - Math.exp(-dt / GRAVITY_TAU)
    this.gravX += (s.x - this.gravX) * k
    this.gravY += (s.y - this.gravY) * k
    this.gravZ += (s.z - this.gravZ) * k

    const ax = s.x - this.gravX
    const ay = s.y - this.gravY
    const az = s.z - this.gravZ
    const mag = Math.sqrt(ax * ax + ay * ay + az * az)
    // docs/todo.md entry 104 — held at this sample's own value until the
    // next one arrives, never decayed here: decay is rgb-slip.ts's own
    // magnitude spring's job, this is only ever a raw reading.
    this.accelX = ax
    this.accelY = ay

    this.samples++
    if (mag > this.peak) this.peak = mag

    this.disturb = clamp01((mag - FLOOR) / (FULL - FLOOR))
    // docs/todo.md entry 88 — reads this sample's own disturb, so it has to
    // run after the line above and before detectSustained/detectStrong
    // read the bar it feeds.
    this.updateCalm(dt)

    if (mag > KICK_DEADZONE) {
      // The image lags the phone rather than leading it — move the device
      // right and the picture slides left, the way a loose object in a box
      // does. Screen y is down while the sensor's y is up, so only x is
      // negated here.
      // Scaled by dt: these are impulses, and an accelerometer's sample rate
      // is not something the code controls — iOS delivers ~60 Hz, Android
      // whatever the vendor felt like. Without dt the same physical shake
      // tumbles twice as far on a phone that reports twice as often.
      this.pendingX += -ax * OFF_KICK * dt
      this.pendingY += -ay * OFF_KICK * dt
      // Rotation comes from the gyro when there is one, since rotation about
      // the screen normal is exactly what turning the image means. Where
      // there is no gyro, side-to-side acceleration stands in for it: not
      // physical, but it moves when the phone moves, which is the point.
      this.pendingSpin +=
        (s.spin !== 0 ? -s.spin * ROT_KICK : -ax * ROT_KICK * 0.12) * dt
    }

    this.detectSustained(dt)
    this.detectStrong(mag, dt)
  }

  /** The robust path to a re-roll: agitation held, rather than peaks counted.
   *  See SUSTAIN_LEVEL. Runs before detectStrong so it reads the cooldown the
   *  previous sample left, rather than one this sample already decremented. */
  private detectSustained(dt: number): void {
    // Peak-hold: jump straight to a new high, decay toward it otherwise.
    this.envelope *= Math.exp(-dt / ENVELOPE_TAU)
    if (this.disturb > this.envelope) this.envelope = this.disturb

    // docs/todo.md entry 88 — the adaptive bar, not the fixed SUSTAIN_LEVEL.
    if (this.envelope <= this.currentSustainLevel()) {
      this.sustained = 0
      return
    }

    this.sustained += dt
    if (this.sustained < SUSTAIN_TIME || this.cooldown > 0) return

    this.strongPending = true
    // docs/todo.md entry 85 — this path exists precisely for shakes whose
    // instantaneous peak never reached STRONG_UP, so `this.peak` alone was
    // always going to report 0 here. See envelopePeak's own comment.
    this.strongPeak = Math.max(this.peak, envelopePeak(this.envelope))
    this.sustained = 0
    this.cooldown = STRONG_COOLDOWN
    this.doubleWindow = DOUBLE_WINDOW
    // Clear the other path's state too, or a shake that fired here can leave
    // part-accumulated reversals behind to fire again a moment later.
    this.reversals = 0
    this.windowLeft = 0
    this.quietFor = 0
    this.armedForDouble = false
  }

  /**
   * Count the oscillations that separate a shake from a knock.
   *
   * The counter keeps running during the cooldown, where it used to return
   * early. That is what makes a second shake detectable at all, and it is safe
   * because the cooldown was never what rejects knocks — STRONG_REVERSALS is.
   * Three crossings inside STRONG_WINDOW is a thing you do on purpose; a knock,
   * a rebound, or a phone set down hard produces one or two and always has.
   *
   * Escalation reads `doubleWindow`, not `cooldown` — see DOUBLE_WINDOW. The
   * cooldown's own job is only ever "stop one shake from firing twice"; a
   * detection while `doubleWindow` is still armed and a real pause happened
   * (`armedForDouble`) becomes a *double* rather than a second single.
   */
  private detectStrong(mag: number, dt: number): void {
    // Read before decrementing: a detection on this sample belongs to the
    // state the previous one left behind. `cooldown` and `doubleWindow` are
    // independent timers now (see DOUBLE_WINDOW) — one shake fired here can
    // have `cooldown` lapse while `doubleWindow` is still armed.
    const escalating = this.doubleWindow > 0
    if (this.cooldown > 0) this.cooldown -= dt
    if (escalating) this.doubleWindow -= dt

    // A second shake only counts once the first has actually stopped. Below
    // the current bar (docs/todo.md entry 88 — STRONG_DOWN, adaptive) the
    // hand is between strokes or at rest; only a run of that longer than
    // QUIET_GAP means the gesture ended rather than continued.
    if (mag < this.currentStrongDown()) {
      this.quietFor += dt
      if (this.quietFor >= QUIET_GAP) this.armedForDouble = true
    } else {
      this.quietFor = 0
    }

    if (this.windowLeft > 0) {
      this.windowLeft -= dt
      if (this.windowLeft <= 0) this.reversals = 0
    }

    // docs/todo.md entry 88 — the adaptive bar, not the fixed STRONG_UP.
    if (!this.above && mag > this.currentStrongUp()) {
      this.above = true
      this.reversals++
      // The window starts at the first crossing, not at the first sample, so
      // a slow build does not eat it.
      if (this.reversals === 1) this.windowLeft = STRONG_WINDOW
      if (this.reversals >= STRONG_REVERSALS) {
        // Inside the cooldown, and only after a real pause, this is the second
        // shake of a double; otherwise it is a fresh single. Shaking straight
        // through the cooldown without stopping is one long shake and fires
        // nothing further, which is what it always did.
        // docs/todo.md entry 85 — the same blend as the sustained path's own
        // snapshot, for the same reason defect 2 named: `this.peak` alone is
        // an instantaneous sample maximum, and undersamples a real shake at
        // a low sensor rate even when the reversal counter itself still
        // fires correctly. `envelopePeak` never wins over a peak the sensor
        // genuinely caught — only over one it missed.
        if (escalating && this.armedForDouble) {
          this.doublePending = true
          this.doublePeak = Math.max(this.peak, envelopePeak(this.envelope))
        } else if (!escalating) {
          this.strongPending = true
          this.strongPeak = Math.max(this.peak, envelopePeak(this.envelope))
        }
        this.reversals = 0
        this.windowLeft = 0
        this.quietFor = 0
        this.armedForDouble = false
        this.cooldown = STRONG_COOLDOWN
        this.doubleWindow = DOUBLE_WINDOW
      }
    } else if (this.above && mag < this.currentStrongDown()) {
      this.above = false
    }
  }

  /**
   * Advance the springs and read the current state. Call once per rendered
   * frame. Returns true from `takeStrong()` separately so the caller decides
   * what a strong shake does.
   */
  advance(dt: number): TumbleState {
    this.angVel += this.pendingSpin
    this.velX += this.pendingX
    this.velY += this.pendingY
    this.pendingSpin = 0
    this.pendingX = 0
    this.pendingY = 0

    // Semi-implicit Euler: velocity first, then position from the new
    // velocity. Explicit Euler adds energy to an oscillator every step, which
    // for an under-damped spring like this one means it slowly winds up
    // instead of settling.
    this.angVel += (-ROT_STIFF * this.angle - ROT_DAMP * this.angVel) * dt
    this.angle += this.angVel * dt
    this.velX += (-OFF_STIFF * this.offX - OFF_DAMP * this.velX) * dt
    this.velY += (-OFF_STIFF * this.offY - OFF_DAMP * this.velY) * dt
    this.offX += this.velX * dt
    this.offY += this.velY * dt

    // Clamp position and kill the velocity that pushed past the cap, so the
    // spring does not sit straining against it.
    if (Math.abs(this.angle) > MAX_ANGLE) {
      this.angle = clampAbs(this.angle, MAX_ANGLE)
      this.angVel *= 0.5
    }
    if (Math.abs(this.offX) > MAX_OFFSET) {
      this.offX = clampAbs(this.offX, MAX_OFFSET)
      this.velX *= 0.5
    }
    if (Math.abs(this.offY) > MAX_OFFSET) {
      this.offY = clampAbs(this.offY, MAX_OFFSET)
      this.velY *= 0.5
    }

    // Disturb decays on its own; a sensor that stops reporting (screen off,
    // tab hidden) must not leave the picture permanently agitated.
    this.disturb *= Math.exp(-dt / 0.7)

    // The reported peak decays too, so the readout shows what the last few
    // seconds reached rather than the loudest event of the whole session — a
    // high-water mark from three minutes ago answers no question anyone is
    // asking while holding the phone and shaking it.
    this.peak *= Math.exp(-dt / 2.5)

    const zoom = overscanFor(this.angle, this.offX, this.offY)

    return {
      disturb: this.disturb,
      angle: this.angle,
      offsetX: this.offX,
      offsetY: this.offY,
      zoom,
      accelX: this.accelX,
      accelY: this.accelY,
    }
  }

  /**
   * The peak (m/s²) of the shake just detected, or 0 if there wasn't one.
   * Clears on read. `peak` never reaches 0 for a real detection — it takes at
   * least STRONG_UP to fire — so a plain truthiness check at the call site
   * still works exactly as the old boolean did.
   */
  takeStrong(): number {
    const v = this.strongPending ? this.strongPeak : 0
    this.strongPending = false
    return v
  }

  /**
   * The peak (m/s²) of the second shake in a double, or 0 if there wasn't one.
   *
   * Only the reversal path escalates. The sustained path (see SUSTAIN_LEVEL)
   * deliberately does not: it exists to catch gentle continuous agitation, and
   * escalating it would mean a long soft shake silently randomising everything
   * — which is not the gesture anyone made. A double is two deliberate shakes.
   */
  takeDouble(): number {
    const v = this.doublePending ? this.doublePeak : 0
    this.doublePending = false
    return v
  }

  /** See the fields' own comment. Read-only; nothing here drives the picture.
   *  `bar` is docs/todo.md entry 88's own addition — the reversal path's
   *  current adaptive threshold, m/s², so the readout can say why a shake
   *  didn't fire beyond just "the peak was low". */
  diagnostics(): { samples: number; peak: number; bar: number } {
    return { samples: this.samples, peak: this.peak, bar: this.currentStrongUp() }
  }
}

export const STILL: TumbleState = {
  disturb: 0,
  angle: 0,
  offsetX: 0,
  offsetY: 0,
  zoom: 0,
  accelX: 0,
  accelY: 0,
}

/** docs/todo.md entry 86 — the refused/unavailable `ShakeSensor`'s own
 *  `frame()` reading: no tilt, no disturb, `STILL`'s own tumble, no events,
 *  ever. One frozen instance shared by every call — nothing in it ever
 *  changes, so there is nothing a fresh object would buy per frame.
 *  Exported so a caller that needs a placeholder before its first real
 *  `frame()` call (main.ts, for the snapshot the powder reads pre-Start)
 *  can reuse this rather than hand-rolling an equivalent empty frame. */
export const STILL_FRAME: ShakeFrame = Object.freeze({
  tilt: Object.freeze({ x: 0, y: 0 }),
  disturb: 0,
  busyness: 0,
  tumble: STILL,
  events: Object.freeze([]),
})

/**
 * Whether this platform gates the accelerometer behind a permission call at
 * all — true only on iOS/iPadOS 13+. Exported so main.ts can start listening
 * at load everywhere else (docs/todo.md entry 20: a shake on the gate should
 * visibly tumble the idle preview, and nowhere but iOS needs a gesture spent
 * to get there) without duplicating this feature test a second time.
 */
export function hasMotionPermissionGate(): boolean {
  if (typeof DeviceMotionEvent === 'undefined') return false
  return (
    typeof (DeviceMotionEvent as unknown as { requestPermission?: unknown }).requestPermission ===
    'function'
  )
}

/**
 * Ask for motion access.
 *
 * iOS 13+ gates the accelerometer behind a permission call that must happen
 * inside a user gesture — the same constraint the microphone has, which is why
 * this is called from the start button rather than at load. Everywhere else
 * the events simply arrive. Resolves false rather than throwing: no motion is
 * a missing feature, not a failure, and the visualiser is fully usable
 * without it.
 */
export async function requestMotionAccess(): Promise<boolean> {
  if (typeof DeviceMotionEvent === 'undefined') return false
  if (!hasMotionPermissionGate()) return true // no gate on this platform

  const request = (
    DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
  ).requestPermission!

  try {
    return (await request.call(DeviceMotionEvent)) === 'granted'
  } catch {
    return false
  }
}

/**
 * docs/todo.md entry 86. A shake just detected (at most one per `frame()`
 * call) or a second one inside the first's cooldown — see `Tumble.takeStrong`
 * / `Tumble.takeDouble`, which this replaces for every consumer outside this
 * file. `kind` is `'strong'` xor `'double'` for the same call, never both:
 * `frame()` resolves the precedence internally (a double is also a strong,
 * and the escalation wins) exactly as main.ts's own call site used to.
 */
export interface ShakeEvent {
  kind: 'strong' | 'double'
  /** The shake's peak (m/s²). See Tumble.takeStrong/takeDouble. */
  peak: number
}

/**
 * docs/todo.md entry 86 — the snapshot. One of these is produced per
 * `frame()` call, frozen, and handed to every consumer alike: reading it is
 * not consuming it, so two watchers of the same frame see the same shake,
 * and a watcher that never reads at all cannot make another one starve.
 * `events` is empty on almost every frame — a shake is a rare occurrence,
 * not a per-frame fact the way `tilt`/`disturb`/`tumble` are.
 */
export interface ShakeFrame {
  tilt: { x: number; y: number }
  disturb: number
  /** docs/todo.md entry 111 — how much this phone has been moving over the
   *  last half-minute, 0-1 (`sqrt(calm)`, entry 88's own 25-second EMA of
   *  `disturb`). As much a per-frame fact as `disturb` is, and here for the
   *  reason this interface exists at all: two watchers of the same frame
   *  must see the same reading, which a clearing accessor could not
   *  promise. Frozen during a shake detection — see `Tumble.updateCalm`. */
  busyness: number
  tumble: TumbleState
  events: readonly ShakeEvent[]
}

export interface ShakeSensor {
  /**
   * Advance and read. Call once per frame — this is the only place `Tumble`'s
   * own clearing accessors (`takeStrong`/`takeDouble`) are ever called now;
   * every consumer reads the `ShakeFrame` this returns instead of calling a
   * clearing method of its own. See `ShakeFrame`'s own comment.
   */
  frame(dt: number): ShakeFrame
  /** The steady, motion-independent tilt offset. See Tumble.gravity. */
  gravity(): { x: number; y: number }
  /** The same tilt, uncapped — docs/todo.md entry 46. See Tumble.tilt. */
  tilt(): { x: number; y: number }
  /** Sample count, recent peak, the current adaptive bar (docs/todo.md
   *  entry 88), and events discarded as unusable. For the numeric readout
   *  only. See Tumble. */
  diagnostics(): { samples: number; peak: number; bar: number; rejected: number }
  /**
   * Whether this device has ever produced a `devicemotion` sample.
   *
   * The count itself has been available through `diagnostics()` since entry
   * 88, but that is documented "for the numeric readout only" and reads as a
   * debug surface; asking it a yes/no question at a call site that is not
   * the readout hides the question behind a field nobody expects to be
   * load-bearing. This is that question, named once — added by docs/todo.md
   * entry 110 and outliving it: entry 131 removed the view that first needed
   * it, and entry 120 is the reader now, because a tilt of (0, 0) means
   * "lying flat" on a phone and "there is no sensor here" on a laptop, and
   * an armed camera must not expire on the second.
   *
   * docs/todo.md entry 116 — armed camera mode dying after its quiet window
   * on any device with no motion data, because a missing sensor reads as a
   * phone that has been put down — is the identical test. It should read
   * this when it is built rather than growing its own.
   */
  hasMotionData(): boolean
  close(): void
}

/**
 * Start listening. Returns a sensor that reports STILL forever if the device
 * has no accelerometer or access was refused, so callers need no branch.
 */
export function startShake(granted: boolean): ShakeSensor {
  const tumble = new Tumble()

  if (!granted || typeof window === 'undefined') {
    // Reports zero samples forever, which is exactly the reading that says
    // "refused or unavailable" rather than "not shaken hard enough".
    return {
      frame: () => STILL_FRAME,
      gravity: () => ({ x: 0, y: 0 }),
      tilt: () => ({ x: 0, y: 0 }),
      diagnostics: () => ({ samples: 0, peak: 0, bar: STRONG_UP_CALM, rejected: 0 }),
      hasMotionData: () => false,
      close: () => {},
    }
  }

  let last = performance.now()
  /** Events that arrived but carried nothing usable. Counted separately from
   *  Tumble's own sample count, because "no events at all" and "events with
   *  empty payloads" are different faults with different fixes and both
   *  present as a shake that does nothing. */
  let rejected = 0

  const onMotion = (e: DeviceMotionEvent): void => {
    // accelerationIncludingGravity first, since the gravity estimator wants
    // the DC term. But some Android devices populate only `acceleration` —
    // gravity already removed — and leave the other null. Reading just the
    // one field means the whole feature is silently dead on those handsets,
    // with a listener happily attached and every event discarded here.
    //
    // Falling back is safe: the estimator converges on whatever DC the signal
    // has, which for a gravity-free feed is ~0, and it subtracts that. The
    // AC part it actually measures is the same either way.
    let a = e.accelerationIncludingGravity
    if (!a || a.x === null || a.y === null || a.z === null) a = e.acceleration
    if (!a || a.x === null || a.y === null || a.z === null) {
      rejected++
      return
    }

    const now = performance.now()
    // Clamp: a backgrounded tab can deliver a sample after a long gap, and an
    // enormous dt would drive the gravity filter straight to the new reading
    // and the spring past its cap in one step.
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now

    // rotationRate.alpha is degrees/s about the screen normal on iOS; Android
    // reports the same axis under the same name. Missing on devices with no
    // gyroscope, which the sample() path handles.
    const alpha = e.rotationRate?.alpha ?? 0
    tumble.sample(
      { x: a.x, y: a.y, z: a.z, spin: (alpha * Math.PI) / 180 },
      Math.max(dt, 1e-3),
    )
  }

  window.addEventListener('devicemotion', onMotion)

  return {
    frame: (dt) => {
      const state = tumble.advance(dt)
      // Order matters, and matches what every call site used to do by hand:
      // a double is also a strong (the same reversal run sets both pending
      // flags), so reading the double first means the escalation wins and
      // this frame never reports both — docs/todo.md entry 86 moves this
      // precedence into the one place `Tumble`'s clearing accessors are
      // still called, rather than trusting every consumer to get the order
      // right on its own.
      const events: ShakeEvent[] = []
      const doublePeak = tumble.takeDouble()
      if (doublePeak) {
        events.push({ kind: 'double', peak: doublePeak })
      } else {
        const strongPeak = tumble.takeStrong()
        if (strongPeak) events.push({ kind: 'strong', peak: strongPeak })
      }
      return Object.freeze({
        tilt: tumble.tilt(),
        disturb: state.disturb,
        busyness: tumble.busyness(),
        tumble: state,
        events: Object.freeze(events),
      })
    },
    gravity: () => tumble.gravity(),
    tilt: () => tumble.tilt(),
    diagnostics: () => ({ ...tumble.diagnostics(), rejected }),
    hasMotionData: () => tumble.diagnostics().samples > 0,
    close: () => window.removeEventListener('devicemotion', onMotion),
  }
}
