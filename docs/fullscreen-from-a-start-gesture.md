# Getting a web app into fullscreen from its Start button

Instructions for building this correctly the first time, extracted from a
mobile WebGL app that got it wrong several times. Everything here is a
conclusion from an observed failure, not from a specification — the spec
describes what the API does, and every problem below is about *when* it can
be called and *how* it lies about the outcome.

The setting: a single-page app that opens on a gate screen with one Start
button. Pressing Start must enter fullscreen, ask for a permission or two, and
begin. Every trap below lives in that one click handler.

## 1. The user gesture is a scarce resource, and the order is load-bearing

A click handler carries one *transient user activation*. Several APIs consume
it, and whichever one puts a dialog on screen spends it for the rest.

A typical Start button wants three things at once:

- fullscreen (`requestFullscreen`)
- motion/orientation access (`DeviceMotionEvent.requestPermission`, iOS only)
- microphone or camera (`getUserMedia`)

**Ask for fullscreen first, synchronously, before anything else and before any
`await`.** Then start — do not await — the permission calls, and await them
afterwards.

```js
button.addEventListener('click', async () => {
  goFullscreen()                        // 1. no dialog, needs the activation
  const motion = requestMotionAccess()  // 2. started, not awaited
  const source = await startMicrophone()// 3. awaited last
  ...
  const granted = await motion          // optional, cannot block the start
})
```

Why this order and not another:

- **Fullscreen is the only one of the three that cannot explain itself.** A
  refused microphone can show a message and offer a retry button. A refused
  fullscreen has nothing to say and nowhere to say it, so it gets first claim
  on the gesture. Nothing is given up by putting it first.
- `DeviceMotionEvent.requestPermission()` puts a **native dialog** on screen
  synchronously on iOS and iPadOS. Asking for motion first therefore leaves
  fullscreen asking with the activation already gone. This was a real, silent
  failure on iPadOS. iPhone Safari *hid* it, because it has no element
  fullscreen to refuse in the first place — so the bug existed for a while and
  only appeared on the one device that could have worked.
- **Never `await` before a call that needs activation.** Awaiting the
  microphone first spends the gesture on the microphone's own prompt. Make
  every activation-consuming call synchronously inside the handler and await
  their promises afterwards.

If you add a fourth thing that needs the gesture, you have a design problem,
not an ordering problem. Say so rather than reshuffling.

## 2. iOS Safari has no element fullscreen at all

`Element.requestFullscreen` is simply absent on iPhone Safari. Not refused —
absent. Feature-detect it and record a distinct `unsupported` state:

```js
if (!document.documentElement.requestFullscreen) { state = 'unsupported'; return }
```

This matters more than it looks. "Fullscreen is not working" on a platform
that has no fullscreen and on a platform that refused a request want opposite
fixes, and without the distinction you will spend a session debugging code
that was never going to run.

Do not offer the user a control that re-requests fullscreen on such a
platform. A button that can never work is worse than no button.

## 3. A resolved promise is not proof of arrival

Some engines resolve `requestFullscreen()` and leave `document.fullscreenElement`
null. **Trust the document, not the promise:**

```js
requestFullscreen().then(() => {
  if (document.fullscreenElement) { state = 'active' }
  else { error = 'resolved-but-not-fullscreen'; state = 'refused'; armRetry() }
})
```

## 4. The rejection is not always a DOMException

Chrome rejects this with a plain `TypeError` carrying "not granted" when the
window is not frontmost. Code that narrows with `err instanceof DOMException`
records the single most informative rejection there is as "unknown".

Keep the name *and* the message, truncated:

```js
error = err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 60) : String(err).slice(0, 60)
```

The name alone does not separate a TypeError-because-unfocused from a
TypeError-because-of-the-options-dictionary, which is the next trap.

## 5. The options dictionary can itself be the failure

`requestFullscreen({ navigationUI: 'hide' })` is refused outright by engines
that dislike the dictionary, and that failure is indistinguishable from a
missing gesture from the outside.

Ask with the dictionary on the first attempt and **bare on every retry**.
The retry is free, so it may as well rule the dictionary out rather than
repeat an identical request.

## 6. Arm a retry, and get the event right

A refused request should re-ask on the user's next tap. Three details, each
learned the hard way:

- **`pointerup`, not `click`.** Controls elsewhere in the app call
  `preventDefault()`, which loses a listener waiting for `click`.
- **`pointerup`, not `pointerdown`.** Both trigger activation in Chrome, but
  pointerup is the one every engine agrees on, and a tap that *ends* is
  unambiguously a tap rather than the start of a drag.
- **Capture phase, on `window`.** So it sees the gesture whatever the app's
  own UI does with the event.

Remove the listener the moment it fires, and never arm it if fullscreen has
already been entered once.

## 7. Do not fight a deliberate exit

Watch `fullscreenchange`. When `document.fullscreenElement` becomes null after
having been set, the user left on purpose — swiped, pressed back, switched
apps. **Record it; do not re-request.** Silently dragging someone back into
fullscreen they chose to leave is hostile, and it will read as the app fighting
the phone.

Offer an explicit control instead: a small button, shown only while fullscreen
is lost and the platform supports getting it back. Two things about that
button, both of which cost a build to learn:

- **Put it where a lone control belongs.** If your app's other controls are
  laid out as a row or an arc that is only visible when a panel is open, a
  single button positioned "in that row" appears by itself in the middle of
  the screen, because the rest of the row is not there. Place it with the
  app's persistent furniture instead.
- **Check that hiding it works.** `[hidden] { display: none }` comes from the
  user-agent stylesheet, and *any* author rule setting `display` on that
  element beats it. A button styled with `display: flex` and carrying the
  `hidden` attribute is visible, and `el.hidden = false` is then a no-op. Add
  `.your-chip[hidden] { display: none }` explicitly.

## 8. Record the state and put it on screen

This is the single highest-value thing in this document. Keep:

```
state:    'unasked' | 'unsupported' | 'active' | 'refused' | 'armed' | 'exited'
attempts: number
error:    string
```

and render it in a diagnostic readout behind a flag.

The reason is specific. The only bug report you will ever get is **"we lost
full screen"**, and that sentence cannot distinguish a platform with no
fullscreen from a request refused for want of a gesture from a request that
was never made. Those want completely different fixes. One line of state on
screen settles it in seconds; without it, you will reason from the source,
find nothing wrong, and be right that nothing is wrong with the code you are
reading.

Note `unasked` as a distinct initial value. Initialising the state to
`refused` means anything keyed on "refused" — like the button in §7 — fires
before a single request has been made.

## 9. It cannot be tested in a browser automation session

Chrome refuses fullscreen to a window that is not frontmost. An automated
browser is never frontmost, so it always reports failure and proves nothing.
Do not conclude anything from it, and do not "fix" the resulting refusal.

Test the two halves separately:

- **The logic**, headlessly, against a stubbed `requestFullscreen` you control
  — make it resolve, reject, or resolve-without-entering, and assert the state
  machine and the retry for each. This is deterministic and worth doing.
- **The behaviour**, on a real device, by hand. Switching apps and coming back
  is the case that matters and the one no harness reaches.

Write an explicit assertion that **the call is made inside the click handler
before anything is awaited**. That is the regression that actually happens:
fullscreen went missing for several builds in the app this is drawn from, and
nobody noticed, because the call was still in the source, unmodified, and still
in the shipped bundle. A reviewer reading the diff found nothing wrong — and
was correct. What was missing was any check that it is called at the one moment
it can work.

## 10. Losing fullscreen resizes the viewport

Entering and leaving fullscreen changes the viewport, and browsers do not
reliably fire `resize` before it has settled. If you size anything from
`window.innerWidth`/`innerHeight` — a canvas drawing buffer especially — it
will be stale, and the symptom is silent geometric distortion rather than a
visible error.

Size from the element's own client box (`el.clientWidth`/`clientHeight`),
which is by definition the rectangle CSS is stretching your content across,
and re-check it periodically rather than trusting an event to tell you.

## 11. The HTML around it

```html
<meta name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
```

`viewport-fit=cover` so content runs under the notch and home indicator once
fullscreen lands; `user-scalable=no` because pinch-zoom on a fullscreen canvas
is only ever an accident. Respect `env(safe-area-inset-*)` for anything that
must stay tappable.

## Checklist

- [ ] `requestFullscreen` is the first statement in the click handler
- [ ] Nothing is `await`ed before every activation-consuming call is made
- [ ] `requestFullscreen` is feature-detected, with a distinct `unsupported` state
- [ ] Success is confirmed via `document.fullscreenElement`, not the promise
- [ ] The rejection handler keeps `name` and `message`, and does not narrow to `DOMException`
- [ ] The options dictionary is used on the first attempt only
- [ ] The retry listens for `pointerup`, on `window`, in the capture phase, and unbinds itself
- [ ] A deliberate exit is recorded and never automatically reversed
- [ ] State, attempt count and error string are visible in a diagnostic readout
- [ ] A headless test asserts the ordering against a stubbed API
- [ ] Anything sized from the viewport is re-derived after a fullscreen change
