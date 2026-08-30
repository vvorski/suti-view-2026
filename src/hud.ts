/**
 * The control HUD: a wedge of arcs, one band per parameter.
 *
 * A 120° wedge hinged just outside the bottom-right corner — where the thumb
 * actually pivots from. Icons on the outermost arc choose what the wedge is
 * showing; the bands inside are that thing's controls, stacked outward-in.
 *
 * Everything here is an arc. There is not a straight edge in the control
 * surface, which is a rule rather than a preference: a rectangular panel of
 * sliders was tried and it read as a settings screen bolted onto a piece of
 * work, not as part of it. Arcs also happen to be what a thumb can reach on a
 * phone held one-handed, which is why the wedge existed in the first place.
 *
 * Every layer gets the same controls, and that uniformity is the point:
 *
 *   view      an arc of options, turned past a notch     (not the camera)
 *   opacity   an arc dragged 0-100
 *   R, G, B   three more arcs, dragged 0-100
 *
 * Colour used to belong only to the geometric layer. Tinting a real camera
 * image is a different gesture from tinting generated line work — it is a
 * filter over something that already has colours — but it is the same
 * arithmetic and the same control, and layers differing in what could be done
 * to them was what made the stack feel arbitrary rather than composed.
 *
 * Merge mode is a per-layer property too, for the same reason: it describes
 * how *that* layer combines with what is beneath it, so the geometric and
 * atmospheric groups each carry their own — the atmosphere's own blend, over
 * the camera, used to be hardcoded and is now this band.
 *
 * The last icon selects no layer at all: it is Listening, and holds mapping —
 * how the picture *hears*, which every layer shares equally, rather than a
 * property of any one of them.
 */

import {
  ATMOSPHERIC_VIEWS,
  type AtmosphericViewName,
  GEOMETRIC_VIEWS,
  type GeometricViewName,
} from './views'
import { MERGE_MODES, type MergeModeName } from './merge-modes'
import { MAPPINGS, type MappingName, type VisualParams } from './engine'
import { type GeoColour } from './geo-colour'
import { savePrefs, type Prefs, type SkyOverride } from './prefs'

const SVG_NS = 'http://www.w3.org/2000/svg'
const DEG = Math.PI / 180
const TAU = Math.PI * 2

/** The wedge's opening, in degrees about the hinge. Drives the tick rim and
 *  the enum bands, which are read at the notch and never need their ends —
 *  see SCALAR_A/SCALAR_B for why a scalar band cannot use this directly. */
const SWEEP_A = 165
const SWEEP_B = 285
/**
 * A scalar band's own, narrower span — its track, its knob's travel, and the
 * angle a drag maps back to a value all use this instead of SWEEP_*.
 *
 * From a bottom-right hinge the screen occupies exactly 180°-270°; SWEEP_*
 * is 30° wider than that on purpose, so an enum band's ends can sit off-
 * screen with nothing lost, since they're only ever read at the notch. A
 * scalar band maps its *whole range* onto that arc, so its own ends — 100%
 * and 0% — landed off-screen too, at roughly 15%/85% reachable rather than
 * 0%/100%. Symmetric about the 225° notch, like SWEEP_*, so 50% stays put:
 * 8.3px inside the viewport at 320×568 (10.6px at 360×640), which 186°-264°
 * does not quite clear and 192°-258° clears with 4° more travel spent than
 * needed. Costs sensitivity — the full range is 70° now instead of 120°,
 * about 1.7x more value per degree of thumb travel — which is worth it for
 * ends that are actually reachable. See docs/todo.md entry 14.
 */
const SCALAR_A = 190
const SCALAR_B = 260
/** Where a selection is read off. Midway along the sweep. */
const NOTCH = 225 * DEG
/** Angular spacing between adjacent options on an enum band. */
const PITCH = 26 * DEG
/** Options fade out this far from the notch, so a band reads as a strip
 *  passing a window rather than a full circle of equal candidates. */
const CUTOFF = 40 * DEG

/**
 * Band radii, as fractions of the smaller viewport dimension, outermost first.
 *
 * Six, because that is the most any one selection needs now: view, merge,
 * opacity, and three colour channels, for the geometric and atmospheric
 * layers. A selection with fewer takes the first few and the rest are simply
 * not built, so the spacing never depends on how many there happen to be.
 *
 * The sixth radius, 0.33, is new: the old single merge-mode band lived at
 * 0.30 in the retired `set` group, so an arc this small is already proven
 * draggable on a phone.
 */
const BAND_R = [0.88, 0.75, 0.63, 0.53, 0.43, 0.33]

/** The icon arc, outside every band and the tick rim. */
const R_CHIPS = 1.08
/** Where the icon arc is centred — not the notch. A symmetric arc at this
 *  radius puts the first icon's left edge at roughly x=0 on a 320px screen;
 *  the wedge's corner hinge means the arc leaves the screen sooner at the
 *  top-left than at the bottom-right, so rotating it buys margin at both ends. */
const CHIP_ARC_MID = 232 * DEG
/** Gap between neighbouring icons along their arc, in px. */
const CHIP_GAP = 5
/**
 * The smallest start angle the leading (leftmost) chip may sit at.
 *
 * Centring blindly on CHIP_ARC_MID works for up to six chips — at 320×568 the
 * centred start is 210°, already clear of this. A seventh does not append a
 * slot, it re-centres all seven and pushes the leading one off the left edge
 * (205.6° there, putting its left edge at roughly -5.7px). This is the clamp
 * that keeps the row sliding toward the reachable end instead of centring
 * blind once it runs out of room — about 209° leaves a 4px margin. See
 * docs/todo.md entry 19.
 */
const CHIP_ARC_MIN_START = 209 * DEG

/**
 * Where chip `index` of `n` total sits on the icon arc, in viewport pixels.
 *
 * Pure and exported rather than folded only into `placeChips` below: a
 * non-HUD element (the fullscreen chip, entry 19) has to sit on the exact
 * same arc without a floating button bolted on beside it, and it lives
 * outside the HUD's own container on purpose — see that entry's own
 * reasoning for why. `n` must count every chip that will actually be shown,
 * including the caller's own, since the clamp above depends on the true row
 * length before anything is laid out.
 */
export function chipPosition(index: number, n: number, chipSize: number): [number, number] {
  const w = window.innerWidth
  const h = window.innerHeight
  const base = Math.min(w, h)
  const cx = w + 10
  const cy = h + 10
  const r = base * R_CHIPS
  const step = (chipSize + CHIP_GAP) / r
  const start = Math.max(CHIP_ARC_MID - ((n - 1) / 2) * step, CHIP_ARC_MIN_START)
  const a = start + index * step
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

/** A tap that travels further than this is a drag or a swipe, not a tap —
 *  entry 27 removed the pointer-swipe gestures that once claimed anything
 *  past this boundary, so it now simply marks what a tap-to-open is not.
 *  Exported so main.ts's screenshot band uses the exact same boundary rather
 *  than a second copy of the same number. */
export const TAP_SLOP_PX = 12
/** Half-width of an invisible grab arc. The thumb-safe minimum this file is
 *  built around; the drawn tracks are far thinner. */
const GRAB_PX = 24

/** Per-channel identity, used by every layer's colour bands. */
const CHANNELS = [
  { key: 'r' as const, label: 'R', tint: '#ff4d5e' },
  { key: 'g' as const, label: 'G', tint: '#4dff8f' },
  { key: 'b' as const, label: 'B', tint: '#5c8bff' },
]

const MAPPING_LABELS: Record<MappingName, string> = {
  relative: 'Relative',
  'speech-band': 'Absolute',
  'auto-normalised': 'Normalised',
  beat: 'Beat',
  dynamics: 'Dynamics',
  'bass-led': 'Bass-led',
}

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
      /** Posture, disturbance and agitation reaching the picture's colour —
       *  docs/todo.md entry 58. See motion-bias.ts's own file comment for
       *  what each of the three means. */
      motion?: { posture: number; disturbance: number; agitation: number }
      /** The clock's own current pair, and the outdoor-reading override's
       *  own fade position — docs/todo.md entry 53. */
      sky?: { daylight: number; warmth: number; override: number }
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
        want: boolean
        armed: boolean
      }
      /** docs/todo.md entry 65 — whether the OS itself is asking for less
       *  motion, since that single fact explains three otherwise-unrelated
       *  symptoms at once: a silent start-disc pulse, a silent byline glow,
       *  and silent shake-flash tiers. */
      reducedMotion?: boolean
      /** docs/todo.md entry 73 — a frozen camera and a working one are
       *  identical when the room itself is still. `open` without `live` is
       *  exactly the failure this entry exists to name. */
      camera?: { open: boolean; live: boolean }
    },
  ): void
  /** Adopt a change decided elsewhere — the autopilot (director.ts) or a
   *  shake-driven shuffle (main.ts). Updates the stored preferences and the
   *  dial without itself reporting a manual change; whether the autopilot
   *  should stand down is the caller's decision, not this one's. */
  adopt(next: {
    geometricView?: GeometricViewName
    atmosphericView?: AtmosphericViewName
    mergeMode?: MergeModeName
    atmMergeMode?: MergeModeName
    geoColour?: GeoColour
    atmColour?: GeoColour
    camColour?: GeoColour
    /** 0-1. Only ever set by a shuffle depth ladder deep enough to include
     *  opacity — see docs/todo.md entry 15. */
    geoAlpha?: number
    atmAlpha?: number
    mapping?: MappingName
    /** 0-1, the camera's actual, already-resolved passthrough level — see
     *  docs/todo.md entry 22. The caller has already done whatever asking
     *  or permission-checking was needed before this is set; `adopt()` only
     *  ever records the result, the same way it never itself asks for a
     *  colour or a merge mode. */
    passthrough?: number
  }): void
  /**
   * The four continuous quantities a light shake's nudge needs to read
   * before it can move them — docs/todo.md entry 35. `shuffled()` is pure
   * and cannot see the screen itself, so this is the accessor that lets a
   * nudge start from what is actually on screen rather than from an absolute
   * roll. Read-only, one fact read back out rather than pushed in.
   */
  current(): { geoColour: GeoColour; atmColour: GeoColour; geoAlpha: number; atmAlpha: number }
  /**
   * Open the panel — docs/todo.md entries 41 and 52. main.ts's single
   * recogniser calls this once it resolves a double tap anywhere on the
   * picture (entry 52 retired the middle-third zone a plain tap used to
   * need); this file no longer listens for that tap itself, since two
   * independent recognisers agreeing through a capture-phase
   * `stopPropagation()` is exactly what entry 41 replaced with one.
   */
  open(): void
  /** Close the panel without the scrim's own tap-to-close gesture —
   *  docs/todo.md entry 72: entering camera mode closes the panel as part
   *  of the same tap that enters it, which is not a tap on the scrim at
   *  all. */
  close(): void
  /**
   * Whether the numeric readout is showing this session — docs/todo.md
   * entry 31. Not the same as `prefs.showStats`: a `?debug` load shows the
   * readout for that load only, without writing the choice back, so a
   * caller gating other diagnostics (main.ts's shake flash) on "is it on
   * screen right now" needs this rather than the stored preference.
   */
  showingStats(): boolean
}

interface Handlers {
  onGeometricView(name: GeometricViewName): void
  onAtmosphericView(name: AtmosphericViewName): void
  /** A layer's own blend, over what's beneath it. */
  onMergeMode(layer: 'geo' | 'atm', mode: MergeModeName): void
  onMapping(name: MappingName): void
  /** 0-1, a layer's opacity. */
  onAlpha(layer: 'geo' | 'atm', a: number): void
  /** A layer's colour gain. */
  onColour(layer: 'geo' | 'atm' | 'cam', colour: GeoColour): void
  /**
   * 0-1 of the passthrough camera.
   *
   * Async and able to fail, unlike every other handler here, because the first
   * non-zero value is what actually asks for the camera — and the person can
   * say no. Resolves to the opacity really achieved, so the band can snap back
   * to 0 on a refusal rather than sitting somewhere untrue.
   */
  onPassthrough(a: number): Promise<number>
  /** The sky override — docs/todo.md entries 47 and 71. Unlike `gravity`,
   *  which main.ts reads from `prefs` itself once per frame, this is a
   *  scene.ts render setting with its own fade, so it needs an explicit
   *  call rather than a value polled every frame. */
  onSkyOverride(state: SkyOverride): void
  /** Enter camera mode — docs/todo.md entry 72. The panel is already closed
   *  by the time this fires (the chip's own onTap calls `setOpen(false)`
   *  directly); this is only main.ts's half — raising the passthrough
   *  override and taking over the tap dispatch. */
  onCameraMode(): void
  /** Fired on every change the user makes by hand, so the autopilot can get
   *  out of the way. Not fired for `adopt`. */
  onManualChange(): void
}

/** Bold geometric masses, because a 20px drawing over a moving visualiser
 *  survives as a silhouette and not as a hairline. Each fills currentColor. */
const ICONS: Record<string, string> = {
  geo:
    '<path d="M12.9 1.2a10.8 10.8 0 0 1 9.3 16.1l-9.3-5.4z"/>' +
    '<path d="M22.2 17.3a10.8 10.8 0 0 1-18.6 0l9.3-5.4z" fill-opacity=".6"/>' +
    '<path d="M3.6 17.3A10.8 10.8 0 0 1 11.1 1.2v10.7z" fill-opacity=".34"/>',
  atm:
    '<path d="M1.4 15.6c3-5.4 6-5.4 9 0s6 5.4 9 0 2.8-4.2 3.2-3.4v9.2H1.4z"/>' +
    '<path d="M1.4 9.4c3-5.4 6-5.4 9 0s6 5.4 9 0 2.8-4.2 3.2-3.4v4.6c-1 .4-2 1.4-3.2 3.4-3 5.4-6 5.4-9 0s-6-5.4-9 0z" fill-opacity=".5"/>',
  cam:
    '<path d="M1.4 2.6h6v3.4H4.8v12H7.4v3.4h-6z"/>' +
    '<path d="M22.6 2.6h-6V6h2.6v12h-2.6v3.4h6z"/>' +
    '<circle cx="12" cy="12" r="5.6"/>',
  // A shutter button, not a camera body — deliberately distinct from `cam`
  // above (the passthrough band's own group, opened to adjust a mix) since
  // this chip does something different: it enters a mode rather than
  // opening a control. docs/todo.md entry 72.
  shutter:
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<circle cx="12" cy="12" r="4.6"/>',
  // Three concentric arcs, like sound arriving — chosen over the old
  // diagonal-and-blocks glyph (which read as "settings", the mistake this
  // group's rename fixes) and over a level meter (already the numeric
  // readout icon's shape).
  ear:
    '<path d="M9.6 9.6a3.4 3.4 0 0 1 4.8 4.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M6.4 6.4a8 8 0 0 1 11.2 11.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-opacity=".62"/>' +
    '<path d="M3.2 3.2a12.6 12.6 0 0 1 17.6 17.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-opacity=".34"/>',
  num:
    '<path d="M1.6 21V13.4h5.2V21zM9.4 21V6.6h5.2V21zM17.2 21V1.4h5.2V21z"/>' +
    '<path d="M1 22.4h22v1.6H1z" fill-opacity=".45"/>',
  // Four corner brackets, the universal fullscreen mark — straight lines are
  // fine inside a chip, since the circular non-negotiable governs the
  // control surface, not every icon drawn on it (see `cam`'s own brackets).
  // Lives outside this file's own chip set (docs/todo.md entry 19), but the
  // glyph is defined here so main.ts's element and this file's icons never
  // drift into two different fullscreen marks.
  full:
    '<path d="M1 9V1h8v3H4v5z"/>' +
    '<path d="M23 9V1h-8v3h5v5z"/>' +
    '<path d="M1 15v8h8v-3H4v-5z"/>' +
    '<path d="M23 15v8h-8v-3h5v-5z"/>',
  // A plumb bob: a mount, a line, a weight — the plainest glyph for "this
  // answers which way is down". Straight lines are fine here for the same
  // reason `full`'s brackets are — see that icon's own comment.
  grav:
    '<path d="M8 1.4h8v2.6H8z"/>' +
    '<path d="M11.2 4v7.4h1.6V4z"/>' +
    '<circle cx="12" cy="16.4" r="6.2"/>',
  // A filled disc with eight rays — docs/todo.md entry 47. Named for what
  // turning the chip *on* does, not a moon: the icon set is already a
  // visual vocabulary (three wedges for geo, stacked waves for atm,
  // concentric arcs for the ear) and a sun needs no explaining next to them.
  day:
    '<circle cx="12" cy="12" r="4.6"/>' +
    '<g stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<line x1="12" y1="0.8" x2="12" y2="3.4"/>' +
    '<line x1="12" y1="20.6" x2="12" y2="23.2"/>' +
    '<line x1="0.8" y1="12" x2="3.4" y2="12"/>' +
    '<line x1="20.6" y1="12" x2="23.2" y2="12"/>' +
    '<line x1="4.2" y1="4.2" x2="6.1" y2="6.1"/>' +
    '<line x1="17.9" y1="17.9" x2="19.8" y2="19.8"/>' +
    '<line x1="4.2" y1="19.8" x2="6.1" y2="17.9"/>' +
    '<line x1="17.9" y1="6.1" x2="19.8" y2="4.2"/>' +
    '</g>',
}

const CSS = `
.hud-scrim {
  position: fixed; inset: 0; z-index: 30;
  opacity: 0; pointer-events: none;
  transition: opacity 200ms ease;
  /* Dimmed only where the HUD actually is. A full-screen scrim would hide the
     visualiser, which is the one thing you need to see while adjusting it. */
  background: radial-gradient(
    130% 95% at 100% 100%,
    rgba(3, 4, 8, 0.86) 0%, rgba(3, 4, 8, 0.58) 46%, rgba(3, 4, 8, 0) 80%);
}
.hud-scrim.open { opacity: 1; pointer-events: auto; }
@media (prefers-reduced-motion: reduce) { .hud-scrim { transition: none; } }

.hud-dial { position: absolute; inset: 0; width: 100%; height: 100%; }
/* Only the grab arcs take input; everywhere else falls through to the scrim,
   which closes. */
.hud-dial * { pointer-events: none; }
.hud-dial .hit { pointer-events: stroke; cursor: pointer; }

.hud-track { fill: none; stroke: rgba(18,18,35,0.78); }
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

.hud-fill { fill: none; stroke-linecap: round; }
.hud-knob { stroke: none; }
/* The atmospheric texture: a soft, wide field behind the fill it belongs to —
   a continuous layer reads as a glow, not an edge. See docs/hud-design.md. */
.hud-halo { fill: none; stroke-linecap: round; opacity: 0.22; }
/* A band's own name and value, on the notch line just inside its radius —
   clear of the option labels, which sit on the radius itself. */
.hud-band-label {
  font: 500 9.5px ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.08em; text-transform: uppercase;
  text-anchor: middle; dominant-baseline: middle;
}

.hud-btns { position: absolute; inset: 0; pointer-events: none; }
/* Invisible must also mean untappable. The scrim is pointer-events:none when
   closed, but a child that sets pointer-events:auto is still a hit target
   regardless of its parent — so with the HUD shut, a tap that happened to land
   where an icon sits changed the selected group and swallowed the tap that was
   meant to open the thing. Nothing visible happened, which is the worst
   version of that bug. */
.hud-scrim:not(.open) .hud-chip { pointer-events: none; }
.hud-chip {
  appearance: none; cursor: pointer; position: absolute; pointer-events: auto;
  width: 3rem; height: 3rem; padding: 0;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(12,12,26,0.85);
  border: 1px solid rgba(44,41,71,0.9);
  color: #8a86a4;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}
.hud-chip[aria-pressed='true'] {
  background: rgba(26,24,48,0.9); border-color: var(--tint, #9d9bf0); color: #f0eeff;
}
/* (0,2,0) specificity — one class plus one attribute — beats .hud-chip's own
   (0,1,0) display:flex without needing !important. Without this, the UA
   stylesheet's own [hidden] display:none rule (0,1,0) loses to this file's
   later, equal-specificity .hud-chip rule, and an element's own hidden
   attribute does nothing. Missing this made a hidden fullscreen chip
   (docs/todo.md entry 19) visible from the moment the HUD's CSS loaded,
   which reads as fullscreen having been lost the instant it was entered. */
.hud-chip[hidden] { display: none; }
.hud-icon { width: 19px; height: 19px; display: block; }

.hud-stats {
  position: absolute; margin: 0;
  left: calc(0.75rem + env(safe-area-inset-left, 0px));
  top: calc(0.75rem + env(safe-area-inset-top, 0px));
  font: 400 10.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre; color: #77809a; pointer-events: none;
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

/** A ring of discrete options, turned past the notch. */
interface EnumBand {
  readonly kind: 'enum'
  readonly name: string
  readonly keys: readonly string[]
  label(k: string): string
  current(): string
  commit(k: string): void
  /** Rotation, in radians. 0 puts keys[0] under the notch. */
  rot: number
}

/**
 * A continuous 0-1 value, dragged along its arc.
 *
 * `texture` is what says which layer this is, for the one band type where
 * that matters — see docs/hud-design.md. Left undefined it means "colour
 * channel": every layer's R/G/B stays visually identical on purpose, because
 * a colour band must read as a colour band wherever it appears.
 */
interface ScalarBand {
  readonly kind: 'scalar'
  readonly name: string
  readonly tint: string
  readonly texture?: 'solid' | 'halo' | 'segmented'
  current(): number
  /** Live, on every pointermove. */
  apply(v: number): void
  /** Once, on release — where persistence and any prompting belong. */
  settle(): void
}

type Band = EnumBand | ScalarBand

/**
 * `debugFromUrl` forces the readout on for this load only, without touching
 * `prefs.showStats` — docs/todo.md entry 31. Kept as its own parameter
 * rather than folded into `prefs`, which is exactly the mistake this entry
 * exists to undo: `prefs` is what persists, and a per-load URL flag is not
 * a persisted fact.
 */
export function createHud(prefs: Prefs, handlers: Handlers, debugFromUrl = false): Hud {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const scrim = document.createElement('div')
  scrim.className = 'hud-scrim'
  scrim.setAttribute('role', 'dialog')
  scrim.setAttribute('aria-label', 'Controls')

  /** What is actually on screen this session — see docs/todo.md entry 31.
   *  Starts from the stored preference or, for this load only, `?debug`;
   *  only the `num` chip below ever writes it back to `prefs`. */
  let showStats = debugFromUrl || prefs.showStats

  const stats = document.createElement('pre')
  stats.className = 'hud-stats'
  stats.hidden = !showStats
  scrim.appendChild(stats)

  const svg = el('svg', { class: 'hud-dial' })
  scrim.appendChild(svg)

  const btnBar = document.createElement('div')
  btnBar.className = 'hud-btns'
  scrim.appendChild(btnBar)

  document.body.appendChild(scrim)

  const manual = (): void => handlers.onManualChange()

  const geometricKeys = Object.keys(GEOMETRIC_VIEWS) as GeometricViewName[]
  const atmosphericKeys = Object.keys(ATMOSPHERIC_VIEWS) as AtmosphericViewName[]
  const mergeKeys = Object.keys(MERGE_MODES) as MergeModeName[]
  const mappingKeys = Object.keys(MAPPINGS) as MappingName[]

  /** What the camera band shows, which during a drag runs ahead of what has
   *  actually been granted. onPassthrough is the only thing allowed to make it
   *  true — see the camera opacity band's settle(). */
  let camShown = 0

  /** Save, keeping the legacy `mix` in step with the geometric alpha. Nothing
   *  reads `mix` any more, but it is the field older builds and older shared
   *  links use, so writing it means landing back on an earlier build shows the
   *  picture you left rather than a default. */
  const save = (): void => {
    prefs.mix = prefs.geoAlpha
    savePrefs(prefs)
  }

  /** The three colour bands every layer gets, built from one description. */
  function colourBands(layer: 'geo' | 'atm' | 'cam', read: () => GeoColour): ScalarBand[] {
    return CHANNELS.map(({ key, label, tint }) => ({
      kind: 'scalar' as const,
      name: label,
      tint,
      current: () => read()[key],
      apply: (v: number) => {
        const next = { ...read(), [key]: v }
        if (layer === 'geo') prefs.geoColour = next
        else if (layer === 'atm') prefs.atmColour = next
        else prefs.camColour = next
        handlers.onColour(layer, next)
        manual()
      },
      settle: save,
    }))
  }

  /** A layer's own merge-mode band — how it combines with what's beneath it. */
  function mergeBand(layer: 'geo' | 'atm'): EnumBand {
    return {
      kind: 'enum',
      name: 'Merge',
      keys: mergeKeys,
      label: (k) => MERGE_MODES[k as MergeModeName].label,
      current: () => (layer === 'geo' ? prefs.mergeMode : prefs.atmMergeMode),
      commit: (k) => {
        if (layer === 'geo') prefs.mergeMode = k as MergeModeName
        else prefs.atmMergeMode = k as MergeModeName
        save()
        handlers.onMergeMode(layer, k as MergeModeName)
        manual()
      },
      rot: 0,
    }
  }

  function alphaBand(layer: 'geo' | 'atm', tint: string): ScalarBand {
    return {
      kind: 'scalar',
      name: 'Opacity',
      tint,
      // Geometric is drawn line work — solid, square-capped, the plainest
      // reading of "a stroke". Atmospheric is a continuous field, so its
      // opacity band carries a soft halo behind it rather than a hard edge.
      // See docs/hud-design.md.
      texture: layer === 'geo' ? 'solid' : 'halo',
      current: () => (layer === 'geo' ? prefs.geoAlpha : prefs.atmAlpha),
      apply: (v) => {
        if (layer === 'geo') prefs.geoAlpha = v
        else prefs.atmAlpha = v
        handlers.onAlpha(layer, v)
        manual()
      },
      settle: save,
    }
  }

  /** What each icon puts on the wedge. Same shape for every layer, which is
   *  the point — see the file comment. */
  const GROUPS: Record<string, { tint: string; name: string; bands: Band[] }> = {
    geo: {
      tint: '#9d9bf0',
      name: 'Geometric layer',
      bands: [
        {
          kind: 'enum',
          name: 'View',
          keys: geometricKeys,
          label: (k) => GEOMETRIC_VIEWS[k as GeometricViewName].label,
          current: () => prefs.geometricView,
          commit: (k) => {
            prefs.geometricView = k as GeometricViewName
            save()
            handlers.onGeometricView(prefs.geometricView)
            manual()
          },
          rot: 0,
        },
        mergeBand('geo'),
        alphaBand('geo', '#9d9bf0'),
        ...colourBands('geo', () => prefs.geoColour),
      ],
    },
    atm: {
      tint: '#4dd6ff',
      name: 'Atmospheric layer',
      bands: [
        {
          kind: 'enum',
          name: 'View',
          keys: atmosphericKeys,
          label: (k) => ATMOSPHERIC_VIEWS[k as AtmosphericViewName].label,
          current: () => prefs.atmosphericView,
          commit: (k) => {
            prefs.atmosphericView = k as AtmosphericViewName
            save()
            handlers.onAtmosphericView(prefs.atmosphericView)
            manual()
          },
          rot: 0,
        },
        mergeBand('atm'),
        alphaBand('atm', '#4dd6ff'),
        ...colourBands('atm', () => prefs.atmColour),
      ],
    },
    cam: {
      tint: '#ffcf8a',
      name: 'Camera layer',
      // No view band: the camera's programme is the room. Its opacity takes
      // the outermost radius instead, so a group with fewer bands is simply
      // shorter rather than leaving a gap where a control used to be.
      bands: [
        {
          kind: 'scalar',
          name: 'Opacity',
          tint: '#ffcf8a',
          // Sampled reality, not drawn — a broken line rather than a
          // continuous one. See docs/hud-design.md.
          texture: 'segmented',
          current: () => camShown,
          apply: (v) => {
            camShown = v
            manual()
          },
          settle: () => {
            // The one control whose value is not ours to decide: the first
            // non-zero drag is what asks for the camera, and the answer can
            // be no.
            void handlers.onPassthrough(camShown).then((granted) => {
              camShown = granted
              prefs.passthrough = granted
              save()
              build()
            })
          },
        },
        ...colourBands('cam', () => prefs.camColour),
      ],
    },
    ear: {
      tint: '#c8c4e6',
      name: 'Listening',
      // Mapping alone: it drives every layer equally, so it belongs to a
      // group named for what it is — how the picture hears — rather than to
      // any one layer, or to a leftover "settings" catch-all.
      bands: [
        {
          kind: 'enum',
          name: 'Map',
          keys: mappingKeys,
          label: (k) => MAPPING_LABELS[k as MappingName],
          current: () => prefs.mapping,
          commit: (k) => {
            prefs.mapping = k as MappingName
            save()
            handlers.onMapping(prefs.mapping)
            manual()
          },
          rot: 0,
        },
      ],
    },
  }

  let group = 'geo'

  // ── geometry ────────────────────────────────────────────────────────────

  let cx = 0
  let cy = 0
  let base = 0

  const polar = (r: number, a: number): [number, number] => [
    cx + r * Math.cos(a),
    cy + r * Math.sin(a),
  ]

  function arcPath(r: number, a0: number, a1: number): string {
    const [x0, y0] = polar(r, a0)
    const [x1, y1] = polar(r, a1)
    return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`
  }

  /** Pointer position as an angle about the hinge, in the svg's own coordinate
   *  space (which is CSS pixels). */
  function angleFrom(e: PointerEvent): number {
    const r = svg.getBoundingClientRect()
    return Math.atan2(e.clientY - r.top - cy, e.clientX - r.left - cx)
  }

  /** Where an angle falls along a scalar band's own span, as 0-1, clamped to
   *  its ends. Only ever called from a scalar band's drag — see SCALAR_A/
   *  SCALAR_B for why that span is narrower than the wedge's own SWEEP_*.
   *  Built on delta() rather than "(a-a0)/(a1-a0)" so it survives a0/a1
   *  straddling the 0/360 wrap. */
  function angleToUnit(a: number): number {
    const t = delta(a, SCALAR_A * DEG) / delta(SCALAR_B * DEG, SCALAR_A * DEG)
    return Math.max(0, Math.min(1, t))
  }

  /**
   * Take the pointer, if the browser will.
   *
   * Capture keeps a drag alive once the finger wanders off a 48px arc, which
   * happens constantly. It is an enhancement and must never be what arms the
   * drag: setPointerCapture throws on an id that is not an active pointer, and
   * a throw above the line that sets the flag abandons the gesture rather than
   * degrading it.
   */
  function capture(hit: SVGPathElement, e: PointerEvent): void {
    try {
      hit.setPointerCapture(e.pointerId)
    } catch {
      // No capture; the flag carries the drag on its own.
    }
  }

  function bindArcDrag(hit: SVGPathElement, band: ScalarBand): void {
    let live = false
    const set = (e: PointerEvent): void => {
      band.apply(angleToUnit(angleFrom(e)))
      paint()
    }
    hit.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      capture(hit, e)
      live = true
      set(e)
    })
    hit.addEventListener('pointermove', (e) => {
      if (live) set(e)
    })
    const end = (e: PointerEvent): void => {
      if (!live) return
      live = false
      e.stopPropagation()
      band.settle()
    }
    hit.addEventListener('pointerup', end)
    hit.addEventListener('pointercancel', end)
  }

  function bindTurnDrag(hit: SVGPathElement, band: EnumBand): void {
    let last = 0
    let moved = false
    hit.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      capture(hit, e)
      last = angleFrom(e)
      moved = true
    })
    hit.addEventListener('pointermove', (e) => {
      if (!moved) return
      const a = angleFrom(e)
      let rot = band.rot + delta(a, last)
      last = a
      // Can't spin an option out past either end of the strip.
      const lo = -(band.keys.length - 1) * PITCH
      if (rot > 0) rot = 0
      if (rot < lo) rot = lo
      band.rot = rot
      paint()
    })
    const settle = (e: PointerEvent): void => {
      if (!moved) return
      moved = false
      e.stopPropagation()
      const i = Math.max(0, Math.min(band.keys.length - 1, Math.round(-band.rot / PITCH)))
      band.rot = -i * PITCH
      // Commit before repainting, so the repaint's read of "what's current"
      // already reflects it.
      if (band.keys[i] !== band.current()) band.commit(band.keys[i])
      paint()
    }
    hit.addEventListener('pointerup', settle)
    hit.addEventListener('pointercancel', settle)
  }

  // ── build ───────────────────────────────────────────────────────────────

  interface Drawn {
    band: Band
    r: number
    labels: SVGTextElement[]
    fill?: SVGPathElement
    knob?: SVGCircleElement
    caption: SVGTextElement
    selector?: SVGPathElement
    /** The atmospheric texture's wide, faint path, drawn behind `fill`. */
    halo?: SVGPathElement
  }
  let drawn: Drawn[] = []

  const chips = new Map<string, HTMLButtonElement>()

  function mkChip(id: string, name: string, tint: string, onTap: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'hud-chip'
    b.style.setProperty('--tint', tint)
    b.setAttribute('aria-label', name)
    b.innerHTML = `<svg class="hud-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[id]}</svg>`
    b.addEventListener('pointerup', (e) => {
      e.stopPropagation()
      onTap()
    })
    btnBar.appendChild(b)
    chips.set(id, b)
    return b
  }

  for (const id of ['geo', 'atm', 'cam', 'ear'] as const) {
    mkChip(id, GROUPS[id].name, GROUPS[id].tint, () => {
      group = id
      build()
    })
  }
  const statsChip = mkChip('num', 'Numeric readout', '#9d9bf0', () => {
    // A tap is an explicit choice, so it is the one thing that writes back
    // to prefs — arriving via ?debug and never touching this chip writes
    // nothing about stats at all. See docs/todo.md entry 31.
    showStats = !showStats
    prefs.showStats = showStats
    stats.hidden = !showStats
    if (!showStats) stats.textContent = ''
    save()
    paint()
  })
  // docs/todo.md entry 30. A boolean needs a chip rather than a band, same
  // as the readout above — no visualiser call here, either: main.ts reads
  // prefs.gravity itself, once per frame, the same way it already reads
  // prefs.showStats.
  const gravChip = mkChip('grav', 'Gravity', '#9d9bf0', () => {
    prefs.gravity = !prefs.gravity
    save()
    paint()
  })
  // docs/todo.md entries 47, 53 and 71. A three-way cycle on one chip
  // rather than a band or a second chip, same precedent gravity set at
  // entry 30 for a single boolean — the circular surface is the
  // non-negotiable, and a second chip would spend scarce arc on the same
  // concept. Unlike gravity, this is a scene.ts render setting with its
  // own fade rather than something main.ts polls from prefs each frame, so
  // the toggle also calls handlers.onSkyOverride() explicitly. The `id` is
  // left as `day`: renaming it would touch the stored-shape Hard Stop for
  // no reason anyone would see on screen, and prefs.day itself is no
  // longer written here at all — entry 71 supersedes it with
  // prefs.skyOverride, and leaves the old field exactly where it was found
  // (see prefs.ts's own comment on why).
  const dayChip = mkChip('day', 'Sky: auto', '#9d9bf0', () => {
    prefs.skyOverride = prefs.skyOverride === 'auto' ? 'day' : prefs.skyOverride === 'day' ? 'night' : 'auto'
    handlers.onSkyOverride(prefs.skyOverride)
    save()
    paint()
  })
  // docs/todo.md entry 72. A momentary action, not a toggle — camera mode
  // is not stored and this chip does not track being "in" it, the way
  // gravity or the sky override do. Closes the panel itself, directly,
  // rather than asking main.ts to call back into it: "one tap enters the
  // mode and closes the panel" is one gesture, and this module already
  // owns setOpen().
  const shutterChip = mkChip('shutter', 'Camera mode', '#9d9bf0', () => {
    setOpen(false)
    handlers.onCameraMode()
  })

  /** Lay the icons along their own arc. Spacing comes from the measured chip
   *  size, so a larger root font spreads them rather than overlapping them.
   *  Seven now that entry 47 has added the day chip, having come down to
   *  six once entry 45 removed the autopilot chip — the fullscreen chip
   *  moved off this arc entirely in entry 25, which is what left the slot
   *  autopilot then took; see CHIP_ARC_MIN_START's own comment, written for
   *  exactly this. */
  function placeChips(): void {
    const all = [...chips.values()]
    const size = all[0]?.offsetWidth || 48
    all.forEach((chip, i) => {
      const [x, y] = chipPosition(i, all.length, size)
      chip.style.left = `${x - size / 2}px`
      chip.style.top = `${y - size / 2}px`
    })
  }

  function build(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    base = Math.min(w, h)
    // Hinge sits just outside the corner, so the wedge opens into the screen.
    cx = w + 10
    cy = h + 10

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    drawn = []

    const a0 = SWEEP_A * DEG
    const a1 = SWEEP_B * DEG
    const s0 = SCALAR_A * DEG
    const s1 = SCALAR_B * DEG

    // Ticks along the outer edge, as a rim for the whole wedge.
    const outer = base * BAND_R[0] + base * 0.07
    for (let d = SWEEP_A; d <= SWEEP_B; d += 3) {
      const a = d * DEG
      const major = d % 15 === 0
      const [px0, py0] = polar(outer - (major ? 8 : 4), a)
      const [px1, py1] = polar(outer, a)
      svg.appendChild(
        el('line', {
          x1: px0, y1: py0, x2: px1, y2: py1,
          class: `hud-tick${major ? ' major' : ''}`,
        }),
      )
    }
    svg.appendChild(el('path', { d: arcPath(outer + 4, a0, a1), class: 'hud-rule' }))

    const bands = GROUPS[group].bands
    bands.forEach((band, i) => {
      const r = base * BAND_R[i]
      // Enum bands are read at the notch and spin past the wedge's full
      // sweep; scalar bands map a value onto their own, narrower span so
      // both of its ends land on screen — see SCALAR_A/SCALAR_B.
      const [ba0, ba1] = band.kind === 'enum' ? [a0, a1] : [s0, s1]

      svg.appendChild(
        el('path', {
          d: arcPath(r, ba0, ba1),
          class: 'hud-track',
          'stroke-width': band.kind === 'enum' ? Math.max(30, base * 0.09) : 7,
        }),
      )

      const d: Drawn = { band, r, labels: [], caption: el('text', { class: 'hud-band-label' }) }

      if (band.kind === 'enum') {
        // Park the current option under the notch on every build, whatever a
        // previous drag left rot sitting at.
        band.rot = -Math.max(0, band.keys.indexOf(band.current())) * PITCH
        d.labels = band.keys.map(() => {
          const t = el('text', { class: 'hud-item' })
          svg.appendChild(t)
          return t
        })
        const r0 = r - base * 0.045
        const r1 = r + base * 0.045
        const p = (rr: number, half: number): [number, number] =>
          polar(rr, NOTCH + Math.atan2(half, rr))
        const [lx0, ly0] = p(r0, -13)
        const [rx0, ry0] = p(r0, 13)
        const [lx1, ly1] = p(r1, -20)
        const [rx1, ry1] = p(r1, 20)
        d.selector = el('path', {
          d: `M${lx0} ${ly0}L${lx1} ${ly1}L${rx1} ${ry1}L${rx0} ${ry0}Z`,
          class: 'hud-selector',
        })
        svg.appendChild(d.selector)
      } else {
        // The halo goes in first, so it sits behind the fill it belongs to —
        // see docs/hud-design.md for what each texture means.
        if (band.texture === 'halo') {
          d.halo = el('path', { class: 'hud-halo', 'stroke-width': base * 0.05 })
          d.halo.style.stroke = band.tint
          svg.appendChild(d.halo)
        }
        d.fill = el('path', { class: 'hud-fill', 'stroke-width': 7 })
        d.fill.style.stroke = band.tint
        if (band.texture === 'solid') d.fill.style.strokeLinecap = 'square'
        if (band.texture === 'segmented') d.fill.style.strokeDasharray = '9 6'
        svg.appendChild(d.fill)
        d.knob = el('circle', { r: 7, class: 'hud-knob' })
        d.knob.style.fill = band.tint
        svg.appendChild(d.knob)
      }

      svg.appendChild(d.caption)
      drawn.push(d)
    })

    // Grab arcs last, so they sit above everything they control.
    drawn.forEach(({ band, r }) => {
      const [ba0, ba1] = band.kind === 'enum' ? [a0, a1] : [s0, s1]
      const hit = el('path', {
        d: arcPath(r, ba0, ba1),
        class: 'hit',
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': GRAB_PX * 2,
      })
      if (band.kind === 'enum') bindTurnDrag(hit, band)
      else bindArcDrag(hit, band)
      svg.appendChild(hit)
    })

    placeChips()
    paint()
  }

  function paint(): void {
    const s0 = SCALAR_A * DEG
    const s1 = SCALAR_B * DEG

    for (const d of drawn) {
      const { band, r } = d
      if (band.kind === 'enum') {
        const sel = band.current()
        band.keys.forEach((k, i) => {
          const a = NOTCH + i * PITCH + band.rot
          const off = Math.abs(delta(a, NOTCH))
          const vis = off > CUTOFF ? 0 : 1 - (off / CUTOFF) * 0.72
          const [x, y] = polar(r, a)
          const t = d.labels[i]
          t.setAttribute('x', String(x))
          t.setAttribute('y', String(y))
          t.setAttribute('opacity', vis.toFixed(3))
          t.textContent = band.label(k)
          t.classList.toggle('on', k === sel)
        })
        // The band's own name sits inside its radius, clear of both the option
        // labels (which sit on the radius) and the selector, which reaches
        // base*0.045 either side of it. 0.10 clears the selector with room and
        // still leaves a gap before the next band inward, which is 0.13 away.
        const [lx, ly] = polar(r - base * 0.1, NOTCH)
        d.caption.setAttribute('x', String(lx))
        d.caption.setAttribute('y', String(ly))
        d.caption.textContent = band.name
        d.caption.style.fill = '#5d5a78'
      } else {
        const v = band.current()
        const va = s0 + v * (s1 - s0)
        const fillD = arcPath(r, s0, Math.max(s0 + 0.001, va))
        d.fill?.setAttribute('d', fillD)
        d.halo?.setAttribute('d', fillD)
        const [kx, ky] = polar(r, va)
        d.knob?.setAttribute('cx', String(kx))
        d.knob?.setAttribute('cy', String(ky))
        const [lx, ly] = polar(r - base * 0.05, NOTCH)
        d.caption.setAttribute('x', String(lx))
        d.caption.setAttribute('y', String(ly))
        d.caption.textContent = `${band.name} ${Math.round(v * 100)}`
        d.caption.style.fill = band.tint
      }
    }

    for (const [id, chip] of chips) {
      const on =
        id === 'num'
          ? showStats
          : id === 'grav'
            ? prefs.gravity
            : id === 'day'
              ? prefs.skyOverride !== 'auto'
              : group === id
      chip.setAttribute('aria-pressed', String(on))
    }
    // docs/todo.md entry 71: the day chip says which of its three states it
    // is currently in, since "pressed or not" can no longer distinguish
    // pinned-day from pinned-night — both are simply "pressed".
    dayChip.setAttribute(
      'aria-label',
      prefs.skyOverride === 'day' ? 'Outdoor' : prefs.skyOverride === 'night' ? 'Night' : 'Sky: auto',
    )
    void statsChip
    void gravChip
    void shutterChip
  }

  build()
  window.addEventListener('resize', build)
  // iOS reports the old viewport for a moment after a rotation, so re-measure.
  window.addEventListener('orientationchange', () => window.setTimeout(build, 250))

  // ── open / close ────────────────────────────────────────────────────────

  let open = false
  const setOpen = (v: boolean): void => {
    open = v
    scrim.classList.toggle('open', v)
    // Rebuild rather than repaint: an enum band may have been changed by the
    // autopilot or a shake-driven shuffle while the HUD was closed, and
    // build() is what parks the current option back under the notch.
    if (v) build()
    else stats.textContent = ''
    // `.hud-scrim.open` is already the fact; this is that fact made public
    // rather than something another module has to reach into this file's
    // own DOM structure to observe — docs/todo.md entry 56, whose reload
    // chip needs to know the panel's own open state and lives in a
    // separate module (version.ts) with no other reason to import this one.
    document.dispatchEvent(new CustomEvent('hud-panel', { detail: { open: v } }))
  }

  // Anything reaching the scrim itself is outside the wedge — the arcs and the
  // icons stop their own events.
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
      if (!open || !showStats) return
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
        // Only when there is a sensor. On a laptop this would read 0.00 forever
        // and say nothing; on a phone it is the only way to see what the shake
        // thresholds are actually being fed.
        ...(s.disturb === undefined ? [] : [`shake ${bar(s.disturb)} ${s.disturb.toFixed(2)}`]),
        // docs/todo.md entry 58 — posture, disturbance and agitation, the
        // three tiers feeding the picture's colour bias. Without this, a
        // feature whose whole design brief is "slight" is indistinguishable
        // from doing nothing. "bias", not "motion" — that label is already
        // the accelerometer diagnostic two lines below.
        ...(s.motion === undefined
          ? []
          : [
              `bias  post ${s.motion.posture.toFixed(2)}  ` +
                `dist ${s.motion.disturbance.toFixed(2)}  ` +
                `agit ${s.motion.agitation.toFixed(2)}`,
            ]),
        // docs/todo.md entry 53 — testable without waiting for dusk: this
        // prints exactly the pair sky.ts computed for right now, over the
        // same clock a screenshot's filename already reads.
        ...(s.sky === undefined
          ? []
          : [
              `sky   day ${s.sky.daylight.toFixed(2)}  ` +
                `warm ${s.sky.warmth >= 0 ? '+' : ''}${s.sky.warmth.toFixed(2)}` +
                // docs/todo.md entry 71: override now swings both ways —
                // positive is the outdoor-reading pin toward day, negative
                // is the new pin toward night, and only one direction can
                // ever be active (setSkyOverride sets one target, never
                // both), so a single line still says which.
                (s.sky.override > 0
                  ? `  outdoor ${Math.round(s.sky.override * 100)}%`
                  : s.sky.override < 0
                    ? `  night ${Math.round(-s.sky.override * 100)}%`
                    : ''),
            ]),
        // The two numbers that tell a dead sensor apart from a shake that is
        // simply not hard enough.
        ...(s.samples === undefined
          ? []
          : [
              `motion ${s.samples} ev  peak ${(s.peak ?? 0).toFixed(1)}/18` +
                (s.rejected ? `  drop ${s.rejected}` : ''),
            ]),
        // Why the autopilot has not done anything. Without this the restraint
        // rules in director.ts are indistinguishable from a broken feature.
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
        // "We lost full screen" is three different bugs wearing one sentence.
        // docs/todo.md entry 66: `want`/`armed` beside state, since state
        // alone cannot tell "not fullscreen and about to retry on the next
        // tap" apart from "not fullscreen and nothing is even trying" — the
        // distinction the whole entry exists to make visible.
        ...(s.fullscreen === undefined
          ? []
          : [
              `full ${s.fullscreen.state}` +
                (s.fullscreen.want ? ' want' : '') +
                (s.fullscreen.armed ? ' armed' : '') +
                (s.fullscreen.attempts > 1 ? ` ×${s.fullscreen.attempts}` : '') +
                (s.fullscreen.error ? ` (${s.fullscreen.error})` : ''),
            ]),
        // docs/todo.md entry 65 — one word turning "did the pulse not show
        // up" from a guess into a fact, since a phone in this state also
        // silently drops the byline glow and both shake-flash tiers. Named
        // "os motion" rather than "motion" — that word is already the
        // sensor diagnostic line above, and this is an unrelated OS setting.
        ...(s.reducedMotion === undefined ? [] : [`os motion ${s.reducedMotion ? 'reduced' : 'full'}`]),
        // docs/todo.md entry 73 — a frozen camera and a working one look
        // identical whenever the room itself is still, which is exactly
        // the report this line exists to stop being ambiguous.
        ...(s.camera === undefined
          ? []
          : [`cam   ${!s.camera.open ? 'closed' : s.camera.live ? 'live' : 'frozen'}`]),
      ].join('\n')
    },

    current: () => ({
      geoColour: prefs.geoColour,
      atmColour: prefs.atmColour,
      geoAlpha: prefs.geoAlpha,
      atmAlpha: prefs.atmAlpha,
    }),
    showingStats: () => showStats,
    open: () => setOpen(true),
    close: () => setOpen(false),

    adopt(next) {
      if (next.geometricView) {
        prefs.geometricView = next.geometricView
        handlers.onGeometricView(prefs.geometricView)
      }
      if (next.atmosphericView) {
        prefs.atmosphericView = next.atmosphericView
        handlers.onAtmosphericView(prefs.atmosphericView)
      }
      if (next.mergeMode) {
        prefs.mergeMode = next.mergeMode
        handlers.onMergeMode('geo', prefs.mergeMode)
      }
      if (next.atmMergeMode) {
        prefs.atmMergeMode = next.atmMergeMode
        handlers.onMergeMode('atm', prefs.atmMergeMode)
      }
      for (const [layer, colour] of [
        ['geo', next.geoColour],
        ['atm', next.atmColour],
        ['cam', next.camColour],
      ] as const) {
        if (!colour) continue
        if (layer === 'geo') prefs.geoColour = colour
        else if (layer === 'atm') prefs.atmColour = colour
        else prefs.camColour = colour
        handlers.onColour(layer, colour)
      }
      if (next.geoAlpha !== undefined) {
        prefs.geoAlpha = next.geoAlpha
        handlers.onAlpha('geo', next.geoAlpha)
      }
      if (next.atmAlpha !== undefined) {
        prefs.atmAlpha = next.atmAlpha
        handlers.onAlpha('atm', next.atmAlpha)
      }
      if (next.mapping) {
        prefs.mapping = next.mapping
        handlers.onMapping(next.mapping)
      }
      if (next.passthrough !== undefined) {
        // No handler call here, unlike every other field above: the caller
        // already resolved the actual level (including any permission check
        // and the visualiser call that follows from it) before calling
        // adopt() at all — see docs/todo.md entry 22. This only makes the
        // camera opacity band agree with what is already on screen.
        camShown = next.passthrough
        prefs.passthrough = next.passthrough
      }
      save()
      // Only redraw what is visible; the HUD is closed most of the time and
      // setOpen rebuilds from prefs anyway.
      if (open) build()
    },
  }
}
