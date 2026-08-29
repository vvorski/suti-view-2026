/**
 * Bootstrap and render loop.
 *
 * The two layers, the merge mode, the mix, and the audio mapping are all
 * swappable at runtime, from the control panel or from the URL. URL
 * parameters win over stored preferences, so a link can pin a specific
 * combination without permanently changing what the device remembers.
 */

import { bindGestures } from './gestures'
import { DEFAULT_GEO_COLOUR, parseGeoColour, type GeoColour } from './geo-colour'
import { startCamera, type CameraSource } from './camera'
import { createHud } from './hud'
import { MAPPINGS, type Mapping, type MappingName, type VisualParams } from './engine'
import {
  DEFAULT_ATM_MERGE_MODE,
  DEFAULT_MERGE_MODE,
  DEFAULT_MIX,
  isMergeModeName,
  MERGE_MODES,
  type MergeModeName,
} from './merge-modes'
import { checkWebGL, fullscreenStatus, keepAwake, waitForStart } from './permission-gate'
import { loadPrefs, type Prefs } from './prefs'
import { applyReleaseTone } from './release-tone'
import { mountShare } from './share'
import { Director } from './director'
import { createVisualiser } from './scene'
import { SlowAnalysis } from './engine'
import { startShake } from './shake'
import { confirmBuzz, doubleBuzz, hapticStatus } from './haptics'
import { IdlePreview } from './idle-preview'
import { mountReleaseName, mountVersionHud, versionHudRunning } from './version'
import {
  ATMOSPHERIC_VIEWS,
  DEFAULT_ATMOSPHERIC_VIEW,
  DEFAULT_GEOMETRIC_VIEW,
  GEOMETRIC_VIEWS,
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

/** A 0-100 URL parameter as a 0-1 value, or the fallback when absent or junk. */
function pct(raw: string | null, fallback: number): number {
  if (raw === null || Number.isNaN(Number(raw))) return fallback
  return Math.min(1, Math.max(0, Number(raw) / 100))
}

function resolvePrefs(): Prefs {
  const stored = loadPrefs({
    geometricView: DEFAULT_GEOMETRIC_VIEW,
    geoColour: DEFAULT_GEO_COLOUR,
    // White is identity for a colour gain, so a layer nobody has tinted looks
    // exactly as it always did.
    atmColour: { r: 1, g: 1, b: 1 },
    camColour: { r: 1, g: 1, b: 1 },
    atmosphericView: DEFAULT_ATMOSPHERIC_VIEW,
    mergeMode: DEFAULT_MERGE_MODE,
    atmMergeMode: DEFAULT_ATM_MERGE_MODE,
    mix: DEFAULT_MIX,
    geoAlpha: DEFAULT_MIX,
    atmAlpha: 1,
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
  const geo = query.get('geo')
  const atm = query.get('atm')
  const mapping = query.get('mapping')
  const auto = query.get('auto')

  return {
    geometricView: isGeometricViewName(geometric) ? geometric : stored.geometricView,
    geoColour: rgb ?? stored.geoColour,
    atmColour: stored.atmColour,
    camColour: stored.camColour,
    atmosphericView: isAtmosphericViewName(atmospheric) ? atmospheric : stored.atmosphericView,
    mergeMode: isMergeModeName(merge) ? merge : stored.mergeMode,
    // No `?atmMerge=` — not specified in scope, and stored is enough: this
    // control is reached from the HUD, not shared via link, at least for now.
    atmMergeMode: stored.atmMergeMode,
    mix: pct(mix, stored.mix),
    // ?mix= keeps meaning exactly what it always meant, because it is in links
    // already in the world: the geometric layer's opacity, with the atmosphere
    // full. ?geo= and ?atm= are the new pair and win when both are present —
    // new parameters are free, renaming or repurposing one is not.
    geoAlpha: pct(geo, pct(mix, stored.geoAlpha)),
    atmAlpha: pct(atm, mix !== null ? 1 : stored.atmAlpha),
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

/**
 * A new picture, from a double shake.
 *
 * Views, merge mode and all three layers' colour, and deliberately nothing
 * else. Opacity is not rolled: a shuffle that can hand back a black screen
 * looks like a crash, and the only way out would be shaking again at a screen
 * showing nothing. Mapping is not rolled either — that is how it *hears*, not
 * what it looks like — and the camera is never switched on, which is not a
 * taste call but the capture hard stop: nothing may reach for a sensor without
 * a gesture asking for it.
 *
 * Colour channels are floored at 0.2 rather than spanning the full range, for
 * the same reason opacity is left alone: three channels that all land near
 * zero make a layer black, which is the blank-screen failure arriving by
 * another route.
 */
function shuffled(prefs: Prefs): {
  geometricView: GeometricViewName
  atmosphericView: AtmosphericViewName
  mergeMode: MergeModeName
  atmMergeMode: MergeModeName
  geoColour: GeoColour
  atmColour: GeoColour
  camColour: GeoColour
} {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]
  const channel = (): number => 0.2 + Math.random() * 0.8
  const colour = (): GeoColour => ({ r: channel(), g: channel(), b: channel() })
  return {
    geometricView: pick(Object.keys(GEOMETRIC_VIEWS) as GeometricViewName[]),
    atmosphericView: pick(Object.keys(ATMOSPHERIC_VIEWS) as AtmosphericViewName[]),
    mergeMode: pick(Object.keys(MERGE_MODES) as MergeModeName[]),
    atmMergeMode: pick(Object.keys(MERGE_MODES) as MergeModeName[]),
    geoColour: colour(),
    atmColour: colour(),
    camColour: prefs.camColour,
  }
}

/**
 * Flash the screen white on a detected shake, when the numeric readout is on.
 *
 * Built for one report: "the shake isn't working, no double detection" — with
 * nothing to check it against but the eye. `probe:shake` passes every
 * synthetic case for both single and double, and `main.ts` calls `takeDouble`
 * correctly, so nothing in the code points at a bug. What is missing is the
 * one thing a probe cannot supply: whether *anything* is firing on this
 * particular phone at all, and if so, which kind.
 *
 * Gated on `prefs.showStats` rather than a second `?debug` flag — that
 * already means "diagnostics are visible" and a flash on every shake once
 * this ships permanently would turn a quiet instrument into a strobe.
 *
 * A DOM overlay, not a shader uniform: it must be visible even if the render
 * path itself is the thing broken, and it must cost nothing when off.
 */
function flashShake(double: boolean): void {
  const el = document.getElementById('shake-flash')
  if (!el) return
  el.classList.remove('on', 'double')
  if (double) {
    // Restart the animation: removing and re-adding the class in the same
    // tick would be coalesced by the browser into no change at all.
    void el.offsetWidth
    el.classList.add('double')
  } else {
    el.classList.add('on')
    requestAnimationFrame(() => el.classList.remove('on'))
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
    atmColour: prefs.atmColour,
    camColour: prefs.camColour,
    atmosphericView: prefs.atmosphericView,
    mergeMode: prefs.mergeMode,
    atmMergeMode: prefs.atmMergeMode,
    geoAlpha: prefs.geoAlpha,
    atmAlpha: prefs.atmAlpha,
  })

  // Flipped by the real loop taking over, which is what stops the idle frames.
  let live = false
  const idleSpectrum = new Uint8Array(256)
  const idleStart = performance.now()

  // Capped well below the display's own rate, and stopped outright once nobody
  // is there to see it. The idle preview (build 63) put the visualiser behind
  // the gate so the screen would not be a poster for an absent piece — but it
  // also meant a gate left open now costs what running the app costs, on a
  // phone, indefinitely, which was a real change in idle power draw introduced
  // as a side effect and never paid for. The decision logic itself lives in
  // idle-preview.ts, and is probed there — see scripts/probe-idle.ts.
  const idle = new IdlePreview(idleStart, 1000 / 30, 60_000)

  // Any touch or pointer move brings the picture back. Stopping outright and
  // never resuming would leave a phone picked back up after a minute showing
  // one frozen frame — indistinguishable from a crash on a screen whose entire
  // point is that it is already alive.
  const resumeIdle = (): void => {
    if (live) return
    const wasStopped = idle.isStopped
    idle.touch(performance.now())
    if (wasStopped) requestAnimationFrame(idleFrame)
  }
  document.addEventListener('pointerdown', resumeIdle)
  document.addEventListener('pointermove', resumeIdle)

  const idleFrame = (now: number): void => {
    if (live) return
    if (idle.tick(now)) {
      const t = (now - idleStart) / 1000
      visualiser.render(idleParams(t, idleSpectrum), idleSpectrum)
    }
    // isStopped is read after tick(), which is what may have just set it —
    // this is the line that actually saves the battery: no further frame is
    // scheduled at all, not merely one that renders nothing.
    if (!idle.isStopped) requestAnimationFrame(idleFrame)
  }
  requestAnimationFrame(idleFrame)

  const { source, motion } = await waitForStart({ gate, button, error })
  live = true
  // The idle loop is done for the session; its own listeners are now dead
  // weight on every pointer event for as long as the tab stays open.
  document.removeEventListener('pointerdown', resumeIdle)
  document.removeEventListener('pointermove', resumeIdle)
  // The gate is going; the version chip drops to its running form — no name,
  // and a reload button that fades out of the way. See versionHudRunning().
  versionHudRunning()
  void keepAwake()

  const shake = startShake(motion)

  /** Roll a new picture and let the panel adopt it, so the HUD opened
   *  afterwards shows what is actually on screen rather than what was. */
  const shuffle = (): void => {
    const next = shuffled(prefs)
    panel.adopt(next)
    visualiser.randomise()
  }
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
    onColour: (layer, colour) => visualiser.setLayerColour(layer, colour),
    onAtmosphericView: (name: AtmosphericViewName) => visualiser.setAtmosphericView(name),
    onMergeMode: (layer, mode: MergeModeName) => visualiser.setMergeMode(layer, mode),
    onAlpha: (layer, a) => {
      if (layer === 'geo') visualiser.setGeoAlpha(a)
      else visualiser.setAtmAlpha(a)
    },
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
      // Order matters: a double is also a strong, and the second shake set both
      // flags. Reading the double first means the escalation wins and the
      // re-seed does not also fire — a shuffle that re-seeded on top of itself
      // would be the same picture change twice.
      if (shake.takeDouble()) {
        if (prefs.showStats) flashShake(true)
        shuffle()
        // A shake is a manual gesture. The autopilot standing down is the same
        // courtesy every HUD control gets, and without it the director could
        // start walking the views back a moment later.
        director.suspend()
        doubleBuzz()
      } else if (shake.takeStrong()) {
        if (prefs.showStats) flashShake(false)
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
