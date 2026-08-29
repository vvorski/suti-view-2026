/**
 * Bootstrap and render loop.
 *
 * The two layers, the merge mode, the mix, and the audio mapping are all
 * swappable at runtime, from the control panel or from the URL. URL
 * parameters win over stored preferences, so a link can pin a specific
 * combination without permanently changing what the device remembers.
 */

import { bindKeyboard } from './keyboard'
import { DEFAULT_GEO_COLOUR, parseGeoColour, type GeoColour } from './geo-colour'
import { startCamera, type CameraSource } from './camera'
import { createHud, TAP_SLOP_PX } from './hud'
import { MAPPINGS, type Mapping, type MappingName, type VisualParams } from './engine'
import {
  DEFAULT_ATM_MERGE_MODE,
  DEFAULT_MERGE_MODE,
  DEFAULT_MIX,
  isMergeModeName,
  MERGE_MODES,
  type MergeModeName,
} from './merge-modes'
import {
  checkWebGL,
  fullscreenStatus,
  goFullscreen,
  keepAwake,
  onFullscreenChange,
  waitForStart,
} from './permission-gate'
import { loadPrefs, type Prefs } from './prefs'
import { applyReleaseTone } from './release-tone'
import { mountShare } from './share'
import { Director } from './director'
import { createVisualiser, type Visualiser } from './scene'
import { RELEASE_NAME } from './release-name'
import { SlowAnalysis } from './engine'
import { hasMotionPermissionGate, intensity, startShake } from './shake'
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

/** What a shuffle changes at each rung. Each rung includes everything below
 *  it — see shuffled()'s own comment for the reasoning behind the order and
 *  the numbers. Colours have no threshold of their own any more (entry 29):
 *  they roll on every qualifying shake, at the very bottom of what survives,
 *  below even the re-seed. */
const SHUFFLE_RESEED = 0.3
const SHUFFLE_MERGE = 0.45
const SHUFFLE_VIEWS = 0.7
const SHUFFLE_EVERYTHING = 0.9

/** How often the top rung also rolls the camera, and how high it may go —
 *  docs/todo.md entry 22. One in three, not always: the shuffle at this
 *  depth already changes a great deal, and raising the room every single
 *  time would make the camera read as part of the ladder's own logic rather
 *  than as the separate, licensed exception it is. Capped at 0.6, not 1 —
 *  passthrough at 1 leaves the room and no visualiser, which is not a
 *  picture the shuffle should be able to hand back. */
const CAMERA_ROLL_CHANCE = 1 / 3
const CAMERA_ROLL_MAX = 0.6

interface Shuffle {
  geometricView?: GeometricViewName
  atmosphericView?: AtmosphericViewName
  mergeMode?: MergeModeName
  atmMergeMode?: MergeModeName
  geoColour?: GeoColour
  atmColour?: GeoColour
  camColour?: GeoColour
  geoAlpha?: number
  atmAlpha?: number
  mapping?: MappingName
}

/**
 * A new picture, graded by how hard the shake that asked for it was.
 *
 * `depth` is the 0-1 scale shake.ts's `intensity()` computes from a peak —
 * see docs/todo.md entry 15. Every rung includes the ones below it, ordered
 * by how little of what you had survives: a colour shift is recognisably the
 * same picture, a view change is a different instrument.
 *
 *   any qualifying shake   both layers' colours (this function only)
 *   0.30                   + re-seed (the caller's own job — see shuffle())
 *   0.45                   + both merge modes
 *   0.70                   + both views
 *   0.90                   + opacity, mapping, the camera layer's colour
 *
 * Colours used to have no threshold check at all, which sounds the same as
 * "always" but is not: the *re-seed* was what actually had no threshold
 * (`shuffle()` called `visualiser.randomise()` unconditionally, outside
 * every depth test below), and a re-seed replaces the arrangement entirely
 * while keeping only the palette and the view — the biggest change the
 * ladder can make, sitting where the smallest one belongs. Entry 29 gives
 * the re-seed its own threshold (`SHUFFLE_RESEED`, 0.30 — above the old
 * colour boundary, so a shake that used to re-seed silently now shifts the
 * palette instead) and puts colours at the true bottom of the ladder, with
 * no threshold of their own, so the gentlest qualifying shake still visibly
 * does *something* rather than reading as a shake that did nothing.
 *
 * Opacity and mapping were excluded entirely when this was a single on/off
 * shuffle (entry 6) — opacity because a shuffle that can hand back a black
 * screen looks like a crash recoverable only by shaking at nothing, mapping
 * because it is how the picture *hears*, not what it looks like. Both are
 * back at the top rung: opacity floored at 0.5 (raised from an initial 0.35
 * by entry 21, once the *product* of opacity and colour turned out to be
 * what actually goes dark — see SHUFFLE_MIN_ALPHA's own comment) rather than
 * spanning 0-1, and mapping because at the top of the scale the ask is a
 * genuinely different instrument, not a different palette — overturning
 * entry 6's exclusion on purpose rather than by oversight.
 *
 * The camera may also be raised at the top rung — see maybeRollCamera()
 * below. This overturns what this comment used to say, and what entries 6
 * and 15 both said: that the camera could never be switched on by a
 * shuffle, "not a taste call, the capture hard stop." Licensed by Victor
 * 2026-08-29 (entry 22), narrowly: only at the top rung, only sometimes, and
 * only where permission was already granted — a `devicemotion` event
 * carries no user activation, so this can raise the level but never itself
 * ask for the camera the first time. `shuffled()` itself is unchanged by
 * this; the roll lives in `maybeRollCamera()` because it needs an async
 * permission check this function cannot make.
 *
 * A field is present only when its rung is reached, so `Hud.adopt()`'s
 * "only touch what's given" guards do the rest — a shuffle that doesn't
 * reach mapping must never re-create the live Mapping instance and discard
 * its envelope state for nothing.
 */
/**
 * A layer's actual brightness is its opacity times its colour gain's peak
 * channel (composite.frag.glsl: `base = atmosphere * uAtmAlpha *
 * uAtmColour`) — a product, not either number in isolation. Flooring each
 * independently (0.35 for opacity, 0.2 per colour channel) left the product
 * as low as 0.07, which read as the screen going dark for no reason anyone
 * could trace back to a shake. Both floors rise here, and the colour floor
 * is enforced on the *dominant* channel specifically — see colour()'s own
 * comment for why. Worst case becomes 0.5 x 0.5 = 0.25. See docs/todo.md
 * entry 21.
 */
const SHUFFLE_MIN_ALPHA = 0.5
const SHUFFLE_MIN_DOMINANT_CHANNEL = 0.5

function shuffled(depth: number): Shuffle {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]
  const channel = (): number => 0.2 + Math.random() * 0.8
  const colour = (): GeoColour => {
    const c = { r: channel(), g: channel(), b: channel() }
    const dominant = Math.max(c.r, c.g, c.b)
    if (dominant >= SHUFFLE_MIN_DOMINANT_CHANNEL) return c
    // Only the channel that already leads is lifted, not all three — scaling
    // every channel toward a floor washes each dim roll toward grey and
    // quietly removes half the palette this exists to explore. Lifting just
    // the one that already dominates keeps the hue the roll chose and only
    // adds strength to it.
    if (c.r === dominant) return { ...c, r: SHUFFLE_MIN_DOMINANT_CHANNEL }
    if (c.g === dominant) return { ...c, g: SHUFFLE_MIN_DOMINANT_CHANNEL }
    return { ...c, b: SHUFFLE_MIN_DOMINANT_CHANNEL }
  }

  // Colours roll unconditionally — the ladder's true bottom rung, below even
  // the re-seed. See this function's own file comment.
  const next: Shuffle = {
    geoColour: colour(),
    atmColour: colour(),
  }
  if (depth >= SHUFFLE_MERGE) {
    next.mergeMode = pick(Object.keys(MERGE_MODES) as MergeModeName[])
    next.atmMergeMode = pick(Object.keys(MERGE_MODES) as MergeModeName[])
  }
  if (depth >= SHUFFLE_VIEWS) {
    next.geometricView = pick(Object.keys(GEOMETRIC_VIEWS) as GeometricViewName[])
    next.atmosphericView = pick(Object.keys(ATMOSPHERIC_VIEWS) as AtmosphericViewName[])
  }
  if (depth >= SHUFFLE_EVERYTHING) {
    next.geoAlpha = SHUFFLE_MIN_ALPHA + Math.random() * (1 - SHUFFLE_MIN_ALPHA)
    next.atmAlpha = SHUFFLE_MIN_ALPHA + Math.random() * (1 - SHUFFLE_MIN_ALPHA)
    next.camColour = colour()
    next.mapping = pick(Object.keys(MAPPINGS) as MappingName[])
  }
  return next
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

/** One white flash confirming a screenshot was saved — reuses #shake-flash's
 *  `.on` fade, which already does exactly this and needs no new DOM. Unlike
 *  flashShake, never gated behind `showStats`: this is feedback for an
 *  action just taken, not a diagnostic. */
function flashCapture(): void {
  const el = document.getElementById('shake-flash')
  if (!el) return
  el.classList.remove('on', 'double')
  el.classList.add('on')
  requestAnimationFrame(() => el.classList.remove('on'))
}

/** The bottom band's height, as a fraction of the viewport — docs/todo.md
 *  entry 18. */
const CAPTURE_BAND_FRACTION = 0.15

/** `env(safe-area-inset-bottom)` has no JS equivalent; read back the custom
 *  property index.html sets from it on `:root`. */
function safeBottomInset(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')
  return parseFloat(raw) || 0
}

/** Whether a point sits in the screenshot band: the bottom
 *  CAPTURE_BAND_FRACTION of the viewport, held clear of the home indicator
 *  or gesture bar by the safe-area inset. */
function inCaptureBand(clientY: number): boolean {
  const bottom = window.innerHeight - safeBottomInset()
  const top = bottom - window.innerHeight * CAPTURE_BAND_FRACTION
  return clientY >= top && clientY <= bottom
}

/** How many captures this session has already saved. Widens the counter's
 *  own padding past 99 on its own — docs/todo.md entry 26. */
let captureCount = 0

/**
 * Save the current frame as a PNG, named with the build it came from — the
 * difference between a bug report that can be acted on and one that cannot.
 *
 * The timestamp is the phone's own local time, not UTC — the person who has
 * to find this file reads their own clock, and a name an hour off its own
 * screenshot is worse than no timestamp; nothing here is ever compared
 * across devices, so the ambiguity a local stamp introduces costs nothing.
 * It is cut to the second, not the minute a first version of this used,
 * because a tap is not a long-running job and two of them a minute apart
 * are entirely reachable. Seconds alone are still not *unique*, though —
 * two taps inside the same second are reachable too, and wall-clock time on
 * a phone is not even monotonic: a handset picking up NTP mid-session can
 * hand back an *earlier* stamp than one it already used, which no amount of
 * resolution fixes. `captureCount` is what actually guarantees a name
 * nothing else can take; the timestamp exists to make that name legible,
 * not to make it unique.
 */
function saveCapture(visualiser: Visualiser): void {
  visualiser.requestCapture((blob) => {
    if (!blob) return
    const pad = (n: number, width = 2): string => String(n).padStart(width, '0')
    const now = new Date()
    const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    captureCount++
    const stamp = `${date}-${time}-${pad(captureCount)}`
    const name = `suti-${__BUILD_NUMBER__}-${RELEASE_NAME.replace(/\s+/g, '-')}-${stamp}.png`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    // Not added to the DOM: Chrome and Firefox both fire a synthetic click
    // on a detached <a> without complaint, and this element has no reason to
    // outlive the click that triggers it.
    a.click()
    // Revoked on a delay rather than immediately: revoking before the
    // browser has actually started the download can cancel it, especially
    // on the platforms this matters most for (a slower phone under load).
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    flashCapture()
  })
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

  // Started here rather than waiting for Start, wherever nothing gates the
  // accelerometer at all — docs/todo.md entry 20. On iOS/iPadOS the same call
  // needs a live user gesture this point in the page does not have, so it is
  // skipped there (`startShake(false)` is the same harmless stub the
  // permission-refused path already uses) and replaced once the gate gesture
  // supplies its own `motion` result below. Never a fourth claimant on that
  // gesture — see permission-gate.ts's own comment on why not.
  let shake = hasMotionPermissionGate() ? startShake(false) : startShake(true)
  // Only used to turn devicemotion's own irregular cadence into a proper dt
  // for shake.frame() during the idle preview — the live loop already has
  // audio.dt for this once the real render loop takes over below.
  let lastGateShakeAt = idleStart

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
      // The tumble, and nothing else: no re-seed, no shuffle, at any
      // intensity. There is no audio yet and the idle programme is fixed, so
      // rerolling anything here would change what the person is about to
      // walk into for reasons they cannot connect to anything they did. Both
      // pending flags are still consumed and discarded — not left to fire
      // the instant the real loop starts reading them after Start.
      const dt = (now - lastGateShakeAt) / 1000
      lastGateShakeAt = now
      visualiser.setTumble(shake.frame(dt))
      shake.takeStrong()
      shake.takeDouble()
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

  // Replaces the gate's stub on iOS/iPadOS with a real sensor once the start
  // gesture's own motion result is in; everywhere else `shake` already is
  // the real thing and has been running since load, so this is a no-op.
  if (hasMotionPermissionGate()) shake = startShake(motion)

  /** Roll a new picture at the given depth and let the panel adopt it, so the
   *  HUD opened afterwards shows what is actually on screen rather than what
   *  was. The colours always roll, whatever the depth; the seed only
   *  re-rolls once SHUFFLE_RESEED is reached — see shuffled()'s own file
   *  comment for why the two used to be backwards from each other. */
  const shuffle = (depth: number): void => {
    const next = shuffled(depth)
    panel.adopt(next)
    if (depth >= SHUFFLE_RESEED) visualiser.randomise()
  }

  /**
   * At the top shuffle rung only, sometimes rolls the passthrough level,
   * including up from zero — docs/todo.md entry 22, licensed by Victor
   * 2026-08-29. This overturns what entries 6, 15 and 20 all said and
   * `shuffled()`'s own file comment used to say: the camera is *not*
   * unconditionally excluded from every rung any more, only from every
   * rung below the top one, and from ever being raised without permission
   * already granted.
   *
   * Deliberately not part of `shuffled()`, which is synchronous and pure:
   * raising the camera needs `hasCameraPermission()`'s async check first, a
   * kind of gate no other field in the shuffle has, since a `devicemotion`
   * event carries no user activation for `getUserMedia` to spend. Runs after
   * `shuffle()` rather than inside it, and updates the panel itself once
   * resolved rather than folding into the same `adopt()` call — the level
   * is not known yet when `shuffle()` returns.
   */
  function maybeRollCamera(depth: number): void {
    if (depth < SHUFFLE_EVERYTHING) return
    if (Math.random() >= CAMERA_ROLL_CHANCE) return
    void (async () => {
      const level = Math.random() * CAMERA_ROLL_MAX
      // Turning it off never needs permission — only raising it does.
      if (level > 0 && !(await hasCameraPermission())) return
      const actual = await applyPassthrough(level)
      panel.adopt({ passthrough: actual })
    })()
  }

  let mapping: Mapping = MAPPINGS[prefs.mapping]()

  // The minutes tier and the thing that acts on it. Kept out of `mapping` on
  // purpose: a mapping swap throws away several seconds of envelope state,
  // which is the right call for a fast tier and exactly the wrong one for a
  // five-minute buffer.
  const slow = new SlowAnalysis()
  const director = new Director()

  /** Held open only while passthrough is actually showing. See applyPassthrough. */
  let cameraSource: CameraSource | null = null

  /**
   * Set once a camera stream has actually opened. The shake path (entry 22)
   * reads it rather than `cameraSource` itself, because the check has to
   * survive turning the camera back off — `cameraSource` goes null the
   * moment `applyPassthrough(0)` closes the stream, but the *permission* an
   * OS prompt already granted does not, and that permission is what the
   * shake path is licensed to use.
   */
  let cameraEverGranted = false

  /**
   * Whether the camera may be raised without a live user gesture behind it —
   * only where permission already exists. `navigator.permissions.query` is
   * the real answer where supported; `cameraEverGranted` is the fallback
   * everywhere it is not (older Safari has no 'camera' permission descriptor
   * at all) and the only answer within a single session before the first
   * grant. See docs/todo.md entry 22 for why this gate exists at all: a
   * `devicemotion` event carries no user activation, so `getUserMedia`
   * called from the shake path has none either, however hard the shake was.
   */
  async function hasCameraPermission(): Promise<boolean> {
    if (cameraEverGranted) return true
    if (!('permissions' in navigator)) return false
    try {
      const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
      return status.state === 'granted'
    } catch {
      // Some engines throw for a descriptor they don't recognise rather than
      // resolving 'prompt' — 'camera' is not universally implemented.
      return false
    }
  }

  /**
   * Turning it down to nothing releases the camera outright rather than
   * leaving it running behind a zero. Holding an open stream that nothing
   * draws keeps the sensor powered and the OS camera indicator lit, which is
   * the most visible possible way to break the start gate's promise.
   *
   * Factored out of the HUD's own `onPassthrough` handler so the shake path
   * (entry 22) can call the exact same logic rather than a second copy of
   * it — the two differ only in what is allowed to call this with a
   * non-zero `mix` in the first place, which is `hasCameraPermission()`'s
   * job, not this function's.
   */
  async function applyPassthrough(mix: number): Promise<number> {
    if (mix <= 0) {
      visualiser.setPassthrough(null, 0)
      cameraSource?.close()
      cameraSource = null
      return 0
    }

    // First non-zero value is what asks, when called from the control's own
    // pointer handler — the gesture getUserMedia requires is still live
    // there. The shake path never reaches this branch without
    // hasCameraPermission() already true, so it never spends a gesture it
    // does not have.
    if (!cameraSource) {
      try {
        cameraSource = await startCamera()
        cameraEverGranted = true
      } catch {
        // Declined, or no camera. Report the truth — 0 — and let the HUD put
        // its control back rather than leaving it somewhere it is not.
        return 0
      }
    }
    visualiser.setPassthrough(cameraSource, mix)
    return mix
  }

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
    onPassthrough: applyPassthrough,
    onManualChange: () => director.suspend(),
  })

  bindKeyboard({
    onRandomise: () => visualiser.randomise(),
  })

  // The screenshot band: a tap low on the screen saves the frame instead of
  // opening the HUD. Registered on the capturing phase and *ahead* of
  // hud.ts's own tap-to-open listener in the traversal — capture always runs
  // before bubble regardless of registration order — so stopPropagation()
  // here reaches hud.ts's bubble-phase document listener before it can also
  // open the panel for the same tap. Nothing else on the page reads a raw
  // pointer gesture any more (entry 27 deleted the swipe handlers), so this
  // guard is now the *only* thing standing between a tap here and the panel
  // opening underneath it, rather than one of several competing claimants.
  {
    let bandDownX = 0
    let bandDownY = 0
    let bandDownInBand = false
    document.addEventListener(
      'pointerdown',
      (e) => {
        bandDownX = e.clientX
        bandDownY = e.clientY
        bandDownInBand = inCaptureBand(e.clientY)
      },
      true,
    )
    document.addEventListener(
      'pointerup',
      (e) => {
        // Inert while the HUD is open: the panel owns the screen then, and a
        // tap here is what closes it.
        if (document.querySelector('.hud-scrim.open')) return
        if (!bandDownInBand || !inCaptureBand(e.clientY)) return
        if (Math.hypot(e.clientX - bandDownX, e.clientY - bandDownY) > TAP_SLOP_PX) return
        e.stopPropagation()
        saveCapture(visualiser)
      },
      true,
    )
  }

  // The way back into fullscreen once it has been lost — docs/todo.md entry
  // 19. Shown only for `exited`/`refused`, never `active` (nothing to offer),
  // `unasked` (nothing has gone wrong yet) or `unsupported` (a button that
  // can never work is worse than no button). Fixed in the top-left utility
  // corner by index.html's own CSS (entry 25) rather than placed on the
  // HUD's icon arc, so this only ever toggles visibility — no positioning,
  // no resize listener, and no reserved slot on a row this chip is no
  // longer part of.
  {
    const chip = document.getElementById('fullscreen-chip')
    if (chip instanceof HTMLButtonElement) {
      const updateFullscreenChip = (): void => {
        chip.hidden = !['exited', 'refused'].includes(fullscreenStatus().state)
      }
      chip.addEventListener('pointerup', (e) => {
        // Stops here, at the target, before hud.ts's own bubble-phase
        // tap-to-open listener on `document` ever sees it — the same guard
        // every existing chip already applies in mkChip().
        e.stopPropagation()
        goFullscreen()
      })
      onFullscreenChange(updateFullscreenChip)
      updateFullscreenChip()
    }
  }

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
      // The discrete gesture stands down while the panel is open — a
      // shuffle rewrites the values someone currently has a finger on, the
      // same fault as a control lying about its state — but the tumble
      // above keeps running regardless, and both pending flags are still
      // consumed below whether or not they end up acting on anything.
      // Leaving a flag set instead would mean a shake made while editing
      // fires the instant the panel closes, with no gesture anywhere near
      // that moment. See docs/todo.md entry 20; reuses the same `.hud-scrim`
      // check the capture band above uses, rather than adding a second
      // notion of "the panel is up".
      const panelOpen = document.querySelector('.hud-scrim.open') !== null
      // Order matters: a double is also a strong, and the second shake set both
      // flags. Reading the double first means the escalation wins and the
      // re-seed does not also fire — a shuffle that re-seeded on top of itself
      // would be the same picture change twice.
      const doublePeak = shake.takeDouble()
      if (doublePeak) {
        if (panelOpen) {
          // Consumed, not acted on.
        } else {
          if (prefs.showStats) flashShake(true)
          // A double is always a full scramble, regardless of peak — see
          // shuffled()'s file comment: the deterministic route matters because
          // an accelerometer that clips low can never report a peak near
          // PEAK_CEILING, and would otherwise have no way to ask for everything.
          shuffle(1)
          maybeRollCamera(1)
          // A shake is a manual gesture. The autopilot standing down is the same
          // courtesy every HUD control gets, and without it the director could
          // start walking the views back a moment later.
          director.suspend()
          doubleBuzz(doublePeak)
        }
      } else {
        const strongPeak = shake.takeStrong()
        if (strongPeak && !panelOpen) {
          if (prefs.showStats) flashShake(false)
          // Graded: a colour shift at the gentlest qualifying shake, up to
          // everything at the hardest. shuffle() always rolls colours
          // regardless of depth, and re-seeds once SHUFFLE_RESEED is
          // reached — see its own comment.
          const depth = intensity(strongPeak)
          shuffle(depth)
          maybeRollCamera(depth)
          // The buzz is what distinguishes "the phone heard me" from "the
          // image happened to wander". Android only — see haptics.ts.
          confirmBuzz(strongPeak)
        }
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
