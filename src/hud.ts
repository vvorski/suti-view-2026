/**
 * The control panel: one ring, and icons that choose what it controls.
 *
 * Tap anywhere to open. A wedge hinged just off the bottom-right corner opens
 * into the screen, carrying a single band of options past a fixed notch. What
 * that band contains is whatever the icon column currently points it at.
 *
 * This replaced four different control idioms living in the same corner —
 * three stacked concentric bands, a separate mix arc, and three chip-anchored
 * popups with mutual-exclusion logic between them. The popups were the reason
 * this file once needed to dim the bands underneath them (a popup reached
 * 172px across the bands and made the HUD unreadable on a phone); with one
 * ring there is nothing to cover and nothing to dim.
 *
 * Two shapes of thing can be controlled and there is no third:
 *
 *   enum    turn the ring, snap to whichever option settles under the notch
 *   scalar  drag along the ring, 0 to 1
 *
 * Adding a control means adding an entry to TARGETS. It does not mean adding
 * geometry, a popup, a drag binding, or a paint function, which is the whole
 * point of the shape.
 */

import {
  ATMOSPHERIC_VIEWS,
  type AtmosphericViewName,
  GEOMETRIC_VIEWS,
  type GeometricViewName,
} from './views'
import { MERGE_MODES, type MergeModeName } from './merge-modes'
import { type MappingName } from './engine'
import { type GeoColour } from './geo-colour'
import { savePrefs, type Prefs } from './prefs'
import { type VisualParams } from './engine'

const SVG_NS = 'http://www.w3.org/2000/svg'
const DEG = Math.PI / 180
const TAU = Math.PI * 2

/** The wedge's opening, in degrees about the hinge. */
const SWEEP_A = 165
const SWEEP_B = 285

/** Where the selection is read off. Midway along the sweep. */
const NOTCH = 225 * DEG

/** Angular spacing between adjacent options on the ring. */
const PITCH = 26 * DEG

/** Options fade out this far from the notch, so the ring reads as a strip
 *  passing a window rather than as a full circle of equal candidates. */
const CUTOFF = 40 * DEG

/**
 * The ring's radius, as a fraction of the smaller viewport dimension.
 *
 * One radius where there were three. 0.72 is the middle band's old value,
 * kept rather than averaged: it is the one that was already checked on a
 * 320×568 screen for having its labels land on glass rather than off the edge.
 */
const R_RING = 0.72

/** A tap that moves more than this is a swipe, and belongs to gestures.ts. */
const TAP_SLOP_PX = 12

/** Half-width of the invisible grab arc. 24px each side is the thumb-safe
 *  minimum this file is built around, and the chip size derives from it. */
const GRAB_PX = 24

/** How far outside the ring the value readout sits, in px. */
const VALUE_PAD = 26

/**
 * How far inside the ring the active target's name sits, in px.
 *
 * Must clear the selector's tip, which is drawn from ringR-26 to ringR-40 (see
 * build()). At 34 the name landed exactly inside the arrowhead and rendered as
 * "A▼M" — legible in neither direction, and invisible to the escaped-viewport
 * check, which only measures whether things leave the screen and not whether
 * they land on each other.
 */
const NAME_PAD = 58

/** Per-channel identity for the geometric layer's colour. R, G, B throughout. */
const CHANNELS = [
  { key: 'r' as const, label: 'R', tint: '#ff4d5e' },
  { key: 'g' as const, label: 'G', tint: '#4dff8f' },
  { key: 'b' as const, label: 'B', tint: '#5c8bff' },
]

/** The camera's tint. Deliberately not one of CHANNELS' three — those say
 *  "this is the red channel", and a fourth in a fourth hue would read as a
 *  fourth channel. Near-white amber is what every phone uses for a live
 *  camera. */
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
  /** Step the atmospheric layer's programme forward (1) or back (-1), wrapping.
   *  Bound to a swipe in gestures.ts via main.ts — not called from in here. */
  cycleAtmosphericView(direction: 1 | -1): void
  /** Adopt a change decided elsewhere (see director.ts) — updates the stored
   *  preference and the ring so the HUD keeps showing the truth, without
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
/* Only the ring and the chips take input; everywhere else falls through to the
   scrim, which closes. */
.hud-dial * { pointer-events: none; }
.hud-dial .hit { pointer-events: stroke; cursor: pointer; }

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

/* The scalar fill. Stroke colour is set inline per target, because the colour
   channels and the camera each carry their own tint and a shared class cannot
   express that. */
.hud-fill { fill: none; stroke-linecap: round; }
.hud-knob { stroke: none; }

/* Which setting the ring is currently pointed at, and its value. Both sit on
   the notch line, one inside the ring and one outside, so they read as
   labelling the window rather than any particular option. */
.hud-name {
  font: 500 9px "Chakra Petch", ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.18em; text-transform: uppercase;
  fill: #6f6b8c; text-anchor: middle; dominant-baseline: middle;
}
.hud-value {
  font: 600 17px "Chakra Petch", ui-sans-serif, system-ui, sans-serif;
  fill: #f0eeff; text-anchor: middle; dominant-baseline: middle;
  font-variant-numeric: tabular-nums;
}

/* The chips are HTML rather than SVG and sit after the dial in the DOM so they
   render above it. Inside the SVG they would fall within the ring's 48px grab
   zone and it would swallow the tap.

   A two-column grid, not the flex column this used to be. One ring means more
   icons than one column can hold on a 320×568 screen — nine of them, eleven
   while the colour icon is expanded. The grid is what keeps that from running
   off the top of the phone. */
.hud-btns {
  position: absolute;
  left: calc(0.75rem + env(safe-area-inset-left, 0px));
  bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 0.4rem;
  align-items: start;
}

/* Circular so they read as one family rather than a button list. 2.75rem is
   the smallest that still clears GRAB_PX*2 (48px, this file's thumb-safe
   minimum) once the border is counted. */
.hud-chip {
  appearance: none; cursor: pointer;
  width: 2.75rem; height: 2.75rem; padding: 0;
  border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.05rem;
  background: rgba(12,12,26,0.85);
  border: 1px solid rgba(44,41,71,0.9);
  font: 400 8px ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: #8a86a4; text-align: center; line-height: 1.1;
}
.hud-chip[hidden] { display: none; }
/* The active chip takes its own tint, so the icon that selected the ring and
   the ring itself agree on colour — the red channel's chip is red-edged while
   the ring is drawing red. Falls back to the house violet for every target
   that has no tint of its own. */
.hud-chip[aria-pressed='true'] {
  background: rgba(26,24,48,0.9);
  border-color: var(--tint, #9d9bf0);
  color: #f0eeff;
}
.hud-chip b { font-weight: 400; color: #9d9bf0; display: block; }
.hud-chip[aria-pressed='true'] b { color: #f0eeff; }
/* The colour chip's mark is a dot of the actual composite colour, not a value.
   With R, G and B now three separate ring targets, the ring can only ever show
   one channel at a time, so this dot is the only place the combined result
   appears at all. */
.hud-chip b.hud-chip-swatch {
  width: 12px; height: 12px; margin: 0 auto; border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.45);
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

/** A ring of discrete options, turned past the notch. */
interface EnumTarget {
  readonly kind: 'enum'
  readonly id: string
  /** What the chip shows, and the ring's own name label. */
  readonly glyph: string
  /** Full word, kept as the accessible name so shrinking the chip does not
   *  also shrink what a screen reader says. */
  readonly name: string
  readonly keys: readonly string[]
  label(k: string): string
  current(): string
  commit(k: string): void
  /** Rotation, in radians. 0 puts keys[0] under the notch. */
  rot: number
}

/** A continuous 0-1 value, dragged along the ring. */
interface ScalarTarget {
  readonly kind: 'scalar'
  readonly id: string
  readonly glyph: string
  readonly name: string
  readonly tint: string
  current(): number
  /** Live, on every pointermove. */
  apply(v: number): void
  /** Once, on release — where persistence belongs. */
  commit(): void
  format(v: number): string
}

type Target = EnumTarget | ScalarTarget

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

  document.body.appendChild(scrim)

  const manual = (): void => handlers.onManualChange()

  const geometricKeys = Object.keys(GEOMETRIC_VIEWS) as GeometricViewName[]
  const atmosphericKeys = Object.keys(ATMOSPHERIC_VIEWS) as AtmosphericViewName[]
  const mergeKeys = Object.keys(MERGE_MODES) as MergeModeName[]
  const mappingKeys = Object.keys(MAPPING_LABELS) as MappingName[]

  /** What the camera ring is showing, which during a drag runs ahead of what
   *  the camera has actually granted. `onPassthrough` is the only thing
   *  allowed to make it true — see the CAM target's commit. */
  let camShown = 0

  const TARGETS: Target[] = [
    {
      kind: 'enum',
      id: 'geo',
      glyph: 'GEO',
      name: 'Geometric layer',
      keys: geometricKeys,
      label: (k) => GEOMETRIC_VIEWS[k as GeometricViewName].label,
      current: () => prefs.geometricView,
      commit: (k) => {
        prefs.geometricView = k as GeometricViewName
        savePrefs(prefs)
        handlers.onGeometricView(prefs.geometricView)
        manual()
      },
      rot: 0,
    },
    {
      kind: 'enum',
      id: 'mrg',
      glyph: 'MRG',
      name: 'Merge mode',
      keys: mergeKeys,
      label: (k) => MERGE_MODES[k as MergeModeName].label,
      current: () => prefs.mergeMode,
      commit: (k) => {
        prefs.mergeMode = k as MergeModeName
        savePrefs(prefs)
        handlers.onMergeMode(prefs.mergeMode)
        manual()
      },
      rot: 0,
    },
    {
      kind: 'enum',
      id: 'atm',
      glyph: 'ATM',
      name: 'Atmospheric layer',
      keys: atmosphericKeys,
      label: (k) => ATMOSPHERIC_VIEWS[k as AtmosphericViewName].label,
      current: () => prefs.atmosphericView,
      commit: (k) => {
        prefs.atmosphericView = k as AtmosphericViewName
        savePrefs(prefs)
        handlers.onAtmosphericView(prefs.atmosphericView)
        manual()
      },
      rot: 0,
    },
    {
      kind: 'scalar',
      id: 'mix',
      glyph: 'MIX',
      name: 'Layer mix',
      tint: '#9d9bf0',
      current: () => prefs.mix,
      apply: (v) => {
        prefs.mix = v
        handlers.onMix(prefs.mix)
        manual()
      },
      // Persist once at the end — a drag fires many events a second and there
      // is no reason to write localStorage that often.
      commit: () => savePrefs(prefs),
      format: (v) => `${Math.round(v * 100)}%`,
    },
    {
      kind: 'enum',
      id: 'map',
      glyph: 'MAP',
      name: 'Mapping',
      keys: mappingKeys,
      label: (k) => MAPPING_LABELS[k as MappingName],
      current: () => prefs.mapping,
      commit: (k) => {
        prefs.mapping = k as MappingName
        savePrefs(prefs)
        handlers.onMapping(prefs.mapping)
        manual()
      },
      rot: 0,
    },
    ...CHANNELS.map(
      ({ key, label, tint }): ScalarTarget => ({
        kind: 'scalar',
        id: key,
        glyph: label,
        name: `Geometric layer colour, ${label}`,
        tint,
        current: () => prefs.geoColour[key],
        apply: (v) => {
          prefs.geoColour = { ...prefs.geoColour, [key]: v }
          handlers.onGeoColour(prefs.geoColour)
          manual()
        },
        commit: () => savePrefs(prefs),
        format: (v) => String(Math.round(v * 100)),
      }),
    ),
    {
      kind: 'scalar',
      id: 'cam',
      glyph: 'CAM',
      name: 'Camera passthrough',
      tint: CAM_TINT,
      current: () => camShown,
      apply: (v) => {
        camShown = v
        manual()
      },
      commit: () => {
        // The camera is the one control whose value is not ours to decide: the
        // first non-zero drag is what asks for it, and the answer can be no.
        void handlers.onPassthrough(camShown).then((granted) => {
          camShown = granted
          prefs.passthrough = granted
          savePrefs(prefs)
          paintRing()
          paintChips()
        })
      },
      format: (v) => (v > 0 ? String(Math.round(v * 100)) : 'off'),
    },
  ]

  const targetById = (id: string): Target => TARGETS.find((t) => t.id === id)!

  /** Which target the ring is pointed at. */
  let activeId = 'geo'
  const active = (): Target => targetById(activeId)

  /** Whether the colour icon has expanded into its three channels. */
  let rgbExpanded = false

  // ── chips ────────────────────────────────────────────────────────────────

  function mkChip(name: string, glyph: string, onTap: () => void): HTMLButtonElement {
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

  /** Point the ring at a target, parking its current value under the notch. */
  function select(id: string): void {
    activeId = id
    const t = active()
    if (t.kind === 'enum') t.rot = restingRot(t)
    paintRing()
    paintChips()
  }

  const targetChips = new Map<string, HTMLButtonElement>()

  for (const id of ['geo', 'mrg', 'atm', 'mix', 'map'] as const) {
    const t = targetById(id)
    targetChips.set(id, mkChip(t.name, t.glyph, () => select(id)))
  }

  // The colour icon and the three it expands into occupy consecutive grid
  // cells, so hiding one set and showing the other keeps everything else in
  // place. Building all four up front and toggling `hidden` is what makes that
  // true — rebuilding the row would reorder it.
  const rgbChip = mkChip('Geometric layer colour', 'RGB', () => {
    rgbExpanded = true
    select('r')
  })
  const rgbSwatch = rgbChip.querySelector('b')!
  rgbSwatch.classList.add('hud-chip-swatch')

  for (const { key, label } of CHANNELS) {
    const t = targetById(key)
    const chip = mkChip(t.name, label, () => select(key))
    chip.style.setProperty('--tint', (t as ScalarTarget).tint)
    targetChips.set(key, chip)
  }

  const camChip = mkChip('Camera passthrough', 'CAM', () => select('cam'))
  camChip.style.setProperty('--tint', CAM_TINT)
  targetChips.set('cam', camChip)

  // AUTO and NUM are not ring targets. A boolean is not ring-shaped, and
  // forcing it into one would be worse than the inconsistency.
  const autoBtn = mkChip('Autopilot', 'AUTO', () => {
    prefs.autopilot = !prefs.autopilot
    savePrefs(prefs)
    paintChips()
    // Toggling it on is not a manual change to *what is on screen*, so it does
    // not suspend — switching it on and then waiting three minutes for it to
    // do anything would read as broken.
  })

  const statsBtn = mkChip('Numeric readout', 'NUM', () => {
    prefs.showStats = !prefs.showStats
    stats.hidden = !prefs.showStats
    if (!prefs.showStats) stats.textContent = ''
    savePrefs(prefs)
    paintChips()
  })

  // ── geometry ─────────────────────────────────────────────────────────────

  let cx = 0
  let cy = 0
  let ringR = 0

  let ringTrack: SVGPathElement | null = null
  let selector: SVGPathElement | null = null
  let selectorTip: SVGPathElement | null = null
  let fillArc: SVGPathElement | null = null
  let knob: SVGCircleElement | null = null
  let nameLabel: SVGTextElement | null = null
  let valueLabel: SVGTextElement | null = null
  let itemLabels: SVGTextElement[] = []
  let enumHit: SVGPathElement | null = null
  let scalarHit: SVGPathElement | null = null

  /** Enough label slots for the largest enum target, allocated once. */
  const MAX_ITEMS = Math.max(
    ...TARGETS.filter((t): t is EnumTarget => t.kind === 'enum').map((t) => t.keys.length),
  )

  const polar = (r: number, a: number): [number, number] => [
    cx + r * Math.cos(a),
    cy + r * Math.sin(a),
  ]

  function arcPath(r: number, a0: number, a1: number): string {
    const [x0, y0] = polar(r, a0)
    const [x1, y1] = polar(r, a1)
    return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`
  }

  /** Rotation that puts the current option under the notch. */
  function restingRot(t: EnumTarget): number {
    return -Math.max(0, t.keys.indexOf(t.current())) * PITCH
  }

  function build(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    const base = Math.min(w, h)
    // Hinge sits just outside the corner, so the wedge opens into the screen.
    cx = w + 10
    cy = h + 10
    ringR = base * R_RING

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const a0 = SWEEP_A * DEG
    const a1 = SWEEP_B * DEG

    // Ticks along the outer edge, as a rim for the whole wedge.
    const outer = ringR + base * 0.14
    for (let d = SWEEP_A; d <= SWEEP_B; d += 3) {
      const a = d * DEG
      const major = d % 15 === 0
      const [px0, py0] = polar(outer - (major ? 8 : 4), a)
      const [px1, py1] = polar(outer, a)
      svg.appendChild(
        el('line', { x1: px0, y1: py0, x2: px1, y2: py1, class: `hud-tick${major ? ' major' : ''}` }),
      )
    }
    svg.appendChild(el('path', { d: arcPath(outer + 4, a0, a1), class: 'hud-rule' }))

    ringTrack = el('path', {
      d: arcPath(ringR, a0, a1),
      class: 'hud-track',
      'stroke-width': Math.max(30, base * 0.09),
    })
    svg.appendChild(ringTrack)

    // The scalar fill rides on the track, at the same radius.
    fillArc = el('path', { class: 'hud-fill', 'stroke-width': 7 })
    svg.appendChild(fillArc)
    knob = el('circle', { r: 8, class: 'hud-knob' })
    svg.appendChild(knob)

    // The selector: a trapezoid across the ring at the notch, for enum targets.
    {
      const r0 = ringR - base * 0.05
      const r1 = ringR + base * 0.05
      const w0 = 26
      const w1 = 40
      const [lx0, ly0] = polar(r0, NOTCH - Math.atan2(w0 / 2, r0))
      const [rx0, ry0] = polar(r0, NOTCH + Math.atan2(w0 / 2, r0))
      const [lx1, ly1] = polar(r1, NOTCH - Math.atan2(w1 / 2, r1))
      const [rx1, ry1] = polar(r1, NOTCH + Math.atan2(w1 / 2, r1))
      selector = el('path', {
        d: `M${lx0} ${ly0}L${lx1} ${ly1}L${rx1} ${ry1}L${rx0} ${ry0}Z`,
        class: 'hud-selector',
      })
      svg.appendChild(selector)

      const [tx, ty] = polar(r0 - 10, NOTCH)
      const [bx, by] = polar(r0 - 24, NOTCH)
      const perp = NOTCH + Math.PI / 2
      selectorTip = el('path', {
        d:
          `M${bx + 6 * Math.cos(perp)} ${by + 6 * Math.sin(perp)}` +
          `L${bx - 6 * Math.cos(perp)} ${by - 6 * Math.sin(perp)}` +
          `L${tx} ${ty}Z`,
        class: 'hud-tip',
      })
      svg.appendChild(selectorTip)
    }

    itemLabels = Array.from({ length: MAX_ITEMS }, () => {
      const t = el('text', { class: 'hud-item' })
      svg.appendChild(t)
      return t
    })

    nameLabel = el('text', { class: 'hud-name' })
    svg.appendChild(nameLabel)
    valueLabel = el('text', { class: 'hud-value' })
    svg.appendChild(valueLabel)

    // Two grab arcs over the same ring, one per kind, with pointer-events
    // toggled by paintRing(). One element cannot carry both bindings: turning
    // and sliding interpret the same drag differently, and a single hit arc
    // would have to branch inside every handler.
    enumHit = el('path', {
      d: arcPath(ringR, a0, a1),
      class: 'hit',
      fill: 'none',
      stroke: 'transparent',
      'stroke-width': GRAB_PX * 2,
    })
    bindTurnDrag(enumHit)
    svg.appendChild(enumHit)

    scalarHit = el('path', {
      d: arcPath(ringR, a0, a1),
      class: 'hit',
      fill: 'none',
      stroke: 'transparent',
      'stroke-width': GRAB_PX * 2,
    })
    bindArcDrag(scalarHit)
    svg.appendChild(scalarHit)

    paintRing()
    paintChips()
  }

  // ── painting ─────────────────────────────────────────────────────────────

  function paintRing(): void {
    if (!ringTrack || !selector || !selectorTip || !fillArc || !knob) return
    if (!nameLabel || !valueLabel || !enumHit || !scalarHit) return

    const t = active()
    const isEnum = t.kind === 'enum'

    // Only one kind is live at a time, and invisible must mean untappable —
    // `.hud-dial .hit` sets pointer-events by class regardless of opacity, so
    // a hidden hit arc would still swallow the other kind's drags.
    enumHit.style.pointerEvents = isEnum ? 'stroke' : 'none'
    scalarHit.style.pointerEvents = isEnum ? 'none' : 'stroke'

    selector.setAttribute('opacity', isEnum ? '1' : '0')
    selectorTip.setAttribute('opacity', isEnum ? '1' : '0')
    fillArc.setAttribute('opacity', isEnum ? '0' : '1')
    knob.setAttribute('opacity', isEnum ? '0' : '1')

    const [nx, ny] = polar(ringR - NAME_PAD, NOTCH)
    nameLabel.setAttribute('x', String(nx))
    nameLabel.setAttribute('y', String(ny))
    nameLabel.textContent = t.glyph

    if (isEnum) {
      const sel = t.current()
      itemLabels.forEach((label, i) => {
        if (i >= t.keys.length) {
          label.setAttribute('opacity', '0')
          label.textContent = ''
          return
        }
        const a = NOTCH + i * PITCH + t.rot
        const d = Math.abs(delta(a, NOTCH))
        const vis = d > CUTOFF ? 0 : 1 - (d / CUTOFF) * 0.72
        const [x, y] = polar(ringR, a)
        label.setAttribute('x', String(x))
        label.setAttribute('y', String(y))
        label.setAttribute('opacity', vis.toFixed(3))
        label.textContent = t.label(t.keys[i])
        label.classList.toggle('on', t.keys[i] === sel)
      })
      valueLabel.setAttribute('opacity', '0')
      valueLabel.textContent = ''
      return
    }

    for (const label of itemLabels) {
      label.setAttribute('opacity', '0')
      label.textContent = ''
    }

    const v = t.current()
    const a0 = SWEEP_A * DEG
    const a1 = a0 + v * (SWEEP_B - SWEEP_A) * DEG
    fillArc.setAttribute('d', arcPath(ringR, a0, Math.max(a0 + 0.001, a1)))
    fillArc.style.stroke = t.tint
    const [kx, ky] = polar(ringR, a1)
    knob.setAttribute('cx', String(kx))
    knob.setAttribute('cy', String(ky))
    knob.style.fill = t.tint

    const [vx, vy] = polar(ringR + VALUE_PAD, NOTCH)
    valueLabel.setAttribute('x', String(vx))
    valueLabel.setAttribute('y', String(vy))
    valueLabel.setAttribute('opacity', '1')
    valueLabel.textContent = t.format(v)
  }

  function paintChips(): void {
    for (const [id, chip] of targetChips) {
      chip.setAttribute('aria-pressed', String(activeId === id))
    }
    // The colour icon and its three channels swap places rather than coexist.
    rgbChip.hidden = rgbExpanded
    rgbChip.setAttribute('aria-expanded', String(rgbExpanded))
    for (const { key } of CHANNELS) targetChips.get(key)!.hidden = !rgbExpanded

    const c = prefs.geoColour
    rgbSwatch.style.background = `rgb(${Math.round(c.r * 255)} ${Math.round(c.g * 255)} ${Math.round(c.b * 255)})`

    autoBtn.querySelector('b')!.textContent = prefs.autopilot ? 'on' : 'off'
    autoBtn.setAttribute('aria-pressed', String(prefs.autopilot))
    statsBtn.querySelector('b')!.textContent = prefs.showStats ? 'on' : 'off'
    statsBtn.setAttribute('aria-pressed', String(prefs.showStats))
  }

  // ── dragging ─────────────────────────────────────────────────────────────

  /** Pointer position as an angle about the hinge, in the svg's own coordinate
   *  space (which is CSS pixels). */
  function angleFrom(e: PointerEvent): number {
    const r = svg.getBoundingClientRect()
    return Math.atan2(e.clientY - r.top - cy, e.clientX - r.left - cx)
  }

  /** Where an angle falls along the sweep, as 0-1, clamped to its ends. Built
   *  on delta() rather than the naive "(deg-a0)/(a1-a0)" so it survives a0/a1
   *  straddling the 0/360 wrap. */
  function angleToUnit(a: number): number {
    const t = delta(a, SWEEP_A * DEG) / delta(SWEEP_B * DEG, SWEEP_A * DEG)
    return Math.max(0, Math.min(1, t))
  }

  /**
   * Take the pointer, if the browser will give it.
   *
   * Capture is an enhancement — it keeps a drag alive once the finger wanders
   * off the arc, which on a 48px band happens constantly. It is not what makes
   * the drag work, and it must not be: `setPointerCapture` throws when the id
   * is not an active pointer, and because the call sat above the line that
   * armed the drag, a throw silently abandoned the whole gesture rather than
   * degrading it. The drag state now hangs off its own flag, so a refused
   * capture costs the off-arc travel and nothing else.
   */
  function capture(hit: SVGPathElement, e: PointerEvent): void {
    try {
      hit.setPointerCapture(e.pointerId)
    } catch {
      // No capture; the pointerdown/up flag carries the drag on its own.
    }
  }

  /** Drag along the ring for a 0-1 value. Reads the active target at event
   *  time, not at bind time — the ring is rebuilt on resize but the target it
   *  points at changes far more often than that. */
  function bindArcDrag(hit: SVGPathElement): void {
    let live = false
    const set = (e: PointerEvent): void => {
      const t = active()
      if (t.kind !== 'scalar') return
      t.apply(angleToUnit(angleFrom(e)))
      paintRing()
      paintChips()
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
      const t = active()
      if (t.kind === 'scalar') t.commit()
    }
    hit.addEventListener('pointerup', end)
    hit.addEventListener('pointercancel', end)
  }

  /** Turn the ring of options past the notch; snap to whichever settles
   *  closest on release. */
  function bindTurnDrag(hit: SVGPathElement): void {
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
      const t = active()
      if (t.kind !== 'enum') return
      const a = angleFrom(e)
      let rot = t.rot + delta(a, last)
      last = a
      // Can't spin an option out past either end of the strip.
      const lo = -(t.keys.length - 1) * PITCH
      if (rot > 0) rot = 0
      if (rot < lo) rot = lo
      t.rot = rot
      paintRing()
    })
    const settle = (e: PointerEvent): void => {
      if (!moved) return
      moved = false
      e.stopPropagation()
      const t = active()
      if (t.kind !== 'enum') return
      const i = Math.max(0, Math.min(t.keys.length - 1, Math.round(-t.rot / PITCH)))
      t.rot = -i * PITCH
      // Commit before repainting, so the repaint's own read of "what's
      // current" already reflects it.
      if (t.keys[i] !== t.current()) t.commit(t.keys[i])
      paintRing()
      paintChips()
    }
    hit.addEventListener('pointerup', settle)
    hit.addEventListener('pointercancel', settle)
  }

  // ── open/close ───────────────────────────────────────────────────────────

  build()
  window.addEventListener('resize', build)
  // iOS reports the old viewport for a moment after a rotation, so re-measure.
  window.addEventListener('orientationchange', () => window.setTimeout(build, 250))

  let open = false
  const setOpen = (v: boolean): void => {
    open = v
    scrim.classList.toggle('open', v)
    if (v) {
      // The active target may have been changed by a swipe gesture, or by the
      // autopilot, while the HUD was closed.
      const t = active()
      if (t.kind === 'enum') t.rot = restingRot(t)
      paintRing()
      paintChips()
    } else {
      // Expanding the colour icon is a mode; leaving it expanded across a close
      // would mean the HUD reopens showing something the last tap did not ask
      // for.
      if (rgbExpanded) {
        rgbExpanded = false
        if (CHANNELS.some(({ key }) => key === activeId)) select('geo')
        else paintChips()
      }
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

  // Anything that reaches the scrim itself is outside the wedge — the ring and
  // the chips stop their own events.
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
      const t = targetById('atm') as EnumTarget
      t.rot = restingRot(t)
      if (open) paintRing()
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
        const t = targetById('atm') as EnumTarget
        t.rot = restingRot(t)
      }
      savePrefs(prefs)
      // Only repaint what is visible; the HUD is closed most of the time and
      // setOpen re-reads everything from prefs anyway.
      if (open) {
        paintRing()
        paintChips()
      }
    },
  }
}
