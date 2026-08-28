/**
 * Bootstrap and render loop.
 *
 * Swapping the audio->visual mapping is a one-line change here — that is the
 * whole reason `mapping.ts` is a separate module. `?mapping=auto-normalised` in
 * the URL overrides it, so both can be compared on a phone without a rebuild.
 */

import { createHud } from './debug-hud'
import { MAPPINGS, type MappingName } from './mapping'
import { checkWebGL, keepAwake, waitForStart } from './permission-gate'
import { createVisualiser } from './scene'

/** The default. Chosen to suit voice and ambient sound over music. */
const DEFAULT_MAPPING: MappingName = 'speech-band'

function chooseMapping(): MappingName {
  const requested = new URLSearchParams(window.location.search).get('mapping')
  return requested && requested in MAPPINGS ? (requested as MappingName) : DEFAULT_MAPPING
}

function fail(message: string): void {
  const error = document.getElementById('error')
  const button = document.getElementById('start')
  if (error) error.textContent = message
  if (button instanceof HTMLButtonElement) button.disabled = true
}

async function main(): Promise<void> {
  const canvas = document.getElementById('canvas')
  const gate = document.getElementById('gate')
  const button = document.getElementById('start')
  const error = document.getElementById('error')

  if (
    !(canvas instanceof HTMLCanvasElement) ||
    !gate ||
    !(button instanceof HTMLButtonElement) ||
    !error
  ) {
    throw new Error('missing required elements in index.html')
  }

  if (!checkWebGL()) {
    fail('This browser does not support WebGL2, which this page needs to draw.')
    return
  }

  const source = await waitForStart({ gate, button, error })
  void keepAwake()

  const mappingName = chooseMapping()
  const mapping = MAPPINGS[mappingName]()
  const visualiser = createVisualiser(canvas)
  const hud = new URLSearchParams(window.location.search).has('debug')
    ? createHud(mappingName)
    : null

  window.addEventListener('resize', visualiser.resize)
  // iOS fires resize before the viewport has settled after a rotation, so the
  // first measurement is the old orientation's. Re-measure a beat later.
  window.addEventListener('orientationchange', () => {
    window.setTimeout(visualiser.resize, 250)
  })

  let running = true
  const frame = () => {
    if (!running) return
    // Skip the audio read and the draw while hidden, but keep the loop alive:
    // rAF is throttled to a stop anyway, and this avoids integrating a huge dt
    // on the first frame back.
    if (document.visibilityState === 'visible') {
      const audio = source.frame()
      const params = mapping.update(audio)
      visualiser.render(params, audio.freq)
      hud?.update(params)
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  window.addEventListener('pagehide', () => {
    running = false
    visualiser.dispose()
    source.close()
  })
}

void main().catch((err: unknown) => {
  console.error(err)
  fail(err instanceof Error ? err.message : 'Something went wrong.')
})
