/**
 * The tap-to-start overlay.
 *
 * This exists because of a hard platform constraint, not as a design flourish:
 * both `getUserMedia` and an unsuspended `AudioContext` require a user gesture
 * on mobile Safari. Everything the app needs must be created inside the click
 * handler, synchronously enough that Safari still considers the gesture live.
 */

import { startMicrophone, type AudioSource } from './audio'
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
