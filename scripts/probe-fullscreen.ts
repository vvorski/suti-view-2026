/**
 * Fullscreen: does the start gesture ask, does a refusal recover, and does it
 * keep recovering — docs/todo.md entry 66.
 *
 * This probe exists because fullscreen went missing for several builds and
 * nothing noticed. The call was still in the source, unmodified, and still in
 * the shipped bundle — so a reviewer reading the diff would have found nothing
 * wrong, and did. What was missing was any check that the call is made at the
 * one moment it can work (synchronously inside the click handler, before the
 * microphone is awaited), and any path back if the browser says no.
 *
 * Entry 66 found that the "any path back" half was itself the bug: automatic
 * re-entry never worked more than once in any build, because the guard that
 * gated it conditioned on history ("has it ever succeeded") rather than state
 * ("is it fullscreen right now"), and this probe's own two anti-nag checks
 * asserted that fault as a requirement. Case 6 below is the one that would
 * have caught it — a cycle of losing and recovering fullscreen more than
 * once — and the two restated checks now say "while active", not "ever
 * again", so a regression back to conditioning on history fails loudly.
 *
 * It cannot be checked in a browser here: Chrome refuses fullscreen to a window
 * that is not frontmost, so an automation window always reports failure and
 * proves nothing. The logic is deterministic given a stubbed requestFullscreen
 * and a stubbed fullscreenchange event, which is what this drives.
 *
 * Run: pnpm probe:fullscreen
 */

type Outcome = 'enter' | 'reject' | 'resolve-without-entering'

interface Stub {
  /** How many times requestFullscreen has been called. */
  calls: number
  /** What the next call does. */
  outcome: Outcome
  /** Fire a pointerup on the retry target — docs/todo.md entry 62 scoped the
   *  retry listener to the picture (`#canvas` in the real app) rather than to
   *  `window`, so a tap anywhere else must not reach it. */
  tap(): void
  /** Simulate losing fullscreen by a route other than a rejected request — a
   *  system back-swipe, a notification, the address bar reappearing. Fires a
   *  real `fullscreenchange` with `document.fullscreenElement` already null,
   *  which is the only way entry 66's re-arm-on-every-loss behaviour can be
   *  exercised: a rejection from `requestFullscreen()` never leaves the
   *  active state to begin with. */
  exit(): void
}

/**
 * A DOM with exactly the surface permission-gate touches.
 *
 * Rebuilt per case, and paired with a fresh import of the module — its state
 * (the one `wantFullscreen` desire, current attempts) is module-global by
 * design, so reusing one import would let case 2 inherit case 1's history and
 * pass for the wrong reason.
 */
function install(supported: boolean): { stub: Stub; canvas: Record<string, unknown> } {
  const docListeners = new Map<string, Set<() => void>>()
  const canvasListeners = new Map<string, Set<(e: unknown) => void>>()

  const documentElement: Record<string, unknown> = { dataset: {} }
  const doc: Record<string, unknown> = {
    fullscreenElement: null,
    documentElement,
    addEventListener: (t: string, f: () => void) => {
      if (!docListeners.has(t)) docListeners.set(t, new Set())
      docListeners.get(t)!.add(f)
    },
    createElement: () => ({ getContext: () => null }),
  }
  // Stands in for `#canvas` — the element docs/todo.md entry 62 scopes the
  // retry to. A plain object with its own listener map, not `window`: the
  // whole point under test is that a tap elsewhere does not reach this.
  const canvas: Record<string, unknown> = {
    addEventListener: (t: string, f: (e: unknown) => void) => {
      if (!canvasListeners.has(t)) canvasListeners.set(t, new Set())
      canvasListeners.get(t)!.add(f)
    },
    removeEventListener: (t: string, f: (e: unknown) => void) => {
      canvasListeners.get(t)?.delete(f)
    },
  }

  const fireFullscreenChange = (): void => {
    // Copied before iterating, matching tap() below: a handler may remove
    // itself (or another) while running.
    for (const f of [...(docListeners.get('fullscreenchange') ?? [])]) f()
  }

  const stub: Stub = {
    calls: 0,
    outcome: 'enter',
    tap() {
      for (const f of [...(canvasListeners.get('pointerup') ?? [])]) f(undefined)
    },
    exit() {
      doc.fullscreenElement = null
      fireFullscreenChange()
    },
  }

  if (supported) {
    documentElement.requestFullscreen = (): Promise<void> => {
      stub.calls++
      if (stub.outcome === 'reject') {
        return Promise.reject(new DOMException('denied', 'NotAllowedError'))
      }
      if (stub.outcome === 'enter') {
        doc.fullscreenElement = documentElement
        // A real browser fires fullscreenchange on a genuine entry too;
        // watchFullscreen() must tolerate seeing 'active' from both this
        // event and the request's own .then() — it does, since the retryFn
        // cleanup on the active branch is a no-op when nothing was armed.
        fireFullscreenChange()
      }
      return Promise.resolve()
    }
  }

  ;(globalThis as Record<string, unknown>).document = doc
  ;(globalThis as Record<string, unknown>).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout,
  }

  return { stub, canvas }
}

/** Fresh module state per case — see install(). */
let caseNo = 0
async function freshGate(): Promise<typeof import('../src/permission-gate.ts')> {
  caseNo++
  return (await import(`../src/permission-gate.ts?probe=${caseNo}`)) as typeof import('../src/permission-gate.ts')
}

/** Let the requestFullscreen promise's handlers run. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

// 1. The happy path, restated as a bounded negative (docs/todo.md entry 66):
//    "while active, a tap does not re-request" — not "ever again", which is
//    exactly the unbounded version that let the real bug hide in this file.
{
  const { stub, canvas } = install(true)
  const gate = await freshGate()
  gate.setFullscreenRetryTarget(canvas as never)
  stub.outcome = 'enter'
  gate.goFullscreen()
  await settle()
  check('granted → active', gate.fullscreenStatus().state === 'active', gate.fullscreenStatus().state)
  check('granted → want is recorded', gate.fullscreenStatus().want === true, 'want was false')
  check('granted → not armed', gate.fullscreenStatus().armed === false, 'armed was true')

  stub.tap()
  await settle()
  check('while active, a tap does not re-request', stub.calls === 1, `calls=${stub.calls}`)
}

// 2. The case that was actually happening: refused, and (before entry 66)
//    nothing ever asked again. A tap must recover it — and, per entry 66,
//    must go on recovering it every time it is lost again afterward (case 6).
{
  const { stub, canvas } = install(true)
  const gate = await freshGate()
  gate.setFullscreenRetryTarget(canvas as never)
  stub.outcome = 'reject'
  gate.goFullscreen()
  await settle()
  check('refused → refused', gate.fullscreenStatus().state === 'refused', gate.fullscreenStatus().state)
  check('refused → armed', gate.fullscreenStatus().armed === true, 'armed was false')
  // Name *and* message: Chrome rejects with a bare TypeError whose only
  // distinguishing content is "not granted", so the name alone is not enough
  // to tell two very different causes apart.
  check(
    'refused → the reason is recorded',
    gate.fullscreenStatus().error === 'NotAllowedError: denied',
    gate.fullscreenStatus().error,
  )

  stub.outcome = 'enter'
  stub.tap()
  await settle()
  check('refused → next tap recovers it', stub.calls === 2, `calls=${stub.calls}`)
  check('recovered → active', gate.fullscreenStatus().state === 'active', gate.fullscreenStatus().state)
  check('recovered → not armed', gate.fullscreenStatus().armed === false, 'armed was true')

  // And having recovered, a further tap while still active does not re-ask.
  stub.tap()
  await settle()
  check('while active, a further tap does not re-request', stub.calls === 2, `calls=${stub.calls}`)
}

// 3. A resolve is not proof of arrival. Some engines resolve the promise and
//    leave fullscreenElement null; trusting the promise would mark that a
//    success and never retry.
{
  const { stub, canvas } = install(true)
  const gate = await freshGate()
  gate.setFullscreenRetryTarget(canvas as never)
  stub.outcome = 'resolve-without-entering'
  gate.goFullscreen()
  await settle()
  check(
    'resolved but not fullscreen → refused, not active',
    gate.fullscreenStatus().state === 'refused',
    gate.fullscreenStatus().state,
  )
  check('resolved but not fullscreen → armed', gate.fullscreenStatus().armed === true, 'armed was false')
}

// 4. iPhone Safari has no element fullscreen at all. That must be reported as
//    a platform fact, not as a refusal, and must not arm a retry that can
//    never succeed.
{
  const { canvas } = install(false)
  const gate = await freshGate()
  gate.setFullscreenRetryTarget(canvas as never)
  gate.goFullscreen()
  await settle()
  check(
    'no API → unsupported',
    gate.fullscreenStatus().state === 'unsupported',
    gate.fullscreenStatus().state,
  )
  check('no API → no attempt counted', gate.fullscreenStatus().attempts === 0, 'attempts counted')
  check('no API → not armed', gate.fullscreenStatus().armed === false, 'armed was true')
}

// 5. The regression guard proper: the request is made inside the click
//    handler, synchronously, before anything is awaited. This is the assertion
//    whose absence let the whole thing rot — everything above tests
//    goFullscreen, this tests that the gate still calls it at the only moment
//    a browser will honour it.
{
  const { stub, canvas } = install(true)
  const gate = await freshGate()
  gate.setFullscreenRetryTarget(canvas as never)

  let onClick: (() => Promise<void>) | null = null
  const els = {
    gate: { classList: { add: () => {} }, hidden: false },
    button: {
      disabled: false,
      textContent: '',
      addEventListener: (_t: string, f: () => Promise<void>) => {
        onClick = f
      },
      removeEventListener: () => {},
    },
    error: { textContent: '' },
  }

  // Never awaited — the microphone cannot start here and the promise never
  // resolves. What matters is what happened before the first await.
  void gate.waitForStart(els as never)
  check('gate binds a click handler', onClick !== null, 'no handler bound')

  // iOS and iPadOS gate the accelerometer behind a dialog, and a dialog spends
  // the gesture. Standing this up lets the probe assert the *order* of the two
  // asks, not merely that both happen — on iPadOS, motion-first meant
  // fullscreen asked with the activation already gone.
  const order: string[] = []
  ;(globalThis as Record<string, unknown>).DeviceMotionEvent = {
    requestPermission: () => {
      order.push('motion')
      return Promise.resolve('granted')
    },
  }
  const requestFullscreen = (
    (globalThis as Record<string, unknown>).document as { documentElement: Record<string, unknown> }
  ).documentElement.requestFullscreen as () => Promise<void>
  ;(
    (globalThis as Record<string, unknown>).document as { documentElement: Record<string, unknown> }
  ).documentElement.requestFullscreen = (...a: unknown[]): Promise<void> => {
    order.push('fullscreen')
    return (requestFullscreen as (...x: unknown[]) => Promise<void>)(...a)
  }

  if (onClick) {
    // Deliberately not awaited. The check below runs at the first await point
    // inside the handler, so a passing result means requestFullscreen was
    // reached synchronously — which is exactly the platform requirement.
    void (onClick as () => Promise<void>)()
    check(
      'start gesture asks for fullscreen before awaiting the microphone',
      stub.calls === 1,
      `calls=${stub.calls} — the request moved after an await and will be refused on a real device`,
    )
    check(
      'fullscreen is asked for before the motion dialog spends the gesture',
      order[0] === 'fullscreen',
      `order=[${order.join(', ')}] — on iPadOS the motion prompt consumes the activation`,
    )
  }
}

// 6. The invariant docs/todo.md entry 66 exists to assert: recovery keeps
//    working after any number of losses, not just the first. This is the
//    check that would have caught the original bug on the day it was
//    written — the two restated above only prove the first cycle still
//    works, exactly as the old, unbounded versions of them did.
{
  const { stub, canvas } = install(true)
  const gate = await freshGate()
  gate.setFullscreenRetryTarget(canvas as never)
  stub.outcome = 'enter'
  gate.goFullscreen()
  await settle()
  check('cycle: initial entry', stub.calls === 1, `calls=${stub.calls}`)

  for (let i = 1; i <= 3; i++) {
    stub.exit()
    await settle()
    check(`cycle ${i}: a real loss is recorded as exited`, gate.fullscreenStatus().state === 'exited', gate.fullscreenStatus().state)
    check(`cycle ${i}: the retry arms`, gate.fullscreenStatus().armed === true, 'armed was false')
    stub.tap()
    await settle()
    check(`cycle ${i}: the tap re-enters`, gate.fullscreenStatus().state === 'active', gate.fullscreenStatus().state)
    check(`cycle ${i}: no longer armed once active`, gate.fullscreenStatus().armed === false, 'armed was true')
  }
  check(
    'cycle: three losses and three recoveries reach four calls total',
    stub.calls === 4,
    `calls=${stub.calls}`,
  )
}

console.log(failures === 0 ? '\nall fullscreen checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
