/**
 * Touch-driven control panel.
 *
 * This exists because every knob worth turning was behind a URL query
 * parameter, and editing a URL on a phone — mid-track, in the dark, with the
 * page already running — is not a thing anyone does. So: tap anywhere to open,
 * tap outside or on Close to dismiss.
 *
 * Choices persist to localStorage. The panel is for use in a room where you
 * want to try something, decide, and have it still be that way tomorrow;
 * re-picking a visualiser on every load would defeat the point. Reads and
 * writes are wrapped because private-mode browsers throw on access rather than
 * returning null.
 */

import type { MappingName } from './mapping'
import { MAPPINGS } from './mapping'
import type { VisualParams } from './mapping'
import { isMergeModeName, MERGE_MODES, type MergeModeName } from './merge-modes'
import {
  ATMOSPHERIC_VIEWS,
  GEOMETRIC_VIEWS,
  isAtmosphericViewName,
  isGeometricViewName,
  type AtmosphericViewName,
  type GeometricViewName,
} from './views'

const STORE_KEY = 'suti-view:prefs'

export interface Prefs {
  geometricView: GeometricViewName
  atmosphericView: AtmosphericViewName
  mergeMode: MergeModeName
  /** 0-1. Universal opacity: 0 is pure atmosphere, 1 is the full blend. */
  mix: number
  mapping: MappingName
  showStats: boolean
}

/** `valid` narrows `raw ?? null` rather than `raw` itself, so the ternary needs
 *  to return that same narrowed value — returning `raw` directly does not
 *  type-check even though it holds the same value. */
function pick<K extends string>(
  raw: string | undefined,
  valid: (v: string | null) => v is K,
  fallback: K,
): K {
  const v = raw ?? null
  return valid(v) ? v : fallback
}

export function loadPrefs(fallback: Prefs): Prefs {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      geometricView: pick(parsed.geometricView, isGeometricViewName, fallback.geometricView),
      atmosphericView: pick(
        parsed.atmosphericView,
        isAtmosphericViewName,
        fallback.atmosphericView,
      ),
      mergeMode: pick(parsed.mergeMode, isMergeModeName, fallback.mergeMode),
      mix:
        typeof parsed.mix === 'number' && parsed.mix >= 0 && parsed.mix <= 1
          ? parsed.mix
          : fallback.mix,
      mapping:
        parsed.mapping && parsed.mapping in MAPPINGS ? parsed.mapping : fallback.mapping,
      showStats:
        typeof parsed.showStats === 'boolean' ? parsed.showStats : fallback.showStats,
    }
  } catch {
    // Private mode, blocked site data, corrupt JSON — all the same to us.
    return fallback
  }
}

function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(prefs))
  } catch {
    // Not being able to remember the choice is not a reason to reject it.
  }
}

export interface ControlPanel {
  /** Call every frame with the current state; only does work while visible. */
  update(params: VisualParams, stats: { frameMs: number; pixelRatio: number }): void
}

interface Handlers {
  onGeometricView(name: GeometricViewName): void
  onAtmosphericView(name: AtmosphericViewName): void
  onMergeMode(mode: MergeModeName): void
  /** 0-1. */
  onMix(mix: number): void
  onMapping(name: MappingName): void
}

const CSS = `
.cp-scrim {
  position: fixed; inset: 0; z-index: 30;
  display: flex; align-items: flex-end; justify-content: center;
  background: rgba(3, 4, 8, 0.55);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  opacity: 0; pointer-events: none; transition: opacity 220ms ease;
}
.cp-scrim.open { opacity: 1; pointer-events: auto; }
.cp-panel {
  width: min(30rem, 100%);
  max-height: 82vh; overflow-y: auto;
  background: rgba(10, 12, 20, 0.92);
  border: 1px solid rgba(255,255,255,0.09);
  border-bottom: none;
  border-radius: 18px 18px 0 0;
  padding: 1.15rem 1.15rem calc(1.15rem + env(safe-area-inset-bottom, 0px));
  transform: translateY(14px); transition: transform 220ms ease;
  color: #cfd3dd;
}
.cp-scrim.open .cp-panel { transform: none; }
.cp-grip {
  width: 2.4rem; height: 3px; border-radius: 2px;
  background: rgba(255,255,255,0.22); margin: 0 auto 1rem;
}
.cp-label {
  font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase;
  color: #5d6577; margin: 0 0 0.5rem;
}
.cp-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.25rem; }
.cp-opt {
  display: block; width: 100%; text-align: left;
  appearance: none; cursor: pointer; font: inherit;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 11px; padding: 0.7rem 0.85rem; color: #aeb5c4;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}
.cp-opt[aria-pressed='true'] {
  border-color: rgba(150,190,255,0.5);
  background: rgba(120,160,255,0.10);
  color: #fff;
}
.cp-opt strong { display: block; font-weight: 500; font-size: 0.94rem; }
.cp-opt span { display: block; font-size: 0.76rem; color: #6a7285; margin-top: 0.12rem; }
.cp-row { display: flex; gap: 0.6rem; align-items: center; }
.cp-row .cp-opt { flex: 1; text-align: center; }
.cp-select {
  width: 100%; appearance: none; cursor: pointer; font: inherit; font-size: 0.94rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 11px; padding: 0.7rem 0.85rem; color: #fff;
  margin-bottom: 1.25rem;
}
.cp-select option { background: #10121b; color: #fff; }
.cp-slider-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; }
.cp-range {
  flex: 1; appearance: none; height: 4px; border-radius: 2px;
  background: rgba(255,255,255,0.14); outline: none;
}
.cp-range::-webkit-slider-thumb {
  appearance: none; width: 17px; height: 17px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 0 5px rgba(120,160,255,0.22); cursor: pointer;
}
.cp-range::-moz-range-thumb {
  width: 17px; height: 17px; border-radius: 50%; border: none;
  background: #fff; box-shadow: 0 0 0 5px rgba(120,160,255,0.22); cursor: pointer;
}
.cp-mix-value {
  font: 400 0.82rem ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #aeb5c4; min-width: 3em; text-align: right;
}
.cp-stats {
  font: 400 10.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre; color: #77809a;
  background: rgba(0,0,0,0.32); border-radius: 10px;
  padding: 0.6rem 0.7rem; margin-bottom: 1rem; overflow-x: auto;
}
.cp-hint { font-size: 0.72rem; color: #4d5566; text-align: center; margin: 0.2rem 0 0; }
`

export function createControlPanel(prefs: Prefs, handlers: Handlers): ControlPanel {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const scrim = document.createElement('div')
  scrim.className = 'cp-scrim'
  scrim.setAttribute('role', 'dialog')
  scrim.setAttribute('aria-label', 'Settings')

  const panel = document.createElement('div')
  panel.className = 'cp-panel'
  scrim.appendChild(panel)

  const grip = document.createElement('div')
  grip.className = 'cp-grip'
  panel.appendChild(grip)

  const stats = document.createElement('pre')
  stats.className = 'cp-stats'
  stats.hidden = !prefs.showStats

  /** One exclusive group of buttons. Returns a re-render for the pressed state. */
  function group<K extends string>(
    title: string,
    entries: Array<[K, string, string]>,
    current: () => K,
    pick: (k: K) => void,
    compact = false,
  ) {
    const heading = document.createElement('p')
    heading.className = 'cp-label'
    heading.textContent = title
    panel.appendChild(heading)

    const wrap = document.createElement('div')
    wrap.className = compact ? 'cp-row' : 'cp-group'
    const buttons = new Map<K, HTMLButtonElement>()

    for (const [key, label, desc] of entries) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'cp-opt'
      b.innerHTML = desc ? `<strong></strong><span></span>` : `<strong></strong>`
      b.querySelector('strong')!.textContent = label
      if (desc) b.querySelector('span')!.textContent = desc
      b.addEventListener('click', () => {
        pick(key)
        sync()
      })
      buttons.set(key, b)
      wrap.appendChild(b)
    }
    panel.appendChild(wrap)

    const sync = () => {
      for (const [key, b] of buttons) {
        b.setAttribute('aria-pressed', String(key === current()))
      }
    }
    sync()
    return sync
  }

  /** A native dropdown — used only for merge mode, where the choice is a
   *  function rather than a look, and a button list would just be a long
   *  list of words with no visual to differentiate them. */
  function select<K extends string>(
    title: string,
    entries: Array<[K, string]>,
    current: () => K,
    pick: (k: K) => void,
  ) {
    const heading = document.createElement('p')
    heading.className = 'cp-label'
    heading.textContent = title
    panel.appendChild(heading)

    const el = document.createElement('select')
    el.className = 'cp-select'
    for (const [key, label] of entries) {
      const opt = document.createElement('option')
      opt.value = key
      opt.textContent = label
      el.appendChild(opt)
    }
    el.value = current()
    el.addEventListener('change', () => pick(el.value as K))
    panel.appendChild(el)
  }

  group<GeometricViewName>(
    'Geometric',
    (Object.keys(GEOMETRIC_VIEWS) as GeometricViewName[]).map((k) => [
      k,
      GEOMETRIC_VIEWS[k].label,
      GEOMETRIC_VIEWS[k].description,
    ]),
    () => prefs.geometricView,
    (k) => {
      prefs.geometricView = k
      savePrefs(prefs)
      handlers.onGeometricView(k)
    },
  )

  group<AtmosphericViewName>(
    'Atmospheric',
    (Object.keys(ATMOSPHERIC_VIEWS) as AtmosphericViewName[]).map((k) => [
      k,
      ATMOSPHERIC_VIEWS[k].label,
      ATMOSPHERIC_VIEWS[k].description,
    ]),
    () => prefs.atmosphericView,
    (k) => {
      prefs.atmosphericView = k
      savePrefs(prefs)
      handlers.onAtmosphericView(k)
    },
  )

  select<MergeModeName>(
    'Merge mode',
    (Object.keys(MERGE_MODES) as MergeModeName[]).map((k) => [k, MERGE_MODES[k].label]),
    () => prefs.mergeMode,
    (k) => {
      prefs.mergeMode = k
      savePrefs(prefs)
      handlers.onMergeMode(k)
    },
  )

  const mixHeading = document.createElement('p')
  mixHeading.className = 'cp-label'
  mixHeading.textContent = 'Mix'
  panel.appendChild(mixHeading)

  const mixRow = document.createElement('div')
  mixRow.className = 'cp-slider-row'
  const mixRange = document.createElement('input')
  mixRange.type = 'range'
  mixRange.className = 'cp-range'
  mixRange.min = '0'
  mixRange.max = '100'
  mixRange.step = '1'
  mixRange.value = String(Math.round(prefs.mix * 100))
  const mixValue = document.createElement('span')
  mixValue.className = 'cp-mix-value'
  mixValue.textContent = `${mixRange.value}%`
  mixRow.appendChild(mixRange)
  mixRow.appendChild(mixValue)
  panel.appendChild(mixRow)

  // Live update on every drag frame (cheap: it just sets a uniform), but only
  // persist to localStorage once the drag ends — a slider fires many `input`
  // events per second and there is no reason to write that often.
  mixRange.addEventListener('input', () => {
    const v = Number(mixRange.value) / 100
    mixValue.textContent = `${mixRange.value}%`
    prefs.mix = v
    handlers.onMix(v)
  })
  mixRange.addEventListener('change', () => savePrefs(prefs))

  group<MappingName>(
    'Audio mapping',
    [
      ['relative', 'Relative', 'Self-calibrating. Best for music.'],
      ['speech-band', 'Absolute', 'Faithful dynamics. Best for voice and ambience.'],
      ['auto-normalised', 'Normalised', 'Fills the range whatever the input.'],
    ],
    () => prefs.mapping,
    (k) => {
      prefs.mapping = k
      savePrefs(prefs)
      handlers.onMapping(k)
    },
  )

  const readoutHeading = document.createElement('p')
  readoutHeading.className = 'cp-label'
  readoutHeading.textContent = 'Readout'
  panel.appendChild(readoutHeading)
  panel.appendChild(stats)

  group<'on' | 'off'>(
    '',
    [
      ['on', 'Numbers on', ''],
      ['off', 'Numbers off', ''],
    ],
    () => (prefs.showStats ? 'on' : 'off'),
    (k) => {
      prefs.showStats = k === 'on'
      stats.hidden = !prefs.showStats
      savePrefs(prefs)
    },
    true,
  )

  const hint = document.createElement('p')
  hint.className = 'cp-hint'
  hint.textContent = 'Tap outside to close'
  panel.appendChild(hint)

  document.body.appendChild(scrim)

  let open = false
  const setOpen = (v: boolean) => {
    open = v
    scrim.classList.toggle('open', v)
  }

  // Tapping the page opens the panel. Using pointerup rather than click avoids
  // the 300ms tap delay some mobile browsers still apply, and it does not fire
  // on a scroll or a drag.
  document.addEventListener('pointerup', (e) => {
    if (open) return
    // Ignore taps on the start overlay, which has its own job.
    const gate = document.getElementById('gate')
    if (gate && !gate.hidden && gate.contains(e.target as Node)) return
    setOpen(true)
  })

  // Close on a tap outside the panel itself.
  scrim.addEventListener('pointerup', (e) => {
    if (!panel.contains(e.target as Node)) {
      e.stopPropagation()
      setOpen(false)
    }
  })
  // Swallow taps inside the panel so the document listener does not re-open it.
  panel.addEventListener('pointerup', (e) => e.stopPropagation())

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false)
  })

  const bar = (v: number) => {
    const n = Math.round(Math.max(0, Math.min(1, v)) * 18)
    return '#'.repeat(n).padEnd(18, '.')
  }

  return {
    update(p, s) {
      // Nothing here is worth doing while the panel is closed — it is the one
      // per-frame DOM write in the whole app.
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
      ].join('\n')
    },
  }
}
