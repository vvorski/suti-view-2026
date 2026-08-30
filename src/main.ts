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
import { createTouchField, MAPPINGS, toShaderUv, type Mapping, type MappingName, type VisualParams } from './engine'
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
import { mountPowder } from './powder'
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
    gravity: false,
    day: false,
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
    // The autopilot is unconditional now (docs/todo.md entry 45) and nothing
    // reads this field to decide whether it runs any more — it survives here
    // only because the stored-shape rule keeps a field once added. `?auto=`
    // is handled separately, in main(), precisely so it never gets merged
    // into this object and saved back the next time an unrelated control
    // calls save() — see the comment there.
    autopilot: stored.autopilot,
    // `?debug` is deliberately NOT merged in here any more — docs/todo.md
    // entry 31. This field is "the setting this person chose", full stop;
    // what a `?debug` load shows on screen is a separate, per-load session
    // value the HUD tracks itself, passed to createHud below rather than
    // folded into a Prefs field that gets written back to storage.
    showStats: stored.showStats,
    // No URL parameter, deliberately — this changes the picture's motion at
    // rest rather than its appearance, and every parameter here today is the
    // latter. Reached from the HUD like autopilot and the numeric readout.
    gravity: stored.gravity,
    // No URL parameter either, for the same reason gravity has none — a
    // shared link is about what to show, not what the room looks like on
    // the far end. Reached from the HUD chip.
    day: stored.day,
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
 *  the numbers. Below the re-seed (docs/todo.md entry 35) the four
 *  continuous quantities — both layers' colours and opacities — only
 *  *nudge* from wherever they already are; a full re-roll from scratch
 *  joins the re-seed at SHUFFLE_RESEED, since replacing the palette
 *  outright is not the smallest change the ladder can make. */
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
 *   any qualifying shake   both layers' colours and opacities *nudge*
 *                          (this function only — see entry 35)
 *   0.30                   colours and opacities *re-roll* from scratch,
 *                          + re-seed (the caller's own job — see shuffle())
 *   0.45                   + both merge modes
 *   0.70                   + both views
 *   0.90                   + opacity re-rolls again (span, not nudge),
 *                          mapping, the camera layer's colour
 *
 * Colours used to have no threshold check at all, which sounds the same as
 * "always" but is not: the *re-seed* was what actually had no threshold
 * (`shuffle()` called `visualiser.randomise()` unconditionally, outside
 * every depth test below), and a re-seed replaces the arrangement entirely
 * while keeping only the palette and the view — the biggest change the
 * ladder can make, sitting where the smallest one belongs. Entry 29 gives
 * the re-seed its own threshold (`SHUFFLE_RESEED`, 0.30 — above the old
 * colour boundary, so a shake that used to re-seed silently now shifts the
 * palette instead) and puts colours at the true bottom of the ladder.
 *
 * A full re-roll is still the biggest change *that* rung can make, though —
 * nothing of the palette survives it. Entry 35 makes the true bottom rung a
 * *perturbation* instead: below SHUFFLE_RESEED, `geoColour`, `atmColour`,
 * `geoAlpha` and `atmAlpha` each move a little from their current value
 * (`current`, below) rather than being replaced, so the gentlest qualifying
 * shake shifts the picture you have rather than handing you a different
 * one. The full re-roll moves up to join the re-seed at SHUFFLE_RESEED,
 * which is the one rung it was always meant to share — nothing of the
 * palette surviving is exactly what a re-seed already does to everything
 * else.
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
 *
 * Entry 35's nudge below SHUFFLE_RESEED clamps to these same two floors,
 * not a nudge-specific pair — repeated light shakes are a random walk, and
 * a walk with no floor eventually reaches entry 21's failure by a slower
 * road: twenty small steps down reach black exactly as one big one does.
 */
const SHUFFLE_MIN_ALPHA = 0.5
const SHUFFLE_MIN_DOMINANT_CHANNEL = 0.5

/** How far a light shake may nudge a colour channel or an opacity from its
 *  current value — docs/todo.md entry 35. Absolute, not scaled by `depth`:
 *  `pnpm probe:shake`'s own gentle-sustained cases report a depth of
 *  exactly 0.00, so anything multiplied by depth would be multiplied by
 *  zero at precisely the shake this entry is about. The nudge has to be a
 *  floor, not a fraction. **Mine** — the entry asks for "a little" without
 *  naming the two numbers. */
const NUDGE_CHANNEL = 0.08
const NUDGE_ALPHA = 0.06

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

function shuffled(
  depth: number,
  current: { geoColour: GeoColour; atmColour: GeoColour; geoAlpha: number; atmAlpha: number },
): Shuffle {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]
  const channel = (): number => 0.2 + Math.random() * 0.8

  // Only the channel that already leads is lifted, not all three — scaling
  // every channel toward a floor washes each dim roll toward grey and
  // quietly removes half the palette this exists to explore. Lifting just
  // the one that already dominates keeps the hue the roll chose and only
  // adds strength to it. Shared by a fresh roll and a nudge alike, since
  // both can land with no channel above the floor.
  const floorDominant = (c: GeoColour): GeoColour => {
    const dominant = Math.max(c.r, c.g, c.b)
    if (dominant >= SHUFFLE_MIN_DOMINANT_CHANNEL) return c
    if (c.r === dominant) return { ...c, r: SHUFFLE_MIN_DOMINANT_CHANNEL }
    if (c.g === dominant) return { ...c, g: SHUFFLE_MIN_DOMINANT_CHANNEL }
    return { ...c, b: SHUFFLE_MIN_DOMINANT_CHANNEL }
  }
  const colour = (): GeoColour => floorDominant({ r: channel(), g: channel(), b: channel() })

  // A little from wherever the channel already is, clamped to the same
  // [0.2, 1] a fresh roll lives in — entry 35's bottom rung.
  const nudgeChannel = (v: number): number => clamp(v + (Math.random() * 2 - 1) * NUDGE_CHANNEL, 0.2, 1)
  const nudgeColour = (c: GeoColour): GeoColour =>
    floorDominant({ r: nudgeChannel(c.r), g: nudgeChannel(c.g), b: nudgeChannel(c.b) })
  const nudgeAlpha = (a: number): number => clamp(a + (Math.random() * 2 - 1) * NUDGE_ALPHA, SHUFFLE_MIN_ALPHA, 1)

  const next: Shuffle = {}
  if (depth >= SHUFFLE_RESEED) {
    // The full re-roll, exactly as it was before entry 35 — this rung
    // already replaces the arrangement via the re-seed, so replacing the
    // palette outright belongs here rather than at the bottom.
    next.geoColour = colour()
    next.atmColour = colour()
  } else {
    // Entry 35's own point: below the re-seed, the picture you have shifts
    // rather than being replaced.
    next.geoColour = nudgeColour(current.geoColour)
    next.atmColour = nudgeColour(current.atmColour)
    next.geoAlpha = nudgeAlpha(current.geoAlpha)
    next.atmAlpha = nudgeAlpha(current.atmAlpha)
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
 * The diagnostic, not the feedback — docs/todo.md entry 54 adds
 * `shakePulse()` below as the confirmation everyone gets, always on; this
 * one stays exactly as it is, gated and full-screen, for the debugging job
 * it already does well. The two now sit next to each other and the
 * difference is not obvious from the names alone, so: this is for someone
 * who already suspects a bug and turned the readout on to look for one;
 * `shakePulse()` is for someone who just shook the phone and wants to know
 * it heard them.
 *
 * Built for one report: "the shake isn't working, no double detection" — with
 * nothing to check it against but the eye. `probe:shake` passes every
 * synthetic case for both single and double, and `main.ts` calls `takeDouble`
 * correctly, so nothing in the code points at a bug. What is missing is the
 * one thing a probe cannot supply: whether *anything* is firing on this
 * particular phone at all, and if so, which kind.
 *
 * Gated on `panel.showingStats()` rather than a second `?debug` flag — that
 * already means "diagnostics are visible" and a flash on every shake once
 * this ships permanently would turn a quiet instrument into a strobe. Reads
 * the HUD's own session value rather than `prefs.showStats` directly, so a
 * `?debug` load gets the flash for that load without it persisting past a
 * reload — see docs/todo.md entry 31.
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

/** Faintest and boldest a shake pulse's edge ever gets — docs/todo.md
 *  entry 54. `intensity()` is 0 at the gentlest qualifying shake and 1 at
 *  PEAK_CEILING, and 0 opacity would mean the gentlest shake that counts
 *  produces no confirmation at all — the exact failure this entry exists
 *  to close. **Mine**, no value named in the entry beyond "scale with
 *  depth". */
const PULSE_MIN = 0.15
const PULSE_MAX = 0.9

/**
 * The always-on confirmation that a shake was accepted — docs/todo.md
 * entry 54. `#shake-flash` above is the diagnostic (gated behind the
 * numeric readout); this is the feedback, ungated, for the same two calls
 * (`takeStrong()`/`takeDouble()`) — never for mere disturbance, which the
 * tumble already answers continuously. `peak` sets `--pulse-amt` via
 * `intensity()`, the same normaliser the buzz and the shuffle's depth
 * already share, so a light shake gets a faint edge and a hard one an
 * unmistakable one.
 *
 * A DOM overlay outside the canvas, like `#shake-flash` and the capture
 * glyph: it must be visible even if the render path is the thing broken,
 * and a screenshot (which reads the canvas) can never contain it.
 */
function shakePulse(double: boolean, peak: number): void {
  const el = document.getElementById('shake-pulse')
  if (!el) return
  const amt = PULSE_MIN + (PULSE_MAX - PULSE_MIN) * intensity(peak)
  el.style.setProperty('--pulse-amt', String(amt))
  el.classList.remove('on', 'double')
  // Restart the animation even if one is already mid-flight — the same
  // reflow trick flashShake's double path uses, needed here for both
  // shapes since an animation (unlike shake-flash's transition-driven
  // `.on`) does not restart just by re-adding a class that was never
  // removed for a frame.
  void el.offsetWidth
  el.classList.add(double ? 'double' : 'on')
}

/**
 * A camera glyph confirming a screenshot was saved, fading within about
 * half a second — docs/todo.md entry 41. Not `#shake-flash`'s white `.on`
 * fade, which this used to reuse: with the readout on, a single shake and
 * a capture produced the exact same full-screen white flash, which is
 * indistinguishable at exactly the moment someone is trying to tell them
 * apart. A distinct glyph fixes that and reads more clearly now that the
 * capture zone is a third of the screen rather than a fifteenth of it.
 *
 * Never gated behind `showStats`, unlike flashShake: this is feedback for
 * an action just taken, not a diagnostic. A DOM overlay outside the
 * canvas, so it can never end up in the saved PNG — the capture reads the
 * canvas, drawn and read before this is ever called.
 */
function flashCapture(): void {
  const el = document.getElementById('capture-flash')
  if (!el) return
  el.classList.add('on')
  requestAnimationFrame(() => el.classList.remove('on'))
}

// The three zones this used to carve the screen into — CAPTURE_BAND_FRACTION,
// safeBottomInset() and zone() — are retired by docs/todo.md entry 52: a
// single tap now saves and a double opens, anywhere on the screen, with no
// region either belongs to. See dispatchTouches() below.

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

  // docs/todo.md entry 45: the autopilot is unconditional now, and
  // `prefs.autopilot` is kept only as a stored-shape fact, no longer
  // consulted below. `?auto=0` (or `off`) is the one way left to run with it
  // off, and read straight from the URL rather than merged into `prefs` —
  // see the comment on that field in resolvePrefs() — so a session that asks
  // for it can never leak the choice into storage via an unrelated save().
  const autoParam = new URLSearchParams(window.location.search).get('auto')
  const autoOverrideOff = autoParam === '0' || autoParam === 'off'

  // Built before the gate resolves, not after.
  //
  // The start screen used to be a page *about* the piece — a title, a button
  // and some invented decoration standing in for what the app does. It can
  // simply be the piece instead, running quietly behind the words, because
  // nothing about the renderer needs the microphone: it needs numbers, and
  // idleParams() below makes plausible ones. The gate becomes an overlay on
  // something real rather than a poster for something absent.
  //
  // docs/todo.md entry 60: the poster it stands in front of is rolled fresh
  // on every load — colours, both views, both merge modes, via the same
  // shuffled() a shake already uses — rather than showing whatever was last
  // stored, forever. This is `shuffled()` called directly, never through
  // `panel.adopt()`: adopt() writes to `prefs` and calls `save()`, and the
  // whole point here is a look nobody's picture actually has. `current` is
  // passed only to satisfy the signature — at SHUFFLE_VIEWS every field it
  // reads is above SHUFFLE_RESEED, so `shuffled()` takes the full-reroll
  // branch and never looks at it. A `?rgb` link keeps the colour it names —
  // the roll is skipped outright rather than carved around just that one
  // field, since "the gate shows your stored picture" is exactly correct
  // for a link that asked for a specific one. **Mine.**
  const rgbRequested = parseGeoColour(new URLSearchParams(window.location.search).get('rgb')) !== null
  const gateLook = rgbRequested
    ? null
    : shuffled(SHUFFLE_VIEWS, {
        geoColour: prefs.geoColour,
        atmColour: prefs.atmColour,
        geoAlpha: prefs.geoAlpha,
        atmAlpha: prefs.atmAlpha,
      })
  const visualiser = createVisualiser(canvas, {
    geometricView: gateLook?.geometricView ?? prefs.geometricView,
    geoColour: gateLook?.geoColour ?? prefs.geoColour,
    atmColour: gateLook?.atmColour ?? prefs.atmColour,
    camColour: prefs.camColour,
    atmosphericView: gateLook?.atmosphericView ?? prefs.atmosphericView,
    mergeMode: gateLook?.mergeMode ?? prefs.mergeMode,
    atmMergeMode: gateLook?.atmMergeMode ?? prefs.atmMergeMode,
    geoAlpha: prefs.geoAlpha,
    atmAlpha: prefs.atmAlpha,
    day: prefs.day,
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

  // The powder easter egg — docs/todo.md entry 46. Wired here, before Start,
  // since the entry's whole point is a secret found on the screen everyone
  // sees first, not a mode reachable only after the app has already started.
  // `() => shake.tilt()` closes over the `let` above rather than its value at
  // this point, so it keeps reading whichever sensor `shake` is reassigned to
  // once the gate's own motion permission resolves.
  //
  // docs/todo.md entry 61 widens this from tilt alone to tilt plus disturb
  // plus a shake's scatter impulse — one motion source, still, per the
  // module's own comment on why it takes a getter rather than a sensor
  // reference. `disturb` and `strongPeak` are read from the two variables
  // below rather than calling into `shake` directly: `shake.frame()` and
  // `shake.takeStrong()` both consume state (a decaying peak, a one-shot
  // pending flag) and idleFrame below is already their one and only caller,
  // every tick, whether or not the powder is up. A second caller reading
  // `shake` here — on the powder's own, separate animation loop — would race
  // idleFrame's for whichever fires first in a tick, and the loser would see
  // nothing. `pendingScatterPeak` is cleared on read, right here, so a shake
  // taken while the powder is idle-ticking but its own rAF hasn't yet run
  // cannot be applied twice.
  let currentDisturb = 0
  let pendingScatterPeak = 0
  const powder = mountPowder(() => {
    const strongPeak = pendingScatterPeak
    pendingScatterPeak = 0
    return { tilt: shake.tilt(), disturb: currentDisturb, strongPeak }
  })
  let stopGateTaps: () => void = () => {}
  {
    // Each tap has to land within this many milliseconds of the one before
    // it to count toward the three — **Mine**, matching the entry's own
    // number for the trigger.
    const TAP_WINDOW_MS = 600
    let tapCount = 0
    let lastTapAt = 0
    // On `document`, not `#gate` — "getting out" is the same three taps
    // (Decided), landing on `#powder-canvas` while the gate is hidden, which
    // is a DOM sibling of `#gate` rather than a descendant of it. A listener
    // scoped to `#gate` would never see them once `#gate` is
    // `display:none`, since a real tap cannot land on an element that is not
    // rendered — only a synthetic, script-dispatched one can, which is how
    // this gap first went unnoticed. `#version-hud` needs an explicit
    // exclusion here that it did not need when the listener lived on
    // `#gate`, for the same reason: it is a sibling, not a descendant, so it
    // is not excluded "for free" by scoping any more.
    //
    // Removed the instant Start resolves (see below) — a `document`-level
    // tap counter left running into the real session would mean three quick
    // taps on the running picture itself (a thing entries 41/48/50 all make
    // completely ordinary) could summon an easter egg mid-session. The
    // powder is a fact about the gate, not about the app.
    const onGateTap = (e: PointerEvent): void => {
      // Every other control on this screen has the same claim to its own
      // taps as Start does — a `closest()` test rather than a coordinate
      // box, so this cannot drift when a later entry moves one of them
      // around, and it applies in both directions: reload must not count
      // toward either entering or leaving the powder.
      if (e.target instanceof Element && e.target.closest('#start, #share, #qr, #version-hud')) return
      const now = performance.now()
      tapCount = now - lastTapAt <= TAP_WINDOW_MS ? tapCount + 1 : 1
      lastTapAt = now
      if (tapCount === 3) {
        tapCount = 0
        powder.toggle()
        // "Swap the gate for a black field" is two elements changing
        // together, not one: `#gate`'s own z-index (10) sits above
        // `#powder`'s (6) so the black field would otherwise render
        // underneath it, fully hidden, rather than replacing it. Hiding
        // the gate rather than tearing it down is what makes "leaving must
        // be exact" (Decided) free — there is nothing here to rebuild.
        gate.hidden = powder.active
        // docs/todo.md entry 61: the third tap is itself a live user gesture,
        // so requestFullscreen() is allowed here — this is not one of the
        // dialog-opening calls permission-gate.ts's own comment warns against
        // spending the gesture on. Only on the way in: leaving the egg does
        // not leave fullscreen (Decided, Mine), so there is no matching
        // exitFullscreen() call on the other branch of this toggle.
        if (powder.active) goFullscreen()
      }
    }
    document.addEventListener('pointerup', onGateTap)
    stopGateTaps = () => document.removeEventListener('pointerup', onGateTap)
  }

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
      // walk into for reasons they cannot connect to anything they did.
      // `takeDouble()` is still consumed and discarded — not left to fire the
      // instant the real loop starts reading it after Start. `takeStrong()`
      // is docs/todo.md entry 61: routed into `pendingScatterPeak` rather
      // than discarded, so the powder (the only thing on screen that can act
      // on a shake before Start) gets it instead of it vanishing into a
      // picture nobody watching the powder can see change.
      const dt = (now - lastGateShakeAt) / 1000
      lastGateShakeAt = now
      const tumble = shake.frame(dt)
      currentDisturb = tumble.disturb
      visualiser.setTumble(tumble, prefs.gravity ? shake.gravity() : undefined)
      pendingScatterPeak = shake.takeStrong()
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
  // docs/todo.md entry 60: undo whatever the gate rolled. `visualiser` is the
  // same instance the gate was just showing, and if it rolled a look, this is
  // the one place that look is thrown away — restoring exactly what `prefs`
  // (the stored values, `?rgb` included) says, before anything else can read
  // the visualiser's current state. Unconditional rather than gated on
  // `gateLook`, so this stays correct even if a future change adds another
  // path that mutates the gate's visualiser before Start.
  visualiser.setGeometricView(prefs.geometricView)
  visualiser.setAtmosphericView(prefs.atmosphericView)
  visualiser.setLayerColour('geo', prefs.geoColour)
  visualiser.setLayerColour('atm', prefs.atmColour)
  visualiser.setMergeMode('geo', prefs.mergeMode)
  visualiser.setMergeMode('atm', prefs.atmMergeMode)
  // The idle loop is done for the session; its own listeners are now dead
  // weight on every pointer event for as long as the tab stays open.
  document.removeEventListener('pointerdown', resumeIdle)
  document.removeEventListener('pointermove', resumeIdle)
  // The powder easter egg is a fact about the gate, not about the running
  // app — docs/todo.md entry 46. Its tap counter goes with the gate rather
  // than living on into the session, where three quick taps on the running
  // picture are something entries 41/48/50 all make completely ordinary.
  stopGateTaps()
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
   *  was. Below SHUFFLE_RESEED the four continuous quantities nudge from
   *  whatever `panel.current()` reports rather than being replaced — entry
   *  35 — which is why `shuffled()` needs to read them fresh on every call
   *  rather than being handed a value that could go stale between shakes.
   *  The seed only re-rolls once SHUFFLE_RESEED is reached — see
   *  shuffled()'s own file comment for why the two used to be backwards
   *  from each other. */
  const shuffle = (depth: number): void => {
    const next = shuffled(depth, panel.current())
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
    onDayMode: (on) => visualiser.setDayMode(on),
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
  }, new URLSearchParams(window.location.search).has('debug'))

  bindKeyboard({
    onRandomise: () => visualiser.randomise(),
  })

  // One recogniser for every gesture on the picture — docs/todo.md entries
  // 41, 33, 48, 49, 50 and 57. Two separate listeners in two files used to agree only
  // because the screenshot band listened in the capture phase and called
  // stopPropagation() before hud.ts's own bubble-phase tap-to-open listener
  // ran. hud.ts no longer listens for that tap at all; this decides
  // tap-versus-hold-versus-drag once and dispatches by zone, so where a
  // gesture goes is a value read in one place rather than a race reasoned
  // about after the fact — and no path needs stopPropagation() any more.
  //
  // Entry 49 put every pointer behind engine/touches.ts's field rather than
  // this file's own scalars — `downX`/`downY`/`downZone`/`emitting` are gone,
  // replaced by whatever the field reports for each id. What follows is a
  // capacity change, not a behaviour one: a single finger reads the same
  // per-touch facts a scalar recorded before, and gets the same answer.
  //
  // The emitter used to be scoped to the top third only, and only past a
  // hold/drag threshold that separated it from a tap — entry 33's original
  // shape, reconciled against entry 41's three zones. Entry 50 overturns
  // both: with the panel now owning only the middle third, a threshold in
  // the other two zones was protecting nothing, and every zone answers a
  // contact immediately now — see dispatchTouches() below.
  const isChip = (t: EventTarget | null): boolean => t instanceof Element && t.closest('.hud-chip') !== null

  const touchField = createTouchField()

  // Contact ids for the geometric emitter's pool (scene.ts) — docs/todo.md
  // entry 57. `touchField`'s own id is a *pointer* id, which the platform
  // can reuse across two separate taps of the same finger (lift, then tap
  // again); minted fresh on every qualifying `down` instead, so a pointer
  // id being reused never reads as "the same contact continuing" to the
  // emitter pool. Cleared on `up`/`cancel` — the id itself lives on inside
  // scene.ts's pool for as long as that emitter's afterlife runs, but
  // nothing here needs to remember it once the pointer is gone.
  let nextContactId = 0
  const contactIdFor = new Map<number, number>()

  document.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect()
    const [x, y] = toShaderUv(e.clientX, e.clientY, rect)
    // A chip button's own listener already stopPropagation()s its own
    // pointerup, which is enough in the ordinary case — but a release that
    // lands a pixel outside the button (a real touchscreen possibility) has
    // a different target, so that stopPropagation() never fires and this
    // recogniser would see the release regardless. Excluding by target on
    // the way in — docs/todo.md entry 42, written for the fullscreen chip
    // specifically once it moved into the panel-opening middle third — is
    // what closes that gap for every chip, not only that one.
    //
    // The zone argument is a fixed '' now that entry 52 has retired the
    // three screen thirds it used to carry — touches.ts's own field API is
    // untouched by that entry, so the parameter stays, carrying nothing.
    touchField.down(performance.now() / 1000, e.pointerId, x, y, e.clientX, e.clientY, isChip(e.target), '')
  })
  document.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect()
    const [x, y] = toShaderUv(e.clientX, e.clientY, rect)
    touchField.move(performance.now() / 1000, e.pointerId, x, y, e.clientX, e.clientY)
  })
  document.addEventListener('pointerup', (e) => touchField.up(e.pointerId))
  document.addEventListener('pointercancel', (e) => touchField.cancel(e.pointerId))
  // A lost capture (another element or the browser chrome stealing it
  // mid-drag) is not followed by pointerup or pointercancel on this target
  // — the same "handed between people" scenario entry 49's field is built
  // to survive.
  document.addEventListener('lostpointercapture', (e) => touchField.cancel(e.pointerId))

  // A single tap saves a frame; a double opens the panel — docs/todo.md
  // entry 52, retiring entry 41's three screen zones. The two used to be
  // told apart by *where* a tap landed; now they are told apart by *time*,
  // which is the harder problem entry 41 (and, before it, the deleted
  // gestures.ts) tried and failed to solve: a zero-delay tap-to-open
  // listener always wins a race against a second tap that has not arrived
  // yet, so the panel used to pre-empt every double before it could be
  // recognised. The fix is structural, not a smarter race: whatever sits on
  // the *single* has to tolerate a delay, because a single is only knowable
  // once the double's window has passed without a second tap — and a save
  // can tolerate that in a way a menu never could. Play is untouched by any
  // of this: entry 50's emitter still fires on the raw `down`, immediately,
  // never waiting on or cancelled by what a tap resolves to.
  //
  // One window serves both purposes by construction, rather than two
  // separately-tuned numbers: a second qualifying tap arriving before
  // TAP_RESOLVE_MS has elapsed, and close enough to the first, pre-empts
  // the pending single and opens the panel instead; if none arrives, the
  // same timer firing *is* what commits the first tap as a single and
  // saves. **Mine** — the entry names 280ms for the save delay and 30px
  // for the double's radius, but never a separate "how long may the second
  // tap be late" figure, and there is no natural second number: the delay
  // a single must tolerate and the window a double must arrive inside are
  // the same wait looked at from either end of it.
  const TAP_RESOLVE_MS = 280
  const DOUBLE_TAP_RADIUS_PX = 30
  // "One save per 700ms, silently dropping the rest" (Decided) — a run of
  // taps should not write a run of near-identical PNGs to the camera roll.
  const SAVE_RATE_LIMIT_MS = 700

  // A list, not a single slot: "ten taps in five seconds save no more than
  // seven frames" (Done-when) only holds if each tap not close enough to
  // pair with another gets its *own* independent 280ms timer, rate-limited
  // only by SAVE_RATE_LIMIT_MS — not silently dropped because a later,
  // unrelated tap happened to land somewhere else on the screen first.
  interface PendingTap {
    x: number
    y: number
    timer: number
  }
  const pendingTaps: PendingTap[] = []
  let lastSaveAt = -Infinity

  const resolveTap = (clientX: number, clientY: number): void => {
    const matchIndex = pendingTaps.findIndex(
      (p) => Math.hypot(clientX - p.x, clientY - p.y) <= DOUBLE_TAP_RADIUS_PX,
    )
    if (matchIndex !== -1) {
      // The match's own timer firing is what would have committed it as a
      // single — arriving here at all means it has not fired yet, so being
      // inside its own window is implicit and needs no separate check.
      const [match] = pendingTaps.splice(matchIndex, 1)
      window.clearTimeout(match.timer)
      panel.open()
      return
    }
    const entry: PendingTap = { x: clientX, y: clientY, timer: 0 }
    entry.timer = window.setTimeout(() => {
      const i = pendingTaps.indexOf(entry)
      if (i !== -1) pendingTaps.splice(i, 1)
      if (performance.now() - lastSaveAt >= SAVE_RATE_LIMIT_MS) {
        lastSaveAt = performance.now()
        saveCapture(visualiser)
      }
    }, TAP_RESOLVE_MS)
    pendingTaps.push(entry)
  }

  /**
   * The tap/hold-vs-drag decision for the emitter, and the single/double
   * tap dispatch — docs/todo.md entries 41, 33, 48, 49, 50, 52 and 57.
   * Called once per rendered frame from frame() below, which is what
   * "sampled, not callback-driven" (touches.ts's own file comment) means in
   * practice: every consumer of the field, this dispatch included, reads it
   * on the same clock the picture itself redraws on rather than keeping its
   * own timers.
   */
  const dispatchTouches = (now: number): void => {
    const hudOpen = document.querySelector('.hud-scrim.open') !== null

    // Drained once, read twice below — minting/clearing contact ids first,
    // so the sample pass that follows always has an id ready for a contact
    // that began on this exact frame. events() only ever drains in the
    // order things happened, so a down always precedes any up for the same
    // id within one call.
    const events = touchField.events()
    for (const e of events) {
      if (e.kind === 'down') {
        if (!e.onChip) contactIdFor.set(e.id, nextContactId++)
        continue
      }
      contactIdFor.delete(e.id)
    }

    // docs/todo.md entry 50: no threshold, every zone — a contact emits the
    // instant it begins, wherever it lands, as long as it isn't a chip's
    // own tap and the HUD isn't covering the picture. Entry 41's own
    // zone-and-threshold logic for what a *release* does (save, open the
    // panel) is untouched, further down — this is a second, independent
    // thing every contact does, not a replacement for that dispatch.
    const active: { contactId: number; x: number; y: number; speed: number }[] = []
    // Any `.hud-chip` contact never reaches either stream below — a chip's
    // own tap is that chip's gesture, not one that reaches the picture
    // underneath. Also inert while the HUD is open — a HUD control's own
    // drag already stopPropagation()s before it ever reaches this field,
    // but a tap on the scrim itself (closing the panel) would not, and the
    // picture is hidden behind the panel at that moment regardless.
    //
    // Entry 48's own capture-band exclusion is gone along with the zone it
    // was defined against (entry 52): the touch stream's own contribution
    // can now land in a saved frame exactly as entry 50 already made the
    // geometric emitter's ring do, for the same reason stated there — it is
    // picture, not UI, and a save can now happen from any tap rather than
    // only ones landing in a fixed band this file no longer has a way to
    // name. **Mine**, since entry 52's own text does not mention the touch
    // stream at all; leaving the old exclusion in would have needed a
    // "was this the tap that is about to save" fact that is not knowable
    // until 280ms after the fact, which the render loop cannot wait for.
    let streamAnyDown = false
    let streamMaxSpeed = 0
    for (const t of touchField.sample(now)) {
      const speed = Math.hypot(t.vx, t.vy)
      if (!t.onChip && !hudOpen) {
        streamAnyDown = true
        streamMaxSpeed = Math.max(streamMaxSpeed, speed)
      }
      if (t.onChip || hudOpen) continue
      const contactId = contactIdFor.get(t.id)
      // Absent only for a chip contact (never minted one) reaching here by
      // a stale id, which should not happen given the exclusion above —
      // defensive rather than load-bearing.
      if (contactId === undefined) continue
      active.push({ contactId, x: t.x, y: t.y, speed })
    }
    visualiser.setTouches(active)

    let streamBegan = false
    for (const e of events) {
      if (e.kind === 'down') {
        if (!e.onChip && !hudOpen) streamBegan = true
        continue
      }
      // A cancelled contact (pointercancel, lostpointercapture) is never a
      // tap — only a clean release can be, exactly as before this entry.
      if (e.kind !== 'up') continue
      if (e.onChip) continue
      // Inert while the HUD is open: the panel owns the screen then, and a
      // tap here is what closes it (the scrim's own listener in hud.ts).
      if (hudOpen) continue
      // Defensive rather than load-bearing: dispatchTouches only ever runs
      // after Start (frame() is not scheduled before it), so the gate
      // should already be gone by the time a tap can reach here — kept in
      // case a fade is still mid-flight, the same guard the zone dispatch
      // this replaces already carried.
      const gate = document.getElementById('gate')
      if (gate && !gate.hidden) continue
      // The tap-versus-drag distinction entry 50 explicitly names as not
      // loosened: a release far from where the contact began is a
      // completed drag, not a tap, and must not save or open regardless of
      // where on screen it ends.
      if (Math.hypot(e.clientX - e.downClientX, e.clientY - e.downClientY) > TAP_SLOP_PX) continue
      resolveTap(e.clientX, e.clientY)
    }

    visualiser.setTouchStream(streamBegan, streamAnyDown, streamMaxSpeed)
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
      if (!autoOverrideOff) {
        const next = director.update(character, audio.dt, {
          geoColour: prefs.geoColour,
          atmosphericView: prefs.atmosphericView,
        })
        if (next) panel.adopt(next)
      }

      const tumble = shake.frame(audio.dt)
      visualiser.setTumble(tumble, prefs.gravity ? shake.gravity() : undefined)
      // docs/todo.md entry 58 — posture and disturbance reaching the
      // picture's colour. Only the running loop, not the idle preview
      // above: that draws synthetic params and a preview colour rather
      // than anything the shuffle/director/HUD have actually stored, and
      // every Done-when here describes the running app.
      const tilt = shake.tilt()
      visualiser.setMotion(tilt.x, tilt.y, tumble.disturb)
      dispatchTouches(performance.now() / 1000)
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
          if (panel.showingStats()) flashShake(true)
          shakePulse(true, doublePeak)
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
          if (panel.showingStats()) flashShake(false)
          shakePulse(false, strongPeak)
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
