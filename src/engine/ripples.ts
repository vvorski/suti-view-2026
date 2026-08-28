/**
 * Decides when the "Circles" geometric view spawns a new ring.
 *
 * A ring is an event, not a continuous signal, so it doesn't fit the
 * envelope-follower shape everything in mapping.ts uses. This is a small
 * edge-triggered state machine instead: watch `transient` cross a threshold on
 * the way up, gated by a minimum interval so a run of sixteenth notes doesn't
 * spawn eight rings on top of each other, and silenced during a breakdown —
 * the same treatment `flow` gets in scene.ts.
 *
 * State lives in a flat Float32Array rather than an array of objects because
 * it is uploaded to the GPU as a uniform every frame (see scene.ts) — one
 * shape, no per-frame allocation or marshalling.
 */

// Must match MAX_RIPPLES in circles.frag.glsl — GLSL can't import this
// constant, so a change here has to be made by hand on both sides.
export const MAX_RIPPLES = 8

/** Transient level a hit must cross, rising, to spawn a ring. */
const THRESHOLD = 0.5
/** Minimum seconds between spawns — keeps a fast hi-hat pattern from flooding the buffer. */
const MIN_INTERVAL = 0.28
/** Above this breakdown level, hits stop spawning rings — same gate as flow stalling. */
const BREAK_GATE = 0.6

export interface RippleState {
  /** [birthTime0, birthLevel0, birthTime1, birthLevel1, ...]. Unborn slots sentinel far in the past. */
  slots: Float32Array
  /** Ring-buffer cursor: the next slot a new ripple overwrites. */
  cursor: number
  /** Previous frame's transient, so a threshold crossing can be detected. */
  lastTransient: number
  /** Time of the last spawn, for the cooldown. */
  lastSpawn: number
}

export function createRippleState(): RippleState {
  const slots = new Float32Array(MAX_RIPPLES * 2)
  for (let i = 0; i < MAX_RIPPLES; i++) slots[i * 2] = -1000
  return { slots, cursor: 0, lastTransient: 0, lastSpawn: -1000 }
}

/** Call once per frame. Mutates `state` in place. */
export function updateRipples(
  state: RippleState,
  now: number,
  transient: number,
  breakdown: number,
): void {
  const crossedUp = transient > THRESHOLD && state.lastTransient <= THRESHOLD
  const cooledDown = now - state.lastSpawn > MIN_INTERVAL

  if (crossedUp && cooledDown && breakdown < BREAK_GATE) {
    state.slots[state.cursor * 2] = now
    state.slots[state.cursor * 2 + 1] = transient
    state.cursor = (state.cursor + 1) % MAX_RIPPLES
    state.lastSpawn = now
  }

  state.lastTransient = transient
}
