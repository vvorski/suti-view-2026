/**
 * Offline check of the press-and-shake decision — docs/todo.md entry 121.
 *
 * The whole of that entry's new logic is one condition, and it guards a
 * capture: a wrong `true` here is a camera prompt nobody asked for, and a
 * wrong `false` is a feature that silently does nothing. Neither is
 * observable without a phone, a granted camera and a hard shake, which is
 * exactly why the condition is a pure function.
 *
 *   node --experimental-strip-types scripts/probe-raise-camera.ts
 */

import { shouldRaiseCamera, PRESS_SHAKE_PASSTHROUGH, type RaiseCameraInput } from '../src/engine/raise-camera.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

/** The one case that raises: a shake, a finger down, no panel, no photo
 *  mode, and a camera that is not already open. */
const YES: RaiseCameraInput = {
  shake: true,
  fingersDown: true,
  panelOpen: false,
  cameraMode: false,
  live: false,
}

check('a shake with a finger down raises the room', shouldRaiseCamera(YES) === true, 'did not raise')

// Every single-flag negation of that, which is the entry's own Done-when.
// Written as a sweep rather than five hand-written cases so that a sixth
// input added later cannot quietly go unchecked.
{
  const reasons: Record<keyof RaiseCameraInput, string> = {
    shake: 'no shake at all',
    fingersDown: 'a shake with no finger on the glass',
    panelOpen: 'the HUD is open, where the shuffle also stands down',
    cameraMode: 'photo mode is armed and owns the passthrough level',
    live: 'the camera is already live, which is entry 22’s own path',
  }
  for (const key of Object.keys(reasons) as (keyof RaiseCameraInput)[]) {
    // `shake` and `fingersDown` are required true, the other three required
    // false, so "negate this one flag" means flipping it away from YES.
    const flipped: RaiseCameraInput = { ...YES, [key]: !YES[key] }
    check(`does not raise when ${reasons[key]}`, shouldRaiseCamera(flipped) === false, `raised with ${key} flipped`)
  }
}

// The identity: with no finger on the glass the decision is false for every
// combination of everything else, so an ordinary shake is byte-for-byte the
// gesture it was before this entry.
{
  let raised = 0
  for (const shake of [true, false]) {
    for (const panelOpen of [true, false]) {
      for (const cameraMode of [true, false]) {
        for (const live of [true, false]) {
          if (shouldRaiseCamera({ shake, fingersDown: false, panelOpen, cameraMode, live })) raised++
        }
      }
    }
  }
  check('a shake with no finger never raises, whatever else is true', raised === 0, `${raised} of 16 raised`)
}

// And the same sweep with a finger down: exactly one combination raises, so
// the condition cannot have been loosened into something that fires more
// often than the entry licensed.
{
  const raised: string[] = []
  for (const shake of [true, false]) {
    for (const panelOpen of [true, false]) {
      for (const cameraMode of [true, false]) {
        for (const live of [true, false]) {
          if (shouldRaiseCamera({ shake, fingersDown: true, panelOpen, cameraMode, live })) {
            raised.push(`shake=${shake} panel=${panelOpen} mode=${cameraMode} live=${live}`)
          }
        }
      }
    }
  }
  check('with a finger down, exactly one of sixteen combinations raises', raised.length === 1, raised.join('; '))
}

// The level, asserted because it is the one number the gesture promises and
// a drifted constant is invisible until somebody looks at the band.
check(
  'the room comes in at 0.5 — both room and picture, not one or the other',
  PRESS_SHAKE_PASSTHROUGH === 0.5,
  String(PRESS_SHAKE_PASSTHROUGH),
)

console.log(failures === 0 ? '\nall raise-camera checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
