/**
 * The space bar, made into a shake — docs/todo.md entry 126.
 *
 * Victor: "in desktop make spacebar act like a shake, a continuously pressed
 * spacebar like a repeating hard shake." `shake.ts`'s `Tumble` already runs on
 * every desktop — `startShake` builds a real one wherever `DeviceMotionEvent`
 * exists, and desktop Chrome is exactly that platform with no permission
 * gate — it is only ever fed nothing, because no `devicemotion` event ever
 * fires there. This module is the feed: synthetic `MotionSample`s that make
 * the space bar produce a real `Tumble` response — the springs, the RGB slip,
 * the colour bias, the re-seed, the double-shake scramble — rather than a
 * second, parallel definition of what a shake does.
 *
 * Pure state and a pure update function, same discipline as `emitter.ts` and
 * `ripples.ts`: no DOM, no clock of its own, `held` arrives from the caller's
 * own keydown/keyup bookkeeping (main.ts) rather than being sensed here.
 *
 * Gravity-free by design, not by omission: every sample below has `z: 0` and
 * an `(x, y)` that oscillates about zero. `Tumble.sample()`'s own comment
 * says the gravity estimate "converges on whatever DC the signal has, which
 * for a gravity-free feed is ~0, and it subtracts that" — so this needs no
 * special case for a machine with no real "down", and `tilt()` stays (0, 0)
 * throughout, which is what keeps entry 30's gravity offset and entry 102's
 * falling emitters from acquiring a fake "down" on a desktop.
 */

import type { MotionSample } from '../shake.ts'

/** Peak in-plane acceleration, m/s². `shake.ts`'s adaptive bar (entry 88)
 *  rises to `STRONG_UP_BUSY` (20) as the phone reads busy, and a held space
 *  bar is precisely what makes it busy — an amplitude that only just cleared
 *  the resting bar (18) would fire once and then go quiet as the bar climbed
 *  past it, which reads as the feature breaking after the first press. 26
 *  clears the busy bar by 30%. */
const AMPLITUDE = 26
/** Oscillation rate, Hz. `shake.ts`'s own probe table calibrates a
 *  "deliberate shake" at 28 m/s²/4Hz and a "violent shake" at 45 m/s²/6Hz; 5Hz
 *  sits between them, inside the range the detector was actually tuned
 *  against rather than outside it. */
const FREQUENCY_HZ = 5
/** Seconds to rise from nothing to full amplitude, and — symmetrically — to
 *  fall back to nothing once released. A tap (keydown immediately followed by
 *  keyup) is therefore one 0.35s burst, rising and falling, about two cycles
 *  at `FREQUENCY_HZ`: enveloped rather than snapping to full amplitude and
 *  back, the same discipline `shake.ts`'s own probe motion uses. Held past
 *  the attack, the envelope simply stays at 1 for as long as `held` does —
 *  holding needs no repeat logic of its own, because a continuous 26 m/s² at
 *  5Hz already *is* a repeating hard shake; `shake.ts`'s existing cooldown and
 *  double-window govern how often that re-seeds, not this file. */
const ATTACK_S = 0.175
const RELEASE_S = ATTACK_S

export interface SynthShakeState {
  /** Seconds since this gesture's own `startSynthShake` call — keeps
   *  advancing through the release tail so the oscillation's phase is
   *  continuous across the transition, rather than restarting it. */
  t: number
  /** The value of `t` when `held` first read false, or `null` while still
   *  held (or before any press has begun). */
  releasedAt: number | null
  /** In-plane bearing, radians, rolled once per press and held for the whole
   *  gesture — docs/todo.md entry 104's own requirement that the RGB slip's
   *  held direction not oscillate frame to frame. A bearing re-rolled every
   *  frame is exactly the input entry 104 was written to stop reading; one
   *  rolled per press is a direction a hand shaking a phone one particular
   *  way would actually hold. */
  bearing: number
}

export function createSynthShake(): SynthShakeState {
  return { t: 0, releasedAt: null, bearing: 0 }
}

/** Call once, on the keydown that starts a press (not on `e.repeat`) — rolls
 *  a fresh bearing and resets the clock, so a second tap does not inherit the
 *  first's fading envelope or direction. */
export function startSynthShake(state: SynthShakeState): void {
  state.t = 0
  state.releasedAt = null
  state.bearing = Math.random() * Math.PI * 2
}

/**
 * Advance by `dt` and return this frame's synthetic sample, or `null` when
 * there is nothing to feed — either the space bar has never been pressed, or
 * a previous press's release tail has fully decayed. `held` is the caller's
 * own flag (set on keydown, cleared on keyup or a window `blur`); this file
 * tracks no key state of its own.
 */
export function updateSynthShake(state: SynthShakeState, dt: number, held: boolean): MotionSample | null {
  if (!held && state.releasedAt === null && state.t === 0) return null // never pressed

  if (held) {
    state.releasedAt = null
  } else if (state.releasedAt === null) {
    state.releasedAt = state.t
  }

  state.t += dt

  const attack = Math.min(1, state.t / ATTACK_S)
  let envelope = attack
  if (state.releasedAt !== null) {
    const sinceRelease = state.t - state.releasedAt
    if (sinceRelease >= RELEASE_S) {
      // Fully decayed — reset so a later press (should it arrive without its
      // own startSynthShake, which main.ts always calls, but a probe might
      // not) starts clean rather than inheriting a stale bearing.
      state.t = 0
      state.releasedAt = null
      return null
    }
    envelope *= 1 - sinceRelease / RELEASE_S
  }

  const amp = AMPLITUDE * envelope * Math.sin(2 * Math.PI * FREQUENCY_HZ * state.t)
  return { x: amp * Math.cos(state.bearing), y: amp * Math.sin(state.bearing), z: 0, spin: 0 }
}
