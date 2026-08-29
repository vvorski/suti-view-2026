/**
 * Bootstrap and render loop.
 *
 * The two layers, the merge mode, the mix, and the audio mapping are all
 * swappable at runtime, from the control panel or from the URL. URL
 * parameters win over stored preferences, so a link can pin a specific
 * combination without permanently changing what the device remembers.
 */

import { bindGestures } from './gestures'
import { DEFAULT_GEO_COLOUR, parseGeoColour } from './geo-colour'
import { createHud } from './hud'
import { MAPPINGS, type Mapping, type MappingName } from './engine'
import { DEFAULT_MERGE_MODE, DEFAULT_MIX, isMergeModeName, type MergeModeName } from './merge-modes'
import { checkWebGL, keepAwake, waitForStart } from './permission-gate'
import { loadPrefs, type Prefs } from './prefs'
import { applyReleaseTone } from './release-tone'
import { Director } from './director'
import { createVisualiser } from './scene'
import { SlowAnalysis } from './engine'
import { startShake } from './shake'
import { confirmBuzz } from './haptics'
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
    geoColour: DEFAULT_GEO_COLOUR,
    atmosphericView: DEFAULT_ATMOSPHERIC_VIEW,
    mergeMode: DEFAULT_MERGE_MODE,
    mix: DEFAULT_MIX,
    mapping: DEFAULT_MAPPING,
    autopilot: true,
    showStats: false,
  })

  // A URL parameter is an explicit instruction for this load and overrides what
  // the device remembers. `view` is kept as an alias for `atmospheric` — links
  // shared before the two-layer split still land somewhere sensible.
  const query = new URLSearchParams(window.location.search)
  const geometric = query.get('geometric')
  const rgb = parseGeoColour(query.get('rgb'))
  const atmospheric = query.get('atmospheric') ?? query.get('view')
  const merge = query.get('merge')
  const mix = query.get('mix')
  const mapping = query.get('mapping')
  const auto = query.get('auto')

  return {
    geometricView: isGeometricViewName(geometric) ? geometric : stored.geometricView,
    geoColour: rgb ?? stored.geoColour,
    atmosphericView: isAtmosphericViewName(atmospheric) ? atmospheric : stored.atmosphericView,
    mergeMode: isMergeModeName(merge) ? merge : stored.mergeMode,
    mix: mix !== null && !Number.isNaN(Number(mix)) ? Math.min(1, Math.max(0, Number(mix) / 100)) : stored.mix,
    mapping: mapping && mapping in MAPPINGS ? (mapping as MappingName) : stored.mapping,
    autopilot: auto === null ? stored.autopilot : auto !== '0' && auto !== 'off',
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
  applyReleaseTone(__BUILD_NUMBER__)

  if (!checkWebGL()) {
    fail('This browser does not support WebGL2, which this page needs to draw.')
    return
  }

  const prefs = resolvePrefs()

  const { source, motion } = await waitForStart({ gate, button, error })
  void keepAwake()

  const shake = startShake(motion)

  const visualiser = createVisualiser(canvas, {
    geometricView: prefs.geometricView,
    geoColour: prefs.geoColour,
    atmosphericView: prefs.atmosphericView,
    mergeMode: prefs.mergeMode,
    mix: prefs.mix,
  })
  let mapping: Mapping = MAPPINGS[prefs.mapping]()

  // The minutes tier and the thing that acts on it. Kept out of `mapping` on
  // purpose: a mapping swap throws away several seconds of envelope state,
  // which is the right call for a fast tier and exactly the wrong one for a
  // five-minute buffer.
  const slow = new SlowAnalysis()
  const director = new Director()

  const panel = createHud(prefs, {
    onGeometricView: (name: GeometricViewName) => visualiser.setGeometricView(name),
    onGeoColour: (colour) => visualiser.setGeoColour(colour),
    onAtmosphericView: (name: AtmosphericViewName) => visualiser.setAtmosphericView(name),
    onMergeMode: (mode: MergeModeName) => visualiser.setMergeMode(mode),
    onMix: (mix: number) => visualiser.setMix(mix),
    // Mappings carry several seconds of internal state (running means, feature
    // history), none of which is transferable, so switching starts a fresh one
    // rather than trying to hand the old state over.
    onMapping: (name: MappingName) => {
      mapping = MAPPINGS[name]()
    },
    onManualChange: () => director.suspend(),
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

      // Any disturbance tumbles the picture; a hard shake re-rolls the seed —
      // the same action the space bar and a vertical swipe already perform, so
      // shaking the phone is a third way in rather than a new behaviour.
      // Structure and flavour over minutes. Fed the fast tier's output as
      // well as the frame: transient, roughness and level are already computed
      // and tuned, and a second copy would be a second set of constants to
      // keep in step.
      const character = slow.update(audio, params)
      if (panel.autopilot()) {
        const next = director.update(character, audio.dt, {
          geoColour: prefs.geoColour,
          atmosphericView: prefs.atmosphericView,
        })
        if (next) panel.adopt(next)
      }

      const tumble = shake.frame(audio.dt)
      visualiser.setTumble(tumble)
      if (shake.takeStrong()) {
        visualiser.randomise()
        // The one action here with no legible cause and effect: the picture
        // was already moving and is replaced by a different moving picture.
        // The buzz is what distinguishes "the phone heard me" from "the
        // image happened to wander". Android only — see haptics.ts.
        confirmBuzz()
      }

      visualiser.render(params, audio.freq)
      panel.update(params, {
        ...visualiser.stats(),
        disturb: tumble.disturb,
        ...shake.diagnostics(),
      })
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  window.addEventListener('pagehide', () => {
    running = false
    visualiser.dispose()
    shake.close()
    source.close()
  })
}

void main().catch((err: unknown) => {
  console.error(err)
  fail(err instanceof Error ? err.message : 'Something went wrong.')
})
