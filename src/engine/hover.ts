/**
 * A mouse cursor moving over the picture, as a thing the picture answers —
 * docs/todo.md entry 112.
 *
 * A desktop visit had no way to play with this at all short of clicking. The
 * emitter, the ripples and the whole gesture vocabulary were already built
 * and a mouse never reached any of it: `main.ts` forwards every
 * `pointermove` to `touchField.move()`, hover moves included, and
 * `touches.ts` drops the ones with no slot — because a pointer that never
 * sent a `down` has no slot. The events were arriving; nothing was
 * listening.
 *
 * **Why this is not a synthesised touch**, which is the obvious shortcut and
 * the wrong one. A hover has no end: a cursor sitting on the glass would be
 * a finger that is permanently down, which holds `touchAnyDown` true for
 * ever, parks the tap/double-tap recogniser mid-gesture, and charges to a
 * full 2.5-second hold within three seconds of the mouse entering the
 * window. Every one of those is a regression on the touch path bought for
 * nothing. So the hover keeps its own state here and never enters
 * `touchField`.
 *
 * **Why a parked cursor goes quiet.** `docs/the-toy-wants-to-be-played-with
 * .md` draws the line this module sits on: *"Restraint belongs in what
 * persists. Generosity belongs in what responds."* A moving mouse is a
 * person responding, and gets no threshold and no delay. A cursor abandoned
 * on the glass is a picture changing on its own while nobody is touching it,
 * which is the half that has to be quiet. `HOVER_QUIET` is where one becomes
 * the other.
 *
 * Pure state and a pure update function, same discipline as `touches.ts`,
 * `emitter.ts` and `ripples.ts`: no DOM, no clock of its own, `now` arrives
 * from the caller in seconds. That is also the only way the timeout below
 * gets tested rather than waited for.
 */

import { VELOCITY_SMOOTH } from './touches.ts'

/**
 * How long after the last movement a cursor still counts as being played
 * with. 1.5 seconds: long enough that a pause to look at what just happened
 * does not cut the emitter off mid-thought, short enough that a laptop left
 * open on a desk goes still rather than drawing to an empty room. **Mine** —
 * the entry names the number, and the reasoning above is what picks it.
 */
export const HOVER_QUIET = 1.5

/**
 * What a hovering cursor's ring is worth, against a finger's 1. Not a taste
 * knob: `emitter.ts` accumulates charge only while active and takes
 * `CHARGE_TIME` seconds to reach full, so an uncapped hover would sit at
 * charge 1.0 — louder than any deliberate hold a finger can give it — for as
 * long as the mouse kept moving. 0.35 sits below `CHARGE_FLOOR`, so a
 * passing cursor is quieter than the briefest tap. A click is still worth
 * more than a hover, which is the ordering that makes clicking still mean
 * something.
 */
export const HOVER_CHARGE_CAP = 0.35

export interface HoverState {
  /** Canvas-space position of the cursor, in the same units the emitter
   *  wants. Meaningless while `present` is false. */
  x: number
  y: number
  /** Smoothed speed, canvas units per second — the same exponential filter a
   *  touch's velocity gets, so a fast sweep throws brighter rings by exactly
   *  the mechanism a fling already does. */
  speed: number
  /** When the cursor last actually moved. `null` before it ever has, which
   *  is what makes "has never hovered" distinguishable from "hovered once,
   *  long ago" without a second flag. */
  lastMoved: number | null
  /** False once the pointer leaves the window. Kept separate from
   *  `lastMoved` because leaving is immediate and parking is a timeout —
   *  two different ways to stop, and the entry wants both. */
  present: boolean
}

export function createHoverState(): HoverState {
  return { x: 0, y: 0, speed: 0, lastMoved: null, present: false }
}

/**
 * A `pointermove` from a mouse. `now` in seconds, `x`/`y` in canvas space.
 *
 * Speed is measured against the previous sample rather than accumulated, and
 * a first sample after an absence reports zero rather than a spike: the gap
 * since `lastMoved` could be a whole minute, and dividing a large distance
 * by a large time still produces a plausible-looking number that means
 * nothing. A cursor that reappears somewhere else has not travelled there.
 */
export function moveHover(state: HoverState, now: number, x: number, y: number): void {
  const resumed = !state.present || state.lastMoved === null
  const dt = state.lastMoved === null ? 0 : now - state.lastMoved
  if (resumed || dt <= 0) {
    state.speed = 0
  } else {
    const instant = Math.hypot(x - state.x, y - state.y) / dt
    state.speed += (instant - state.speed) * VELOCITY_SMOOTH
  }
  state.x = x
  state.y = y
  state.lastMoved = now
  state.present = true
}

/**
 * The pointer left the window, or the window lost focus.
 *
 * Deliberately does not clear position or speed: the emitter this feeds goes
 * *inactive* rather than being deleted, so entry 102's afterlife runs and the
 * rings already alive thin out over their own remaining life instead of
 * stopping dead — which is exactly what a lifted finger already does. Wiping
 * the position here would be indistinguishable to this module and worse for
 * anything that later wants to know where the cursor was last seen.
 */
export function hoverLeft(state: HoverState): void {
  state.present = false
  state.speed = 0
}

export interface HoverReading {
  /** Whether the emitter should be driven this frame. */
  active: boolean
  x: number
  y: number
  speed: number
}

/**
 * Call once per rendered frame. Reports whether the cursor is currently
 * being played with — present in the window, and moved within `HOVER_QUIET`.
 *
 * A cursor that has never hovered reports inactive with a zero speed, which
 * is what makes a touch-only phone byte-identical to a build without this
 * module: `updateEmitter` is called with `active: false` on a state whose
 * life is 0, and returns without spawning anything.
 */
export function updateHover(state: HoverState, now: number): HoverReading {
  const moving = state.lastMoved !== null && now - state.lastMoved < HOVER_QUIET
  const active = state.present && moving
  return { active, x: state.x, y: state.y, speed: active ? state.speed : 0 }
}
