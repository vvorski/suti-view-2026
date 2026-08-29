/**
 * The radial control HUD.
 *
 * A 120° wedge hinged just outside the bottom-right corner of the screen —
 * where the thumb actually pivots from. One arc band per control, stacked
 * outward: geometric layer, merge mode, atmospheric layer. Swipe along a band
 * to turn it; whatever settles under the notch is selected. The innermost arc
 * is the mix.
 *
 * The band order is the compositing order, read outward: the two layers with
 * the mode that combines them physically between them. An earlier version put
 * a colour chooser in that middle slot and exiled merge inward past the
 * atmospheric band, which broke the one thing the stack is meant to say. The
 * geometric layer's colour is not a per-layer programme at all — it is a gain
 * on a finished layer — so it belongs on a button, not on a dial band.
 *
 * This replaced a bottom-sheet list of cards. The list worked, but it took the
 * whole screen to change one value, which meant you could never see the thing
 * you were adjusting actually respond. A thumb doesn't move in straight lines
 * either — it swings in an arc from the base joint — so laying the controls
 * along that arc is what makes the whole surface reachable one-handed.
 *
 * Geometry is recomputed from the live viewport on every resize rather than
 * baked in, because "the corner" is a different place on every phone and after
 * every rotation.
 */

import { clampGeoColour, type GeoColour } from './geo-colour'
import type { MappingName, VisualParams } from './engine'
import { MERGE_MODES, type MergeModeName } from './merge-modes'
import { savePrefs, type Prefs } from './prefs'
import {
  ATMOSPHERIC_VIEWS,
  GEOMETRIC_VIEWS,
  type AtmosphericViewName,
  type GeometricViewName,
} from './views'

const SVG_NS = 'http://www.w3.org/2000/svg'
const DEG = Math.PI / 180
const TAU = Math.PI * 2

/** The wedge, in degrees. Contiguous in [0,360) so hit-testing needs no wrap. */
const SWEEP_A = 165
const SWEEP_B = 285
/** Where selection reads — up and to the left, the natural thumb rest. */
const NOTCH = 225 * DEG
/** Angular spacing between adjacent options on a band. */
const PITCH = 26 * DEG
/** Options fade to nothing this far from the notch, so a band reads as a strip
 *  continuing past the wedge rather than a closed list. */
const CUTOFF = 40 * DEG

/** Band radii and the mix arc, as fractions of the screen's short edge — the
 *  wedge has to stay a thumb's reach whatever the phone. Three bands, in
 *  compositing order outward-in: geometric, how they merge, atmospheric. The
 *  innermost band still clears the mix arc by more than a finger's width. */
const R_GEO = 0.88
const R_MRG = 0.72
const R_ATM = 0.56
const R_MIX = 0.30

/** How far a pointer may stray and still count as a tap rather than a drag. */
const TAP_SLOP_PX = 12
/** Half-width of a band's grab zone, in px. */
const GRAB_PX = 24

/** Centre-to-option radius for the mapping dial, in screen px (fixed, unlike
 *  the main bands' viewport-scaled radii, because the chip itself is a fixed
 *  CSS size). Same value Task 1's tap-to-pick fan used at this spot (its own
 *  FAN_R, now gone) — that number was already checked on screen to clear
 *  both the chip's column neighbours and the bands' own grab arcs, and nothing
 *  about turning the same three options into a drag changes that footprint. */
const MAP_R = 85
/** Angular spacing between adjacent options on the mapping dial — a
 *  different origin from PITCH above (the wedge hinge), so a separate
 *  constant rather than reuse. A drag's clamped rotation can swing an
 *  unselected option as far as (keys.length-1) pitches from the notch — up
 *  to 2×MAP_PITCH with three options — and that swing has to stay clear of
 *  this chip's column neighbours (the mix readout above, AUTO below), the
 *  same up/down-avoidance the old fan's fixed ±45° existed for. 20° keeps
 *  the worst-case swing to 40° either side of the notch, five degrees short
 *  of the fan's own limit — needed because unlike the fan's static circles,
 *  every option here is moving, not just the one being watched. */
const MAP_PITCH = 20 * DEG

/** The colour rings' sweep, relative to the colour chip's own centre — same
 *  convention as the mapping dial's own angles (0 points due right, positive
 *  is clockwise since screen y grows downward), and for the same reason: the
 *  chip's neighbours in the column (the mix readout above, AUTO below) sit
 *  at roughly ±90°, so the sweep stays clear of both by keeping well inside
 *  that. Wider than the mapping dial's own reach because a 0-100 drag needs
 *  an arc long enough to resolve a value along, not just three option stops. */
const RING_A0 = -50 * DEG
const RING_A1 = 50 * DEG
/** Innermost ring's radius, in screen px anchored to the colour chip (fixed,
 *  like MAP_R, not viewport-scaled like the dial bands — the chip itself is
 *  a fixed CSS size). The chip is a 26px-radius circle; a ring's own hit
 *  zone reaches GRAB_PX further in than its drawn radius, so anything closer
 *  than about 26 + GRAB_PX would let the ring's grab arc reach onto the chip
 *  itself. 60 clears that by a working margin. */
const RING_R_INNER = 60
/** Spacing between adjacent rings' radii. Each ring's hit zone is GRAB_PX*2
 *  (48px) wide; less than that and neighbouring rings' invisible grab arcs
 *  would overlap, so a drag meant for one ring could get captured by the
 *  next one in. The extra 8px on top is a clear gap between them, not load-
 *  bearing but cheap insurance against a fat-fingered tap landing exactly on
 *  the seam. */
const RING_PITCH = 56
/** How far past a ring's 0% end (RING_A0) its numeric label sits, outside
 *  the angular span every ring's track occupies — so a label never draws
 *  over any ring's own arc, whichever channel or radius it belongs to,
 *  regardless of that channel's current value. */
const LABEL_OFFSET = 12 * DEG
/** How far beyond its own ring's radius a label sits. Checked on screen at
 *  320×568: at RING_R_INNER with no padding, B's label lands almost exactly
 *  on the mix readout sitting directly above the chip in the column — the
 *  innermost ring is simply too close to the chip for angle alone to clear
 *  a same-column neighbour, since at radius 60 the whole ring's vertical
 *  reach is ±60px and the readout is only ~56px above centre. Pushing every
 *  label's radius out by this much clears that case with margin and, being
 *  uniform across all three, keeps their radial spacing consistent too. */
const LABEL_PAD = 26
/** How far the bands fade back while a popup owns the screen.
 *
 *  Every control here was designed and checked on its own, and each one does
 *  clear its own neighbours: the rings dodge the chip column, their labels
 *  dodge each other, the dial dodges the mix readout. What none of them
 *  could see alone is that a popup anchored to the chip column reaches right
 *  across the bands behind it — at RING_R_INNER + 2*RING_PITCH the outermost
 *  ring is 172px out, well inside the band arcs on any phone. Shipped, that
 *  read as three coloured arcs lying over MULTIPLY / CHORUS / ADD with all
 *  of it illegible.
 *
 *  Shrinking the rings does not fix it: a 0-100 drag wants a long arc to
 *  resolve a value along, and the bands are 30px+ wide wherever they sit.
 *  The two simply want the same pixels, so one has to yield while the other
 *  is in use — and it is not the one the thumb is on. Zero would be cleaner
 *  still but reads as the HUD having vanished mid-gesture; this keeps them
 *  as a ghost, so the wedge still looks like one object. */
const POPUP_DIM = 0.12

/** The camera ring's colour. Deliberately not one of CHANNELS' three tints —
 *  those say "this is the red channel", and a fourth ring in a fourth hue
 *  would read as a fourth channel. A near-white amber says "this is not one
 *  of those", and matches the convention every phone uses for a live camera. */
const CAM_TINT = '#ffcf8a'

export interface Hud {
  /** Call every frame with the current state; only does work while visible. */
  update(
    params: VisualParams,
    stats: {
      frameMs: number
      pixelRatio: number
      disturb?: number
      /** Accelerometer readings accepted so far, and the recent peak AC
       *  magnitude in m/s². Diagnostics only — see the readout's comment. */
      samples?: number
      peak?: number
      /** Motion events that arrived carrying no usable acceleration. */
      rejected?: number
      /** What the autopilot is waiting for. See Director.status(). */
      director?: {
        suspended: number
        tillColour: number
        tillView: number
        candidate: string | null
        candidateHeld: number
      }
      /** Whether the long-scale buffer has enough history to act on. */
      warm?: boolean
      /** Why there was or wasn't a buzz. See hapticStatus(). */
      haptics?: {
        supported: boolean
        attempts: number
        accepted: number
        suppressed: number
      }
      /** Where the fullscreen request got to. See fullscreenStatus(). */
      fullscreen?: {
        state: string
        attempts: number
        error: string
      }
    },
  ): void
  /** Step the atmospheric layer's programme forward (1) or back (-1), wrapping. */
  cycleAtmosphericView(direction: 1 | -1): void
  /** Step the geometric layer's programme forward (1) or back (-1), wrapping. */
  cycleGeometricView(direction: 1 | -1): void
  /** Adopt a change decided elsewhere (see director.ts) — updates the stored
   *  preference and the dial so the HUD keeps showing the truth, without
   *  reporting it as a manual change. */
  adopt(next: { geoColour?: GeoColour; atmosphericView?: AtmosphericViewName }): void
  /** Whether the user has the autopilot switched on. */
  autopilot(): boolean
}

interface Handlers {
  onGeometricView(name: GeometricViewName): void
  onGeoColour(colour: GeoColour): void
  onAtmosphericView(name: AtmosphericViewName): void
  onMergeMode(mode: MergeModeName): void
  /** 0-1. */
  onMix(mix: number): void
  onMapping(name: MappingName): void
  /**
   * 0-1 of the passthrough camera.
   *
   * Async and able to fail, unlike every other handler here, because the first
   * non-zero value is what actually asks for the camera — and the person can
   * say no. Resolves to the mix that was really achieved, so the control can
   * snap back to 0 on a refusal rather than sitting at a value that is not
   * true. The HUD must not itself decide what a refusal means.
   */
  onPassthrough(mix: number): Promise<number>
  /** Fired on every change the user makes by hand, so the autopilot can get
   *  out of the way. Not fired for `adopt`. */
  onManualChange(): void
}

const MAPPING_LABELS: Record<MappingName, string> = {
  relative: 'Relative',
  'speech-band': 'Absolute',
  'auto-normalised': 'Normalised',
}

/** Three-letter codes for the same three values, used wherever the full
 *  MAPPING_LABELS text won't fit — the mapping chip itself and its dial's
 *  option labels, both under 50px across. */
const MAPPING_SHORT: Record<MappingName, string> = {
  relative: 'REL',
  'speech-band': 'ABS',
  'auto-normalised': 'NOR',
}

const CSS = `
.hud-scrim {
  position: fixed; inset: 0; z-index: 30;
  opacity: 0; pointer-events: none;
  transition: opacity 200ms ease;
  /* Dimmed only where the HUD actually is. A full-screen scrim would hide the
     visualiser, which is the one thing you need to see while adjusting it. */
  background: radial-gradient(
    120% 90% at 100% 100%,
    rgba(3, 4, 8, 0.82) 0%,
    rgba(3, 4, 8, 0.55) 45%,
    rgba(3, 4, 8, 0) 78%
  );
}
.hud-scrim.open { opacity: 1; pointer-events: auto; }

.hud-dial { position: absolute; inset: 0; width: 100%; height: 100%; }
/* Only the bands and buttons take input; everywhere else falls through to the
   scrim, which closes. */
.hud-dial * { pointer-events: none; }
.hud-dial .hit { pointer-events: stroke; cursor: pointer; }
.hud-dial .btn { pointer-events: auto; cursor: pointer; }

.hud-track { fill: none; stroke: rgba(18,18,35,0.72); }
.hud-rule  { fill: none; stroke: rgba(255,255,255,0.07); stroke-width: 1; }
.hud-tick  { stroke: rgba(169,166,232,0.20); stroke-width: 1; }
.hud-tick.major { stroke: rgba(169,166,232,0.42); }

.hud-item {
  font: 500 12px "Chakra Petch", ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.06em; text-transform: uppercase;
  fill: #6f6b8c; text-anchor: middle; dominant-baseline: middle;
}
.hud-item.on { fill: #f0eeff; }

.hud-selector { fill: rgba(169,166,232,0.13); stroke: rgba(169,166,232,0.85); stroke-width: 1.4; }
.hud-tip { fill: rgba(169,166,232,0.85); }

.hud-mix-ring { fill: none; stroke: rgba(29,28,51,0.9); }
.hud-mix-arc  { fill: none; stroke: #9d9bf0; stroke-linecap: round; }
.hud-mix-knob { fill: #9d9bf0; }

/* The toggles are HTML rather than SVG, and sit after the dial in the DOM so
   they render above it. Inside the SVG they would fall within a band's grab
   zone — the invisible arcs are 48px wide — and the band would swallow the
   tap. Stacked at the left edge, clear of where the faded band labels reach.

   Everything in this corner lives in this one column: the mix readout, the
   colour panel, and the buttons. They were three absolutely-positioned things
   at hand-tuned offsets from the bottom, which held only for as long as the
   count and heights did — adding a third button put it on top of the mix
   readout, and opening the colour panel covered the button that opened it.
   A flex column cannot have that bug. */
.hud-btns {
  position: absolute;
  left: calc(0.75rem + env(safe-area-inset-left, 0px));
  bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
  display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem;
}

.hud-mixread {
  display: flex; align-items: baseline; gap: 0.4rem;
  font: 400 8px ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.14em; text-transform: uppercase; color: #5d5a78;
}
.hud-mixread b {
  font: 600 19px "Chakra Petch", ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0; color: #f0eeff; font-variant-numeric: tabular-nums;
}
/* Circular so the four read as one family of chips instead of a button list.
   Two short lines fit inside — an identity glyph and the live value — because
   the original span+b markup already carried both; only the shape changed.
   Sized a hair over GRAB_PX*2 (48px, the band hit zone's diameter and this
   file's established thumb-safe minimum) to leave room for the second line. */
.hud-chip {
  appearance: none; cursor: pointer;
  width: 3.25rem; height: 3.25rem; padding: 0;
  border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.05rem;
  background: rgba(12,12,26,0.85);
  border: 1px solid rgba(44,41,71,0.9);
  font: 400 8px ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: #8a86a4; text-align: center; line-height: 1.1;
}
.hud-chip[aria-pressed='true'] { background: rgba(26,24,48,0.9); border-color: #9d9bf0; }
.hud-chip b { font-weight: 400; color: #9d9bf0; display: block; }
.hud-chip[aria-pressed='true'] b { color: #f0eeff; }
/* The colour chip's value line is a swatch, not text — "100/100/100" does not
   fit in a 52px circle, and a dot of the actual colour reads faster than the
   digits ever did. */
.hud-chip b.hud-chip-swatch {
  width: 14px; height: 14px; margin: 0 auto; border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.45);
}

/* The mapping chip's dial: three labels drawn into the dial svg (not HTML),
   reusing the exact .hud-item/.hud-item.on styling the main bands already
   use for their own option text — this is the same "options on an arc, one
   highlighted" picture at a smaller radius, so it gets the same classes
   rather than a parallel set. Its track and notch tick reuse .hud-track and
   .hud-tick.major the same way. Task 1's fan (hud-fan-*, three independently
   tappable circles with their own stems) is gone: a drag control has one
   thing that turns, not three separate targets. */

/* The colour chip's popup used to be this panel: three linear sliders, one
   per channel. The sliders are gone — the popup is now three concentric
   rings drawn straight into the dial svg, anchored to this chip the same way
   the mapping dial is anchored to that one (see colourCenter() and
   paintColourPopup()). What is left of the panel is just the composite
   swatch: a single-glance check that the three channels haven't combined
   into something unexpected, kept because the exact per-channel numbers now
   live on the rings and their labels instead of in a per-row <output>. */
.hud-rgb {
  width: 3.25rem; padding: 0;
  display: none;
  pointer-events: auto;
}
.hud-rgb.open { display: block; }
.hud-swatch {
  height: 4px; border-radius: 2px;
  background: var(--swatch, #fff);
}

/* The three colour rings: the same track/fill/knob idiom as the mix arc,
   times three, concentric around the colour chip instead of the wedge hinge.
   Fill stroke colour is set per-channel inline (the tint from CHANNELS),
   since it varies per ring in a way a shared class can't express. */
.hud-ring-fill { fill: none; stroke-linecap: round; }
.hud-ring-label {
  font: 500 9px "Chakra Petch", ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.04em; text-transform: uppercase;
  text-anchor: middle; dominant-baseline: middle;
}

.hud-stats {
  position: absolute; margin: 0;
  left: calc(0.75rem + env(safe-area-inset-left, 0px));
  top: calc(3.2rem + env(safe-area-inset-top, 0px));
  font: 400 10.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre; color: #77809a; pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .hud-scrim { transition: none; }
}
`

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const n = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v))
  return n
}

/** Shortest signed difference a-b, wrapped to [-PI, PI). */
function delta(a: number, b: number): number {
  let d = (a - b) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

/** A band is one layer's worth of options laid along an arc. */
interface Band<K extends string> {
  readonly name: string
  readonly keys: readonly K[]
  readonly radius: number
  /** Rotation, in radians. 0 puts keys[0] under the notch. */
  rot: number
  label(k: K): string
  current(): K
  commit(k: K): void
  /** Filled in on layout. */
  labels: SVGTextElement[]
  hit?: SVGPathElement
  r: number
}

export function createHud(prefs: Prefs, handlers: Handlers): Hud {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const scrim = document.createElement('div')
  scrim.className = 'hud-scrim'
  scrim.setAttribute('role', 'dialog')
  scrim.setAttribute('aria-label', 'Controls')

  const stats = document.createElement('pre')
  stats.className = 'hud-stats'
  stats.hidden = !prefs.showStats
  scrim.appendChild(stats)

  const svg = el('svg', { class: 'hud-dial' })
  scrim.appendChild(svg)

  const btnBar = document.createElement('div')
  btnBar.className = 'hud-btns'
  scrim.appendChild(btnBar)

  const manual = (): void => handlers.onManualChange()

  // `glyph` is what's visible — short enough to sit on one line inside a
  // 52px circle — and `name` is the full word, kept as the accessible name
  // so shrinking the chip doesn't also shrink what a screen reader says.
  function mkButton(name: string, glyph: string, onTap: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'hud-chip'
    b.setAttribute('aria-label', name)
    b.innerHTML = '<span></span><b></b>'
    b.querySelector('span')!.textContent = glyph
    b.addEventListener('pointerup', (e) => {
      e.stopPropagation()
      onTap()
    })
    btnBar.appendChild(b)
    return b
  }

  const mixRead = document.createElement('div')
  mixRead.className = 'hud-mixread'
  mixRead.innerHTML = '<span>mix</span><b></b>'
  btnBar.appendChild(mixRead)

  // Appended to btnBar before any button, so it sits directly above the button
  // that opens it. After the SVG in the DOM is what keeps it from being
  // swallowed by a band's 48px grab zone.
  const rgbPanel = document.createElement('div')
  rgbPanel.className = 'hud-rgb'
  // A tap inside the panel must not reach the scrim, which closes the HUD.
  // Nothing in here is interactive any more — it's just the composite swatch
  // below — but the swatch is thin, and a mis-tap on the sliver of panel
  // around it shouldn't close the HUD out from under a colour change either.
  rgbPanel.addEventListener('pointerup', (e) => e.stopPropagation())
  rgbPanel.addEventListener('pointerdown', (e) => e.stopPropagation())
  btnBar.appendChild(rgbPanel)

  // Per-channel identity used by both the (now gone) sliders' replacement —
  // the colour rings — and paintRgb()'s swatch. Order is R, G, B throughout,
  // which is also the rings' outer-to-inner order (see ringRadius()).
  const CHANNELS = [
    { key: 'r' as const, label: 'R', tint: '#ff4d5e' },
    { key: 'g' as const, label: 'G', tint: '#4dff8f' },
    { key: 'b' as const, label: 'B', tint: '#5c8bff' },
  ]

  const swatch = document.createElement('div')
  swatch.className = 'hud-swatch'
  rgbPanel.appendChild(swatch)

  document.body.appendChild(scrim)

  const geometricKeys = Object.keys(GEOMETRIC_VIEWS) as GeometricViewName[]
  const atmosphericKeys = Object.keys(ATMOSPHERIC_VIEWS) as AtmosphericViewName[]
  const mergeKeys = Object.keys(MERGE_MODES) as MergeModeName[]
  const mappingKeys = Object.keys(MAPPING_LABELS) as MappingName[]

  const bands: Array<Band<string>> = [
    {
      name: 'geometric',
      keys: geometricKeys,
      radius: R_GEO,
      rot: 0,
      label: (k) => GEOMETRIC_VIEWS[k as GeometricViewName].label,
      current: () => prefs.geometricView,
      commit: (k) => {
        prefs.geometricView = k as GeometricViewName
        savePrefs(prefs)
        handlers.onGeometricView(prefs.geometricView)
        manual()
      },
      labels: [],
      r: 0,
    },
    {
      name: 'merge',
      keys: mergeKeys,
      radius: R_MRG,
      rot: 0,
      label: (k) => MERGE_MODES[k as MergeModeName].label,
      current: () => prefs.mergeMode,
      commit: (k) => {
        prefs.mergeMode = k as MergeModeName
        savePrefs(prefs)
        handlers.onMergeMode(prefs.mergeMode)
        manual()
      },
      labels: [],
      r: 0,
    },
    {
      name: 'atmospheric',
      keys: atmosphericKeys,
      radius: R_ATM,
      rot: 0,
      label: (k) => ATMOSPHERIC_VIEWS[k as AtmosphericViewName].label,
      current: () => prefs.atmosphericView,
      commit: (k) => {
        prefs.atmosphericView = k as AtmosphericViewName
        savePrefs(prefs)
        handlers.onAtmosphericView(prefs.atmosphericView)
        manual()
      },
      labels: [],
      r: 0,
    },
  ]

  const bandNamed = (name: string): Band<string> => bands.find((b) => b.name === name)!

  // Live geometry, recomputed on resize.
  let cx = 0
  let cy = 0
  let mixR = 0
  let mixArc: SVGPathElement | null = null
  let mixKnob: SVGCircleElement | null = null

  // The mapping dial. Rebuilt each layout pass like the bands and the mix arc
  // are, then just repositioned and shown/hidden by paintMapDial() — except
  // its geometry is anchored to the mapping chip's own screen position
  // (an HTML element outside the dial) rather than to the dial's centre. One
  // track, one notch tick, one hit arc (the single drag target — there is no
  // per-option hit any more) and one label per option.
  const mapDialLabels: SVGTextElement[] = []
  let mapDialTrack: SVGPathElement | null = null
  let mapDialTick: SVGLineElement | null = null
  let mapDialHit: SVGPathElement | null = null
  /** Rotation, in radians, of the mapping dial's ring of options — the
   *  chip-anchored analogue of a Band's own `rot`. 0 puts mappingKeys[0]
   *  under the notch (angle 0, i.e. due right of the chip). */
  let mapRot = 0

  // The colour rings, one array per element kind, indexed like CHANNELS
  // (0=R, 1=G, 2=B — R outermost, B innermost; see ringRadius()). Same
  // rebuild-then-reposition split as the mapping dial above, anchored to the
  // colour chip's own screen position instead of the dial's centre.
  const colourTracks: SVGPathElement[] = []
  const colourFills: SVGPathElement[] = []
  const colourKnobs: SVGCircleElement[] = []
  const colourLabels: SVGTextElement[] = []
  const colourHits: SVGPathElement[] = []

  // The camera ring: one arc, same idiom as a single colour ring, anchored to
  // its own chip. Only one, so plain refs rather than the arrays above.
  let camTrack: SVGPathElement | null = null
  let camFill: SVGPathElement | null = null
  let camKnob: SVGCircleElement | null = null
  let camLabel: SVGTextElement | null = null
  let camHit: SVGPathElement | null = null
  /** What the ring is showing, which during a drag runs ahead of what the
   *  camera has actually granted. `onPassthrough` is the only thing allowed to
   *  make it true — see the drag binding. */
  let camShown = 0

  // Only one popup — the mapping dial, or a colour panel — is ever open at
  // once. Each opener decides its own open/closed state from what it was
  // before acting, then unconditionally closes the other; that's what lets
  // a second tap on the same chip close it while a tap on any other chip
  // always closes both and only reopens the one that was tapped.
  let mapDialOpen = false
  /** Same shape as mapDialOpen and for the same reason: the camera ring is
   *  pure svg, so there is no DOM node outside build()'s teardown to hang the
   *  flag on the way rgbPanel's class does it for the colour popup. */
  let camRingOpen = false

  /** The band arcs, kept only so a popup can fade them back — see POPUP_DIM.
   *  Their labels already live on each band as b.labels. */
  let bandTracks: SVGPathElement[] = []

  /** True while either popup is up. They are mutually exclusive (see
   *  closeColourPopup()/closeMapDial()), so this is "is anything covering
   *  the bands", not a count. */
  const popupOpen = (): boolean =>
    mapDialOpen || camRingOpen || rgbPanel.classList.contains('open')

  const rgbBtn = mkButton('Geometric layer colour', 'RGB', () => {
    const wasOpen = rgbPanel.classList.contains('open')
    closeMapDial()
    closeCamRing()
    rgbPanel.classList.toggle('open', !wasOpen)
    paintButtons()
    paintColourPopup()
    // The bands sit under this popup and have to yield to it — see POPUP_DIM.
    paintBands()
  })
  // The colour chip's value is a swatch dot, not text — see the CSS comment
  // on .hud-chip-swatch for why.
  const rgbSwatch = rgbBtn.querySelector('b')!
  rgbSwatch.classList.add('hud-chip-swatch')

  const autoBtn = mkButton('Autopilot', 'AUTO', () => {
    closeColourPopup()
    closeMapDial()
    closeCamRing()
    prefs.autopilot = !prefs.autopilot
    savePrefs(prefs)
    paintButtons()
    // Toggling it on is not a manual change to *what is on screen*, so it does
    // not suspend — switching it on and then waiting three minutes for it to
    // do anything would read as broken.
  })

  const mapBtn = mkButton('Mapping', 'MAP', () => {
    const wasOpen = mapDialOpen
    closeColourPopup()
    closeCamRing()
    mapDialOpen = !wasOpen
    // Mirrors restingRot()'s behaviour for the main bands: opening always
    // parks the currently-selected option under the notch, regardless of
    // wherever a previous drag left mapRot sitting.
    if (mapDialOpen) mapRot = restingRotOf(mappingKeys, prefs.mapping, MAP_PITCH)
    paintMapDial()
    paintButtons()
    // Same as the colour popup: the bands underneath yield while this is up.
    paintBands()
  })

  const camBtn = mkButton('Camera passthrough', 'CAM', () => {
    const wasOpen = camRingOpen
    closeColourPopup()
    closeMapDial()
    camRingOpen = !wasOpen
    paintCamRing()
    paintButtons()
    paintBands()
  })

  function closeCamRing(): void {
    if (!camRingOpen) return
    camRingOpen = false
    paintCamRing()
    paintBands()
  }

  const statsBtn = mkButton('Numeric readout', 'NUM', () => {
    closeColourPopup()
    closeMapDial()
    closeCamRing()
    prefs.showStats = !prefs.showStats
    stats.hidden = !prefs.showStats
    if (!prefs.showStats) stats.textContent = ''
    savePrefs(prefs)
    paintButtons()
  })

  function closeMapDial(): void {
    if (!mapDialOpen) return
    mapDialOpen = false
    paintMapDial()
    // Bands come back up — see POPUP_DIM. Harmless when the caller is a chip
    // that is about to open the other popup: its own paintBands() follows.
    paintBands()
  }

  // The colour popup's open/closed state lives on rgbPanel's own class,
  // unlike mapDialOpen which has to be a closure variable — the mapping dial
  // is pure svg with nothing surviving build()'s teardown to hold a flag on,
  // but rgbPanel is an ordinary DOM node outside the svg, so its class
  // already survives resize the same way mapDialOpen is made to.
  function closeColourPopup(): void {
    if (!rgbPanel.classList.contains('open')) return
    rgbPanel.classList.remove('open')
    paintColourPopup()
    paintBands()
  }

  /** Position on a circle of radius r about (ox,oy). polar()/arcPath() are
   *  this centred on the wedge hinge (cx,cy); the colour rings need the same
   *  arithmetic centred on the colour chip instead, so it's generalised here
   *  and polar()/arcPath() become the cx,cy special case of it. */
  const polarAt = (ox: number, oy: number, r: number, a: number): [number, number] => [
    ox + r * Math.cos(a),
    oy + r * Math.sin(a),
  ]
  const polar = (r: number, a: number): [number, number] => polarAt(cx, cy, r, a)

  function arcAt(ox: number, oy: number, r: number, a0: number, a1: number): string {
    const [x0, y0] = polarAt(ox, oy, r, a0)
    const [x1, y1] = polarAt(ox, oy, r, a1)
    return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`
  }
  function arcPath(r: number, a0: number, a1: number): string {
    return arcAt(cx, cy, r, a0, a1)
  }

  /** Rotation that puts `cur` under the notch, given `pitch` spacing between
   *  adjacent items in `keys`. Generalised out from what was a private
   *  one-liner on Band<K> the moment the mapping dial needed the identical
   *  arithmetic around a different origin, radius, and pitch — the same
   *  boundary-grows-a-second-tenant case bindTurnDrag below is also an
   *  instance of. */
  function restingRotOf<K extends string>(keys: readonly K[], cur: K, pitch: number): number {
    return -Math.max(0, keys.indexOf(cur)) * pitch
  }
  /** The main bands' own case of restingRotOf: their origin is always the
   *  wedge hinge, so PITCH and Band<K>'s own keys/current() cover it. */
  function restingRot(b: Band<string>): number {
    return restingRotOf(b.keys, b.current(), PITCH)
  }

  function build(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    const base = Math.min(w, h)
    // Hinge sits just outside the corner, so the wedge opens into the screen.
    cx = w + 10
    cy = h + 10
    mixR = base * R_MIX

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const a0 = SWEEP_A * DEG
    const a1 = SWEEP_B * DEG

    // Ticks along the outer edge, as a rim for the whole wedge.
    const outer = base * R_GEO + base * 0.07
    for (let d = SWEEP_A; d <= SWEEP_B; d += 3) {
      const a = d * DEG
      const major = d % 15 === 0
      const [px0, py0] = polar(outer - (major ? 8 : 4), a)
      const [px1, py1] = polar(outer, a)
      svg.appendChild(
        el('line', {
          x1: px0,
          y1: py0,
          x2: px1,
          y2: py1,
          class: `hud-tick${major ? ' major' : ''}`,
        }),
      )
    }
    svg.appendChild(el('path', { d: arcPath(outer + 4, a0, a1), class: 'hud-rule' }))

    // Bands, outermost first.
    bandTracks = []
    for (const b of bands) {
      b.r = base * b.radius
      b.rot = restingRot(b)
      const bandTrack = el('path', {
        d: arcPath(b.r, a0, a1),
        class: 'hud-track',
        'stroke-width': Math.max(30, base * 0.09),
      })
      svg.appendChild(bandTrack)
      // Held onto only so a popup can fade them — see POPUP_DIM. Rebuilt on
      // every resize along with everything else in here, hence the reset
      // above rather than a push onto a stale array.
      bandTracks.push(bandTrack)
      b.labels = b.keys.map(() => {
        const t = el('text', { class: 'hud-item' })
        svg.appendChild(t)
        return t
      })
    }

    // The selector: a trapezoid crossing every band at the notch.
    {
      const r0 = base * R_ATM - base * 0.05
      const r1 = base * R_GEO + base * 0.05
      const w0 = 26
      const w1 = 40
      const [lx0, ly0] = polar(r0, NOTCH - Math.atan2(w0 / 2, r0))
      const [rx0, ry0] = polar(r0, NOTCH + Math.atan2(w0 / 2, r0))
      const [lx1, ly1] = polar(r1, NOTCH - Math.atan2(w1 / 2, r1))
      const [rx1, ry1] = polar(r1, NOTCH + Math.atan2(w1 / 2, r1))
      // Fades with the bands it reads — it marks which band option is
      // selected, so leaving it lit over faded bands points at nothing.
      bandTracks.push(
        svg.appendChild(
          el('path', {
            d: `M${lx0} ${ly0}L${lx1} ${ly1}L${rx1} ${ry1}L${rx0} ${ry0}Z`,
            class: 'hud-selector',
          }),
        ) as SVGPathElement,
      )
      const [tx, ty] = polar(r0 - 10, NOTCH)
      const [bx, by] = polar(r0 - 24, NOTCH)
      const perp = NOTCH + Math.PI / 2
      bandTracks.push(
        svg.appendChild(
          el('path', {
            d:
              `M${bx + 6 * Math.cos(perp)} ${by + 6 * Math.sin(perp)}` +
              `L${bx - 6 * Math.cos(perp)} ${by - 6 * Math.sin(perp)}` +
              `L${tx} ${ty}Z`,
            class: 'hud-tip',
          }),
        ) as SVGPathElement,
      )
    }

    // Mix arc, innermost.
    svg.appendChild(
      el('path', {
        d: arcPath(mixR, a0, a1),
        class: 'hud-mix-ring',
        'stroke-width': 7,
      }),
    )
    mixArc = el('path', { class: 'hud-mix-arc', 'stroke-width': 7 })
    svg.appendChild(mixArc)
    mixKnob = el('circle', { r: 8, class: 'hud-mix-knob' })
    svg.appendChild(mixKnob)

    // Invisible thick arcs are the actual grab targets. Added last so they sit
    // above the painted bands, and stroke-only so taps elsewhere fall through
    // to the scrim and close the HUD.
    for (const b of bands) {
      const hit = el('path', {
        d: arcPath(b.r, a0, a1),
        class: 'hit',
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': GRAB_PX * 2,
      })
      bindBandDrag(hit, b)
      svg.appendChild(hit)
      b.hit = hit
    }
    const mixHit = el('path', {
      d: arcPath(mixR, a0, a1),
      class: 'hit',
      fill: 'none',
      stroke: 'transparent',
      'stroke-width': GRAB_PX * 2,
    })
    bindMixDrag(mixHit)
    svg.appendChild(mixHit)

    // The mapping dial, added last of all so it draws above everything else
    // in the dial — it has to, since it can be opened while it sits over
    // band labels near the chip's corner of the screen, and, more to the
    // point, its hit arc has to win against the bands' own much larger grab
    // arcs underneath wherever the two overlap (see the pointer-events
    // toggle in paintMapDial() — DOM order alone decides who a pointerdown
    // reaches when two `.hit`/`.btn` shapes both cover the same point, and
    // Task 1 already proved this ordering clears the contested annulus its
    // own fan sat in; the same annulus, same fix, still applies here).
    mapDialLabels.length = 0
    mappingKeys.forEach(() => {
      const label = el('text', { class: 'hud-item' })
      svg.appendChild(label)
      mapDialLabels.push(label)
    })
    {
      const track = el('path', { class: 'hud-track', 'stroke-width': 4 })
      svg.appendChild(track)
      mapDialTrack = track

      const tick = el('line', { class: 'hud-tick major' })
      svg.appendChild(tick)
      mapDialTick = tick

      const hit = el('path', {
        class: 'hit',
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': GRAB_PX * 2,
      })
      hit.setAttribute('aria-label', 'Mapping options')
      svg.appendChild(hit)
      mapDialHit = hit

      bindTurnDrag(
        hit,
        mapDialCenter,
        MAP_PITCH,
        mappingKeys,
        () => mapRot,
        (r) => {
          mapRot = r
        },
        paintMapDial,
        (next) => {
          if (next !== prefs.mapping) {
            prefs.mapping = next
            savePrefs(prefs)
            handlers.onMapping(prefs.mapping)
          }
          // Turning to a value is choosing it — the same "settling under the
          // notch commits" rule the main bands already follow — so every
          // release closes the dial, whether or not the value actually
          // changed. A drag that ends back where it started is still a
          // completed gesture, not a cancel; the scrim and a second chip tap
          // are the two ways to back out without choosing anything.
          mapDialOpen = false
          paintButtons()
        },
      )
    }
    mapRot = restingRotOf(mappingKeys, prefs.mapping, MAP_PITCH)

    // The colour rings, added last of all — after the mapping dial, even —
    // so that if a phone is somehow narrow enough for the two popups'
    // territory to touch, whichever is open draws on top. They never are
    // both open at once (see closeColourPopup()/closeMapDial()), so in
    // practice this only matters for z-order over the dial bands beneath.
    colourTracks.length = 0
    colourFills.length = 0
    colourKnobs.length = 0
    colourLabels.length = 0
    colourHits.length = 0
    CHANNELS.forEach(({ key, label, tint }) => {
      const track = el('path', { class: 'hud-track', 'stroke-width': 8 })
      svg.appendChild(track)
      colourTracks.push(track)

      const fill = el('path', { class: 'hud-ring-fill', 'stroke-width': 8, stroke: tint })
      svg.appendChild(fill)
      colourFills.push(fill)

      const knob = el('circle', { r: 6, class: 'hud-ring-knob' })
      knob.style.fill = tint
      svg.appendChild(knob)
      colourKnobs.push(knob)

      const lbl = el('text', { class: 'hud-ring-label' })
      lbl.style.fill = tint
      svg.appendChild(lbl)
      colourLabels.push(lbl)

      const hit = el('path', {
        class: 'hit',
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': GRAB_PX * 2,
      })
      hit.setAttribute('aria-label', `${label} intensity`)
      svg.appendChild(hit)
      colourHits.push(hit)

      bindArcDrag(
        hit,
        colourCenter,
        RING_A0,
        RING_A1,
        (t) => {
          prefs.geoColour = clampGeoColour({ ...prefs.geoColour, [key]: t })
          handlers.onGeoColour(prefs.geoColour)
          paintColourPopup()
          paintRgb()
          manual()
        },
        // Persist once at the end, same as every other dragged control here.
        () => savePrefs(prefs),
      )
    })

    // The camera ring. Built after the colour rings so it draws over them for
    // the same z-order reason they are built after the mapping dial — the two
    // are never open together, so this only matters against the bands.
    // Tinted track, unlike the colour rings' plain .hud-track ones.
    //
    // At zero this ring has no fill to show where it runs, and .hud-track's
    // rgba(18,18,35,0.72) against a near-black ground is invisible — so the
    // control reads as a floating knob and a label, with nothing to say which
    // way it turns. The colour rings never expose that because three channels
    // are rarely all zero at once; this one is zero at the start of every
    // session, which is exactly when its affordance matters most.
    camTrack = el('path', { class: 'hud-track', 'stroke-width': 8 })
    // Inline style, not a stroke="" attribute. `.hud-track` sets stroke in
    // CSS, and any CSS rule beats a presentation attribute however specific
    // the attribute looks — so the attribute version of this drew in the
    // class's near-black and stayed invisible, which read as the arc not being
    // drawn at all. The colour rings already dodge this by setting knob.style
    // .fill rather than a fill attribute.
    camTrack.style.stroke = CAM_TINT
    camTrack.style.strokeOpacity = '0.22'
    svg.appendChild(camTrack)
    camFill = el('path', { class: 'hud-ring-fill', 'stroke-width': 8, stroke: CAM_TINT })
    svg.appendChild(camFill)
    camKnob = el('circle', { r: 6, class: 'hud-ring-knob' })
    camKnob.style.fill = CAM_TINT
    svg.appendChild(camKnob)
    camLabel = el('text', { class: 'hud-ring-label' })
    camLabel.style.fill = CAM_TINT
    svg.appendChild(camLabel)
    camHit = el('path', {
      class: 'hit',
      fill: 'none',
      stroke: 'transparent',
      'stroke-width': GRAB_PX * 2,
    })
    camHit.setAttribute('aria-label', 'Camera passthrough amount')
    svg.appendChild(camHit)

    bindArcDrag(
      camHit,
      camCenter,
      RING_A0,
      RING_A1,
      (t) => {
        // The ring follows the thumb immediately, but `prefs.passthrough` is
        // not set here — the camera may refuse, and a preference that says 60
        // while the sensor was declined is a lie the rest of the app would
        // act on. camShown is what the thumb asked for; the handler's reply
        // is what actually happened, applied on commit below.
        camShown = t
        paintCamRing()
        manual()
      },
      () => {
        // Asking happens once, on release, not on every pointermove: the first
        // non-zero value triggers getUserMedia, and firing that from a move
        // handler would queue a prompt per frame of the drag.
        void handlers.onPassthrough(camShown).then((granted) => {
          // Snap to the truth. On a refusal this puts the ring back to 0,
          // which is the only honest thing to show — the alternative is a
          // control sitting at 60 with a black ground behind it.
          camShown = granted
          prefs.passthrough = granted
          savePrefs(prefs)
          paintCamRing()
        })
      },
    )

    paintBands()
    paintMix()
    paintRgb()
    paintButtons()
    paintMapDial()
    paintColourPopup()
    paintCamRing()
  }

  /** The mapping chip's centre, in the svg's own coordinate space — the same
   *  client-rect-to-local conversion angleFrom() does for pointer events,
   *  just for an element's position instead of an event's. Named for what it
   *  anchors now, not what Task 1 anchored here (mapFanCenter()) — the
   *  computation itself is unchanged. */
  function mapDialCenter(): [number, number] {
    const svgRect = svg.getBoundingClientRect()
    const chipRect = mapBtn.getBoundingClientRect()
    return [
      chipRect.left + chipRect.width / 2 - svgRect.left,
      chipRect.top + chipRect.height / 2 - svgRect.top,
    ]
  }

  function paintMapDial(): void {
    if (!mapDialTrack || !mapDialTick || !mapDialHit) return
    const [fx, fy] = mapDialCenter()
    // The fixed housing the ring of options turns inside. Its extent is
    // exactly the worst-case swing MAP_PITCH's own comment reasons about —
    // the same bound bindTurnDrag's clamp enforces on mapRot — so the drawn
    // track never has to show more than a fully-turned drag can ever reach.
    const sweep = (mappingKeys.length - 1) * MAP_PITCH
    mapDialTrack.setAttribute('d', arcAt(fx, fy, MAP_R, -sweep, sweep))
    mapDialTrack.setAttribute('opacity', mapDialOpen ? '1' : '0')

    // A fixed tick at angle 0 — due right of the chip, same direction the
    // old fan opened in — marking where a settled drag reads, the same role
    // the wedge's own selector trapezoid plays for the main bands, just a
    // plain tick because three always-visible options don't need a shape as
    // heavy as that trapezoid to find.
    const [tx0, ty0] = polarAt(fx, fy, MAP_R - 8, 0)
    const [tx1, ty1] = polarAt(fx, fy, MAP_R + 8, 0)
    mapDialTick.setAttribute('x1', String(tx0))
    mapDialTick.setAttribute('y1', String(ty0))
    mapDialTick.setAttribute('x2', String(tx1))
    mapDialTick.setAttribute('y2', String(ty1))
    mapDialTick.setAttribute('opacity', mapDialOpen ? '1' : '0')

    mappingKeys.forEach((k, i) => {
      const a = i * MAP_PITCH + mapRot
      const [x, y] = polarAt(fx, fy, MAP_R, a)
      const label = mapDialLabels[i]
      label.setAttribute('x', String(x))
      label.setAttribute('y', String(y))
      label.textContent = MAPPING_SHORT[k]
      label.setAttribute('opacity', mapDialOpen ? '1' : '0')
      label.classList.toggle('on', k === prefs.mapping)
    })

    mapDialHit.setAttribute('d', arcAt(fx, fy, MAP_R, -sweep, sweep))
    // Invisible when closed must also mean untappable — opacity alone would
    // leave this hit arc live over whatever else is underneath it, the same
    // reasoning paintColourPopup() gives for its own rings' hits.
    mapDialHit.style.pointerEvents = mapDialOpen ? 'auto' : 'none'
  }

  /** The colour chip's centre, in the svg's own coordinate space — the same
   *  conversion mapDialCenter() does for the mapping chip. */
  function colourCenter(): [number, number] {
    const svgRect = svg.getBoundingClientRect()
    const chipRect = rgbBtn.getBoundingClientRect()
    return [
      chipRect.left + chipRect.width / 2 - svgRect.left,
      chipRect.top + chipRect.height / 2 - svgRect.top,
    ]
  }

  /** Radius of the i'th channel's ring (i indexes CHANNELS: 0=R, 1=G, 2=B).
   *  R outermost, B innermost, in CHANNELS' own order. Checked on screen at
   *  320×568 rather than picked blind: with R biggest, the popup reads as
   *  one shape shrinking inward rather than three arcs of equal weight
   *  competing for attention, and R is the ring a thumb reaches first
   *  without crossing the other two — which matches it usually being the
   *  first channel a warm/cool push touches. Nesting by CHANNELS' existing
   *  order also means no separate ordering has to be invented or kept in
   *  sync with it. Computed rather than stored, like everything else
   *  paintColourPopup() draws, so there is one definition of the layout. */
  function ringRadius(i: number): number {
    return RING_R_INNER + (CHANNELS.length - 1 - i) * RING_PITCH
  }

  /** The camera chip's own centre, same conversion as colourCenter(). */
  function camCenter(): [number, number] {
    const svgRect = svg.getBoundingClientRect()
    const chipRect = camBtn.getBoundingClientRect()
    return [
      chipRect.left + chipRect.width / 2 - svgRect.left,
      chipRect.top + chipRect.height / 2 - svgRect.top,
    ]
  }

  function paintCamRing(): void {
    if (!camTrack || !camFill || !camKnob || !camLabel || !camHit) return
    const [fx, fy] = camCenter()
    // RING_R_INNER, not a radius of its own: one ring anchored to one chip has
    // no neighbours to clear, so the innermost colour ring's already-checked
    // clearance from a 26px chip plus a GRAB_PX hit zone is exactly the right
    // number, and reusing it keeps the two popups the same size on screen.
    const r = RING_R_INNER

    camTrack.setAttribute('d', arcAt(fx, fy, r, RING_A0, RING_A1))
    camTrack.setAttribute('opacity', camRingOpen ? '1' : '0')

    // Same 0-1 to angle mapping the colour rings use inline.
    const value = RING_A0 + camShown * (RING_A1 - RING_A0)
    camFill.setAttribute('d', arcAt(fx, fy, r, RING_A0, Math.max(RING_A0 + 0.001, value)))
    camFill.setAttribute('opacity', camRingOpen ? '1' : '0')

    const [kx, ky] = polarAt(fx, fy, r, value)
    camKnob.setAttribute('cx', String(kx))
    camKnob.setAttribute('cy', String(ky))
    camKnob.setAttribute('opacity', camRingOpen ? '1' : '0')

    const [lx, ly] = polarAt(fx, fy, r + LABEL_PAD, RING_A0 - LABEL_OFFSET)
    camLabel.setAttribute('x', String(lx))
    camLabel.setAttribute('y', String(ly))
    camLabel.textContent = `CAM ${Math.round(camShown * 100)}`
    camLabel.setAttribute('opacity', camRingOpen ? '1' : '0')

    camHit.setAttribute('d', arcAt(fx, fy, r, RING_A0, RING_A1))
    // Invisible must mean untappable — `.hud-dial .hit` sets pointer-events
    // via a shared class regardless of opacity, so a closed ring would still
    // swallow drags meant for the band underneath it.
    camHit.style.pointerEvents = camRingOpen ? 'auto' : 'none'
  }

  function paintColourPopup(): void {
    const open = rgbPanel.classList.contains('open')
    const [fx, fy] = colourCenter()
    const c = prefs.geoColour
    CHANNELS.forEach(({ key, label }, i) => {
      const r = ringRadius(i)
      const value = c[key]
      const valueAngle = RING_A0 + value * (RING_A1 - RING_A0)

      colourTracks[i].setAttribute('d', arcAt(fx, fy, r, RING_A0, RING_A1))
      colourTracks[i].setAttribute('opacity', open ? '1' : '0')

      colourFills[i].setAttribute(
        'd',
        arcAt(fx, fy, r, RING_A0, Math.max(RING_A0 + 0.001, valueAngle)),
      )
      colourFills[i].setAttribute('opacity', open ? '1' : '0')

      const [kx, ky] = polarAt(fx, fy, r, valueAngle)
      colourKnobs[i].setAttribute('cx', String(kx))
      colourKnobs[i].setAttribute('cy', String(ky))
      colourKnobs[i].setAttribute('opacity', open ? '1' : '0')

      // Anchored past RING_A0, outside every ring's own arc — see
      // LABEL_OFFSET — so the text never sits over a track or fill
      // regardless of this or any other channel's current value.
      const [lx, ly] = polarAt(fx, fy, r + LABEL_PAD, RING_A0 - LABEL_OFFSET)
      const lbl = colourLabels[i]
      lbl.setAttribute('x', String(lx))
      lbl.setAttribute('y', String(ly))
      lbl.textContent = `${label} ${Math.round(value * 100)}`
      lbl.setAttribute('opacity', open ? '1' : '0')

      colourHits[i].setAttribute('d', arcAt(fx, fy, r, RING_A0, RING_A1))
      // Invisible when closed must also mean untappable, exactly like the
      // mapping dial's own hit arc — these hit zones are wider than that
      // one and sit over at least as much of the dial, so it matters at
      // least as much here.
      colourHits[i].style.pointerEvents = open ? 'auto' : 'none'
    })
  }

  function paintBands(): void {
    // A popup anchored to the chip column lies across these, so they yield
    // while one is up rather than fighting it for the same pixels.
    const dim = popupOpen() ? POPUP_DIM : 1
    for (const t of bandTracks) t.setAttribute('opacity', dim.toFixed(3))

    for (const b of bands) {
      const sel = b.current()
      b.keys.forEach((k, i) => {
        const a = NOTCH + i * PITCH + b.rot
        const d = Math.abs(delta(a, NOTCH))
        const vis = (d > CUTOFF ? 0 : 1 - (d / CUTOFF) * 0.72) * dim
        const [x, y] = polar(b.r, a)
        const t = b.labels[i]
        t.setAttribute('x', String(x))
        t.setAttribute('y', String(y))
        t.setAttribute('opacity', vis.toFixed(3))
        t.textContent = b.label(k)
        t.classList.toggle('on', k === sel)
      })
    }
  }

  function paintMix(): void {
    if (!mixArc || !mixKnob) return
    const a0 = SWEEP_A * DEG
    const a1 = a0 + prefs.mix * (SWEEP_B - SWEEP_A) * DEG
    mixArc.setAttribute('d', arcPath(mixR, a0, Math.max(a0 + 0.001, a1)))
    const [kx, ky] = polar(mixR, a1)
    mixKnob.setAttribute('cx', String(kx))
    mixKnob.setAttribute('cy', String(ky))
    mixRead.querySelector('b')!.textContent = `${Math.round(prefs.mix * 100)}%`
  }

  // The per-channel exact values now live on the rings themselves
  // (paintColourPopup()'s labels); this only paints the composite preview —
  // the swatch bar and the chip's own dot — which is why it no longer needs
  // to know about individual channels.
  function paintRgb(): void {
    const c = prefs.geoColour
    const rgbCss = `rgb(${Math.round(c.r * 255)} ${Math.round(c.g * 255)} ${Math.round(c.b * 255)})`
    swatch.style.setProperty('--swatch', rgbCss)
    rgbSwatch.style.background = rgbCss
  }

  function paintButtons(): void {
    const open = rgbPanel.classList.contains('open')
    rgbBtn.setAttribute('aria-pressed', String(open))
    rgbBtn.setAttribute('aria-expanded', String(open))
    autoBtn.querySelector('b')!.textContent = prefs.autopilot ? 'on' : 'off'
    autoBtn.setAttribute('aria-pressed', String(prefs.autopilot))
    mapBtn.querySelector('b')!.textContent = MAPPING_SHORT[prefs.mapping]
    mapBtn.setAttribute('aria-expanded', String(mapDialOpen))
    // Task 1 gave mapBtn aria-expanded but never aria-pressed, so unlike the
    // other three chips it never visually read as active while its own
    // popup was open. Same treatment as rgbBtn/autoBtn/statsBtn above.
    mapBtn.setAttribute('aria-pressed', String(mapDialOpen))
    statsBtn.querySelector('b')!.textContent = prefs.showStats ? 'on' : 'off'
    statsBtn.setAttribute('aria-pressed', String(prefs.showStats))
    // Shows the amount, not on/off: the difference between 15 and 80 is the
    // whole control, and "on" would hide it.
    camBtn.querySelector('b')!.textContent =
      camShown > 0 ? String(Math.round(camShown * 100)) : 'off'
    camBtn.setAttribute('aria-pressed', String(camRingOpen))
    camBtn.setAttribute('aria-expanded', String(camRingOpen))
  }

  /** Pointer position as an angle about (ox,oy), in the svg's own coordinate
   *  space (which is CSS pixels). The bands call this with (cx,cy), the
   *  wedge hinge they're always about; bindTurnDrag and the colour rings
   *  call it with whatever origin() they were each given instead. */
  function angleFrom(e: PointerEvent, ox: number, oy: number): number {
    const r = svg.getBoundingClientRect()
    return Math.atan2(e.clientY - r.top - oy, e.clientX - r.left - ox)
  }

  /** Where an angle falls along the arc from a0 to a1, as 0-1, clamped to the
   *  arc's own ends. Built on delta() rather than the naive
   *  "(deg-a0)/(a1-a0)" so it survives a0/a1 straddling the 0/360 wrap —
   *  which the mix arc's own SWEEP_A/SWEEP_B never do, but the colour rings'
   *  chip-relative angles can, depending where the chip lands on screen.
   *  Shared by bindMixDrag and the colour rings' drag binder so a drag turns
   *  into a value the same way everywhere in this file. */
  function angleToUnit(a: number, a0: number, a1: number): number {
    const t = delta(a, a0) / delta(a1, a0)
    return Math.max(0, Math.min(1, t))
  }

  /** Binds a drag on `hit` to a 0-1 value along the arc from a0 to a1 about
   *  whatever point `origin()` currently reports — a function rather than a
   *  fixed pair because the colour rings' centre moves with the chip's own
   *  layout, re-read on every event rather than cached, the same as every
   *  other paint path in this file. `apply` gets the live value on every
   *  move; `onCommit` fires once, on release, which is where persistence
   *  belongs (see the comment on the old sliders' `commit`, above). */
  function bindArcDrag(
    hit: SVGPathElement,
    origin: () => [number, number],
    a0: number,
    a1: number,
    apply: (t: number) => void,
    onCommit: () => void,
  ): void {
    let active = false
    const set = (e: PointerEvent): void => {
      const [ox, oy] = origin()
      apply(angleToUnit(angleFrom(e, ox, oy), a0, a1))
    }
    hit.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      hit.setPointerCapture(e.pointerId)
      active = true
      set(e)
    })
    hit.addEventListener('pointermove', (e) => {
      if (active && hit.hasPointerCapture(e.pointerId)) set(e)
    })
    const end = (e: PointerEvent): void => {
      if (!active) return
      active = false
      e.stopPropagation()
      onCommit()
    }
    hit.addEventListener('pointerup', end)
    hit.addEventListener('pointercancel', end)
  }

  /** Binds a drag on `hit` to "turn a ring of options past a fixed notch,
   *  snap to whichever settles closest on release" — generalised from what
   *  was bindBandDrag's own private arithmetic the moment the mapping dial
   *  needed the identical shape of control around a different origin,
   *  radius, and pitch. `origin`, `pitch`, and `keys` are the geometry;
   *  `get`/`set` hold the live rotation whereever the caller keeps it (a
   *  Band's own `.rot` field for the main bands, a closure variable for the
   *  mapping dial — this function doesn't need to own that storage);
   *  `repaint` redraws mid-drag and after settling; `onSettle` fires once,
   *  on release, with whichever key ended up under the notch — always,
   *  whether or not it differs from what was already selected, since (unlike
   *  bindArcDrag's onCommit, which only means "persist") this is also where
   *  a caller with a popup to close does that. */
  function bindTurnDrag<K extends string>(
    hit: SVGPathElement,
    origin: () => [number, number],
    pitch: number,
    keys: readonly K[],
    get: () => number,
    set: (rot: number) => void,
    repaint: () => void,
    onSettle: (next: K) => void,
  ): void {
    let last = 0
    let moved = false

    hit.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      hit.setPointerCapture(e.pointerId)
      const [ox, oy] = origin()
      last = angleFrom(e, ox, oy)
      moved = true
    })
    hit.addEventListener('pointermove', (e) => {
      if (!moved || !hit.hasPointerCapture(e.pointerId)) return
      const [ox, oy] = origin()
      const a = angleFrom(e, ox, oy)
      let rot = get() + delta(a, last)
      last = a
      // Can't spin an option out past either end of the strip.
      const lo = -(keys.length - 1) * pitch
      if (rot > 0) rot = 0
      if (rot < lo) rot = lo
      set(rot)
      repaint()
    })
    const settle = (e: PointerEvent) => {
      if (!moved) return
      moved = false
      e.stopPropagation()
      const i = Math.max(0, Math.min(keys.length - 1, Math.round(-get() / pitch)))
      set(-i * pitch)
      // Commit (or whatever else onSettle does — the mapping dial also
      // closes here) before repainting, so the repaint's own read of
      // "what's current" already reflects it.
      onSettle(keys[i])
      repaint()
    }
    hit.addEventListener('pointerup', settle)
    hit.addEventListener('pointercancel', settle)
  }

  function bindBandDrag(hit: SVGPathElement, b: Band<string>): void {
    bindTurnDrag(
      hit,
      () => [cx, cy],
      PITCH,
      b.keys,
      () => b.rot,
      (r) => {
        b.rot = r
      },
      paintBands,
      (next) => {
        if (next !== b.current()) b.commit(next)
      },
    )
  }

  function bindMixDrag(hit: SVGPathElement): void {
    bindArcDrag(
      hit,
      () => [cx, cy],
      SWEEP_A * DEG,
      SWEEP_B * DEG,
      (t) => {
        prefs.mix = t
        handlers.onMix(prefs.mix)
        paintMix()
        manual()
      },
      // Persist once at the end — a drag fires many events a second and there
      // is no reason to write localStorage that often.
      () => savePrefs(prefs),
    )
  }

  build()
  window.addEventListener('resize', build)
  // iOS reports the old viewport for a moment after a rotation, so re-measure.
  window.addEventListener('orientationchange', () => window.setTimeout(build, 250))

  let open = false
  const setOpen = (v: boolean): void => {
    open = v
    scrim.classList.toggle('open', v)
    if (v) {
      // Bands may have been changed by a swipe gesture while closed.
      for (const b of bands) b.rot = restingRot(b)
      paintBands()
      paintMix()
      paintRgb()
      paintButtons()
      paintColourPopup()
    } else {
      // Both are modes; leaving either open across a close would mean the HUD
      // reopens showing something the last tap did not ask for.
      closeColourPopup()
      closeMapDial()
      stats.textContent = ''
    }
  }

  // Tap the page to open. pointerup rather than click avoids the tap delay some
  // mobile browsers still apply; the distance check is what keeps it from
  // firing at the end of a swipe, which gestures.ts relies on.
  let downX = 0
  let downY = 0
  document.addEventListener('pointerdown', (e) => {
    downX = e.clientX
    downY = e.clientY
  })
  document.addEventListener('pointerup', (e) => {
    if (open) return
    const gate = document.getElementById('gate')
    if (gate && !gate.hidden && gate.contains(e.target as Node)) return
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > TAP_SLOP_PX) return
    setOpen(true)
  })

  // Anything that reaches the scrim itself is outside the wedge — the bands and
  // buttons stop their own events.
  scrim.addEventListener('pointerup', (e) => {
    e.stopPropagation()
    setOpen(false)
  })

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false)
  })

  const bar = (v: number): string => {
    const n = Math.round(Math.max(0, Math.min(1, v)) * 18)
    return '#'.repeat(n).padEnd(18, '.')
  }

  return {
    update(p, s) {
      // The one per-frame DOM write in the app, and only when asked for.
      if (!open || !prefs.showStats) return
      stats.textContent = [
        `${(1000 / s.frameMs).toFixed(0)} fps   ${s.frameMs.toFixed(1)} ms   @${s.pixelRatio}x`,
        `level ${bar(p.level)} ${p.level.toFixed(2)}`,
        `low   ${bar(p.low)} ${p.low.toFixed(2)}`,
        `mid   ${bar(p.mid)} ${p.mid.toFixed(2)}`,
        `high  ${bar(p.high)} ${p.high.toFixed(2)}`,
        `trans ${bar(p.transient)} ${p.transient.toFixed(2)}`,
        `tilt  ${bar(p.tilt)} ${p.tilt.toFixed(2)}`,
        `break ${bar(p.breakdown)} ${p.breakdown.toFixed(2)}`,
        `surge ${bar(p.surge)} ${p.surge.toFixed(2)}`,
        `novel ${bar(p.novelty)} ${p.novelty.toFixed(2)}`,
        `rough ${bar(p.roughness)} ${p.roughness.toFixed(2)}`,
        // Only when there is a sensor. On a laptop the line would read 0.00
        // forever and say nothing; on a phone it is the only way to see what
        // the shake thresholds are actually being fed.
        ...(s.disturb === undefined ? [] : [`shake ${bar(s.disturb)} ${s.disturb.toFixed(2)}`]),
        // The two numbers that tell a dead sensor apart from a shake that is
        // simply not hard enough. `samples` counts accelerometer readings
        // ever accepted — stuck at 0 means no devicemotion is arriving at
        // all. `peak` is the recent high-water AC magnitude in m/s²; the
        // re-roll needs it over 18, three times inside 1.2s. Without both,
        // "the shake doesn't work" is two indistinguishable bug reports.
        ...(s.samples === undefined
          ? []
          : [
              `motion ${s.samples} ev  peak ${(s.peak ?? 0).toFixed(1)}/18` +
                // Only shown when it is non-zero, because on a healthy device
                // it always is zero and a permanent "drop 0" teaches nothing.
                (s.rejected ? `  drop ${s.rejected}` : ''),
            ]),
        // Why the autopilot has not done anything. Without this the three
        // restraint rules in director.ts are indistinguishable from a broken
        // feature — see Director.status().
        ...(s.director === undefined
          ? []
          : [
              s.director.suspended > 0
                ? `auto held ${Math.ceil(s.director.suspended)}s (manual)`
                : !s.warm
                  ? 'auto warming'
                  : `auto ${s.director.candidate ?? '—'} ` +
                    `${Math.floor(s.director.candidateHeld)}s  ` +
                    `next ${Math.ceil(s.director.tillView)}s`,
            ]),
        // Separates "nothing asked for a buzz" from "asked and refused" from
        // "asked, accepted, and the phone did nothing you could feel".
        ...(s.haptics === undefined
          ? []
          : [
              !s.haptics.supported
                ? 'buzz unsupported'
                : s.haptics.suppressed > 0
                  ? `buzz off (reduced-motion) ${s.haptics.suppressed}`
                  : `buzz ${s.haptics.accepted}/${s.haptics.attempts}`,
            ]),
        // "We lost full screen" is three different bugs wearing one sentence:
        // a platform that has no element fullscreen at all, a request the
        // browser refused, and a request that landed and was then exited. The
        // error name is what separates the middle case from the others.
        ...(s.fullscreen === undefined
          ? []
          : [
              `full ${s.fullscreen.state}` +
                (s.fullscreen.attempts > 1 ? ` ×${s.fullscreen.attempts}` : '') +
                (s.fullscreen.error ? ` (${s.fullscreen.error})` : ''),
            ]),
      ].join('\n')
    },

    cycleAtmosphericView(direction) {
      const i = atmosphericKeys.indexOf(prefs.atmosphericView)
      const next = atmosphericKeys[(i + direction + atmosphericKeys.length) % atmosphericKeys.length]
      prefs.atmosphericView = next
      savePrefs(prefs)
      handlers.onAtmosphericView(next)
      const b = bandNamed('atmospheric')
      b.rot = restingRot(b)
      paintBands()
    },

    autopilot: () => prefs.autopilot,

    adopt(next) {
      if (next.geoColour) {
        prefs.geoColour = next.geoColour
        handlers.onGeoColour(prefs.geoColour)
      }
      if (next.atmosphericView) {
        prefs.atmosphericView = next.atmosphericView
        handlers.onAtmosphericView(prefs.atmosphericView)
        bandNamed('atmospheric').rot = restingRot(bandNamed('atmospheric'))
      }
      savePrefs(prefs)
      // Only repaint what is visible; the HUD is closed most of the time and
      // setOpen re-reads everything from prefs anyway.
      if (open) {
        paintBands()
        paintRgb()
        paintButtons()
        paintColourPopup()
      }
    },

    cycleGeometricView(direction) {
      const i = geometricKeys.indexOf(prefs.geometricView)
      const next = geometricKeys[(i + direction + geometricKeys.length) % geometricKeys.length]
      prefs.geometricView = next
      savePrefs(prefs)
      handlers.onGeometricView(next)
      const b = bandNamed('geometric')
      b.rot = restingRot(b)
      paintBands()
    },
  }
}
