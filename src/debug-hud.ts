/**
 * A numeric readout, shown with `?debug` in the URL.
 *
 * Tuning the mapping happens on a phone, in a real room, where there is no
 * console and no profiler. Without the actual numbers it is impossible to tell
 * "the mapping produces nothing" from "the mapping is fine and the shader is
 * too dark" — the two look identical.
 *
 * The frame time comes from the renderer rather than being measured here, so it
 * reports what the resolution scaler is actually reacting to.
 */

import type { VisualParams } from './mapping'

export interface Hud {
  update(params: VisualParams, stats: { frameMs: number; pixelRatio: number }): void
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

  const bar = (v: number) => {
    const n = Math.round(Math.max(0, Math.min(1, v)) * 20)
    return '#'.repeat(n).padEnd(20, '.')
  }

  return {
    update(p, stats) {
      el.textContent = [
        `${mappingName}  ${(1000 / stats.frameMs).toFixed(0)}fps ${stats.frameMs.toFixed(1)}ms @${stats.pixelRatio}x`,
        `level ${bar(p.level)} ${p.level.toFixed(3)}`,
        `low   ${bar(p.low)} ${p.low.toFixed(3)}`,
        `mid   ${bar(p.mid)} ${p.mid.toFixed(3)}`,
        `high  ${bar(p.high)} ${p.high.toFixed(3)}`,
        `trans ${bar(p.transient)} ${p.transient.toFixed(3)}`,
        `tilt  ${bar(p.tilt)} ${p.tilt.toFixed(3)}`,
        `break ${bar(p.breakdown)} ${p.breakdown.toFixed(3)}`,
        `surge ${bar(p.surge)} ${p.surge.toFixed(3)}`,
      ].join('\n')
    },
  }
}
