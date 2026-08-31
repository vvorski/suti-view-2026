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

### 95. A layer at zero opacity leaves the room alone
`status: done` · added 2026-08-30 · build 317 · verified at build 352

**Build note (Mine).** Applied exactly the fix Decided specified —
`composite.frag.glsl`'s camera-mix block now reads
`float picture = max(uGeoAlpha, uAtmAlpha)` and mixes across
`blendWith(cam, col, uAtmMode)`'s result rather than feeding it a `col` that
could be black-because-absent, the same shape entry 34 already used one seam
up. No design decisions of my own here beyond the one Decided already made
(`max`, not a sum or product) — this entry's own numeric table was already
exact, so the job was transcription plus verification, not invention.

`probe-composite.ts` gained a new section 14, mirroring entry 34's own
probe shape one seam over: a two-mode regression fixture reproducing the
old formula wiping Normal and Multiply to black at both alphas 0; a
six-mode check that the fixed formula leaves the room untouched at both
alphas 0 under every mode; a six-mode check that `picture == 1` is
bit-identical to the pre-fix formula, matching Done-when's own "the picture
composites over the room exactly as it does today"; and one check that
`uCameraMix == 0` still leaves `col` untouched regardless of the alphas,
protecting the "costs nothing while down" guarantee the file's own
surrounding comment already claims.

**Verification.** `pnpm build` and `pnpm lint` clean. `pnpm probe:composite`
— 44/44 checks pass, 12 new for this entry. The three CI-required probes
(`pnpm probe`, `probe:shake`, `probe:fullscreen`) pass unchanged, as
expected — this entry touches neither of the files they exercise. No
on-screen phone verification: this entry lands entirely in shader
arithmetic and its own probe, touches no HUD or gate surface, and its own
Verify line says as much — "the probe carries this entirely."

**Do** — mix the camera blend across its *result* by how much picture there
actually is, so a picture turned off cannot govern the room through its blend
mode.

**Why** — reported: with the layer off, its blend mode still modifies the
camera. Correct, and it is entry 34's bug at the seam entry 34 did not reach.

**Decided**
- **Reproduced, numerically.** With `uGeoAlpha` and `uAtmAlpha` both 0, the
  composite line yields `col = 0`, and `blendWith(cam, 0, uAtmMode)` at
  `uCameraMix = 1` turns a room pixel of **0.620** into:

  | mode | out |
  |---|---|
  | normal | **0.000** |
  | add | 0.620 |
  | screen | 0.620 |
  | multiply | **0.000** |
  | overlay | **0.240** |
  | difference | 0.620 |

  **The same three modes entry 34 caught**, for the same reason, one seam
  further down: a layer at zero opacity does not disappear, it hands the blend
  a black input and the blend still fully governs the frame. Under Normal and
  Multiply the camera goes black — the room is *wiped by a layer that is
  switched off*.
- **The fix is entry 34's fix, applied to the second pair.** That entry's own
  words: keep the input undimmed going into the blend and *"mix `uAtmAlpha`
  across the blend's **result** — between the geometry alone and the full
  blend"*. Here the equivalent is between **the room alone** and the full
  blend:

  ```glsl
  float picture = max(uGeoAlpha, uAtmAlpha);   // is there a picture at all
  vec3 lit = mix(cam, blendWith(cam, col, uAtmMode), picture);
  col = mix(col, lit, uCameraMix);
  ```
  At `picture == 1` this is exactly today's line, so nothing about any
  existing composition changes. At `picture == 0` the room passes through
  untouched under every mode, which is what "off" has to mean.
- **`max`, not a sum or a product**, and this is the one judgement in the
  entry: the picture is present if *either* layer is on. Multiplying would make
  turning one layer off dim the other's relationship with the room, and adding
  would exceed 1 with both layers up. **Mine.**
- **Presence is the alphas, never the luminance.** A genuinely black picture
  and an absent picture look identical in `col` and must not be treated
  identically — a dark frame is a picture and Normal is entitled to replace the
  room with it. Only the alphas know the difference, which is exactly why the
  fix reads them rather than testing `col`.
- **This is a third instance of one shape**, and it is worth naming as a rule
  rather than fixing a third time later: **wherever a layer's presence is
  applied by multiplying its colour before a blend, it is wrong**; presence
  belongs in a `mix` across the blend's output. Entry 34 fixed geo-over-atm,
  this fixes picture-over-camera, and any future layer must arrive built this
  way.
- **`probe-composite.ts` should assert it for both seams**, since it already
  exists for exactly this class and its whole reason for being is that "the
  browser cannot tell 0.51 from 0.46". It currently covers the layer pair only.
  The new case is: at every mode, both alphas 0, the camera output equals the
  camera input — the table above, expected all-passthrough.

**Lands in**
- `src/shaders/composite.frag.glsl:240-245`.
- `scripts/probe-composite.ts` — the camera seam, all six modes.

**Done when** — with both layer opacities at zero and the camera up, the room
is untouched under all six modes; with either layer up, the picture composites
over the room exactly as it does today; and the probe fails if the old form is
restored.
**Verify** — the probe carries this entirely: it is arithmetic, the same
arithmetic entry 34's probe already models, and the numbers above are the
expected-failure baseline to check against.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 96. The moon works the shapes, as the sun works the colour
`status: done` · added 2026-08-30 · build 319 · the expansion-curve envelope is deliberately incomplete — see build note · verified at build 352

**Build note (Mine).** Shipped: `src/moon.ts` (pure, `moonFor(date)` →
`{illuminated, waxing, presence}`), sampled once a second in `scene.ts`
alongside `skyFor` (literally the same `new Date()` call, one clock read
serving both); abundance (`illuminated × presence`) driving a reach
multiplier and a lifespan multiplier on every ripple-drawing geometric
shader (circles, drift, chorus, grid, tide, shards — `field.frag.glsl`
doesn't draw ripples at all and was correctly left alone); the same
abundance driving `engine/emitter.ts`'s `SPAWN_INTERVAL` cadence and its
`LIFE_MIN`/`LIFE_MAX` afterlife baseline; a `moon` line in the numeric
readout beside the `sky` one, reporting illuminated fraction, presence and
the derived abundance directly.

**Deliberately not shipped: the waxing/waning expansion-curve bias on ring
growth shape** — the third of Decided's three "shape qualities". Reading the
six ripple-drawing shaders before touching any of them turned up an actual
conflict: `circles.frag.glsl` has an explicit, reasoned comment committing
to *linear* growth — "Ease-out was an embellishment added here and it
fights the proportional stroke: easing puts nearly all the growth in the
first instant, so the ring arrives already thick and then only fades.
Growing at a constant rate is what lets the band visibly thicken as it
travels, which is the movement the original has." `drift.frag.glsl` carries
the identical commitment ("linear, as Circles: the band thickens as it
travels"). `grid.frag.glsl` and `shards.frag.glsl` already have their own,
different baked-in ease-out curves for reasons of their own. Biasing an
exponent on top of any of these would either fight a documented design
decision this project's own house style says to preserve, not silently
override, or double-curve an already-curved view unpredictably. CLAUDE.md's
own words: "Comments carry the reasoning... Preserve them." I chose not to
force a shared mechanism through four shaders with four different, already-
considered opinions about their own growth shape, rather than pick winners
among them without being asked to. `waxing` is still computed, returned and
reported in the readout — the data layer for this is complete; only the
shader-side wiring is deferred. Worth its own follow-up entry rather than a
quiet gap: docs/todo.md now has nowhere else this is written down, so it's
written here.

Two smaller judgement calls, both **Mine**: reach and life share one swing
constant each (0.25) rather than being tuned independently — Decided names
them together throughout ("roughly ±25% on reach and life"), so nothing in
the entry asked for them to diverge. And `moonAbundanceFor` (the
`illuminated × presence` product) is computed once per rendered frame from
the once-a-second sample, not recomputed per emitter slot — it only changes
on that same one-second cadence regardless.

**Verification.** `pnpm build` and `pnpm lint` clean. `pnpm probe:moon` (new)
— 30/30 checks: the four named phases land exactly right in both
illuminated fraction and the signed waxing term; illuminated rises and
falls monotonically across a full synodic month; presence's one daily peak
lands within 2 hours of Decided's own new-moon-noon/full-moon-midnight
claim and returns near the horizon twelve hours later; presence never
leaves [0,1]; and the identity claim — new moon or moon-down leaves
reach/life/cadence at (or extremely near) their unmodulated values, while a
full moon at its own transit pushes all three within the stated swings.
`pnpm probe:emitter` and `pnpm probe:ripples` both pass unchanged — the new
`moonAbundance` parameter is trailing and defaults to 0, so every existing
call site is untouched and every existing assertion about MAX_RIPPLES/
AUDIO_RIPPLES across all six shaders still holds. `pnpm probe:slow`,
`probe:posture` and `probe:sky` also unaffected, as expected — this entry
never touches colour, the director, or the sky. The three CI-required
probes (`pnpm probe`, `probe:shake`, `probe:fullscreen`) pass unchanged.
**Not verified live on the phone**: the entry's own Verify line asks for
"two nights far apart in the cycle", which no single session can produce;
the astronomy and the identity claim are covered by `probe-moon.ts` instead,
which is what the entry's own Verify line credits as protecting everything
already shipped. The readout line itself is also unconfirmed on a running
build — main.ts only calls `visualiser.stats()` after Start, which needs
microphone access this environment refuses (the same limitation noted in
several earlier build notes this session).

**Do** — add a lunar cycle, perpendicular to the sky's solar one: it touches
the emitter and ring *shape* parameters that nothing else modulates, driven by
the moon's phase, its waxing or waning, and its rough presence in the sky.
Subtle within a night; different from one night to the next.

**Why** — Victor, and the intent is the point: bring kiyo into contact with the
natural environment. The sun cycle (entries 47, 53, 71) already makes the
colour answer the time of day. The moon should make the *form* answer the month
— a second natural clock, felt in the shapes rather than the palette, so the
toy is quietly not the same object on a full-moon night that it is on a new one.

**Decided**
- **Perpendicular, and that word is a constraint, not a mood.** The sun cycle
  owns colour and only colour — `uDay`, `uSky`, the ink, the warmth. The moon
  owns shape and only shape — how far a ring reaches, how long it lives, how
  often one is born, how it grows across its life. **Neither ever touches the
  other's axis.** A full moon at noon and a full moon at midnight differ in
  form but not hue; a sunset and a sunrise differ in hue but not form. That
  clean separation is what makes two natural clocks legible instead of muddy.
- **Three lunar facts → three shape qualities**, one each, because the moon
  gives exactly three things a phone can honestly know:
  - **Illuminated fraction → abundance.** New moon: the shapes are spare, brief,
    sparse — the toy at its most minimal. Full moon: generous — rings reach
    further, live longer, come more often. The moon lends the toy its light.
  - **Waxing vs waning → the growth envelope of a ring.** Waxing: rings *bloom*,
    accelerating outward, opening. Waning: rings *recede*, easing and drawing
    in. This is the subtle directional energy — it distinguishes a first-quarter
    night from a last-quarter one even though both are half-lit, which nothing
    else could.
  - **Presence (rough altitude) → strength.** When the moon is below the
    horizon its whole influence fades to zero and the shapes return to their
    plain baseline; near its high point the influence is full. The toy only
    feels the moon when the moon is actually up.
- **Magnitude is `illuminated × presence`**, so **new moon, or moon down, is
  exactly today's constants** — the algebraic-identity discipline entries 47,
  75 and 76 all use. Nothing about the shapes changes until there is a lit moon
  in the sky, and the waxing/waning envelope is the only signed term.
- **Honesty about position, because this is where the app's one promise could
  break.** Illuminated fraction and waxing/waning are **pure date arithmetic —
  no location needed**, exact from the clock alone (age within the 29.53-day
  synodic month from a known new-moon epoch; verified against phase). Altitude
  is the hard part: a true altitude needs latitude, and **asking for it is
  forbidden** — `sky.ts`'s header already refuses geolocation for exactly this,
  *"disproportionate for a lighting effect, and the wrong kind of ask here
  regardless."* So presence is a **stylised, location-free proxy**: the moon
  transits (sits highest) at a time set by its phase — new near local noon,
  full near local midnight, quarters near sunset and sunrise — and presence is
  `cos` of the clock's hour-angle from that transit, clamped at the horizon.
  It ignores latitude, so it is wrong about *how* high and wrong at extreme
  latitudes and says nothing about a moon that never rises — the same trade
  `sky.ts` makes for the sun and states in the same spirit. **This is written
  loudly so no future session "fixes" it with a location prompt; that would not
  be an improvement, it would be breaking the promise the gate makes.**
- **A new pure module, `src/moon.ts`** — `moonFor(date): { illuminated,
  waxing, presence }`, pure state and a pure function, no DOM, no clock of its
  own, sampled once a second in `scene.ts` exactly as `skyFor` is (`SKY_SAMPLE_S`
  is the precedent). Scrubbable through a synodic month in a probe with no
  browser and no network, like `probe-sky.ts`.
- **Which parameters, and the "nothing else touches" claim made precise.**
  Confirmed against `emitter.ts`: `CHARGE_TIME`, `CHARGE_FLOOR`, `LIFE_*` and
  `SPEED_LEVEL_SCALE` are all touch-derived and **off limits**. The moon takes
  the ones that are plain constants: **`SPAWN_INTERVAL`** (abundance — cadence),
  the ripple's **reach** (`maxRadius`) and **lifespan** (abundance — how far and
  how long a ring lives), and the ring's **expansion curve** (the waxing/waning
  envelope — `ripples.ts` / the shaders' growth term). Where a quantity the moon
  wants is *also* touch-shaped — emitter `life` — the moon scales the
  **baseline** (`LIFE_MIN`/`LIFE_MAX` endpoints) and touch still picks within
  it, so they **compose** (moon sets the range, the gesture chooses inside it)
  and never overwrite each other. The build agent must confirm each target is
  genuinely un-modulated before wiring it, and route anything shared through the
  baseline the way `life` is.
- **Affects audio rings and touch rings alike, on purpose.** Ring reach and
  lifespan are shared by both (`ripples.ts`: `AUDIO_RIPPLES` + touch), so the
  moon shifts the whole toy's shape-language, not just the finger's. That is
  more in the spirit than isolating touch — the month is a property of the
  place, not of who is touching. It must not disturb entry 59's hand-synced
  `MAX_RIPPLES`/`AUDIO_RIPPLES` *counts* (those are structure); it moves the
  geometry those slots draw, carried as uniforms.
- **Subtle within a night, distinct across nights.** The moon moves ~12°/day,
  so nothing visibly changes in a session — correct. The swings are moderate:
  roughly **±35% on cadence, ±25% on reach and life** at full influence, and a
  gentle expansion-curve bias for waxing/waning. Enough that a full-moon night
  and a new-moon night are recognisably different toys to someone who knows it
  well; never enough to read as a glitch to someone who does not. **Mine** as to
  the percentages; the probe and a few real nights settle them.
- **Report it in the readout.** Phase, illuminated fraction and presence beside
  the sky line — both because five-plus new state changing the shapes silently
  is the exact diagnosis trap this project keeps relearning (entries 66, 88),
  and because it lets Victor see *what night the app thinks it is* without
  waiting a month to check the math.
- **Deliberately its own entry, noted so it is not lost: the tide.** The moon
  moving the powder (entry 46) like a tide — a slow directional pull on the
  grains, strongest at full and new, that nothing else exerts — is the most
  literal possible version of "the moon in contact with the material," and it
  is too large and too good to fold in here. `moon.ts` is written general so
  that entry can read the same field. **Not built here.**

**Lands in**
- `src/moon.ts` — new, pure.
- `src/scene.ts` — sample `moonFor` beside `skyFor`; feed the influence into the
  ripple/emitter shape uniforms and the `SPAWN_INTERVAL`/life baselines.
- `src/engine/emitter.ts`, `src/engine/ripples.ts` — read the moon baseline
  rather than the bare constant, at the seam touch already composes with.
- `src/hud.ts` — the readout line.
- `scripts/probe-moon.ts` — new; `scripts/probe-shake.ts`-style scrub.

**Done when** — scrubbing a synodic month shows illuminated fraction and
waxing/waning tracking the real phase, and presence rising and falling with the
clock hour in the phase-appropriate window; at new moon **or** moon-down every
shape parameter equals today's constant to the digit; a full moon high in the
sky visibly lengthens ring reach, life and cadence within the stated swings; no
`disturb`, colour, or sun value changes anywhere; and entry 59's ripple counts
are untouched.
**Verify** — `probe-moon.ts` for the astronomy and the identity-at-new-moon
claim, which is the one that protects everything already shipped. Then the
phone, on two nights far apart in the cycle — the only test of whether "subtle
but different" is actually both.
**Hard stops** — prefs no · url no · capture no · dependency **no — the moon is
a dozen lines of date arithmetic; no ephemeris library, and above all no
geolocation**, which is the whole reason presence is a proxy rather than a
computation.

**Verification note — `/ccc` at build 352.** Abundance reaches all seven ripple shaders as `uMoonReach`/`uMoonLife` and the touch emitter as a cadence and afterlife swing, zero at new moon and with the moon down, so the identity is real. The disclosed omission — the waxing/waning envelope — now exists as entry 106 and shipped at build 341, which closes this entry's partial ship properly rather than leaving it a build note.
### 97. Where you actually are: real sun, real moon, from a location that never leaves
`status: done` · added 2026-08-30 · build 321 · gate copy and stored location deliberately not shipped — see build note · verified at build 352

**Build note (Mine).** Shipped: `src/geo-location.ts` (new — `requestLocation()`,
shaped like `requestMotionAccess()`: asked at most once, coarsened to ~0.1°
the instant a fix arrives, cached only in memory, resolves `null` rather than
throwing on refusal/timeout/an absent API); real solar altitude in `src/sky.ts`
(`solarAltitudeDeg`, the NOAA algorithm, plus `skyForLocation` mapping altitude
to the same `{daylight, warmth}` shape `skyFor` returns); real lunar altitude
and phase in `src/moon.ts` (`moonAltitudeDeg`, `moonForLocation`, Meeus's
low-precision series); `scene.ts` kicks off `requestLocation()` once, lazily,
right where `skyForNow`/`moonForNow` are already read at construction — not
gated behind Start (Decided is explicit: "never bundled into the Start
gesture") and not behind a new HUD chip either, since `getCurrentPosition`
needs no live gesture to ask for, so there was no tap this could usefully
wait for instead. Once a coordinate resolves, the once-a-second sample in
`scene.ts` switches both curves over; refused or pending, both fall back to
exactly today's clock-only behaviour, unchanged. A `located` flag rides the
`sky` stats field and prints on the `hud.ts` readout line (`located` /
`stylised`) so which path is live is checkable without a location to test
with.

**The two curves' precision is not the same, and that is disclosed rather
than glossed over.** `solarAltitudeDeg` is the full NOAA solar position
algorithm, the same one behind NOAA's own published sunrise/sunset
calculator — no truncation, and `probe-sky.ts`'s new section 7 checks it
against identities that need no live almanac: near-overhead readings at
each solstice's own tropic and at an equinox's equator (obliquity of the
ecliptic is a physical constant, not a fact this app had to look up), and a
15°-longitude/1-hour-of-time invariant that needs no ephemeris at all. All
pass within a few degrees. `moonAltitudeDeg`, by contrast, ships only the
*leading* terms of Meeus's low-precision lunar series — the entry's own
"~60 lines" describes a fuller truncation than what's here, and I could not
verify additional coefficients against a live reference from this
environment, so I kept only the dominant equation-of-center term
(6.289°·sin(M), the theory's largest single term, roughly 5× the next one)
plus the next nine down to 0.031° for longitude, and the dominant term plus
three more for latitude. Calibrated the only way available without network
access: `moon.ts`'s own `KNOWN_NEW_MOON_MS` epoch is asserted by its own
existing header comment to be a real new moon — at that exact instant, a
real moon sits close enough to the real sun in the sky that the two bodies'
*altitudes*, from any location, should read close together, and they do
(within ~1.3° across four widely separated cities, `probe-moon.ts` section 6)
— an identity that would fail hard on a transcription bug in either the
orbital elements or the RA/Dec/GMST conversion, and didn't. Illuminated
fraction and waxing at the quarter-month marks land within a few percent of
the exact values too. This is a real computation, genuinely more correct
than the synodic-clock proxy at every latitude the way Decided asks for —
it is just not the full higher-order series, and a future session with a
live ephemeris to check against could extend the term tables without
touching anything else here.

**Deliberately not shipped: the gate's promise gaining a location clause**,
which Decided asks for directly ("say so where the app makes the promise").
`CLAUDE.md`'s own Hard Stop 3 is unambiguous and specific to exactly this:
*"The gate deliberately carries no copy about this, as of build 66... Do not
re-add the text as a bug fix — it is absent on purpose."* That instruction
predates this entry, is a standing project decision (docs/todo.md entry 2),
and is not about audio specifically — it is about the gate carrying no
capture/privacy copy at all, full stop, because Victor removed it and said
so explicitly. Entry 97's own Why quotes Victor approving *geolocation
itself* ("why no geolocation? we want to be present, need it for sun too.")
— that quote does not address the gate-copy question, which CLAUDE.md
answers on its own with no ambiguity. I read the newer, narrower instruction
(add a clause) as losing to the older, louder, still-standing one (carry
none), the same "preserve documented reasoning over a newer instruction that
conflicts with it" call entry 96 made about the shader comments. `index.html`
is untouched. The quoted Victor approval is what let me proceed with the
*permission prompt itself* — CLAUDE.md's Hard Stop 3 also literally covers
"adds a permission prompt," which geolocation is, and entry 97's own
Hard-stops checklist mislabels this "capture no" — but a prompt and its gate
copy are two different asks, and only the first had anything resembling
sign-off in the entry's own text.

**Deliberately not shipped: a stored location in `prefs.ts`.** Decided
frames this as conditional — "persisted only if a re-ask is not cheaper" —
and it is: once a browser origin has granted geolocation, later calls to
`getCurrentPosition()` do not re-prompt, so persisting a coarse coordinate
across sessions would buy nothing a fresh, silent re-ask doesn't already
give for free, at the cost of a `localStorage` write for a sensor most
visitors will refuse anyway. `prefs.ts` is untouched — confirmed with `git
diff --stat -- src/prefs.ts` before this commit. The location does live in
one place for the session: an in-memory variable in `geo-location.ts`,
never written anywhere else, never serialised.

**Confirmed, not just written down**: no `fetch`/`XMLHttpRequest`/`WebSocket`
call anywhere touches `geo-location.ts`, `sky.ts`, `moon.ts`, or `scene.ts`
(grepped before this commit), and neither `latitude` nor `longitude` appears
in `prefs.ts` or `main.ts`. The coordinate is read, coarsened, held in
memory, used for two trigonometric functions, and nowhere else.

**One small collateral change, disclosed rather than silent**: `moon.ts` now
imports from `sky.ts` (for the sun's ecliptic longitude, needed to compute
lunar elongation without a second, independently-transcribed copy of solar
orbital mechanics) — this is a real value import, not the type-only kind
`sky.ts` already had on `geo-location.ts`, and plain Node's ESM resolver
cannot follow either project's extensionless `./sky` the way Vite does.
`probe:sky` and `probe:moon` in `package.json` now run through
`scripts/dir-import-hook.mjs` (already written for `probe:fullscreen`,
entry 66, for exactly this class of problem) rather than bare `node
--experimental-strip-types`. No behaviour changed; only how the probes
themselves resolve an import that already existed for Vite.

**Not verified live** — no location to test against and no phone in this
environment, per the entry's own Verify, which explicitly wants "the phone,
at a known location at sunset." `pnpm build`, `pnpm lint`, `pnpm probe:sky`
(34 checks), `pnpm probe:moon` (43 checks), and the full remaining probe
suite (17 scripts) all pass; the `sunGeometry` refactor inside `sky.ts`
(factored out so `moon.ts` could reuse the sun's ecliptic longitude) is a
pure internal restructuring with no behaviour change, confirmed by
`probe-sky.ts`'s original 20 entry-53/71 checks still passing bit-for-bit
afterward.

**Do** — ask for location once, use it locally to compute the true position of
the sun and the moon, and feed those into the colour cycle (sun) and the shape
cycle (moon, entry 96). The coordinates are used on the device and transmitted
nowhere.

**Why** — Victor: *"why no geolocation? we want to be present, need it for sun
too."* Correct, and it overturns a refusal I wrote twice on a false premise.

**Decided**
- **The premise I got wrong, stated plainly so the reversal is on the record.**
  `sky.ts:7` refuses geolocation because the page's *"one promise is that
  nothing leaves the device."* That conflated two different things:
  **asking for location** and **location leaving the device**. Geolocation
  hands coordinates to the page's own JavaScript; sun and moon altitude are
  pure local trigonometry from lat/long and time. **The coordinates never need
  to be sent anywhere, and here they never are.** The promise is not "we do not
  sense where we are" — it is "what we sense stays here" — and real astronomy
  keeps it exactly. The only true cost was ever the permission prompt, and
  presence is worth a prompt.
- **The gate's promise grows a clause rather than losing one.** Today it is
  microphone, camera, motion — none of it leaves. Location joins that list on
  the same terms: *not where you are, either.* Say so where the app makes the
  promise, so the new permission reads as consistent with it, not against it.
- **This supersedes the stylised sun and upgrades the moon proxy.**
  - `sky.ts` (entries 53, 71) computes daylight from the clock alone, and its
    own header admits *"in Reykjavík in June this will call 2am night while it
    is broad daylight."* Real solar altitude from lat/long fixes precisely
    that: `uDay` becomes the actual sun above or below the actual horizon,
    sunrise and sunset land when they truly do, and the anchor table becomes a
    fallback for when location is refused rather than the primary source.
  - Entry 96's **presence proxy becomes a real computation.** That entry built
    a location-free `cos`-from-transit stand-in *because* geolocation was
    forbidden; with a latitude, lunar altitude is the genuine article, correct
    about how high and correct at every latitude. The proxy stays as the
    graceful fallback, exactly where the solar anchor table now sits.
- **Refusal is a first-class path, not an error.** No location → both cycles
  fall back to today's clock-only stylised versions, which already exist and
  already work. The feature degrades to exactly the current app, so nothing is
  lost by declining and the prompt carries no coercion. Same shape as
  `requestMotionAccess` — refusal resolves to "use the stylised version," never
  throws.
- **Asked at the right moment, not at the gate.** The microphone is asked for
  at Start because the app is useless without it; location is an enhancement,
  so it is asked for the first time the sky or moon actually wants it, or from
  a chip — never bundled into the Start gesture, which `permission-gate.ts`
  already keeps carefully spent on fullscreen, motion and mic in that order.
  **Mine**, and it keeps a refusable nicety from gating the one permission the
  app cannot run without.
- **Stored coarsely, if at all.** Astronomy needs almost no precision — a
  degree of latitude moves sunrise by a few minutes — so round the stored
  location hard (to ~0.1°, ~11km) before it touches `prefs`, and prefer not to
  persist it at all if a re-ask is cheap. **A precise coordinate in
  `localStorage` is a privacy cost with no visual benefit.** Hard-stop
  relevant: this is a new stored field and it must be the coarse one.
- **The math is ours, no library.** Solar position is the standard NOAA
  algorithm (~30 lines); lunar position is Meeus's low-precision method
  (~60 lines). Both are pure functions of time and location, both belong in
  `sky.ts` and `moon.ts` beside the fallbacks, both are probeable headless
  against known sunrise/moonrise times. No ephemeris package, and — the point
  of the whole entry — **no network**: the sky is computed, not fetched.
- **Explicitly still on the device**, and this is the line that must be
  unmistakable in the code: the coordinates are read, used to compute two
  angles, and discarded or coarsely stored. They are **never** put in a URL, a
  header, a fetch body, or a share payload. The nearest existing discipline is
  `share.ts`'s own *"nothing leaves the device on our say-so"* — same rule, new
  sensor.

**Lands in**
- `src/sky.ts` — real solar altitude, clock table as fallback; the geolocation
  refusal comment is deleted and replaced by the reasoning above.
- `src/moon.ts` (entry 96) — real lunar altitude, the `cos` proxy as fallback.
- `src/geo-location.ts` (new) — the one-time request and coarse rounding,
  shaped like `requestMotionAccess`.
- `src/permission-gate.ts` / `src/hud.ts` — where and how it is asked.
- `index.html` — the promise gains its clause.
- `src/prefs.ts` — the coarse stored location, if persisted (Hard Stop: new
  field, coarse).
- `scripts/probe-sky.ts`, `scripts/probe-moon.ts` — real positions against
  known times; the refused-location fallback path.

**Done when** — with location granted, `uDay` tracks the real sun for the
actual place and moon presence is true altitude; with it refused, both are
exactly today's clock-only behaviour; the coordinate appears in no network
request, URL, or stored value at more than ~0.1° precision; and the Start
gesture still asks only for mic, motion and fullscreen.
**Verify** — `probe-sky.ts`/`probe-moon.ts` against a known place and date
(sunrise/moonrise to the minute), and a grep proving the coordinate reaches no
`fetch`, URL, or `prefs` at full precision. Then the phone, at a known location
at sunset.
**Hard stops** — prefs **yes — a new coarse-location field**, rounded to ~0.1°,
persisted only if a re-ask is not cheaper; url **no, and load-bearing: the
coordinate never enters a URL**; capture no; dependency **no — computed, not
fetched; no library and no network.**

**Verification note — `/ccc` at build 352.** The privacy claim holds by construction: coordinates are coarsened on receipt, held in a module-local cache in `geo-location.ts`, never written to `prefs`, and there is no `fetch` in the source at all. Both disclosed omissions are properly closed — the stored location was argued down in the build note, and the gate copy is now entry 107, a question for Victor rather than a silent no.
### 98. The picture answers the light in the room, camera or no camera
`status: done` · added 2026-08-30 · build 323 · verified at build 352

**Build note (Mine).** Shipped: `src/ambient-light.ts` (new —
`requestAmbientLight()`, feature-detected and try/catch'd around
construction and `start()`, since the Generic Sensor API's own refusal is a
synchronous constructor throw rather than a dialog waiting on the user;
`luminanceFromLux(lux)`, the pure piecewise-log mapping onto the same 0-1
scale entry 23's camera-luminance sampling already produces, so both feed
the identical `exposureEnvelope` and the identical `0.85 + x * 0.3` formula
in `scene.ts` rather than two independently tuned ones). `scene.ts` kicks
off the request once, lazily, at construction — no gesture to wait for,
since the constructor's own throw is the entire refusal path — and
`sampleAmbientLight`'s existing no-camera branch (which used to just pin
`uExposure` at 1 and return) now reads the sensor when one resolved,
falling back to that exact same pin when it didn't. The camera branch is
untouched, character-for-character. A `light` line joins `sky`/`moon` on
the `hud.ts` readout, printing lux and the exposure it currently produces
when a sensor is available, and printing `unavailable` outright when it
isn't — Decided's own "on iOS the ambient line honestly reads unavailable,
which is itself the answer."

**The pivot point is the whole design.** `luminanceFromLux` isn't a single
log curve end to end — it's two log-linear segments meeting at 150 lux (an
ordinary lit room, **Mine**, from common indoor-lighting figures), because
the camera-luminance mapping it has to match already treats 0.5 as
"unchanged," and a single log span from 1 lux to 10,000 lux would not put
an ordinary room anywhere near that pivot. `probe-ambient-light.ts` (9
checks) proves the pivot lands exactly on 0.5, that equal *ratios* of lux
(not equal differences) produce comparable steps — the actual test that
it's log-shaped rather than merely monotonic — and that it stays bounded at
both ends of Decided's own named range (moonlight to bright daylight) and
beyond. Per Decided and Verify both: the mapping is what's probeable here;
the sensor itself is not, and the probe's own header says so rather than
mocking a sensor that doesn't exist on the machine running it.

**Not verified live** — no Android device with the sensor in this
environment, per the entry's own Verify, which wants exactly that: "the
phone, Android, moving between a sunlit window and a dark corner." `pnpm
build`, `pnpm lint`, the new `pnpm probe:ambient-light`, and the full
remaining probe suite (17 other scripts) all pass. Confirmed rather than
merely asserted: no `fetch`/`XMLHttpRequest`/`WebSocket` in
`ambient-light.ts` or `scene.ts`, no `lux` anywhere in `prefs.ts` or
`main.ts`, and an empty `git diff` on `prefs.ts` — grepped before this
commit, the same discipline entry 97's build note used for the coordinate.

**A correction to entry 97's own work, found while reading this project's
CLAUDE.md house style for something unrelated.** Entry 97 added a real
value import from `moon.ts` to `sky.ts` and, finding plain Node's ESM
resolver couldn't follow the extensionless `./sky` the way Vite does, wired
`probe:sky` and `probe:moon` through `scripts/dir-import-hook.mjs` (built
for `probe-fullscreen`, entry 66) to paper over it. This project's own
house style already has the actual answer, stated plainly and already used
by `haptics.ts`: *"Value imports inside `src/` that a probe script needs
must carry the `.ts` extension — `node --experimental-strip-types`
requires it."* Fixed here rather than left for a future session to trip
over twice: `moon.ts`'s import is now `from './sky.ts'`, and both
`package.json` probe scripts are back to bare `node --experimental-strip-
types`, with the hook workaround removed. No behaviour changed;
`probe:sky` (34 checks) and `probe:moon` (43 checks) both still pass.

**Do** — read the ambient light sensor where it exists and let the real room
brightness drive the picture's exposure and contrast, so it stays legible in
sun and gentle in the dark. A third environmental axis, its own quantity, no
network, degrading to nothing where the sensor is absent.

**Why** — Victor, choosing ambient light over a weather API precisely because
it senses the room without anything leaving the device. Full connection to the
environment, kept honest.

**Decided**
- **Its own axis, perpendicular to the other two.** The sun (entries 47/53/71/
  97) owns **colour and the day/night ground**. The moon (entry 96) owns
  **shape**. Ambient light owns **force** — how hard the picture pushes against
  whatever ground it is on: exposure and contrast, not hue and not form. A
  bright room does not change what colour the picture is or what shapes it
  draws; it makes them assert harder so they survive glare. Three natural
  inputs, three clean axes, none reaching into another's.
- **It generalises entry 23, which already had the idea half-built.**
  `scene.ts:786` runs an `exposureEnvelope` that samples the *camera* frame's
  luminance and drives `uExposure` — *"the picture answers the light in the
  room"* — but only while passthrough is on. The ambient sensor is that same
  answer **without needing the camera**: the room's real lux, fed into the
  envelope that already exists, so a phone with no camera up still brightens in
  sun and eases in the dark. When the camera *is* on, its own sample stays
  authoritative (it is measuring the same light more directly); the sensor
  fills the cameraless case that is almost always the actual case.
- **Android/Chrome only, and that is stated up front, not discovered.**
  `AmbientLightSensor` is the Generic Sensor API — **Chrome on Android has it;
  Safari and iOS do not implement it at all.** So this is a bonus one platform
  gets, exactly the footing the Vibration API was on before it was abandoned
  (`haptics.ts`: *"a bonus on one platform, absent on the other, and nothing
  may be built to depend on it"*). Nothing here may be depended on; the picture
  must be complete and correct with the sensor absent, which on iOS it always
  is.
- **Absent, unsupported, or refused all resolve the same way: today's fixed
  exposure.** Feature-detect, wrap construction in try/catch (the constructor
  throws on unsupported and on policy refusal), and on any failure leave
  `uExposure` exactly where it sits now. Identity-when-absent, the discipline
  entries 47, 75, 76 and 96 all share — and here it is the *majority* platform,
  so it must be the well-tested path, not the afterthought.
- **Slow, or it strobes.** Room light is noisy — a hand passing over the
  sensor, someone walking between the phone and a lamp, a car's headlights. The
  reading feeds the existing envelope with a multi-second time constant so the
  picture *adjusts* to a room rather than *flickering* at events in it. **Mine**,
  and it is the difference between ambient and reactive: this axis is the
  room's steady state, not its transients — those are the microphone's job.
- **Mapped as a gentle lift, bounded at both ends.** Lux is unbounded and
  wildly nonlinear (moonlight ~1, a lit room ~100, daylight ~10,000+), so map
  it logarithmically into a small exposure range and clamp hard. A bright
  room lifts exposure and nudges contrast up so thin rings survive; a dark room
  lets exposure fall so the picture deepens rather than glaring. The swing is
  small — this is legibility, not a light show. **Mine** as to the range; the
  phone settles it, since only a real sensor in a real room can.
- **Nothing is stored and nothing is sent.** Ambient light is live-sensed like
  motion, not a preference — there is no `prefs` field, no persistence, and the
  lux value enters no URL, fetch, or share payload. **The known concern is
  named:** ambient light readings have a genuine fingerprinting and
  side-channel history (they can leak coarse screen content and environment),
  which is *why* browsers gate the sensor — so it is used live for our own
  exposure and never exposed, logged, or transmitted. That it stays on the
  device is the whole reason it was chosen over weather.
- **Report lux and the derived lift in the readout**, beside sun and moon —
  three environmental senses, three lines, and on iOS the ambient line honestly
  reads unavailable, which is itself the answer to "why doesn't it respond to
  the room here."

**Lands in**
- `src/ambient-light.ts` (new) — the sensor, feature-detected and try/catch'd,
  shaped like `requestMotionAccess`: resolves to a reader or to nothing.
- `src/scene.ts:783-799` — the ambient reading feeds `exposureEnvelope` in the
  no-camera branch; the camera branch is unchanged.
- `src/hud.ts` — the readout line.
- `scripts/probe-*` — the lux→exposure mapping is pure and can be probed; the
  sensor itself cannot, and the probe should say so rather than mock a sensor
  that does not exist on the machine running it.

**Done when** — on an Android phone, a bright room visibly lifts the picture's
exposure and a dark room eases it, slowly; on iOS the picture is exactly today's
and the readout says ambient light is unavailable; with the camera on, exposure
behaves exactly as entry 23 already makes it; no lux value is stored or sent;
and a hand waved over the sensor changes nothing abruptly.
**Verify** — the phone, Android, moving between a sunlit window and a dark
corner. The mapping is probeable; the sensor is not, and the iOS-absent path is
verified simply by it being iOS.
**Hard stops** — prefs no (live-sensed, nothing stored) · url no · capture no ·
dependency **no — a built-in browser sensor, no library; and no network, which
is the whole reason it was chosen.**

### 99. The start screen animates on every phone, full stop
`status: done` · added 2026-08-30 · supersedes 94, strengthens 65 · build 325 · verified at build 352

**Build note (Mine).** Shipped: the disc's reduced-motion pulse
(`start-pulse-reduced` in `index.html`) replaced entirely — it used to shift
`background` between two lavenders a phone in sunlight cannot tell apart;
now a `box-shadow` blur/spread plus a `filter: brightness()` swing pulse in
place on the same 3.4s period, swelling and fading with no scale and no
outward-travelling ring (those are the actual motion `prefers-reduced-motion`
exists for). The release name's `mountReleaseName()` in `version.ts` gained
entry 94's own two-phase decode absorbed whole: phase one is the existing
history flip, shortened (`NAME_FLIP_MS` 1400ms → 850ms) so it hands over
rather than running to completion; phase two locks the real name on left to
right, about every 55ms, with unresolved positions cycling through
`SCRAMBLE_ALPHABET` — built from the actual characters in `RELEASE_NAMES`,
not a borrowed alphabet, so a future name can never contain a character the
scramble has never seen. Reduced motion no longer returns the final name
immediately (the bug entry 94 diagnosed and this entry fixes for real): it
now types the name in at about 3 characters a second, unscrambled, which is
Decided's own distinction between "less motion" and "less information".
`#motion-glyph` — a single faint dot beside the byline, filled for full
motion, hollow for reduced, reusing the queue panel's own filled/hollow
vocabulary — is the one-glance diagnosis the entry exists to add: the actual
root cause of five failed fix attempts was never a coding failure, it was
that nobody could confirm the phone was in the state that was silencing the
animation, and confirming it needed opening `?debug`. The genuinely
unreachable last-resort path (`RELEASE_NAMES` somehow empty) now fades the
name up over `index.html`'s new `transition: opacity 400ms ease` on
`#release-name` via a small `fadeInName()` helper, rather than snapping it
in — Decided's own explicit rule for that path, even though it cannot
currently be reached in practice.

**A second instance of the same house-style miss entry 98 already found and
fixed once.** Writing `scripts/probe-name-decode.ts` to test the new pure
timing helpers (`lockedCountAt`, `reducedLockedCountAt`, `renderLockFrame`,
all exported from `version.ts` for exactly this) needed to import
`version.ts` directly, and hit the identical extensionless-import failure
entry 98's own build note describes for `moon.ts` → `sky.ts` — except this
time in `version.ts`'s own pre-existing `import ... from './release-name'`,
which predates this session entirely and had simply never been exercised by
a probe before now. Fixed the same way, per CLAUDE.md's own documented
convention: `from './release-name.ts'`, with the reasoning noted inline the
same way `haptics.ts` already does it.

**Verified without literal OS-level `prefers-reduced-motion` emulation**,
which this environment's browser tools have no way to trigger (no DevTools
Rendering-panel automation available, and `resize_window` did not actually
change the page's own viewport dimensions when tried, so a true 320/360px
narrow check is also not confirmed pixel-for-pixel). What was verified
directly, in a live browser against the dev server: forcing `#start`'s
animation to `start-pulse-reduced` and comparing the 0%/50% keyframe values
side by side shows a clearly visible glow swell, not a subtle shift;
setting `#release-name`'s `textContent` to successive prefixes and to a
locked-prefix-plus-scrambled-tail string (mirroring exactly what
`renderLockFrame` produces) confirms both the type-in and the decode render
correctly inside the reserved 18ch box with no reflow; and toggling
`#motion-glyph`'s `.full` class confirms the filled/hollow states are both
visibly distinct. This exercises the same CSS and the same rendering logic
the real media-query path would trigger, just invoked directly rather than
through the OS preference itself — a reasonable substitute, not equivalent
to the entry's own Verify, which the honest answer is: not fully performed
here. The motion glyph's own risk of a narrow-width layout bug is low
regardless — it is a 4px dot appended inline into existing text flow, not
an absolutely-positioned element competing for space the way entry 93's
queue panel was, which is why that entry needed the narrow-width check this
one does not lean on as hard.

**A bug in the probe itself, caught by the release name it was testing
against.** `probe-name-decode.ts`'s first draft hardcoded 3000ms as "long
enough for the reduced type-in to finish any name" — true for the 9-character
name this entry started against, false the moment `real room` (9 characters)
was appended and this build's own `still moves` (11) became current: at 3
characters/second, 11 characters need ~3.67s, and the check failed honestly
against its own wrong assumption. Fixed to derive the expected time from the
target's own length rather than a guessed constant, so the check stays
correct regardless of which name is live — the actual property being tested
(reduced motion eventually reaches the real name) was never wrong; the test's
own timing budget was.

**A process note, disclosed rather than quietly corrected**: this entry's
implementation was written and locally verified before its `status:
building` claim was committed and pushed, out of sequence with this
project's own stated protocol (claim first, then implement). Checked before
committing the claim: `origin/main` still showed entry 99 as `ready`, so no
collision actually occurred — but the sequence itself was wrong, and is
recorded here rather than silently fixed by pretending the order was
correct.

**Do** — make both the play disc and the name visibly animate whether or not

**Do** — make both the play disc and the name visibly animate whether or not
the phone reports reduced motion, by giving the reduced path cues that are
plainly visible but carry no motion. Neither may ever be silent or invisible.

**Why** — Victor has asked for the play-button animation at least five times and
still does not see it, and the name animation the same. The cause is real and it
is mine: every fix has depended on an OS setting the user has no reason to know
exists, and when that setting is on, the app answers by going nearly invisible.
"Animated" and "not animated" currently look identical on a phone in that state,
which is the phone at a festival.

**Decided**
- **The root cause is a failed diagnosis loop, not a coding failure.** The
  animations are coded. Entry 65 shipped a disc pulse at build 220; entry 94
  specified the name decode. Both are gated on `prefers-reduced-motion`, which
  Android sets under Battery Saver and Accessibility → Remove animations — and
  **nobody ever confirmed the phone was in that state, because confirming it
  needs `?debug`.** Five rounds fixed a cause that was never made visible to the
  person reporting it. The lesson, written down: **when a fix depends on a
  device state the user cannot see, surface the state or remove the dependency.
  Here, remove it.**
- **Stop depending on the preference being actioned correctly. Make both
  branches visible.** Full-motion keeps everything it has — the disc's ring and
  breathe, the name's history-flip. The reduced branch stops being a whisper:
  it must be as *noticeable* as the full one, differing only in *kind* of
  change, never in whether a change is perceptible.
- **This honours reduced-motion properly rather than ignoring it, and the
  distinction is the whole design.** `prefers-reduced-motion` exists for
  vestibular triggers — translation, scale, parallax, rotation. **Opacity,
  glow, colour and a character resolving in place are not motion** and do not
  trigger it (entry 94 already argued this for text). So the reduced variants
  use exactly those: they are unmistakable *and* correct. We are not overriding
  the preference; we are giving it a version that respects it and is still
  alive.
- **The disc, reduced (supersedes entry 65's variant):** its current
  `start-pulse-reduced` shifts `background` between `#9d9bf0` and `#b9b7ff` —
  two lavenders a phone in sunlight cannot tell apart. Replace it with a
  **glow pulse**: a `box-shadow`/opacity halo that clearly swells and fades on
  the same 3.4s period, plus a brightness swing wide enough to read outdoors.
  No scale, no travelling ring (those are the motion). Visible across a
  dancefloor; still motionless.
- **The name, reduced (absorbs entry 94):** builds entry 94 as specified — the
  history-flip decelerating into a left-to-right character lock — and its
  reduced variant is the non-scrambling type-in from that entry, **but it must
  actually run**, not return early. About 3 characters/second resolving in
  place: plainly visible, no churn, no motion vector.
- **The name's own reduced fallback of last resort is a fade, never an instant
  set.** Even if a build somehow reaches the most conservative path, the name
  *arrives* — fades up over ~400ms — rather than snapping in. Nothing on this
  screen is ever allowed to simply appear; the start screen's whole job is to
  invite, and an instant paint invites nothing.
- **And surface the state, so this loop cannot silently repeat.** The
  `?debug` readout reports `os motion reduced/full` (entry 65). That is not
  enough, because the person hitting this never opens `?debug`. Put a **single
  faint dot or glyph on the gate itself** that differs between full and reduced
  motion — invisible as information to anyone not looking for it, but the
  moment "the animation isn't working" comes up again, the answer is one glance
  at the start screen, not a spelunk through Android settings. **Mine**, and it
  is the actual fix for "why is it so hard": the diagnosis becomes visible where
  the problem is reported.
- **Verify on the reduced path specifically, because that is the failing one.**
  Every prior verification implicitly ran full-motion (a dev browser rarely
  reduces motion) and so never exercised the branch that was broken. This
  entry's verification is the opposite: force reduced motion and confirm both
  animations are *obvious*.

**Lands in**
- `index.html:555-560` — `start-pulse-reduced` becomes the glow pulse.
- `src/version.ts:281-333` — entry 94's two-phase decode and a reduced variant
  that runs.
- `index.html` / `src/version.ts` — the gate's faint motion-state glyph.
- `scripts/probe-*` — the decode timing (pure); the CSS is verified on device.

**Done when** — with reduced motion forced ON in DevTools, the disc visibly
pulses (glow, not a colour whisper) and the name visibly resolves character by
character; with it OFF, the full ring/breathe and history-flip play as today;
on a real phone in daylight both are obvious in either state; and the gate
carries a one-glance indicator of which motion state it is in.
**Verify** — DevTools with `prefers-reduced-motion: reduce` emulated is the
primary test, because it is the branch that has been failing unseen. Then the
actual phone, in sun, without touching any OS setting — which is the whole
point: it must work as the phone is.
**Hard stops** — prefs no · url no · capture no · dependency no — CSS and a
function that already exists, no animation library (entry 94 settled that).

### 100. The sun says how often, the moon says how far
`status: done` · added 2026-08-30 · build after 89, 90 and 96 · build 327 · verified at build 352

**Build note (Mine).** Shipped in `src/engine/celestial.ts` (new): a pure
`celestialFor(date, location)` reading `Sky.slope` (a new field, added
alongside `daylight`/`warmth`, computed as `interpolate`'s own analytic
derivative — `6u(1-u)` from the chain rule through `smoothstep`, exact at
every anchor rather than a finite-difference approximation) and `Moon`
(`illuminated`/`waxing`/`presence`, entry 96/97) into three numbers:
`sunRate` (bounded [0.75, 1.25], 1 at a flat sky), `moonReach` (centred on
1, swinging ±0.35 at full presence and a full new/full moon), and
`moonRampBias` (a small ±0.06-wide nudge, signed by waxing/waning, zero at
either turning point or moon-down). `director.ts` applies them: hold times
divide by `sunRate` rather than multiply (see below), `COLOUR_MIN_STEP`'s
own acceptance gate scales by `moonReach`, the view axis's bold-vs-safer
choice gates on `moonReach < 1`, and `colourFor` takes the ramp bias as a
new, defaulted second parameter. `Director.update()`'s own new `celestial`
parameter is defaulted to `CELESTIAL_IDENTITY` — a deliberate departure from
entry 90's own `posture` (required there, because no posture value is a
true no-op); `CELESTIAL_IDENTITY` genuinely is one, so defaulting it left
every existing `scripts/probe-slow.ts`/`probe-posture.ts` call site
untouched rather than needing dozens of six-argument calls rewritten to
seven. `main.ts` samples `celestialFor` once a second (`CELESTIAL_SAMPLE_S`),
matching `scene.ts`'s own sky/moon sampling discipline, and requests location
once at start-up through the same module-singleton `geo-location.ts` (entry
97) `scene.ts` already uses — a second caller does not re-prompt. The HUD
gained one line, `sun 1.18x  moon 0.82x`-shaped, beside the `auto`/`hold`
lines Decided asked to sit next to.

**Three judgment calls, disclosed.** (1) *Divide, not multiply.* Decided's
own prose frames the sun's contribution as "how often" — a frequency, where
higher means more restless and more frequent. This codebase's own
`HOLD_SCALE` convention encodes "more frequent" as a *smaller* multiplier on
hold duration, the opposite sense. Reconciled by dividing hold time by
`sunRate` rather than multiplying — `sunRate` is bounded to [0.75, 1.25] by
construction, so this never inverts sign, only ever shortens (`sunRate > 1`,
at a twilight) or lengthens (`sunRate < 1`, at night or midday) the hold
relative to posture's own scale, which stays the dominant term as Decided
requires. (2) *One multiplier, two mechanisms.* `moonReach` drives both a
continuous distance gate (`COLOUR_MIN_STEP`'s scale) and a discrete
categorical choice (bold suggestion vs. the runner-up), rather than two
separate constants — Decided's own "how far a step goes" reads as one idea
wearing two hats in this codebase, not two ideas. (3) *The ramp tie-break as
an additive bias on `colourFor`'s own continuous ramp position.* Considered
and rejected: a literal branch-equality tie inside `viewFor` (there is no
such tie to break — `viewFor` is not what "ramp" refers to in Decided's own
text), and a hue-drift interaction with entry 91's generative engine (out of
scope — entry 91 owns its own axis, untouched here). The bias is bounded to
0.06 against a 2.0-wide `t` range specifically so it can only tip a close
call between two adjacent `RAMP` stops, never manufacture a jump the audio
did not ask for.

**A bug ruled out before it shipped.** `sky.ts`'s `slope` field was drafted
once to differentiate real solar altitude for `skyForLocation` (matching
`daylight`/`warmth`'s own location-aware behaviour) and once to always use
the clock-based anchor curve regardless of which function produced the
`Sky`. Kept the second: Decided's own words — "the slope is still meaningful
even when its absolute hours are wrong for the latitude" — say directly that
differentiating the real ephemeris was never required to satisfy this entry,
and doing it anyway would have made `skyFor`/`skyForLocation` diverge on a
field where nothing asked them to.

**Verify.** `scripts/probe-celestial.ts` (new) scrubs a representative day at
one-minute resolution (`sunRate` never leaves [0.75, 1.25]; two windows,
dawn and dusk, cross 1.1; midday and the small hours stay under 0.85) plus a
scattered year of dates (same bounds hold regardless of calendar day, since
`slope` is clock-only — the year mostly re-proves the daily shape is stable
over a long timescale, which is honest: the sun's own two-peak curve does
not itself vary by season in this implementation, only by hour). New moon
and full moon (found by scanning each phase's own day for its presence
peak, the same technique `probe-moon.ts` already uses) produce `moonReach`
values 0.3+ apart, and that gap measurably changes how many marginal colour
changes a fixed borderline-oscillating trace clears through a real
`Director`. A waxing and a waning half-moon, matched by presence rather than
by clock hour (the two quarters transit at different hours by construction),
produce near-equal `moonReach` and opposite-signed `moonRampBias`. Moon down
(twelve hours from a full moon's own transit) reproduces `CELESTIAL_IDENTITY`
on both moon fields, within tolerance. And the load-bearing regression
guard: the same 240-second synthetic four-axis trace run through
`Director.update()` once omitting the `celestial` argument and once passing
`CELESTIAL_IDENTITY` explicitly produces `JSON.stringify`-identical directive
sequences, frame for frame — proof the defaulted parameter really is a
no-op for every caller that predates this entry. All twenty existing probes
plus this new one pass; `pnpm build`/`pnpm lint` clean.

**A verification shortfall, disclosed rather than hidden.** The HUD line was
not seen live through the running app — the sandboxed browser profile used
for on-screen checks this session has no way to grant microphone access
(`chrome://settings` is unreachable from browser automation here, the same
class of tooling gap disclosed for entry 99's `resize_window`), and the app
needs a warm microphone buffer before `s.director` exists at all. Verified
instead by importing `src/hud.ts` directly in the page's own module graph
(Vite serves ES modules in dev), constructing a real `Hud` with a synthetic
`director` stats object (`sunRate: 1.18, moonReach: 0.82`), and screenshotting
the result: `sun 1.18x  moon 0.82x` renders correctly, immediately after the
`auto ...` line and before `hold ...`, with no clipping. This is layout
verification of the readout, not a live end-to-end microphone-driven check —
narrower than Decided's own "a phone left out across an actual sunset" ask,
which cannot be done from here at all and was not attempted.

**Do** — put the director's own energy on the two natural clocks. The solar
cycle sets how *often* it moves; the lunar cycle sets how *far* a move goes and
which way it leans. Both bounded, both smooth, both silent when the sky is not
known.

**Why** — asked for: *"director energy sun and moon linked"*. Entry 96 put the
moon into the shapes and entries 47/53/71 put the sun into the colour, so both
clocks are already felt in *what the picture looks like*. Neither is felt in
*when it changes*, which is the one axis the director actually owns. Linking it
is what makes the toy's pacing — not just its palette — part of the day it is
being played in.

**Decided**
- **The split, and it is the whole entry.** **Sun → rate. Moon → step.** One
  sentence, and it keeps entry 96's perpendicularity intact rather than
  quietly muddying it. That entry's constraint was *sun owns colour, moon owns
  shape, neither touches the other's axis*; cadence is a third axis neither had
  claimed, and both are allowed to touch it **because they touch different
  properties of it**. The sun never changes how big a step is; the moon never
  changes how often one happens. Stated this plainly so the next reader does
  not have to work out whether the rule was broken. **Mine.**
- **The sun's contribution is the sky's *rate of change*, not its height.** The
  obvious version — brightest at noon, quietest at midnight — is wrong for this
  app twice over: it is used at night, and it would make the two flattest hours
  of the day (3pm and 3am) behave identically to the two most interesting. What
  actually distinguishes an hour is whether *the world itself* is changing
  colour, and that is a two-peaked curve: dawn and dusk. So the director's rate
  rides `|d(daylight)/dt|`, normalised over the day. **Twilight is when the
  picture is most restless, and the small hours and the flat afternoon are both
  calm.** A festival's sunset and a commuter's dawn get the same answer for the
  same reason, and it needs no new input — `sky.ts` already produces the curve
  whose slope this is.
- **Scale, not replace.** The rate multiplier is bounded to **×0.75 at the
  flattest hour, ×1.25 at peak twilight**, applied on top of entry 90's
  posture multiplier, which stays the dominant term. A quarter either way is
  felt across an evening and is invisible in any single change — which is the
  correct size for something nobody asked to be able to see. Posture is *why*
  the director is fast or slow; the sun is a colour on top of that, never an
  override. **Mine** as to the numbers.
- **The moon's three facts map onto step, exactly parallel to entry 96's three
  onto shape:**
  - **Illuminated fraction → how far a step goes.** Full moon: the director is
    willing to make a large move — a whole view change, a colour jump across
    the ramp. New moon: it moves in small steps, to a neighbouring colour, and
    prefers the runner-up view entry 89 introduces over a distant one. The
    moon lends the toy its reach, as in 96 it lends it its light.
  - **Waxing vs waning → which way it leans through the ramp.** Waxing nights
    the director breaks ties *up* the `RAMP` (toward jade and cold); waning,
    *down* (toward ember). A tie-break only — it never overrides what the music
    asked for, it decides between two answers the character calls equal. That
    is what makes a first-quarter night feel different from a last-quarter one
    over hours, without either being wrong about the sound in any given minute.
  - **Presence (rough altitude) → strength.** Below the horizon the moon's
    whole contribution is zero and the step sizes are the plain ones. Same rule
    as entry 96, same reason, and it means most nights carry the moon for only
    part of their length.
- **This is the mechanism entry 89 is already building, given a dial.** 89 makes
  `COLOUR_MIN_STEP` decay and makes `viewFor` return a ranking so a runner-up
  exists. The moon does not add machinery — it *sets where on that ranking the
  director is willing to reach today*. Which is why this builds after 89 and
  not beside it: without the ranking there is no "how far" to modulate.
- **Bounded, smooth, and an identity when unknown.** Every one of these is a
  multiplier on a value the director already computes, clamped to its stated
  band. All of them move through entry 92's ramps, so nothing steps at a
  minute boundary. And with no location (entry 97 makes that a real and
  supported state, not a failure) the sun term falls back to `sky.ts`'s clock
  curve — whose *slope* is still meaningful even when its absolute hours are
  wrong for the latitude — and **the moon term is exactly zero**, because a
  moon's phase is knowable from the clock alone but its altitude is not, and
  entry 96 already ruled that presence gates the whole influence. Prove it:
  with the sun term pinned at its midpoint and the moon at zero, the director
  must produce byte-identical decisions to today's, on the same trace. Same
  discipline as `uDay`, `uBeatConfidence` and `uSlip`.
- **Report it.** One line in the readout — the two multipliers as numbers,
  beside entry 90's posture and entry 89's blocked-gate line. Two invisible
  natural cycles silently changing the app's pacing, with no way to see them,
  is precisely the diagnosis hole entry 89 was just re-read to find.
- **Not decided here** → whether the sun and moon should touch anything else
  that has a rate — the ripples' decay, the powder, the emitter's spawn
  interval. Entry 96 owns the emitter's *shape* parameters and this one owns
  the director's *timing*; anything else is a third entry and should say why.

**Lands in** `src/engine/celestial.ts` (new — the two multipliers as a pure
function of a `Date`, an optional location and the moon maths entries 96/97
introduce, so it is scrubbable headless like `sky.ts` is); `src/sky.ts` — a
`slope` alongside `daylight`, since it is that curve's own derivative and
belongs with it; `src/director.ts` — holds scaled by the sun term,
`COLOUR_MIN_STEP` and the view ranking's reach scaled by the moon term, the
ramp tie-break; `src/hud.ts` — the readout line; `scripts/probe-celestial.ts`
(new).
**Done when** — scrubbing a whole year headless shows the rate term peaking
twice a day at the twilights and never leaving [0.75, 1.25]; a full-moon night
and a new-moon night produce visibly different step sizes on the same audio
trace; a waxing and a waning half-moon night differ in which way ties break and
in nothing else; the moon below the horizon is byte-identical to the moon term
switched off; and with the sun pinned mid and the moon at zero the director's
decisions on a recorded trace match today's exactly.
**Verify** — `probe-celestial.ts` over a year, which is the only way to see a
two-peak curve and a 29.5-day cycle at once. Then the thing that actually
matters and cannot be probed: a phone left out across an actual sunset, which
is the hour this entry claims is the most alive.
**Hard stops** — prefs no · url no (no coordinate ever reaches one — entry 97's
rule, restated because this entry is the second consumer of that location) ·
capture no · dependency no (the moon maths is entry 96's, already refused a
library).
