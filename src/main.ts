/**
 * Bootstrap and render loop.
 *
 * The two layers, the merge mode, the mix, and the audio mapping are all
 * swappable at runtime, from the control panel or from the URL. URL
 * parameters win over stored preferences, so a link can pin a specific
 * combination without permanently changing what the device remembers.
 */

import { createControlPanel, loadPrefs, type Prefs } from './control-panel'
import { bindGestures } from './gestures'
import { MAPPINGS, type Mapping, type MappingName } from './mapping'
import { DEFAULT_MERGE_MODE, DEFAULT_MIX, isMergeModeName, type MergeModeName } from './merge-modes'
import { checkWebGL, keepAwake, waitForStart } from './permission-gate'
import { createVisualiser } from './scene'
import { mountVersionHud } from './version'
import {
  DEFAULT_ATMOSPHERIC_VIEW,
  DEFAULT_GEOMETRIC_VIEW,
  isAtmosphericViewName,
  isGeometricViewName,
  type AtmosphericViewName,
  type GeometricViewName,
} from './views'

/** Relative loudness: self-calibrates between a quiet room and a sound system. */
const DEFAULT_MAPPING: MappingName = 'relative'

function fail(message: string): void {
  const error = document.getElementById('error')
  const button = document.getElementById('start')
  if (error) error.textContent = message
  if (button instanceof HTMLButtonElement) button.disabled = true
}

function resolvePrefs(): Prefs {
  const stored = loadPrefs({
    geometricView: DEFAULT_GEOMETRIC_VIEW,
    atmosphericView: DEFAULT_ATMOSPHERIC_VIEW,
    mergeMode: DEFAULT_MERGE_MODE,
    mix: DEFAULT_MIX,
    mapping: DEFAULT_MAPPING,
    showStats: false,
  })

  // A URL parameter is an explicit instruction for this load and overrides what
  // the device remembers. `view` is kept as an alias for `atmospheric` — links
  // shared before the two-layer split still land somewhere sensible.
  const query = new URLSearchParams(window.location.search)
  const geometric = query.get('geometric')
  const atmospheric = query.get('atmospheric') ?? query.get('view')
  const merge = query.get('merge')
  const mix = query.get('mix')
  const mapping = query.get('mapping')

  return {
    geometricView: isGeometricViewName(geometric) ? geometric : stored.geometricView,
    atmosphericView: isAtmosphericViewName(atmospheric) ? atmospheric : stored.atmosphericView,
    mergeMode: isMergeModeName(merge) ? merge : stored.mergeMode,
    mix: mix !== null && !Number.isNaN(Number(mix)) ? Math.min(1, Math.max(0, Number(mix) / 100)) : stored.mix,
    mapping: mapping && mapping in MAPPINGS ? (mapping as MappingName) : stored.mapping,
    showStats: query.has('debug') || stored.showStats,
  }
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

  mountVersionHud()

  if (!checkWebGL()) {
    fail('This browser does not support WebGL2, which this page needs to draw.')
    return
  }

  const prefs = resolvePrefs()

  const source = await waitForStart({ gate, button, error })
  void keepAwake()

  const visualiser = createVisualiser(canvas, {
    geometricView: prefs.geometricView,
    atmosphericView: prefs.atmosphericView,
    mergeMode: prefs.mergeMode,
    mix: prefs.mix,
  })
  let mapping: Mapping = MAPPINGS[prefs.mapping]()

  const panel = createControlPanel(prefs, {
    onGeometricView: (name: GeometricViewName) => visualiser.setGeometricView(name),
    onAtmosphericView: (name: AtmosphericViewName) => visualiser.setAtmosphericView(name),
    onMergeMode: (mode: MergeModeName) => visualiser.setMergeMode(mode),
    onMix: (mix: number) => visualiser.setMix(mix),
    // Mappings carry several seconds of internal state (running means, feature
    // history), none of which is transferable, so switching starts a fresh one
    // rather than trying to hand the old state over.
    onMapping: (name: MappingName) => {
      mapping = MAPPINGS[name]()
    },
  })

  bindGestures({
    onRandomise: () => visualiser.randomise(),
    onSwipeAtmospheric: (direction) => panel.cycleAtmosphericView(direction),
  })

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
      panel.update(params, visualiser.stats())
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
