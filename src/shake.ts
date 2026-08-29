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
const STRONG_UP = 18
const STRONG_DOWN = 7
const STRONG_REVERSALS = 3
const STRONG_WINDOW = 1.2
/** Long enough that one shake cannot read as two, short enough that shaking
 *  again immediately still works. */
const STRONG_COOLDOWN = 1.5

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
  private strongPending = false

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

    this.detectStrong(mag, dt)
  }

  /** Count the oscillations that separate a shake from a knock. */
  private detectStrong(mag: number, dt: number): void {
    if (this.cooldown > 0) {
      this.cooldown -= dt
      return
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
        this.strongPending = true
        this.reversals = 0
        this.windowLeft = 0
        this.cooldown = STRONG_COOLDOWN
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

  /** True once per detected shake; clears on read. */
  takeStrong(): boolean {
    const v = this.strongPending
    this.strongPending = false
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
  /** True once per detected hard shake. */
  takeStrong(): boolean
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
      takeStrong: () => false,
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
    diagnostics: () => ({ ...tumble.diagnostics(), rejected }),
    close: () => window.removeEventListener('devicemotion', onMotion),
  }
}
