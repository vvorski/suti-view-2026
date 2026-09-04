/**
 * The picture's own colour channels lag the phone and spring back —
 * docs/todo.md entry 76, given its own held direction by entry 104.
 * Every motion response before this was either a rigid-body move
 * (`shake.ts`'s `Tumble`) or a colour-*value* shift (`motion-bias.ts`);
 * nothing has come apart until now.
 *
 * Pure state and a pure update function, same discipline as `motion-bias.ts`,
 * `ripples.ts` and `emitter.ts`: no DOM, no clock of its own. It shares no
 * state with the tumble's own springs — reading `disturb` and the raw
 * accelerometer sample behind it (see `updateRgbSlip`'s own comment) is not
 * sharing state, it is reading two plain numbers a still-different module
 * happens to also compute.
 *
 * Entry 76 first tried to get a direction for free, from the tumble's own
 * offset spring (`uTumble.yz`) — free until measured. That spring oscillates
 * through zero (it is a spring), and `normalize()`-ing it kept only the
 * *sign* of an oscillation, not a direction: the slip flipped end for end
 * three or four times a second rather than holding steady while a shake
 * decayed, which reads as a shimmer rather than a dispersion. Entry 104's
 * fix is a direction with its own state, held rather than sampled, easing
 * toward wherever the phone is actually being pushed and never reset to
 * zero by a momentarily-quiet reading — the magnitude below still does all
 * of the decaying.
 */

/**
 * STIFF is ω², DAMP is 2ζω — the same convention `shake.ts`'s own `Tumble`
 * spring uses. ω ≈ 20 rad/s (a period of about 0.3s) at ζ ≈ 0.35: fast and
 * looser than either of the tumble's own two springs (ω ≈ 12.6/8.9 at
 * ζ 0.4), and deliberately a different frequency from both — a shared
 * frequency is what would make this read as the tumble happening twice
 * rather than as its own effect, the same reasoning `shake.ts` already
 * applies to keeping its own rotation and drift springs apart.
 *
 * Unchanged by entry 104 — Decided is explicit that this fixes a direction
 * and only a direction; STIFF, DAMP and MAX_SLIP below are the frozen
 * magnitude approved at build 249.
 */
const STIFF = 400
const DAMP = 14 // 2 * 0.35 * 20

/**
 * The uv-space cap on a still-ish phone — docs/todo.md entry 111 raised it
 * from entry 76's 0.006, and the arithmetic behind that is the reason it
 * could be raised at all.
 *
 * Entry 76 justified 0.006 as "about two to four pixels on a phone… past a
 * few pixels line art stops looking dispersed and starts looking broken".
 * Entry 104 measured it and found the *comment* wrong, not the geometry: the
 * compositor's own `uv` spans 0-1 across the **full** frame width (not the
 * aspect-normalised uv the geometric shaders use internally), so 0.006 uv is
 * 6.48px per channel on a 1080px-wide phone — **thirteen pixels** of total
 * R-to-B separation, not two to four. Which means the "past a few pixels it
 * looks broken" ceiling was never actually tested at a few pixels: the
 * picture everyone has looked at and approved has been sitting at thirteen
 * the whole time, and the argument for the limit was made about a number
 * three times smaller than the one shipping.
 *
 * 0.010 uv is 10.8px per channel, **21.6px total** at this cap — a real
 * increase, and still under twice what has already been seen and liked.
 * Victor's word, quoted in entry 111, is what lifts entry 76's freeze:
 * "make it stronger, also can you detect ongoing motion then it should
 * stretch further". `STIFF` and `DAMP` stay frozen; the request is about
 * reach, not about the spring's feel. See `scripts/probe-rgb-slip.ts`'s own
 * pixel measurement, which prints this rather than asserting a comment.
 */
export const MAX_SLIP = 0.010

/**
 * docs/todo.md entry 111 — how much further the cap stretches when the phone
 * has been moving for a while. The effective cap is
 * `MAX_SLIP + busyness * SUSTAIN_SLIP`, so a phone that has been carried
 * around reaches 0.020 uv (43.2px total) where one lifted off a table
 * reaches 0.010 (21.6px).
 *
 * Equal to `MAX_SLIP`, which is the point: "stretch further" should be a
 * doubling at the top of the range, large enough that the second nudge after
 * a minute of walking is unmistakably wider than the first. `busyness` is
 * `shake.ts`'s own `sqrt(calm)` — entry 88's existing 25-second EMA of
 * `disturb`, not a second envelope invented here, because two slow estimates
 * of "how busy has this phone been" at different time constants would drift
 * apart and give the app two disagreeing opinions about the same question.
 */
const SUSTAIN_SLIP = 0.010

/**
 * docs/todo.md entry 111 — the exponent the magnitude spring's target is
 * raised to before it is chased.
 *
 * Raising the cap alone barely changes what anyone feels, because almost
 * nothing ordinary asks for much of the range: `disturb` is
 * `(mag − 1.2) / (14 − 1.2)`, so a nudge at 8 m/s² asks for 0.53 of it and a
 * hand tremor asks for nothing at all. An exponent below 1 front-loads
 * exactly the small-`disturb` regime ordinary handling lives in — the same
 * shape, and the same reason, as `shake.ts`'s own `busyness()` taking
 * `sqrt(calm)`.
 *
 * It cannot lift the floor: `pow(0, 0.6)` is 0, so a phone reading no
 * disturbance at all still asks for exactly nothing, and `FLOOR` in
 * `shake.ts` — which is what makes a phone on a table read 0 in the first
 * place — is untouched.
 */
const TARGET_CURVE = 0.6

/**
 * docs/todo.md entry 104 — how quickly the held direction eases toward a
 * sample the peak-ratio gate below has already judged trustworthy. Fast on
 * purpose: once a sample clears that gate it already *is* this gesture's
 * own dominant motion, so there is nothing left to smooth away — the
 * discipline that keeps a spurious signal out of the held direction lives
 * entirely in the gate (`PEAK_TAU`/`PEAK_RATIO`), not in a slow-tracking
 * filter on top of it. **Mine**.
 */
const DIRECTION_TAU = 0.1

/**
 * docs/todo.md entry 104 — how long "the recent peak" stays elevated after
 * a kick, for the ratio gate below. Same peak-hold shape as `shake.ts`'s
 * own `envelope` (jump straight to a new high, decay toward it otherwise),
 * reused here for the identical reason. **Mine**.
 */
const PEAK_TAU = 0.3

/**
 * docs/todo.md entry 104 — a sample updates the held direction only while
 * its own magnitude is within this fraction of the gesture's own recent
 * peak (see `PEAK_TAU`). This is the actual fix for a bug this entry
 * surfaced rather than merely worked around: `shake.ts`'s gravity DC
 * estimate (`GRAVITY_TAU`, 0.5s) recovers from a hard kick with a real,
 * opposite-signed rebound in the raw accelerometer reading — sometimes
 * exceeding 1 m/s² for the better part of a second, which is well above
 * any *absolute* noise floor a fixed deadzone could reject without also
 * rejecting genuine gentle motion at the same absolute scale. A rebound is
 * never comparable to its own kick's peak, though — it is by definition
 * what is *left over* after the peak — so a threshold measured as a ratio
 * of the recent peak rejects it at any amplitude, gentle tremor or violent
 * shake alike, where a fixed absolute number could only ever be tuned
 * against one. **Mine** — half of the recent peak is what
 * `scripts/probe-rgb-slip.ts`'s own knock table is verified against, up to
 * 120 m/s² (the table's own most violent case peaks at 45), while a
 * genuine second, oppositely-aimed hit ("knock + rebound") still clears
 * its own peak-ratio gate easily and is correctly read as a real reversal.
 */
const PEAK_RATIO = 0.5

/**
 * docs/todo.md entry 104 — below this much in-plane acceleration (m/s²), a
 * sample never updates the held direction regardless of what the
 * peak-ratio gate says. This only matters before any real peak has ever
 * been recorded (a session that starts perfectly still, `peakMag` at 0) —
 * without it, the ratio test alone (`mag >= 0 * PEAK_RATIO`) would pass for
 * literal sensor noise. **Mine**.
 */
const DIRECTION_DEADZONE = 0.05

export interface RgbSlipState {
  amount: number
  velocity: number
  /** docs/todo.md entry 104 — the held direction, low-passed from the raw
   *  (not unit-normalised) accelerometer reading rather than sampled from
   *  the tumble's own offset spring. Not itself unit length between
   *  updates; `updateRgbSlip` normalises it at the point of use, the same
   *  way a running estimate is filtered in its own units and only shaped
   *  at the point something reads it. */
  dirX: number
  dirY: number
  /** docs/todo.md entry 104 — the peak-hold reference `PEAK_RATIO`'s gate
   *  compares each sample's magnitude against. See that constant's own
   *  comment for why a ratio, not an absolute floor, is what rejects the
   *  gravity estimate's own post-kick rebound. */
  peakMag: number
}

export function createRgbSlipState(): RgbSlipState {
  return { amount: 0, velocity: 0, dirX: 0, dirY: 0, peakMag: 0 }
}

/**
 * Call once per rendered frame with the tumble's own `disturb` (0-1), the
 * raw in-plane acceleration behind it (`shake.ts`'s `TumbleState.accelX/Y` —
 * the same reading the offset spring's own kicks are built from, read here
 * *before* it becomes a spring, which is what lets this hold a direction the
 * spring's own oscillation cannot corrupt). The magnitude spring chases
 * `disturb` as a moving target — rather than being kicked once by a discrete
 * event, the way the tumble's own springs are — so it tracks a sustained
 * shake and relaxes as `disturb` decays on its own. The direction eases
 * toward `accelX`/`accelY`'s own bearing only while the peak-ratio gate
 * (see `PEAK_RATIO`) judges the current sample a trustworthy peer of this
 * gesture's own recent peak, and otherwise holds exactly where it was —
 * never renormalised from a spring, never reset to zero.
 *
 * Underdamped on purpose: a sudden rise in `disturb` is overtaken and the
 * spring visibly overshoots past it before settling, which is what "flicks
 * apart and bounces back" asks for, rather than an easing crossfade toward
 * whatever `disturb` currently reads.
 *
 * `busyness` is `shake.ts`'s own 0-1 reading of how much the phone has been
 * moving over the last half-minute (docs/todo.md entry 111). It stretches
 * the cap and nothing else: it never adds slip on its own, so a phone that
 * has been carried around and then set down produces exactly as little as
 * one that never moved.
 *
 * Returns the ready-to-upload uv offset, a `vec2` already scaled to the
 * effective cap and pointed in the held direction — the caller applies no
 * further scaling or direction of its own. Exactly `{x: 0, y: 0}` whenever
 * the magnitude spring is at rest, regardless of what direction is held or
 * how busy the phone has been, which is what keeps a still phone
 * byte-identical to before either entry.
 */
export function updateRgbSlip(
  state: RgbSlipState,
  dt: number,
  disturb: number,
  accelX: number,
  accelY: number,
  busyness: number,
): { x: number; y: number } {
  const clamped = disturb < 0 ? 0 : disturb > 1 ? 1 : disturb
  const target = Math.pow(clamped, TARGET_CURVE)
  state.velocity += (STIFF * (target - state.amount) - DAMP * state.velocity) * dt
  state.amount += state.velocity * dt

  // Clamped the same way the tumble's own springs clamp at MAX_ANGLE and
  // MAX_OFFSET: kill half the velocity that pushed past the cap rather than
  // let the spring sit straining against it. Floored at 0 too, unlike the
  // tumble's signed offsets — this is a magnitude feeding a direction that
  // lives elsewhere, and a negative one has no meaning to hand the shader.
  if (state.amount > 1) {
    state.amount = 1
    state.velocity *= 0.5
  } else if (state.amount < 0) {
    state.amount = 0
    state.velocity *= 0.5
  }

  // docs/todo.md entry 104 — peak-hold, the same jump-to-a-new-high /
  // decay-otherwise shape shake.ts's own `envelope` uses, so the ratio
  // gate below always compares against *this gesture's* own recent peak
  // rather than some fixed reference.
  const accelMag = Math.hypot(accelX, accelY)
  state.peakMag *= Math.exp(-dt / PEAK_TAU)
  if (accelMag > state.peakMag) state.peakMag = accelMag

  if (accelMag > DIRECTION_DEADZONE && accelMag >= state.peakMag * PEAK_RATIO) {
    // A dispersion is a *line*, not an arrow. Which end red leads at is
    // arbitrary — the shader lays red at +off and blue at −off, so flipping
    // the held direction end for end produces the identical picture with the
    // two channels swapped, and no eye tracks that at a phone's frame rate.
    // What the eye does track is the axis wandering.
    //
    // That matters because a shake is an *oscillation*: acceleration reverses
    // twice per cycle, and both halves clear the peak-ratio gate above, since
    // |a| exceeds half its own peak for most of each half-cycle. Easing the
    // raw signed vector therefore drags the direction back and forth across
    // the axis rather than settling on it — measured at 19 reversals through
    // two seconds of a 5 Hz shake, 11 at 3 Hz, 7 at a 2 Hz wave. Only the
    // single-knock case the probe covered came out clean, because one
    // half-cycle never reverses.
    //
    // So fold each sample onto the axis already held before easing it in.
    // A sample pointing the other way down the same line is the *same*
    // evidence about that line, and counting it as opposing evidence is what
    // entry 104 set out to stop — this is the same fault as the tumble
    // offset's zero crossings, one layer further in.
    const k = 1 - Math.exp(-dt / DIRECTION_TAU)
    const opposed = state.dirX * accelX + state.dirY * accelY < 0
    const sampleX = opposed ? -accelX : accelX
    const sampleY = opposed ? -accelY : accelY
    // Eased toward the raw (unnormalised) reading, not its unit direction —
    // a sample this close to the gesture's own peak is already trustworthy
    // enough that normalising it first would only throw away how dominant
    // it was relative to whatever is smoothing it in.
    state.dirX += (sampleX - state.dirX) * k
    state.dirY += (sampleY - state.dirY) * k
  }

  // The cap is consulted only here, after the spring has run: `amount` stays
  // a plain 0-1 reading of how hard the phone is being disturbed *now*, and
  // how far that is allowed to reach is a separate question answered by how
  // much it has been moving lately. Keeping them apart is what stops a phone
  // that has been in a pocket from having a spring already wound up.
  const cap = MAX_SLIP + (busyness > 0 ? Math.min(1, busyness) : 0) * SUSTAIN_SLIP
  const magnitude = state.amount * cap
  if (magnitude === 0) return { x: 0, y: 0 }

  // No direction has ever been trustworthy yet (a session that starts dead
  // still, or a disturbance that is entirely out-of-plane — see
  // TumbleState's own accelX/accelY comment): honestly nothing to disperse
  // along, so this returns no offset at all rather than an arbitrary one.
  const dirLen = Math.hypot(state.dirX, state.dirY)
  if (dirLen < 1e-9) return { x: 0, y: 0 }

  return { x: (state.dirX / dirLen) * magnitude, y: (state.dirY / dirLen) * magnitude }
}
