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
 * Retried on the next gesture if the gate's attempt does not land, but only
 * until it lands once. That is a correction to what this comment used to say
 * — that there was "no further gesture to hang it on". That was true when the
 * app was a gate and a bare canvas; it stopped being true the moment the HUD
 * existed, and the cost of the stale assumption was a fullscreen that could be
 * lost at the gate and never come back, with nothing anywhere saying why.
 *
 * The one-shot rule is what keeps the retry from becoming a nuisance: once we
 * have been fullscreen even once, leaving it is the user's own swipe or back
 * gesture and re-grabbing it on their next tap would be fighting them. So the
 * retry arms only while we have never got in.
 */

/** Where the fullscreen request got to. Diagnostics only — see the readout. */
type FullscreenState = 'unsupported' | 'active' | 'refused' | 'armed' | 'exited'

let fsState: FullscreenState = 'refused'
let fsError = ''
let fsAttempts = 0
let fsArmed = false
let fsEverEntered = false
let fsWatching = false

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
 */
export function fullscreenStatus(): { state: string; attempts: number; error: string } {
  return { state: fsState, attempts: fsAttempts, error: fsError }
}

/** Watch for arriving in — or being thrown out of — fullscreen by any route. */
function watchFullscreen(): void {
  if (fsWatching) return
  fsWatching = true
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      fsEverEntered = true
      setFsState('active')
    } else if (fsEverEntered) {
      // A deliberate exit. Recorded, deliberately not acted on.
      setFsState('exited')
    }
  })
}

/**
 * Ask again on the next tap.
 *
 * pointerup rather than pointerdown: both are activation-triggering in Chrome,
 * but pointerup is the one every engine agrees on, and a tap that ends is
 * unambiguously a tap. Capture phase on window so it sees the gesture whatever
 * the HUD does with it — several HUD controls call preventDefault, which would
 * lose a listener waiting for `click`.
 */
function armFullscreenRetry(): void {
  if (fsArmed || fsEverEntered) return
  fsArmed = true
  setFsState('armed')
  const retry = (): void => {
    window.removeEventListener('pointerup', retry, true)
    fsArmed = false
    goFullscreen()
  }
  window.addEventListener('pointerup', retry, true)
}

export function goFullscreen(): void {
  const target = document.documentElement
  if (!target.requestFullscreen) {
    setFsState('unsupported')
    return
  }
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
        fsEverEntered = true
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
        els.button.textContent = 'Try again'
      }
    }

    els.button.addEventListener('click', onClick)
  })
}
