/**
 * Headless exercise of the shake response.
 *
 * A phone is the only thing that can produce real accelerometer data, and it
 * is the one device you cannot attach a debugger to comfortably while waving
 * it around. So the thresholds are tuned here instead, against synthetic
 * motion whose shape is known.
 *
 * The case that matters most is the last one: a single hard knock — setting
 * the phone down, a bump in a pocket — must NOT re-roll the seed, while a
 * deliberate shake of similar peak force must. Everything else is a sanity
 * check around it.
 *
 *   node --experimental-strip-types scripts/probe-shake.ts
 */

import { Tumble, type MotionSample } from '../src/shake.ts'

/** Default sensor rate: what iOS delivers. Each case may override it — see
 *  run(), where the rate turned out to matter more than the thresholds. */
const HZ = 60
/** Phone held upright: gravity along -y, as DeviceMotionEvent reports it. */
const G = 9.81

function still(): MotionSample {
  return { x: 0, y: -G, z: 0, spin: 0 }
}

/**
 * Sinusoidal shaking along x at `amp` m/s², `hz` cycles a second.
 *
 * Spin is proportional to the linear force, because a hand shaking a phone
 * twists it too and a gentler shake twists it less. The first version of this
 * returned a fixed ±4 rad/s whatever the amplitude, which meant every case
 * from a hand tremor upward drove the rotation spring equally hard — and the
 * table showed every row pinned at the cap, which read as a plausible result
 * rather than as the bug it was.
 */
function shaking(t: number, amp: number, hz: number): MotionSample {
  const a = Math.sin(t * hz * Math.PI * 2) * amp
  return { x: a, y: -G, z: 0, spin: a * 0.1 }
}

interface Result {
  strongs: number
  peakAngle: number
  peakOffset: number
  peakDisturb: number
  restAngle: number
  restOffset: number
}

/** Run `seconds` of motion, then `settle` seconds of stillness.
 *
 *  `hz` is the *sensor's* rate, and it is a parameter because it turned out
 *  to matter more than any threshold in here. iOS delivers `devicemotion` at
 *  ~60 Hz; Android delivers whatever the vendor chose, and 10-20 Hz is
 *  common. Every case below was originally run at 60 only, which is why a
 *  detector that passes every one of them can still never fire on a real
 *  Android phone. */
function run(
  seconds: number,
  motion: (t: number) => MotionSample,
  settle = 3,
  hz = HZ,
): Result {
  const dt = 1 / hz
  const tumble = new Tumble()
  let strongs = 0
  let peakAngle = 0
  let peakOffset = 0
  let peakDisturb = 0
  let t = 0

  const step = (m: MotionSample): void => {
    tumble.sample(m, dt)
    const s = tumble.advance(dt)
    if (tumble.takeStrong()) strongs++
    peakAngle = Math.max(peakAngle, Math.abs(s.angle))
    peakOffset = Math.max(peakOffset, Math.hypot(s.offsetX, s.offsetY))
    peakDisturb = Math.max(peakDisturb, s.disturb)
    t += dt
  }

  // Half a second of stillness first, so the gravity estimate has settled and
  // the run is not measuring the filter's own start-up.
  for (let i = 0; i < hz / 2; i++) step(still())

  const start = t
  while (t - start < seconds) step(motion(t - start))

  let last = { angle: 0, offsetX: 0, offsetY: 0 }
  for (let i = 0; i < settle * hz; i++) {
    tumble.sample(still(), dt)
    last = tumble.advance(dt)
    if (tumble.takeStrong()) strongs++
  }

  return {
    strongs,
    peakAngle,
    peakOffset,
    peakDisturb,
    restAngle: Math.abs(last.angle),
    restOffset: Math.hypot(last.offsetX, last.offsetY),
  }
}

const cases: Array<[string, Result]> = [
  ['still on a table', run(4, still)],
  ['held in a hand (0.4 m/s² tremor)', run(4, (t) => shaking(t, 0.4, 3))],
  ['walking (3 m/s², 2 Hz)', run(4, (t) => shaking(t, 3, 2))],
  ['a nudge (8 m/s², 1 cycle)', run(0.4, (t) => shaking(t, 8, 2.5))],
  // A one-directional push — picking the phone up off a table, turning to
  // show someone. This is what "normal disturbance" actually looks like, and
  // it is not a sinusoid: a full cycle's kicks very nearly cancel, so tuning
  // against sinusoids alone badly understates the everyday response.
  ['a jolt (10 m/s², half cycle)', run(0.2, (t) => shaking(t, 10, 2.5))],
  ['deliberate shake (28 m/s², 4 Hz)', run(1.2, (t) => shaking(t, 28, 4))],
  ['violent shake (45 m/s², 6 Hz)', run(1.5, (t) => shaking(t, 45, 6))],
  // One half-cycle at shake force, then nothing: an impact, not a shake.
  [
    'single hard knock (30 m/s², one hit)',
    run(3, (t) => (t < 0.09 ? shaking(t, 30, 5.5) : still())),
  ],
  // Two peaks — an impact and its rebound. Still not a shake.
  [
    'knock + rebound (30 m/s², two hits)',
    run(3, (t) => (t < 0.18 ? shaking(t, 30, 5.5) : still())),
  ],
  // The same deliberate shake every phone is supposed to answer, sampled at
  // the rates Android actually delivers. If these differ from the 60 Hz row
  // above, the detector is rate-dependent and the thresholds are innocent.
  ['deliberate shake @ 30 Hz', run(1.2, (t) => shaking(t, 28, 4), 3, 30)],
  ['deliberate shake @ 20 Hz', run(1.2, (t) => shaking(t, 28, 4), 3, 20)],
  ['deliberate shake @ 12 Hz', run(1.2, (t) => shaking(t, 28, 4), 3, 12)],
  ['violent shake @ 12 Hz', run(1.5, (t) => shaking(t, 45, 6), 3, 12)],
]

console.log(
  'case                                    strong  angle°  drift   disturb  rest∠   restΔ',
)
for (const [name, r] of cases) {
  console.log(
    name.padEnd(40),
    String(r.strongs).padStart(5),
    ((r.peakAngle * 180) / Math.PI).toFixed(1).padStart(7),
    r.peakOffset.toFixed(4).padStart(7),
    r.peakDisturb.toFixed(2).padStart(8),
    ((r.restAngle * 180) / Math.PI).toFixed(2).padStart(7),
    r.restOffset.toFixed(4).padStart(7),
  )
}

// The two that decide whether this feels like a switch or like an object.
const shake = cases.find(([n]) => n.startsWith('deliberate'))![1]
const knock = cases.find(([n]) => n.startsWith('knock + rebound'))![1]
console.log()
console.log(
  shake.strongs >= 1 && knock.strongs === 0
    ? 'PASS: a shake re-rolls, a knock and its rebound do not.'
    : `FAIL: shake fired ${shake.strongs}, knock fired ${knock.strongs}.`,
)
