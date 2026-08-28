# Working in this repo

A microphone-driven WebGL visualiser for a phone held in the hand. Vite +
TypeScript + Three.js + pnpm, no framework. `README.md` is the design record and
is worth reading before changing anything structural — it explains *why* most of
the odd-looking decisions are the way they are.

## Refactor as part of the feature, not after it

**When a change is big, the reorganisation it implies is part of that change.**
Not a follow-up, not a TODO, not "we can tidy this later" — later does not come,
and the next person inherits a shape that stopped describing the code two
features ago.

Concretely, when adding something substantial, look for and fix:

- **A boundary that has grown a second tenant.** One implementation living
  behind an interface is a guess about the future; two is a fact about the
  present. The moment the second arrives, move them behind a real module and
  name it.
- **Analysis wearing rendering clothes** (or vice versa). `scene.ts` has
  repeatedly accumulated things that are not rendering — its own `dt`, its own
  decimation, a log-band reduction. If the thing you are adding needs one of
  those, move it to where it belongs rather than adding a fourth.
- **A shape that has stopped describing the thing.** The HUD's bands are meant
  to read outward as the compositing order. A colour picker got put in the slot
  between the two layers, which is where the merge mode belongs, and the stack
  silently stopped meaning anything. If the arrangement encodes something,
  adding to it means checking the encoding still holds.
- **Duplication that only exists because something was not exported.** Three
  strategies in `mapping.ts` each re-spread the same nine fields because
  `Common` is module-private. Adding a tenth field is a four-file edit. Export
  it instead of making the fourth copy.
- **Hand-tuned constants standing in for layout.** Three absolutely-positioned
  elements at hand-picked offsets in one screen corner worked until the third
  button appeared, then silently overlapped. If you are about to add the third
  of something, that is the signal to make the container do the work.

What this rule is *not*: licence to rewrite whatever you are passing through. A
refactor belongs in the change when the change is what made it necessary or
newly obvious. Speculative reorganisation ahead of a second tenant is the same
mistake in the other direction.

Say what you refactored and why, in the commit message, in prose.

## Verify in the thing, not in your head

This is a *visual* project. A clean `tsc` proves nothing about whether the
picture is right, and reviewing your own diff proves less than that.

- Shader and HUD changes get looked at in a browser before they are committed.
  A throwaway probe page that imports `scene.ts` or `hud.ts` directly is faster
  than reaching the real app through the mic gate, and can be driven from
  `javascript_tool`.
- Behaviour with a timescale longer than a few seconds — structure, flavour,
  the shake springs — gets a headless probe under
  `node --experimental-strip-types`. You cannot tune a ninety-second behaviour
  by watching a screen, and you cannot tune an accelerometer by waving a laptop.
- **Keep a known-good case in every probe.** A probe harness reporting that a
  working view renders black is how two harness bugs got found —
  `requestAnimationFrame` never fires in a non-frontmost automation window, and
  Three sizes the drawing buffer to the *window*, not the canvas CSS box, so
  `readPixels` must use `gl.drawingBufferWidth/Height`. Without a baseline that
  should pass, both would have been read as shader bugs.
- **A plausible-looking table is the dangerous kind of wrong.** The shake probe's
  first run showed every case from a hand tremor upward pinned at the rotation
  cap. That was not the shader; it was the probe's own synthetic spin being a
  constant regardless of amplitude, plus kicks that were not scaled by `dt`.
  Results that are suspiciously uniform are results to distrust.

## Deleting code deletes what it was doing

Twice now, removing something has removed a second thing nobody was tracking.
Dropping a per-frame recompute of the geometric colour also dropped the only
code that was seeding that uniform at startup, so a stored or URL-supplied
colour was ignored for entire sessions and the type checker was perfectly
happy. Before removing a line that writes state, ask what else was relying on it
having been written.

## House style

Read a few files before writing any.

- **Comments carry the reasoning, not the mechanics.** What was tried, what
  failed, what the measured result was, why the obvious version is wrong. The
  `pow(x, 2.0)` note, the double-log note in `spectralBeta`, the
  mean-centring note in `bandVector` — those are the model. Preserve them.
- **Constants get a sentence explaining the number**, especially thresholds and
  time constants. `const HALF = 8 // 0.8s each side` is the minimum; the good
  ones say what breaks at other values.
- **Refusals are behaviour.** Several things here deliberately decline to answer
  — `spectralBeta` skips rail-clipped bands, `spectralFlatness` returns -1 on
  silence rather than reporting a quiet room as maximum noise. Keep that habit
  and test it.
- **Commit messages explain the why, in prose, at length where it earns it.**
- British spelling in prose and identifiers (`normalise`, `colour`).
- Value imports inside `src/` that a probe script needs must carry the `.ts`
  extension — `node --experimental-strip-types` requires it. Type-only imports
  do not.

## Constraints that are not negotiable

- **Audio never leaves the device.** No recording, no upload, no backend.
- **Mobile is the target.** Bundle size and fill rate matter; a desktop-only
  regression is a regression. Nothing needing COOP/COEP headers can ever work,
  because GitHub Pages cannot set them — that rules out `SharedArrayBuffer`.
- **Both hosts serve the same build.** Cloudflare Pages and GitHub Pages
  (`vvorski.github.io/suti-view-2026`, *not* the org account).
- The CI Cloudflare deploy has never worked — `CLOUDFLARE_API_TOKEN` was never
  set as a repo secret. `./deploy/deploy.sh` from a local checkout is the
  working path. Do not "fix" the workflow by guessing at credentials.

## Commands

```bash
pnpm dev            # vite dev server
pnpm build          # tsc --noEmit && vite build   — run before every commit
pnpm lint
pnpm probe          # headless: mappings, ripple triggering
pnpm probe:shake    # headless: tumble springs, shake-vs-knock
pnpm deploy         # build + wrangler pages deploy
```
