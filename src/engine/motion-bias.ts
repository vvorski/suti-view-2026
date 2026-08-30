/**
 * Motion reaches the picture's colour, continuously — docs/todo.md entry 58,
 * writing up `docs/motion-as-a-continuum.md`'s three tiers: **posture**
 * (tilt, meaningful while the phone is perfectly still), **disturbance**
 * (`shake.ts`'s own `disturb`, already computed and decayed with a 0.7s
 * constant), and **agitation** (new here: a slow memory of how disturbed the
 * phone has recently been, rising instantly and settling over about 30s).
 * `disturb`'s own `FLOOR` deliberately reads a held phone at 0.00 — a hand
 * and a table would be otherwise indistinguishable — so tilt is the one
 * signal with anything to say at rest, and it is not optional here.
 *
 * A render-time bias, at the same seam entry 48 established for touch
 * (immediately before `scene.ts` copies its inputs into uniforms): never a
 * write to stored `geoColour`/`atmColour`, which the shuffle, the director
 * and the HUD all already write and which turn up in a shared URL.
 *
 * Brightness-neutral by construction, not by clamping after the fact: each
 * contribution is a rotation in the plane orthogonal to the grey axis
 * (1,1,1) in RGB space, so `dr + dg + db` is exactly zero for any input
 * before it is ever combined or scaled — entry 21 exists because two
 * independent floors once multiplied into a black screen, and a random walk
 * that runs for a whole session cannot be allowed to accumulate the same
 * way. Combining three zero-sum vectors and scaling the result uniformly
 * (rather than clamping each channel independently, which would reintroduce
 * exactly the asymmetry this is trying to avoid) keeps the guarantee intact
 * even when the total would otherwise run past its ceiling.
 *
 * Pure state and a pure update function, same discipline as `ripples.ts`
 * and `emitter.ts`: no DOM, no clock of its own.
 */

/** Per-channel bias at the full extent of tilt (posture) — "at a full 90°
 *  tilt" per Decided. */
const POSTURE_MAX = 0.06
/** Per-channel bias at `disturb` 1.0. */
const DISTURBANCE_MAX = 0.12
/** Per-channel bias at agitation 1.0. */
const AGITATION_MAX = 0.08
/** Seconds for agitation to settle back down — long enough to survive a
 *  pause, short enough that a phone put down goes quiet within a track. */
const AGITATION_SETTLE_S = 30

export interface MotionBiasState {
  agitation: number
}

export function createMotionBiasState(): MotionBiasState {
  return { agitation: 0 }
}

export interface MotionBias {
  r: number
  g: number
  b: number
  /** For the numeric readout — entry 58's own reason: a feature whose whole
   *  design brief is "slight" is otherwise indistinguishable from doing
   *  nothing. */
  posture: number
  disturbance: number
  agitation: number
}

/**
 * A zero-sum rotation of colour between channels, parameterised by a 2D
 * direction `(ax, ay)` and a magnitude `amount`: at `ax = 1, ay = 0` (or the
 * unit circle's other three cardinal points) exactly one channel reaches
 * `±amount` and the other two split the opposite sign between them, and
 * `dr + dg + db` is identically 0 for every `(ax, ay)` — the standard
 * three-way opponent-axis construction color theory already uses for this
 * exact shape (a Maxwell-triangle-style split), not a bespoke one.
 *
 * **Mine**: the entry gives magnitudes (posture/disturbance/agitation's own
 * peaks) but never a channel mapping — "rotates colour between channels" is
 * the constraint, not a specific rotation. This is one that satisfies it
 * exactly, rather than a directional claim about which hue a particular
 * tilt "means".
 */
function rotate(ax: number, ay: number, amount: number): [number, number, number] {
  const HALF_SQRT3 = 0.8660254037844386 // sqrt(3)/2
  const dr = amount * ax
  const dg = amount * (-ax / 2 + ay * HALF_SQRT3)
  const db = amount * (-ax / 2 - ay * HALF_SQRT3)
  return [dr, dg, db]
}

/**
 * Call once per rendered frame. `tiltX`/`tiltY` are `shake.ts`'s own
 * uncapped `tilt()` pair; `disturb` is `TumbleState.disturb`.
 *
 * Posture, disturbance and agitation all rotate colour in the *same*
 * tilt-derived direction rather than three independent ones — **Mine**: the
 * entry's own imagery ("a phone that has been carried across a room
 * answers a tilt more than one that has been sitting on a table") reads as
 * disturbance and agitation *amplifying* whichever way the phone is
 * currently leaning, not introducing hues of their own that posture
 * doesn't already point toward.
 *
 * Agitation itself follows the same snap-up/decay envelope
 * `shake.ts`'s own `Tumble` class already uses for the analogous problem
 * (`this.disturb > this.envelope`): it rises to meet a new disturbance
 * instantly and settles back down over `AGITATION_SETTLE_S`, rather than
 * smoothing the rise too and blunting exactly the "carried across a room"
 * moment this exists to notice.
 */
export function updateMotionBias(
  state: MotionBiasState,
  dt: number,
  tiltX: number,
  tiltY: number,
  disturb: number,
): MotionBias {
  if (disturb > state.agitation) {
    state.agitation = disturb
  } else {
    state.agitation *= Math.exp(-dt / AGITATION_SETTLE_S)
  }

  const [pr, pg, pb] = rotate(tiltX, tiltY, POSTURE_MAX)
  const [dr, dg, db] = rotate(tiltX, tiltY, DISTURBANCE_MAX * disturb)
  const [ar, ag, ab] = rotate(tiltX, tiltY, AGITATION_MAX * state.agitation)

  let r = pr + dr + ar
  let g = pg + dg + ag
  let b = pb + db + ab

  // "The three are additive and clamp together" (Decided) — clamped as one
  // uniform scale-down when the combined vector's largest component would
  // exceed the sum of the three individual ceilings, which is the only way
  // to clamp that preserves r + g + b === 0 exactly (clamping each channel
  // independently would not).
  const ceiling = POSTURE_MAX + DISTURBANCE_MAX + AGITATION_MAX
  const peak = Math.max(Math.abs(r), Math.abs(g), Math.abs(b))
  if (peak > ceiling) {
    const scale = ceiling / peak
    r *= scale
    g *= scale
    b *= scale
  }

  return {
    r,
    g,
    b,
    posture: Math.hypot(tiltX, tiltY),
    disturbance: disturb,
    agitation: state.agitation,
  }
}
