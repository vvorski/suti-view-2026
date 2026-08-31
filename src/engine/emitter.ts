/**
 * The touch-driven emitter — docs/todo.md entries 33, 50 and 57.
 *
 * A tap, hold or drag places an emitter at the finger that spawns rings from
 * that point in whichever geometric view is showing, and dies away over a
 * few seconds after the finger lifts. Contact time charges a single
 * quantity that does most of what the gesture needs to communicate — see
 * the entry's own reasoning for why one knob rather than three: a longer
 * hold spawns brighter rings while the finger is down (via the charge fed
 * straight into a ripple's birth level, the same field a drum hit's
 * loudness rides), and it grants the emitter more life to keep firing
 * weaker rings after it lifts, so the response thins out rather than
 * stopping dead. Drag speed (entry 50's "a fling throws further") rides
 * alongside charge rather than replacing it, boosting the birth level a
 * fast swipe leaves without taking anything away from a slow, deliberate
 * hold.
 *
 * Pure state and a pure update function, same discipline as ripples.ts and
 * shake.ts: no DOM, no clock of its own, everything arrives as `now` and
 * `dt` is derived from it. main.ts owns the only judgment call this module
 * doesn't make any more — entry 50 removed the hold/drag threshold that
 * used to separate a qualifying gesture from a tap, so `active` now means
 * simply "a qualifying contact is down", decided once in main.ts's
 * dispatch (chip and capture-zone exclusions) rather than reasoned about
 * per-frame here.
 */

import { spawnAt, type RippleState } from './ripples.ts'

/** Seconds of continuous contact before charge saturates at 1.0. */
const CHARGE_TIME = 2.5
/** Charge at the very first qualifying instant, not 0 — so the briefest tap
 *  still visibly does something. Raised from 0.4 to 0.6 by entry 50: it used
 *  to be chosen as "the briefest hold that clears the gesture threshold",
 *  and that threshold is gone — this is now what a bare *tap* is worth, and
 *  a tap is the first touch anyone gives this thing, the only chance to make
 *  them touch it twice. */
const CHARGE_FLOOR = 0.6
/** Seconds of afterlife a released emitter gets, at CHARGE_FLOOR and at
 *  full charge respectively. */
const LIFE_MIN = 2.0
const LIFE_MAX = 4.0
/** How often, in seconds, an active or dying emitter spawns a new ring —
 *  fast enough that "they keep coming" reads as continuous rather than as
 *  a metronome. Still the only trigger while releasing (afterlife) or
 *  holding still; SPAWN_DIST below is what a *moving* contact adds. */
const SPAWN_INTERVAL = 0.15
/** uv units of drag since the last spawn that also triggers one — entry 57.
 *  About a twentieth of the frame, so a drag draws a continuous-looking
 *  line rather than a handful of rings near wherever the finger happened to
 *  be every 150ms. The time term stays alongside it rather than being
 *  replaced by it: a *stationary* hold has no distance to spend, and still
 *  needs to keep emitting. */
const SPAWN_DIST = 0.05
/** uv units/second of drag speed that adds this much to a spawned ring's
 *  birth level, on top of charge — entry 50's "a fling throws further".
 *  **Mine**, on the same footing as `engine/touch.ts`'s own speed scale: a
 *  full-screen swipe in roughly a third of a second is near this fast. */
const SPEED_LEVEL_SCALE = 0.25

/** docs/todo.md entry 96 — the moon's own abundance, over cadence and the
 *  afterlife baseline only. `moonAbundance` (illuminated x presence, 0..1)
 *  is 0 at new moon or with the moon down, at which point every constant
 *  below is used exactly as written — the same algebraic-identity
 *  discipline entries 47, 75 and 76 all use. A full moon makes rings come
 *  up to 35% more often and lets the afterlife stretch its own baseline up
 *  to 25% longer; Decided's own figures, **Mine** as to applying them
 *  here specifically (SPAWN_INTERVAL and LIFE_MIN/LIFE_MAX are the two
 *  named targets in this file). */
const MOON_CADENCE_SWING = 0.35
const MOON_LIFE_SWING = 0.25

export interface EmitterState {
  /** Whether a qualifying contact is currently down. */
  active: boolean
  x: number
  y: number
  /** When the current unbroken contact began; null between gestures. */
  contactStart: number | null
  /** Where the most recent spawn happened, in the same uv space as x/y —
   *  entry 57's distance trigger measures drag against this, not against
   *  the previous frame's position, so a series of tiny sub-threshold
   *  moves still accumulates toward the next spawn correctly. */
  lastSpawnX: number
  lastSpawnY: number
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
    lastSpawnX: 0,
    lastSpawnY: 0,
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

function lifeFor(c: number, moonAbundance: number): number {
  const t = (c - CHARGE_FLOOR) / (1 - CHARGE_FLOOR) // 0 at the floor, 1 at full charge
  const swing = 1 + MOON_LIFE_SWING * moonAbundance
  return (LIFE_MIN + (LIFE_MAX - LIFE_MIN) * t) * swing
}

/**
 * Call once per rendered frame, alongside `updateRipples`. `active`/`x`/`y`
 * are main.ts's pointer recogniser's current answer to "is a qualifying
 * contact down, and where" — this function only decides *when* to spawn
 * from that and how strong, never whether the contact qualifies. `speed` is
 * the same drag velocity (uv units/second) `engine/touch.ts` reads for the
 * atmospheric views — 0 for a still hold, ignored entirely while releasing,
 * since the afterlife's position is frozen and has no speed of its own.
 * `moonAbundance` is docs/todo.md entry 96's illuminated x presence, 0..1,
 * 0 at new moon or with the moon down — see this file's own MOON_* comment.
 */
export function updateEmitter(
  state: EmitterState,
  ripples: RippleState,
  now: number,
  active: boolean,
  x: number,
  y: number,
  speed = 0,
  moonAbundance = 0,
): void {
  const dt = Math.max(0, now - state.lastTick)
  state.lastTick = now
  const spawnInterval = SPAWN_INTERVAL * (1 - MOON_CADENCE_SWING * moonAbundance)

  if (active) {
    if (!state.active) {
      state.contactStart = now
      state.lastSpawnX = x
      state.lastSpawnY = y
    }
    state.active = true
    state.x = x
    state.y = y
    const c = Math.min(1, charge(now - (state.contactStart ?? now)) + speed * SPEED_LEVEL_SCALE)
    state.life = lifeFor(c, moonAbundance)
    state.totalLife = state.life
    state.releaseCharge = c
    const moved = Math.hypot(x - state.lastSpawnX, y - state.lastSpawnY)
    if (now - state.lastSpawn >= spawnInterval || moved >= SPAWN_DIST) {
      spawnAt(ripples, now, c, x, y)
      state.lastSpawn = now
      state.lastSpawnX = x
      state.lastSpawnY = y
    }
    return
  }

  state.active = false
  state.contactStart = null
  if (state.life <= 0) return

  state.life = Math.max(0, state.life - dt)
  if (state.life <= 0) return

  if (now - state.lastSpawn >= spawnInterval) {
    const fraction = state.totalLife > 0 ? state.life / state.totalLife : 0
    spawnAt(ripples, now, state.releaseCharge * fraction, state.x, state.y)
    state.lastSpawn = now
  }
}
