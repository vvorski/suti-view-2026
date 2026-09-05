/**
 * The geometric layer's centre, hanging on a spring — docs/todo.md entry 132.
 *
 * Victor: *"use those dynamics to move the emitters of the geometrics and
 * affect the lower layer also … think what it would be like for the toy as a
 * whole to feel gravity."* Gravity already reached the toy in two places and
 * both were small: the whole picture slides up to 0.033 uv (entry 30), and a
 * *released* touch emitter falls (entry 102). Neither moves what the picture
 * is made of — every audio-born ring, shard, cell and rose is born at
 * `vec2(0.0)`, dead centre, whatever the phone is doing.
 *
 * **A pendulum bob, not a falling grain**, and it is the one decision here
 * that changes what the picture is. A body on a spring anchored at the frame
 * centre, loaded by gravity: held upright it hangs below centre, laid flat it
 * hangs *at* centre, tilted it hangs toward the low edge, and every
 * transition swings and settles. Entry 102's fall-to-the-edge physics would
 * instead carry the centre to the bottom edge whenever the phone is held
 * normally — half the picture off screen in the commonest posture — and leave
 * it there when the phone was laid down.
 *
 * The bob answers "flat" by returning to centre **with no rule saying so**,
 * which is the same property entry 102 valued in the grain: *"a mode flag
 * here would be strictly worse than the physics."* In-plane gravity is the
 * full vector when the phone is upright and has zero length when it is flat,
 * so flat-versus-upright is not a case anything branches on.
 *
 * The toy now has two kinds of gravity — a bob that swings and a grain that
 * falls — and that is the sand frame's own vocabulary rather than an
 * inconsistency: the pile sits, the falling grains fall.
 *
 * Pure state and a pure update, same discipline as `emitter.ts` and
 * `motion-bias.ts`: no DOM, no clock of its own, `dt` from the caller.
 */

/**
 * How far the centre hangs below the middle at 90°, in uv — linear in the
 * in-plane magnitude, so it is the full sag when the phone is upright and
 * nothing when it is flat.
 *
 * Entry 30 caps its own whole-picture slide at 0.033 because the overscan
 * hiding the picture's edge is only 0.055 uv, and that cap is right for
 * *sliding the composite*, which exposes an edge. Moving the **origin** of
 * the geometry exposes nothing — the shaders draw everywhere regardless of
 * where their centre is — so it can move an order of magnitude further. 0.28
 * is the largest value at which Circles' outermost wake rungs still reach the
 * top of a portrait frame; the bottom edge is 0.89 away, so the bob is never
 * near it. **Mine.**
 */
export const ORIGIN_SAG = 0.28

/**
 * The swing: natural frequency in rad/s and damping ratio. ω = 3 is a period
 * of about 2.1s, and ζ = 0.35 overshoots by roughly a third, swings back once
 * and settles inside three seconds — raise the phone and the centre drops,
 * hesitates, and hangs.
 *
 * Deliberately *not* the tumble's own `OFF_STIFF`/`OFF_DAMP` (ω ≈ 9), which
 * are tuned for a knock and are far too twitchy for a thing meant to feel
 * heavy. Two springs at different frequencies is the same reasoning
 * `rgb-slip.ts` gives for keeping its own away from the tumble's: a shared
 * frequency would make this read as the tumble happening twice rather than as
 * its own effect. **Mine.**
 */
const OMEGA = 3
const ZETA = 0.35
/** Standard spring form: stiffness ω², damping 2ζω — the same convention the
 *  tumble and the RGB slip both already use. */
const STIFF = OMEGA * OMEGA
const DAMP = 2 * ZETA * OMEGA

/**
 * How much of a tumble kick reaches the bob, in uv per (m/s²). The tumble's
 * own impulses are already computed every frame for the picture's shake, so a
 * knock swings the bob and a shake throws it without any new coupling — the
 * bob simply also receives them. Small, because a kick is an impulse on a
 * heavy thing: a hard shake moves it a fraction of the sag rather than
 * flinging it across the frame. **Mine.**
 */
const KICK_SCALE = 0.004

/** Beyond this the bob is clamped, so no accumulation of kicks can push the
 *  origin somewhere the picture has nothing left to draw around. Twice the
 *  sag: reachable by a hard shake at full tilt, never by gravity alone. */
const MAX_ORIGIN = ORIGIN_SAG * 2

export interface OriginState {
  x: number
  y: number
  vx: number
  vy: number
}

export function createOriginState(): OriginState {
  return { x: 0, y: 0, vx: 0, vy: 0 }
}

/**
 * Call once per rendered frame while the `grav` chip is on.
 *
 * `tiltX`/`tiltY` are `shake.ts`'s own uncapped in-plane pair — `(0, 0)` flat,
 * unit length upright — and `kickX`/`kickY` are the tumble's own pending
 * impulses in m/s², or 0 when nothing has happened.
 *
 * The rest position is `tilt × ORIGIN_SAG`, so gravity does not accelerate the
 * bob directly: it moves the anchor the spring pulls toward. That is what
 * makes the response a swing toward a hanging point rather than a fall, and
 * what makes "flat" mean "the hanging point is the centre" rather than a case
 * anything tests for.
 */
export function updateOrigin(
  state: OriginState,
  dt: number,
  tiltX: number,
  tiltY: number,
  kickX = 0,
  kickY = 0,
): void {
  if (dt <= 0) return

  // The sign convention, measured rather than reasoned about: a phone held
  // upright reports `tilt = (0, -1)` and a phone lying flat reports `(0, 0)`
  // — `tilt.y` is `gravY / EARTH_G`, and the harness's own "still" sample is
  // `y = -G` (probe-shake.ts). The shaders' uv has y up, so a negative target
  // puts the hanging centre *below* the middle of the frame, which is what
  // "hangs" means. No sign flip is needed anywhere: the vector already points
  // the way things fall.
  const targetX = tiltX * ORIGIN_SAG
  const targetY = tiltY * ORIGIN_SAG

  state.vx += (STIFF * (targetX - state.x) - DAMP * state.vx) * dt + kickX * KICK_SCALE
  state.vy += (STIFF * (targetY - state.y) - DAMP * state.vy) * dt + kickY * KICK_SCALE
  state.x += state.vx * dt
  state.y += state.vy * dt

  // Clamped the way the tumble clamps its own offsets: kill half the velocity
  // that pushed past the limit rather than let the spring strain against it.
  const len = Math.hypot(state.x, state.y)
  if (len > MAX_ORIGIN) {
    const k = MAX_ORIGIN / len
    state.x *= k
    state.y *= k
    state.vx *= 0.5
    state.vy *= 0.5
  }
}

/** Put the bob back at the centre, instantly — for the moment the `grav` chip
 *  is switched off, so the picture does not keep hanging off-centre with the
 *  feature disabled. The uniform stops being written at the same moment; this
 *  is what makes the *next* switch-on start from rest rather than from
 *  wherever it was left. */
export function resetOrigin(state: OriginState): void {
  state.x = 0
  state.y = 0
  state.vx = 0
  state.vy = 0
}
