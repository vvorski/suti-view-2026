/**
 * Fullscreen: does the start gesture ask, and does a refusal recover?
 *
 * This probe exists because fullscreen went missing for several builds and
 * nothing noticed. The call was still in the source, unmodified, and still in
 * the shipped bundle — so a reviewer reading the diff would have found nothing
 * wrong, and did. What was missing was any check that the call is made at the
 * one moment it can work (synchronously inside the click handler, before the
 * microphone is awaited), and any path back if the browser says no.
 *
 * It cannot be checked in a browser here: Chrome refuses fullscreen to a window
 * that is not frontmost, so an automation window always reports failure and
 * proves nothing. The logic is deterministic given a stubbed requestFullscreen,
 * which is what this drives.
 *
 * Run: pnpm probe:fullscreen
 */

type Outcome = 'enter' | 'reject' | 'resolve-without-entering'

interface Stub {
  /** How many times requestFullscreen has been called. */
  calls: number
  /** What the next call does. */
  outcome: Outcome
  /** Fire a pointerup on window, as a tap anywhere in the app would. */
  tap(): void
}

/**
 * A DOM with exactly the surface permission-gate touches.
 *
 * Rebuilt per case, and paired with a fresh import of the module — its state
 * (attempts, whether we ever entered) is module-global by design, so reusing
 * one import would let case 2 inherit case 1's history and pass for the wrong
 * reason.
 */
function install(supported: boolean): Stub {
  const winListeners = new Map<string, Set<(e: unknown) => void>>()

  const documentElement: Record<string, unknown> = {}
  const doc: Record<string, unknown> = {
    fullscreenElement: null,
    documentElement,
    addEventListener: () => {},
    createElement: () => ({ getContext: () => null }),
  }

  const stub: Stub = {
    calls: 0,
    outcome: 'enter',
    tap() {
      // Copied before iterating: the retry removes itself while it runs.
      for (const f of [...(winListeners.get('pointerup') ?? [])]) f(undefined)
    },
  }

  if (supported) {
    documentElement.requestFullscreen = (): Promise<void> => {
      stub.calls++
      if (stub.outcome === 'reject') {
        return Promise.reject(new DOMException('denied', 'NotAllowedError'))
      }
      if (stub.outcome === 'enter') doc.fullscreenElement = documentElement
      return Promise.resolve()
    }
  }

  ;(globalThis as Record<string, unknown>).document = doc
  ;(globalThis as Record<string, unknown>).window = {
    addEventListener: (t: string, f: (e: unknown) => void) => {
      if (!winListeners.has(t)) winListeners.set(t, new Set())
      winListeners.get(t)!.add(f)
    },
    removeEventListener: (t: string, f: (e: unknown) => void) => {
      winListeners.get(t)?.delete(f)
    },
    setTimeout,
  }

  return stub
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

// 1. The happy path, and the rule that keeps the retry from becoming a
//    nuisance: once we have been in, a later exit is the user's own doing and
//    must not be undone on their next tap.
{
  const stub = install(true)
  const gate = await freshGate()
  stub.outcome = 'enter'
  gate.goFullscreen()
  await settle()
  check('granted → active', gate.fullscreenStatus().state === 'active', gate.fullscreenStatus().state)

  stub.tap()
  await settle()
  check('granted → a later tap does not re-request', stub.calls === 1, `calls=${stub.calls}`)
}

// 2. The case that was actually happening: refused, and nothing ever asked
//    again. A tap must now recover it.
{
  const stub = install(true)
  const gate = await freshGate()
  stub.outcome = 'reject'
  gate.goFullscreen()
  await settle()
  check('refused → armed', gate.fullscreenStatus().state === 'armed', gate.fullscreenStatus().state)
  check(
    'refused → the reason is recorded',
    gate.fullscreenStatus().error === 'NotAllowedError',
    gate.fullscreenStatus().error,
  )

  stub.outcome = 'enter'
  stub.tap()
  await settle()
  check('refused → next tap recovers it', stub.calls === 2, `calls=${stub.calls}`)
  check('recovered → active', gate.fullscreenStatus().state === 'active', gate.fullscreenStatus().state)

  // And having recovered, it stops asking.
  stub.tap()
  await settle()
  check('recovered → stops asking', stub.calls === 2, `calls=${stub.calls}`)
}

// 3. A resolve is not proof of arrival. Some engines resolve the promise and
//    leave fullscreenElement null; trusting the promise would mark that a
//    success and never retry.
{
  const stub = install(true)
  const gate = await freshGate()
  stub.outcome = 'resolve-without-entering'
  gate.goFullscreen()
  await settle()
  check(
    'resolved but not fullscreen → armed, not active',
    gate.fullscreenStatus().state === 'armed',
    gate.fullscreenStatus().state,
  )
}

// 4. iPhone Safari has no element fullscreen at all. That must be reported as
//    a platform fact, not as a refusal, and must not arm a retry that can
//    never succeed.
{
  install(false)
  const gate = await freshGate()
  gate.goFullscreen()
  await settle()
  check(
    'no API → unsupported',
    gate.fullscreenStatus().state === 'unsupported',
    gate.fullscreenStatus().state,
  )
  check('no API → no attempt counted', gate.fullscreenStatus().attempts === 0, 'attempts counted')
}

// 5. The regression guard proper: the request is made inside the click
//    handler, synchronously, before anything is awaited. This is the assertion
//    whose absence let the whole thing rot — everything above tests
//    goFullscreen, this tests that the gate still calls it at the only moment
//    a browser will honour it.
{
  const stub = install(true)
  const gate = await freshGate()

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
  }
}

console.log(failures === 0 ? '\nall fullscreen checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
