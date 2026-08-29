/**
 * A small always-visible build marker plus a refresh button.
 *
 * Deploying doesn't reload anyone who already has the page open — there is no
 * service worker, no polling, nothing watching for a new build. This is both
 * how to tell whether the tab in front of you is stale and the one-tap fix
 * once it is.
 *
 * Mounted unconditionally at startup, before the microphone gate resolves, so
 * it works even for someone staring at a stuck "Start" screen wondering if
 * reloading would help.
 */

import { RELEASE_NAME } from './release-name'

const CSS = `
#version-hud {
  position: fixed;
  /* Top-right, and only the glyph. The release name used to live here as a
     large pill on the left, where it was the loudest thing on the start screen
     and sat across the title. The name now belongs to the gate's own layout
     (see #release-name in index.html) — this is just the control. */
  right: calc(0.6rem + env(safe-area-inset-right, 0px));
  top: calc(0.6rem + env(safe-area-inset-top, 0px));
  z-index: 40;
  display: flex;
  align-items: center;
  padding: 0.25rem;
  color: #6f7789;
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
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.35rem;
  line-height: 1;
  opacity: 0.75;
  transition:
    color 160ms ease,
    opacity 400ms ease;
}
#version-hud button:hover,
#version-hud button:focus-visible {
  color: #f2f4f8;
}
/* Once the visualiser is running, the chip has said what it had to say. The
   name goes entirely and the button fades back to a hint of itself — this is a
   piece meant to be left running on a propped-up phone, and a permanent label
   in the corner of it is litter.

   It is faded rather than removed because it is still the reload control, and
   still the thing that turns green. Opacity, not display, so .fresh below can
   bring it back without either rule having to know about the other. */
#version-hud.running button {
  opacity: 0.18;
  transition: opacity 900ms ease;
}
#version-hud.running button:hover,
#version-hud.running button:focus-visible {
  opacity: 1;
}
/* A new build outranks the fade: the whole reason the button survives into the
   running state is to be able to say this. */
#version-hud.running button.fresh {
  opacity: 1;
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
 * back to the "Start" gate and kills the microphone session — a hostile thing
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

/**
 * Drop the chip to its running form: no name, faded button.
 *
 * Called when the gate resolves rather than driven from inside here, because
 * "the app has started" is main.ts's fact to know — this module would have to
 * watch the gate element to find it out, which is a worse dependency than a
 * one-line call.
 */
/**
 * Write the release name into the gate.
 *
 * It used to be a large pill floating at the top-left, which made a build
 * marker the loudest thing on the start screen and sat it across the title.
 * The name is worth showing — it is how two builds are told apart across a
 * room — but it belongs inside the composition, in the gate's own type, not
 * pasted over it. `#release-name` is a span the gate lays out; if it is
 * missing, nothing here breaks.
 */
export function mountReleaseName(): void {
  const el = document.getElementById('release-name')
  if (!el) return
  el.textContent = RELEASE_NAME
  // __BUILD_NUMBER__ stays in the bundle — it is what the deploy checks grep
  // for, and a tooltip is the right amount of prominence for a number nobody
  // needs unless they are debugging.
  el.title = `build ${__BUILD_NUMBER__}`
}

export function versionHudRunning(): void {
  document.getElementById('version-hud')?.classList.add('running')
}

export function mountVersionHud(): void {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const el = document.createElement('div')
  el.id = 'version-hud'

  // The release name is written into the gate's own layout rather than drawn
  // here — see mountReleaseName(). What is left in this corner is the control.
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
