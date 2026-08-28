/**
 * A numeric readout, shown with `?debug` in the URL.
 *
 * Tuning the mapping happens on a phone, in a real room, where there is no
 * console and no profiler. Without the actual numbers it is impossible to tell
 * "the mapping produces nothing" from "the mapping is fine and the shader is
 * too dark" — the two look identical.
 */

import type { VisualParams } from './mapping'

export interface Hud {
  update(params: VisualParams): void
}

export function createHud(mappingName: string): Hud {
  const el = document.createElement('pre')
  el.style.cssText = [
    'position:fixed',
    'top:env(safe-area-inset-top,0px)',
    'left:0',
    'margin:0',
    'padding:0.6rem 0.8rem',
    'font:400 11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
    'color:#7f8a9e',
    'background:rgba(5,6,10,0.55)',
    'pointer-events:none',
    'z-index:20',
    'white-space:pre',
  ].join(';')
  document.body.appendChild(el)

  // Smoothed frame time — the instantaneous value jitters too much to read.
  let frameMs = 16.7
  let last = performance.now()

  const bar = (v: number) => {
    const n = Math.round(Math.max(0, Math.min(1, v)) * 20)
    return '█'.repeat(n).padEnd(20, '·')
  }

  return {
    update(p) {
      const now = performance.now()
      frameMs += (now - last - frameMs) * 0.05
      last = now

      el.textContent = [
        `${mappingName}   ${(1000 / frameMs).toFixed(0)} fps  ${frameMs.toFixed(1)} ms`,
        `level ${bar(p.level)} ${p.level.toFixed(3)}`,
        `low   ${bar(p.low)} ${p.low.toFixed(3)}`,
        `mid   ${bar(p.mid)} ${p.mid.toFixed(3)}`,
        `high  ${bar(p.high)} ${p.high.toFixed(3)}`,
        `trans ${bar(p.transient)} ${p.transient.toFixed(3)}`,
      ].join('\n')
    },
  }
}
