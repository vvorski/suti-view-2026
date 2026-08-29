/**
 * Offline check of the haptic patterns' intensity scaling (docs/todo.md
 * entry 8): does a harder shake actually produce a longer buzz, without ever
 * going quieter than the baseline two earlier builds fought to make
 * perceptible at all?
 *
 * `navigator.vibrate` is stubbed before `haptics.ts` is imported, since
 * `supported` is read once at module load — the same reason
 * probe-fullscreen.ts stubs `document`/`window` first. Everything asserted
 * here is the array actually handed to `vibrate()`, not an internal function:
 * `confirmBuzz`/`doubleBuzz` are the only surface this file has, which is the
 * point — a test that reached past them to check `intensityMultiplier`
 * directly could pass while the real call site was still broken.
 *
 *   node --experimental-strip-types scripts/probe-haptics.ts
 */

const calls: number[][] = []
// Node 24+ ships its own read-only `navigator` global (userAgent etc.), so
// the whole object can't be replaced the way probe-fullscreen.ts replaces
// `document`/`window` — only a property can be added to the one that exists.
;(navigator as unknown as Record<string, unknown>).vibrate = (pattern: number[]) => {
  calls.push(pattern)
  return true
}

const { confirmBuzz, doubleBuzz, PEAK_CEILING, MAX_SCALE } = await import('../src/haptics.ts')
const { STRONG_UP } = await import('../src/shake.ts')

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

function lastCall(): number[] {
  return calls[calls.length - 1]
}

// The baseline patterns, exactly as haptics.ts defines them. Duplicated here
// deliberately rather than imported: they are not exported (nothing else
// needs them to be), and this file's whole job is to check the real output
// against the number a human already confirmed was felt, not against
// whatever the source currently says it is.
const CONFIRM_BASE = [26, 34, 62]
const DOUBLE_BASE = [26, 34, 62, 130, 26, 34, 62]

// 1. The gentlest shake that can fire at all — peak exactly at the floor —
//    must reproduce the untouched baseline pattern. This is the property that
//    matters most: builds 68 and 76 both shipped a pattern nobody could feel,
//    and intensity scaling must never be the thing that reintroduces that by
//    scaling a weak shake *down* from a baseline that was already minimal.
{
  confirmBuzz(STRONG_UP)
  check('gentlest confirm == baseline, unscaled', arraysEqual(lastCall(), CONFIRM_BASE), JSON.stringify(lastCall()))

  doubleBuzz(STRONG_UP)
  check('gentlest double == baseline, unscaled', arraysEqual(lastCall(), DOUBLE_BASE), JSON.stringify(lastCall()))
}

// 2. A shake at or above PEAK_CEILING scales the *on* pulses by exactly
//    MAX_SCALE, and leaves every gap untouched — the gaps are the entire
//    signal that separates a single confirmation from a double, and must
//    survive at any intensity.
{
  confirmBuzz(PEAK_CEILING)
  const expected = CONFIRM_BASE.map((ms, i) => (i % 2 === 0 ? Math.round(ms * MAX_SCALE) : ms))
  check('hardest confirm scales on-pulses by MAX_SCALE', arraysEqual(lastCall(), expected), JSON.stringify(lastCall()))
  check('hardest confirm leaves the gap at 34ms', lastCall()[1] === 34, String(lastCall()[1]))

  doubleBuzz(PEAK_CEILING)
  const expectedD = DOUBLE_BASE.map((ms, i) => (i % 2 === 0 ? Math.round(ms * MAX_SCALE) : ms))
  check('hardest double scales on-pulses by MAX_SCALE', arraysEqual(lastCall(), expectedD), JSON.stringify(lastCall()))
  check(
    'hardest double leaves both gaps at 34ms/130ms',
    lastCall()[1] === 34 && lastCall()[3] === 130 && lastCall()[5] === 34,
    JSON.stringify([lastCall()[1], lastCall()[3], lastCall()[5]]),
  )
}

// 3. A shake harder than PEAK_CEILING doesn't scale past MAX_SCALE — the
//    ceiling is a reference point (probe-shake.ts's "violent shake" case),
//    not a hard physical limit, so something well beyond it must clamp
//    rather than keep growing.
{
  confirmBuzz(PEAK_CEILING * 3)
  const expected = CONFIRM_BASE.map((ms, i) => (i % 2 === 0 ? Math.round(ms * MAX_SCALE) : ms))
  check('a shake far past the ceiling still clamps at MAX_SCALE', arraysEqual(lastCall(), expected), JSON.stringify(lastCall()))
}

// 4. Monotonic: a harder shake never produces a *shorter* on-pulse than a
//    gentler one. The exact curve in between is not asserted — only that
//    intensity moves the pattern the right direction.
{
  confirmBuzz(STRONG_UP)
  const gentle = lastCall()
  confirmBuzz((STRONG_UP + PEAK_CEILING) / 2)
  const middle = lastCall()
  confirmBuzz(PEAK_CEILING)
  const hard = lastCall()
  check(
    'on-pulses grow monotonically with peak',
    middle[0] >= gentle[0] && middle[2] >= gentle[2] && hard[0] >= middle[0] && hard[2] >= middle[2],
    `${JSON.stringify(gentle)} -> ${JSON.stringify(middle)} -> ${JSON.stringify(hard)}`,
  )
  check('and a real difference exists, not a rounding no-op', hard[0] > gentle[0], `${hard[0]} vs ${gentle[0]}`)
}

// 5. A peak below the floor (should not occur — Tumble never reports one —
//    but haptics.ts must not extrapolate a pattern *quieter* than baseline if
//    it ever did) still clamps to the baseline rather than shrinking further.
{
  confirmBuzz(STRONG_UP - 10)
  check('a peak under the floor still floors at baseline, not below it', arraysEqual(lastCall(), CONFIRM_BASE), JSON.stringify(lastCall()))
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

console.log(failures === 0 ? '\nall haptics checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
