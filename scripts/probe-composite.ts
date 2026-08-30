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
// 3 multiply, 4 overlay, 5 difference.
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

const MODES = [0, 1, 2, 3, 4, 5]
const MODE_NAMES = ['normal', 'add', 'screen', 'multiply', 'overlay', 'difference']

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

console.log(failures === 0 ? '\nall composite checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
