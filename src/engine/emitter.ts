/**
 * The touch-driven emitter — docs/todo.md entry 33.
 *
 * A press-and-hold or a drag places an emitter at the finger that spawns
 * rings from that point in whichever geometric view is showing, and dies
 * away over a few seconds after the finger lifts. Contact time charges a
 * single quantity that does everything the gesture needs to communicate
 * — see the entry's own reasoning for why one knob rather than three: a
 * longer hold spawns brighter rings while the finger is down (via the
 * charge fed straight into a ripple's birth level, the same field a drum
 * hit's loudness rides), and it grants the emitter more life to keep firing
 * weaker rings after it lifts, so the response thins out rather than
 * stopping dead.
 *
 * Pure state and a pure update function, same discipline as ripples.ts and
 * shake.ts: no DOM, no clock of its own, everything arrives as `now` and
 * `dt` is derived from it. main.ts owns the only judgment call this module
 * doesn't make — whether a gesture has cleared the hold/drag threshold that
 * separates it from a tap.
 */

import { spawnAt, type RippleState } from './ripples.ts'

/** Seconds of continuous contact before charge saturates at 1.0. */
const CHARGE_TIME = 2.5
/** Charge at the very first qualifying instant, not 0 — so the briefest
 *  hold that clears the gesture threshold still visibly does something.
 *  An emitter that began at nothing would read as unresponsive at exactly
 *  the moment someone is learning the gesture. */
const CHARGE_FLOOR = 0.4
/** Seconds of afterlife a released emitter gets, at CHARGE_FLOOR and at
 *  full charge respectively. */
const LIFE_MIN = 2.0
const LIFE_MAX = 4.0
/** How often, in seconds, an active or dying emitter spawns a new ring —
 *  fast enough that "they keep coming" reads as continuous rather than as
 *  a metronome. */
const SPAWN_INTERVAL = 0.15

export interface EmitterState {
  /** Whether the finger is down past main.ts's hold/drag threshold. */
  active: boolean
  x: number
  y: number
  /** When the current unbroken contact began; null between gestures. */
  contactStart: number | null
  /** Seconds of afterlife remaining. 0 when nothing is emitting at all. */
  life: number
  /** The life this afterlife started with, for scaling loudness as a
   *  fraction of its own allotment rather than of the global maximum — a
   *  brief hold's rings should still fade to nothing by *its* life, not
   *  drop out early against LIFE_MAX. */
  totalLife: number
  /** The charge held at the moment of release, carried through the
   *  afterlife as the loudness ceiling a fading ring can still reach. */
  releaseCharge: number
  lastSpawn: number
  lastTick: number
}

export function createEmitterState(): EmitterState {
  return {
    active: false,
    x: 0,
    y: 0,
    contactStart: null,
    life: 0,
    totalLife: 0,
    releaseCharge: 0,
    lastSpawn: -1000,
    lastTick: 0,
  }
}

function charge(contactSeconds: number): number {
  return CHARGE_FLOOR + (1 - CHARGE_FLOOR) * Math.min(1, contactSeconds / CHARGE_TIME)
}

function lifeFor(c: number): number {
  const t = (c - CHARGE_FLOOR) / (1 - CHARGE_FLOOR) // 0 at the floor, 1 at full charge
  return LIFE_MIN + (LIFE_MAX - LIFE_MIN) * t
}

/**
 * Call once per rendered frame, alongside `updateRipples`. `active`/`x`/`y`
 * are main.ts's pointer recogniser's current answer to "is a qualifying
 * hold or drag underway, and where" — this function only decides *when* to
 * spawn from that and how strong, never whether the gesture qualifies.
 */
export function updateEmitter(
  state: EmitterState,
  ripples: RippleState,
  now: number,
  active: boolean,
  x: number,
  y: number,
): void {
  const dt = Math.max(0, now - state.lastTick)
  state.lastTick = now

  if (active) {
    if (!state.active) state.contactStart = now
    state.active = true
    state.x = x
    state.y = y
    const c = charge(now - (state.contactStart ?? now))
    state.life = lifeFor(c)
    state.totalLife = state.life
    state.releaseCharge = c
    if (now - state.lastSpawn >= SPAWN_INTERVAL) {
      spawnAt(ripples, now, c, x, y)
      state.lastSpawn = now
    }
    return
  }

  state.active = false
  state.contactStart = null
  if (state.life <= 0) return

  state.life = Math.max(0, state.life - dt)
  if (state.life <= 0) return

  if (now - state.lastSpawn >= SPAWN_INTERVAL) {
    const fraction = state.totalLife > 0 ? state.life / state.totalLife : 0
    spawnAt(ripples, now, state.releaseCharge * fraction, state.x, state.y)
    state.lastSpawn = now
  }
}
