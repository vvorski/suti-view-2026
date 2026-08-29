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
// Exported: haptics.ts's intensity scaling needs the same floor a shake has
// to clear to fire at all, so "the gentlest qualifying shake" means the same
// m/s² value in both files rather than two constants that can drift apart.
export const STRONG_UP = 18
/**
 * The hardest shake this app is calibrated against — probe-shake.ts's own
 * "violent shake" case, not a real physical limit (none exists). Exported
 * alongside `intensity()` below rather than left for `haptics.ts` to
 * recompute a second time from the same two numbers.
 */
export const PEAK_CEILING = 45

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

const STRONG_DOWN = 7
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
const MAX_OFFSET = 0.055

/** Motion smaller than this does not kick at all, so a phone held still is
 *  perfectly still rather than jittering on sensor noise. */
const KICK_DEADZONE = 0.35

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
const clampAbs = (v: number, max: number): number =>
  v > max ? max : v < -max ? -max : v

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

  /** Diagnostics, not physics.
   *
   *  "The shake doesn't work" has two causes that are indistinguishable from
   *  outside: no `devicemotion` events arriving at all, or events arriving
   *  from a shake that never reaches STRONG_UP. Guessing between them means
   *  either chasing a permission problem that is not there, or lowering a
   *  threshold that was right — and lowering STRONG_UP is not free, because
   *  what it buys back is knocks and set-downs firing a re-roll, which the
   *  reversal counter exists to prevent.
   *
   *  With both numbers on screen it is one glance: `samples` still at 0 is a
   *  dead sensor; a `peak` well under STRONG_UP is a real sensor and a shake
   *  that is not hard enough. */
  private samples = 0
  private peak = 0

  /** Seconds of unbroken agitation above SUSTAIN_LEVEL. */
  private sustained = 0
  /** Peak-hold envelope of `disturb`, so a shake's own half-cycle dips do not
   *  read as the shake stopping. See SUSTAIN_LEVEL. */
  private envelope = 0

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

    this.samples++
    if (mag > this.peak) this.peak = mag

    this.disturb = clamp01((mag - FLOOR) / (FULL - FLOOR))

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

    if (this.envelope <= SUSTAIN_LEVEL) {
      this.sustained = 0
      return
    }

    this.sustained += dt
    if (this.sustained < SUSTAIN_TIME || this.cooldown > 0) return

    this.strongPending = true
    this.strongPeak = this.peak
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
    // STRONG_DOWN the hand is between strokes or at rest; only a run of that
    // longer than QUIET_GAP means the gesture ended rather than continued.
    if (mag < STRONG_DOWN) {
      this.quietFor += dt
      if (this.quietFor >= QUIET_GAP) this.armedForDouble = true
    } else {
      this.quietFor = 0
    }

    if (this.windowLeft > 0) {
      this.windowLeft -= dt
      if (this.windowLeft <= 0) this.reversals = 0
    }

    if (!this.above && mag > STRONG_UP) {
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
        if (escalating && this.armedForDouble) {
          this.doublePending = true
          this.doublePeak = this.peak
        } else if (!escalating) {
          this.strongPending = true
          this.strongPeak = this.peak
        }
        this.reversals = 0
        this.windowLeft = 0
        this.quietFor = 0
        this.armedForDouble = false
        this.cooldown = STRONG_COOLDOWN
        this.doubleWindow = DOUBLE_WINDOW
      }
    } else if (this.above && mag < STRONG_DOWN) {
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

    // Enough overscan to cover the corner that rotation and drift expose.
    // Rotating a unit-square frame by θ about its centre needs roughly θ of
    // extra scale at these small angles; drift needs twice its own size,
    // being one-sided.
    const zoom = Math.min(
      0.3,
      Math.abs(this.angle) * 0.8 + (Math.abs(this.offX) + Math.abs(this.offY)) * 2.2,
    )

    return {
      disturb: this.disturb,
      angle: this.angle,
      offsetX: this.offX,
      offsetY: this.offY,
      zoom,
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

  /** See the fields' own comment. Read-only; nothing here drives the picture. */
  diagnostics(): { samples: number; peak: number } {
    return { samples: this.samples, peak: this.peak }
  }
}

export const STILL: TumbleState = {
  disturb: 0,
  angle: 0,
  offsetX: 0,
  offsetY: 0,
  zoom: 0,
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

  const request = (
    DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
  ).requestPermission

  if (typeof request !== 'function') return true // no gate on this platform

  try {
    return (await request.call(DeviceMotionEvent)) === 'granted'
  } catch {
    return false
  }
}

export interface ShakeSensor {
  /** Advance and read. Call once per frame. */
  frame(dt: number): TumbleState
  /** The shake's peak (m/s²) once per detected hard shake, 0 otherwise. See
   *  Tumble.takeStrong. */
  takeStrong(): number
  /** The peak (m/s²) once per *second* hard shake inside the cooldown of the
   *  first, 0 otherwise. See Tumble.takeDouble. */
  takeDouble(): number
  /** Sample count, recent peak, and events discarded as unusable. For the
   *  numeric readout only. See Tumble. */
  diagnostics(): { samples: number; peak: number; rejected: number }
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
      frame: () => STILL,
      takeStrong: () => 0,
      takeDouble: () => 0,
      diagnostics: () => ({ samples: 0, peak: 0, rejected: 0 }),
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
    frame: (dt) => tumble.advance(dt),
    takeStrong: () => tumble.takeStrong(),
    takeDouble: () => tumble.takeDouble(),
    diagnostics: () => ({ ...tumble.diagnostics(), rejected }),
    close: () => window.removeEventListener('devicemotion', onMotion),
  }
}
