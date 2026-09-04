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

// .ts extension kept explicit: docs/todo.md entry 99's own probe script
// needs to import this file directly under `node --experimental-strip-
// types`, which requires it for any value import inside src/ — see
// CLAUDE.md.
import { RELEASE_NAME, RELEASE_NAMES } from './release-name.ts'

const CSS = `
#version-hud {
  position: fixed;
  /* Top-left, and only the glyph.
     The name used to live here as a large pill and is now part of the gate's
     own layout (see #release-name in index.html). This went to the right when
     the gate's type was left-justified; the type is right-justified now and
     the share icon has taken that corner, so it comes back to the left. Both
     corners are only ever going to hold one small round thing each. */
  left: calc(0.6rem + env(safe-area-inset-left, 0px));
  top: calc(0.6rem + env(safe-area-inset-top, 0px));
  z-index: 40;
  display: flex;
  align-items: center;
  padding: 0.25rem;
  color: #6f7789;
}
#version-hud button {
  appearance: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  padding: 0.35rem;
  line-height: 1;
  transition:
    color 160ms ease,
    opacity 400ms ease,
    border-color 160ms ease;
}
#version-hud button:hover,
#version-hud button:focus-visible {
  color: #f2f4f8;
}
/* The gate's own chip appearance (docs/todo.md entry 44) — .gate-chip is the
   share button's own class in index.html, shared rather than duplicated.
   Scoped by class toggle (versionHudRunning() below removes it) rather than
   a CSS running-state selector, so "the chip applies while the gate is up"
   is a plain fact about which classes the button carries, not something to
   re-derive from .running on every rule.

   .gate-chip's own border and background need nothing here to win, now that
   the plain button rule above no longer resets either — they used to, and a
   bare .gate-chip class (specificity 0,1,0) cannot outrank an ID-scoped
   #version-hud button rule (1,0,1) regardless of source order, so those
   resets silently ate the chip's own border and background the first time
   this was built. The plain, chip-less look for the running state now sets
   its own border: none and background: transparent explicitly, further
   down, rather than relying on a base that also has to serve the chip.

   The opacity that used to sit on the plain button moved off entirely: a
   chip at that resting 0.75 would fade its own background and border along
   with the glyph, and it would stop matching share, which is fully opaque —
   a translucent *fill*, not a faded element. Quietness here comes from the
   glyph colour instead, the same distinction .gate-chip already draws.

   Fixed at share's own 19px rather than the em size the plain glyph used —
   see the comment that used to justify that: it grew with a release-name
   pill that stood beside it, which does not live in this corner any more
   (see mountReleaseName()'s own comment on where that name moved). Nothing
   beside this glyph needs it to vary in size any longer. */
#version-hud .gate-chip {
  font-size: 19px;
}
#version-hud .gate-chip:hover,
#version-hud .gate-chip:focus-visible {
  border-color: #9d9bf0;
  color: #f0eeff;
}
/* Once the visualiser is running, the chip has said what it had to say. The
   name goes entirely and the button fades back to a hint of itself — this is a
   piece meant to be left running on a propped-up phone, and a permanent label
   in the corner of it is litter.

   It is faded rather than removed because it is still the reload control, and
   still the thing that turns green. Opacity, not display, so .fresh below can
   bring it back without either rule having to know about the other.

   border: none and background: transparent live here now, not on the shared
   base above — by the time .running is added, versionHudRunning() has
   already removed .gate-chip, so nothing else is contesting either property,
   but stating them explicitly means this rule does not depend on that
   ordering to look right. */
#version-hud.running button {
  border: none;
  background: transparent;
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
/* On the gate, the ring goes green too — docs/todo.md entry 44 — exactly as
   .gate-share.done already tints its own border with the same colour. A
   ring of green is more visible from across a room than a glyph of it,
   which is the situation this feature exists for. */
#version-hud .gate-chip.fresh {
  border-color: #5fe3a1;
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

/* docs/todo.md entry 56. Only while the HUD panel is open — closed, this
   stays the faded 0.18 glyph in its usual left corner, unchanged, per
   version.ts's own "a permanent label in the corner is litter" reasoning
   two comments up. The right corner is genuinely free once the gate is
   gone (#share is markup inside #gate), which is what lets this reuse it
   rather than needing one of its own. */
#version-hud.panel-open {
  left: auto;
  top: calc(1.1rem + env(safe-area-inset-top, 0px));
  right: calc(1.1rem + env(safe-area-inset-right, 0px));
}
/* Restates .gate-chip's own border/background rather than relying on the
   class alone: #version-hud.running button (id + 1 class + 1 element)
   still outranks #version-hud .gate-chip (id + 1 class + 0 elements) by
   the exact specificity mechanics entry 44 already found once — two
   classes here is what actually wins over .running's own reset. */
#version-hud.running.panel-open button {
  opacity: 1;
  border: 1px solid rgba(44, 41, 71, 0.9);
  background: rgba(12, 12, 26, 0.7);
}
/* The flip's own surface — "a transient line beside the chip, right-
   aligned, set exactly like .gate-name" (Decided), reusing that class
   directly rather than a second copy of its declarations. Hidden by
   default: most clicks on the running glyph never open this corner at
   all, and an empty flex item here must not reserve space it never uses. */
#version-hud-name {
  display: none;
  margin-right: 0.6rem;
}
#version-hud-name.showing {
  display: inline-block;
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
/** Milliseconds phase one (the history flip) runs for, start to handover —
 *  docs/todo.md entries 55, 99 and 113. Entry 55 gave this 1.4s; entry 99
 *  cut it to 850ms once a second phase followed it, since "fast through the
 *  early history, decelerating" no longer had to carry the flip all the way
 *  to the real name. Entry 113 multiplied that by ten, by request: at 850ms
 *  the whole opening was over in about 1.5 seconds, which is less time than
 *  it takes to notice it is happening. Phase two below is scaled by the same
 *  factor, so the two keep their proportions and the handover still reads as
 *  one effect slowing into another rather than a fast half followed by a
 *  slow one.
 *
 *  Nothing waits on this. See `mountReleaseName`'s own note: the Start disc
 *  is live and pressable from the first frame, and pressing it mid-decode
 *  just leaves. That is what makes a ten-fold slowdown cost nobody
 *  anything.
 *
 *  Exported alongside `NAME_LOCK_STEP_MS` for the probe, which reports the
 *  whole animation's length and cannot do that from one of the two phases. */
export const NAME_FLIP_MS = 8500

/** Milliseconds phase two's own per-character lock advances at — entry 99's
 *  own "about 55ms apart", multiplied by ten for docs/todo.md entry 113
 *  alongside phase one. At the longest name on record (16 characters) this
 *  phase alone now runs ~8.8s; combined with phase one above, a typical
 *  11-character name lands at about 14.6s and the longest at about 17.3s.
 *  Entry 99's "total around 1.6s" is superseded rather than broken — that
 *  comment said in as many words that it was "'around', not a hard ceiling
 *  this is tuned against".
 *
 *  Exported for `scripts/probe-name-decode.ts`, which used to carry its own
 *  copy of this number "duplicated by eye". That is the specific failure
 *  this entry had to fix before it could change anything: with the constant
 *  duplicated, editing this line alone leaves the probe green while testing
 *  nothing, since its assertions are self-consistent against its own stale
 *  copy and would keep passing for ever. */
export const NAME_LOCK_STEP_MS = 550

/** The characters phase two's unresolved positions may show while
 *  cycling — docs/todo.md entry 99's own "drawn from the letters that
 *  actually appear in `RELEASE_NAMES`... katakana would be a costume
 *  borrowed from another work." Built from the full history rather than
 *  hardcoded, so a future name using a character no prior name has used
 *  still decodes correctly instead of the scramble simply never landing on
 *  it — `RELEASE_NAME` is always one of `RELEASE_NAMES`, so its own
 *  characters are guaranteed present by construction. `Set` dedupes;
 *  `Array.from` is what makes a `Set` iterable in one pass without a
 *  library. Computed once, at module load — `RELEASE_NAMES` never changes
 *  at runtime. */
const SCRAMBLE_ALPHABET = Array.from(new Set(RELEASE_NAMES.join('').split(''))).join('')

function scrambleChar(): string {
  return SCRAMBLE_ALPHABET[Math.floor(Math.random() * SCRAMBLE_ALPHABET.length)]
}

/**
 * One frame of phase two: `target`'s own characters for every position
 * already locked, a freshly re-rolled scramble character for every
 * position still ahead of the lock — recomputed fresh each call, which is
 * what makes the unresolved tail visibly cycle frame to frame rather than
 * sit on one wrong guess. Exported so `scripts/probe-name-decode.ts` can
 * check the one property that actually matters headlessly: the locked
 * prefix is always exactly right and the rest is always drawn from the
 * declared alphabet, regardless of how the random draws land.
 */
export function renderLockFrame(target: string, locked: number): string {
  let out = ''
  for (let i = 0; i < target.length; i++) {
    out += i < locked ? target[i] : scrambleChar()
  }
  return out
}

/** How many characters are locked at a given elapsed time into phase two —
 *  pure, so the timing itself (not just the per-frame render above) is
 *  probeable without a `requestAnimationFrame` loop or a DOM. */
export function lockedCountAt(elapsedSincePhaseTwoMs: number, targetLength: number): number {
  return Math.min(targetLength, Math.max(0, Math.floor(elapsedSincePhaseTwoMs / NAME_LOCK_STEP_MS)))
}

/** docs/todo.md entry 99 (absorbing entry 94)'s reduced-motion path, re-anchored
 *  to the shared step by entry 113. It used to run at a hardcoded 3 characters
 *  a second, deliberately *slower* than the normal path's 18 — and slowing only
 *  the normal path would have inverted that, making reduced motion the fast
 *  decode and contradicting `mountReleaseName`'s own "`prefers-reduced-motion`
 *  gets a slower decode, not none."
 *
 *  Sharing `NAME_LOCK_STEP_MS` preserves the ordering by making the two equal,
 *  and 550ms a character is strictly less churn than the 333ms it had before —
 *  so this path comes out more compliant than it went in, not less. What
 *  actually protects it is unchanged and is not a rate at all: it **never
 *  scrambles**, it types (`.slice`, not `renderLockFrame`). */
export function reducedLockedCountAt(elapsedMs: number, targetLength: number): number {
  return Math.min(targetLength, Math.max(0, Math.floor(elapsedMs / NAME_LOCK_STEP_MS)))
}

/**
 * The fallback of last resort — docs/todo.md entry 99's own "even if a
 * build somehow reaches the most conservative path, the name arrives —
 * fades up over ~400ms — rather than snapping in." Reached only when there
 * is no release history to flip or type through at all (`RELEASE_NAMES`
 * empty), which cannot happen in practice — the array always holds at
 * least the current name — but the entry names this path explicitly rather
 * than leaving it as dead-code-shaped code that nobody decided the
 * behaviour of. `#release-name`'s own `transition: opacity 400ms ease`
 * (index.html) does the actual fade; this only sets the two opacity values
 * either side of it.
 */
function fadeInName(el: HTMLElement, text: string): void {
  el.style.opacity = '0'
  el.textContent = text
  requestAnimationFrame(() => {
    el.style.opacity = '1'
  })
}

/**
 * Write the release name into the gate — docs/todo.md entries 43, 55 and 99
 * (absorbing 94).
 *
 * It used to be a large pill floating at the top-left, which made a build
 * marker the loudest thing on the start screen and sat it across the title.
 * The name is worth showing — it is how two builds are told apart across a
 * room — but it belongs inside the composition, in the gate's own type, not
 * pasted over it. `#release-name` is a span the gate lays out; if it is
 * missing, nothing here breaks.
 *
 * Two phases, on a normal phone. Phase one runs the chip through every name
 * this app has ever had, first to last, fast through the early history and
 * decelerating — entry 55, shortened (`NAME_FLIP_MS`'s own comment) now that
 * it hands over rather than carrying all the way to the real name. Phase two
 * — entry 94, absorbed by 99 — takes over from wherever phase one left off
 * and locks the real name on, left to right, about every `NAME_LOCK_STEP_MS`:
 * positions already locked show the target's own characters, positions still
 * ahead cycle through `SCRAMBLE_ALPHABET`, re-rolled every frame, so the tail
 * visibly decodes rather than merely appearing. The handover is deliberately
 * a straight cut from one phase's own rendering to the other's rather than a
 * cross-fade: both phases show a monospace string of the same general shape
 * (lowercase letters and spaces, changing every frame), so the cut itself
 * reads as the flip slowing into the lock rather than as two unrelated
 * effects meeting.
 *
 * `prefers-reduced-motion` gets a *slower* decode, not none — entry 99's own
 * central finding, absorbing 94's argument: a character resolving in place
 * has no motion vector, so the honest reduced-motion answer is "do not
 * flicker", not "show nothing". About three characters a second, left to
 * right, with no scramble on the positions still to come (`.slice`, not
 * `renderLockFrame` — an unresolved character here is simply not there yet,
 * which reads as typing rather than decoding, and rapid churn on a
 * screen already asked for less of exactly that is closer to flashing
 * content than to an animation). Previously this branch returned the final
 * name immediately, which was invisible on any phone in the very state it
 * was meant to handle — Battery Saver and Accessibility → Remove animations
 * both set this preference on Android, and nobody confirmed the phone was
 * in it, because confirming it needed `?debug`. `#motion-glyph` below is
 * this file's answer to that: a one-glance confirmation on the gate itself,
 * so "is the animation actually running" never again depends on knowing an
 * OS setting exists.
 *
 * A plain `textContent` swap, not a canvas or an SVG effect: `.gate-name`'s
 * own monospace font is what makes every phase read as clean characters
 * rather than a jitter, since every position keeps the same width
 * regardless of what is currently showing.
 *
 * Never delays Start: this only ever writes to `#release-name`'s own text,
 * on a `requestAnimationFrame` loop that does not block or gate anything
 * else — the disc is live and pressable from the very first frame, and
 * pressing it mid-decode is not a special case, it just leaves.
 */
export function mountReleaseName(): void {
  const el = document.getElementById('release-name')
  const glyph = document.getElementById('motion-glyph')
  if (!el) return
  // __BUILD_NUMBER__ stays in the bundle — it is what the deploy checks grep
  // for, and a tooltip is the right amount of prominence for a number nobody
  // needs unless they are debugging.
  el.title = `build ${__BUILD_NUMBER__}`

  // Screen readers get the name, not the flipping — otherwise this
  // announces every name in the history to someone who asked for one. The
  // animating span is hidden from the accessibility tree; the wrapping
  // element (already in the gate's own markup) carries the real name as
  // its label regardless of which name the flip currently happens to show.
  el.setAttribute('aria-hidden', 'true')
  el.parentElement?.setAttribute('aria-label', RELEASE_NAME)

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // docs/todo.md entry 99 — the one-glance diagnosis. Filled means motion is
  // playing in full; the hollow default (no class) is what a script-
  // disabled page already renders, so an unreadable glyph never implies the
  // wrong state by accident.
  if (!reduced) glyph?.classList.add('full')

  const n = RELEASE_NAMES.length
  if (n === 0) {
    fadeInName(el, RELEASE_NAME)
    return
  }

  const target = RELEASE_NAME
  const start = performance.now()

  if (reduced) {
    const step = (now: number): void => {
      const locked = reducedLockedCountAt(now - start, target.length)
      el.textContent = target.slice(0, locked)
      if (locked < target.length) {
        requestAnimationFrame(step)
      } else {
        el.textContent = target
      }
    }
    // Called once synchronously — see the full-motion path's own comment
    // on why an unstarted decode must never leave the span empty.
    step(start)
    return
  }

  const step = (now: number): void => {
    const elapsed = now - start
    if (elapsed < NAME_FLIP_MS) {
      // Phase one — entry 55's own ease-out: steep early, flattening
      // toward the handover.
      const t = elapsed / NAME_FLIP_MS
      const eased = 1 - (1 - t) * (1 - t)
      const index = Math.min(n - 1, Math.floor(eased * n))
      el.textContent = RELEASE_NAMES[index]
      requestAnimationFrame(step)
      return
    }
    // Phase two — entry 94's own lock, absorbed by 99.
    const locked = lockedCountAt(elapsed - NAME_FLIP_MS, target.length)
    if (locked >= target.length) {
      // Exact, rather than trusting the last scrambled frame's rounding to
      // have already landed on it.
      el.textContent = target
      return
    }
    el.textContent = renderLockFrame(target, locked)
    requestAnimationFrame(step)
  }
  // Called once synchronously rather than only scheduled — a chip mounted
  // into a tab that is backgrounded or not yet visible can have its first
  // rAF callback deferred arbitrarily, and the span must never sit empty in
  // the meantime: an unstarted flip is a worse failure than one that has
  // not finished. This paints the oldest name immediately (or, on a
  // browser that never grants this tab a frame at all, leaves it showing
  // that name rather than nothing); `step()` schedules its own continuation
  // internally, so this single call is the whole start of the sequence.
  step(start)
}

export function versionHudRunning(): void {
  const el = document.getElementById('version-hud')
  el?.classList.add('running')
  // The gate's own chip appearance leaves with the gate — docs/todo.md
  // entry 44 — rather than fading along with everything else: a chip at
  // running's 0.18 opacity is not a faint glyph, it is a dark disc, which
  // is exactly the litter the running state exists to avoid.
  el?.querySelector('button')?.classList.remove('gate-chip')
}

/** Milliseconds the reload flip runs for — docs/todo.md entry 56. Shorter
 *  than entry 55's 1.4s on load: this is a confirmation in front of an
 *  action someone is already waiting on, not an arrival. */
const RELOAD_FLIP_MS = 600

/**
 * Flip the corner's transient name through the release history, quickly,
 * then reload — docs/todo.md entry 56. The same eased, time-based sequence
 * `mountReleaseName()` runs on load, shorter and writing into a different
 * element, so a reload that used to look like nothing happening has
 * something happening in front of it. Reduced motion reloads immediately,
 * with no flip at all: unlike entries 54 and 55, there is nothing to
 * soften here — the animation is pure feedback in front of a navigation,
 * and someone who asked for less motion is better served by the
 * navigation itself happening sooner.
 */
function flipThenReload(nameEl: HTMLElement): void {
  if (RELEASE_NAMES.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.location.reload()
    return
  }
  nameEl.classList.add('showing')
  const n = RELEASE_NAMES.length
  const start = performance.now()
  const step = (now: number): void => {
    const t = Math.min(1, (now - start) / RELOAD_FLIP_MS)
    const eased = 1 - (1 - t) * (1 - t)
    const index = Math.min(n - 1, Math.floor(eased * n))
    nameEl.textContent = RELEASE_NAMES[index]
    if (t < 1) requestAnimationFrame(step)
    else window.location.reload()
  }
  // Called once synchronously first, for the same reason entry 55's own
  // load animation does — see mountReleaseName()'s own comment.
  step(start)
}

export function mountVersionHud(): void {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const el = document.createElement('div')
  el.id = 'version-hud'

  // The gate's own release name is written into the gate's own layout
  // rather than drawn here — see mountReleaseName(). This corner's own
  // transient name (entry 56) is a different thing: it exists only while
  // the panel is open, only during a reload's own flip, and is removed the
  // instant the reload fires — "the same object returning rather than a
  // new one appearing", reusing .gate-name's own styling directly rather
  // than a second copy of it.
  const nameEl = document.createElement('span')
  nameEl.id = 'version-hud-name'
  nameEl.className = 'gate-name'
  nameEl.setAttribute('aria-hidden', 'true')
  el.appendChild(nameEl)

  const button = document.createElement('button')
  button.type = 'button'
  // The gate's own chip — see the CSS's own comment on why this is a class
  // toggle rather than a `.running`-scoped selector, and versionHudRunning()
  // below for where it comes off.
  button.classList.add('gate-chip')
  button.setAttribute('aria-label', 'Reload')
  button.textContent = '⟳'
  button.addEventListener('click', () => {
    // Only while the panel is open does the flip have anywhere to show
    // itself — see `#version-hud-name`'s own comment on why that surface
    // exists only then. Closed, this is exactly the plain immediate
    // reload it always was.
    if (document.querySelector('.hud-scrim.open')) flipThenReload(nameEl)
    else window.location.reload()
  })
  el.appendChild(button)

  // The panel's own open state, made public by hud.ts rather than reached
  // for here — docs/todo.md entry 56. `.gate-chip` is re-added on open (it
  // was removed once running started, in versionHudRunning() below) and
  // removed again on close, so the button's own appearance follows the
  // exact same class this file already uses on the gate, rather than a
  // second, parallel state.
  document.addEventListener('hud-panel', (e) => {
    // Only ever fires once the panel exists to open, which is only once
    // the app is running and versionHudRunning() has already stripped
    // .gate-chip — so toggling it on `open` alone is exactly right here,
    // with no need to also account for the pre-Start gate, which this
    // event is never dispatched during.
    const open = (e as CustomEvent<{ open: boolean }>).detail.open
    el.classList.toggle('panel-open', open)
    button.classList.toggle('gate-chip', open)
  })

  watchForNewBuild(button)

  // Keep a tap here from also being read as a tap or swipe on the canvas
  // underneath — it would otherwise pop the control panel open, or worse,
  // register as part of a swipe gesture, at the same time.
  el.addEventListener('pointerup', (e) => e.stopPropagation())
  el.addEventListener('pointerdown', (e) => e.stopPropagation())

  document.body.appendChild(el)
}
