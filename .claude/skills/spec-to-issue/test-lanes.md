# Test lanes

Three lanes. Every spec's `## Test cases` names which apply and what each one
asserts — and gives a reason for any it declares impossible.

There is **no unit-test framework**. No vitest, no jest, no Playwright. The
probe scripts under `scripts/` are what this project has instead, and they work
because the analysis code was deliberately written with no DOM, no globals and
no clock of its own — time arrives as `dt` on the frame. Adding a test runner is
a new dependency and therefore a Hard Stop; do not reach for one because a lane
feels awkward.

---

## Lane 1 — the build gate

```bash
pnpm build     # tsc --noEmit && vite build
pnpm lint
```

The only automated gate, and it runs in seconds. Every spec requires it.

**What it proves:** types line up, imports resolve, GLSL files are found and
inlined by the `?raw` import.

**What it does not prove, at all:** that a shader compiles on the GPU, that the
picture is right, that a number is in a sensible range, or that anything moves.
GLSL is a string to the bundler. A shader with a syntax error builds perfectly
and fails at runtime with a black screen.

Never write "verified by `pnpm build`" for a visual change. It is the floor.

---

## Lane 2 — headless probes

```bash
pnpm probe          # mappings, ripple triggering
pnpm probe:shake    # tumble springs, shake-vs-knock
pnpm probe:slow     # structure and flavour over a 5-minute arrangement
```

This is the real test lane. Use it for anything numeric, anything with a
timescale, and anything whose correct behaviour is a *refusal*.

A spec that adds behaviour to `engine/`, `director.ts` or `shake.ts` names which
probe gains a case, or names the new probe script. Adding
`scripts/probe-<thing>.ts` plus a `"probe:<thing>"` line in `package.json` is
cheap and is the expected move.

**What a probe must do:**

- Drive the real module. Import from `../src/...` with the `.ts` extension —
  `node --experimental-strip-types` requires it on value imports.
- Be deterministic. No `Math.random()`; carry a seeded generator. Two runs that
  cannot be compared are not a harness.
- Print a table a person can read, *and* end with an explicit `PASS:` or
  `CHECK:` line asserting the claims that would make the feature worthless if
  they failed. A wall of numbers with no verdict gets skimmed.
- **Include a known-good baseline case.** See rule 1.

**What a probe is for, specifically:** behaviour you cannot hold in your head.
A five-minute buffer takes five minutes to say anything. An accelerometer cannot
be exercised by waving a laptop. You cannot judge a ninety-second behaviour by
watching a screen — by the time you have seen enough, you have forgotten the
start.

---

## Lane 3 — the browser

Required for **every** change to `shaders/`, `scene.ts`, `hud.ts`, or anything
that positions an element.

Do not reach the app through the mic gate. Write a throwaway page at the repo
root that imports the module directly, drive it, screenshot it, delete it:

```html
<script type="module">
  import { createVisualiser } from '/src/scene.ts'
  const vis = createVisualiser(canvas, {
    geometricView: 'circles', geoColour: { r: 1, g: 1, b: 1 },
    atmosphericView: 'field', mergeMode: 'normal', mix: 1,
  })
  // rAF NEVER FIRES in a non-frontmost automation window. Drive the loop by
  // hand and spin-wait on performance.now(), or uTime never advances, no
  // ripple is ever born, and you will conclude the shader is broken.
  const spin = (ms) => { const u = performance.now() + ms; while (performance.now() < u); }
  const t0 = performance.now()
  for (let i = 0; ; i++) {
    vis.render({ ...params, transient: i === 0 ? 1 : 0 }, spectrum)
    if ((performance.now() - t0) / 1000 >= 1.2) break
    spin(16)
  }
  document.title = 'ready'
</script>
```

Serve it on a port nobody else is using (`pnpm dev --port 5199 --strictPort`),
load it with the `claude-in-chrome` tools, and load them in **one** ToolSearch
call. Check `read_console_messages` for shader compile errors — a failed compile
is a console message and a black screen, not a thrown exception.

For the HUD, the same trick with `createHud` and stub handlers; a tap can be
synthesised with `javascript_tool` dispatching `PointerEvent`s, since the HUD
opens on `pointerup`.

**The device lane inside this one.** `devicemotion`, `env(safe-area-inset-*)`,
the mic gate, and anything about how large a thing feels in the hand cannot be
faked in a desktop browser. A spec that touches those says so, and names what
the user has to check on the phone. Two visibility bugs have shipped past a
passing desktop check already — Android Chrome's bottom toolbar covers
`bottom: 0.6rem`, and `env(safe-area-inset-bottom)` does not account for
browser chrome.

---

## The four rules, with what they look like here

### 1. "No evidence" must fail, not pass

A black screenshot means either the shader is broken or the harness is. These
are indistinguishable without a control, so **every browser probe renders a
known-good view too** — `circles` is the baseline. If the baseline is black, the
harness is broken and nothing else in the run means anything.

This is not hypothetical. A probe once reported a known-good view as black, and
the cause was two harness bugs, not the shader: `requestAnimationFrame` never
fires in a non-frontmost automation window, and Three sizes the drawing buffer
to the *window* rather than the canvas CSS box, so `readPixels(0, 0, 320, 480)`
was sampling an empty corner of a 2934×2182 buffer. Both were read as shader
bugs first.

The headless equivalent: a probe whose cases all agree is a probe to distrust.
The shake probe's first run showed every case from a 0.4 m/s² hand tremor upward
pinned at the same rotation cap. That looked like a plausible table. It was two
bugs — kicks not scaled by `dt`, and the probe's own synthetic input not varying
with amplitude.

### 2. Include a step that proves the test fails

Name the change that should break it and what goes red.

> Set `OUTER_STROKE` to `0.02` and re-run the browser probe: the rings become
> hairlines and no longer read as a double band. Revert.

> In `probe:slow`, force `spectralFlatness` to return `1` and confirm the
> `noisy` column pins at 100 through the ambient sections, where it currently
> reads under 10. Revert.

A probe that passes without exercising anything is indistinguishable from a real
one until the day it matters.

### 3. A visual claim needs an image

"The rings are now thicker" is checked by looking. Attach or describe the
screenshot at a named moment — "at 1.2 s of ring life, on a 520×940 viewport".
A shader change with no screenshot in its verification has not been verified.

### 4. A lane you call impossible costs the same proof as one you write

"Cannot be tested headlessly" is a claim. Name the specific capability missing —
"needs a GPU, and the probe harness has no WebGL context" — or you are excusing
a lane you did not investigate. Most things claimed untestable here turned out
to need a seeded generator and twenty lines.
