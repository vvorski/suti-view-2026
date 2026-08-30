/**
 * Offline check of the touch emitter's charge/life math (docs/todo.md
 * entries 33, 50 and 57): does a longer hold actually charge higher and buy
 * more afterlife, does the afterlife actually run out, does a spawned
 * ripple land in a reserved touch slot rather than stepping on the audio
 * ones, does drag speed boost the birth level, and does a drag spawn on
 * distance moved rather than only on the clock?
 *
 * Pure state, no DOM and no clock of its own — same discipline as
 * ripples.ts and shake.ts — so this runs against synthetic `now`/`dt`
 * exactly like probe-shake.ts does, rather than needing a browser or a real
 * accelerometer.
 *
 *   node --experimental-strip-types scripts/probe-emitter.ts
 */

import { createEmitterState, updateEmitter } from '../src/engine/emitter.ts'
import { createRippleState } from '../src/engine/ripples.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const DT = 1 / 60

// 1. The briefest qualifying contact still charges at the floor, not at
//    zero — the floor is what a bare tap is worth since entry 50 removed
//    the gesture threshold (0.4 → 0.6): an emitter that began at nothing
//    would read as unresponsive at exactly the moment someone is learning
//    the gesture, and a tap is the first touch anyone gives this thing.
{
  const ripples = createRippleState()
  const emitter = createEmitterState()
  updateEmitter(emitter, ripples, 0, true, 0, 0)
  check('an instant contact charges at the 0.6 floor, not 0', emitter.releaseCharge === 0.6, String(emitter.releaseCharge))
  check('an instant contact has the 2.0 minimum life', emitter.life === 2, String(emitter.life))
}

// 2. Charge rises with contact time and saturates at 1.0 by CHARGE_TIME
//    (2.5s), never exceeding it for a longer hold.
{
  const ripples = createRippleState()
  const emitter = createEmitterState()
  let now = 0
  for (let i = 0; i < Math.round(2.5 / DT); i++) {
    now += DT
    updateEmitter(emitter, ripples, now, true, 0, 0)
  }
  check('charge saturates at 1.0 by 2.5s of contact', Math.abs(emitter.releaseCharge - 1) < 0.01, String(emitter.releaseCharge))
  for (let i = 0; i < Math.round(2 / DT); i++) {
    now += DT
    updateEmitter(emitter, ripples, now, true, 0, 0)
  }
  check('holding longer than that does not push charge past 1.0', emitter.releaseCharge <= 1 + 1e-9, String(emitter.releaseCharge))
  check('life reaches the 4.0 maximum at full charge', Math.abs(emitter.life - 4) < 0.01, String(emitter.life))
}

// 3. Releasing freezes the charge and counts life down to exactly 0 — not
//    below it, and not indefinitely: an emitter that never reached 0 would
//    never stop spawning, and this is what "dies away over a few seconds"
//    means numerically.
{
  const ripples = createRippleState()
  const emitter = createEmitterState()
  let now = 0
  // Ticked every frame, as the real render loop does — a single big jump in
  // `now` would count its whole gap as "since the last tick" and release
  // with most of the life already spent, which is not what a held-then-
  // released finger does.
  for (let i = 0; i < Math.round(0.2 / DT); i++) {
    now += DT
    updateEmitter(emitter, ripples, now, true, 0, 0) // floor charge, 2.0s life
  }
  updateEmitter(emitter, ripples, now, false, 0, 0) // release
  check('life is still close to its full allotment right at release', emitter.life > 1.9, String(emitter.life))
  for (let i = 0; i < Math.round(10 / DT); i++) {
    now += DT
    updateEmitter(emitter, ripples, now, false, 0, 0)
  }
  check('life reaches exactly 0 and stays there, not negative', emitter.life === 0, String(emitter.life))
}

// 4. A longer hold's afterlife genuinely outlasts a shorter hold's — this is
//    the numeric shape of "a half-second hold and a three-second hold are
//    told apart... by roughly two seconds after it lifts" from the entry's
//    own Done-when.
{
  const shortHold = createEmitterState()
  const longHold = createEmitterState()
  const ripplesA = createRippleState()
  const ripplesB = createRippleState()
  updateEmitter(shortHold, ripplesA, 0, true, 0, 0)
  updateEmitter(shortHold, ripplesA, 0, false, 0, 0) // released instantly
  let now = 0
  for (let i = 0; i < Math.round(3 / DT); i++) {
    now += DT
    updateEmitter(longHold, ripplesB, now, true, 0, 0)
  }
  updateEmitter(longHold, ripplesB, now, false, 0, 0)
  check(
    'a 3s hold buys noticeably more afterlife than an instant one',
    longHold.life - shortHold.life > 1.5,
    `${longHold.life} vs ${shortHold.life}`,
  )
}

// 5. spawnAt lands in the reserved touch range and never touches an audio
//    slot — the whole point of reserving rather than sharing the buffer.
{
  const ripples = createRippleState()
  const emitter = createEmitterState()
  updateEmitter(emitter, ripples, 5, true, 0.4, -0.2)
  const audioUntouched = ripples.slots.slice(0, 8 * 4).every((v, i) => (i % 4 === 0 ? v === -1000 : true))
  check('spawning a touch ripple leaves every audio slot untouched', audioUntouched, JSON.stringify(Array.from(ripples.slots.slice(0, 8))))
  // Float32Array rounding, not exact equality — the buffer is uploaded to
  // the GPU as float32 (see scene.ts), so a JS double written in necessarily
  // reads back slightly off.
  const touchSlot0 = ripples.slots.slice(8 * 4, 9 * 4)
  const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-5
  check(
    'the first touch slot carries the birth, charge, and position',
    touchSlot0[0] === 5 && near(touchSlot0[1], 0.6) && near(touchSlot0[2], 0.4) && near(touchSlot0[3], -0.2),
    JSON.stringify(Array.from(touchSlot0)),
  )
}

// 6. Drag speed boosts a spawned ring's birth level on top of charge,
//    capped at 1 — entry 50's "a fling throws further" — and never lowers
//    it below what charge alone would give.
{
  const ripples = createRippleState()
  const still = createEmitterState()
  const fast = createEmitterState()
  updateEmitter(still, ripples, 0, true, 0, 0, 0)
  updateEmitter(fast, ripples, 0, true, 0, 0, 3)
  check('drag speed raises the birth level above a still contact\'s', fast.releaseCharge > still.releaseCharge, `${fast.releaseCharge} vs ${still.releaseCharge}`)
  const veryFast = createEmitterState()
  updateEmitter(veryFast, ripples, 0, true, 0, 0, 50)
  check('the boosted level still caps at 1', veryFast.releaseCharge === 1, String(veryFast.releaseCharge))
}

// 7. A drag spawns on distance moved, not only on the clock — entry 57.
//    Two updates a frame apart, moved well past SPAWN_DIST, should each
//    spawn even though far less than SPAWN_INTERVAL has elapsed.
{
  const ripples = createRippleState()
  const emitter = createEmitterState()
  updateEmitter(emitter, ripples, 0, true, 0, 0)
  const spawnsAfterFirst = ripples.touchCursor
  updateEmitter(emitter, ripples, 1 / 60, true, 0.2, 0) // far past SPAWN_DIST, well under SPAWN_INTERVAL
  check(
    'a large move one frame later spawns again despite the short interval',
    ripples.touchCursor !== spawnsAfterFirst,
    `cursor stayed at ${ripples.touchCursor}`,
  )
}

// 8. Holding still relies on the clock alone — no distance to spend, and it
//    still has to keep emitting (entry 33's original behaviour, unchanged).
{
  const ripples = createRippleState()
  const emitter = createEmitterState()
  updateEmitter(emitter, ripples, 0, true, 0, 0)
  const afterFirst = ripples.touchCursor
  updateEmitter(emitter, ripples, 0.05, true, 0, 0) // no movement, under SPAWN_INTERVAL
  check('no movement and no elapsed interval spawns nothing new', ripples.touchCursor === afterFirst, 'spawned early')
  updateEmitter(emitter, ripples, 0.2, true, 0, 0) // no movement, past SPAWN_INTERVAL
  check('a still hold still spawns once the interval elapses', ripples.touchCursor !== afterFirst, 'never spawned')
}

console.log(failures === 0 ? '\nall emitter checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
