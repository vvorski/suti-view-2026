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

// Must match MAX_RIPPLES in every geometric shader — GLSL can't import this
// constant, so a change here has to be made by hand on every side.
//
// Twelve, not eight — docs/todo.md entry 33 reserves four slots for a touch
// emitter alongside the original eight for audio. Reserving rather than
// sharing the one buffer keeps a finger from evicting the music's own rings
// within a second: AUDIO_RIPPLES stays exactly the buffer Circles always
// had, and touch gets its own ring-buffer cursor over the slots above it.
export const MAX_RIPPLES = 12
// Exported so scripts/probe-ripples.ts (docs/todo.md entry 59) can check
// every geometric shader's own copy of this number against the one place it
// is actually meant to live — before this it was module-private, and
// nothing outside this file could read the number the six shaders are
// supposed to agree with.
export const AUDIO_RIPPLES = 8
const TOUCH_RIPPLES = MAX_RIPPLES - AUDIO_RIPPLES

// [birthTime, birthLevel, x, y] per slot, widened from [birthTime,
// birthLevel] for the same entry: a touch ripple has to carry *where* it
// was born, and one buffer with a wider stride is the shape this repo asks
// for over a parallel second system for the same concept. An audio ripple's
// x/y are never written and never read — every geometric shader's own
// origin logic only reaches for uRipples[i].zw in the touch slots.
const STRIDE = 4

/** Transient level a hit must cross, rising, to spawn a ring. */
const THRESHOLD = 0.5
/** Minimum seconds between spawns — keeps a fast hi-hat pattern from flooding the buffer. */
const MIN_INTERVAL = 0.28
/** Above this breakdown level, hits stop spawning rings — same gate as flow stalling. */
const BREAK_GATE = 0.6

export interface RippleState {
  /** [birthTime0, birthLevel0, x0, y0, birthTime1, ...]. Unborn slots
   *  sentinel far in the past. */
  slots: Float32Array
  /** Ring-buffer cursor over the audio slots [0, AUDIO_RIPPLES). */
  cursor: number
  /** Ring-buffer cursor over the touch slots, added on top of
   *  AUDIO_RIPPLES to reach [AUDIO_RIPPLES, MAX_RIPPLES). */
  touchCursor: number
  /** Previous frame's transient, so a threshold crossing can be detected. */
  lastTransient: number
  /** Time of the last spawn, for the cooldown. */
  lastSpawn: number
}

export function createRippleState(): RippleState {
  const slots = new Float32Array(MAX_RIPPLES * STRIDE)
  for (let i = 0; i < MAX_RIPPLES; i++) slots[i * STRIDE] = -1000
  return { slots, cursor: 0, touchCursor: 0, lastTransient: 0, lastSpawn: -1000 }
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
    const o = state.cursor * STRIDE
    state.slots[o] = now
    state.slots[o + 1] = transient
    state.cursor = (state.cursor + 1) % AUDIO_RIPPLES
    state.lastSpawn = now
  }

  state.lastTransient = transient
}

/**
 * Spawn a touch-born ripple at `(x, y)` — docs/todo.md entry 33. `x`/`y` are
 * in the same normalised space every geometric shader already computes its
 * own `uv` in: `(gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x,
 * uResolution.y)`, origin at the frame's centre.
 *
 * Its own cursor and its own reserved slot range, entirely separate from
 * `updateRipples`'s cooldown and threshold — a hold is a deliberate,
 * continuous gesture with its own cadence (see engine/emitter.ts), not a
 * transient to be gated the way a drum hit is.
 */
export function spawnAt(state: RippleState, now: number, level: number, x: number, y: number): void {
  const slot = AUDIO_RIPPLES + state.touchCursor
  const o = slot * STRIDE
  state.slots[o] = now
  state.slots[o + 1] = level
  state.slots[o + 2] = x
  state.slots[o + 3] = y
  state.touchCursor = (state.touchCursor + 1) % TOUCH_RIPPLES
}
