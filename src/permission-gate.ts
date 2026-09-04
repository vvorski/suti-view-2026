/**
 * The tap-to-start overlay.
 *
 * This exists because of a hard platform constraint, not as a design flourish:
 * both `getUserMedia` and an unsuspended `AudioContext` require a user gesture
 * on mobile Safari. Everything the app needs must be created inside the click
 * handler, synchronously enough that Safari still considers the gesture live.
 */

import { startMicrophone, type AudioSource } from './engine'
import { requestMotionAccess } from './shake'

interface GateElements {
  gate: HTMLElement
  button: HTMLButtonElement
  error: HTMLElement
}

/** Turn a getUserMedia rejection into something worth reading on a phone. */
function explain(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access was denied. Allow it in your browser settings for this site, then reload.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found on this device.'
    case 'NotReadableError':
      return 'The microphone is already in use by another app. Close it and try again.'
    default:
      return err instanceof Error
        ? `Could not start audio: ${err.message}`
        : 'Could not start audio.'
  }
}

/** WebGL2 is required — Three dropped WebGL1 support well before r180. */
export function checkWebGL(): boolean {
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2'))
  } catch {
    return false
  }
}

/**
 * Go fullscreen, if this browser will.
 *
 * The visuals are meant to be left running on a phone propped up somewhere,
 * and an address bar and toolbar across a dark field ruin exactly that. The
 * viewport meta already carries `viewport-fit=cover` so the canvas runs under
 * the notch, but that only reclaims the inset — the browser chrome itself
 * needs the Fullscreen API.
 *
 * Called from inside the start gesture and never awaited before the audio
 * path, for two reasons. The obvious one is that fullscreen needs a live user
 * gesture, and this app has exactly one. The other is that it must not be
 * able to fail the start: iPhone Safari has no element fullscreen at all
 * (iPad does, and so does Android Chrome), so on the single most likely
 * device this rejects, and a rejection here means the visualiser simply runs
 * with the browser's chrome — not that it refuses to run.
 *
 * Retried on every loss, not just the first — docs/todo.md entry 66. The
 * five module flags this used to track (state, error, attempts, whether a
 * retry was armed, whether we had ever entered) collapse to one desire,
 * `wantFullscreen`, plus state derived fresh from `document.fullscreenElement`
 * on every `fullscreenchange`. Automatic re-entry never actually worked more
 * than once in any build this app shipped — the old guard (an "ever entered"
 * flag, ORed with an "armed" flag, both since deleted so the fault cannot be
 * reintroduced in the same shape) refused to re-arm the retry once fullscreen
 * had succeeded a single time — because that guard conditioned on *history*
 * ("has it ever succeeded") when what it meant was *state* ("is it
 * fullscreen right now"). Those agree exactly until fullscreen is lost once,
 * which is the case nobody wrote a check for. There is no bad commit to
 * bisect to and no history left for a future guard clause to be written
 * against.
 */

/** Where the fullscreen request got to. Diagnostics only — see the readout.
 *  `'unasked'` is distinct from `'refused'` — see docs/todo.md entry 24: the
 *  fullscreen chip shows on `'refused'`, and starting there before any
 *  request had been made showed the chip at Start, before anything could
 *  have gone wrong yet. `'armed'` is no longer a value here (docs/todo.md
 *  entry 66) — whether a retry is armed is now its own field, since state and
 *  armed-ness are independent: 'exited' can be true at the same time armed is
 *  either true (waiting for the next tap) or, for an instant between that tap
 *  and the retry's own outcome, false. */
type FullscreenState = 'unsupported' | 'active' | 'refused' | 'exited' | 'unasked'

/** The one desire docs/todo.md entry 66 replaces five history flags with —
 *  true from the moment anything first asks for fullscreen (the Start
 *  gesture, or the powder's third tap), false only if that never happened.
 *  Nothing here ever sets it back to false: "leaving the egg does not leave
 *  fullscreen" (entry 61) and there is no other deliberate-exit gesture in
 *  this app that should stop the retry from trying again. Still true after
 *  docs/todo.md entry 128, which does not set it false anywhere — it
 *  declines to set it true on a platform with no Fullscreen API at all. */
let wantFullscreen = false
let fsState: FullscreenState = 'unasked'
let fsError = ''
let fsAttempts = 0
let fsWatching = false
/** Whether a retry listener is currently attached, waiting for the next tap
 *  on the picture. Tracked directly rather than inferred, since "not
 *  fullscreen and armed" and "not fullscreen and mid-retry" are both real,
 *  distinct instants the readout should be able to show. */
let fsArmed = false
let retryFn: (() => void) | null = null

/** Fires whenever `fsState` changes, so the fullscreen chip (docs/todo.md
 *  entry 19) can appear and vanish without polling `fullscreenStatus()`
 *  every frame for a value that changes at most a few times a session. */
let fsListener: (() => void) | null = null

export function onFullscreenChange(cb: () => void): void {
  fsListener = cb
}

function setFsState(next: FullscreenState): void {
  fsState = next
  fsListener?.()
}

/**
 * What happened to the fullscreen request.
 *
 * On screen because this failed silently for several builds and the only
 * report available was "we lost full screen" — which cannot distinguish a
 * platform with no element fullscreen (iPhone Safari) from a request the
 * browser refused for want of a live gesture, and those want opposite fixes.
 *
 * `want`/`armed` added by docs/todo.md entry 66: `state` alone cannot tell
 * "not fullscreen and about to retry on the next tap" apart from "not
 * fullscreen and nothing is even trying", which is the distinction this
 * whole entry is about.
 */
export function fullscreenStatus(): {
  state: string
  attempts: number
  error: string
  want: boolean
  armed: boolean
} {
  return { state: fsState, attempts: fsAttempts, error: fsError, want: wantFullscreen, armed: fsArmed }
}

/** The element whose tap re-requests fullscreen once it has been lost —
 *  docs/todo.md entry 62. `#canvas` rather than `window`: someone who left
 *  fullscreen to read a notification or use the address bar is not dragged
 *  straight back by their next tap anywhere, only by a tap on the picture
 *  itself, which is also the one gesture the powder's own `#powder-canvas`
 *  sits above and intercepts — so the retry needs no explicit awareness of
 *  the powder being up; it simply never receives a tap while that is true. */
let retryTarget: HTMLElement | null = null

/** Set once, from `main()`, before the retry can ever need a target. */
export function setFullscreenRetryTarget(el: HTMLElement): void {
  retryTarget = el
}

/** Watch for arriving in — or being thrown out of — fullscreen by any route,
 *  and re-arm on every loss (docs/todo.md entry 66) rather than only the
 *  first — "if we want it and we are not in it, arm the retry", evaluated
 *  fresh on every change, with no memory of how many times this has already
 *  happened. */
function watchFullscreen(): void {
  if (fsWatching) return
  fsWatching = true
  document.addEventListener('fullscreenchange', () => {
    document.documentElement.dataset.fullscreen = document.fullscreenElement ? 'true' : 'false'
    if (document.fullscreenElement) {
      setFsState('active')
      // A stray armed listener can only mean fullscreen arrived by some
      // route other than that listener's own tap (a stray already fired and
      // its retry() self-removed; this guards the case where it did not).
      if (retryFn && retryTarget) {
        retryTarget.removeEventListener('pointerup', retryFn, true)
        retryFn = null
        fsArmed = false
      }
    } else {
      setFsState('exited')
      armFullscreenRetry()
    }
  })
}

/**
 * Ask again on the next tap of the picture.
 *
 * pointerup rather than pointerdown: both are activation-triggering in Chrome,
 * but pointerup is the one every engine agrees on, and a tap that ends is
 * unambiguously a tap. Capture phase so it sees the gesture whatever the HUD
 * does with it — several HUD controls call preventDefault, which would lose
 * a listener waiting for `click`. Does not stop propagation or call
 * preventDefault itself — this listener only ever fires the actual
 * `goFullscreen()` request, entry 62's own choice for where that has to
 * happen; docs/todo.md entry 80 is what makes the same contact do nothing
 * else while fullscreen is wanted and absent, and it does that in main.ts's
 * own dispatch, at `down`, not here. Before entry 80, the same tap was also
 * an emitter and a screenshot (entries 50 and 52) — that is no longer true.
 */
function armFullscreenRetry(): void {
  if (!wantFullscreen || fsArmed || !retryTarget) return
  fsArmed = true
  retryFn = (): void => {
    retryTarget!.removeEventListener('pointerup', retryFn!, true)
    fsArmed = false
    retryFn = null
    goFullscreen()
  }
  retryTarget.addEventListener('pointerup', retryFn, true)
}

export function goFullscreen(): void {
  const target = document.documentElement
  // docs/todo.md entry 128 — the API test comes *before* `wantFullscreen` is
  // set, and the order is the whole fix. Setting the desire first and then
  // discovering the platform cannot serve it left `want` true for the life of
  // the page on iPhone Safari, which has no element Fullscreen API. `main.ts`
  // reads `want && !document.fullscreenElement` as "a tap owes itself to
  // fullscreen" and drops every non-chip tap on that basis — and on that
  // platform `document.fullscreenElement` is always undefined, so the gate
  // could never reopen. Every geometric view was touch-dead on an iPhone from
  // build 277 to build 429.
  //
  // Fixed here rather than by teaching `fsBlocking` about `'unsupported'`:
  // `want` is documented below as "the one desire", and a desire for
  // something the platform cannot provide is not a state every reader should
  // have to know how to read around.
  if (!target.requestFullscreen) {
    setFsState('unsupported')
    return
  }
  wantFullscreen = true
  watchFullscreen()
  fsAttempts++
  // The first ask carries `navigationUI: 'hide'`; every retry after it asks
  // bare. Not superstition — an engine that dislikes the options dictionary
  // rejects the call outright, and that failure is indistinguishable from a
  // missing gesture from the outside. Since the retry is free, it may as well
  // rule the dictionary out rather than repeat an identical request.
  const options = fsAttempts === 1 ? [{ navigationUI: 'hide' }] : []
  // Still never surfaced as an error and never awaited before the audio path —
  // what the user loses is chrome, not the app. What changed is that a failure
  // now leaves a mark instead of vanishing into an empty catch.
  void (target.requestFullscreen as (o?: FullscreenOptions) => Promise<void>)(
    ...(options as [FullscreenOptions?]),
  ).then(
    () => {
      // A resolve is not proof of arrival: some engines resolve and leave
      // fullscreenElement null. Trust the document, not the promise.
      if (document.fullscreenElement) {
        setFsState('active')
      } else {
        fsError = 'resolved-but-not-fullscreen'
        setFsState('refused')
        armFullscreenRetry()
      }
    },
    (err: unknown) => {
      // Not `instanceof DOMException`. Chrome rejects this with a plain
      // TypeError carrying "not granted" when the window is not focused, and
      // narrowing to DOMException recorded that — the single most informative
      // rejection there is — as "unknown". The message is kept because the
      // name alone does not separate TypeError-because-unfocused from
      // TypeError-because-the-options-dictionary.
      fsError =
        err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 60) : String(err).slice(0, 60)
      setFsState('refused')
      armFullscreenRetry()
    },
  )
}

/**
 * Keep the screen awake.
 *
 * Once started there is no further interaction, so the phone will dim and sleep
 * within a minute — which is exactly wrong for something meant to be left
 * running. Best-effort: unsupported on some browsers, and rejects outright if
 * the page is not visible, neither of which is worth surfacing to the user.
 */
export async function keepAwake(): Promise<void> {
  if (!('wakeLock' in navigator)) return

  let sentinel: WakeLockSentinel | null = null

  const acquire = async () => {
    try {
      sentinel = await navigator.wakeLock.request('screen')
    } catch {
      // Denied or unsupported. The visuals still work; the screen just dims.
    }
  }

  // The lock is dropped whenever the tab is hidden and is not restored
  // automatically, so re-acquire on the way back.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && sentinel?.released !== false) {
      void acquire()
    }
  })

  await acquire()
}

/** What the start gesture bought us. */
export interface Started {
  source: AudioSource
  /** False when the device has no accelerometer, or access was refused. */
  motion: boolean
}

/**
 * Resolves once the user has tapped and the microphone is live.
 *
 * Never rejects — a failure is shown in the overlay and the user can try again,
 * because on mobile the usual fix (grant the permission, plug in a headset) is
 * something they do and then retry, not something a reload helps with.
 */
export function waitForStart(els: GateElements): Promise<Started> {
  return new Promise((resolve) => {
    const onClick = async () => {
      els.button.disabled = true
      els.error.textContent = ''

      // Fullscreen goes first, and the order is load-bearing.
      //
      // All three of these need the gesture, and the gesture is spent by
      // whichever of them puts a dialog on screen. requestMotionAccess() calls
      // DeviceMotionEvent.requestPermission() synchronously on iOS and iPadOS,
      // which is exactly such a dialog — so asking for motion first left
      // fullscreen asking with the activation already gone. iPhone Safari hid
      // that by having no element fullscreen to refuse; iPadOS has it, and
      // there this was a real and silent failure.
      //
      // Fullscreen is also the only one of the three that cannot recover from
      // losing the gesture by explaining itself and offering a retry, so it
      // gets first claim on it. Nothing is given up by this order.
      goFullscreen()

      // Started before the await, not after: iOS gates the accelerometer
      // behind the same live-user-gesture rule as getUserMedia, and awaiting
      // the microphone first spends the gesture. Both calls are made
      // synchronously inside the handler and only then awaited.
      const motion = requestMotionAccess()

      try {
        const source = await startMicrophone()
        els.button.removeEventListener('click', onClick)

        els.gate.classList.add('fading')
        // Match the CSS transition, then take it out of the layout entirely so
        // it cannot swallow taps.
        window.setTimeout(() => {
          els.gate.hidden = true
        }, 600)

        // Motion is optional, so its answer is awaited here rather than
        // being allowed to hold up or fail the start.
        resolve({ source, motion: await motion })
      } catch (err) {
        els.error.textContent = explain(err)
        els.button.disabled = false
        // "Try again" is the voice of a form that rejected you; a toy that
        // failed to start should sound like it is still willing —
        // docs/todo.md entry 51. `\n` rather than a `<br>`, matching the
        // disc's own literal-newline label so `white-space: pre-line`
        // (index.html's `#start` rule) renders both the same way.
        els.button.textContent = 'once\nmore'
      }
    }

    els.button.addEventListener('click', onClick)
  })
}
