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
  doubles: number
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
  let doubles = 0
  let peakAngle = 0
  let peakOffset = 0
  let peakDisturb = 0
  let t = 0

  const step = (m: MotionSample): void => {
    tumble.sample(m, dt)
    const s = tumble.advance(dt)
    if (tumble.takeStrong()) strongs++
    if (tumble.takeDouble()) doubles++
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
    if (tumble.takeDouble()) doubles++
  }

  return {
    strongs,
    doubles,
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
  // A gentler shake than the "deliberate" one, and the case the reversal
  // counter alone cannot answer: peaks at 12 m/s² never reach STRONG_UP's 18,
  // so before the sustained path existed this did nothing at all however long
  // it went on. A phone whose accelerometer reads low makes every real shake
  // look like this one.
  ['gentle sustained shake (12 m/s², 3 Hz)', run(1.5, (t) => shaking(t, 12, 3))],
  ['gentle sustained shake @ 12 Hz', run(1.5, (t) => shaking(t, 12, 3), 3, 12)],
  // Held agitation with no oscillation at all: carried at a fast walk, a
  // pocket on a bumpy road. Must still not re-roll.
  [
    'sustained low agitation (5 m/s², 2.5 Hz)',
    run(3, (t) => shaking(t, 5, 2.5)),
  ],
  ['deliberate shake @ 30 Hz', run(1.2, (t) => shaking(t, 28, 4), 3, 30)],
  ['deliberate shake @ 20 Hz', run(1.2, (t) => shaking(t, 28, 4), 3, 20)],
  ['deliberate shake @ 12 Hz', run(1.2, (t) => shaking(t, 28, 4), 3, 12)],
  // 6.3 Hz, not 6. A 6 Hz shake sampled at 12 Hz sits exactly on Nyquist, so
  // every sample landed on sin(kπ) = 0 and this row read 0.00 across the
  // board — a violent shake registering as a phone lying still, at any
  // amplitude whatsoever.
  //
  // That is arithmetic, not a defect in shake.ts, and chasing it as one would
  // have cost a day. The notch is razor-thin: sweeping shake rate against
  // sensor rate, only exactly sensorHz/2 collapses, while 5.5 Hz and 6.5 Hz
  // against a 12 Hz sensor still retain 0.64 of a normal 0.69. A hand is never
  // exactly 6.000 Hz and never phase-locked to the sensor, so the hazard is
  // real in theory and unreachable in practice.
  //
  // What it is a defect in is this probe: a perfect sinusoid is not a hand.
  // Keep the frequency realistic, and keep this comment so the zero does not
  // get rediscovered as a bug in the app.
  ['violent shake @ 12 Hz', run(1.5, (t) => shaking(t, 45, 6.3), 3, 12)],
  // Two deliberate shakes with a short pause between them. The second falls
  // inside STRONG_COOLDOWN, which used to make it undetectable; it must now
  // read as a double rather than as a second single.
  [
    'double shake (0.35s apart)',
    run(2.2, (t) => (t < 0.8 || t > 1.15 ? shaking(t, 28, 4) : still())),
  ],
  // A pause at an actual hand's cadence — look at the picture, shake again —
  // rather than the 0.35s gap above, which is closer to a hiccup than a
  // pause. This is the case that was silently failing on a real phone while
  // every synthetic case above kept passing: DOUBLE_WINDOW exists because
  // this needs to read as a double too, not just the fast one.
  [
    'double shake (0.9s apart, a real pause)',
    run(2.7, (t) => (t < 0.8 || t > 1.7 ? shaking(t, 28, 4) : still())),
  ],
  // The same two shakes, spaced 2s apart. DOUBLE_WINDOW (3.0s) is armed from
  // the first shake's own fire, not from when the burst starts, so this
  // lands inside it — see docs/todo.md entry 13. This used to be asserted as
  // two singles; a person shaking twice with an ordinary pause is asking
  // twice, not producing an unrelated coincidence.
  [
    'two shakes, 2s apart',
    run(4, (t) => (t < 0.8 || (t > 2.8 && t < 3.6) ? shaking(t, 28, 4) : still())),
  ],
  // Spaced past DOUBLE_WINDOW. This is the case "2s apart" used to be: two
  // shakes far enough apart that shuffling the whole picture in response
  // would surprise someone who made two unrelated gestures.
  [
    'two shakes, 4s apart',
    run(5.6, (t) => (t < 0.8 || (t > 4.8 && t < 5.6) ? shaking(t, 28, 4) : still())),
  ],
]

console.log(
  'case                                    strong  dbl  angle°  drift   disturb  rest∠   restΔ',
)
for (const [name, r] of cases) {
  console.log(
    name.padEnd(40),
    String(r.strongs).padStart(5),
    String(r.doubles).padStart(4),
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

const failures: string[] = []
if (shake.strongs < 1) failures.push(`deliberate shake fired ${shake.strongs}, expected ≥1`)
if (knock.strongs !== 0) failures.push(`knock + rebound fired ${knock.strongs}, expected 0`)
// The escalation must not have cost the knock rejection. Letting the reversal
// counter run during the cooldown is what makes a double detectable, and this
// is the assertion that it did not also make a rebound detectable.
if (knock.doubles !== 0) failures.push(`knock + rebound fired ${knock.doubles} doubles, expected 0`)
// Exact names, not prefixes: there are now two "double shake" cases (a fast
// gap and a human one) and two "two shakes" cases (inside DOUBLE_WINDOW and
// past it), and a prefix match would silently only ever check the first.
const byName = (name: string): Result => cases.find(([n]) => n === name)![1]

const dblFast = byName('double shake (0.35s apart)')
if (dblFast.doubles < 1) failures.push(`double shake (0.35s) fired ${dblFast.doubles} doubles, expected ≥1`)

const dblHuman = byName('double shake (0.9s apart, a real pause)')
if (dblHuman.doubles < 1) failures.push(`double shake (0.9s) fired ${dblHuman.doubles} doubles, expected ≥1`)

const spaced2s = byName('two shakes, 2s apart')
if (spaced2s.doubles < 1) failures.push(`two shakes 2s apart fired ${spaced2s.doubles} doubles, expected ≥1`)

const spaced4s = byName('two shakes, 4s apart')
if (spaced4s.doubles !== 0) failures.push(`two shakes 4s apart fired ${spaced4s.doubles} doubles, expected 0`)
if (spaced4s.strongs < 2) failures.push(`two shakes 4s apart fired ${spaced4s.strongs} singles, expected 2`)

// Every vigorous case, not just the two above.
//
// This exists because the table printed a violent shake reading 0.00 on every
// column — a phone being thrown about registering as one lying still — and the
// summary line said PASS underneath it, because the check only ever looked at
// two of sixteen rows. A row that obviously wrong should not need a human to
// notice it. Whatever the sensor rate, a shake this hard must move something.
for (const [name, r] of cases) {
  if (!name.startsWith('violent') && !name.startsWith('deliberate')) continue
  if (r.peakDisturb < 0.5) failures.push(`${name} reads as still (disturb ${r.peakDisturb.toFixed(2)})`)
}

console.log(
  failures.length === 0
    ? 'PASS: a shake re-rolls, a knock and its rebound do not, and no hard shake reads as still.'
    : `FAIL:\n  ${failures.join('\n  ')}`,
)
process.exit(failures.length === 0 ? 0 : 1)
