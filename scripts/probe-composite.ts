/**
 * Offline check of the composite shader's alpha arithmetic (docs/todo.md
 * entry 34): does an atmosphere at zero opacity actually disappear under
 * every merge mode, rather than turning the frame black under Multiply and
 * Overlay — and does fixing that leave every other case exactly as it was.
 *
 * A plain JS re-implementation of composite.frag.glsl's blendWith() and the
 * composite line, rather than driving a real WebGL context: this is
 * arithmetic, not geometry, and the entry's own Verify line says as much —
 * "the browser cannot tell 0.51 from 0.46." Kept in lockstep with the GLSL
 * by eye; a change to blendWith() there needs the same change made here.
 *
 *   node --experimental-strip-types scripts/probe-composite.ts
 */

type Vec3 = [number, number, number]

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: Vec3, b: Vec3): Vec3 => [a[0] * b[0], a[1] * b[1], a[2] * b[2]]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const mixV = (a: Vec3, b: Vec3, t: number): Vec3 => add(scale(a, 1 - t), scale(b, t))
const oneMinus = (a: Vec3): Vec3 => [1 - a[0], 1 - a[1], 1 - a[2]]

// MERGE_MODES indices, from merge-modes.ts: 0 normal, 1 add, 2 screen,
// 3 multiply, 4 overlay, 5 difference, 6 xor (docs/todo.md entry 105).
function overlayBlend(base: Vec3, top: Vec3): Vec3 {
  const lo = scale(mul(base, top), 2)
  const hi = sub([1, 1, 1], scale(mul(oneMinus(base), oneMinus(top)), 2))
  // step(0.5, base) per channel
  return [0, 1, 2].map((i) => (base[i] < 0.5 ? lo[i] : hi[i])) as Vec3
}

function blendWith(base: Vec3, top: Vec3, mode: number): Vec3 {
  if (mode === 1) return add(base, top)
  if (mode === 2) return sub([1, 1, 1], mul(oneMinus(base), oneMinus(top)))
  if (mode === 3) return mul(base, top)
  if (mode === 4) return overlayBlend(base, top)
  if (mode === 5) return [Math.abs(base[0] - top[0]), Math.abs(base[1] - top[1]), Math.abs(base[2] - top[2])]
  if (mode === 6) return add(mul(base, oneMinus(top)), mul(top, oneMinus(base)))
  return top // normal
}

const clamp01 = (a: Vec3): Vec3 => a.map((v) => Math.min(1, Math.max(0, v))) as Vec3

/** The fixed composite line, from composite.frag.glsl's own comment. */
function composite(atm: Vec3, geo: Vec3, uMode: number, uAtmAlpha: number, uGeoAlpha: number): Vec3 {
  const both = blendWith(atm, geo, uMode)
  return clamp01(mixV(scale(atm, uAtmAlpha), mixV(geo, both, uAtmAlpha), uGeoAlpha))
}

/** The old, pre-multiplied line this entry replaces — kept here only so
 *  "both alphas at 1 is pixel-identical to today" has a "today" to check
 *  against. */
function compositeOld(atm: Vec3, geo: Vec3, uMode: number, uAtmAlpha: number, uGeoAlpha: number): Vec3 {
  const base = scale(atm, uAtmAlpha)
  return clamp01(mixV(base, blendWith(base, geo, uMode), uGeoAlpha))
}

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const close = (a: Vec3, b: Vec3, eps = 1e-9): boolean =>
  Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps && Math.abs(a[2] - b[2]) < eps

const MODES = [0, 1, 2, 3, 4, 5, 6]
const MODE_NAMES = ['normal', 'add', 'screen', 'multiply', 'overlay', 'difference', 'xor']

const ATM: Vec3 = [0.42, 0.55, 0.3] // some non-trivial atmosphere colour
const GEO: Vec3 = [0.6, 0.6, 0.6] // the report's own 0.6 grey geometry

// 1. Reproduce the entry's own measured table: at uAtmAlpha 0, uGeoAlpha
//    0.6, the old formula returned black under Multiply and Overlay.
{
  for (const mode of [3, 4]) {
    const old = compositeOld(ATM, [0.6, 0.6, 0.6], mode, 0, 0.6)
    check(
      `old formula: ${MODE_NAMES[mode]} at atmAlpha 0 was black (regression fixture)`,
      close(old, [0, 0, 0]),
      JSON.stringify(old),
    )
  }
}

// 2. The actual fix: at uAtmAlpha 0, every mode leaves the frame at the
//    geometry alone, whatever the atmosphere's own colour is.
{
  for (const mode of MODES) {
    const result = composite(ATM, GEO, mode, 0, 0.6)
    check(`atmAlpha 0 under ${MODE_NAMES[mode]} matches geometry alone`, close(result, scale(GEO, 0.6)), JSON.stringify(result))
  }
}

// 3. Sweeping atmAlpha from 1 to 0 under Multiply ends on the geometry
//    alone, not on black — the "quite dark" complaint in one line.
{
  const full = composite(ATM, GEO, 3, 1, 0.6)
  const zero = composite(ATM, GEO, 3, 0, 0.6)
  check('multiply at full atmAlpha differs from geometry alone', !close(full, scale(GEO, 0.6)), JSON.stringify(full))
  check('multiply at zero atmAlpha lands exactly on geometry alone', close(zero, scale(GEO, 0.6)), JSON.stringify(zero))
}

// 4. Both alphas at 1 is pixel-identical to the old formula, for every
//    mode — the fix must not move anything at full opacity.
{
  for (const mode of MODES) {
    const oldResult = compositeOld(ATM, GEO, mode, 1, 1)
    const newResult = composite(ATM, GEO, mode, 1, 1)
    check(`${MODE_NAMES[mode]} at both alphas 1 is unchanged from before`, close(oldResult, newResult), `${JSON.stringify(oldResult)} vs ${JSON.stringify(newResult)}`)
  }
}

// 5. uGeoAlpha's own behaviour is untouched: at uGeoAlpha 0 the result is
//    always the dimmed atmosphere alone, for every mode, exactly as before.
{
  for (const mode of MODES) {
    const oldResult = compositeOld(ATM, GEO, mode, 0.7, 0)
    const newResult = composite(ATM, GEO, mode, 0.7, 0)
    check(`${MODE_NAMES[mode]} at geoAlpha 0 is unchanged from before`, close(oldResult, newResult), `${JSON.stringify(oldResult)} vs ${JSON.stringify(newResult)}`)
  }
}

// 6. Normal, Add and Screen are pixel-identical to the old formula across
//    the whole alpha range, not only at the endpoints — these three modes
//    were never the ones with a black-is-not-neutral problem.
{
  const samples = [0, 0.25, 0.5, 0.75, 1]
  let allMatch = true
  for (const mode of [0, 1, 2]) {
    for (const a of samples) {
      for (const g of samples) {
        if (!close(compositeOld(ATM, GEO, mode, a, g), composite(ATM, GEO, mode, a, g), 1e-6)) allMatch = false
      }
    }
  }
  check('normal, add and screen match the old formula across the whole alpha range', allMatch, 'a mismatch was found')
}

// docs/todo.md entry 105 — XOR (mode 6) is not Difference (mode 5), and the
// entry's own acceptance test is a number, not a description: "the mid-grey
// null case ... cannot be faked by a nearly-right formula."
{
  const difference = (base: Vec3, top: Vec3): Vec3 => [0, 1, 2].map((i) => Math.abs(base[i] - top[i])) as Vec3

  // The null surface itself: under XOR, base = 0.5 has zero slope in the
  // top (Decided's own f(b) = a + b(1-2a)) — the output stays at 0.5 no
  // matter what the top does. Difference's null surface is base = top, a
  // completely different condition: it is *sensitive* to the top at
  // base = 0.5, tracking |0.5 - top| rather than going blind to it. Two
  // different top values make the contrast a number, not a description.
  const grey: Vec3 = [0.5, 0.5, 0.5]
  const topA: Vec3 = [0.3, 0.3, 0.3]
  const topB: Vec3 = [0.9, 0.9, 0.9]
  const xorA = blendWith(grey, topA, 6)
  const xorB = blendWith(grey, topB, 6)
  check('XOR at base 0.5 is exactly 0.5 for one top value — the null surface', close(xorA, grey, 1e-9), JSON.stringify(xorA))
  check('...and stays exactly 0.5 for a completely different top value', close(xorB, grey, 1e-9), JSON.stringify(xorB))
  check(
    "Difference at the same base is sensitive to the top — it isn't blind the way XOR's null surface is",
    !close(difference(grey, topA), difference(grey, topB), 1e-6),
    `${JSON.stringify(difference(grey, topA))} vs ${JSON.stringify(difference(grey, topB))}`,
  )

  // Pass-through over black, invert over white — the other two corners
  // Done-when names, both a direct read of f(b) = a + b(1-2a) at a = 0/1.
  const stroke: Vec3 = [0.6, 0.6, 0.6]
  const black: Vec3 = [0, 0, 0]
  const white: Vec3 = [1, 1, 1]
  check('a stroke over black passes through unchanged under XOR', close(blendWith(black, stroke, 6), stroke, 1e-9), JSON.stringify(blendWith(black, stroke, 6)))
  check(
    'the same stroke over white inverts under XOR',
    close(blendWith(white, stroke, 6), oneMinus(stroke), 1e-9),
    JSON.stringify(blendWith(white, stroke, 6)),
  )

  // XOR and Difference agree at every corner of the unit square and
  // disagree everywhere else, with a closed-form gap: Decided's own
  // XOR - Difference = 2*min(a,b)*(1-max(a,b)).
  const corners: [number, number][] = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ]
  let cornersAgree = true
  for (const [a, b] of corners) {
    const av: Vec3 = [a, a, a]
    const bv: Vec3 = [b, b, b]
    if (!close(blendWith(av, bv, 6), difference(av, bv), 1e-9)) cornersAgree = false
  }
  check('XOR and Difference agree at all four corners of the unit square', cornersAgree, 'a corner mismatch was found')

  const gapCases: [number, number][] = [
    [0.5, 0.5],
    [0.8, 0.6],
    [0.3, 0.2],
  ]
  let gapMatches = true
  for (const [a, b] of gapCases) {
    const xorV = blendWith([a, a, a], [b, b, b], 6)[0]
    const diffV = difference([a, a, a], [b, b, b])[0]
    const expectedGap = 2 * Math.min(a, b) * (1 - Math.max(a, b))
    if (Math.abs(xorV - diffV - expectedGap) > 1e-9) gapMatches = false
  }
  check(
    "the gap between XOR and Difference matches Decided's own closed form, 2*min(a,b)*(1-max(a,b))",
    gapMatches,
    'a mismatch was found',
  )

  // No clamp needed: a sum of two non-negative products, each individually
  // bounded by its own factor in [0,1], can never exceed 1 — swept rather
  // than argued.
  let neverExceedsOne = true
  for (let a = 0; a <= 1.001; a += 0.05) {
    for (let b = 0; b <= 1.001; b += 0.05) {
      const v = blendWith([a, a, a], [b, b, b], 6)[0]
      if (v < -1e-9 || v > 1 + 1e-9) neverExceedsOne = false
    }
  }
  check('XOR never leaves [0,1] across the full input range — no clamp needed', neverExceedsOne, 'an out-of-range value was found')
}

// docs/todo.md entry 68 (supersedes 64): day mode as ink on paper, applied
// to the whole composited picture, worked in HSL — see composite.frag.glsl's
// own comment on `rgb2hsl` for why. A plain re-implementation of the new
// tail of composite.frag.glsl, same discipline as composite() above.
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Standard HSL lightness and saturation from an RGB triple — the same pair
 *  entry 68's own measurement table (mean L, p5, p95, mean sat) reports. */
function lightnessAndSaturation(c: Vec3): { l: number; s: number } {
  const max = Math.max(...c)
  const min = Math.min(...c)
  const l = (max + min) / 2
  if (max === min) return { l, s: 0 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  return { l, s }
}

/** Full RGB -> HSL, hue included — composite.frag.glsl's own rgb2hsl(). */
function rgbToHsl(c: Vec3): { h: number; s: number; l: number } {
  const max = Math.max(...c)
  const min = Math.min(...c)
  const { l, s } = lightnessAndSaturation(c)
  if (max === min) return { h: 0, s, l }
  const d = max - min
  let h: number
  if (max === c[0]) h = ((c[1] - c[2]) / d + (c[1] < c[2] ? 6 : 0)) % 6
  else if (max === c[1]) h = (c[2] - c[0]) / d + 2
  else h = (c[0] - c[1]) / d + 4
  h *= 60
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): Vec3 {
  const k = (n: number): number => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}

/** The exact tail of composite.frag.glsl, past the exposure clamp. */
function dayTransform(col: Vec3, uDay: number, uCameraMix: number, skyWarmth: number): Vec3 {
  const hsl = rgbToHsl(col)
  const density = Math.max(col[0], Math.max(col[1], col[2]))
  const inkAmt = smoothstep(0.15, 0.55, uDay) * (1 - uCameraMix)
  const paperAmt = uDay * (1 - uCameraMix)
  const dayAmt = Math.max(inkAmt, paperAmt)
  const targetLDense = hsl.l * (1 - inkAmt) + 0.1 * inkAmt
  const targetLEmpty = hsl.l * (1 - paperAmt) + 0.88 * paperAmt
  const targetL = targetLEmpty * (1 - density) + targetLDense * density
  const targetS = hsl.s * (1 - dayAmt) + hsl.s * density * dayAmt
  const rgb = hslToRgb(hsl.h, targetS, targetL)
  const warmthBias: Vec3 = [skyWarmth * 0.1, 0, -skyWarmth * 0.1].map((v) => v * paperAmt * (1 - density)) as Vec3
  return clamp01(add(rgb, warmthBias))
}

// A synthetic stand-in for "a broad mid-bright field with no empty ground"
// — entry 68's own description of the atmospheric layer, which is where its
// measurement found the real damage. 36 hues × 5 lightness levels at a
// fixed, moderately high saturation: varied and colourful, the way an
// atmospheric view actually renders, and deliberately not a scattering of
// near-black or near-white outliers a real "field" would not produce.
const FIELD: Vec3[] = []
for (let h = 0; h < 360; h += 10) {
  for (const l of [0.3, 0.4, 0.5, 0.6, 0.7]) {
    FIELD.push(hslToRgb(h, 0.7, l))
  }
}

function fieldStats(samples: Vec3[]): { meanL: number; p5: number; p95: number; contrast: number; meanS: number } {
  const stats = samples.map(lightnessAndSaturation)
  const ls = stats.map((s) => s.l).sort((a, b) => a - b)
  const meanL = ls.reduce((a, b) => a + b, 0) / ls.length
  const meanS = stats.reduce((a, b) => a + b.s, 0) / stats.length
  const p5 = ls[Math.floor(ls.length * 0.05)]
  const p95 = ls[Math.floor(ls.length * 0.95)]
  return { meanL, p5, p95, contrast: p95 - p5, meanS }
}

// 7. Identity at night: uDay = 0 must return col completely untouched, for
//    any colour and any warmth — the same property entries 47 and 64 were
//    each careful to keep, now asserted for the whole-picture version.
{
  let allIdentical = true
  for (const c of FIELD) {
    if (!close(dayTransform(c, 0, 0, 0.8), c, 1e-12)) allIdentical = false
    if (!close(dayTransform(c, 0, 0.4, -0.6), c, 1e-12)) allIdentical = false
  }
  check('uDay = 0 is bit-identical to col, for every colour and any warmth/camera mix', allIdentical, 'a mismatch was found')
}

// 8. The entry's own acceptance test — contrast and saturation each at
//    least 70% of night's. The entry's own literal formula
//    (`mix(paper, col * INK, density)`, mixing full RGB triples) does not
//    clear this: tried first, it reached ~76% of night's contrast but only
//    ~16% of its saturation, and two other RGB-space variants (a steepened
//    density curve; a paper tinted by the content's own hue) only ever
//    traded one floor against the other, never both at once — confirmed by
//    direct computation before this shape was written, not assumed. The
//    cause is structural, not a tuning problem: mixing a dark ink colour
//    with a much lighter, near-neutral paper lets the paper's own absolute
//    brightness dominate the channel sums at almost any non-trivial mix
//    weight, which is also why an isolated, fully-opaque coloured ring
//    rendered as plain grey in a live check of the RGB-space version before
//    this one. Confirmed with Victor, given the deviation from the entry's
//    own literal formula: work in HSL instead (dayTransform, and
//    composite.frag.glsl's own rgb2hsl/hsl2rgb), so hue and saturation are
//    independent of the lightness crossfade that actually needs to happen —
//    the same fix, ported to the shader that ships it.
{
  const night = fieldStats(FIELD)
  const day = fieldStats(FIELD.map((c) => dayTransform(c, 1, 0, 0)))
  check(
    `day contrast (${day.contrast.toFixed(3)}) reaches 70% of night's (${night.contrast.toFixed(3)})`,
    day.contrast >= 0.7 * night.contrast,
    `${day.contrast} < ${0.7 * night.contrast}`,
  )
  check(
    `day saturation (${day.meanS.toFixed(3)}) reaches 70% of night's (${night.meanS.toFixed(3)})`,
    day.meanS >= 0.7 * night.meanS,
    `${day.meanS} < ${0.7 * night.meanS}`,
  )
  check(
    `day p5 (${day.p5.toFixed(3)}) sits near the ink floor, not the paper`,
    day.p5 < 0.3,
    `p5=${day.p5}, expected well under the 0.88 paper`,
  )
}

// 8b. The specific failure this entry's live check found: an isolated,
//     fully-opaque coloured ring (density = 1, no atmosphere blended in at
//     all) must come out as a dark version of its own hue, not grey — the
//     entry's own "a blue ring becomes dark blue", checked directly rather
//     than only through the aggregate field statistics above.
{
  const red: Vec3 = [1, 0.2, 0.2]
  const inked = dayTransform(red, 1, 0, 0)
  const { s } = lightnessAndSaturation(inked)
  check(
    `an isolated red ring stays saturated when inked (s=${s.toFixed(3)})`,
    s > 0.5,
    `${JSON.stringify(inked)}, s=${s} — expected clearly above grey`,
  )
  check(
    `the inked ring is still red-dominant, not grey`,
    inked[0] > inked[1] + 0.02 && inked[0] > inked[2] + 0.02,
    JSON.stringify(inked),
  )
}

// 9. "The ink leads the paper" — entry 64's crossover fix, carried over
//    unchanged per entry 68's own text. Restated as a directly-checkable
//    schedule-ordering fact rather than entry 64's own literal "contrast
//    never dips below night", which turns out to be unachievable for any
//    day model that inverts luminance polarity (bright content going dark,
//    empty ground going light): the two endpoints then have opposite-signed
//    (bright-minus-dark) contrast, and the intermediate value theorem
//    guarantees a zero-crossing somewhere in between regardless of how the
//    two schedules are staggered — confirmed by direct computation before
//    writing this check, not assumed. **Mine.** What staggering the
//    schedules actually buys, and what is checkable, is that ink has done
//    almost all of its own darkening well before paper is even halfway to
//    its own lightening — so whatever the crossing point turns out to be,
//    the paper side of it is still close to its dark starting point rather
//    than a competing mid-grey.
{
  const paperAmtAtHalf = 0.5 // paperAmt(uDay) is just uDay, so uDay = 0.5 here
  const inkAmtAtHalf = smoothstep(0.15, 0.55, 0.5)
  check(
    `ink reaches 90% of its own range (${inkAmtAtHalf.toFixed(3)}) before paper reaches half of its own`,
    inkAmtAtHalf >= 0.9,
    `inkAmt(0.5)=${inkAmtAtHalf}, expected >= 0.9 while paperAmt(0.5)=${paperAmtAtHalf}`,
  )
}

// docs/todo.md entry 70: colour is chosen as a hue now, not three
// independent channel gains, and a vibrance stage runs on the composited
// picture before the camera mix. A plain re-implementation of both, same
// discipline as composite() and dayTransform() above.
function hueToColour(h: number, s: number): Vec3 {
  const c = s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = 1 - c
  const rgb: Vec3 =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return rgb.map((v) => v + m) as Vec3
}

/** The exact vibrance block from composite.frag.glsl, applied to `col`. */
function vibrance(col: Vec3): Vec3 {
  const max = Math.max(...col)
  const min = Math.min(...col)
  const sat = max - min
  const boost = 1.0 * (1 - sat)
  const avg = (col[0] + col[1] + col[2]) / 3
  return col.map((v) => Math.min(1, Math.max(0, avg + (v - avg) * (1 + boost)))) as Vec3
}

// 10. The entry's own acceptance test: a rendered night frame reaches mean
//     saturation >= 0.30 and p95 saturation >= 0.60, against the 0.10-0.25
//     and 0.15-0.36 the entry's own table measured. Simulated with the new
//     hue-and-saturation sampler feeding the real composite() line above
//     (screen, the default merge for geo-over-atmosphere), at a spread of
//     alphas and per-pixel texture intensities, then vibrance applied —
//     this probe cannot render the real shaders, per this file's own
//     docstring, so this stands in for a re-shoot of the entry's own four
//     frames.
{
  const N = 3000
  const before: Vec3[] = []
  const after: Vec3[] = []
  for (let i = 0; i < N; i++) {
    const geoColour = hueToColour(Math.random() * 360, 0.55 + Math.random() * 0.45)
    const atmColour = hueToColour(Math.random() * 360, 0.55 + Math.random() * 0.45)
    const geoI = Math.random()
    const atmI = Math.random()
    const geo = scale(geoColour, geoI)
    const atm = scale(atmColour, atmI)
    const geoAlpha = 0.5 + Math.random() * 0.5
    const atmAlpha = 0.5 + Math.random() * 0.5
    // mode 2 = screen, DEFAULT_MERGE_MODE and DEFAULT_ATM_MERGE_MODE alike.
    const col = composite(atm, geo, 2, atmAlpha, geoAlpha)
    before.push(col)
    after.push(vibrance(col))
  }
  const stats = (samples: Vec3[]): { meanS: number; p95: number } => {
    const s = samples.map((c) => lightnessAndSaturation(c).s).sort((a, b) => a - b)
    return { meanS: s.reduce((a, b) => a + b, 0) / s.length, p95: s[Math.floor(s.length * 0.95)] }
  }
  const withoutVibrance = stats(before)
  const withVibrance = stats(after)
  check(
    `mean saturation (${withVibrance.meanS.toFixed(3)}) reaches the entry's 0.30 floor`,
    withVibrance.meanS >= 0.3,
    `${withVibrance.meanS} < 0.30 (pre-vibrance was ${withoutVibrance.meanS.toFixed(3)})`,
  )
  check(
    `p95 saturation (${withVibrance.p95.toFixed(3)}) reaches the entry's 0.60 floor`,
    withVibrance.p95 >= 0.6,
    `${withVibrance.p95} < 0.60 (pre-vibrance was ${withoutVibrance.p95.toFixed(3)})`,
  )
  // The new sampler alone (before vibrance) already clears both floors in
  // this simulation — worth asserting directly, since it means vibrance is
  // a genuine addition on top of the sampler fix, not the only thing
  // standing between this entry and its own acceptance test, matching the
  // entry's own "this is the whole fix for cause one and two" framing.
  check(
    'the new sampler alone (no vibrance) already clears both floors here',
    withoutVibrance.meanS >= 0.3 && withoutVibrance.p95 >= 0.6,
    JSON.stringify(withoutVibrance),
  )
}

// 11. Vibrance runs before the camera mix, not after — composite.frag.glsl
//     places the block immediately after `col` is computed, so a camera
//     texture's own colour is never touched by it. Checked here as the
//     algebraic fact that makes that placement correct: at uCameraMix = 1,
//     the room shows through blendWith(cam, col, mode); vibrance changes
//     what `col` contributes to that blend (the visualiser gains colour)
//     but the function never receives `cam` as an argument at all, so a
//     `cam` on its own — passthrough with nothing drawn over it — cannot be
//     touched by this entry regardless of uCameraMix.
{
  const camOnly = blendWith([0.4, 0.5, 0.3], [0, 0, 0], 2) // screen with black col is identity
  check('screening a real photograph onto black leaves it unchanged', close(camOnly, [0.4, 0.5, 0.3]), JSON.stringify(camOnly))
}

// 12. docs/todo.md entry 92 — colour ramps. Plain re-implementation of
//     scene.ts's ColourRamp/startColourRamp/stepColourRamp, kept in
//     lockstep by eye the same way this file's own header already asks of
//     blendWith(): scene.ts imports `three` and Vite's `?raw` shader
//     imports, so it cannot run under plain node.
{
  interface Ramp {
    from: Vec3
    target: Vec3
    elapsed: number
    duration: number
  }
  const startRamp = (ramp: Ramp, current: Vec3, target: Vec3, duration: number): void => {
    ramp.from = current
    ramp.target = target
    ramp.elapsed = 0
    ramp.duration = duration
  }
  const stepRamp = (ramp: Ramp, dt: number): Vec3 => {
    ramp.elapsed += dt
    const t = ramp.duration <= 0 ? 1 : Math.min(1, ramp.elapsed / ramp.duration)
    return mixV(ramp.from, ramp.target, t)
  }

  const FROM: Vec3 = [1, 1, 1]
  const TARGET: Vec3 = [0.86, 0.53, 0.45]

  // (a) An intermediate frame is neither endpoint.
  {
    const ramp: Ramp = { from: FROM, target: FROM, elapsed: 0, duration: 0 }
    startRamp(ramp, FROM, TARGET, 2.0)
    let mid: Vec3 = FROM
    for (let i = 0; i < 100; i++) mid = stepRamp(ramp, 0.01) // 1.0s of a 2.0s ramp
    check('a colour mid-ramp matches neither endpoint (from)', !close(mid, FROM, 1e-6), JSON.stringify(mid))
    check('a colour mid-ramp matches neither endpoint (target)', !close(mid, TARGET, 1e-6), JSON.stringify(mid))
  }

  // (b) One step past the duration lands exactly on target — the ULP bug
  //     entry 91 found (`a + (b-a)*1 !== b` bitwise) is exactly what this
  //     guards against: stepColourRamp must clamp t to 1 and mix from the
  //     *fixed* ramp.from/target, not re-derive either from something that
  //     moves between calls.
  {
    const ramp: Ramp = { from: FROM, target: FROM, elapsed: 0, duration: 0 }
    startRamp(ramp, FROM, TARGET, 2.0)
    let last: Vec3 = FROM
    for (let i = 0; i < 201; i++) last = stepRamp(ramp, 0.01) // 2.01s of a 2.0s ramp
    check('a settled ramp is pixel-identical to its target', close(last, TARGET), JSON.stringify(last))
  }

  // (c) Duration 0 reaches target on the very next step — what an
  //     immediate HUD drag needs.
  {
    const ramp: Ramp = { from: FROM, target: FROM, elapsed: 0, duration: 0 }
    startRamp(ramp, FROM, TARGET, 0)
    const next = stepRamp(ramp, 0.016)
    check('a zero-duration ramp reaches target on the next step', close(next, TARGET), JSON.stringify(next))
  }

  // (d) Retargeting mid-ramp continues from the current position, not from
  //     the original `from` — a director update arriving while a shake's
  //     own ramp is still in flight must not visibly jump backwards.
  {
    const RETARGET: Vec3 = [0.1, 0.9, 0.2]
    const ramp: Ramp = { from: FROM, target: FROM, elapsed: 0, duration: 0 }
    startRamp(ramp, FROM, TARGET, 2.0)
    let current: Vec3 = FROM
    for (let i = 0; i < 100; i++) current = stepRamp(ramp, 0.01) // 1.0s in
    startRamp(ramp, current, RETARGET, 2.0)
    const justAfter = stepRamp(ramp, 0.001)
    check(
      'retargeting mid-ramp continues from the current position',
      close(justAfter, current, 0.05),
      `${JSON.stringify(justAfter)} vs current ${JSON.stringify(current)}`,
    )
  }
}

// 13. docs/todo.md entry 92 — the two layers never dip together. Plain
//     re-implementation of scene.ts's ViewDip/startViewDip/tickViewDips.
{
  const VIEW_DIP_S = 0.35
  interface Dip {
    multiplier: number
    phase: 'idle' | 'out' | 'in'
    elapsed: number
    swap: (() => void) | null
    queuedSwap: (() => void) | null
  }
  const freshDip = (): Dip => ({ multiplier: 1, phase: 'idle', elapsed: 0, swap: null, queuedSwap: null })
  const start = (dip: Dip, other: Dip, swap: () => void): void => {
    if (other.phase !== 'idle') {
      dip.queuedSwap = swap
      return
    }
    dip.swap = swap
    dip.phase = 'out'
    dip.elapsed = 0
  }
  const tick = (geo: Dip, atm: Dip, dt: number): void => {
    for (const dip of [geo, atm]) {
      if (dip.phase === 'idle') continue
      dip.elapsed += dt
      if (dip.phase === 'out') {
        dip.multiplier = Math.max(0, 1 - dip.elapsed / VIEW_DIP_S)
        if (dip.elapsed >= VIEW_DIP_S) {
          dip.swap?.()
          dip.swap = null
          dip.phase = 'in'
          dip.elapsed = 0
          dip.multiplier = 0
        }
      } else {
        dip.multiplier = Math.min(1, dip.elapsed / VIEW_DIP_S)
        if (dip.elapsed >= VIEW_DIP_S) {
          dip.phase = 'idle'
          dip.multiplier = 1
        }
      }
    }
    if (geo.phase === 'idle' && atm.queuedSwap) {
      const swap = atm.queuedSwap
      atm.queuedSwap = null
      atm.swap = swap
      atm.phase = 'out'
      atm.elapsed = 0
    }
    if (atm.phase === 'idle' && geo.queuedSwap) {
      const swap = geo.queuedSwap
      geo.queuedSwap = null
      geo.swap = swap
      geo.phase = 'out'
      geo.elapsed = 0
    }
  }

  const geo = freshDip()
  const atm = freshDip()
  let geoSwapped = 0
  let atmSwapped = 0
  let neverBothDipped = true
  let geoHitZero = false
  let atmHitZero = false

  // A shake-triggered reroll asking for both a new geometric and a new
  // atmospheric view in the same instant — the exact case queuedSwap
  // exists for.
  start(geo, atm, () => geoSwapped++)
  start(atm, geo, () => atmSwapped++)

  for (let i = 0; i < 300; i++) {
    tick(geo, atm, 0.01) // 3.0s total — enough for two full dip-and-swap cycles in sequence
    if (geo.multiplier < 1 && atm.multiplier < 1) neverBothDipped = false
    if (geo.multiplier === 0) geoHitZero = true
    if (atm.multiplier === 0) atmHitZero = true
  }

  check('both swaps eventually complete (geo)', geoSwapped === 1, `geoSwapped=${geoSwapped}`)
  check('both swaps eventually complete (atm)', atmSwapped === 1, `atmSwapped=${atmSwapped}`)
  check('the two layers are never simultaneously below full visibility', neverBothDipped, 'both dipped at once')
  check('geo layer actually reaches fully hidden at some point', geoHitZero, 'geo multiplier never hit 0')
  check('atm layer actually reaches fully hidden at some point', atmHitZero, 'atm multiplier never hit 0')
  check('geo ends idle and fully visible', geo.phase === 'idle' && geo.multiplier === 1, JSON.stringify(geo))
  check('atm ends idle and fully visible', atm.phase === 'idle' && atm.multiplier === 1, JSON.stringify(atm))
}

// 14. docs/todo.md entry 95 — the same "presence multiplied into the
//     input" fault entry 34 already fixed one seam up (atm/geo), found
//     here too, one seam further down (col/camera).
{
  function cameraCompositeOld(cam: Vec3, col: Vec3, mode: number, cameraMix: number): Vec3 {
    return clamp01(mixV(col, blendWith(cam, col, mode), cameraMix))
  }
  function cameraComposite(
    cam: Vec3,
    col: Vec3,
    mode: number,
    geoAlpha: number,
    atmAlpha: number,
    cameraMix: number,
  ): Vec3 {
    const picture = Math.max(geoAlpha, atmAlpha)
    const lit = mixV(cam, blendWith(cam, col, mode), picture)
    return clamp01(mixV(col, lit, cameraMix))
  }

  const CAM: Vec3 = [0.62, 0.62, 0.62] // the entry's own reproduced value
  const BLACK: Vec3 = [0, 0, 0] // `col` at both alphas 0

  // (a) Reproduce the entry's own measured regression: the old formula
  //     wipes the room to black under Normal and Multiply, at both alphas
  //     0 — the same two of the six modes entry 34 already found broken
  //     one seam up.
  for (const mode of [0, 3]) {
    const old = cameraCompositeOld(CAM, BLACK, mode, 1)
    check(`old camera formula: ${MODE_NAMES[mode]} at both alphas 0 was black (regression fixture)`, close(old, BLACK), JSON.stringify(old))
  }

  // (b) The fix: at both alphas 0, the room passes through untouched under
  //     every mode — Done-when's own "the room is untouched under all six
  //     modes."
  for (const mode of MODES) {
    const result = cameraComposite(CAM, BLACK, mode, 0, 0, 1)
    check(`camera at both alphas 0 under ${MODE_NAMES[mode]} leaves the room untouched`, close(result, CAM), JSON.stringify(result))
  }

  // (c) At picture == 1 (either alpha at its old full value), the new line
  //     is bit-identical to the old one — Done-when's own "the picture
  //     composites over the room exactly as it does today."
  for (const mode of MODES) {
    const col: Vec3 = [0.35, 0.5, 0.28] // some non-trivial composited picture
    const oldResult = cameraCompositeOld(CAM, col, mode, 1)
    const newResult = cameraComposite(CAM, col, mode, 1, 0.4, 1)
    check(
      `camera ${MODE_NAMES[mode]} at geoAlpha 1 is unchanged from before`,
      close(oldResult, newResult),
      `${JSON.stringify(oldResult)} vs ${JSON.stringify(newResult)}`,
    )
  }

  // (d) uCameraMix 0 still leaves col untouched regardless of the alphas —
  //     the existing "costs nothing while down" guarantee this entry must
  //     not disturb.
  {
    const col: Vec3 = [0.35, 0.5, 0.28]
    const result = cameraComposite(CAM, col, 3, 0, 0, 0)
    check('camera mix 0 leaves col untouched regardless of the alphas', close(result, col), JSON.stringify(result))
  }
}

console.log(failures === 0 ? '\nall composite checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
