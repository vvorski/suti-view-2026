/**
 * Offline check of the touch field (docs/todo.md entry 49): does it track
 * more than one id, does a fifth contact get ignored rather than displacing
 * one already down, does zone/onChip stay fixed for a contact's life, does
 * `events()` drain exactly once, and does the uv conversion agree with the
 * geometry every geometric shader already assumes.
 *
 * Pure state, no DOM and no clock of its own — same discipline as
 * ripples.ts and emitter.ts — so this runs against synthetic ids/coordinates
 * exactly like probe-emitter.ts does, rather than needing a browser or real
 * multi-touch hardware, neither of which this harness can drive anyway.
 *
 *   node --experimental-strip-types scripts/probe-touches.ts
 */

import { createTouchField, toShaderUv } from '../src/engine/touches.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

// 1. Two ids tracked independently, at once.
{
  const f = createTouchField()
  f.down(0, 1, 0.1, 0.1, 100, 100, false, 'none')
  f.down(0, 2, -0.1, -0.1, 50, 50, false, 'panel')
  const s = f.sample(0)
  check('two contacts sampled at once', s.length === 2, String(s.length))
  const a = s.find((t) => t.id === 1)
  const b = s.find((t) => t.id === 2)
  check('id 1 keeps its own position', a?.x === 0.1 && a?.y === 0.1, JSON.stringify(a))
  check('id 2 keeps its own position, unmixed with id 1', b?.x === -0.1 && b?.y === -0.1, JSON.stringify(b))
  check('id 1 keeps its own zone', a?.zone === 'none', String(a?.zone))
  check('id 2 keeps its own zone', b?.zone === 'panel', String(b?.zone))
}

// 2. Four is the cap; a fifth is ignored, not swapped in for one already
//    down — matches ripples.ts's four reserved touch slots.
{
  const f = createTouchField()
  for (let id = 1; id <= 4; id++) f.down(0, id, 0, 0, 0, 0, false, 'none')
  f.down(0, 5, 0, 0, 0, 0, false, 'none')
  check('a fifth contact is ignored', f.sample(0).length === 4, String(f.sample(0).length))
  check('the fifth id never appears', !f.sample(0).some((t) => t.id === 5), 'id 5 present')
  f.up(2)
  f.down(0, 6, 0, 0, 0, 0, false, 'none')
  check('a freed slot accepts a new contact', f.sample(0).some((t) => t.id === 6), 'id 6 missing after a slot freed')
}

// 3. zone/onChip are fixed at contact start and do not change on move.
{
  const f = createTouchField()
  f.down(0, 1, 0, 0, 0, 0, true, 'capture')
  f.move(0.1, 1, 0.05, 0.05, 5, 5)
  const t = f.sample(0.1)[0]
  check('onChip survives a move', t.onChip === true, String(t.onChip))
  check('zone survives a move', t.zone === 'capture', String(t.zone))
}

// 4. downFor tracks elapsed time since down(), not since the last sample.
{
  const f = createTouchField()
  f.down(1.0, 1, 0, 0, 0, 0, false, 'none')
  check('downFor is 0 at the instant of down()', f.sample(1.0)[0]?.downFor === 0, String(f.sample(1.0)[0]?.downFor))
  check('downFor advances with now', Math.abs((f.sample(1.6)[0]?.downFor ?? -1) - 0.6) < 1e-9, String(f.sample(1.6)[0]?.downFor))
}

// 5. events() drains exactly once — a second call with nothing new returns
//    empty, and up/cancel/down are each reported once, in order.
{
  const f = createTouchField()
  f.down(0, 1, 0, 0, 0, 0, false, 'none')
  f.up(1)
  f.down(0, 2, 0, 0, 0, 0, false, 'none')
  f.cancel(2)
  const first = f.events()
  check('four events queued', first.length === 4, String(first.length))
  check('events arrive in order', first.map((e) => `${e.kind}:${e.id}`).join(',') === 'down:1,up:1,down:2,cancel:2', first.map((e) => `${e.kind}:${e.id}`).join(','))
  check('a second drain is empty', f.events().length === 0, String(f.events().length))
}

// 6. A fifth contact ignored by down() must not appear in events() either —
//    the ignore has to be total, not just absent from sample().
{
  const f = createTouchField()
  for (let id = 1; id <= 4; id++) f.down(0, id, 0, 0, 0, 0, false, 'none')
  f.events()
  f.down(0, 5, 0, 0, 0, 0, false, 'none')
  check('an ignored fifth contact raises no down event', f.events().length === 0, 'unexpected event for ignored contact')
}

// 7. move() on an id that was never down (or already removed) is a no-op,
//    not a crash and not a resurrection.
{
  const f = createTouchField()
  f.move(0, 99, 1, 1, 1, 1)
  check('move on an unknown id does nothing', f.sample(0).length === 0, String(f.sample(0).length))
}

// 8. The uv conversion matches every geometric shader's own uv: origin at
//    the frame's centre, y flipped (DOM grows down, uv grows up), and scaled
//    by the shorter side so a non-square canvas doesn't stretch it.
{
  const rect = { left: 10, top: 20, width: 300, height: 500 }
  const [cx, cy] = toShaderUv(10 + 150, 20 + 250, rect) // dead centre
  check('the centre of the rect is uv (0,0)', Math.abs(cx) < 1e-9 && Math.abs(cy) < 1e-9, `${cx},${cy}`)
  const [, topY] = toShaderUv(10 + 150, 20, rect) // top edge, same x
  check('the top edge has positive uv.y (flipped)', topY > 0, String(topY))
  const [, botY] = toShaderUv(10 + 150, 20 + 500, rect) // bottom edge
  check('the bottom edge has negative uv.y', botY < 0, String(botY))
}

console.log(failures === 0 ? `\nall checks passed` : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
