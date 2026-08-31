# Built

Entries that shipped **and have been checked since**. `/ccc` moves them here,
one at a time, after re-reading each entry and confirming the code still does
what its **Done when** claims.

That distinction is the whole point of this file. In `docs/todo.md` a `done`
status means an agent said the work was finished. Here it means somebody went
back, read the entry cold, and verified the claim against the code as it now
stands. Three features in one week were marked done, were genuinely built and
wired, and were reported as missing — because *it should look right* was the
acceptance test and nobody looked. A `done` entry still sitting in `todo.md` is
therefore not an oversight; it is the review backlog.

**Entries are kept in full and unedited.** The reasoning is the value — what was
chosen, what it was chosen over, whose call it was, and what was already tried
and failed. A summarised archive is a deleted one.

**Numbers are global and permanent.** They are never reused and never
renumbered, so `supersedes 94` and `build after 88` resolve the same way here as
they did in the queue.

**Search both files, always.** The highest-value question either agent asks is
*is this already built?*, and answering it against one file is how a working
feature gets built twice:

```bash
grep -n 'pattern' docs/todo.md docs/built.md
```

Each entry carries one extra clause on its status line saying when it was
checked:

```markdown
`status: done` · added YYYY-MM-DD · build NNN · verified at build MMM
```

`build NNN` is when it shipped; `verified at build MMM` is when it was read back
against the code. The gap between them is how stale the check is — and once this
file is the whole record, an oldest-verified-first sweep is what catches decay,
which is a different fault from the ones caught on the way in.

## Entries

### 104. The slip needs a direction of its own
`status: done` · added 2026-08-30 · fixes 76 without touching what 76 froze · build 337 · verified at build 348

**Build note (Mine except STIFF/DAMP/MAX_SLIP, frozen at build 249, and
BOUNCE-unrelated — nothing here touches them).** Shipped where Lands-in
says: `rgb-slip.ts` gains a held direction (`dirX`/`dirY`, plus a
`peakMag` the gate below reads); `composite.frag.glsl:uSlip` becomes a
`vec2`, and `off` is read straight from it instead of
`normalize(uTumble.yz)`; `scene.ts`'s `uSlip` uniform and the `updateRgbSlip`
call site follow. One addition Lands-in doesn't name: `shake.ts`'s
`TumbleState` gains `accelX`/`accelY` — the raw, gravity-subtracted,
pre-spring in-plane acceleration `Tumble.sample()` already computes as a
local (`ax`/`ay`) every sample. This is the actual "in-plane acceleration
the tumble is built from" Decided points to; it did not previously escape
the class as a field anyone else could read, and rgb-slip.ts's direction
needs exactly this, not the spring built from it. `setTumble` already
receives the whole `TumbleState`, so no new plumbing reaches main.ts at
all — the two new fields are recorded in `scene.ts`'s own `setTumble` into
two closure variables, read back one line later in `render()`'s existing
`updateRgbSlip` call, the same "reads a sensor, never written back" shape
this file already uses for `motionTiltX/Y` and `emitterGravityX/Y`.

**A second, real bug, found only because the acceptance test is a number
and not a description.** The obvious first design — ease the held
direction toward the raw sample's own unit bearing whenever its magnitude
clears a small fixed deadzone (0.05 m/s², an order below `shake.ts`'s own
`FLOOR`) — passed at the 30 m/s² knock `scripts/probe-rgb-slip.ts`'s own
handling table already uses, and failed at 60 m/s² and above. The cause is
not in this entry's own new code: `shake.ts`'s gravity DC estimate
(`GRAVITY_TAU`, 0.5s) is a first-order high-pass, and any first-order
high-pass rings a real, opposite-signed "droop" after a one-sided pulse —
measured directly, the rebound after a 30 m/s² knock exceeds 1 m/s² for
over half a second and takes nearly two seconds to fall under 0.1 m/s²,
scaling roughly with the kick that caused it. A fixed absolute deadzone can
only ever be tuned against one kick size; at 30 m/s² it happened to sit
above the rebound, at 60 it did not. The actual fix, `PEAK_RATIO`: the
direction updates only while a sample's own magnitude is within half of
this gesture's own recent peak (a peak-hold with `PEAK_TAU`, the identical
shape `shake.ts`'s own `envelope` already uses) — a rebound is by
definition smaller than the peak it followed, so a *ratio* rejects it at
any amplitude where an absolute number can only ever reject one. Verified
in `probe-rgb-slip.ts` up to 120 m/s² (2.7× the handling table's own most
violent case), and against a genuine second, oppositely-aimed hit (the
existing "knock + rebound" scenario), which correctly still registers as
one real reversal rather than being swallowed by the same gate.

**The stale comment, found while in there per Decided's own instruction.**
`MAX_SLIP`'s comment claimed "about two to four pixels on a phone."
Measured: the compositor's own `uv` spans 0-1 across the *full* frame width
(not the aspect-normalised uv the geometric shaders use internally), so on
Decided's own worked example — a 1080px-wide phone — 0.006 uv is 6.48px per
channel, ~13px of total R-to-B separation at the cap. The comment was
wrong, not the geometry; fixed the comment, left `MAX_SLIP` itself
untouched, exactly as Decided requires. `probe-rgb-slip.ts` now asserts
this figure directly.

**Not independently verified: the phone, moved briskly once** (Verify's own
second sentence). The probe is Verify's own first-listed method and is the
one built to be exhaustive here — 12 checks including the exact reversal
count and pixel measurement Decided's own acceptance criterion asks for,
plus the regression guard against the exact bug found while building this.
Left for Victor, the same pattern entries 102 and 103 already used this
window for the live half of Verify.

`pnpm build`, `pnpm lint`, and the full `pnpm probe:*` suite (19 scripts)
all pass with no regressions.


**Do** — give the RGB slip its own held direction vector instead of borrowing
the tumble offset's instantaneous one. The magnitude spring, its two constants
and `MAX_SLIP` are not touched.

**Why** — reported: *"the RGB offset on move, have we got that? not really
seeing it"*. We have got it — entry 76, build 249, and it is wired end to end:
`updateRgbSlip` runs every frame (`scene.ts:960`), `uSlip` reaches the
compositor, and the branch at `composite.frag.glsl:187` samples R and B at
offset uvs. Nothing is disabled and nothing is gated on `prefers-reduced-motion`.
It is nonetheless close to invisible, for a reason in the one line that was
never anybody's suspect.

**Decided**
- **The mechanism.** The magnitude is this effect's own spring; the *direction*
  is `normalize(uTumble.yz)` — the tumble's translational offset. That offset
  is itself a spring (`OFF_STIFF 80`, `OFF_DAMP 7.1`, so ω ≈ 8.9 rad/s), and a
  spring **oscillates through zero**. Two consequences, both fatal and both
  invisible in the source:
  - Because the direction is `normalize`d, the offset's magnitude is discarded
    and only its *sign* survives. So the slip does not fade in and out with the
    tumble — it **flips end for end at the offset's own frequency**, roughly
    three reversals a second while a shake decays. Red leads, then trails, then
    leads again, faster than the eye can resolve as displacement. Integrated,
    that reads as a faint shimmer, which is exactly the "not really seeing it"
    being reported.
  - And the two springs run at deliberately different frequencies — rgb-slip.ts
    says so, and is right to: ω ≈ 20 against the tumble's 8.9, chosen so this
    would not read as the tumble happening twice. The unintended consequence is
    that the slip's own peak lands at an arbitrary phase of the direction's
    oscillation, including near its zero crossing, where `length(uTumble.yz) >
    1e-5` fails and the direction is `vec2(0.0)` — **full magnitude, multiplied
    by nothing.** The very decoupling that makes the effect its own is what
    makes it cancel.
- **So the fix is a direction, and only a direction.** A dispersion has to
  come apart *along a line* and spring back along the same line. That means the
  direction must be **held**, not sampled: its own slow state, easing toward
  where the phone is actually being moved, and **never reset to zero when the
  input is degenerate** — it keeps pointing where it last pointed while the
  magnitude decays to nothing on its own. A held direction with a springing
  magnitude is the whole effect; a springing direction with a springing
  magnitude is noise.
- **The freeze is respected, and this is the reason it can be.** `STIFF = 400`,
  `DAMP = 14` and `MAX_SLIP = 0.006` were approved at build 249 and are **not
  changed by this entry** — the fault is not in the magnitude and re-tuning it
  would be treating a symptom of something a floor below. What changes is where
  the direction comes from, which lives in `composite.frag.glsl` and in a new
  piece of state, not in the frozen numbers. If after this the amplitude still
  wants adjusting, that is a separate conversation with Victor and a separate
  entry; nobody gets to reopen those three constants as a side effect of fixing
  this one.
- **Direction from the disturbance, not from the offset.** `shake.ts` already
  has the in-plane acceleration the tumble is built from; the slip takes its
  own low-passed unit vector from that, in `rgb-slip.ts` alongside the
  magnitude, and hands the compositor a `vec2` instead of a `float`. That also
  removes the last coupling between two modules that the file's own header is
  proud of keeping apart — today it silently depends on a uniform another
  system owns and can zero at any moment.
- **Measured, not eyeballed.** "Not really seeing it" has now been the report
  on three separate features in a week, and each time the thing was built. So
  this entry's acceptance is a **number**: a browser probe that shakes a
  synthetic `disturb` through one decay and records the peak on-screen R-to-B
  separation in device pixels, plus how many times the direction reverses
  during that decay. Today's answer, predicted: a healthy peak and **three or
  four reversals**. After: the same peak, **zero reversals**. A rule that says
  "it should look dispersed" cannot be checked by whoever ships it next.
- **The other number to check while in there**, without changing it:
  `MAX_SLIP`'s comment says "about two to four pixels on a phone", but `uv` in
  the compositor spans 0–1 across the frame, which on a 1080-wide phone makes
  0.006 about six pixels each way and thirteen of separation. Either the
  comment is stale or the geometry is not what it says. **Measure it and fix
  whichever is wrong** — and if it is the comment, say so there rather than
  quietly adjusting the constant to match a sentence.

**Lands in** `src/engine/rgb-slip.ts` — the held direction state, returning a
`vec2`; `src/scene.ts:960` and `:451` — `uSlip` becomes a `vec2`;
`src/shaders/composite.frag.glsl:187-190` — `off` comes from the uniform
rather than from `uTumble`; `scripts/probe-rgb-slip.ts`, which already exists
and gains the reversal count and the pixel measurement.
**Done when** — a synthetic shake produces a slip that comes apart and returns
along one axis with **no sign reversals**; the peak separation is unchanged
from today's measured peak; a still phone gives exactly `vec2(0.0)` so the
`uSlip > 0.0` branch is not taken and the frame is byte-identical to one
compiled without this entry; and `STIFF`, `DAMP` and `MAX_SLIP` are unchanged
in the diff.
**Verify** — the probe, for the reversal count and the pixel measurement, since
both are the things the eye has already failed at twice. Then the phone, moved
briskly once, which is the gesture the report was made about.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 105. XOR, which is not Difference
`status: done` · added 2026-08-30 · build 339 · verified at build 348

**Build note (Mine except the operator itself, which is Decided's own
derivation).** Shipped exactly where Lands-in says: a seventh
`MERGE_MODES` row (`xor: { label: 'XOR', index: 6 }`); one `else if` in
`blendWith` (`composite.frag.glsl`), written in its Porter-Duff form
`base*(1-top) + top*(1-base)` rather than the fuzzy-logic form `a+b-2ab` —
same value (Decided's own algebra), but the Porter-Duff form is what makes
"no clamp needed" legible in the shader itself: a sum of two products each
individually bounded by their own factor in [0,1]. The mode-count comment
at the top of the file and `blendWith`'s own header comment both go from
"six" to "seven". `MergeModeName` gains the member for free — the HUD's
merge-mode wedge, `?merge=`/atmospheric-equivalent parsing, the random
shuffle, and `isMergeModeName`'s own fallback are all keyed off
`Object.keys(MERGE_MODES)`, not a hardcoded list, so nothing else needed
touching. Checked this by grep, not assumption.

**`scripts/probe-composite.ts` extended**, not left to drift — Lands-in
doesn't name it, but it already mirrors `blendWith` line-for-line as a
regression guard for exactly this class of arithmetic bug (entry 34's own
alpha fault), and Decided's own Verify text — "cannot be faked by a
nearly-right formula" — is a request for a number, which a probe answers
better than an eyeball does. Added: the mid-grey null surface itself (XOR
at base 0.5 returns exactly 0.5 for two different, unrelated top values —
the "goes blind" property, not a coincidence at one value); the contrasting
fact that Difference is NOT blind there, tracking `|0.5 - top|` normally;
pass-through-over-black and invert-over-white (the other two corners
Done-when names); the four-corner agreement between XOR and Difference;
Decided's own closed-form gap, `2·min(a,b)·(1-max(a,b))`, checked
numerically rather than assumed correct from the algebra; and a full sweep
confirming XOR never leaves [0,1] without a clamp. One test-writing mistake
caught by the probe itself and fixed before this shipped: an early version
of the null-surface check compared Difference's output against the *input*
grey value at a single top of 1.0 (white) — coincidentally equal there,
since Decided's own gap formula is exactly 0 whenever either input is 1,
which is a wider agreement region than "the four corners" alone. Rewrote
it to compare Difference's own output across two different top values
instead, which is the actual "sensitive vs. blind" property Decided
describes, not a single point that happened to agree.

`pnpm build`, `pnpm lint`, and the full `pnpm probe:*` suite (19 scripts)
all pass with no regressions.

**Not independently verified: the two on-screen checks Verify names** — the
mid-grey field under a white stroke, and the pair side by side over a live
atmosphere looking for Difference's travelling crease. Both are visual
judgment calls about a real atmospheric field (not a flat, controllable
value), which is exactly what a numeric probe cannot stand in for and a
synthetic canvas can only approximate — left for Victor, the same pattern
the rest of this window's entries used for the live half of Verify.


**Do** — add a seventh merge mode, `XOR`, at index 6: `a + b - 2ab`. One line
in `blendWith`, one row in `MERGE_MODES`, available to both layers for free.

**Why** — asked: *"is there a difference between difference blend mode and xor?
if so add it"*. There is, they are genuinely different operators, and the
difference is exactly the kind this project cares about — it is about where an
edge appears that is in neither input.

**Decided**
- **There is exactly one XOR, and it is reached from two directions that
  agree.** That is the part worth writing down:
  - As **fuzzy logic** — the continuous form of exclusive-or on values in
    [0,1] — XOR is `a + b - 2ab`.
  - As **Porter-Duff compositing**, where XOR means "each source shows where
    the other is absent", the operator is `a(1-b) + b(1-a)`.
  - Expand the second: `a - ab + b - ab = a + b - 2ab`. **Identical.** The
    logical reading and the coverage reading are the same function, which is
    why it is a real operator and not an analogy. Photoshop ships it under the
    name *Exclusion*; it is the same thing.
- **And it is not `abs(a - b)`.** Difference and XOR agree on every corner of
  the unit square and disagree everywhere else. The gap has a closed form:
  `XOR - Difference = 2·min(a,b)·(1 - max(a,b))` — zero when either input is 0,
  or either is 1, and largest in the middle, reaching **0.5 at a = b = 0.5**.

  | base | top | Difference | XOR |
  |---|---|---|---|
  | 1.0 | 1.0 | 0.00 | 0.00 |
  | 1.0 | 0.0 | 1.00 | 1.00 |
  | 0.5 | 0.5 | **0.00** | **0.50** |
  | 0.8 | 0.6 | 0.20 | 0.44 |
  | 0.3 | 0.2 | 0.10 | 0.38 |

- **The useful characterisation, and the reason to want it here.** Hold the
  base fixed and XOR is linear in the top: `f(b) = a + b(1 - 2a)`. At `a = 0`
  the slope is +1 — pass-through. At `a = 1` the slope is −1 — pure invert. At
  `a = 0.5` the slope is **zero**, and the output is 0.5 whatever the top does.
  So **XOR is a smooth crossfade from pass-through to invert, driven by what is
  underneath**, and its null surface is *base = 0.5*: it goes blind where the
  ground is undecided.

  Difference's null surface is *base = top*: it cancels where the two layers
  **agree**. And because it is `|·|`, it has a **crease** there — a hard black
  line drawn wherever the geometry happens to match the field's value, an edge
  that exists in neither layer. XOR has no crease anywhere; it can never
  produce an edge that is not in an input.
- **That is the whole argument for adding it to *this* app.** The geometric
  layer is hard-edged strokes and its own header says so twice — drawn, not
  glowing, and an earlier soft version "turned to mush the moment it was
  composited over a busy field". Difference over a moving atmosphere adds a
  travelling contour that belongs to neither layer. XOR gives the same
  inverting character with the layer's own edges intact. They are two tools,
  not a better and a worse, and the app should have both.
- **It needs no clamp.** `a(1-b) + b(1-a)` with both in [0,1] is a sum of two
  non-negative terms bounded by 1, unlike `add` (index 1) which relies on the
  final clamp. Worth a word in the shader, since every other line in that
  ladder either obviously stays in range or obviously does not.
- **Labelled `XOR`, not `Exclusion`.** **Mine.** The registry's other five
  labels are Photoshop's vocabulary and Photoshop calls this Exclusion — but
  `MERGE_MODES` has no description field, so the label is the entire
  explanation the control offers, and "XOR" is the word that was asked for,
  is shorter on a wedge, and is exactly what Porter-Duff calls it. The
  Exclusion synonym goes in the code comment, where a reader coming from a
  design tool will find it.
- **Both layers get it, at no cost.** `blendWith` is one shared ladder for
  geo-over-atm and atm-over-camera — the file comment says keeping it singular
  is deliberate — so one `else if` reaches both selectors and the camera path
  too. No other change anywhere.

**Lands in** `src/merge-modes.ts` — a seventh row at `index: 6`;
`src/shaders/composite.frag.glsl:147-154` — one `else if` in `blendWith`, and
`:26`'s mode list updated to match.
**Done when** — XOR appears in both layers' merge selectors and in the
`?merge=` / atmospheric equivalents; a mid-grey field under a white stroke
shows nothing at all (the null surface, and the fastest way to confirm the
formula is right rather than approximately right); the same stroke over black
passes through and over white inverts; and every existing mode renders exactly
as before, since nothing in the ladder above index 6 is touched.
**Verify** — the mid-grey null case on screen, which distinguishes XOR from
Difference in one glance and cannot be faked by a nearly-right formula. Then
the pair side by side over a live atmosphere, looking specifically for
Difference's travelling crease and its absence in XOR — that is the thing this
entry claims and the only observation that confirms it.
**Hard stops** — prefs no (`MergeModeName` gains a member; the stored fields
are still strings and `isMergeModeName` already rejects unknown values, so an
older build loading `xor` falls back rather than breaking — same shape as entry
101's) · url no, the existing parameters gain a valid value · capture no ·
dependency no.

### 106. The moon's third quality, on the envelope rather than the growth curve
`status: done` · build 341 · added 2026-08-31 · completes 96 · the build agent's refusal was correct · verified at build 348

**Build note (Mine):** Implemented exactly as Decided — `moonBloomFor(moon) =
moon.waxing * moon.presence` in `src/scene.ts`, a new `BLOOM_SWING = 0.18`
constant beside `MOON_REACH_SWING`/`MOON_LIFE_SWING`, and a third uniform,
`uMoonBloom`, riding the same init/per-frame-update path as `uMoonReach` and
`uMoonLife`. No changes were needed in `src/moon.ts` — entry 96 already
exposes the signed `waxing` bias this entry needed; "expose the signed waxing
bias" in Lands-in was already done.

One correction to Lands-in, disclosed rather than silently fixed: it says "the
six ripple shaders." There are seven — `circles`, `shards`, `grid`, `rose`,
`drift`, `chorus`, `tide` — all confirmed via grep to read `FADE_FROM`. Rose
was added after entry 96's own note was written (entry 101) and the count
was never updated. Fixed all seven, not six. Each shader gained the
`uMoonBloom` uniform and a hoisted `float fadeFrom = FADE_FROM + uMoonBloom;`
local (mirroring the existing hoisted-`lifespan` pattern entry 96 already
established), read at every place that shader's opacity formula used to read
`FADE_FROM` directly — 2 sites in `circles`/`rose` (they each have an
audio-ripple loop and a touch-ripple loop), 1 site in the other five. Every
shader's own `const float FADE_FROM = ...;` line is untouched — the bias is
additive at the read site, never a redefinition of the constant itself.

`scripts/probe-moon.ts` was extended, not duplicated, with a new section 8:
exact-zero bloom at new and full moon (any presence, any hour — the identity
holds regardless, since it's `waxing` alone that is 0 at the turning points,
matching section 1's own tolerance style); near-zero bloom at full-moon-down
(presence is what zeroes it there, mirroring section 5(b)'s abundance case);
strongly-signed bloom at first and last quarter, each found at its own
presence peak by the same day-scan section 3 already uses; and the Done-when
claim itself — first- and last-quarter nights with matched abundance (so
every radius-driving input, all of which are functions of abundance alone,
agree) but opposite-signed, clearly different `FADE_FROM`. All 15 new checks
passed on the first run; no bug surfaced in this entry the way one did in
102/104 — the astronomy Decided leaned on (`waxing` being exactly the
illumination fraction's own derivative, zero at both of its extrema) held
exactly as claimed.

`pnpm build`, `pnpm lint`, and all nineteen `pnpm probe:*` scripts pass,
including the extended `probe:moon` and the unrelated `probe:composite`/
`probe:ripples` (neither exercises `FADE_FROM`, checked to be sure). Diff
reviewed for Done-when's own "no growth curve, stroke ratio or LIFESPAN
constant" clause — the only matches are comment prose disclaiming exactly
that, and unmodified `float lifespan = LIFESPAN * uMoonLife;` lines pulled in
as diff context, not edits.

Live verification — two real nights a fortnight apart — is left to Victor,
per Verify's own text; no session can hold both moments at once. The
browser-automation live-render path remains unattempted this session, per the
"two hung calls" threshold established at entry 102 and carried through
103-105; the synthetic probe suite stands in for it per Verify's first-listed
method.

**Do** — wire the waxing/waning bias entry 96 computes but never spends. It
rides `FADE_FROM`, not the growth curve: waxing rings hold full and go out at
the rim; waning rings begin receding almost as soon as they are born.

**Why** — entry 96 shipped two of its three lunar qualities and said so
loudly. The missing one is the one Victor named specifically: the thing that
tells a first-quarter night from a last-quarter one, which nothing else in the
app can do. Asked directly whether to finish it: yes.

**Decided**
- **The build agent was right to refuse, and this entry does not overrule it —
  it takes the refusal as a finding.** Entry 96 asked for the bias on each
  ring's *growth curve*, and `circles.frag.glsl:277-282` already answers that
  exact question in the opposite direction, with reasons: *"Linear, as in the
  source. Ease-out was an embellishment added here and it fights the
  proportional stroke: easing puts nearly all the growth in the first instant,
  so the ring arrives already thick and then only fades."* Drift, Grid and
  Shards each hold their own considered curve. Pushing a shared exponent
  through four documented decisions is precisely what this project's house
  style forbids, and declining to do it was better work than doing it would
  have been. **The entry was wrong about where, not about what.**
- **So: the opacity envelope instead.** Every ripple-drawing shader carries the
  same line — `opacity = percent > FADE_FROM ? 1.0 - (percent - FADE_FROM) /
  (1.0 - FADE_FROM) : 1.0` — with `FADE_FROM = 0.6` and, unlike the growth
  curve, **no argument attached to it anywhere.** It is the one number in a
  ring's life that says *when it starts dying*, which is exactly what blooming
  and receding are.
- **Which way round, and why it reads.** Waxing raises `FADE_FROM` toward
  **0.78**: the ring stays at full strength almost to the rim and then goes out
  quickly — it arrives, it opens, it is spent at the edge. Waning lowers it
  toward **0.42**: the ring begins fading almost immediately and trails off for
  most of its travel — still expanding, but visibly *leaving*. Same journey,
  opposite direction of feeling, and no geometry changed. `BLOOM_SWING = 0.18`,
  **Mine**, on the same footing as `MOON_REACH_SWING` and `MOON_LIFE_SWING`.
- **It rides the plumbing entry 96 already built.** `uMoonReach` and
  `uMoonLife` are already uniforms on all six ripple shaders, set in one place
  (`scene.ts:1242-1243`) and gated on presence. `uMoonBloom` is a third value
  on that same path. No new plumbing, no new file, no shader restructured.
- **The identity is exact and, better, it is exact for a reason.** The bias is
  `waxing × presence`, and `waxing` is **zero by definition at both the new and
  the full moon** — those are the turning points. So the neutral case is not a
  clamp bolted on to satisfy the discipline; it is what the astronomy already
  says. Moon down, new moon, full moon: `FADE_FROM` is 0.6 and every frame is
  identical to build 319's.
- **And the consequence worth the whole entry: the two lunar qualities are in
  quadrature.** Abundance peaks at full and vanishes at new. The bias vanishes
  at full *and* at new, and peaks at the quarters. They never peak together, so
  the month has **four distinct characters** rather than a single bright/dim
  axis:

  | | abundance | bias | how it reads |
  |---|---|---|---|
  | new | 0 | 0 | spare, brief, the plain baseline |
  | first quarter | ~0.5 | **+1** | middling reach, opening outward |
  | full | **1** | 0 | furthest and longest-lived, evenly |
  | last quarter | ~0.5 | **−1** | middling reach, drawing in |

  That is what "the energy of the moon" has to mean if it means anything: a
  cycle, not a dimmer. It only exists once this third quality is wired.
- **Not decided here** → whether the bias should also touch the wake ladder's
  `WAKE_TAU` in Circles, which would make a waning night's memory shorter.
  Plausible, Circles-only, and a separate entry — this one keeps the same
  discipline as 96 and applies one lever identically everywhere.

**Lands in** `src/engine/moon.ts` (or wherever 96 put the derivation) — expose
the signed waxing bias; `src/scene.ts:579-580, 1242-1243` — a third uniform on
the existing path; the six ripple shaders — `FADE_FROM` becomes
`FADE_FROM + uMoonBloom` at the two or three places each already uses it;
`scripts/probe-moon.ts` — extend, do not add a second probe.
**Done when** — a synthetic first-quarter night and a synthetic last-quarter
night, identical in every other input, produce visibly different ring
envelopes and identical ring *radii* over time; new moon, full moon and
moon-below-horizon each produce frames byte-identical to build 319; and no
growth curve, stroke ratio or `LIFESPAN` constant appears in the diff.
**Verify** — `probe-moon.ts` for the four phases and the three identities,
since a real first-quarter and last-quarter night are two weeks apart and no
session can hold both. Then, genuinely: two nights, a fortnight apart, which is
the only test that matters and the one entry 96 correctly said it could not run.
**Hard stops** — prefs no · url no · capture no · dependency no.
