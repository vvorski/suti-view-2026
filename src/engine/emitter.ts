/**
 * The touch-driven emitter — docs/todo.md entries 33, 50, 57 and 102.
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
 * Entry 102 gives the afterlife somewhere to go rather than nowhere: while
 * the finger is down its position is the finger's, exactly as always, but
 * once released and falling it accelerates along the phone's own in-plane
 * gravity, bounces off whichever edge it reaches, and settles there — see
 * `updateEmitter`'s own `gravity`/`halfExtent` parameters below.
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

/** Seconds of continuous contact before charge saturates at 1.0.
 *
 *  Exported since docs/todo.md entry 115, which derives the still-hold that
 *  opens the menu from it rather than picking a number: past this point a
 *  hold already buys nothing here, so that is the gesture space the menu can
 *  take without cost. Read there, not copied — a second 2.5 in main.ts is
 *  the duplication CLAUDE.md names, and it would silently stop being
 *  "just past full charge" the moment this moved. */
export const CHARGE_TIME = 2.5
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

/**
 * docs/todo.md entry 102 — a released emitter falls. `gravity` arrives as
 * `shake.gravity()` (shake.ts), already capped for the tumble's own offset
 * spring rather than expressed in any physical unit — this file does not
 * need physical units, only a direction and a magnitude that varies
 * correctly with tilt, and `GRAVITY_ACCEL_SCALE` below is chosen entirely
 * against that shape rather than against `EARTH_G`. **Every constant in
 * this block is Mine**, chosen against `emitter.ts`'s own existing
 * afterlife (`LIFE_MIN`/`LIFE_MAX` above), not against any outside physics.
 */
/** Converts `shake.gravity()`'s own capped range (±MAX_OFFSET *
 *  GRAVITY_FRACTION per axis, about ±0.033 — see shake.ts) into an
 *  acceleration, uv units/s², such that a drop from mid-frame (about 0.5 uv
 *  to the near edge) reaches it in roughly the 0.9s Decided asks for:
 *  `d = 0.5 * a * t^2` solved for `a` at `d=0.5, t=0.9` gives `a ~= 1.23`;
 *  `1.23 / 0.033 ~= 36` is where this number comes from. */
const GRAVITY_ACCEL_SCALE = 36
/** Velocity retained, normal to the edge, after a bounce — Decided's own
 *  figure: enough restitution for one or two visible hops before it settles
 *  well inside a single gesture. */
const BOUNCE_RESTITUTION = 0.45
/** Velocity retained, tangential to the edge, after a bounce — "a small
 *  per-bounce loss" so a fall that lands at a shallow angle does not skid
 *  along the edge forever, on top of `BOUNCE_RESTITUTION` already bleeding
 *  the normal component. */
const BOUNCE_FRICTION = 0.85
/** uv units/second — bounds a long fall so it cannot outrun `SPAWN_DIST`'s
 *  own trail (a gap between rings) or a dropped frame's unusually large
 *  `dt` from flinging the emitter clean off the visible frame in one step. */
const TERMINAL_SPEED = 2.0
/** Below this speed, resting against an edge, the remaining velocity is
 *  zeroed outright rather than left to bounce forever at a shrinking
 *  amplitude — the settle Decided's own Done-when asks for, not an
 *  ever-finer Zeno's-paradox tremor nothing on screen would resolve anyway.
 *
 *  Sized against the fall itself, not picked small-because-that-sounds-
 *  settled: with `BOUNCE_RESTITUTION` fixed at 0.45 (Decided) and a ~0.9 s
 *  fall (also Decided), the geometric bounce decay only crosses a strict
 *  near-zero threshold (0.02) after five hops, around 2.3 s — past
 *  `LIFE_MIN`'s 2 s, which Done-when explicitly rules out. A residual speed
 *  of 0.25 instead lets it settle after exactly two hops, at ~1.7 s: the
 *  bounce height that speed would have produced is `v^2 / (2*a)`, about 2%
 *  of the frame's half-extent — sub-pixel on a real screen, i.e. genuinely
 *  settled, not merely called so. */
const SETTLE_SPEED = 0.25

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
  /** docs/todo.md entry 102 — uv units/second, zero while `active` (the
   *  finger's own position wins outright) and while idle, non-zero only
   *  during a falling afterlife. */
  vx: number
  vy: number
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
    vx: 0,
    vy: 0,
  }
}

function charge(contactSeconds: number): number {
  return CHARGE_FLOOR + (1 - CHARGE_FLOOR) * Math.min(1, contactSeconds / CHARGE_TIME)
}

function lifeFor(c: number, moonAbundance: number): number {
  // Floored at 0 for docs/todo.md entry 112. Every contact-driven charge is
  // at least CHARGE_FLOOR by construction, so this clamp cannot fire for a
  // finger and changes nothing on that path — but a hovering cursor's
  // `chargeCap` deliberately puts `c` *below* the floor, and without this
  // the arithmetic runs `t` negative and hands back a life of 0.05s, or a
  // negative one, which the release branch reads as already dead. That would
  // have silently deleted the afterlife entry 112 explicitly asks to keep:
  // "the rings thin out over the emitter's own remaining life instead of
  // stopping dead, which is exactly what a lifted finger already does".
  // Floored, a hover gets LIFE_MIN, which is exactly that.
  const t = Math.max(0, (c - CHARGE_FLOOR) / (1 - CHARGE_FLOOR)) // 0 at the floor, 1 at full charge
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
 * `gravity` and `halfExtent` are docs/todo.md entry 102: `gravity` is
 * `shake.gravity()` when the `grav` chip is on, `{x:0,y:0}` (its own default,
 * matching every other reads-a-sensor parameter in this codebase) otherwise
 * or while the sensor is refused/absent — a released emitter simply never
 * accelerates, which is what leaves every existing call site, and every
 * gesture with the chip off, byte-identical to before this entry.
 * `halfExtent` is the frame's own half-width/half-height in this same uv
 * space (scene.ts already has both, from the canvas's own client size), so a
 * fall bounces off the edge actually on screen rather than an assumed one.
 * `chargeCap` is docs/todo.md entry 112's hovering mouse cursor: 1 for every
 * contact a finger makes, and 0.35 for a hover, which has no end and would
 * otherwise charge to full and stay there — see the comment at the charge
 * line itself for why it scales rather than clamps.
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
  gravity: { x: number; y: number } = { x: 0, y: 0 },
  halfExtent: { x: number; y: number } = { x: 0.5, y: 0.5 },
  chargeCap = 1,
): void {
  const dt = Math.max(0, now - state.lastTick)
  state.lastTick = now
  const spawnInterval = SPAWN_INTERVAL * (1 - MOON_CADENCE_SWING * moonAbundance)

  if (active) {
    if (!state.active) {
      state.contactStart = now
      state.lastSpawnX = x
      state.lastSpawnY = y
      // A fresh gesture starts still — any velocity left over from a
      // previous release's own fall has no business surviving into this one.
      state.vx = 0
      state.vy = 0
    }
    state.active = true
    state.x = x
    state.y = y
    // docs/todo.md entry 112 — `chargeCap` scales the whole charge rather
    // than clamping it, and that is the difference between the entry's two
    // requirements both holding and only one of them holding. A hovering
    // cursor is capped at 0.35, below CHARGE_FLOOR, because charge only
    // accumulates while active and an uncapped hover would sit at 1.0 —
    // louder than any deliberate hold a finger can give it — for as long as
    // the mouse kept moving. But `speed` reaches the picture through this
    // one expression and nowhere else, so a `Math.min(chargeCap, …)` would
    // have pinned every hover at exactly 0.35 and made "a fast sweep throws
    // brighter rings" quietly false. Scaled, a hover runs 0.21 still to 0.35
    // swept, always under the 0.616 a 0.1s tap is worth. The default of 1 is
    // an exact multiplication, so every existing call is byte-identical.
    const c = Math.min(1, charge(now - (state.contactStart ?? now)) + speed * SPEED_LEVEL_SCALE) * chargeCap
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

  // docs/todo.md entry 102 — down is real. `gravity` is `{0,0}` whenever the
  // `grav` chip is off or the sensor has nothing to say, which makes every
  // line below a no-op: velocity stays at 0, position never moves, neither
  // bounce condition can ever be reached. Held upright, `gravity` points
  // in-plane and the emitter accelerates toward the low edge; laid flat, the
  // in-plane projection is ~0 and it stays exactly where it was put — no
  // branch decides which, the vector itself already does.
  state.vx += gravity.x * GRAVITY_ACCEL_SCALE * dt
  state.vy += gravity.y * GRAVITY_ACCEL_SCALE * dt
  const fallSpeed = Math.hypot(state.vx, state.vy)
  if (fallSpeed > TERMINAL_SPEED) {
    const k = TERMINAL_SPEED / fallSpeed
    state.vx *= k
    state.vy *= k
  }
  state.x += state.vx * dt
  state.y += state.vy * dt

  // Reflect off whichever edge was actually reached, not the frame's own
  // bottom — two independent axis tests, so a corner still reflects each
  // axis correctly on its own.
  if (state.x > halfExtent.x) {
    state.x = halfExtent.x
    state.vx = -state.vx * BOUNCE_RESTITUTION
    state.vy *= BOUNCE_FRICTION
  } else if (state.x < -halfExtent.x) {
    state.x = -halfExtent.x
    state.vx = -state.vx * BOUNCE_RESTITUTION
    state.vy *= BOUNCE_FRICTION
  }
  if (state.y > halfExtent.y) {
    state.y = halfExtent.y
    state.vy = -state.vy * BOUNCE_RESTITUTION
    state.vx *= BOUNCE_FRICTION
  } else if (state.y < -halfExtent.y) {
    state.y = -halfExtent.y
    state.vy = -state.vy * BOUNCE_RESTITUTION
    state.vx *= BOUNCE_FRICTION
  }

  const atEdge =
    state.x >= halfExtent.x || state.x <= -halfExtent.x || state.y >= halfExtent.y || state.y <= -halfExtent.y
  if (atEdge && Math.hypot(state.vx, state.vy) < SETTLE_SPEED) {
    state.vx = 0
    state.vy = 0
  }

  // SPAWN_DIST already fires a ring for every 0.05 uv of movement — Decided's
  // own "the fall draws itself, free" — so the falling trail needs this
  // exact test wired into the release branch too, not a new rule beside it.
  const moved = Math.hypot(state.x - state.lastSpawnX, state.y - state.lastSpawnY)
  if (now - state.lastSpawn >= spawnInterval || moved >= SPAWN_DIST) {
    const fraction = state.totalLife > 0 ? state.life / state.totalLife : 0
    spawnAt(ripples, now, state.releaseCharge * fraction, state.x, state.y)
    state.lastSpawn = now
    state.lastSpawnX = state.x
    state.lastSpawnY = state.y
  }
}
