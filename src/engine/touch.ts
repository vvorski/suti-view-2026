/**
 * The touch → atmospheric-stream envelope — docs/todo.md entry 48.
 *
 * The seven atmospheric views read 8-12 audio inputs and none of them read
 * `uRipples` — a positioned ripple (entry 33/49's emitter) cannot reach
 * them, since they have no notion of a location. What they *can* read is an
 * event: a transient spike on contact, a level floor held while a finger is
 * down, and drag speed folded into roughness. This is that event, computed
 * the same way `fast.ts` computes everything else a shader reads — a small
 * envelope over discrete facts, injected by `Math.max` into the mapping's
 * own output rather than added to it, so a touch can only ever add
 * liveliness, never push a real transient past what saturation already
 * allows.
 *
 * Pure state and a pure update function, same discipline as `ripples.ts`
 * and `emitter.ts`: no DOM, no clock of its own, no notion of a screen
 * third or a capture band — the caller decides which touches count (main.ts
 * excludes the capture band and any touch that began on a `.hud-chip`,
 * exactly as `dispatchTouches()` already does for the geometric emitter)
 * and hands this file only the plain facts it needs: did a new contact
 * begin this frame, is at least one still down, and how fast is the
 * fastest one moving.
 */

/** How long a contact's transient spike takes to decay to nothing. Short —
 *  entry 48's own text calls it "the hit", and a hit that lingers reads as
 *  a held level rather than an event. **Mine**: no value is named in the
 *  entry, only "about 250ms". */
const TRANSIENT_DECAY_S = 0.25

/** The level a resting finger holds the picture at — "what makes a resting
 *  finger keep the picture awake" per the entry's own text. **Mine**: below
 *  the loudest music gets it, since a finger should read as *added*
 *  liveliness rather than as loud as the room. */
const LEVEL_FLOOR = 0.35

/** uv units/second at which drag speed saturates roughness at 1.0. **Mine**,
 *  tuned by feel rather than measured: a full-screen swipe in a third of a
 *  second is roughly this fast, and "roughness" reading as *fast* rather
 *  than *any movement at all* is the entry's own "a fling throws further"
 *  intuition (entry 50) arriving one entry early. */
const ROUGHNESS_SPEED_SCALE = 0.3

export interface TouchStreamState {
  transient: number
}

export function createTouchStreamState(): TouchStreamState {
  return { transient: 0 }
}

export interface TouchStream {
  /** 0-1, decaying. The hit. */
  transient: number
  /** 0 or LEVEL_FLOOR — whether to keep the picture awake right now. */
  level: number
  /** 0-1, from the fastest currently-down qualifying touch's drag speed. */
  roughness: number
}

/**
 * Call once per rendered frame, alongside `updateRipples`/`updateEmitter`.
 *
 * `began` is whether a qualifying contact started this frame — the caller's
 * own filtered read of `TouchField.events()`, kind `'down'`, with the
 * capture band and any `.hud-chip` contact already excluded. `anyDown` and
 * `maxSpeed` are the same exclusion applied to `TouchField.sample()`.
 */
export function updateTouchStream(state: TouchStreamState, dt: number, began: boolean, anyDown: boolean, maxSpeed: number): TouchStream {
  state.transient = Math.max(0, state.transient - dt / TRANSIENT_DECAY_S)
  if (began) state.transient = 1

  return {
    transient: state.transient,
    level: anyDown ? LEVEL_FLOOR : 0,
    roughness: Math.min(1, maxSpeed * ROUGHNESS_SPEED_SCALE),
  }
}
