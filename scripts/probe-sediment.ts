/**
 * Headless exercise of Strata's falling-sand model — docs/todo.md entry 110.
 *
 * Everything the entry's Done-when asks for is a property of the automaton
 * rather than of the picture, which is the whole reason the state lives in
 * TypeScript instead of in a ping-pong render target: ninety seconds of
 * pouring, a phone laid flat, a phone turned over and a phone leaned into a
 * corner are all things this can drive in a few milliseconds and no browser
 * can be made to sit through.
 *
 * What it cannot answer, and does not pretend to: whether the result looks
 * like sand. That is `views-probe.html` and a phone.
 *
 *   node --experimental-strip-types scripts/probe-sediment.ts
 */

import {
  createSedimentState,
  updateSediment,
  sedimentGridFor,
  SEDIMENT_SHORT_SIDE,
  type SedimentState,
} from '../src/engine/sediment.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const HZ = 60
const DT = 1 / HZ

/** A loud, bass-heavy spectrum — eight bands, mean ~0.9, tilted so the
 *  bass end pours faster than the treble end. Loud enough to be the entry's
 *  "loud passage"; shaped so the column-height correlation below has
 *  something to correlate against, which a flat spectrum would not. */
const LOUD = [1.0, 1.0, 0.98, 0.95, 0.9, 0.84, 0.76, 0.7]
const SILENT = [0, 0, 0, 0, 0, 0, 0, 0]

/** Run for `seconds` at 60 Hz, holding tilt and bands fixed. */
function run(
  state: SedimentState,
  seconds: number,
  tiltX: number,
  tiltY: number,
  bands: number[],
  hasMotion = true,
): void {
  const frames = Math.round(seconds * HZ)
  for (let i = 0; i < frames; i++) updateSediment(state, DT, tiltX, tiltY, hasMotion, bands)
}

const cellAt = (s: SedimentState, x: number, y: number): number => s.cells[y * s.width + x]
const occupied = (s: SedimentState, x: number, y: number): boolean => cellAt(s, x, y) !== 0

/** Indices of every cell holding a grain, whatever its state. */
function occupiedIndices(s: SedimentState): number[] {
  const out: number[] = []
  for (let i = 0; i < s.cells.length; i++) if (s.cells[i] !== 0) out.push(i)
  return out
}

// The grid the entry names: 96 across the short side, ~170 tall in portrait.
const grid = sedimentGridFor(1170, 2070)
check(
  `grid is ${SEDIMENT_SHORT_SIDE} across the short side, long side by aspect`,
  grid.width === 96 && grid.height === 170,
  `${grid.width}x${grid.height}`,
)

// 1. Ninety seconds of loud audio held upright, from empty.
//
// The entry says this run leaves the frame "18-22 % of cells, all of them
// landed". Pouring and landing cannot both be true at the last instant of
// the pour — a grain emitted in the final frame is by definition still in
// the air — so the run is 90 s of pouring followed by a settle with no
// audio, and the fill figure is taken after it. Disclosed rather than
// quietly measured mid-air: the settle adds no grains, so the percentage is
// the ninety seconds' own, and "all landed" then means what it says.
const up = createSedimentState(grid.width, grid.height)
run(up, 90, 0, 1, LOUD)
const pouredCells = occupiedIndices(up).length
run(up, 6, 0, 1, SILENT)

const total = up.width * up.height
const fill = (up.landed / total) * 100
check(
  `90 s of loud audio fills 18-22 % of the frame (${fill.toFixed(1)} %)`,
  fill >= 18 && fill <= 22,
  `${up.landed} of ${total} cells`,
)
check(
  'every grain has come to rest after the settle',
  up.airborne === 0 && up.landed === pouredCells,
  `${up.airborne} airborne, ${up.landed} landed, ${pouredCells} poured`,
)

// No grain rests above an empty cell. This is the invariant that separates a
// pile from a cloud, and it is a property of the fall rule (a grain only
// lands when the cell below it is occupied or is the wall) rather than
// something the model checks for itself — so it is worth asserting, because
// a future change to the sweep order could break it silently.
{
  let floating = 0
  for (let y = 0; y < up.height - 1; y++) {
    for (let x = 0; x < up.width; x++) {
      if (occupied(up, x, y) && !occupied(up, x, y + 1)) floating++
    }
  }
  check('no grain rests above an empty cell', floating === 0, `${floating} floating grains`)
}

// The pile's shape is the spectrum's shape: taller columns under the louder
// bands. Compared as a rank correlation across the eight band spans rather
// than cell for cell — grains slip diagonally on the way down, so the
// profile is smoothed and only the ordering survives, which is exactly the
// claim the entry makes ("bass-heavy input -> the bass end of the pile is
// taller") and no more.
{
  const bandHeights: number[] = []
  for (let b = 0; b < LOUD.length; b++) {
    const from = Math.floor((b * up.width) / LOUD.length)
    const to = Math.floor(((b + 1) * up.width) / LOUD.length)
    let count = 0
    for (let x = from; x < to; x++) {
      for (let y = 0; y < up.height; y++) if (occupied(up, x, y)) count++
    }
    bandHeights.push(count / (to - from))
  }
  // Bass half against treble half: with LOUD tilted bass-ward, the first
  // four bands must have laid down a taller pile than the last four.
  const bass = (bandHeights[0] + bandHeights[1] + bandHeights[2] + bandHeights[3]) / 4
  const treble = (bandHeights[4] + bandHeights[5] + bandHeights[6] + bandHeights[7]) / 4
  check(
    'a bass-heavy spectrum builds a taller pile at the bass end',
    bass > treble * 1.05,
    `bass ${bass.toFixed(1)} cells, treble ${treble.toFixed(1)} cells`,
  )
}

// 2. Laid flat: the pile holds, and what is in the air stays in the air.
//
// Two separate runs, because one cannot answer both halves honestly. The
// first keeps the audio playing, which is the real case — dust keeps
// arriving and must never settle. The second goes silent, which is the only
// way to ask "did *those* grains move": a grain has no identity here beyond
// the cell it occupies, so with new dust arriving, a cell that is still
// airborne might hold the same grain or a different one that wandered in,
// and the first version of this check read the second as the first and
// reported four grains as stuck that were nothing of the sort.
{
  run(up, 0.4, 0, 1, LOUD)
  const landedBefore = up.landed
  run(up, 60, 0, 0, LOUD)
  check(
    'flat for 60 s with audio playing: the landed pile does not change by a single cell',
    up.landed === landedBefore,
    `${landedBefore} -> ${up.landed}`,
  )
  check('dust keeps arriving while flat, and none of it settles', up.airborne > 0, `${up.airborne} airborne`)
}
{
  const dust = createSedimentState(grid.width, grid.height)
  run(dust, 0.4, 0, 1, LOUD)
  const atFlip: number[] = []
  for (let i = 0; i < dust.cells.length; i++) if (dust.cells[i] === 1) atFlip.push(i)
  check('there are grains in flight at the moment of the flip', atFlip.length > 0, '0 airborne')

  // Silent, so nothing new enters and the only grains in the frame are the
  // ones that were in flight. Any cell they have left is a cell they moved
  // out of, and the airborne count can only change if one of them lands.
  const airborneAtFlip = dust.airborne
  run(dust, 60, 0, 0, SILENT)
  const stillThere = atFlip.filter((i) => dust.cells[i] !== 0).length
  check(
    'every grain that was in flight has moved, and not one of them landed',
    stillThere === 0 && dust.airborne === airborneAtFlip && dust.landed === 0,
    `${atFlip.length} at the flip, ${stillThere} never left their cell, ${dust.landed} landed`,
  )
}

// 3. Turned over: the pile becomes the source and rains back down.
{
  const wasLanded = occupiedIndices(up).length
  run(up, 10, 0, -1, SILENT)
  let againstFarEdge = 0
  for (let i = 0; i < up.cells.length; i++) if (up.cells[i] === 2) againstFarEdge++
  check(
    'turned over: 90 % of the pile has landed again within 10 s',
    againstFarEdge >= wasLanded * 0.9,
    `${againstFarEdge} of ${wasLanded} landed`,
  )
  // And it landed against the *opposite* edge: the centre of mass has to
  // have crossed the middle of the frame, or the grains merely stopped
  // where they were.
  let sum = 0
  let n = 0
  for (let y = 0; y < up.height; y++) {
    for (let x = 0; x < up.width; x++) {
      if (occupied(up, x, y)) {
        sum += y
        n++
      }
    }
  }
  const centre = sum / Math.max(1, n)
  check(
    'the pile is now against the opposite edge',
    centre < up.height * 0.4,
    `centre of mass at row ${centre.toFixed(1)} of ${up.height}`,
  )
}

// 4. Leaned into a corner: the pile goes to the corner, not along an edge.
{
  const corner = createSedimentState(grid.width, grid.height)
  run(corner, 60, 0.7, 0.7, LOUD)
  run(corner, 8, 0.7, 0.7, SILENT)
  let sx = 0
  let sy = 0
  let n = 0
  for (let y = 0; y < corner.height; y++) {
    for (let x = 0; x < corner.width; x++) {
      if (occupied(corner, x, y)) {
        sx += x
        sy += y
        n++
      }
    }
  }
  const cx = sx / Math.max(1, n) / corner.width
  const cy = sy / Math.max(1, n) / corner.height
  check(
    'tilt (0.7, 0.7): the pile gathers in the far corner, not along an edge',
    cx > 0.55 && cy > 0.6,
    `centre of mass at (${cx.toFixed(2)}, ${cy.toFixed(2)}) of the frame`,
  )
}

// 5. Just under the flat threshold behaves exactly as dead flat. Same seed,
//    same input, so the two runs are comparable cell for cell rather than
//    only in aggregate.
{
  const a = createSedimentState(grid.width, grid.height)
  const b = createSedimentState(grid.width, grid.height)
  run(a, 20, 0, 1, LOUD)
  run(b, 20, 0, 1, LOUD)
  run(a, 20, 0.1, 0.1, LOUD)
  run(b, 20, 0, 0, LOUD)
  let differing = 0
  for (let i = 0; i < a.cells.length; i++) if (a.cells[i] !== b.cells[i]) differing++
  check(
    'tilt (0.1, 0.1) is below the flat threshold and behaves as (0, 0)',
    differing === 0 && a.landed === b.landed,
    `${differing} cells differ`,
  )
}

// 6. No motion data at all: portrait-down, not inert. A laptop is the case
//    this exists for — a view that can never do anything there is not a
//    smaller feature, it is an inert one.
{
  const desktop = createSedimentState(grid.width, grid.height)
  run(desktop, 20, 0, 0, LOUD, false)
  run(desktop, 6, 0, 0, SILENT, false)
  const phone = createSedimentState(grid.width, grid.height)
  run(phone, 20, 0, 1, LOUD)
  run(phone, 6, 0, 1, SILENT)
  check(
    'with no motion data ever, grains fall as if portrait-down',
    desktop.landed > 0 && desktop.landed === phone.landed,
    `${desktop.landed} landed against the phone's ${phone.landed}`,
  )
  let differing = 0
  for (let i = 0; i < desktop.cells.length; i++) if (desktop.cells[i] !== phone.cells[i]) differing++
  check('and lands them in exactly the same cells', differing === 0, `${differing} cells differ`)
}

// 7. The frame stops growing rather than doing anything clever. Poured at
//    ten times the entry's own rate for long enough to have asked for far
//    more sand than the frame holds.
{
  const full = createSedimentState(48, 64)
  run(full, 600, 0, 1, LOUD)
  const before = full.landed + full.airborne
  run(full, 60, 0, 1, LOUD)
  const after = full.landed + full.airborne
  check(
    'a full frame stops growing instead of overflowing',
    after === before && after <= full.width * full.height,
    `${before} -> ${after} of ${full.width * full.height} cells`,
  )
}

// 8. The cost, measured rather than assumed — the entry's own 2 ms budget
//    for a 96x170 frame, which is what makes this affordable at 60 fps
//    beside two full-screen shader passes.
{
  const timed = createSedimentState(grid.width, grid.height)
  run(timed, 45, 0, 1, LOUD) // a half-full frame is the expensive case
  const frames = 600
  const started = performance.now()
  for (let i = 0; i < frames; i++) updateSediment(timed, DT, 0, 1, true, LOUD)
  const perFrame = (performance.now() - started) / frames
  check(
    `a 96x170 frame updates in under 2 ms (${perFrame.toFixed(3)} ms)`,
    perFrame < 2,
    `${perFrame.toFixed(3)} ms per frame`,
  )
}

// 9. Determinism. Two states given the same input must agree exactly, or
//    every number printed above is a coin toss and a regression found here
//    could never be reproduced.
{
  const a = createSedimentState(grid.width, grid.height)
  const b = createSedimentState(grid.width, grid.height)
  run(a, 30, 0.3, 0.9, LOUD)
  run(b, 30, 0.3, 0.9, LOUD)
  let differing = 0
  for (let i = 0; i < a.pixels.length; i++) if (a.pixels[i] !== b.pixels[i]) differing++
  check('two runs of the same input are identical, colours included', differing === 0, `${differing} bytes differ`)
}

// 10. The strata themselves — the thing the view is named for.
//
// Sand poured during a bass-heavy passage and sand poured during a bright
// one must be visibly different colours, or the pile is a single-coloured
// heap and its layers say nothing about what was playing. This cannot be
// checked in `views-probe.html`, which drives one constant synthetic
// spectrum from start to finish and therefore lays down exactly one colour:
// the picture there is the right shape and can say nothing at all about
// this, which is why it is asserted here instead.
{
  const BASSY = [1, 1, 0.95, 0.8, 0.2, 0.12, 0.08, 0.05]
  const BRIGHT = [0.05, 0.08, 0.12, 0.2, 0.8, 0.95, 1, 1]
  const layered = createSedimentState(grid.width, grid.height)
  run(layered, 20, 0, 1, BASSY)
  run(layered, 4, 0, 1, SILENT)
  const lower = layered.landed
  run(layered, 20, 0, 1, BRIGHT)
  run(layered, 4, 0, 1, SILENT)

  // Grains are laid down oldest-lowest, so the earliest colour is the one
  // sitting against the floor. Sampled as the mean of the bottom-most and
  // top-most tenth of the pile by row.
  const rows: { r: number; g: number; b: number; n: number }[] = []
  for (let y = 0; y < layered.height; y++) {
    let r = 0
    let g = 0
    let b = 0
    let n = 0
    for (let x = 0; x < layered.width; x++) {
      const i = y * layered.width + x
      if (layered.cells[i] === 0) continue
      r += layered.pixels[i * 4]
      g += layered.pixels[i * 4 + 1]
      b += layered.pixels[i * 4 + 2]
      n++
    }
    if (n > 0) rows.push({ r: r / n, g: g / n, b: b / n, n })
  }
  const deepest = rows[rows.length - 1]
  const newest = rows[0]
  // Bass is warmer and darker: more red than blue, and dimmer overall.
  const deepWarmth = deepest.r - deepest.b
  const newWarmth = newest.r - newest.b
  check(
    'a bass passage lays warmer sand than a bright one',
    deepWarmth > newWarmth + 4,
    `deepest r-b ${deepWarmth.toFixed(1)}, newest r-b ${newWarmth.toFixed(1)}`,
  )
  check(
    'and darker sand, so the two passages read as separate layers',
    deepest.g < newest.g - 4,
    `deepest ${deepest.g.toFixed(1)}, newest ${newest.g.toFixed(1)} of 255`,
  )
  check('the second passage landed on top of the first', layered.landed > lower, `${lower} -> ${layered.landed}`)
}

// 11. Silence pours nothing. A refusal, in the habit `spectralFlatness` set:
//     a quiet room is not a slow drizzle of sand, it is no sand.
{
  const quiet = createSedimentState(grid.width, grid.height)
  run(quiet, 120, 0, 1, SILENT)
  check('silence pours nothing at all', quiet.landed === 0 && quiet.airborne === 0, `${quiet.landed} landed`)
}

console.log(failures === 0 ? `\nall checks passed` : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
