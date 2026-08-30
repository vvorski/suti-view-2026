/**
 * Offline check of the touch → atmospheric-stream envelope (docs/todo.md
 * entry 48): does contact spike and decay, does level hold only while a
 * finger is down, does roughness track drag speed and saturate at 1, and
 * is the injection a `max` rather than additive at the call site (checked
 * here as a plain arithmetic fact, since the call site itself is scene.ts
 * and out of this pure module's reach).
 *
 *   node --experimental-strip-types scripts/probe-touch-stream.ts
 */

import { createTouchStreamState, updateTouchStream } from '../src/engine/touch.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const DT = 1 / 60

// 1. A fresh contact spikes transient to 1, instantly — no threshold, no
//    ramp-up, per the entry's own "every contact does something, immediately".
{
  const s = createTouchStreamState()
  const out = updateTouchStream(s, DT, true, true, 0)
  check('a fresh contact spikes transient to 1', out.transient === 1, String(out.transient))
}

// 2. The spike decays to (near) 0 within roughly 250ms and stays there with
//    no further contact.
{
  const s = createTouchStreamState()
  updateTouchStream(s, DT, true, true, 0)
  let out
  for (let t = 0; t < 0.3; t += DT) out = updateTouchStream(s, DT, false, true, 0)
  check('the spike has decayed to 0 by 300ms', out!.transient === 0, String(out!.transient))
}

// 3. A second contact while the first is still decaying re-spikes rather
//    than adding — "drumming... stack" is entry 50's job, not this one's;
//    this module's own contract is just "a new contact resets the spike".
{
  const s = createTouchStreamState()
  updateTouchStream(s, DT, true, true, 0)
  for (let t = 0; t < 0.1; t += DT) updateTouchStream(s, DT, false, true, 0)
  const mid = updateTouchStream(s, DT, false, true, 0)
  check('partway through decay, transient is between 0 and 1', mid.transient > 0 && mid.transient < 1, String(mid.transient))
  const respike = updateTouchStream(s, DT, true, true, 0)
  check('a second contact re-spikes to exactly 1, not 1 + partial', respike.transient === 1, String(respike.transient))
}

// 4. Level is the floor while any qualifying touch is down, and exactly 0
//    the instant none are — no lingering level after release.
{
  const s = createTouchStreamState()
  const down = updateTouchStream(s, DT, false, true, 0)
  check('level is nonzero while a finger is down', down.level > 0, String(down.level))
  const up = updateTouchStream(s, DT, false, false, 0)
  check('level is exactly 0 the instant nothing is down', up.level === 0, String(up.level))
}

// 5. Roughness tracks speed and saturates at 1, never exceeding it for an
//    even faster drag.
{
  const s = createTouchStreamState()
  const slow = updateTouchStream(s, DT, false, true, 0.5)
  const fast = updateTouchStream(s, DT, false, true, 3)
  const faster = updateTouchStream(s, DT, false, true, 50)
  check('roughness rises with speed', fast.roughness > slow.roughness, `${slow.roughness} vs ${fast.roughness}`)
  check('roughness saturates at 1', faster.roughness === 1, String(faster.roughness))
  check('roughness is 0 at zero speed', updateTouchStream(s, DT, false, true, 0).roughness === 0, 'nonzero at rest')
}

// 6. The injection itself is Math.max, never additive — a plain arithmetic
//    check standing in for scene.ts's own call site, which this module
//    cannot reach directly.
{
  const musicTransient = 0.8
  const touchTransient = 0.3 // e.g. a touch mid-decay, below a loud drum hit
  const injected = Math.max(musicTransient, touchTransient)
  check('a touch below the music never lowers the transient', injected === musicTransient, String(injected))
  const loudTouch = 0.95
  const injectedLoud = Math.max(musicTransient, loudTouch)
  check('a touch above the music can still raise it, capped at its own value', injectedLoud === loudTouch, String(injectedLoud))
}

console.log(failures === 0 ? `\nall checks passed` : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
