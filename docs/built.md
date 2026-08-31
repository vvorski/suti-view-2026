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

**Verification note — `/ccc` at build 348, and one claim above is now
false.** Every reversal case in the build note and in the probe drove a
*single half-cycle* knock (0.09s at 5.5Hz), which by construction never
crosses the sine's zero and so never reverses its own raw sample. Done-when
says "a synthetic shake", and a shake is an oscillation. Measured on build
337 as shipped: two seconds of sustained shaking gave **19 reversals at 5Hz,
11 at 3Hz, 7 at a 2Hz wave**, with the probe green throughout.

Fixed at build 348 by folding each sample onto the axis already held before
easing it in — a dispersion is a line, not an arrow, and a sample pointing
the other way down the same line is the same evidence about that line. The
frozen constants are untouched.

Consequently the sentence above beginning *"and against a genuine second,
oppositely-aimed hit … which correctly still registers as one real
reversal"* **no longer describes the code.** Under an axis model a hit aimed
180° away is the same line and is deliberately not a reversal. That check's
underlying guard — that `PEAK_RATIO` is not so aggressive it swallows real
input — is kept and now reads: a second hit aimed *across* the first re-aims
the axis; one aimed back along it does not disturb it. Three sustained-shake
cases were added alongside.


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

### 79. Rings stop adding up, and a pull reads as a sequence
`status: done` · build 343 · added 2026-08-30 · verified at build 351

**Build note (Mine):** Also disclosing a process gap this entry itself
surfaced: its header line was missing from the file (the entry's body ran on
directly from entry 78's, with only a bare `status: ready` marking the seam),
so every prior queue survey this session ran skipped it silently. Restored
`### 79.` — the one gap in an otherwise-contiguous 1-107 — in its own commit
before claiming, disclosed there in full.

Implemented the four sites Decided names: `circles.frag.glsl`'s touch loop
(the primary cause — sixteen slots, a drag trail landing many near-identical
rings on the same pixels) and its audio loop, `drift.frag.glsl`, and
`tide.frag.glsl`, all changed from `ink += (outer + inner) * opacity` to the
screen operator `ink = 1.0 - (1.0 - ink) * (1.0 - (outer + inner) * opacity)`
— same choice, same reason, as entry 47's own use of it. `grid`/`shards` use
a different (`intensity`-based) accumulation and were correctly left alone,
per Decided's own "field, lattice and cells do not use this pattern."

Per-slot stroke/phase variation ("Mine" in Decided) added to the touch loops
only, gated by `i < AUDIO_RIPPLES` in the shared drift/tide loops so audio
rings are untouched: a `hash(float(i) + offset)` nudges each touch ring's
radius by ±2% and stroke width by ±12%. One judgment call here, disclosed
rather than guessed silently: Done-when says "a single ring looks exactly as
it does today," which taken completely literally conflicts with Decided's
own instruction to vary stroke by slot index unconditionally — any slot hash
that isn't exactly at its neutral point changes a lone ring's thickness by
construction. Read "exactly as today" as the ink-combine identity instead
(`screen(0, c) = c`, so a single ring's brightness is bit-identical to the
old `+=`, which is the claim a probe can actually check) and kept the
stroke/phase variation small enough — ±12%/±2% — to be a nuance on one ring
and a real difference across many. `hash(float x)` was added to
`circles.frag.glsl` and `drift.frag.glsl` (didn't have one); `tide.frag.glsl`
already had the identical one-liner `rose`/`chorus` use.

`scripts/probe-ripples.ts` gained the check Verify names directly: sixteen
overlapping contributions screened together never exceed 1 (1000 random
trials, plus the degenerate all-full-strength worst case, which lands at
exactly 1), and `screen(0, c)` equals plain addition for a lone ring —
Done-when's own identity, made concrete. All three new checks passed; the
addition-vs-screen identity check itself needed a tolerance rather than
`===` on the first run, floating point on `1 - (1 - 0.58)` not landing on
0.42 bit-exact — the same class of thing this queue has hit before with
GLSL/JS float arithmetic, not a real bug.

`pnpm build`, `pnpm lint`, and all nineteen `pnpm probe:*` scripts pass.
Live verification — a slow drag and four-finger scribbling on the phone,
per Verify's own text — is left to Victor; the browser-automation path
remains unattempted this session, per the "two hung calls" threshold this
queue has carried since entry 102.

**Do** — combine overlapping rings instead of summing them, and vary each ring
enough that a dragged trail reads as a run of rings rather than one thick one.

**Why** — pulling a touch across Circles turns it into a solid mass. Two
separate causes, and the file already contains the argument against one of
them.

**Decided**
- **The cause is `+=`, and this exact mistake is documented twenty lines
  above.** `circles.frag.glsl:329` is `ink += (outer + inner) * opacity`, and
  the audio *wake* in the same file uses `max()` with the comment: *"max(), not
  +=. Eight overlapping traces summed pins the ladder solid white — Grid's
  fronts did exactly this — and a wake that saturates has stopped being a
  record of anything."* The wake learned it; the rings never did. There are
  **sixteen** touch slots and entry 57 lays a trail of them along a drag, so a
  pull puts many near-identical rings on the same pixels and they sum straight
  past 1.
- **Screen, not `max()`.** `ink = 1 − (1 − ink)(1 − c)`. `max()` is what the
  wake needed — a record where the strongest event wins — but for rings the
  overlap genuinely means *more ink here*, and screen keeps that legible while
  being arithmetically incapable of clipping. It is also already the file
  vocabulary: `blendWith`'s mode 2, and the operator entry 47 chose for the
  same "must not clip" reason. **Mine.**
- **The same fault, three more places.** `circles.frag.glsl:292` (the *audio*
  ring loop, not the wake), `drift.frag.glsl:144` and `tide.frag.glsl:130` all
  sum the same way. Fix all four; they are one line each. `field`, `lattice`
  and `cells` do not use this pattern and are not touched.
- **"One colour" invites the wrong fix, so: the rings stay white.** The
  geometric layer draws in white only and all its colour comes from
  `uGeoColour` in the composite — `geo-colour.ts` defends that deliberately, so
  that "the geometry can be kept deliberately out of the atmospheric layer's
  hue range, so the two layers never fight for the same colour". Giving touch
  rings their own hues would undo that for a symptom whose actual cause is
  saturation. **The mass is fixed by structure and density, not by colouring
  the rings differently.**
- **A trail should read as a sequence.** Rings laid a fraction of a second
  apart have nearly the same radius and sit almost exactly on top of each
  other, so even without clipping they read as one thick stroke. Vary stroke
  width and ring phase deterministically by **slot index** — free, stable
  frame to frame, and it makes the count of touches visible in the picture.
  **Mine.**
- **The smarter version is interference, and it is deliberately not this
  entry.** Two real ripples crossing produce nodes and antinodes, not a
  brighter blob: accumulate a *signed* wave per ring and take the magnitude at
  the end, and overlaps gain structure as you touch more rather than losing it.
  That is the genuinely interesting answer to "do it smarter" — and it changes
  how every ring looks, audio ones included, so it belongs in its own entry
  proven on Circles alone once this has landed. Recorded here so it is not
  lost, and so nobody smuggles it in as part of a saturation fix.

**Lands in**
- `src/shaders/circles.frag.glsl:292, 329` — both loops.
- `src/shaders/drift.frag.glsl:144`, `src/shaders/tide.frag.glsl:130`.
- Ring stroke/phase variation by slot index, in the touch loops only.

**Done when** — dragging a finger across Circles leaves a legible run of
expanding rings rather than a filled shape; sixteen simultaneous touch ripples
cannot drive `ink` above 1 anywhere on screen; a single ring looks exactly as it
does today; and the audio rings stop clipping in loud passages, which is the
same fix arriving somewhere nobody reported it.
**Verify** — the phone, with a slow drag and then with four fingers scribbling,
which is the case that produces the mass. `probe-ripples.ts` can assert the
combine never exceeds 1 for any number of overlapping contributions, which is
arithmetic and needs no GPU.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Verification note — `/ccc` at build 351.** Correct as built, and correct as scoped — but the scope was short. Chorus was never named and is the fourth ring family; and Rose, written two days later by entry 101, inherited Circles' stroke vocabulary from *before* this fix and reproduced the saturation wholesale. Both now screen their ripple strokes. A finding fixed in one view came back in a view written after it, which is an argument for this file being searched, not only the live queue.
### 101. Rose — Circles turned ninety degrees, and spinning
`status: done` · added 2026-08-30 · build 330 · verified at build 351

**Build note (Mine).** Shipped `src/shaders/rose.frag.glsl` (new) and a fourth
`GEOMETRIC_VIEWS` entry in `src/views.ts`, before `drift` as Lands-in asks.
Every hit fires an N-fold rosette (3/5/6/8-fold, picked by section from
`uSeed.x`) that sweeps in angle from a hashed birth angle, alternating
direction by ring-buffer slot parity ("odd slots turn the other way"). A
standing angular ladder — fixed bearings rather than fixed radii — holds a
fading record of which directions were recently swept, lit by a closed-form
"time since this bearing was last crossed" exactly as Circles' own radial
ladder is, generalised for the one place the dual is not exact: a spinning
spoke re-crosses the same bearing every revolution, where a Circles ring
crosses each radius once and stops, so the closed form here has to find the
most recent of several periodic crossings rather than the only one, and a
dead ripple's spoke is frozen at its own moment of death so old wakes stop
recurring. The ladder itself creeps continuously between hits and quantises
to one rung per beat once `uBeatConfidence` is confident, contributing
exactly nothing at `uBeatConfidence == 0` by construction (`mix` returns the
continuous term untouched). Touch spawns its own rosette at the finger and
does not light the (centre-keyed) ladder, one `atan` per live slot.

**Two real bugs, found only by reading pixels back out of a throwaway
harness, not by eye.** `pnpm build`/`tsc` cannot check a fragment shader's
own math, and this file's own live-verification story (below) is why both
were caught before shipping rather than after.

1. *The double stroke was invisible by construction.* The first version put
   both spokes at the *same* bearing, one shorter and thinner "inside" the
   other — a literal reading of "a thinner one inside it at 0.70 of the
   radius" that collapsed the moment it was actually rendered: a shorter,
   narrower ray at the same angle as a longer, broader one is a strict subset
   of it, so the inner spoke could never contribute a visible pixel the outer
   one had not already lit. The fix reread what makes Circles' two rings
   *visible* as two rather than what makes them share a centre: they sit at
   different *radii*. The dual is a second spoke trailing the front one at
   0.70 of the angle swept so far, not a shorter ray alongside it — the same
   "0.70 of the ring's own radius" idea, applied to the thing that is actually
   travelling here (angle, not radius).
2. *Stroke width, first attempt, was unbounded.* Circles' stroke width is a
   fraction of the ring's own current *radius* — a quantity that is bounded
   by construction, since `radius = maxRadius * percent` can never exceed the
   frame's own visible extent. Angle swept since birth (`omega * age`) has no
   such ceiling: a loud, fast-spinning rosette sweeps several multiples of its
   own fold spacing well before its own death, so a width scaled directly
   against that unbounded angle grew wide enough, a couple of seconds into a
   live ripple's own life, to blur every fold into a solid disc — invisible
   at birth (which is when a first check happened to look), glaringly wrong
   two seconds later (which is when a pixel-dump check across a spoke's whole
   life happened to look). The fix scales width by `fold` (the *bounded* size
   of one spoke's own angular slot — the true dual of Circles' bounded
   `maxRadius`) times `percent` (age over lifespan, the same growth curve
   Circles itself uses), which cannot exceed a fixed, small fraction of the
   spacing between spokes regardless of loudness or spin speed.

**Verification, and its real limit.** No mic is reachable from this session's
sandboxed browser profile (same class of gap disclosed for entries 99 and
100), so live audio-driven verification was done by importing `src/scene.ts`
directly through Vite's own dev-mode ES module serving, constructing a real
`Visualiser` with `geometricView: 'rose'`, and driving `render()` with
synthetic transient spikes to spawn real ripples through the app's own
`ripples.ts` state machine — not a hand-rolled substitute for it. Verified
both by eye (screenshots showing a converging N-fold rosette with a bold
leading beam and a thin trailing companion per arm, exactly the double
stroke asked for, plus the standing ladder recording bearings that had been
swept) and quantitatively (`gl.readPixels()` sampled around fixed radii
across a ripple's whole life: coverage grows from a thin hairline near birth
to a bounded, never-solid maximum near death, then fades to zero — the shape
this entry's own Done-when describes, not merely "something nonzero").
`pnpm build`/`pnpm lint` clean; the full probe suite (twenty scripts,
including the pre-existing `probe:ripples`, whose own hardcoded expected
shader count needed bumping from six to seven — the same class of
already-anticipated-but-not-actually-self-healing miss `probe-name-decode.ts`
hit for a hardcoded timing constant in entry 99) passes with zero
regressions. Not verified: a real room, a real phone, and the two things
Done-when itself says can only be judged there — whether the ladder reads as
structure or as a screen door during silence, and frame time with sixteen
fingers down.

**Do** — a seventh geometric view: spokes instead of rings, sweeping in angle
instead of travelling in radius, several at once and turning against each
other. Same monochrome hard-edged stroke vocabulary as Circles, same
event-driven births, an angular ladder in place of the concentric one.

**Why** — asked for: *"geometric lines spinning inspired by the circles but
richer"*. "Inspired by the circles" is taken literally rather than loosely, and
that is what makes the view defensible instead of decorative: there is an exact
sense in which a line is the dual of a ring, and building it that way gives the
new view its own structure rather than a second helping of Circles'.

**Decided**
- **The dual, stated precisely.** A ring is the locus of constant *radius*; a
  spoke is the locus of constant *angle*. Circles' rings are born at the centre
  and travel outward in radius. **Rose's spokes are born at an angle and travel
  in angle** — they sweep. That single substitution generates everything else
  in this entry, and it is why "spinning" and "inspired by Circles" are the
  same requirement rather than two.
- **Therefore the ladder is angular.** Circles' distinguishing feature is its
  wake ladder, and its own header explains why only Circles can have one: the
  emitter never moves, so every ring crosses the same set of radii, and the
  frame between hits becomes a record of the hits. Rose inherits that argument
  rotated: every spoke sweeps through the same set of *bearings*, so the frame
  carries a standing set of fine radial rules at fixed angles, lit as a spoke
  passes and fading afterwards. Between hits the picture says **which
  directions were struck, and how long ago**. Drift, Chorus and Tide could not
  have Circles' ladder; none of the six can have this one.
- **And it stays computed, not accumulated** — the property that lets Circles
  do this in one pass with no history buffer. A spoke at constant angular
  velocity ω born at angle θ₀ has crossed rule φ most recently at
  `mod(θ(t) − φ, 2π) / ω` — closed form, one subtraction and a modulo, exactly
  as Circles' `since = age − LIFESPAN * rungR / maxRadius` is. No ping-pong
  target, no new uniform, no nested loop. If this had needed a history buffer
  it would have been the wrong idea.
- **"Richer" is N-fold symmetry, and it is free.** A hit does not fire one
  spoke, it fires a **rosette** of N equally spaced ones. The cost of that is
  zero per fragment, because N-fold symmetry is `mod(θ, 2π/N)` — a modulo, not
  a loop. This is the whole reason the view can be visually much busier than
  Circles while costing about the same, and it is worth writing down because it
  is the opposite of the usual trade.
- **N comes from `uSeed`, per section, not per hit.** Three, five, six or
  eight-fold, re-rolled with everything else, so a section has *its own
  symmetry* — the same thing `uSeed` already does for Drift's path and Chorus's
  node count. Per-hit N was the other option and it is worse: the symmetry is
  the strongest thing on screen, and changing it every transient reads as the
  picture being rebuilt rather than played.
- **The spin does not decay, and that is what makes it rich.** Each rosette
  turns at a constant rate set by its hit's loudness, and simply fades out on
  the same life as a Circles ring rather than slowing. Constant rates are the
  point: two or three rosettes turning at *different* constant rates precess
  through one another and produce beating and moiré that no single ring system
  can. A decaying spin would give every rosette the same ending and the
  interference would never form. **Odd slots turn the other way**, so
  counter-rotation supplies the strongest beats for free.
- **This is not Shards, and the distinction is worth stating** since the family
  already has an angular member. Shards are fragments *thrown outward*, each
  spinning about itself and slowing — debris. Rose's lines are **anchored at
  the centre** and sweep about it — a radar, a lighthouse, a compass rose.
  Nothing translates; only bearings change.
- **The stroke vocabulary transposes directly.** Circles draws a broad band
  with a thinner one inside it at 0.70 of the radius; Rose draws a broad spoke
  with a thinner, shorter one alongside it. Same idiom, same two constants,
  rotated. Monochrome, hard-edged, no gaussians — the layer's two standing
  rules (`circles.frag.glsl` header) apply unchanged, and colour arrives
  afterwards as the RGB filter it already is.
- **The beat gets the standing drift.** Between hits the whole ladder creeps,
  and when the tracker is confident that creep is quantised — the field
  advances one rung per beat instead of sliding continuously. At
  `uBeatConfidence == 0` the quantised term is exactly 0 and the drift is the
  plain continuous one, so a session with no tempo lock renders identically to
  one where the term does not exist. Same algebraic identity discipline as
  `uDay`, `uSlip` and Circles' own beat ring.
- **Touch spawns a rosette at the finger, and does not light the ladder** —
  Circles' resolution, for Circles' reason: the ladder is a standing structure
  keyed to bearing *from centre*, which an off-centre sweep does not cross in
  any way its arithmetic understands. The touch loop needs its own `atan` per
  live slot, which the existing `age` guard already skips for dead ones, so a
  session that never touches the screen pays one hoisted `atan` and no more.
- **It goes fourth in the registry**, at the end of the three originals and
  before Drift. `views.ts`'s own comment says the first three are the three
  answers to "what does a hit look like" and the last three are the same answer
  from somewhere else. Rose is a **fourth answer**, not a variant, so it joins
  the first group and leaves the variant block intact. Registry order is HUD
  order, and this keeps the HUD's grouping honest.
- **The name is Mine.** *Rose* as in compass rose — the standing bearings and
  the N-fold rosette are the same figure, and the family's labels are all one
  evocative word. *Sweep* was the other candidate and describes the motion but
  not the structure. It is a one-word change if it is wrong.

**Lands in** `src/shaders/rose.frag.glsl` (new); `src/views.ts` — a fourth
entry in `GEOMETRIC_VIEWS`, before `drift`. Nothing else: `prefs.ts`,
`hud.ts`, `scene.ts` and the shuffle all read the registry, so a new key is
picked up by the HUD list, by `?geometric=`, and by the re-roll with no further
change — which is a good check that the registry is doing its job.
**Done when** — a hit fires a turning N-fold rosette whose spokes carry the
double stroke; two overlapping rosettes visibly beat against each other; the
angular ladder holds a fading record of recent bearings and is dark in the
directions nothing has swept; `uSeed` re-rolls the symmetry order; silence
leaves a slowly creeping field rather than a dead frame; and with
`uBeatConfidence` pinned to 0 the frame is identical to the same trace with the
beat term removed from the source.
**Verify** — the same way every other view in this layer was: on the phone,
against a real room, and specifically **during silence**, which is where a
standing angular ladder either reads as structure or as a screen door — the
failure `RUNG`'s comment records for the concentric one. Then frame time on the
phone with sixteen fingers down, which is the only case that pays the `atan`s.
**Hard stops** — prefs **yes, and answered**: `GeometricViewName` gains a
member, which is additive — the stored field is still one string, and
`isGeometricViewName` already rejects unknown values on load, so a phone that
stores `rose` and then loads an older build falls back rather than breaking.
The stored *shape* is untouched · url no, `?geometric=rose` is the existing
parameter with an existing shape · capture no · dependency no — one more
fragment shader, no library.

**Verification note — `/ccc` at build 351.** Registry position, N-fold symmetry by `mod` rather than a loop, per-section `uSeed`, counter-rotating odd slots and the angular ladder are all as specified. One fault, inherited rather than introduced: the ripple strokes summed linearly, which entry 79 had already fixed in Circles, drift and tide before Rose existed — and Rose reaches white faster than any of them, since a hit fires N spokes rather than one ring. Screened at build 351.
### 102. Down is real: emitters fall, and pool where the phone says down is
`status: done` · added 2026-08-30 · build 333 · verified at build 351

**Build note (Mine except `BOUNCE_RESTITUTION`, which is Decided's own
figure).** Shipped exactly where Lands-in says: `vx`/`vy` and the fall/bounce
integration in `src/engine/emitter.ts`; `Visualiser.setGravity()` in
`src/scene.ts`, recorded and never written back, same shape as `setMotion`;
`main.ts` passing `shake.gravity()` into it at both existing `setTumble` call
sites, gated on `prefs.gravity` exactly as Decided requires; five new sections
in `scripts/probe-emitter.ts`. `SPAWN_DIST`'s existing distance trigger now
also fires inside the release branch, which is the whole of "the fall draws
itself, free" — no new spawn rule, the old one just wasn't wired there yet.

`shake.gravity()` (capped, ±0.033/axis) is what's consumed, per Lands-in's own
words, not `shake.tilt()` (raw, uncapped) — despite a comment elsewhere in
this codebase calling `tilt()` what "a grain of powder" would want. Read
Lands-in literally; a grain of powder is not what's falling here.

**A real bug, found only by simulating the numbers rather than trusting the
prose.** First pass picked `GRAVITY_ACCEL_SCALE = 36` (a ~0.9s fall, matching
Decided) and `SETTLE_SPEED = 0.02` (small = "properly stopped", it seemed).
`pnpm probe:emitter` disagreed: with `BOUNCE_RESTITUTION` fixed at Decided's
0.45, decaying below a strict near-zero threshold takes about five hops and
2.3s — past `LIFE_MIN`'s 2s, which Done-when explicitly rules out for the
lightest possible tap. Simulated the bounce ladder directly (a small Node
script, not hand algebra) rather than re-guess: raising `SETTLE_SPEED` to
0.25 settles after exactly two hops, around 1.7s. The bounce height that
speed would have produced, `v²/(2a)`, is about 2% of the frame's half-extent
— sub-pixel on a real screen, so "settled" at that threshold is a real
description, not a euphemism for "gave up checking." `GRAVITY_ACCEL_SCALE`
stays at 36; only `SETTLE_SPEED` moved. Both constants, `BOUNCE_FRICTION`
(0.85, engages only on the tangential component, so it never fires in the
straight-down cases the probe drove) and `TERMINAL_SPEED` (2.0 uv/s) are
unchanged from the first pass and are Mine, chosen against this file's own
afterlife rather than against outside physics — see the comment block above
`updateEmitter`.

**Judgment call, disclosed rather than silently patched.** The live,
on-phone/in-browser half of Verify — "held upright... visibly slides down,
bounces once or twice and settles at the low edge, leaving a trail," and
specifically the flat-on-a-table case — is the one Verify itself says a probe
alone would let you believe. Attempted it anyway, through the same
dev-server-plus-synthetic-frames technique that verified entry 101's shader:
`createVisualiser` on a real canvas, `setTouches`/`setGravity` driven
directly, `gl.readPixels` for the readback. One clean run confirmed the
pipeline responds to a touch at all (localised, non-flat ink where a flat
background would read uniform). Chasing the actual fall/settle trail further
than that hit two `Runtime.evaluate` timeouts in the browser-automation tab
and a readback that came back suspiciously flat once real per-frame delays
were introduced — `render()` turned out to key its internal clock off
`performance.now()` rather than anything passed in, which made a tight
synchronous frame loop read zero elapsed time, and spacing frames out with
real `setTimeout` delays is what then made the harness itself intermittently
hang. Two hung tool calls is this session's own stated threshold for
stepping back rather than continuing to retry. The numeric verification
(`pnpm probe:emitter`, all 22 checks, including the flat/`{0,0}`
byte-identical regression guard) is complete and is Verify's own first-listed
method; the phone-in-hand half is left for Victor, exactly as Verify's
second sentence already assumes a human doing it.

`pnpm build`, `pnpm lint`, and the full `pnpm probe:*` suite (19 scripts) all
pass with no regressions.


**Do** — a released emitter accelerates along the in-plane component of
gravity, bounces off the edge it lands on, and settles there. Held upright it
slides to the bottom; laid flat it stays exactly where it was put. Additive:
charge, drag, fling, afterlife and spawn-on-distance all keep working as they
do today.

**Why** — asked for. And the framework question came with it — *"need to
intelligently layer these in code, do we have a good framework?"* — which is
answered first, because the answer determined the design.

**Decided**
- **Yes, and this is the test case that shows it.** The project has two
  patterns and this uses one of them cleanly. The first is **pure-state
  modules**: `shake.ts`, `ripples.ts`, `emitter.ts`, `touches.ts`,
  `motion-bias.ts`, `rgb-slip.ts` — state plus a pure update function, no DOM
  and no clock of their own, everything arriving as `now`/`dt`, each probeable
  headless. The second is **render-time influence**: a value modulated where it
  reaches the renderer and never written back to stored prefs (entries 48, 58,
  60, 72, 87). Gravity is squarely the first: the emitter already *has* a
  position, that position is already advanced every frame by a pure function,
  and gravity is one more term in that integration. **No new module, no new
  uniform, no shader change, no new dependency.** That an addition needs none
  of those is exactly how you can tell it fits the framework rather than
  fighting it — and it is worth saying that the honest answer would have been
  different if this had needed rings already drawn to move, which is the next
  bullet.
- **Emitters fall; rings do not.** The request says *emitters*, and taking it
  literally is also what keeps the cost at zero. A ring is drawn in closed form
  from its birth time and a fixed origin — that is the property that lets this
  layer run in one pass with no history buffer, and moving a ring after birth
  would break it for every view at once. A falling *emitter* spawns each new
  ring from wherever it has fallen to, so the rings stay closed-form and the
  motion is visible anyway, as a stream of rings descending. Nothing about
  Circles' concentric audio rings or its centre-keyed wake ladder is touched;
  gravity reaches only the touch-placed emitter, which is the thing that has a
  position to lose.
- **The fall draws itself, free.** `SPAWN_DIST` already fires a ring for every
  0.05 uv of *movement*, which is how a drag draws a continuous line rather
  than a dotted one. A falling emitter is moving, so it spawns on the way down
  with no new rule at all — the trail is a consequence of a constant that is
  already there, not a feature added beside it. This is the single strongest
  argument that the fall belongs in `emitter.ts` and nowhere else.
- **Horizontal and vertical need no mode and no branch.** The velocity gains
  `g` = the **in-plane projection** of the device's gravity vector, which
  `shake.ts` already computes and already exposes. Phone upright: that
  projection is the full vector and things fall. Phone flat on a table: the
  vector points into the screen, its in-plane length is zero, and the emitter
  stays exactly where it was put — not by a rule saying so, but because there
  is nothing pulling it. Every angle between behaves correctly for free, and a
  phone tilted in the hand slides *diagonally*, which no two-mode design would
  have produced. **A mode flag here would be strictly worse than the physics.**
- **It bounces off whichever edge is down, not off the bottom of the frame.**
  Same reasoning: reflect the velocity component normal to the edge the
  emitter reaches. Hold the phone in landscape and things pool along the true
  bottom, which is what "gravity" has to mean or it is only a downward
  animation. Restitution **0.45** and a small per-bounce loss, so it lands,
  hops once or twice visibly, and settles rather than jittering forever.
  **Mine**, as are all three numbers below.
- **The numbers, chosen against the afterlife that already exists** rather than
  by changing it: acceleration such that a drop from mid-frame reaches the
  edge in about **0.9 s**, so a released emitter falls, bounces and settles
  well inside `LIFE_MIN`'s 2 s — nobody has to hold anything for the behaviour
  to be seen, and "eventually ending up at bottom" happens within one gesture.
  A terminal-velocity clamp so a long fall does not outrun `SPAWN_DIST` and
  leave gaps in its own trail.
- **It rides the existing `grav` chip**, not a new one. There is already a
  `prefs.gravity` boolean and an outer-ring chip for it, currently meaning "the
  picture hangs toward down". That is the *same idea* — the app knowing which
  way down is — and two separate gravity switches on one menu is precisely how
  a control surface becomes unlearnable. One chip, one concept. **Mine.**
- **And the trap, stated because this project has been bitten by exactly this
  five times running: `prefs.gravity` defaults to `false`, and a phone that has
  already stored `false` will keep it.** Flipping the default therefore does
  *not* reach an existing install, so this entry does not flip it — it requires
  instead that the `grav` chip's own state be legible at a glance and that the
  Verify step below be done with it **on**. A feature that lands behind an
  off-by-default switch, unverified, is a feature that has not landed.
- **Reads, never writes.** `shake.ts`'s gravity vector is consumed here and
  nothing is fed back — the frozen RGB slip (entry 76) and the approved colour
  bias (entry 70) both ride `disturb` from the same sensor and are untouched.
  Same constraint as entries 88 and 90, same reason.

**Lands in** `src/engine/emitter.ts` — velocity, the gravity term, the bounce;
`src/main.ts` — passes `shake.gravity()` into the emitter update, gated on
`prefs.gravity` exactly as `setTumble` already is at `:831` and `:1537`;
`scripts/probe-emitter.ts` (new, or the existing probe extended).
**Done when** — with `grav` on and the phone upright, a released emitter
visibly slides down, bounces once or twice and settles at the low edge, leaving
a trail of rings as it goes; with the phone flat it does not move at all; held
in landscape it pools along the true bottom rather than the frame's; a tilted
phone slides diagonally; and with `grav` **off** every gesture behaves exactly
as it does today, byte-identical on a recorded trace.
**Verify** — the probe for the fall, the bounce and the settle, which are all
synthesisable from a gravity vector and a `dt`. Then the phone, held upright,
**with the chip on** — and specifically the flat-on-a-table case, which is the
one that must do nothing and is the one a probe alone would let you believe.
**Hard stops** — prefs no (the existing `gravity` boolean gains a second
consumer; its type, meaning and default are unchanged) · url no · capture no ·
dependency no.

### 103. A tap plays. Only the camera takes photos.
`status: done` · added 2026-08-30 · fixes what makes 87 invisible · build 335 · verified at build 351

**Build note (Mine).** Shipped exactly where Lands-in says, inside
`src/main.ts:1215-1290`: the tap resolver collapses from a list of pending
saves, each holding its own `setTimeout`, to a single remembered tap —
position, down-time, and the `pointerId` that lets a later drag or cancel on
*that same contact* forget it before it can pair with something unrelated.
There is no timer left anywhere in this machinery: with no save left to
schedule, there is nothing to commit once a tap's window closes, so a lone
tap now does precisely nothing beyond being remembered for a moment in case
a second one arrives to pair with. `resolveTapDown`/`cancelPendingTap` keep
their names since they still do what those names say; `PendingTap` becomes
`LastTap`; `SAVE_RATE_LIMIT_MS` and `TAP_RESOLVE_MS`'s old save-side comments
are gone, `CAMERA_SAVE_RATE_LIMIT_MS` and the emitter's raw-`down` dispatch
are untouched, exactly as Decided requires.

`saveCapture()` now has exactly one call site in the entire file — inside
`cameraMode`'s own branch — which is the structural version of "tapping the
picture ... writes nothing to the camera roll, however many times it is
tapped": there is no longer a code path from an ordinary tap to a write at
all, not merely a rate limit or a delay standing in front of one.

Rewrote `scripts/probe-tap.ts` to mirror the new resolver rather than patch
around the old one — the old file's `tick()`/`saved()` machinery tested a
timer that no longer exists. New checks assert the shape Decided actually
asks for: ten independent, unpaired taps open the panel zero times (the
direct translation of "ten rapid taps ... produce zero files" into the
resolver's own vocabulary, since this file has never touched saving
directly — only pairing); a second tap outside the radius or window
*replaces* what's remembered rather than the old list's two coexisting
entries, which is entry 103's own explicit simplification ("one remembered
tap ... instead of a list"); and the drag/cancel and two-finger-open guards
against a stale tap pairing later carry over unchanged in spirit.

**Not independently verified: the phone/camera-roll half of Verify**
("tapping the picture a dozen times and then opening the camera roll," and
the armed path twice in a row). This entry is deletion-heavy rather than
new-math-heavy — the strongest available guarantee is the call-site count
above plus the full probe suite — and the previous entry's live-verification
attempt through the same dev-server-plus-synthetic-frames technique cost two
hung browser-automation calls for comparatively little additional
confidence on a change this structurally simple. Left for Victor, exactly as
Verify's own phrasing ("on the phone") already assumes a human doing it.

`pnpm build`, `pnpm lint`, and the full `pnpm probe:*` suite (19 scripts,
including the rewritten `probe:tap`) all pass with no regressions.


**Do** — stop the single tap from saving a screenshot. Camera mode becomes the
only path to a photo, which is what makes the mode entry 87 already built
observable for the first time.

**Why** — two reports in one message, and they turn out to be one fault:
*"when a touch becomes an emitter it shouldn't take a photo"*, and *"where is
the two shot camera, it hasn't landed as far as I can see"*.

**Decided**
- **Entry 87 did land, at build 273. It is invisible because entry 52 makes it
  a no-op.** `resolveTapDown` (`main.ts:1248-1271`) starts a 400 ms timer on
  every tap on the picture, and if no second tap arrives that timer calls
  `saveCapture`. So an ordinary tap already writes a PNG. Arming camera mode
  changes that tap from *saves in 400 ms* to *saves immediately* — and adds a
  glyph. **There is no observable difference to find, because the thing the
  mode enables was never disabled.** This is why looking for the two-shot
  camera and concluding it was not built is the correct inference from what the
  app actually does.
- **So the fix for the second complaint is the first complaint.** A tap should
  play and only play — that is entry 50's whole finding, and entry 52's
  tap-to-save predates it. Remove the save from the single tap and both
  reports close at once: touching the picture stops producing photographs, and
  camera mode becomes the only shutter, which is exactly the mode that was
  asked for and built.
- **What this deletes, and it is a lot.** With no pending single to commit,
  `pendingTaps` has no reason to exist: the list, the per-contact timers,
  `cancelPendingTap`, the drag-cancels-the-save rule and `SAVE_RATE_LIMIT_MS`
  all existed solely to serve tap-to-save. The double tap keeps its 400 ms
  window and 30 px radius but needs only **one remembered tap** — position and
  time — instead of a list. `CAMERA_SAVE_RATE_LIMIT_MS` stays: two deliberate
  shutter presses in 300 ms should still not write the same frame twice.
- **The emitter is untouched and must stay untouched.** It fires on the raw
  `down`, immediately, never waiting on or cancelled by tap resolution —
  `main.ts:1190-1192` says so explicitly and it is still right. Nothing in this
  entry is allowed to put anything back in front of it.
- **The cost, stated honestly.** A photo goes from one tap to two (arm the
  chip, then tap). That is the trade the request names, and it is the right one
  in both directions: photographs stop being an accident of playing, and the
  deliberate path is the one that got designed. The `shutter` chip stays where
  entry 77 put it, on the outer ring — Victor's own rule is that the inner ring
  is layer controls only, and this entry does not get to relitigate it.
- **The glyph has to actually be visible**, since it is now the *only* signal
  that the next tap does something irreversible. That was true before and did
  not matter; it matters now. Verified on the phone, in daylight, not in a
  desktop browser.
- **Not decided here** → whether a photo should be reachable in one gesture by
  some other route (a long press, a two-finger tap). Entry 87 settled the
  camera's shape and this entry only removes its competitor; a new gesture is a
  new entry and would have to argue against entry 50's "a tap plays".

**Lands in** `src/main.ts:1215-1290` — the pending-tap machinery collapses to a
single remembered tap; `:1245-1283` deleted; `SAVE_RATE_LIMIT_MS` removed.
Nothing in `hud.ts`, `emitter.ts` or any shader.
**Done when** — tapping the picture spawns rings and writes nothing to the
camera roll, however many times it is tapped; a double tap still opens the
panel with the same feel; the `shutter` chip arms, the glyph appears, the next
tap on the picture writes exactly one PNG and disarms; the 10 s quiet timeout
still disarms; and ten rapid taps outside camera mode produce zero files.
**Verify** — on the phone, by tapping the picture a dozen times and then
opening the camera roll, which is the only place the old behaviour was ever
visible. Then the armed path, twice in a row, to confirm arming is not sticky.
**Hard stops** — prefs no · url no · capture **yes, and this is the entry that
narrows it**: strictly fewer images are written and never without an explicit
arming gesture, so the change moves capture in the conservative direction only ·
dependency no.
