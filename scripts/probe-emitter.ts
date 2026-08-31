/**
 * Offline check of the touch emitter's charge/life math (docs/todo.md
 * entries 33, 50 and 57), extended by entry 102 for the fall: does a longer
 * hold actually charge higher and buy more afterlife, does the afterlife
 * actually run out, does a spawned ripple land in a reserved touch slot
 * rather than stepping on the audio ones, does drag speed boost the birth
 * level, does a drag spawn on distance moved rather than only on the clock,
 * does a released emitter actually fall, bounce and settle against
 * whichever edge `halfExtent` says is there, and — the regression guard —
 * does `gravity = {0,0}` leave every gesture exactly as it was before this
 * entry existed.
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

// 9. docs/todo.md entry 102 — held upright, a released emitter falls toward
//    the low edge, leaves a trail on the way (SPAWN_DIST's own trigger,
//    wired into the release branch by this entry), bounces, and settles at
//    the edge rather than bouncing forever.
{
  const ripples = createRippleState()
  const emitter = createEmitterState()
  const gravity = { x: 0, y: -0.033 } // shake.gravity()'s own full-tilt magnitude, straight down
  const halfExtent = { x: 0.5, y: 0.5 }
  let now = 0
  updateEmitter(emitter, ripples, now, true, 0, 0) // a bare tap at centre
  updateEmitter(emitter, ripples, now, false, 0, 0, 0, 0, gravity, halfExtent) // release
  const yAtRelease = emitter.y
  const spawnsBefore = ripples.touchCursor
  let reachedEdge = false
  for (let i = 0; i < Math.round(3 / DT); i++) {
    now += DT
    updateEmitter(emitter, ripples, now, false, 0, 0, 0, 0, gravity, halfExtent)
    if (Math.abs(emitter.y + 0.5) < 1e-6) reachedEdge = true
  }
  check('a falling emitter moves away from where it was released', emitter.y < yAtRelease - 0.05, `${yAtRelease} -> ${emitter.y}`)
  check('it reaches the low edge at some point during the fall', reachedEdge, `never reached y=-0.5, ended at ${emitter.y}`)
  check('it leaves a trail: more than one ripple spawned during the fall', ripples.touchCursor !== spawnsBefore, 'cursor did not move')
  check('it settles at the edge rather than bouncing forever', emitter.y === -0.5 && Math.hypot(emitter.vx, emitter.vy) === 0, `y=${emitter.y} vx=${emitter.vx} vy=${emitter.vy}`)
}

// 10. Landscape: an asymmetric halfExtent settles the emitter against the
//     short axis' own bound, not a square frame's — the "true bottom" Decided
//     asks for is whichever edge halfExtent says is there, not an assumed one.
{
  const ripples = createRippleState()
  const emitter = createEmitterState()
  const gravity = { x: 0, y: -0.033 }
  const halfExtent = { x: 0.89, y: 0.5 } // a landscape canvas's own shape
  let now = 0
  updateEmitter(emitter, ripples, now, true, 0, 0)
  updateEmitter(emitter, ripples, now, false, 0, 0, 0, 0, gravity, halfExtent)
  for (let i = 0; i < Math.round(3 / DT); i++) {
    now += DT
    updateEmitter(emitter, ripples, now, false, 0, 0, 0, 0, gravity, halfExtent)
  }
  check('in a landscape frame it settles at the short axis\' own edge (0.5), not 0.89', emitter.y === -0.5, String(emitter.y))
  check('the long axis is untouched: it never drifted sideways', emitter.x === 0, String(emitter.x))
}

// 11. A tilted phone slides diagonally — both axes move, together, from one
//     gravity vector and no mode flag deciding between them.
{
  const ripples = createRippleState()
  const emitter = createEmitterState()
  const gravity = { x: -0.02, y: -0.02 } // a diagonal tilt
  let now = 0
  updateEmitter(emitter, ripples, now, true, 0, 0)
  updateEmitter(emitter, ripples, now, false, 0, 0, 0, 0, gravity, { x: 0.5, y: 0.5 })
  for (let i = 0; i < Math.round(0.5 / DT); i++) {
    now += DT
    updateEmitter(emitter, ripples, now, false, 0, 0, 0, 0, gravity, { x: 0.5, y: 0.5 })
  }
  check('a diagonal gravity moves both axes', emitter.x < -0.001 && emitter.y < -0.001, `x=${emitter.x} y=${emitter.y}`)
}

// 12. Flat: an in-plane projection of exactly zero (what shake.ts reports
//     with the phone lying screen-up on a table) is the same {0,0} gravity
//     section 13 below already proves is an identity — no separate physics
//     to test here, since emitter.ts has no notion of "flat" beyond the
//     vector it is handed.

// 13. The regression guard: with gravity pinned at {0,0} — the `grav` chip
//     off, or `updateEmitter` called the old six-argument way entirely —
//     a released emitter's position never moves, on a trace that would
//     visibly move it if gravity were doing anything at all.
{
  const ripples = createRippleState()
  const emitter = createEmitterState()
  let now = 0
  updateEmitter(emitter, ripples, now, true, 0.1, -0.2)
  updateEmitter(emitter, ripples, now, false, 0, 0) // released the old, six-argument way
  const [xAtRelease, yAtRelease] = [emitter.x, emitter.y]
  for (let i = 0; i < Math.round(5 / DT); i++) {
    now += DT
    updateEmitter(emitter, ripples, now, false, 0, 0)
  }
  check(
    'gravity omitted entirely: position is byte-identical to the moment of release',
    emitter.x === xAtRelease && emitter.y === yAtRelease,
    `(${xAtRelease}, ${yAtRelease}) -> (${emitter.x}, ${emitter.y})`,
  )

  const ripples2 = createRippleState()
  const emitter2 = createEmitterState()
  now = 0
  updateEmitter(emitter2, ripples2, now, true, 0.1, -0.2)
  updateEmitter(emitter2, ripples2, now, false, 0, 0, 0, 0, { x: 0, y: 0 }, { x: 0.5, y: 0.5 })
  for (let i = 0; i < Math.round(5 / DT); i++) {
    now += DT
    updateEmitter(emitter2, ripples2, now, false, 0, 0, 0, 0, { x: 0, y: 0 }, { x: 0.5, y: 0.5 })
  }
  check(
    'gravity explicitly {0,0}: identical to the trace above, frame for frame',
    emitter2.x === emitter.x && emitter2.y === emitter.y,
    `(${emitter.x}, ${emitter.y}) vs (${emitter2.x}, ${emitter2.y})`,
  )
}

console.log(failures === 0 ? '\nall emitter checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
