/**
 * Where the HUD's icon chips sit on their arcs — docs/todo.md entries 19, 77
 * and 119.
 *
 * Pure geometry, in its own file, and entry 119 is what moved it here. The
 * arc had never been guarded along the top edge, so on every landscape
 * viewport the last chip on the outer ring was placed above the screen — it
 * existed, was wired, and could not be tapped. Fixing that meant being able
 * to scrub aspect ratios, and `hud.ts` cannot be imported headlessly at all:
 * it reaches `document` at module scope and transitively pulls in
 * `views.ts`, whose `?raw` GLSL imports Node has no loader for. A control
 * that can only be exercised by a real viewport will not be exercised, which
 * is the same reason `camera-arm.ts` takes its clock as a parameter.
 *
 * So this file knows nothing about the DOM and reads no globals: the
 * viewport arrives as `(w, h)`. `hud.ts` passes `window.innerWidth/Height`
 * and behaves exactly as it did.
 */

const DEG = Math.PI / 180

/** The inner icon arc, outside every band and the tick rim — what the wedge
 *  edits: `geo`, `atm`, `cam`, `ear`. */
const R_CHIPS_INNER = 1.08
/** docs/todo.md entry 77. The outer icon arc, outside the inner one — the
 *  global toggles that never change what the bands mean: `num`,
 *  `grav`, `day`. Wider so the two rings read as concentric
 *  rather than overlapping. **Mine**, per that entry's own "Mine" on the
 *  exact radius and size factor. */
const R_CHIPS_OUTER = 1.22
/** Where each icon arc is centred — not the notch. A symmetric arc at this
 *  radius puts the first icon's left edge at roughly x=0 on a 320px screen;
 *  the wedge's corner hinge means the arc leaves the screen sooner at the
 *  top-left than at the bottom-right, so rotating it buys margin at both ends.
 *  Shared by both rings — docs/todo.md entry 77 split eight chips into two
 *  rows of four specifically so both could centre honestly here again. */
const CHIP_ARC_MID = 232 * DEG
/** Gap between neighbouring icons along their arc, in px. */
const CHIP_GAP = 5
/**
 * How far inside an edge a chip's own border must stay, in px — docs/todo.md
 * entry 119. Beyond the half-chip the bound already accounts for, so the
 * pixel touching the screen edge is never the ring's own outline.
 */
const CHIP_EDGE_MARGIN = 4

/**
 * The angular span, on the 180°–270° quadrant, in which a chip of `size` at
 * radius `r` about hinge `(cx, cy)` is fully on screen — docs/todo.md entry
 * 119.
 *
 * Both edges are the same kind of statement about the angle. A chip's centre
 * sits at `(cx + r·cos a, cy + r·sin a)`, so it clears the left edge when
 * `cos a ≥ (size/2 + margin − cx) / r` and the top edge when
 * `sin a ≥ (size/2 + margin − cy) / r`. On this quadrant cosine increases
 * with the angle and sine decreases, so the first gives a lower bound and the
 * second an upper one — which is why one number could never have served for
 * both.
 *
 * **The top edge has never been guarded, and landscape is a supported
 * state.** `CHIP_ARC_MIN_START` (209°) stood here and guarded the left edge
 * only, from the day a seventh chip pushed the leading one off it (entry 19).
 * Every arc is hinged at `(w + 10, h + 10)` with a radius scaled by
 * `min(w, h)`, so in landscape the ring is swung from below the bottom edge
 * and its far end is above the top of the screen by construction — at
 * 844×390 the last outer chip landed at y = −18.6, its top at −42.6. The chip
 * existed, was wired, and could not be tapped.
 *
 * It replaces that constant rather than sitting under it. At 320×568 the
 * computed left bound is 218.3° for the outer ring against a row that already
 * starts at 220.3°, so the constant was never what kept anything on screen —
 * centring was — and two guards for one edge is how the next person stops
 * trusting either.
 */
function chipArcSpan(r: number, size: number, cx: number, cy: number): { min: number; max: number } {
  const reach = size / 2 + CHIP_EDGE_MARGIN
  // Clamped because a viewport can be small enough that the ratio leaves
  // [-1, 1], where acos/asin are NaN — and a NaN angle places every chip at
  // `left: NaNpx`, which is a blank corner rather than a clipped one.
  const clamp1 = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v)
  const min = 2 * Math.PI - Math.acos(clamp1((reach - cx) / r))
  const max = Math.PI - Math.asin(clamp1((reach - cy) / r))
  return { min, max }
}

/**
 * Where chip `index` of `n` total on a given ring sits, in viewport pixels.
 *
 * Exported again for docs/todo.md entry 119's probe, and for nothing else —
 * entry 77 un-exported it when the fullscreen chip (entry 19) stopped needing
 * this arc, and `hud.ts`'s own `placeChips` is still the only caller in the
 * app. `n` must count every chip that will actually be shown on `ring`,
 * including the caller's own, since the span below depends on the true row
 * length before anything is laid out.
 */
export function chipPosition(
  index: number,
  n: number,
  chipSize: number,
  ring: 'inner' | 'outer',
  w: number,
  h: number,
): [number, number] {
  const base = Math.min(w, h)
  const cx = w + 10
  const cy = h + 10
  let r = base * (ring === 'outer' ? R_CHIPS_OUTER : R_CHIPS_INNER)

  // A ladder, so the order is checkable rather than emergent: natural
  // spacing first, then tighter spacing, then a smaller ring. No tested
  // viewport reaches the second rung — the rule exists so that the next chip
  // added does not silently reopen entry 119.
  let gap = CHIP_GAP
  let span = chipArcSpan(r, chipSize, cx, cy)
  let step = (chipSize + gap) / r
  if ((n - 1) * step > span.max - span.min) {
    gap = 0
    step = chipSize / r
  }
  // Shrinking the radius lengthens the arc available for the same angle and
  // pulls the far end down away from the top edge, so it is the last resort
  // rather than the first: it visibly moves the ring.
  for (let i = 0; i < 8 && (n - 1) * step > span.max - span.min; i++) {
    r *= 0.94
    span = chipArcSpan(r, chipSize, cx, cy)
    step = chipSize / r
  }

  const needed = (n - 1) * step
  // Centred on CHIP_ARC_MID wherever it fits, which is every portrait size
  // and is what keeps the approved portrait layouts still; clamped into the
  // computed span only where it does not.
  const latest = Math.max(span.min, span.max - needed)
  const start = Math.min(Math.max(CHIP_ARC_MID - needed / 2, span.min), latest)
  const a = start + index * step
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

