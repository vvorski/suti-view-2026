/**
 * The control panel: the layer stack, one row per layer.
 *
 * Tap anywhere to open. A panel rises from the bottom showing every layer at
 * once — geometric, atmospheric, camera — each with its own opacity bar and,
 * when selected, its own options. Below them sit the things that belong to no
 * single layer: merge mode, mapping, autopilot, the numeric readout.
 *
 * This replaced a corner-hinged wedge of concentric bands driven by a single
 * `mix` crossfade. The crossfade could move weight between the geometric and
 * atmospheric layers but could not turn either *down*, which is why the camera
 * underneath was unreadable at every setting — something was always landing on
 * it at full strength. One opacity per layer is the fix, and once each layer
 * has one, a stack is the honest way to draw them.
 *
 * Two decisions worth naming, because only one of them is taste:
 *
 * The stack stays on screen the whole time the panel is open. Seeing what
 * every layer is set to without touching anything is the entire point; a strip
 * that collapsed to the selected layer would save a third of the panel and
 * hand back the problem. Only the *detail* — a layer's options and colours —
 * appears and disappears with selection.
 *
 * A layer at zero stays in the list, greyed. That reads as taste and is not:
 * if the camera row vanished when its opacity hit zero, there would be no
 * control left anywhere to turn it back on.
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
import { savePrefs, type Prefs } from './prefs'

/** A tap that travels further than this is a swipe, and belongs to gestures.ts. */
const TAP_SLOP_PX = 12

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
   *  Bound to a swipe in gestures.ts via main.ts. */
  cycleAtmosphericView(direction: 1 | -1): void
  /** Adopt a change decided elsewhere (see director.ts) — updates the stored
   *  preference and the panel without reporting it as a manual change. */
  adopt(next: { geoColour?: GeoColour; atmosphericView?: AtmosphericViewName }): void
  /** Whether the user has the autopilot switched on. */
  autopilot(): boolean
}

interface Handlers {
  onGeometricView(name: GeometricViewName): void
  onGeoColour(colour: GeoColour): void
  onAtmosphericView(name: AtmosphericViewName): void
  onMergeMode(mode: MergeModeName): void
  /** 0-1, the geometric layer's opacity. */
  onGeoAlpha(a: number): void
  /** 0-1, the atmospheric layer's opacity. */
  onAtmAlpha(a: number): void
  onMapping(name: MappingName): void
  /**
   * 0-1 of the passthrough camera.
   *
   * Async and able to fail, unlike every other handler here, because the first
   * non-zero value is what actually asks for the camera — and the person can
   * say no. Resolves to the opacity that was really achieved, so the bar can
   * snap back to 0 on a refusal rather than sitting somewhere untrue.
   */
  onPassthrough(a: number): Promise<number>
  /** Fired on every change the user makes by hand, so the autopilot can get
   *  out of the way. Not fired for `adopt`. */
  onManualChange(): void
}

const MAPPING_LABELS: Record<MappingName, string> = {
  relative: 'Relative',
  'speech-band': 'Absolute',
  'auto-normalised': 'Normalised',
}

/** Per-channel identity for the geometric layer's colour. */
const CHANNELS = [
  { key: 'r' as const, label: 'R', tint: '#ff4d5e' },
  { key: 'g' as const, label: 'G', tint: '#4dff8f' },
  { key: 'b' as const, label: 'B', tint: '#5c8bff' },
]

const CSS = `
.hud-scrim {
  position: fixed; inset: 0; z-index: 30;
  opacity: 0; pointer-events: none;
  transition: opacity 200ms ease;
  /* Dark only where the panel is. A full-screen scrim would hide the
     visualiser, which is the one thing you need to see while adjusting it. */
  background: linear-gradient(to top,
    rgba(3,4,8,0.94) 0%, rgba(3,4,8,0.82) 45%, rgba(3,4,8,0) 82%);
}
.hud-scrim.open { opacity: 1; pointer-events: auto; }

.hud-panel {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 0.6rem calc(0.6rem + env(safe-area-inset-left, 0px))
    calc(0.6rem + env(safe-area-inset-bottom, 0px));
  display: flex; flex-direction: column; gap: 0.35rem;
  /* Never taller than the screen. With the readout open on a short phone this
     would otherwise run off the top with no way to reach the rest. */
  max-height: 100%; overflow-y: auto;
  transform: translateY(10px);
  transition: transform 220ms ease;
  font: 400 12px ui-monospace, SFMono-Regular, Menlo, monospace;
}
.hud-scrim.open .hud-panel { transform: none; }
@media (prefers-reduced-motion: reduce) {
  .hud-scrim, .hud-panel { transition: none; }
}

.hud-head {
  display: flex; justify-content: space-between;
  font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase;
  color: #5d5a78; padding: 0 0.2rem 0.05rem;
}

/* One row per layer. The row IS the control — name, value, opacity bar — so
   there is no popup, no mode, and nothing that has to be opened before it can
   be read. */
.hud-layer {
  border: 1px solid #1b1e2c; border-radius: 10px;
  background: rgba(8,9,16,0.82);
  padding: 0.4rem 0.55rem 0.45rem;
  cursor: pointer;
}
.hud-layer[aria-selected='true'] {
  border-color: var(--tint, #9d9bf0);
  background: rgba(20,20,38,0.9);
}
/* Off, not gone. See the file comment: a camera row that disappeared at zero
   would take its own on switch with it. */
.hud-layer[data-off='true'] .hud-bar-fill { opacity: 0.3; }
.hud-layer[data-off='true'] .hud-layer-val { color: #4e5464; }

.hud-layer-top { display: flex; align-items: baseline; gap: 0.4rem; }
.hud-layer-name {
  font: 600 11px "Chakra Petch", ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--tint, #9d9bf0);
}
.hud-layer-val { margin-left: auto; font-size: 10px; color: #cfd3dd; }
.hud-layer-pct {
  font-size: 10px; color: #7d7a99;
  font-variant-numeric: tabular-nums; min-width: 3.2em; text-align: right;
}

/* The opacity bar. The hit area is 22px tall while the drawn track is 4px —
   the difference is thumb margin, the same reason the old bands had grab arcs
   far wider than the arcs they drew. */
.hud-bar { position: relative; height: 22px; touch-action: none; cursor: ew-resize; }
.hud-bar-track { position: absolute; inset: 9px 0; border: 1px solid #262a3d; border-radius: 2px; }
.hud-bar-fill { position: absolute; inset: 9px auto 9px 0; background: var(--tint, #9d9bf0); border-radius: 2px; }
.hud-bar-knob {
  position: absolute; top: 5px; width: 3px; height: 12px;
  background: #f0eeff; transform: translateX(-1px);
}

.hud-opts { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.3rem; }
.hud-opts[hidden], .hud-colours[hidden] { display: none; }
.hud-opt {
  appearance: none; cursor: pointer;
  font: 400 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.04em; color: #8a86a4;
  background: transparent; border: 1px solid #262a3d; border-radius: 5px;
  padding: 0.22rem 0.45rem;
}
.hud-opt[aria-pressed='true'] {
  color: #f0eeff; border-color: var(--tint, #9d9bf0); background: rgba(157,155,240,0.14);
}

.hud-colours { margin-top: 0.2rem; }

/* Everything that belongs to no single layer. */
.hud-global {
  border: 1px solid #161924; border-radius: 10px;
  background: rgba(6,7,12,0.8);
  padding: 0.4rem 0.55rem;
  display: flex; flex-direction: column; gap: 0.3rem;
}
.hud-global-row { display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; }
.hud-global-name {
  font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
  color: #5d5a78; min-width: 3.4em;
}

.hud-stats {
  margin: 0 0 0.25rem;
  font: 400 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre; color: #77809a; pointer-events: none;
}
`

/** A layer row: what it is called, what it is set to, and its opacity. */
interface Layer {
  readonly id: 'geo' | 'atm' | 'cam'
  readonly name: string
  readonly tint: string
  /** Options, if the layer has a programme to pick. Empty for the camera. */
  readonly keys: readonly string[]
  label(k: string): string
  current(): string
  commit(k: string): void
  alpha(): number
  /** Live, on every pointermove. */
  apply(a: number): void
  /** Once, on release — where persistence and any prompting belong. */
  settle(): void
  /** Filled in on build. */
  row?: HTMLElement
  opts?: HTMLElement
  colours?: HTMLElement
}

export function createHud(prefs: Prefs, handlers: Handlers): Hud {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const scrim = document.createElement('div')
  scrim.className = 'hud-scrim'
  scrim.setAttribute('role', 'dialog')
  scrim.setAttribute('aria-label', 'Layers')

  const panel = document.createElement('div')
  panel.className = 'hud-panel'
  scrim.appendChild(panel)

  const stats = document.createElement('pre')
  stats.className = 'hud-stats'
  stats.hidden = !prefs.showStats
  panel.appendChild(stats)

  const head = document.createElement('div')
  head.className = 'hud-head'
  head.innerHTML = '<span>Layer</span><span>Opacity</span>'
  panel.appendChild(head)

  document.body.appendChild(scrim)

  const manual = (): void => handlers.onManualChange()

  const geometricKeys = Object.keys(GEOMETRIC_VIEWS) as GeometricViewName[]
  const atmosphericKeys = Object.keys(ATMOSPHERIC_VIEWS) as AtmosphericViewName[]
  const mergeKeys = Object.keys(MERGE_MODES) as MergeModeName[]
  const mappingKeys = Object.keys(MAPPINGS) as MappingName[]

  /** What the camera bar shows, which during a drag runs ahead of what has
   *  actually been granted. onPassthrough is the only thing allowed to make it
   *  true — see the camera layer's settle(). */
  let camShown = 0

  /**
   * Save, keeping the legacy `mix` in step with the geometric alpha.
   *
   * Nothing reads `mix` any more, but it is the field older builds and older
   * shared links use, and writing it means anyone who lands back on an earlier
   * build sees the picture they left rather than a default. Cheap insurance
   * against a one-way door, and the reason the split did not need to touch the
   * stored shape's meaning at all.
   */
  const save = (): void => {
    prefs.mix = prefs.geoAlpha
    savePrefs(prefs)
  }

  const LAYERS: Layer[] = [
    {
      id: 'geo',
      name: 'Geometric',
      tint: '#9d9bf0',
      keys: geometricKeys,
      label: (k) => GEOMETRIC_VIEWS[k as GeometricViewName].label,
      current: () => prefs.geometricView,
      commit: (k) => {
        prefs.geometricView = k as GeometricViewName
        save()
        handlers.onGeometricView(prefs.geometricView)
        manual()
      },
      alpha: () => prefs.geoAlpha,
      apply: (a) => {
        prefs.geoAlpha = a
        handlers.onGeoAlpha(a)
        manual()
      },
      settle: save,
    },
    {
      id: 'atm',
      name: 'Atmospheric',
      tint: '#4dd6ff',
      keys: atmosphericKeys,
      label: (k) => ATMOSPHERIC_VIEWS[k as AtmosphericViewName].label,
      current: () => prefs.atmosphericView,
      commit: (k) => {
        prefs.atmosphericView = k as AtmosphericViewName
        save()
        handlers.onAtmosphericView(prefs.atmosphericView)
        manual()
      },
      alpha: () => prefs.atmAlpha,
      apply: (a) => {
        prefs.atmAlpha = a
        handlers.onAtmAlpha(a)
        manual()
      },
      settle: save,
    },
    {
      id: 'cam',
      name: 'Camera',
      tint: '#ffcf8a',
      keys: [],
      label: () => '',
      current: () => '',
      commit: () => {},
      alpha: () => camShown,
      apply: (a) => {
        camShown = a
        manual()
      },
      settle: () => {
        // The one control whose value is not ours to decide: the first non-zero
        // drag is what asks for the camera, and the answer can be no.
        void handlers.onPassthrough(camShown).then((granted) => {
          camShown = granted
          prefs.passthrough = granted
          save()
          paint()
        })
      },
    },
  ]

  let selected: Layer['id'] = 'geo'

  /**
   * Take the pointer, if the browser will.
   *
   * Capture keeps a drag alive once the finger leaves the bar, which on a 22px
   * target happens constantly. It is an enhancement and must never be what
   * arms the drag: setPointerCapture throws on an id that is not an active
   * pointer, and a throw above the line that sets the flag abandons the whole
   * gesture instead of degrading it.
   */
  function capture(el: Element, e: PointerEvent): void {
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // No capture; the flag below carries the drag on its own.
    }
  }

  /**
   * Drag anywhere along `bar` to set a 0-1 value.
   *
   * `onGrab` runs on pointerdown, and a layer row passes its own selection in
   * there. Without it the bar — which occupies the middle of the row and stops
   * its own events — swallows every tap aimed at selecting that layer, so the
   * row could only be selected by hitting the thin strip of name above it. A
   * tap on a slider setting the slider *and* focusing the thing it belongs to
   * is what a slider should do anyway.
   */
  function bindBar(
    bar: HTMLElement,
    write: (v: number) => void,
    onSettle: () => void,
    onGrab?: () => void,
  ): void {
    let live = false
    const set = (e: PointerEvent): void => {
      const r = bar.getBoundingClientRect()
      write(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)))
      paint()
    }
    bar.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      capture(bar, e)
      onGrab?.()
      live = true
      set(e)
    })
    bar.addEventListener('pointermove', (e) => {
      if (live) set(e)
    })
    const end = (e: PointerEvent): void => {
      if (!live) return
      live = false
      e.stopPropagation()
      onSettle()
    }
    bar.addEventListener('pointerup', end)
    bar.addEventListener('pointercancel', end)
  }

  function mkBar(tint?: string): HTMLElement {
    const bar = document.createElement('div')
    bar.className = 'hud-bar'
    if (tint) bar.style.setProperty('--tint', tint)
    bar.innerHTML =
      '<div class="hud-bar-track"></div><div class="hud-bar-fill"></div><div class="hud-bar-knob"></div>'
    return bar
  }

  function mkOpt(text: string, onTap: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'hud-opt'
    b.textContent = text
    b.addEventListener('pointerup', (e) => {
      e.stopPropagation()
      onTap()
    })
    return b
  }

  /** The three colour channels, shown while the geometric layer is selected. */
  function mkColours(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'hud-colours'
    for (const { key, label, tint } of CHANNELS) {
      const top = document.createElement('div')
      top.className = 'hud-layer-top'
      top.innerHTML =
        `<span class="hud-layer-name" style="color:${tint}">${label}</span>` +
        `<span class="hud-layer-pct" data-pct="${key}"></span>`
      wrap.appendChild(top)

      const bar = mkBar(tint)
      bindBar(
        bar,
        (v) => {
          prefs.geoColour = { ...prefs.geoColour, [key]: v }
          handlers.onGeoColour(prefs.geoColour)
          manual()
        },
        save,
      )
      wrap.appendChild(bar)
    }
    return wrap
  }

  for (const layer of LAYERS) {
    const row = document.createElement('div')
    row.className = 'hud-layer'
    row.style.setProperty('--tint', layer.tint)
    row.setAttribute('role', 'button')
    row.setAttribute('tabindex', '0')
    row.setAttribute('aria-label', layer.name)

    const top = document.createElement('div')
    top.className = 'hud-layer-top'
    top.innerHTML =
      `<span class="hud-layer-name">${layer.name}</span>` +
      '<span class="hud-layer-val"></span><span class="hud-layer-pct"></span>'
    row.appendChild(top)

    const bar = mkBar()
    bindBar(bar, layer.apply, layer.settle, () => {
      selected = layer.id
    })
    row.appendChild(bar)

    if (layer.keys.length > 0) {
      const opts = document.createElement('div')
      opts.className = 'hud-opts'
      for (const k of layer.keys) {
        opts.appendChild(
          mkOpt(layer.label(k), () => {
            if (k !== layer.current()) layer.commit(k)
            selected = layer.id
            paint()
          }),
        )
      }
      layer.opts = opts
      row.appendChild(opts)
    }

    if (layer.id === 'geo') {
      layer.colours = mkColours()
      row.appendChild(layer.colours)
    }

    row.addEventListener('pointerup', (e) => {
      e.stopPropagation()
      selected = layer.id
      paint()
    })
    row.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      selected = layer.id
      paint()
    })

    layer.row = row
    panel.appendChild(row)
  }

  // ── the things that belong to no layer ──────────────────────────────────

  const global = document.createElement('div')
  global.className = 'hud-global'
  panel.appendChild(global)

  function globalRow(name: string): HTMLElement {
    const row = document.createElement('div')
    row.className = 'hud-global-row'
    row.innerHTML = `<span class="hud-global-name">${name}</span>`
    global.appendChild(row)
    return row
  }

  const mergeRow = globalRow('Merge')
  for (const k of mergeKeys) {
    mergeRow.appendChild(
      mkOpt(MERGE_MODES[k].label, () => {
        prefs.mergeMode = k
        save()
        handlers.onMergeMode(k)
        manual()
        paint()
      }),
    )
  }

  const mapRow = globalRow('Map')
  for (const k of mappingKeys) {
    mapRow.appendChild(
      mkOpt(MAPPING_LABELS[k], () => {
        prefs.mapping = k
        save()
        handlers.onMapping(k)
        manual()
        paint()
      }),
    )
  }

  const toggleRow = globalRow('')
  const autoBtn = mkOpt('Autopilot', () => {
    prefs.autopilot = !prefs.autopilot
    save()
    paint()
    // Turning it on is not a manual change to what is on screen, so it does
    // not suspend — switching it on and then waiting three minutes for it to
    // do anything would read as broken.
  })
  const statsBtn = mkOpt('Readout', () => {
    prefs.showStats = !prefs.showStats
    stats.hidden = !prefs.showStats
    if (!prefs.showStats) stats.textContent = ''
    save()
    paint()
  })
  toggleRow.append(autoBtn, statsBtn)

  // ── painting ────────────────────────────────────────────────────────────

  function paintBar(bar: Element | null | undefined, value: number): void {
    const fill = bar?.querySelector('.hud-bar-fill') as HTMLElement | undefined
    const knob = bar?.querySelector('.hud-bar-knob') as HTMLElement | undefined
    if (fill) fill.style.width = `${value * 100}%`
    if (knob) knob.style.left = `${value * 100}%`
  }

  function paint(): void {
    for (const layer of LAYERS) {
      const row = layer.row
      if (!row) continue
      const a = layer.alpha()
      const on = selected === layer.id
      row.setAttribute('aria-selected', String(on))
      row.dataset.off = String(a <= 0.001)

      const val = row.querySelector('.hud-layer-val')
      if (val) {
        val.textContent =
          layer.keys.length > 0 ? layer.label(layer.current()) : a > 0 ? 'the room' : 'off'
      }
      const pct = row.querySelector('.hud-layer-top .hud-layer-pct')
      if (pct) pct.textContent = `${Math.round(a * 100)}%`
      // The row's own bar is its first — the colour bars below are inside
      // .hud-colours and are painted separately.
      paintBar(row.querySelector(':scope > .hud-bar'), a)

      // The stack never collapses; only a layer's detail does. See the file
      // comment on why those are different things.
      if (layer.opts) {
        layer.opts.hidden = !on
        for (const b of layer.opts.querySelectorAll('.hud-opt')) {
          b.setAttribute('aria-pressed', String(b.textContent === layer.label(layer.current())))
        }
      }
      if (layer.colours) {
        layer.colours.hidden = !on
        const bars = layer.colours.querySelectorAll('.hud-bar')
        CHANNELS.forEach(({ key }, i) => {
          paintBar(bars[i], prefs.geoColour[key])
          const p = layer.colours?.querySelector(`[data-pct="${key}"]`)
          if (p) p.textContent = `${Math.round(prefs.geoColour[key] * 100)}%`
        })
      }
    }

    for (const b of mergeRow.querySelectorAll('.hud-opt')) {
      b.setAttribute('aria-pressed', String(b.textContent === MERGE_MODES[prefs.mergeMode].label))
    }
    for (const b of mapRow.querySelectorAll('.hud-opt')) {
      b.setAttribute('aria-pressed', String(b.textContent === MAPPING_LABELS[prefs.mapping]))
    }
    autoBtn.setAttribute('aria-pressed', String(prefs.autopilot))
    statsBtn.setAttribute('aria-pressed', String(prefs.showStats))
  }

  // ── open / close ────────────────────────────────────────────────────────

  let open = false
  const setOpen = (v: boolean): void => {
    open = v
    scrim.classList.toggle('open', v)
    if (v) paint()
    else stats.textContent = ''
  }

  // Tap the page to open. pointerup rather than click avoids the tap delay some
  // mobile browsers still apply; the distance check keeps it from firing at the
  // end of a swipe, which gestures.ts relies on.
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

  // Anything that reaches the scrim itself is outside the panel — every row
  // and control stops its own events.
  scrim.addEventListener('pointerup', (e) => {
    e.stopPropagation()
    setOpen(false)
  })

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false)
  })

  paint()

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
        // simply not hard enough. Without both, "the shake doesn't work" is
        // two indistinguishable bug reports.
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
        // The error name is what separates them.
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
      save()
      handlers.onAtmosphericView(next)
      if (open) paint()
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
      }
      save()
      // Only repaint what is visible; the panel is closed most of the time and
      // setOpen re-reads everything from prefs anyway.
      if (open) paint()
    },
  }
}
