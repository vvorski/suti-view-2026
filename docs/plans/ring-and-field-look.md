# Plan: level up the look of Circles and Field

## Context

Six geometric programmes now exist, and four of them are ring families:
Circles, Drift, Chorus, Tide. Circles was the first and is now the least
distinctive of the four — Drift moves the origin, Chorus multiplies it, Tide
puts it on the edge, and Circles is what is left when you take all of those
away. It needs a reason to be picked that is not "it is the plain one".

Field is the default atmospheric view and the one every session starts on. It
is the first thing anyone sees after the gate and has had the least attention
of the four.

This is a **look** change. Nothing about what the app does changes.

## Global Constraints

Binding on every task. A task reviewer checks against these verbatim.

1. **No functionality changes.** No new uniforms, no new `VisualParams` or
   `Character` fields, no new controls, no change to `views.ts` beyond nothing
   at all, no change to any `.ts` file. **The only files any task may edit are
   the one `.glsl` file it names.** If a task appears to need a new uniform,
   it stops and reports rather than adding one.
2. **No new audio reactions.** Every uniform already read by the shader stays
   read the way it is read; a task may change how a value is *drawn*, never
   which value drives what. `uLow` driving the centre pulse stays `uLow`
   driving the centre pulse.
3. **The geometric layer's two rules hold** (`README.md`, and the header of
   every geometric shader): drawn not glowing — hard-edged line work, no
   gaussian falloffs; and white only — `gl_FragColor = vec4(vec3(ink), 1.0)`,
   because all colour is an RGB gain applied later in the composite pass.
   Task 2 is atmospheric and is not bound by these two; Task 1 is.
4. **Fidelity to the source is not negotiable for Circles' ring drawing.**
   `~/dev/circles/src/start/CirclesAnimCanvas.tsx` is the origin: stroke
   widths are fractions of the ring's current radius (`0.22` outer, `0.09`
   inner, inner ring at `0.70` of the outer), growth is linear, fade begins at
   60% of life. That double-band look is the identity of this view and a
   previous session already got it wrong once by drawing hairlines. Distinction
   must come from what is added around it, not from restyling the band.
5. **Cost stays near current.** Mid-range phones, three full-screen passes.
   No nested loops over `MAX_RIPPLES` × anything large.
6. **GLSL traps** (see `.claude/skills/spec-to-issue/recon-traps.md`):
   `pow(x, 2.0)` is undefined for negative `x`; no `fwidth()`; one pixel is
   `1.0 / min(uResolution.x, uResolution.y)`; `const int MAX_RIPPLES = 8;`
   must match `engine/ripples.ts`.
7. **Comments carry the reasoning**, in the register of the existing files —
   what was tried, what failed, what was measured. A constant gets a sentence
   saying what breaks at other values.
8. **Verified on a GPU, with the `circles` baseline rendered in the same
   harness.** A green `pnpm build` is not evidence: GLSL is a string to the
   bundler, so a syntax error builds clean and fails at runtime with a black
   screen.

## Task 1 — Give Circles an identity of its own

**File: `src/shaders/circles.frag.glsl` only.**

Circles must be recognisable at a glance as *not* Drift, Chorus or Tide. All
four share: white bands expanding from an origin, linear growth, the same fade.
Drift/Chorus/Tide took the emitter. Circles cannot take the emitter back, so its
distinction has to be in the **field between and behind the rings** — what the
frame looks like when a ring is not passing through it.

Direction, not prescription. Pick and justify:

- **Wake.** A ring leaves something behind it as it passes — a faint standing
  trace at each radius it has already crossed, decaying slowly. The frame
  accumulates a record of the hits rather than resetting to black. This is the
  strongest candidate: it is invisible in the other three (their origins move,
  so a wake would be a smear rather than a structure) and it directly answers
  "why pick Circles".
- **Interference.** Where two rings overlap, the ink does something other than
  add — a notch, a cancellation, a moiré. Concentric-from-one-point is the only
  arrangement where overlaps are perfectly nested, so this is also uniquely
  available here.
- **A graded centre.** The existing centre ring is a single hairline at
  `0.012 + 0.055 * uLow`. It could be a small structure that reads as the
  source the rings come *from*.

Do **not** reach for: colour (constraint 3), glow (constraint 3), changing the
band widths or the growth curve (constraint 4), or a new emitter (that is the
other three).

The view must still look right in silence — something on screen, not black —
and must not turn into a solid white field when eight loud rings are alive.
Check both explicitly.

### Verification
- Render at several ages with repeated hits so multiple rings are alive.
- Render with no hits at all, several seconds in — confirm it is not black and
  not busy.
- Render eight loud rings at once — confirm it does not saturate to white.
- Render `drift`, `chorus`, `tide` in the same harness and confirm Circles is
  now distinguishable from all three in a still frame.

## Task 2 — Level up Field

**File: `src/shaders/field.frag.glsl` only.**

Field is the default and the first thing anyone sees. Read it first and say in
the report what it currently does before changing anything.

Improve the look within what it already computes. Candidates, in rough order of
expected value:

- **Depth.** A single fbm layer reads flat. Parallax between two or three
  layers moving at different rates gives a sense of volume without a new
  uniform.
- **Contrast and structure.** Where the eye rests. A field of uniform noise has
  no composition; something that reads as a horizon, a core, or a direction
  gives it one.
- **The dark end.** This is a nocturnal palette on a dark ground and most of the
  frame is near-black most of the time. Whether the low end has any modelling in
  it — or crushes to flat black — is most of the perceived quality.
- **Banding.** Smooth gradients on an 8-bit display band visibly, especially in
  the dark. A little ordered dither is cheap and is often the single biggest
  visible improvement.

Do **not**: add uniforms, change which audio value drives which behaviour, or
raise the octave count without measuring the frame time.

### Verification
- Render at low, medium and high `uLevel`, and at both extremes of `uTilt`.
- Render at `uLevel` near zero — the quiet case, which is the reference
  recording's whole character and where most sessions will sit.
- Compare against the pre-change version in the same harness and be honest in
  the report about whether it is actually better or merely different.
