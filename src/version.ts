/**
 * A small always-visible build marker plus a refresh button.
 *
 * Deploying doesn't reload anyone who already has the page open — there is no
 * service worker, no polling, nothing watching for a new build. This is both
 * how to tell whether the tab in front of you is stale and the one-tap fix
 * once it is.
 *
 * Mounted unconditionally at startup, before the microphone gate resolves, so
 * it works even for someone staring at a stuck "Begin" screen wondering if
 * reloading would help.
 */

const CSS = `
#version-hud {
  position: fixed;
  left: calc(0.6rem + env(safe-area-inset-left, 0px));
  top: calc(0.6rem + env(safe-area-inset-top, 0px));
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: rgba(5, 6, 10, 0.55);
  font: 500 12px ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #9aa3b8;
}
#version-hud button {
  appearance: none;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  padding: 0.1rem 0.3rem;
  line-height: 1;
  opacity: 0.9;
  transition: color 160ms ease;
}
#version-hud button:hover,
#version-hud button:focus-visible {
  color: #f2f4f8;
}
`

export function mountVersionHud(): void {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const el = document.createElement('div')
  el.id = 'version-hud'

  const label = document.createElement('span')
  // The build number is the git commit count at build time (see
  // vite.config.ts) — it can only ever move forward, and nobody has to
  // remember to bump it.
  label.textContent = `v${__BUILD_NUMBER__}`
  el.appendChild(label)

  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('aria-label', 'Reload')
  button.textContent = '⟳'
  button.addEventListener('click', () => window.location.reload())
  el.appendChild(button)

  // Keep a tap here from also being read as a tap or swipe on the canvas
  // underneath — it would otherwise pop the control panel open, or worse,
  // register as part of a swipe gesture, at the same time.
  el.addEventListener('pointerup', (e) => e.stopPropagation())
  el.addEventListener('pointerdown', (e) => e.stopPropagation())

  document.body.appendChild(el)
}
