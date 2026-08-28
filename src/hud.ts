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
import type { MappingName, VisualParams } from './mapping'
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

export interface Hud {
  /** Call every frame with the current state; only does work while visible. */
  update(
    params: VisualParams,
    stats: { frameMs: number; pixelRatio: number; disturb?: number },
  ): void
  /** Step the atmospheric layer's programme forward (1) or back (-1), wrapping. */
  cycleAtmosphericView(direction: 1 | -1): void
  /** Step the geometric layer's programme forward (1) or back (-1), wrapping. */
  cycleGeometricView(direction: 1 | -1): void
}

interface Handlers {
  onGeometricView(name: GeometricViewName): void
  onGeoColour(colour: GeoColour): void
  onAtmosphericView(name: AtmosphericViewName): void
  onMergeMode(mode: MergeModeName): void
  /** 0-1. */
  onMix(mix: number): void
  onMapping(name: MappingName): void
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
.hud-btn2 {
  appearance: none; cursor: pointer;
  width: 6.5rem; padding: 0.35rem 0.5rem;
  display: flex; flex-direction: column; gap: 0.15rem;
  background: rgba(12,12,26,0.85);
  border: 1px solid rgba(44,41,71,0.9);
  border-radius: 3px;
  font: 400 8px ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: #8a86a4;
}
.hud-btn2[aria-pressed='true'] { background: rgba(26,24,48,0.9); border-color: #9d9bf0; }
.hud-btn2 b { font-weight: 400; color: #9d9bf0; }

/* Channel intensities for the geometric layer. A panel rather than a dial
   band: three values that move together are not a list you turn through, and
   the space of useful settings includes every desaturated and channel-killed
   combination a preset list would have to enumerate. */
.hud-rgb {
  width: 10.5rem; padding: 0.6rem 0.7rem 0.7rem;
  display: none; flex-direction: column; gap: 0.45rem;
  background: rgba(12,12,26,0.94);
  border: 1px solid rgba(44,41,71,0.9);
  border-radius: 3px;
  pointer-events: auto;
}
.hud-rgb.open { display: flex; }
.hud-rgb label {
  display: grid; grid-template-columns: 0.9rem 1fr 1.9rem; align-items: center; gap: 0.4rem;
  font: 400 9px ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.1em; text-transform: uppercase; color: #8a86a4;
}
.hud-rgb output { color: #f0eeff; text-align: right; font-variant-numeric: tabular-nums; }
.hud-rgb input {
  appearance: none; -webkit-appearance: none;
  width: 100%; height: 18px; background: none; cursor: pointer;
}
.hud-rgb input::-webkit-slider-runnable-track {
  height: 3px; border-radius: 2px; background: var(--track);
}
.hud-rgb input::-moz-range-track { height: 3px; border-radius: 2px; background: var(--track); }
.hud-rgb input::-webkit-slider-thumb {
  -webkit-appearance: none; width: 14px; height: 14px; margin-top: -5.5px;
  border-radius: 50%; background: var(--chan); border: 1px solid rgba(0,0,0,0.5);
}
.hud-rgb input::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--chan); border: 1px solid rgba(0,0,0,0.5);
}
.hud-rgb input:focus-visible { outline: 1px solid #9d9bf0; outline-offset: 3px; }
.hud-swatch {
  height: 4px; border-radius: 2px; margin-top: 0.15rem;
  background: var(--swatch, #fff);
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

  function mkButton(label: string, onTap: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'hud-btn2'
    b.innerHTML = '<span></span><b></b>'
    b.querySelector('span')!.textContent = label
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
  rgbPanel.setAttribute('role', 'group')
  rgbPanel.setAttribute('aria-label', 'Geometric layer channel intensity')
  // A tap inside the panel must not reach the scrim, which closes the HUD.
  rgbPanel.addEventListener('pointerup', (e) => e.stopPropagation())
  rgbPanel.addEventListener('pointerdown', (e) => e.stopPropagation())
  btnBar.appendChild(rgbPanel)

  const CHANNELS = [
    { key: 'r' as const, label: 'R', tint: '#ff4d5e' },
    { key: 'g' as const, label: 'G', tint: '#4dff8f' },
    { key: 'b' as const, label: 'B', tint: '#5c8bff' },
  ]

  const sliders = CHANNELS.map(({ key, label, tint }) => {
    const row = document.createElement('label')
    const name = document.createElement('span')
    name.textContent = label
    const input = document.createElement('input')
    input.type = 'range'
    input.min = '0'
    input.max = '100'
    input.step = '1'
    input.style.setProperty('--chan', tint)
    // The track shows the channel running from black to its own full value, so
    // the control looks like what it does.
    input.style.setProperty('--track', `linear-gradient(90deg, #0b0b16, ${tint})`)
    input.setAttribute('aria-label', `${label} intensity`)
    const out = document.createElement('output')
    row.append(name, input, out)
    rgbPanel.appendChild(row)

    input.addEventListener('input', () => {
      prefs.geoColour = clampGeoColour({ ...prefs.geoColour, [key]: input.valueAsNumber / 100 })
      handlers.onGeoColour(prefs.geoColour)
      paintRgb()
    })
    // Persist on release only — dragging a slider fires continuously and there
    // is no reason to write localStorage at that rate.
    const commit = (): void => savePrefs(prefs)
    input.addEventListener('change', commit)
    input.addEventListener('pointerup', commit)

    return { key, input, out }
  })

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

  const rgbBtn = mkButton('colour', () => {
    rgbPanel.classList.toggle('open')
    paintButtons()
  })

  const mapBtn = mkButton('mapping', () => {
    const i = mappingKeys.indexOf(prefs.mapping)
    prefs.mapping = mappingKeys[(i + 1) % mappingKeys.length]
    savePrefs(prefs)
    handlers.onMapping(prefs.mapping)
    paintButtons()
  })

  const statsBtn = mkButton('numbers', () => {
    prefs.showStats = !prefs.showStats
    stats.hidden = !prefs.showStats
    if (!prefs.showStats) stats.textContent = ''
    savePrefs(prefs)
    paintButtons()
  })

  const polar = (r: number, a: number): [number, number] => [
    cx + r * Math.cos(a),
    cy + r * Math.sin(a),
  ]

  function arcPath(r: number, a0: number, a1: number): string {
    const [x0, y0] = polar(r, a0)
    const [x1, y1] = polar(r, a1)
    return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`
  }

  /** Rotation that puts the currently-selected key under the notch. */
  function restingRot(b: Band<string>): number {
    return -Math.max(0, b.keys.indexOf(b.current())) * PITCH
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
    for (const b of bands) {
      b.r = base * b.radius
      b.rot = restingRot(b)
      svg.appendChild(
        el('path', {
          d: arcPath(b.r, a0, a1),
          class: 'hud-track',
          'stroke-width': Math.max(30, base * 0.09),
        }),
      )
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
      svg.appendChild(
        el('path', {
          d: `M${lx0} ${ly0}L${lx1} ${ly1}L${rx1} ${ry1}L${rx0} ${ry0}Z`,
          class: 'hud-selector',
        }),
      )
      const [tx, ty] = polar(r0 - 10, NOTCH)
      const [bx, by] = polar(r0 - 24, NOTCH)
      const perp = NOTCH + Math.PI / 2
      svg.appendChild(
        el('path', {
          d:
            `M${bx + 6 * Math.cos(perp)} ${by + 6 * Math.sin(perp)}` +
            `L${bx - 6 * Math.cos(perp)} ${by - 6 * Math.sin(perp)}` +
            `L${tx} ${ty}Z`,
          class: 'hud-tip',
        }),
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

    paintBands()
    paintMix()
    paintRgb()
    paintButtons()
  }

  function paintBands(): void {
    for (const b of bands) {
      const sel = b.current()
      b.keys.forEach((k, i) => {
        const a = NOTCH + i * PITCH + b.rot
        const d = Math.abs(delta(a, NOTCH))
        const vis = d > CUTOFF ? 0 : 1 - (d / CUTOFF) * 0.72
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

  function paintRgb(): void {
    const c = prefs.geoColour
    for (const s of sliders) {
      const pct = Math.round(c[s.key] * 100)
      // Only write the input when it disagrees, so this is safe to call from
      // paint paths while a drag is in flight.
      if (s.input.valueAsNumber !== pct) s.input.value = String(pct)
      s.out.textContent = String(pct)
    }
    swatch.style.setProperty(
      '--swatch',
      `rgb(${Math.round(c.r * 255)} ${Math.round(c.g * 255)} ${Math.round(c.b * 255)})`,
    )
    rgbBtn.querySelector('b')!.textContent =
      `${Math.round(c.r * 100)}/${Math.round(c.g * 100)}/${Math.round(c.b * 100)}`
  }

  function paintButtons(): void {
    const open = rgbPanel.classList.contains('open')
    rgbBtn.setAttribute('aria-pressed', String(open))
    rgbBtn.setAttribute('aria-expanded', String(open))
    mapBtn.querySelector('b')!.textContent = MAPPING_LABELS[prefs.mapping]
    statsBtn.querySelector('b')!.textContent = prefs.showStats ? 'on' : 'off'
    statsBtn.setAttribute('aria-pressed', String(prefs.showStats))
  }

  /** Pointer position in the SVG's own coordinate space (which is CSS pixels). */
  function localAngle(e: PointerEvent): number {
    const r = svg.getBoundingClientRect()
    return Math.atan2(e.clientY - r.top - cy, e.clientX - r.left - cx)
  }

  function bindBandDrag(hit: SVGPathElement, b: Band<string>): void {
    let last = 0
    let moved = false

    hit.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      hit.setPointerCapture(e.pointerId)
      last = localAngle(e)
      moved = true
    })
    hit.addEventListener('pointermove', (e) => {
      if (!moved || !hit.hasPointerCapture(e.pointerId)) return
      const a = localAngle(e)
      b.rot += delta(a, last)
      last = a
      // Can't spin an option out past either end of the strip.
      const lo = -(b.keys.length - 1) * PITCH
      if (b.rot > 0) b.rot = 0
      if (b.rot < lo) b.rot = lo
      paintBands()
    })
    const settle = (e: PointerEvent) => {
      if (!moved) return
      moved = false
      e.stopPropagation()
      const i = Math.max(0, Math.min(b.keys.length - 1, Math.round(-b.rot / PITCH)))
      b.rot = -i * PITCH
      const next = b.keys[i]
      if (next !== b.current()) b.commit(next)
      paintBands()
    }
    hit.addEventListener('pointerup', settle)
    hit.addEventListener('pointercancel', settle)
  }

  function bindMixDrag(hit: SVGPathElement): void {
    let active = false
    const set = (e: PointerEvent) => {
      const deg = ((localAngle(e) / DEG) % 360 + 360) % 360
      const t = (deg - SWEEP_A) / (SWEEP_B - SWEEP_A)
      prefs.mix = Math.max(0, Math.min(1, t))
      handlers.onMix(prefs.mix)
      paintMix()
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
    const end = (e: PointerEvent) => {
      if (!active) return
      active = false
      e.stopPropagation()
      // Persist once at the end — a drag fires many events a second and there
      // is no reason to write localStorage that often.
      savePrefs(prefs)
    }
    hit.addEventListener('pointerup', end)
    hit.addEventListener('pointercancel', end)
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
    } else {
      // The panel is a mode; leaving it open across a close would mean the HUD
      // reopens showing something the last tap did not ask for.
      rgbPanel.classList.remove('open')
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
