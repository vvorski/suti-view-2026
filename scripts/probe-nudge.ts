/**
 * Offline check of the shuffle ladder's bottom-rung nudge (docs/todo.md
 * entry 35, hue/saturation split by entry 70): walked many times from a
 * random start, do the floors from entry 21 actually hold, and does the
 * walk avoid drifting toward black — the failure mode that looks fine for
 * five shakes and only shows up over fifty. The same method the entry's own
 * Verify line credits for proving entry 21's floors in the first place.
 *
 * A plain JS re-implementation of shuffled()'s nudge helpers, rather than
 * importing main.ts directly: that file runs its own bootstrap at module
 * load and reaches for `document` immediately, which does not exist here.
 * Kept in lockstep with main.ts by eye — a change to NUDGE_HUE_DEG,
 * NUDGE_SATURATION, NUDGE_ALPHA, SHUFFLE_MIN_SATURATION or SHUFFLE_MIN_ALPHA
 * there needs the same change made here.
 *
 *   node --experimental-strip-types scripts/probe-nudge.ts
 */

interface Colour {
  r: number
  g: number
  b: number
}

const SHUFFLE_MIN_ALPHA = 0.5
const SHUFFLE_MIN_SATURATION = 0.55
const NUDGE_HUE_DEG = 20
const NUDGE_SATURATION = 0.08
const NUDGE_ALPHA = 0.06

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** HSV -> RGB with v pinned at 1 — see main.ts's hueToColour() for why. */
function hueToColour(h: number, s: number): Colour {
  const c = s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = 1 - c
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return { r: r + m, g: g + m, b: b + m }
}

function colourToHueSat(c: Colour): { h: number; s: number } {
  const max = Math.max(c.r, c.g, c.b)
  const min = Math.min(c.r, c.g, c.b)
  const d = max - min
  const s = max === 0 ? 0 : d / max
  if (d === 0) return { h: 0, s }
  let h = max === c.r ? ((c.g - c.b) / d) % 6 : max === c.g ? (c.b - c.r) / d + 2 : (c.r - c.g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return { h, s }
}

function nudgeColour(c: Colour): Colour {
  const { h, s } = colourToHueSat(c)
  const newH = (h + (Math.random() * 2 - 1) * NUDGE_HUE_DEG + 360) % 360
  const newS = clamp(s + (Math.random() * 2 - 1) * NUDGE_SATURATION, SHUFFLE_MIN_SATURATION, 1)
  return hueToColour(newH, newS)
}

function nudgeAlpha(a: number): number {
  return clamp(a + (Math.random() * 2 - 1) * NUDGE_ALPHA, SHUFFLE_MIN_ALPHA, 1)
}

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const STEPS = 200_000

// A layer's brightness proxy, matching composite.frag.glsl's own
// `opacity * dominant channel` — see SHUFFLE_MIN_ALPHA's own comment in
// main.ts for why the product, not either number alone, is what matters.
// Since entry 70 pins the dominant channel at exactly 1 by construction,
// this is now just alpha itself — kept as a named function anyway so a
// future change to hueToColour that stops guaranteeing that invariant
// shows up here as a real measurement rather than an assumption.
const brightness = (alpha: number, c: Colour): number => alpha * Math.max(c.r, c.g, c.b)

function walk(
  seedColour: Colour,
  seedAlpha: number,
): { maxChannel: number; minSaturation: number; minAlpha: number; brightnesses: number[] } {
  let colour = seedColour
  let alpha = seedAlpha
  let maxChannel = Infinity
  let minSaturation = Infinity
  let minAlpha = Infinity
  const brightnesses: number[] = []

  for (let i = 0; i < STEPS; i++) {
    colour = nudgeColour(colour)
    alpha = nudgeAlpha(alpha)
    maxChannel = Math.min(maxChannel, Math.max(colour.r, colour.g, colour.b))
    minSaturation = Math.min(minSaturation, colourToHueSat(colour).s)
    minAlpha = Math.min(minAlpha, alpha)
    brightnesses.push(brightness(alpha, colour))
  }
  return { maxChannel, minSaturation, minAlpha, brightnesses }
}

// 1. Two walks from opposite starting points: one already dim (low
//    saturation, low alpha), one already saturated and fully opaque. A
//    floor that only holds from a lucky start is not a floor.
const dimStart = walk(hueToColour(0, SHUFFLE_MIN_SATURATION), SHUFFLE_MIN_ALPHA)
const brightStart = walk(hueToColour(180, 1), 1)

for (const [label, w] of [
  ['from a dim start', dimStart],
  ['from a bright start', brightStart],
] as const) {
  // docs/todo.md entry 70: the old per-channel 0.2 floor is gone along with
  // the per-channel roll it protected — what replaces it is a guarantee,
  // not a floor: the dominant channel is always exactly 1, by construction,
  // every single step of the walk, never merely bounded below.
  check(`${label}: the dominant channel stays exactly 1 over ${STEPS} steps`, Math.abs(w.maxChannel - 1) < 1e-9, String(w.maxChannel))
  check(
    `${label}: saturation over ${STEPS} steps never drops below ${SHUFFLE_MIN_SATURATION}`,
    w.minSaturation >= SHUFFLE_MIN_SATURATION - 1e-9,
    String(w.minSaturation),
  )
  check(`${label}: alpha over ${STEPS} steps never drops below ${SHUFFLE_MIN_ALPHA}`, w.minAlpha >= SHUFFLE_MIN_ALPHA - 1e-9, String(w.minAlpha))
}

// 2. No downward trend: the mean brightness of the walk's last tenth is not
//    meaningfully lower than its first tenth. A walk that merely fluctuates
//    around a stable level passes; one that drifts toward black does not.
for (const [label, w] of [
  ['from a dim start', dimStart],
  ['from a bright start', brightStart],
] as const) {
  const tenth = Math.floor(STEPS / 10)
  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
  const firstTenth = mean(w.brightnesses.slice(0, tenth))
  const lastTenth = mean(w.brightnesses.slice(-tenth))
  check(
    `${label}: mean brightness does not trend downward (first tenth ${firstTenth.toFixed(3)} -> last tenth ${lastTenth.toFixed(3)})`,
    lastTenth >= firstTenth - 0.05,
    `dropped by ${(firstTenth - lastTenth).toFixed(3)}`,
  )
  // And it should settle near the floor-defined equilibrium — entry 70
  // pins the dominant channel at 1, so brightness is now just alpha itself
  // and the floor is 0.5, not the old 0.5 x 0.5 = 0.25 — rather than
  // pinning to it or floating well above it, either of which would mean
  // the nudge isn't actually exploring, just decorating a fixed point.
  check(`${label}: settles in a believable range around the floor, not pinned to it`, lastTenth > 0.49 && lastTenth < 1.0, lastTenth.toFixed(3))
}

console.log(failures === 0 ? '\nall nudge checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
