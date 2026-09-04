/**
 * Strata's sand — docs/todo.md entry 110.
 *
 * A falling-sand cellular automaton on a fixed low-resolution grid: the
 * audio pours coloured grains in from whichever edge is up, they sift down
 * under the phone's own in-plane gravity, and they pile along whichever edge
 * is down. Laid flat nothing falls, the pile holds, and new grains hang as
 * dust; turned over, the pile becomes the source and rains back down.
 *
 * **Why a grid of cells and not a height profile.** A pile along one edge is
 * a 1D profile and cannot be turned over — a profile has no way to fall, and
 * flipping the frame is the whole gesture this exists for. Entry 61 wrote "a
 * cellular-automaton sand model this entry is deliberately not" about the
 * powder egg's pile; that was a scope line for that entry, not a rule for the
 * project, and this is that model on purpose.
 *
 * **Why the state lives here and not in a shader.** `views.ts` says a view is
 * "nothing but a fragment shader plus a label", and a view with its own
 * ping-pong render target breaks that for every other view. The spectrogram
 * already accumulates its state in TypeScript and hands it over as a
 * `DataTexture` (`historyTexture` in `scene.ts`), so this is the second
 * tenant of a pattern that already exists rather than a new one. It is also
 * what makes the model probeable headless, which a shader never is.
 *
 * **`gravZ` is deliberately not used, and must not be.** The phone's
 * face-up/face-down component exists in `shake.ts` and is never exposed;
 * three built entries reached this same fork and decided it the same way.
 * Flat-versus-vertical is *already* the physics of the in-plane pair
 * `tilt()` returns — `(0, 0)` lying flat, unit length held upright, every
 * angle between correct for free — and a sand frame lying on its face
 * behaves exactly like one lying on its back. A mode flag here would be
 * strictly worse than the physics.
 *
 * Pure state and a pure update function, same discipline as `posture.ts`,
 * `camera-arm.ts` and `motion-bias.ts`: no DOM, no clock of its own, `dt`
 * arrives from the caller in seconds. The one impure-looking thing — the
 * RGBA byte buffer — is the texture's own backing store, written in place so
 * a frame costs no allocation.
 */

/** Cells across the short side of the frame. 96 puts ~16k cells in a
 *  portrait frame, which is one cheap pass a frame in TypeScript and a
 *  ~64 KB upload — less than the spectrum ring already moves. Coarser reads
 *  as a bar chart; finer stops reading as grains at phone size. */
export const SEDIMENT_SHORT_SIDE = 96

import { isFlatTilt } from './tilt.ts'

/** Cells a falling grain crosses per second. A grain crosses a 170-cell
 *  portrait frame in under three seconds, which is what makes a turn-over
 *  read as the pile *raining* rather than teleporting; at 60 fps this is one
 *  cell a frame, so the sweep below runs once per rendered frame in the
 *  ordinary case. Much slower and a flip takes longer than anyone holds the
 *  phone upside down for. */
const FALL_CELLS_PER_S = 60

/** How often a grain hanging as dust takes a step while the phone is flat —
 *  the entry's own figure, about a cell every 0.25 s. Slow enough to read as
 *  suspension rather than as falling sideways. */
const DUST_CELLS_PER_S = 4

/** Grains a second at full loudness, summed across every band. Sized from
 *  the entry's own target: about a fifth of the frame in ninety seconds of
 *  continuous loud vertical play, which for a 96x170 frame is ~3.3k grains
 *  over 90 s against a real loud spectrum (mean band energy near 0.9).
 *  Faster and the frame is full before a song ends. */
const POUR_GRAINS_PER_S = 40

/** No more than this many fall steps are taken in one update, however large
 *  `dt` is. A tab resumed after a minute must not spend that minute's worth
 *  of steps in one frame — the grains would arrive already piled, and the
 *  frame that did it would drop. */
const MAX_STEPS_PER_UPDATE = 4

/** The brightness a grain is laid down at with a perfectly balanced
 *  spectrum. Not 1.0, because the lightness shift below has to be able to go
 *  up as well as down and a grain pinned at white could only ever darken. */
const GRAIN_LEVEL = 0.85

/** How far a grain's colour moves across the full bass-to-treble range of
 *  spectral tilt: darker and warmer for a bass-heavy moment, lighter and
 *  cooler for a bright one. Both ±0.08, the entry's own figures — large
 *  enough that a track changing texture writes visible strata, small enough
 *  that a steady one writes a plain pile rather than a rainbow.
 *
 *  **What the entry asked for, and why this is not literally it.** Entry
 *  110 says the grain's base is "the atmospheric layer's colour", on the
 *  reasoning that this is "the only choice consistent with every other
 *  atmospheric view". That reasoning is right and its literal instruction is
 *  wrong, because of where the layer colour is actually applied: no
 *  atmospheric view has ever known its own layer colour. Each renders to the
 *  atmosphere target in its own hues and `composite.frag.glsl` multiplies
 *  the result by `uAtmColour` (`composite.frag.glsl:207-211`). Baking the
 *  layer colour into a grain would apply it twice — a violet layer would go
 *  to violet squared, darker and more saturated than every neighbouring
 *  view, which is exactly the inconsistency the entry was trying to avoid.
 *  So a grain carries near-neutral with the tilt shift applied as a warm or
 *  cool *tint*, and the composite's own multiply supplies the layer colour.
 *  The picture is what the entry asked for; the arithmetic happens one stage
 *  later, where it happens for everybody else. */
const TILT_LEVEL = 0.08
const TILT_TINT = 0.08

/** Cell occupancy. Kept as a byte array beside the colour buffer rather than
 *  read back out of the colours' alpha, because the sweep touches it far
 *  more often than it touches colour and a byte per cell is a third of the
 *  cache traffic. */
const EMPTY = 0
const AIRBORNE = 1
const LANDED = 2

export interface SedimentState {
  readonly width: number
  readonly height: number
  /** RGBA bytes, row-major, `y * width + x`. This is the `DataTexture`'s own
   *  backing store — written in place, never reallocated; the caller sets
   *  `needsUpdate` once a frame. Alpha is 0 for an empty cell and 255 for an
   *  occupied one, so the shader needs no second sampler to know where the
   *  sand is. */
  readonly pixels: Uint8Array
  /** `EMPTY` / `AIRBORNE` / `LANDED`, one byte a cell. */
  readonly cells: Uint8Array
  /** Which way is down, in grid space, as a unit step: exactly one of these
   *  is non-zero. `(0, 1)` is portrait-down — grains fall toward increasing
   *  y and pile along the bottom row. Remembered between updates so a change
   *  of direction can wake the pile, and so a phone laid flat keeps pouring
   *  in from the edge that was up when it was last held. */
  gx: number
  gy: number
  /** The lean, as the minor tilt component over the dominant one: -1..1,
   *  which is the tangent of the angle between gravity and the grid axis
   *  grains are falling along. Read twice, and both readings matter — its
   *  *sign* is the diagonal a blocked grain tries first, and its
   *  *magnitude* is how readily a grain with nowhere to fall slides
   *  sideways instead of resting. That second use is what makes a leaned
   *  phone gather its sand into a corner: at 45° the ratio is 1 and every
   *  grain slides until it reaches the wall, while a phone a few degrees
   *  off upright slides one grain in twenty and merely piles a little
   *  askew. 0 means dead upright, and the diagonal is then chosen per grain
   *  at random so the pile stays symmetric. */
  slip: number
  /** True while the phone reads as flat. Held in state only so the caller
   *  and the probe can see the model's own verdict rather than recomputing
   *  the threshold. */
  flat: boolean
  landed: number
  airborne: number
  /** Fractional fall steps and dust steps carried between frames, so the
   *  rates above are honoured at any frame rate rather than becoming "one a
   *  frame, whatever that is". */
  fallAccum: number
  dustAccum: number
  /** Fractional grains owed per band, same reason. One entry per band the
   *  caller last passed; resized on the first update that changes count. */
  pourAccum: Float32Array
  /** Deterministic, so a probe run is reproducible and a bug found in one is
   *  reachable in the next. */
  seed: number
}

export function createSedimentState(width: number, height: number): SedimentState {
  return {
    width,
    height,
    pixels: new Uint8Array(width * height * 4),
    cells: new Uint8Array(width * height),
    gx: 0,
    gy: 1,
    slip: 0,
    flat: false,
    landed: 0,
    airborne: 0,
    fallAccum: 0,
    dustAccum: 0,
    pourAccum: new Float32Array(0),
    seed: 0x9e3779b9,
  }
}

/** mulberry32 — three lines, no dependency, and the same sequence on every
 *  platform, which `Math.random()` is not required to be. */
function rand(state: SedimentState): number {
  state.seed = (state.seed + 0x6d2b79f5) | 0
  let t = state.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * Which way is down, from the in-plane tilt pair.
 *
 * The grid does not rotate into the gravity frame: the *dominant* axis picks
 * the fall direction and the minor component becomes the lean. Rotating the
 * grid instead would make the flip continuous, at the cost of re-sampling —
 * and every re-sample shears the pile's own cells, which is the one thing a
 * sand frame must not do. Portrait, landscape, upside-down and every
 * diagonal hold fall out of this with no case for any of them.
 *
 * The lean is kept as a ratio rather than only its sign. A sign alone was
 * built first and the probe caught what it does: at any lean at all, however
 * slight, every blocked grain prefers the same side, so a phone a degree off
 * upright gathers its whole pile into a corner exactly as hard as one held
 * at 45°. The ratio is the tangent of the angle off the fall axis, so the
 * response is continuous in the thing the hand is actually doing.
 */
function gravityFor(tiltX: number, tiltY: number): { gx: number; gy: number; slip: number } {
  const ax = Math.abs(tiltX)
  const ay = Math.abs(tiltY)
  if (ax > ay) return { gx: Math.sign(tiltX) || 1, gy: 0, slip: ax === 0 ? 0 : tiltY / ax }
  return { gx: 0, gy: Math.sign(tiltY) || 1, slip: ay === 0 ? 0 : tiltX / ay }
}

/**
 * The spectrum's own balance, -1 (all bass) to 1 (all treble), from the
 * bands already being drawn. Deliberately not a new analysis: entry 110's
 * grain colour asks for "spectral tilt at birth", and the mean of the upper
 * half against the lower half of the same band array the pour is reading is
 * that, computed where it is used.
 *
 * Refuses on silence — a room with nothing in it is not bass-heavy, and
 * reporting it as such would tint every grain of a quiet passage. Returns 0,
 * which is the unshifted layer colour, in the habit `spectralFlatness` set.
 */
function spectralTilt(bands: ArrayLike<number>): number {
  const n = bands.length
  if (n < 2) return 0
  const half = n >> 1
  let low = 0
  let high = 0
  for (let i = 0; i < half; i++) low += bands[i]
  for (let i = n - half; i < n; i++) high += bands[i]
  const total = low + high
  if (total <= 1e-6) return 0
  return (high - low) / total
}

/** Wake the whole pile. Called when down changes direction: the grains that
 *  were resting are now unsupported, and the pile becoming the source is the
 *  entire point of turning the frame over. */
function wakePile(state: SedimentState): void {
  const cells = state.cells
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === LANDED) cells[i] = AIRBORNE
  }
  state.airborne += state.landed
  state.landed = 0
}

function place(state: SedimentState, index: number, r: number, g: number, b: number): void {
  state.cells[index] = AIRBORNE
  const p = index * 4
  state.pixels[p] = r
  state.pixels[p + 1] = g
  state.pixels[p + 2] = b
  state.pixels[p + 3] = 255
  state.airborne++
}

/** Move a grain's colour with it. The occupancy byte is the caller's to set:
 *  a move and a landing write different values for the same colour copy. */
function moveColour(state: SedimentState, from: number, to: number): void {
  const a = from * 4
  const b = to * 4
  state.pixels[b] = state.pixels[a]
  state.pixels[b + 1] = state.pixels[a + 1]
  state.pixels[b + 2] = state.pixels[a + 2]
  state.pixels[b + 3] = 255
  state.pixels[a + 3] = 0
}

/**
 * Pour this frame's grains in along the up edge.
 *
 * Each band is its own source, bass at the low end of the edge and treble at
 * the high end, emitting in proportion to its own energy. That is what makes
 * the pile's *shape* the long-run spectrum of whatever has been playing and
 * its *layers* the history — the spectrogram's idea rotated ninety degrees
 * and given weight. A single central pour would have produced one cone and
 * thrown all of that away.
 */
function pour(state: SedimentState, dt: number, bands: ArrayLike<number>): void {
  const n = bands.length
  if (n === 0) return
  if (state.pourAccum.length !== n) state.pourAccum = new Float32Array(n)

  // The edge grains enter from is the one gravity points away from, and the
  // axis they spread along is the other one. Held flat, `gx`/`gy` still hold
  // the last direction the phone was held at, so the dust keeps arriving
  // from the edge that was up rather than from nowhere.
  const alongX = state.gx === 0
  const span = alongX ? state.width : state.height
  const edge = alongX
    ? state.gy > 0
      ? 0
      : state.height - 1
    : state.gx > 0
      ? 0
      : state.width - 1

  // Bass-heavy (tilt < 0) lays a darker, warmer grain; bright lays a
  // lighter, cooler one. The tint is a straight red-against-blue lean at
  // constant green rather than a hue rotation, because it is multiplied by
  // whatever the layer colour turns out to be: a lean survives that multiply
  // as a lean whatever the hue underneath it, and a rotation would not.
  const tilt = spectralTilt(bands)
  const level = GRAIN_LEVEL + tilt * TILT_LEVEL
  const r = Math.round(255 * Math.min(1, Math.max(0, level * (1 - tilt * TILT_TINT))))
  const g = Math.round(255 * Math.min(1, Math.max(0, level)))
  const b = Math.round(255 * Math.min(1, Math.max(0, level * (1 + tilt * TILT_TINT))))

  for (let i = 0; i < n; i++) {
    const energy = Math.min(1, Math.max(0, bands[i]))
    state.pourAccum[i] += (dt * POUR_GRAINS_PER_S * energy) / n
    let owed = Math.floor(state.pourAccum[i])
    if (owed <= 0) continue
    state.pourAccum[i] -= owed

    const from = Math.floor((i * span) / n)
    const to = Math.max(from + 1, Math.floor(((i + 1) * span) / n))
    while (owed-- > 0) {
      const at = from + Math.floor(rand(state) * (to - from))
      const index = alongX ? edge * state.width + at : at * state.width + edge
      // No room at the source is where a full frame stops growing: the grain
      // is simply dropped. A sand frame with all its sand at the bottom is
      // finished, not broken, and the person turns it over.
      if (state.cells[index] === EMPTY) place(state, index, r, g, b)
    }
  }
}

/**
 * One fall step: every airborne grain moves one cell, or lands.
 *
 * A grain tries three things in order: the cell straight down; then the two
 * diagonals, the lean's own side first; then, if it is leaning, a slide
 * straight along the blocking surface toward the low corner. Only when all
 * of those fail does it land. It lands *only* with something under it —
 * a grain, or the wall — which is what makes "no grain rests above an empty
 * cell" an invariant of the model rather than something the probe has to
 * hope for.
 *
 * The sideways slide is what a tilted frame actually does and the first
 * version of this did not: a grain reaching the floor was landed on the
 * spot, so a phone leaned to 45° built the same flat-bottomed pile as one
 * held straight up. Sand in a tilted frame slides along the low edge until
 * it reaches the corner, and that is a slide along a *wall*, never a
 * diagonal — there is no diagonal to take once you are on the floor.
 *
 * Both the perpendicular sweep direction and the fall direction run
 * *backwards*, from the edge grains are moving toward: a grain must never
 * move into a cell this same step has yet to visit, or it would be picked up
 * again and travel several cells in one step. That was not a theoretical
 * hazard — it is why the sweep's own order is part of the model rather than
 * an implementation detail.
 */
function fallStep(state: SedimentState): void {
  const { width, height, cells, gx, gy } = state
  // Perpendicular to gravity, for the diagonals and the slide.
  const px = gy === 0 ? 0 : 1
  const py = gx === 0 ? 0 : 1
  const lean = Math.sign(state.slip)
  const slideChance = Math.min(1, Math.abs(state.slip))

  // Along gravity: start at the far edge and walk back. Across it: start at
  // the side the lean pushes grains toward.
  const xFrom = gx !== 0 ? (gx > 0 ? width - 1 : 0) : lean > 0 ? width - 1 : 0
  const xStep = gx !== 0 ? (gx > 0 ? -1 : 1) : lean > 0 ? -1 : 1
  const yFrom = gy !== 0 ? (gy > 0 ? height - 1 : 0) : lean > 0 ? height - 1 : 0
  const yStep = gy !== 0 ? (gy > 0 ? -1 : 1) : lean > 0 ? -1 : 1

  for (let yi = 0; yi < height; yi++) {
    const y = yFrom + yi * yStep
    for (let xi = 0; xi < width; xi++) {
      const x = xFrom + xi * xStep
      const index = y * width + x
      if (cells[index] !== AIRBORNE) continue

      // A leaning frame does not only steer a *blocked* grain: gravity
      // itself is off the grid axis, so the grain drifts down-slope on the
      // way down. Taken as a per-step chance equal to the lean, which is
      // the tangent of that angle — at 45° every step is diagonal and the
      // sand runs into the low corner, a few degrees off upright drifts one
      // step in twenty. The first version of this steered only blocked
      // grains and the probe caught what that produces: a pile whose centre
      // of mass sat at 0.53 of the frame, which is to say flat along the
      // bottom, which is exactly what the entry says a leaned phone must
      // not build.
      if (lean !== 0 && rand(state) < slideChance) {
        const dx = x + gx + px * lean
        const dy = y + gy + py * lean
        if (dx >= 0 && dx < width && dy >= 0 && dy < height) {
          const drift = dy * width + dx
          if (cells[drift] === EMPTY) {
            moveColour(state, index, drift)
            cells[index] = EMPTY
            cells[drift] = AIRBORNE
            continue
          }
        }
      }

      const ny = y + gy
      const nx = x + gx
      const onFloor = nx < 0 || nx >= width || ny < 0 || ny >= height
      if (!onFloor) {
        const below = ny * width + nx
        if (cells[below] === EMPTY) {
          moveColour(state, index, below)
          cells[index] = EMPTY
          cells[below] = AIRBORNE
          continue
        }
      }

      // Blocked below. Try the lean's own side first, then the other; with
      // no lean the side is chosen per grain so a pile from a steady source
      // stays symmetric instead of drifting one way for its whole life.
      const first = lean !== 0 ? lean : rand(state) < 0.5 ? -1 : 1
      let moved = false
      if (!onFloor) {
        for (const side of [first, -first]) {
          const dx = nx + px * side
          const dy = ny + py * side
          if (dx < 0 || dx >= width || dy < 0 || dy >= height) continue
          const diag = dy * width + dx
          if (cells[diag] !== EMPTY) continue
          moveColour(state, index, diag)
          cells[index] = EMPTY
          cells[diag] = AIRBORNE
          moved = true
          break
        }
      }

      // Nowhere down and nowhere diagonal: slide along the surface toward
      // the low corner, as often as the lean is steep. A grain that slides
      // stays airborne — it has not come to rest, it is still travelling.
      if (!moved && lean !== 0 && rand(state) < slideChance) {
        const sx = x + px * lean
        const sy = y + py * lean
        if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
          const side = sy * width + sx
          if (cells[side] === EMPTY) {
            moveColour(state, index, side)
            cells[index] = EMPTY
            cells[side] = AIRBORNE
            moved = true
          }
        }
      }

      if (!moved) {
        cells[index] = LANDED
        state.airborne--
        state.landed++
      }
    }
  }
}

/**
 * One dust step, taken only while the phone is flat: airborne grains lose
 * their fall and wander instead, and never land.
 *
 * Landed grains are untouched — sand lying flat stays where it lies, which
 * is why laying the phone down holds the picture instead of erasing it.
 * Everything still in the air stays in the air until the phone is raised,
 * and then all of it drops at once. That is the reward for picking it up,
 * and the reason the dust exists at all.
 */
function dustStep(state: SedimentState): void {
  const { width, height, cells } = state
  // A single pass in a fixed order would sweep the dust one way across the
  // frame; the walk is a random neighbour, so the pass order only decides
  // who gets first refusal on a cell, which is not visible.
  for (let index = 0; index < cells.length; index++) {
    if (cells[index] !== AIRBORNE) continue
    const x = index % width
    const y = (index - x) / width
    const dx = Math.floor(rand(state) * 3) - 1
    const dy = Math.floor(rand(state) * 3) - 1
    if (dx === 0 && dy === 0) continue
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
    const to = ny * width + nx
    if (cells[to] !== EMPTY) continue
    moveColour(state, index, to)
    cells[index] = EMPTY
    cells[to] = AIRBORNE
  }
}

/**
 * Advance the sand one frame.
 *
 * `tiltX`/`tiltY` are `shake.ts`'s own in-plane pair and `bands` the
 * spectrum already on screen. No colour is passed: see `TILT_TINT` above for
 * why the layer colour arrives one stage later, at the composite.
 *
 * `hasMotion` is false only when no `devicemotion` sample has ever arrived —
 * a desktop, or an iOS device whose sensor was refused. That case assumes
 * portrait-down rather than flat: a view that can never do anything on a
 * laptop is not a smaller feature, it is an inert one, and portrait-down is
 * what a phone in a hand almost always is.
 */
export function updateSediment(
  state: SedimentState,
  dt: number,
  tiltX: number,
  tiltY: number,
  hasMotion: boolean,
  bands: ArrayLike<number>,
): void {
  if (dt <= 0) return

  const tx = hasMotion ? tiltX : 0
  const ty = hasMotion ? tiltY : 1
  state.flat = isFlatTilt(tx, ty)

  if (!state.flat) {
    const g = gravityFor(tx, ty)
    if (g.gx !== state.gx || g.gy !== state.gy) {
      state.gx = g.gx
      state.gy = g.gy
      wakePile(state)
    }
    state.slip = g.slip
  }

  pour(state, dt, bands)

  if (state.flat) {
    // The fall accumulator is left where it is rather than reset: a phone
    // tipped up and down again should not gain or lose a step from the
    // fraction it was carrying.
    state.dustAccum += dt * DUST_CELLS_PER_S
    let steps = Math.min(MAX_STEPS_PER_UPDATE, Math.floor(state.dustAccum))
    state.dustAccum -= Math.floor(state.dustAccum)
    while (steps-- > 0) dustStep(state)
    return
  }

  state.fallAccum += dt * FALL_CELLS_PER_S
  let steps = Math.min(MAX_STEPS_PER_UPDATE, Math.floor(state.fallAccum))
  state.fallAccum -= Math.floor(state.fallAccum)
  while (steps-- > 0) fallStep(state)
}

/** Grid dimensions for a frame of the given aspect: `SEDIMENT_SHORT_SIDE`
 *  across the short side, the long side by aspect. Exported so `scene.ts`
 *  and the probe size the grid the same way rather than each doing their own
 *  arithmetic and disagreeing by a cell. */
export function sedimentGridFor(pixelWidth: number, pixelHeight: number): { width: number; height: number } {
  if (pixelWidth <= 0 || pixelHeight <= 0) return { width: SEDIMENT_SHORT_SIDE, height: SEDIMENT_SHORT_SIDE }
  if (pixelWidth <= pixelHeight) {
    return {
      width: SEDIMENT_SHORT_SIDE,
      height: Math.max(1, Math.round((SEDIMENT_SHORT_SIDE * pixelHeight) / pixelWidth)),
    }
  }
  return {
    width: Math.max(1, Math.round((SEDIMENT_SHORT_SIDE * pixelWidth) / pixelHeight)),
    height: SEDIMENT_SHORT_SIDE,
  }
}
