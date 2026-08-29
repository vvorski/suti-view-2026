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
import { startCamera, type CameraSource } from './camera'
import { createHud } from './hud'
import { MAPPINGS, type Mapping, type MappingName, type VisualParams } from './engine'
import { DEFAULT_MERGE_MODE, DEFAULT_MIX, isMergeModeName, type MergeModeName } from './merge-modes'
import { checkWebGL, fullscreenStatus, keepAwake, waitForStart } from './permission-gate'
import { loadPrefs, type Prefs } from './prefs'
import { applyReleaseTone } from './release-tone'
import { mountShare } from './share'
import { Director } from './director'
import { createVisualiser } from './scene'
import { SlowAnalysis } from './engine'
import { startShake } from './shake'
import { confirmBuzz, hapticStatus } from './haptics'
import { mountReleaseName, mountVersionHud, versionHudRunning } from './version'
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
    passthrough: 0,
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
    // Deliberately no `?camera=` parameter, though the Hard Stop on URL shape
    // would allow adding one freely. Every other parameter here sets how the
    // page *looks*; this one would set whether it reaches for a sensor, and a
    // link is not consent — a shared URL that silently opened someone's camera
    // is the exact shape of the thing the capture Hard Stop is protecting.
    // The camera is turned on from the HUD, by the person holding the phone.
    passthrough: 0,
    mapping: mapping && mapping in MAPPINGS ? (mapping as MappingName) : stored.mapping,
    autopilot: auto === null ? stored.autopilot : auto !== '0' && auto !== 'off',
    showStats: query.has('debug') || stored.showStats,
  }
}

/**
 * Plausible audio, for the start screen.
 *
 * Not silence and not noise: a few slow sinusoids at incommensurable periods,
 * so the picture drifts and never visibly repeats. Everything is kept low and
 * smooth on purpose — this is playing behind text somebody is reading, and it
 * has to be alive without asking to be watched. The moment the microphone
 * starts, real numbers replace these and nothing about the renderer changes.
 *
 * Writes the spectrum in place rather than allocating; it runs every frame.
 */
function idleParams(t: number, spectrum: Uint8Array): VisualParams {
  const wave = (period: number, phase = 0): number =>
    0.5 + 0.5 * Math.sin((t / period + phase) * Math.PI * 2)

  // Held around a third to a half rather than near silence. Lower reads as a
  // dim smear behind the gradient, which looks like a screen that has not
  // finished loading rather than a piece that is already playing.
  const level = 0.34 + 0.18 * wave(11)
  const low = 0.32 + 0.22 * wave(7.3, 0.2)
  const mid = 0.28 + 0.2 * wave(5.1, 0.55)
  const high = 0.18 + 0.16 * wave(3.7, 0.8)

  for (let i = 0; i < spectrum.length; i++) {
    const fall = Math.exp(-i / 46)
    const ripple = 0.75 + 0.25 * Math.sin(i / 9 + t * 0.7)
    spectrum[i] = Math.min(255, 210 * fall * ripple * (0.55 + level))
  }

  return {
    level,
    low,
    mid,
    high,
    // No transients at all: a flash on a screen nobody has interacted with
    // yet reads as a glitch rather than as a beat.
    transient: 0,
    tilt: 0.35 + 0.25 * wave(13.9, 0.4),
    breakdown: 0,
    surge: 0,
    novelty: 0.12 * wave(17.3),
    roughness: 0.3 + 0.2 * wave(9.1, 0.65),
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
  mountReleaseName()
  mountShare()

  if (!checkWebGL()) {
    fail('This browser does not support WebGL2, which this page needs to draw.')
    return
  }

  const prefs = resolvePrefs()

  // Built before the gate resolves, not after.
  //
  // The start screen used to be a page *about* the piece — a title, a button
  // and some invented decoration standing in for what the app does. It can
  // simply be the piece instead, running quietly behind the words, because
  // nothing about the renderer needs the microphone: it needs numbers, and
  // idleParams() below makes plausible ones. The gate becomes an overlay on
  // something real rather than a poster for something absent.
  const visualiser = createVisualiser(canvas, {
    geometricView: prefs.geometricView,
    geoColour: prefs.geoColour,
    atmosphericView: prefs.atmosphericView,
    mergeMode: prefs.mergeMode,
    mix: prefs.mix,
  })

  // Flipped by the real loop taking over, which is what stops the idle frames.
  let live = false
  const idleSpectrum = new Uint8Array(256)
  const idleStart = performance.now()
  const idleFrame = (): void => {
    if (live) return
    const t = (performance.now() - idleStart) / 1000
    visualiser.render(idleParams(t, idleSpectrum), idleSpectrum)
    requestAnimationFrame(idleFrame)
  }
  requestAnimationFrame(idleFrame)

  const { source, motion } = await waitForStart({ gate, button, error })
  live = true
  // The gate is going; the version chip drops to its running form — no name,
  // and a reload button that fades out of the way. See versionHudRunning().
  versionHudRunning()
  void keepAwake()

  const shake = startShake(motion)
  let mapping: Mapping = MAPPINGS[prefs.mapping]()

  // The minutes tier and the thing that acts on it. Kept out of `mapping` on
  // purpose: a mapping swap throws away several seconds of envelope state,
  // which is the right call for a fast tier and exactly the wrong one for a
  // five-minute buffer.
  const slow = new SlowAnalysis()
  const director = new Director()

  /** Held open only while passthrough is actually showing. See onPassthrough. */
  let cameraSource: CameraSource | null = null

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
    onPassthrough: async (mix: number) => {
      // Turning it down to nothing releases the camera outright rather than
      // leaving it running behind a zero. Holding an open stream that nothing
      // draws keeps the sensor powered and the OS camera indicator lit, which
      // is the most visible possible way to break the start gate's promise.
      if (mix <= 0) {
        visualiser.setPassthrough(null, 0)
        cameraSource?.close()
        cameraSource = null
        return 0
      }

      // First non-zero value is what asks. This runs inside the control's own
      // pointer handler, so the gesture getUserMedia requires is still live.
      if (!cameraSource) {
        try {
          cameraSource = await startCamera()
        } catch {
          // Declined, or no camera. Report the truth — 0 — and let the HUD put
          // its control back rather than leaving it somewhere it is not.
          return 0
        }
      }
      visualiser.setPassthrough(cameraSource, mix)
      return mix
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
        // Reported whether or not autopilot is on, so the readout answers
        // "why has nothing changed" in both cases: off, or on and waiting.
        director: director.status(),
        warm: character.warm,
        haptics: hapticStatus(),
        fullscreen: fullscreenStatus(),
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
    // Release the camera on the way out like every other capture here. A
    // backgrounded tab holding an open video track keeps the sensor awake and
    // the indicator lit with nothing on screen to explain it.
    cameraSource?.close()
  })
}

void main().catch((err: unknown) => {
  console.error(err)
  fail(err instanceof Error ? err.message : 'Something went wrong.')
})
