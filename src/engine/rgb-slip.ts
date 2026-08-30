/**
 * The picture's own colour channels lag the phone and spring back —
 * docs/todo.md entry 76. Every motion response before this was either a
 * rigid-body move (`shake.ts`'s `Tumble`) or a colour-*value* shift
 * (`motion-bias.ts`); nothing has come apart until now.
 *
 * Pure state and a pure update function, same discipline as `motion-bias.ts`,
 * `ripples.ts` and `emitter.ts`: no DOM, no clock of its own. It shares no
 * state with the tumble and no state with the colour bias — the only thing
 * it reads is `disturb`, a plain number the tumble also produces. Direction
 * is applied separately, in `composite.frag.glsl`, from the tumble's own
 * offset — that uniform is already there for the tumble itself, and this
 * needs nothing further from it than the direction it already points.
 */

/**
 * STIFF is ω², DAMP is 2ζω — the same convention `shake.ts`'s own `Tumble`
 * spring uses. ω ≈ 20 rad/s (a period of about 0.3s) at ζ ≈ 0.35: fast and
 * looser than either of the tumble's own two springs (ω ≈ 12.6/8.9 at
 * ζ 0.4), and deliberately a different frequency from both — a shared
 * frequency is what would make this read as the tumble happening twice
 * rather than as its own effect, the same reasoning `shake.ts` already
 * applies to keeping its own rotation and drift springs apart.
 */
const STIFF = 400
const DAMP = 14 // 2 * 0.35 * 20

/**
 * The uv-space cap — about two to four pixels on a phone. Past a few pixels
 * line art stops looking dispersed and starts looking broken, the same
 * ceiling argument `shake.ts`'s own `MAX_ANGLE` comment makes about the
 * tumble.
 */
export const MAX_SLIP = 0.006

export interface RgbSlipState {
  amount: number
  velocity: number
}

export function createRgbSlipState(): RgbSlipState {
  return { amount: 0, velocity: 0 }
}

/**
 * Call once per rendered frame with the tumble's own `disturb` (0-1). The
 * spring chases it as a moving target — rather than being kicked once by a
 * discrete event, the way the tumble's own springs are — so it tracks a
 * sustained shake and relaxes as `disturb` decays on its own.
 *
 * Underdamped on purpose: a sudden rise in `disturb` is overtaken and the
 * spring visibly overshoots past it before settling, which is what "flicks
 * apart and bounces back" asks for, rather than an easing crossfade toward
 * whatever `disturb` currently reads.
 *
 * Returns the ready-to-upload uv offset magnitude, already scaled by
 * `MAX_SLIP` — the caller applies no further scaling of its own.
 */
export function updateRgbSlip(state: RgbSlipState, dt: number, disturb: number): number {
  const target = disturb < 0 ? 0 : disturb > 1 ? 1 : disturb
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

  return state.amount * MAX_SLIP
}
