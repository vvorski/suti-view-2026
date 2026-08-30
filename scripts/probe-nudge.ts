/**
 * Offline check of the shuffle ladder's bottom-rung nudge (docs/todo.md
 * entry 35): walked many times from a random start, do the floors from
 * entry 21 actually hold, and does the walk avoid drifting toward black —
 * the failure mode that looks fine for five shakes and only shows up over
 * fifty. The same method the entry's own Verify line credits for proving
 * entry 21's floors in the first place.
 *
 * A plain JS re-implementation of shuffled()'s nudge helpers, rather than
 * importing main.ts directly: that file runs its own bootstrap at module
 * load and reaches for `document` immediately, which does not exist here.
 * Kept in lockstep with main.ts by eye — a change to NUDGE_CHANNEL,
 * NUDGE_ALPHA, or the floor logic there needs the same change made here.
 *
 *   node --experimental-strip-types scripts/probe-nudge.ts
 */

interface Colour {
  r: number
  g: number
  b: number
}

const SHUFFLE_MIN_ALPHA = 0.5
const SHUFFLE_MIN_DOMINANT_CHANNEL = 0.5
const NUDGE_CHANNEL = 0.08
const NUDGE_ALPHA = 0.06

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

function floorDominant(c: Colour): Colour {
  const dominant = Math.max(c.r, c.g, c.b)
  if (dominant >= SHUFFLE_MIN_DOMINANT_CHANNEL) return c
  if (c.r === dominant) return { ...c, r: SHUFFLE_MIN_DOMINANT_CHANNEL }
  if (c.g === dominant) return { ...c, g: SHUFFLE_MIN_DOMINANT_CHANNEL }
  return { ...c, b: SHUFFLE_MIN_DOMINANT_CHANNEL }
}

function nudgeChannel(v: number): number {
  return clamp(v + (Math.random() * 2 - 1) * NUDGE_CHANNEL, 0.2, 1)
}

function nudgeColour(c: Colour): Colour {
  return floorDominant({ r: nudgeChannel(c.r), g: nudgeChannel(c.g), b: nudgeChannel(c.b) })
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
const brightness = (alpha: number, c: Colour): number => alpha * Math.max(c.r, c.g, c.b)

function walk(seedColour: Colour, seedAlpha: number): { minChannel: number; minAlpha: number; brightnesses: number[] } {
  let colour = seedColour
  let alpha = seedAlpha
  let minChannel = Infinity
  let minAlpha = Infinity
  const brightnesses: number[] = []

  for (let i = 0; i < STEPS; i++) {
    colour = nudgeColour(colour)
    alpha = nudgeAlpha(alpha)
    minChannel = Math.min(minChannel, colour.r, colour.g, colour.b)
    minAlpha = Math.min(minAlpha, alpha)
    brightnesses.push(brightness(alpha, colour))
  }
  return { minChannel, minAlpha, brightnesses }
}

// 1. Two walks from opposite starting points: one already dim, one already
//    bright. A floor that only holds from a lucky start is not a floor.
const dimStart = walk({ r: 0.2, g: 0.2, b: 0.2 }, SHUFFLE_MIN_ALPHA)
const brightStart = walk({ r: 1, g: 1, b: 1 }, 1)

for (const [label, w] of [
  ['from a dim start', dimStart],
  ['from a bright start', brightStart],
] as const) {
  check(`${label}: every channel over ${STEPS} steps stays >= 0.2`, w.minChannel >= 0.2 - 1e-9, String(w.minChannel))
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
  // And it should settle near the floor-defined equilibrium (min alpha times
  // min dominant channel, 0.5 x 0.5 = 0.25) rather than pinning to it or
  // floating well above it — either would mean the nudge isn't actually
  // exploring, just decorating a fixed point.
  check(`${label}: settles in a believable range around the floor, not pinned to it`, lastTenth > 0.24 && lastTenth < 1.0, lastTenth.toFixed(3))
}

console.log(failures === 0 ? '\nall nudge checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
