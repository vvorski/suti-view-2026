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

import { RELEASE_NAME } from './release-name'

const CSS = `
#version-hud {
  position: fixed;
  left: calc(0.6rem + env(safe-area-inset-left, 0px));
  top: calc(0.6rem + env(safe-area-inset-top, 0px));
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  background: rgba(5, 6, 10, 0.55);
  /* Big, because the whole job of this is being readable at arm's length on a
     phone you are not holding. At 12px it was a build marker you had to go
     looking for; the name is the one thing here worth reading across a room,
     and it is the only thing left in the chip now that the number moved to the
     tooltip. */
  /* Clamped rather than fixed: at a flat 1.45rem a long two-word name runs off
     a 320px screen, and a name that has to be truncated to fit is worse than a
     slightly smaller one. 6vw keeps the longest plausible name on the glass. */
  font: 600 clamp(1.35rem, 7vw, 1.75rem)/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.01em;
  white-space: nowrap;
  color: #cfd6e6;
}
#version-hud button {
  appearance: none;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  /* em, not rem: this is the green "there is a newer build" indicator, and it
     has to grow with the name beside it. At a fixed rem it read as a stray
     speck next to 22px text. */
  font-size: 1.15em;
  cursor: pointer;
  padding: 0.1rem 0.2rem;
  line-height: 1;
  opacity: 0.9;
  transition: color 160ms ease;
}
#version-hud button:hover,
#version-hud button:focus-visible {
  color: #f2f4f8;
}
/* The whole point of the thing. Green is doing real work here — it is the only
   saturated colour anywhere outside the visualiser, so it reads as "something
   changed" without a label explaining it. */
#version-hud button.fresh {
  color: #5fe3a1;
  animation: version-pulse 2.4s ease-in-out infinite;
}
@keyframes version-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
/* A pulsing dot in the corner of a piece meant to be left running on a propped
   phone is exactly the kind of motion someone turns this off for. It still
   goes green; it just stops blinking. */
@media (prefers-reduced-motion: reduce) {
  #version-hud button.fresh {
    animation: none;
  }
}
`

/**
 * How often to look for a new build.
 *
 * Two minutes, and the tab-visible check below is what actually catches most
 * updates — someone who has just been told "it's deployed" picks the phone up,
 * and that is the moment the answer needs to be current. The interval only
 * matters for a phone left propped up and running, where being two minutes
 * late costs nothing.
 */
const POLL_MS = 120_000

/** Our own bundle, e.g. "index-P6Qyn5Kh.js". */
const HASHED = /assets\/(index-[A-Za-z0-9_-]+\.js)/

/**
 * Watch for a newer deploy, and light the reload button when there is one.
 *
 * Deliberately not an automatic reload. Reloading drops whoever is watching
 * back to the "Begin" gate and kills the microphone session — a hostile thing
 * to do unprompted to a piece that is running. The button going green says the
 * same thing and leaves the decision where it belongs.
 *
 * The check needs no build-time support and no extra endpoint: `import.meta.url`
 * is this bundle's own hashed filename, and index.html names the current one.
 * If those disagree, a deploy has landed since this page loaded.
 */
function watchForNewBuild(button: HTMLButtonElement): void {
  const mine = HASHED.exec(import.meta.url)?.[1]
  // In dev there is no hashed bundle to compare against, and every check would
  // report a difference forever. Nothing to watch, so nothing runs.
  if (!mine) return

  let stop = false

  const check = async (): Promise<void> => {
    if (stop) return
    try {
      // Cache-busted and no-store, or this reads back the very bundle it is
      // trying to notice has been replaced.
      const res = await fetch(`./?v=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const theirs = HASHED.exec(await res.text())?.[1]
      if (theirs && theirs !== mine) {
        button.classList.add('fresh')
        button.setAttribute('aria-label', 'A new version is available. Reload')
        button.title = 'A new version is available'
        stop = true // Nothing further to learn; it cannot become stale twice.
      }
    } catch {
      // Offline, or the deploy host is briefly unhappy. Silence is a feature —
      // there is nothing useful to say about a failed check for a new version.
    }
  }

  void check()
  window.setInterval(() => void check(), POLL_MS)
  // The one that matters: picking the phone back up is when the answer needs
  // to be current, and a backgrounded tab's timers are throttled to roughly
  // 1 Hz anyway, so the interval alone cannot be relied on.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check()
  })
}

export function mountVersionHud(): void {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const el = document.createElement('div')
  el.id = 'version-hud'

  const label = document.createElement('span')
  // The name, and no longer the number.
  //
  // The number answered "is this newer than what I had", and the green button
  // below now answers that better — it answers it without anyone having to
  // remember what they had. What is left is the question a number was never
  // any good at: which build is this. See release-name.ts.
  //
  // __BUILD_NUMBER__ stays defined and stays in the bundle: it is what the
  // deploy checks grep for, and it costs nothing.
  label.textContent = RELEASE_NAME
  label.title = `build ${__BUILD_NUMBER__}`
  el.appendChild(label)

  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('aria-label', 'Reload')
  button.textContent = '⟳'
  button.addEventListener('click', () => window.location.reload())
  el.appendChild(button)

  watchForNewBuild(button)

  // Keep a tap here from also being read as a tap or swipe on the canvas
  // underneath — it would otherwise pop the control panel open, or worse,
  // register as part of a swipe gesture, at the same time.
  el.addEventListener('pointerup', (e) => e.stopPropagation())
  el.addEventListener('pointerdown', (e) => e.stopPropagation())

  document.body.appendChild(el)
}
