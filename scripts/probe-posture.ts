/**
 * Headless exercise of the posture classifier — docs/todo.md entry 90.
 *
 * Four synthetic traces, one per posture that can be told apart from
 * `disturb` alone (`handled` is the shake path, already covered by
 * probe-shake.ts). The point of the exercise is the discriminator Decided
 * names: periodicity, not level — so the car and the walk are built to sit
 * at nearly the same disturb level, and the walk and the dance are built to
 * be the *same* physical motion, differing only in whether a tempo is
 * playing to correlate against.
 *
 *   node --experimental-strip-types scripts/probe-posture.ts
 */

import { createPostureState, updatePosture, type Posture } from '../src/engine/posture.ts'
import { Director, COLOUR_HOLD } from '../src/director.ts'
import { BLANK } from '../src/engine/slow.ts'
import type { GeoColour } from '../src/geo-colour.ts'
import type { AtmosphericViewName } from '../src/views.ts'

const HZ = 60
const DT = 1 / HZ

/** Deterministic noise — see probe-slow.ts's own copy of this for why. */
let seed = 98765
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

function still(): number {
  return 0
}

/** A gait's own ~2 Hz component, disturb ~0.15 either side. */
function walking(t: number): number {
  return Math.max(0, 0.15 + 0.13 * Math.sin(t * 2.0 * Math.PI * 2))
}

/** Sustained, broadband, at nearly the same level as `walking` — no
 *  sinusoidal component anywhere near the gait band, or this would just be
 *  a second walk with extra steps. Pure per-decimated-sample noise instead:
 *  genuinely no periodicity for the autocorrelation to find. */
function driving(): number {
  return Math.max(0, Math.min(1, 0.14 + (rnd() - 0.5) * 0.12))
}

/** The same ~2 Hz component `walking` has, at a higher level — this alone
 *  should not be what tells it apart; see the "same motion, only the tempo
 *  changes" case below for the actual proof of that. */
function dancing(t: number): number {
  return Math.max(0, 0.3 + 0.2 * Math.sin(t * 2.0 * Math.PI * 2))
}

interface Result {
  posture: Posture
  candidate: Posture
  candidateHeld: number
  periodicHz: number
  /** Posture sampled once a second, for the hold/flicker checks. */
  history: Posture[]
}

function run(seconds: number, disturbAt: (t: number) => number, bpm = 0, beatConfidence = 0): Result {
  const state = createPostureState()
  const history: Posture[] = []
  let sinceSample = 0
  let last = updatePosture(state, 0, disturbAt(0), false, bpm, beatConfidence)
  let t = 0
  while (t < seconds) {
    last = updatePosture(state, DT, disturbAt(t), false, bpm, beatConfidence)
    sinceSample += DT
    if (sinceSample >= 1) {
      sinceSample -= 1
      history.push(last.posture)
    }
    t += DT
  }
  return {
    posture: last.posture,
    candidate: last.candidate,
    candidateHeld: last.candidateHeld,
    periodicHz: last.periodicHz,
    history,
  }
}

const failures: string[] = []
const check = (name: string, ok: boolean, detail: string): void => {
  if (!ok) failures.push(`${name} — ${detail}`)
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

console.log('Four postures, one signal apiece:\n')

const table = run(60, still)
check('a table classifies still', table.posture === 'still', `got ${table.posture}`)
check(
  'still holds for the back half of the run, not a one-frame touch',
  table.history.slice(-10).every((p) => p === 'still'),
  `history tail: ${table.history.slice(-10).join(',')}`,
)

const walk = run(60, walking)
check('a 2 Hz walk classifies carried', walk.posture === 'carried', `got ${walk.posture}, gait ${walk.periodicHz.toFixed(2)}Hz`)
check(
  'carried holds for the back half of the run',
  walk.history.slice(-10).every((p) => p === 'carried'),
  `history tail: ${walk.history.slice(-10).join(',')}`,
)

const car = run(60, driving)
check('broadband hum at the same level as the walk classifies driving', car.posture === 'driving', `got ${car.posture}`)
check(
  'driving holds for the back half of the run',
  car.history.slice(-10).every((p) => p === 'driving'),
  `history tail: ${car.history.slice(-10).join(',')}`,
)

const dance = run(60, dancing, 120, 0.8)
check('a 120bpm dance classifies dancing', dance.posture === 'dancing', `got ${dance.posture}`)
check(
  'dancing holds for the back half of the run',
  dance.history.slice(-10).every((p) => p === 'dancing'),
  `history tail: ${dance.history.slice(-10).join(',')}`,
)

// The actual claim this entry makes: periodicity, not level, is the
// discriminator. The car and the walk sit at nearly the same disturb level
// (0.14 vs 0.15) and classify differently; the walk and the dance are the
// *identical* motion and classify differently only because a tempo the
// motion happens to match is or is not playing alongside it.
console.log('\nThe discriminator is periodicity and tempo, not level:\n')
const sameMotionDancing = run(60, walking, 120, 0.8)
check(
  'the exact same 2 Hz motion becomes dancing once a matching tempo plays',
  sameMotionDancing.posture === 'dancing',
  `got ${sameMotionDancing.posture}`,
)
check(
  'and the car, at a level within 0.02 of the walk, still reads driving',
  Math.abs(0.14 - 0.15) < 0.02 && car.posture === 'driving' && walk.posture === 'carried',
  `car ${car.posture}, walk ${walk.posture}`,
)

// docs/todo.md entry 90's own Done-when: a traffic-light stop must not flip
// driving to still. Sustained hum, a 5s near-zero gap, then hum again.
console.log('\nA traffic-light stop (entry 90):\n')
const trafficLight = run(70, (t) => (t >= 40 && t < 45 ? 0 : driving()))
// The classifier's own posture field starts at 'still' and cannot report
// anything else until POSTURE_DWELL has held a new candidate — a cold-start
// settling delay, not the traffic-light stop this check is actually about.
// So the check only looks from the point driving is first reported onward,
// which the stop at t=40-45s sits well past.
const settledAt = trafficLight.history.findIndex((p) => p === 'driving')
check(
  'a brief stop during driving never flips back to still once settled',
  settledAt >= 0 && !trafficLight.history.slice(settledAt).some((p) => p === 'still'),
  `settled at ${settledAt}s, history: ${trafficLight.history.join(',')}`,
)
check('and driving resumes being reported once moving again', trafficLight.posture === 'driving', `got ${trafficLight.posture}`)

// docs/todo.md entry 90's other Done-when: the director's own holds visibly
// differ between the still and dancing traces. Two Directors, identical
// due colour, differing only in which posture is fed to update() every
// call — still ×0.55 must fire earlier than dancing ×0.7.
console.log("\nThe director's holds differ by posture (entry 90):\n")
{
  const idleCurrent: { geoColour: GeoColour; atmosphericView: AtmosphericViewName } = {
    geoColour: { r: 1, g: 1, b: 1 },
    atmosphericView: 'field',
  }
  const due = { ...BLANK, warm: true, warmMedium: true, bright: 1, noveltyMedium: 1 }

  // A fresh Director's own sinceColour starts pre-loaded at the flat,
  // unscaled COLOUR_HOLD (see director.ts's own field comment) — which
  // already exceeds *both* still's and dancing's scaled holds (13.75s,
  // 17.5s) before update() is ever called once, so the *first* fire happens
  // instantly under either posture and cannot tell them apart. `current`
  // is never updated back to `wanted` in this harness, so the same step
  // stays due forever; the *second* fire's gap from the first is therefore
  // a clean read of the scaled hold alone, unaffected by the preload.
  function fireGap(posture: Posture): number {
    const d = new Director()
    const fires: number[] = []
    let t = 0
    while (t < COLOUR_HOLD * 3 && fires.length < 2) {
      const next = d.update(due, DT, idleCurrent, 0, 0, posture)
      if (next?.geoColour) fires.push(t)
      t += DT
    }
    return fires.length === 2 ? fires[1] - fires[0] : -1
  }

  const stillGap = fireGap('still')
  const dancingGap = fireGap('dancing')
  check('a due colour change fires twice under still', stillGap >= 0, 'never fired a second time')
  check('a due colour change fires twice under dancing', dancingGap >= 0, 'never fired a second time')
  check(
    `still (×0.55) holds a shorter gap between fires than dancing (×0.7) — still ${stillGap.toFixed(1)}s, dancing ${dancingGap.toFixed(1)}s`,
    stillGap >= 0 && dancingGap >= 0 && stillGap < dancingGap,
    'the hold scale had no visible effect',
  )
}

console.log()
console.log(failures.length === 0 ? 'PASS: every posture classifies correctly and holds.' : `CHECK: ${failures.length} failure(s)`)
if (failures.length > 0) process.exitCode = 1
