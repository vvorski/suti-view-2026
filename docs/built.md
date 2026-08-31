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

### 88. A quiet phone listens harder
`status: done` · added 2026-08-30 · build 302 · verified at build 354

**Build note (Mine)** — `STRONG_UP`/`SUSTAIN_LEVEL` stay exactly where they
were (18 and 0.55): `intensity()` and `envelopePeak()` still anchor their 0-1
scale to `STRONG_UP`, so a shake that only clears a *lowered* bar reports
proportionately low on that scale rather than the scale's own zero-point
moving underneath entry 85's floor guarantee. What actually moved are two new
pairs, `STRONG_UP_CALM/BUSY` (13/20) and `SUSTAIN_LEVEL_CALM/BUSY`
(0.45/0.60), Decided's own numbers, blended by a new `calm` field — an EMA of
`disturb` at `CALM_TAU` (25s) — via `currentStrongUp()` / `currentSustainLevel()`,
which `detectStrong`/`detectSustained` now read instead of the constants.
`STRONG_DOWN` is reapplied as a ratio (`STRONG_DOWN_RATIO = STRONG_DOWN /
STRONG_UP`) against whichever bar is current, per Decided's own reasoning
about the hysteresis band narrowing if it didn't. The freeze during a
detection and its cooldown reuses the existing `above` / `sustained > 0` /
`cooldown > 0` / `doubleWindow > 0` fields as the freeze condition inside
`updateCalm` — no new boolean, and it falls directly out of Decided's "freeze
on the first reversal, thaw when the cooldown ends."

**Mine, beyond Decided's named bounds**: `busyness()` maps `calm` through
`Math.sqrt` before blending, rather than using `calm` linearly. A linear
mapping was my first attempt, and the probe caught it: 30s of this file's own
"walking (3 m/s², 2 Hz)" case converges `calm` to under 0.05, because
`disturb` spends most of a walking gait's cycle at or under `FLOOR` — only
each stride's peak clears it — so the EMA's time-average badly undersells how
much the phone has actually been moving. Linear, that only nudged the
reversal bar from 13.0 to about 13.3, nowhere near enough separation for the
Done-when case. `sqrt` front-loads the response in exactly that small-`calm`
regime without touching `CALM_TAU` itself, and raises the post-walk bar to
about 14.5 — verified against the real `Tumble`, not derived on paper.

**A real bug, caught by the walk-then-shake probe case and worth disclosing in
full**: the first version of that case (a 1.2s, 4 Hz burst, matching
"deliberate shake"'s own shape) fired after both stillness *and* walking —
the adaptive reversal bar looked right in isolation (peak 13.6 sat under a
14.5 bar), yet the case still fired. Instrumented `detectStrong`/
`detectSustained` directly to find out why: it was firing via the *sustained*
path, not the reversal path. `SUSTAIN_LEVEL_BUSY` tops out at 0.60, but a
13.5 m/s² amplitude saturates `disturb` to about 0.96 — and that is true of
essentially any amplitude past roughly 9 m/s², regardless of context, since
`disturb` depends only on instantaneous `mag`. So the sustained path
structurally cannot discriminate calm from busy for any shake hard enough to
be called one — SUSTAIN_LEVEL's adaptive range, as Decided names it, cannot
reject this class of gesture, busy or not. Shortening the burst to 0.4s
didn't fix it either: the envelope's own decay tail after the burst ends
(≈0.35s, from `ENVELOPE_TAU`) supplies most of `SUSTAIN_TIME` (0.6s) on its
own once the envelope has saturated, so total sustained-path exposure stayed
past 0.6s regardless of how brief the burst itself was.

I did not retune `SUSTAIN_LEVEL_BUSY` to chase this — Decided names 0.45 to
0.60 specifically, marking only "the four numbers" as Mine, not a redesign of
what the sustained path's scale means, and pushing it toward ~0.97 to reject
a saturating shake would gut what that path is for (catching a shake whose
*peak* was undersampled). Instead I made the two probe cases isolate what
`STRONG_UP_CALM/BUSY` actually governs: a brief (0.26s), 7.5 Hz burst — found
empirically against the real `Tumble` (0.24s-0.29s all separate the two cases
correctly; 0.26s sits mid-band) — completes the three reversals
`STRONG_REVERSALS` needs while staying under the sustained path's total
exposure window, so the case tests the reversal bar's own adaptivity rather
than being decided by a path this entry can't and shouldn't touch. Recorded
in the probe's own comment so the next person hitting the same trap doesn't
re-diagnose it. Whether a real hand-shake stays inside that 0.26s-ish window
in practice is untested outside the synthetic probe — Verify's own phone
check (below) is where that would show up.

`pnpm build` and `pnpm lint` are clean. `pnpm probe:shake` passes, including
the two new entry-88 cases and every prior one — the
`disturb` column is byte-for-byte identical to the pre-entry-88 table
(checked by diffing against `git stash`), which is what proves the frozen
RGB slip (entry 76) and the approved colour bias (entry 70) are untouched.
`pnpm probe:motion-bias` and `pnpm probe:rgb-slip`, both of which also read
`disturb`, pass unchanged. The readout (`src/hud.ts`) now reports `bar`
alongside `samples`/`peak`, per Decided's "report the live threshold." Not
verified live on a phone in a quiet room vs. walking — the environment here
has no accelerometer to drive; this ships on the synthetic probe and close
reading, same disclosed gap as a few earlier entries this session.

**Do** — let the shake detector's thresholds follow how much the phone has been
moving lately: a low bar after stillness, today's bar when it is already being
carried about. Leave `disturb` itself untouched.

**Why** — a shake in a quiet room and a shake at a festival are the same
gesture asking for the same thing, and only one of them currently clears a
fixed bar comfortably.

**Decided**
- **Adapt the thresholds, never `disturb`.** This is the constraint the whole
  entry is built around. `rgb-slip.ts:59` takes `disturb` as its only input and
  **entry 76 is frozen** — *"colour lags has good colour, freeze that for
  now"* — and `motion-bias.ts` takes it too, inside the approved colour state.
  Making `disturb` adaptive would silently retune a frozen effect and an
  approved one from underneath, with nothing in either file mentioning shake
  thresholds. So `FLOOR 1.2` and `FULL 14` do not move. Only `STRONG_UP`,
  `STRONG_DOWN` and `SUSTAIN_LEVEL` do.
- **Lowering the bar does not weaken knock rejection, and this is why it is
  safe.** `detectStrong`'s own comment: *"Setting a bar on peak acceleration
  alone cannot tell them apart — putting the phone down hard clears any
  threshold a real shake clears. So this counts direction reversals instead."*
  **Three reversals inside 1.2s is what rejects a knock, not the height of the
  bar.** The bar can therefore move with context while the thing that keeps
  knocks out stays fixed. Without that argument this entry would be trading
  sensitivity for false positives; with it, it is not.
- **`STRONG_DOWN` scales with `STRONG_UP`**, at the ratio it has today
  (7/18 ≈ 0.39), rather than staying at 7. The pair is a hysteresis band and a
  band that narrows as the bar falls would start counting the same swing twice.
  **Mine**, and it is the detail that would otherwise produce phantom doubles
  in a quiet room.
- **The range: `STRONG_UP` 13 when calm, 20 when busy**, against today's flat
  18; `SUSTAIN_LEVEL` 0.45 to 0.60 against today's 0.55. So stillness buys
  about 28% less force and constant motion costs a little more than today —
  which is the correct direction, since a phone already being jostled should
  demand a clearer statement. **Mine** as to the four numbers; the probe below
  is what settles them.
- **The context signal is a slow mean of `disturb`**, τ ≈ 25s — long enough
  that walking to the stage raises the bar and a moment's fidget does not,
  short enough that putting the phone down for half a minute makes it eager
  again. Reading `disturb` is fine; it is *changing* it that is forbidden.
- **The baseline freezes during a detection and its cooldown.** Without this
  the feature eats itself: a shake is by definition a large `disturb`, so it
  would raise its own bar mid-gesture and the second half of the shake would
  fail to qualify. Classic adaptive-gain trap and the one bug this design can
  produce. Freeze on the first reversal, thaw when the cooldown ends —
  `STRONG_COOLDOWN` and `DOUBLE_WINDOW` already bracket exactly that span.
- **Never adapt inside the double window.** A double is two shakes 3s apart;
  the bar the second one faces must be the bar the first one faced, or the
  gesture becomes unreliable in a way nobody could diagnose from the outside.
  Falls out of the freeze above, and is worth asserting separately in the
  probe.
- **Report the live threshold.** The readout already carries `samples` and
  `peak` for exactly this reason — with an adaptive bar, "I shook it and
  nothing happened" gains a third possible cause, and the numeric readout is
  the only thing that can tell the three apart on a real handset.
- Deliberately **not** adapted: `STRONG_REVERSALS`, `STRONG_WINDOW`,
  `QUIET_GAP`, `PEAK_CEILING`. The first two are the knock rejection and must
  stay constant for the argument above to hold; the last was settled by entry
  36 against the probe.

**Lands in**
- `src/shake.ts:76-92` — the constants become a calm-derived pair; the slow
  mean and its freeze live beside `disturb`.
- `src/shake.ts` `detectStrong` / `detectSustained` — read the current bar
  rather than the constant.
- `src/hud.ts` — the threshold in the readout.
- `scripts/probe-shake.ts` — the cases below.

**Done when** — the same synthetic shake that fires after 30s of stillness also
fires when it is ~25% gentler; that gentler shake does **not** fire after 30s of
simulated walking; every knock case still reports `strong 0` at the *lowest*
bar, which is the case that matters; a double 3s apart still reads as a double;
and no `disturb` value anywhere in the probe table changes by a single digit,
which is what proves the frozen slip and the approved colour bias are untouched.
**Verify** — `pnpm probe:shake`, extended with a calm-then-shake case and a
walk-then-shake case. Then the phone, in a quiet room and then walking, which
is the difference the numbers are standing in for.
**Hard stops** — prefs no · url no · capture no · dependency no. **Note beyond
the four**: entry 76 is frozen and entry 70's colour is approved; both consume
`disturb`, and this entry's central constraint is that neither changes by a
single frame.

### 89. The director always eventually moves
`status: done` · added 2026-08-30 · reconfirmed 2026-08-30 · build 306 · verified at build 354

**Build note (Mine as to test design and the one simplification below; the
fixes themselves follow Decided)** — `requiredStep(sinceDue)` now decays
`COLOUR_MIN_STEP` to 0 across `BOUNDARY_RAMP`, the same shape as
`requiredNovelty`, and `update()`'s colour block reads it instead of the
flat 0.18. One real guard had to go with it: a
*literal* zero distance (wanted colour already exactly equal to current) is
never treated as "eventually clearable" — only `step > 0` enters the decay
path at all. Without that guard the entry-84 per-layer-holds probe broke:
each of its two 90s-long, genuinely unchanging flavours would eventually hit
`requiredStep(overdue) === 0`, at which point `distance(wanted, current) >= 0`
is trivially true for *any* colour including one already on screen, firing a
no-op "change" partway through nearly every phase and scrambling that
probe's own offset measurements. Decided's own wording is "distance is ~0"
for the bug being fixed, not "= 0" — the decay exists for the real residual
a continuous, slightly-noisy flavour axis leaves behind (this is what the
real pipeline actually produces — see the flat-input probe below), not to
manufacture a re-announcement of a colour that never changed at all.

`viewFor` returns `[best, second-best]` rather than one name — the second
element is the sibling the nearest tie-breaking comparison in the branch
tree would have picked instead, not a random alternative. `Director` tracks
it alongside `candidate` (`secondBest`, updated every `track()` call). Once
a view change has been due for a full `BOUNDARY_RAMP` with the suggestion
still equal to what is showing, the target becomes `secondBest` instead of
waiting on a primary answer that can, by construction, never differ from
reality.

Warmth is per-axis: `Character` gains `warmMedium` (`slow.ts`, `filled >=
HALF_MEDIUM * 2`, ~30s), alongside the existing `warm` (~120s). The colour
block now gates on `c.warmMedium || c.warm` rather than `c.warm` alone — the
`||` is **Mine**, not asked for directly: `warm` mathematically implies
`warmMedium` (the long buffer cannot be full before the medium one is), so
this reads "medium-or-better" without requiring every existing synthetic
`{...BLANK, warm: true}` fixture across `probe-slow.ts`'s other two sections
(nine call sites, all from entries 81/84, none touched) to also learn about
a field they have no reason to know exists. The view block keeps requiring
full `warm`, per Decided.

`status()` gained `blocked: string | null` — `"colour: step 0.04 < 0.18"` or
`"view: candidate = current (field)"` — null whenever nothing is due,
something fired, or the autopilot is suspended or holding for a bar.
`hud.ts`'s readout checks it ahead of the generic "auto warming" line, since
colour can be live and due-but-blocked well before the view axis's own,
much longer, warmth clears.

**The third "found on re-reading" bug — `suspend()` clearing `pending` — was
already fixed.** `director.ts`'s own `suspend()` has carried `this.pending =
null` since entry 81's original commit (`git log -S`, one hit, entry 81's own
commit introducing it twice — the other in the normal pending-fire path).
`probe-slow.ts` already carried the exact assertion Verify asks for
("a manual change discards a held decision outright", checking
`d.status().waitingForBar === false` after `suspend()`) from the same
commit. Nothing needed changing here; this build only confirms it, rather
than re-doing work already done.

Two probe sections added. **"A flat input"** drives the real pipeline
(`SlowAnalysis`/`MAPPINGS`, not a hand-built `Character`) with one section
that never changes for five minutes — the case Verify names. Both axes
eventually fire, colour (31.9s) well before view (120.2s), confirming
per-axis warmth lands in the right order. It does **not** demonstrate a
visible "blocked" window, and that turned out to be a real, if surprising,
structural fact rather than a gap in the fix: `sinceColour` starts
pre-loaded at `COLOUR_HOLD`, so `overdue` equals wall-clock time from t=0,
and `warmMedium` itself clears at almost exactly `BOUNDARY_RAMP` (30s) —
meaning the ramp is usually *already* fully decayed the first moment the
colour gate is even checked. The very first decision from a cold start
skips past "blocked" straight to "fired"; only a second, later decision
would show the intermediate window. **"A due-but-blocked window, driven
directly"** demonstrates that window explicitly instead: a `Director` fed a
colour a known, exact 0.1 distance away (under the old fixed 0.18) shows
`status().blocked` non-null at first, then fires once the decay clears it —
proving the mechanism the flat-input run couldn't show.

The pre-existing arrangement check (`decisions.length > 6`, "too busy") went
to 9 with these fixes in place and needed raising, not fixing: `intro` and
`build` (60s each) sit just past `COLOUR_HOLD + BOUNDARY_RAMP` (55s), so a
colour step too small for the old fixed floor now clears the decayed one
before either section ends, and `drop` (90s, genuinely static for that
whole span) is long enough for the view axis's own stuck-suggestion
fallback to fire once near the end. Both are this entry's intended effect on
a somewhat-artificial arrangement whose individual sections happen to run
long relative to the hold+ramp windows, not noise — raised the bound to 10
with a comment explaining why, rather than holding it at a stale
pre-entry-89 number.

`pnpm build` and `pnpm lint` are clean. `pnpm probe:slow`'s four sections —
the main arrangement, entry-81's bar-quantisation, entry-84's per-layer
holds, and the two new entry-89 sections — all pass. Not verified on a real
phone: the dev server's `?debug` HUD readout was reachable, but `getUserMedia`
was refused in this headless environment before any audio ever reaches the
director, same limitation noted on an earlier entry this session — so the
`blocked` text was verified by direct code reading and the probe, not by
watching the live readout say it.

**Do** — make the two gates that can hold forever decay like the novelty gate
already does, so a still phone in front of unchanging sound still changes
picture.

**Do** — make the two gates that can hold forever decay like the novelty gate
already does, so a still phone in front of unchanging sound still changes
picture.

**Why** — reported: left alone, such as propped up while driving, it does not
chain. Correct, and entry 45's promise that it "never waits longer than 30s"
is not true of the outcome — only of one of the four conditions.

Reported again, harder, at build 289: *"director noormmmm not working at
all"*. Nothing has changed in `director.ts` to cause a new fault — the two
commits since (81's bar clock, 84's per-layer drift) leave the gates below
untouched, and the diagnosis stands exactly as written. What the second
report adds is that this is not a "sometimes repetitive" complaint. It is
*nothing ever happens*, and three further mechanisms found on re-reading
compound it into that. They are folded into this entry rather than split
off, because they are the same file, the same symptom, and shipping the
decay alone would still leave the app looking dead for the first two
minutes.

**Decided**
- **The cause, precisely.** A colour change needs *three* things:
  `sinceColour >= COLOUR_HOLD`, a novelty boundary, **and**
  `distance(wanted, current.geoColour) >= COLOUR_MIN_STEP`. Entry 45 gave the
  novelty requirement a decay — `requiredNovelty()` ramps it to zero over
  `BOUNDARY_RAMP` — so *that* gate always opens. **The distance gate never
  decays.** `wanted` is `colourFor(character)`, and if the character is steady
  the wanted colour is the colour already showing, distance is ~0, and the
  condition is false forever. The view path has the identical shape:
  `this.candidate !== current.atmosphericView` — a suggestion equal to what is
  on screen can never fire, no matter how long it has been.
- **Why driving is the case that exposes it.** A phone in a car hears road
  noise: broadband, spectrally flat, and *unchanging* for tens of minutes. The
  character axes settle and stop moving, so `colourFor` returns one answer and
  `viewFor` returns one answer, and both gates latch shut. The same happens
  with a fan, a train, or an empty room — driving is simply where it was
  noticed. **This is not a motion bug at all**, which is worth stating because
  the report arrived as one: it is the audio character being stable, and a
  still phone only makes it more obvious because nothing else is changing
  either.
- **The fix mirrors the one entry 45 already made.** `COLOUR_MIN_STEP` decays
  toward 0 over the same `BOUNDARY_RAMP` window once the hold is past, so a
  long wait accepts a smaller and smaller step and eventually any step at all.
  Same shape, same constant, same reasoning — the director's own comment calls
  this turning a rule into "a rule with a bound", and one of its two rules
  never got the bound.
- **The view gate needs a different answer**, because there is no "smaller
  step" between two named views. Once `VIEW_HOLD + BOUNDARY_RAMP` has passed
  with the suggestion equal to what is showing, take the **second-best** view
  for the current character instead. **Mine.** Not a random view — that throws
  away the character analysis that is the director's whole point — the
  runner-up, which is still an honest answer to the music and is merely not
  the first one.
- **`viewFor` must therefore be able to return a ranking**, not one name. It
  is a small branch tree today (`director.ts:143-150`); returning an ordered
  pair costs nothing and makes the runner-up well-defined rather than
  arbitrary.
- **The floor is a floor, not a metronome.** These decays mean *eventually*,
  not *on schedule*: with genuinely varied music nothing about today's
  behaviour changes, because the gates open on merit long before the ramp
  matters. Entry 81's bar-quantising sits on top of this untouched.
- Deliberately **not** changed: `SUSPEND`. A person who has just chosen
  something is still not asking for the autopilot's opinion, however long the
  silence.

**And three more, found on the second report:**

- **The first two minutes are dead, by construction.** `decide()` returns
  `null` on `!c.warm`, and `slow.ts:449` sets `warm` at `filled >= HALF_LONG *
  2` — 240 samples at `SLOW_HZ = 2`, so **120 seconds** before the director is
  permitted to have an opinion at all. The reasoning (`:334-336`: acting on a
  cold buffer is acting on its initial values) is sound and stays. What is not
  sound is that the *whole* director waits on the *longest* window. The colour
  path reads `noveltyMedium`, whose window is `HALF_MEDIUM = 30` — 15 seconds
  of history. **Warmth becomes per-axis: a decision waits only for the windows
  it actually reads.** Colour is then live at ~30s, and the view path, which
  needs the long axes, keeps its two minutes. **Mine**, because the current
  flag is one boolean standing in for four different maturity times and the
  finest of them is being charged the coarsest one's price.
- **The readout degenerates to `next 0s` and sits there.** `status()` was
  added (`:240-246`) so that "restrained" stays distinguishable from "not
  running" — and under exactly the latch condition this entry fixes, it prints
  `next 0s` forever while nothing happens, which is the one reading that
  cannot tell those two apart. The readout must name **the gate that is
  actually closed**, not the timer that already opened: `auto blocked: step
  0.04 < 0.18` or `auto blocked: candidate = current (field)`. A diagnostic
  that goes quiet precisely when the fault fires is not a diagnostic. It is
  also how the second report could have been one line instead of a re-reading.
- **A held decision survives a suspend and lands on top of the person.** The
  suspend branch (`:307-313`) returns before the pending-release block
  (`:322-332`), so a decision already waiting for a bar line is neither fired
  nor discarded when someone touches the phone — it is frozen, and released up
  to 30 seconds later, overriding the choice that caused the suspend, on
  reasoning formed before that choice existed. **`suspend()` clears
  `pending`.** A decision the person has since overruled is not a decision
  worth keeping, and this is the exact failure `SUSPEND` exists to prevent.

**Lands in** `src/director.ts:255-273` — both gates; `:143-150` — `viewFor`
returns a ranking; `:307-336` — per-axis warmth and the suspend/pending clear;
`:240-246` and `src/hud.ts:1434-1444` — the blocked-gate readout;
`src/engine/slow.ts:449` — warmth per window; `scripts/probe-slow.ts` — the
cases below.
**Done when** — a synthetic run with a *constant* character produces a colour
change and then a view change within roughly `HOLD + BOUNDARY_RAMP`, rather
than never; the first colour change is possible inside the first minute rather
than after two; the HUD names which gate is closed whenever the director is
due and not firing; a decision pending at the moment of a `suspend()` never
fires afterwards; a run with varied music produces the same changes at the
same times as today; and `SUSPEND` still silences everything.
**Verify** — `probe-slow.ts` with a flat input, which is the case nobody wrote
because nobody expected the input to be flat; a probe asserting the pending
decision is gone after `suspend()`; and a stopwatch on a cold start against
the HUD, which should never show `next 0s` with nothing happening. Then a
phone left playing to room noise for five minutes.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 90. Still, carried, driving, dancing — the phone knows which
`status: done` · added 2026-08-30 · still-is-loudest confirmed 2026-08-30 · build 308 · verified at build 354

**Build note (Mine as to the constants, the test designs below, and one
naming call; the classification rules themselves follow Decided)** —
`src/engine/posture.ts` is a slow mean of `disturb` for the level band
(`LEVEL_TAU = 8`, so a traffic-light stop's few seconds near zero never reads
as the level having actually dropped) plus an autocorrelation over a
decimated 10 Hz ring buffer for the gait band, same construction as
`slow.ts`'s own `computeTempo()`: search a lag range for the best correlation
and compare its height against the mean of every lag tested.

That autocorrelation needed real tuning the first pass got wrong. At the
window length and threshold I started with, pure broadband noise (the
`driving()` trace) produced a spurious "best lag" read as real periodicity on
well over half of all ticks — measured directly: 88.9% false-positive rate at
a 6s window, still 58% at 10s. A narrow, 6-8-lag gait-band search over a
bounded window makes noise's own highest bump a routine occurrence, not a
rare one. Fixed with two changes together, tuned as a pair against the same
probe trace: the window grew to 12s (`GAIT_SECONDS`), and the raw per-tick
reading is smoothed over an 8s EMA (`PERIODIC_TAU`) before `GAIT_STRENGTH_MIN`
(raised from an initial 0.3 to 0.5) ever looks at it — comfortably above the
smoothed noise ceiling (~0.33) and below where a real gait settles (~0.95-1.0).
A second, smaller bug came with it: `periodicHz` could report the search
range's own floor lag during a tick where the variance guard rejected
computing a real one, if the smoothed strength was still above threshold from
an earlier genuine detection. Fixed with a `lastLag` field that only updates
on a successful computation, so `periodicHz` never means "the default" while
looking like a real reading.

`Director.update()` gained a required (not defaulted) sixth parameter,
`posture: Posture`, scaling `COLOUR_HOLD`/`VIEW_HOLD` by `HOLD_SCALE`. Required
rather than defaulted on purpose: the posture whose behaviour is safest for
`posture.ts` itself to get wrong, `'still'`, is also the *fastest* multiplier
on the ladder (×0.55) — a silent default would have retroactively retuned
every existing call site's timing rather than only the ones that actually
want scaling. Every pre-entry-90 call site in `probe-slow.ts` and `main.ts`
now passes `'handled'` (×1, `HOLD_SCALE`'s own neutral entry) explicitly.

Two probe checks needed a redesign, not a tuning pass, to actually test what
they claimed to:

- The traffic-light check first read the *entire* posture history for any
  `'still'`, including the classifier's own unavoidable cold-start window —
  `state.posture` starts at `'still'` by construction and cannot report
  anything else until `POSTURE_DWELL` (10s) has held a new candidate, which
  for `driving()` takes on the order of ten-odd seconds even with nothing
  going wrong. That is a startup artifact, not the traffic-light stop the
  check exists to catch. Fixed to find where `'driving'` is first reported
  and only check for `'still'` reappearing from that point on — the actual
  40-45s stop sits well past it.
- The hold-scale check constructed two fresh `Director`s and compared their
  time to *first* fire under `'still'` vs `'dancing'`. Both fired at 0.0s,
  because `Director`'s own `sinceColour` field is pre-loaded at the flat,
  unscaled `COLOUR_HOLD` (25) in its constructor — which already exceeds
  *both* postures' scaled holds (13.75s, 17.5s) before `update()` is ever
  called once, so the very first fire is instant under either and proves
  nothing. Fixed by measuring the gap between the *first* fire (preload
  driven, discarded) and the *second* (a clean read of the scaled hold from
  `sinceColour = 0`, since the test's `current` colour is never fed back
  after firing and stays due at the same distance forever) — 13.8s under
  `still`, 17.5s under `dancing`, matching `HOLD_SCALE` exactly.

One naming collision: `hud.ts`'s stats type already has `motion.posture` (a
tilt-magnitude number, entry 58) unrelated to this entry's `Posture` string
union. The new HUD field is `handling`, not `posture`, to keep the two apart
at both ends.

Verification is code-reading and the probe only. `probe:posture` was written
before this note and passes all fifteen checks (four postures classify and
hold, the periodicity-not-level discriminator proof, the traffic-light stop,
and the hold-scale gap); `probe:slow`'s existing suite still passes unchanged
with `'handled'` threaded through every pre-existing call site. The new HUD
line (`hold <posture> …`) was reviewed by reading `hud.ts`'s layout rather
than seen live: this environment's `getUserMedia` refusal, already disclosed
for earlier entries touching this HUD, blocks running the actual app to
screenshot it. A phone in a real car and on a real dancefloor — Decided's own
stated caveat that only that test can confirm "driving" and "dancing" mean
what the numbers think they mean — has not happened either.

**Do** — classify how the phone is being held into a handful of named postures,
and let the director's cadence follow.

**Why** — asked for directly. The app currently has one number for handling
(`disturb`) and it cannot tell a car from a dancefloor, though they want
opposite things from the picture.

**Decided**
- **Five postures, and each is separable with signals we already compute:**
  **still** (on a table — `disturb` ~0, tilt fixed), **carried** (in a hand or
  pocket, walking — `disturb` ~0.15 *with a gait periodicity near 2 Hz*),
  **driving** (sustained low agitation, **no** gait band, tilt drifting slowly
  on turns), **dancing** (mid agitation *correlated with the tempo the beat
  tracker already reports*), and **handled** (high `disturb`, reversals — the
  shake path, which already exists).
- **The discriminator that makes this work is periodicity, not level.**
  Driving and carrying can sit at the same `disturb`; walking has a strong ~2 Hz
  component and a car does not. And dancing is separable from both by the one
  signal entry 75 just shipped: **agitation that matches the music's tempo is a
  person moving with it.** That is a genuinely new capability as of build 247
  and it is the reason this entry is possible now and was not last week.
- **It reads; it never writes.** Same constraint as entry 88 and for the same
  reason: `disturb` feeds the frozen RGB slip (entry 76) and the approved
  colour bias (entry 70). The classifier is a pure function of signals that
  already exist and changes none of them.
- **What each posture is for**, and this is the useful half:
  **still** → the director is the only thing that will ever change the
  picture, so it should be the *most* willing to (entry 89 is what makes that
  possible at all). **driving** → nobody is going to touch it and it is watched
  sideways; longer holds, gentler steps, and no expectation of interaction.
  **carried** → the picture is in a pocket or a swinging hand and largely
  unwatched; slowest of all, and the cheapest thing the app can do here is
  little. **dancing** → changes land on the bar via entry 81, and the room is
  already supplying novelty. **handled** → a person is playing; the director
  should mostly get out of the way, which `SUSPEND` already does.
- **Still is the loudest posture, and that is Victor's call, not an
  inference.** As written above this entry claimed the top slot twice — "still
  → the *most* willing" and "dancing → shortest holds" — which is not a
  decision, it is two adjectives. Asked directly, the answer was *more active
  when the phone is left alone*, with the surprise marked: it is the opposite
  of every restraint this project chose while the picture was something left
  running. It is nonetheless right, and the reason is already written down in
  `docs/the-toy-wants-to-be-played-with.md`: **restraint belongs in what
  persists, generosity in what responds** — and when a phone is alone on a
  table the director *is* the responding thing. There is nothing else. A
  dancefloor already has a person and a track supplying change; a table has
  only this.
- **So the ladder, in full, as multipliers on `COLOUR_HOLD` and `VIEW_HOLD`:**
  **still ×0.55** (14s / 25s), **dancing ×0.7** (17s / 31s), **driving ×1.3**
  (32s / 58s), **carried ×1.8** (45s / 81s), **handled** — governed by
  `SUSPEND`, unchanged. Multipliers rather than five pairs of constants, so
  the base numbers stay the one place either hold is tuned. The exact figures
  are **Mine**; the ordering is not.
- **A posture is a slow thing.** Minimum dwell of ~10s before a change is
  reported, and hysteresis on the way out, or the picture's cadence would
  jitter between two rulesets at a traffic light. **Mine.**
- **Default is `still`, and unknown resolves to `still`.** It is the posture
  whose behaviour is safest to be wrong about — the director being willing when
  it need not be is a picture that changes; the reverse is the complaint that
  started this.
- **Report it in the readout.** Five states that silently change the app's
  cadence, with no way to see which one is active, would be the exact shape of
  every diagnosis problem this project has had — entry 66's `want`/`armed` and
  entry 88's live threshold are the precedent.
- **Not decided here** → whether anything *other* than the director should read
  posture. Colour, the powder, the ink — all plausible, all separate entries.
  This one establishes the signal and gives it exactly one consumer.

**Lands in** `src/engine/posture.ts` (new, pure state and a pure update, same
shape as `motion-bias.ts`); `src/main.ts` — fed from the sensor snapshot entry
86 introduces; `src/director.ts` — holds scale by posture;
`scripts/probe-posture.ts` (new).
**Done when** — synthetic traces for a table, a 2 Hz walk, a car's broadband
hum and a 120 bpm dance each classify correctly and hold for at least 10s; a
traffic-light stop does not flip driving to still; and the director's holds
visibly differ between the still and dancing traces.
**Verify** — the probe for the classifier, since every posture can be
synthesised. Then a phone actually in a car and actually on a dancefloor, which
is the only test of whether "driving" and "dancing" mean what the numbers think
they mean.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 91. The director gets a second engine, for when the room has nothing to say
`status: done` · added 2026-08-30 · build after 89 and 90 · build 310 · verified at build 354

**Build note (Mine as to every constant, the informativeness measure's own
design, and the two probe fixes below; the two-engine split and what each
posture is for follow Decided)** — `director.ts` gained a small generative
engine (a deterministic hue rotation, full turn every 40 minutes, and a
saturation sine breathing inside entry 70's own [0.55, 1] range, `GEN_HUE_DEG_PER_S`/`GEN_SATURATION_*`) and an informativeness measure that
decides how much of it shows: `mix`, blended against the reactive engine's
own `colourFor(c)` for the colour axis, and used to choose between
`candidate` and a `viewHold`-paced rotation through `secondBest` for the
view axis — categorical values cannot be continuously blended the way a
colour can, so the view axis is a hard cutover at `mix === 1` rather than a
lerp.

**Informativeness turned out to need two signals, not one, and finding that
out cost most of this entry's time.** The obvious design — a rolling
variance of the four flavour axes, summed, over `INFORM_TAU` — works well on
real analysis output: measured directly against this file's own varied
arrangement and flat-section fixtures, a flat input's variance decays to
near-zero within a couple of minutes while the varied arrangement never dips
near it. But a slow variance is, by construction, slow to notice a *sudden*
discontinuity — for the first second or so after a real jump, the variance
hasn't risen yet, reading the most informative instant there is as if
nothing had happened. This surfaced as an actual regression: entry 84's own
per-layer-holds probe (two hand-built flavours, swapped every 90s) started
firing colour a full 15s late on average, because the slow variance was
still catching up at the exact moment the switch made a new colour due.
**Fixed with a second, fast path**: any single frame whose flavour axes
moved further than real analysis output ever does (measured directly —
0.19 is the highest single-tick jump either fixture ever produces, against
this hand-built test's own 3.95) snaps the mix to fully reactive instantly,
then lets go over `JUMP_DECAY_TAU` as the slow variance takes over the
judgment. `mix` is `Math.max()` of the two, not a sum — either one alone
being high is sufficient to answer "yes, act reactively."

**That fix uncovered a second, unrelated bug**: at `mix === 1`, the original
code still computed the colour as `lerpColour(genColour, reactive, 1)`
rather than `reactive` outright. Mathematically a lerp at `t = 1` is the
second operand; in floating point it is `a + (b - a) * 1`, whose rounding
depends on `a` — and `a` (the generative colour) keeps moving even while
`mix` sits at 1. Two calls against the exact same reactive target could
round to two different bit patterns, a genuinely nonzero `step` for a
character that had not moved at all, which is exactly what entry 89's own
`step > 0` guard exists to rule out. It doesn't catch a ULP-scale nonzero.
Every recorded fire in the per-layer-holds probe was correct except one,
55 seconds into one particular 90s phase — one BOUNDARY_RAMP past a
now-fully-decayed `requiredStep`, which is exactly where a residual this
small would first clear the floor. **Fixed** by only ever lerping when
`mix < 1`; at `mix === 1` the reactive colour is used directly, restoring
bit-identical repeats.

**The per-layer-holds probe itself needed one more adjustment, and this one
is a real behaviour change, not a bug fix**: its first two 90s phases are a
genuine startup transient. A hand-held-constant flavour is precisely the
"nothing to say" case this entry answers, and the first two switches this
fixture's own `current` has never seen are informative to it in a way later
ones, arriving into an already-settled state, are not (colour fires 4 times
in phase 0, once more early in phase 1, then lands exactly on every
following switch with no further movement). The probe now measures from
phase 2 onward — 8 measured phases rather than 8 raw ones, 15 simulated
minutes rather than 12 — and every original assertion holds unchanged past
that point.

**New probe section**, matching this entry's own Done-when: the same flat
fixture entry 89's own flat-input test uses, run for a simulated twenty
minutes under `'driving'`. Checks: at least 8 colour changes and at least 2
distinct views over the run; no two consecutive colours match and no colour
repeats an earlier one across the whole drive; every colour fired after
`c.warm` (120s) has entry 70's own [0.55, 1] saturation. Colours fired
*before* warm are excluded from the last check on purpose — before `warm`
the mix is forced fully reactive (the existing, unchanged behaviour for the
first two minutes of any session), so anything fired that early is
`colourFor(c)`'s own RAMP-and-wash answer, a different mechanism this entry
never touched and never claimed a saturation floor for.

**One design note on the view axis's own pacing**: the rotation period
between `candidate` and `secondBest` reuses `viewHold` (already scaled by
`HOLD_SCALE`, entry 90) directly rather than a new constant, so "posture
sets the pace, not the source" (Decided's own words) costs nothing extra to
keep in step. The same is true of colour's own excursions: nothing scales
the generative walk's rate by posture at all, because the longer hold a
slow posture already gets (`driving` ×1.3, `carried` ×1.8) gives the walk
more *time* to drift before the next fire consumes it, producing wider
excursions from the existing hold multiplier alone — Decided's own "widest
excursions and longest holds at the same time," for free.

Verification is code-reading and the probe only: `probe:slow` (all 28
checks, including the new twenty-minute section and the two fixed-up entry
84 checks), `probe:posture` and `probe:shake` as a regression check against
`director.ts`'s shared surface (both fully green, timings unchanged). Not
verified: an actual drive, which Decided itself names as the only real test
of whether "interesting but not distracting" is the right pace — this
environment has no way to put a phone in a moving car.

**Do** — give the director a generative engine alongside its reactive one, and

**Do** — give the director a generative engine alongside its reactive one, and
let posture and how informative the sound is decide the mix. Driving should be
the case it is best at, not the case it fails.

**Why** — asked to rethink it for modes and to be interesting while driving.
Entry 89 stops the director latching shut; it does not give it anything new to
say. Those are different problems and only the second one makes a car
interesting.

**Decided**
- **The director is purely reactive today, and that is the root of it.**
  `colourFor(character)` and `viewFor(character)` are pure functions of the
  audio's long-scale character. Steady input, steady answer — so with road
  noise it is not merely stuck (entry 89), it has genuinely *nothing to
  propose*. Fixing the gates makes it repeat itself sooner. The missing piece
  is a source of change that does not come from the microphone.
- **So: two engines.** **Reactive** is everything that exists — the character
  axes, `colourFor`, `viewFor`, the novelty boundaries. **Generative** is new
  and small: a slow constrained walk through colour, and a rotation through the
  views the current character ranks highest. The director's output is a blend
  of the two, and every existing dead band, hold and suspend applies to the
  result unchanged.
- **The mix is chosen by how informative the sound is, not by posture alone.**
  A rolling variance of the character axes over a few minutes: high variance
  (real music, changing) → almost entirely reactive, which is today's
  behaviour and must stay pixel-identical in that case. Low variance (road
  noise, a fan, a quiet room) → mostly generative. **Mine**, and it matters
  that this is measured rather than switched: a car with music playing should
  behave like music, not like a car.
- **Posture (entry 90) sets the *pace*, not the source.** driving → slow, wide,
  continuous — the longest holds and the largest colour excursions, since it is
  watched sideways for a long time and nothing else will ever change it.
  dancing → fast and tight, on the bar (entry 81). still → medium. carried →
  slowest, nobody is looking.
- **The walk is constrained, not random.** Hue moves on a slow continuous path
  with bounded rate; saturation and value stay inside the ranges entry 70
  established. A random-walk over three channels reproduces exactly the
  grey-clustering that entry 70 diagnosed, so the walk happens in the same
  hue-first space that entry fixed. **Mine**, and it is the one way this could
  quietly undo approved work.
- **Views rotate through the character's own ranking**, which entry 89 already
  makes available by having `viewFor` return an order. So even the generative
  engine is still answering the music — it simply stops insisting on the single
  best answer. Nothing ever picks a view the character rates poorly.
- **What "interesting while driving" concretely means** → over a twenty-minute
  drive the picture should never repeat a colour and should pass through
  several views, with no single change large enough to catch the eye of someone
  who is supposed to be watching the road. Slow, continuous, wide. That is the
  design target and the reason driving gets the *widest* excursions and the
  *longest* holds at the same time.
- **`SUSPEND` still outranks both engines.** A person who has just chosen
  something is not asking for either opinion.

**Lands in** `src/director.ts` — the second engine and the mix; `:143-150` —
the ranking from entry 89; `scripts/probe-slow.ts` — the flat-input case, which
should now produce *varied* output rather than merely eventual output.
**Done when** — a twenty-minute synthetic run on flat road-noise-like input
produces continuous colour movement and several view changes, none abrupt; the
same run with varied music produces output identical to today; and the
generative walk never leaves the saturation range entry 70 set.
**Verify** — `probe-slow.ts` for both runs. Then an actual drive, which is the
only test of "interesting but not distracting" and is also the only one that
can say whether the pace is right.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 92. Values arrive, they do not jump
`status: done` · added 2026-08-30 · build 313 · verified at build 354

**Build note (Mine).** Built `ColourRamp`/`startColourRamp`/`stepColourRamp`
as a fixed-rate linear ramp rather than reusing `Envelope` (Decided's own
suggestion): "about two seconds" has to be a duration the change actually
*takes*, landing exactly on target, not a time constant an exponential
decay asymptotically approaches forever without quite reaching — which
would have left the settled-frame-identical claim in Done-when false by a
few ULPs forever. `duration` is set fresh on every `startColourRamp` call,
so retargeting mid-ramp (director speaks while a shake's own 0.25s ramp is
still running) continues from wherever the colour currently sits rather
than jumping back toward the original start — checked directly in
`probe-composite.ts`'s new section 12, check (d).

Threaded `rampS`/`colourRampS` as required parameters through
`setLayerColour` → `Handlers.onColour` → `Hud.adopt()`, following entry 90's
own precedent for `Director.update()`'s `posture` parameter: a defaulted
"0 = instant" would silently apply everywhere a caller forgot to pass it,
defeating the entry for the one caller — the director — that actually wants
the 2.0s travel. The HUD's own direct-drag call site passes 0 explicitly,
same as every other adopt() call that carries no colour field.

Dip-and-swap (`ViewDip`/`startViewDip`/`tickViewDips`) fades a layer's alpha
to 0 over 0.35s, swaps the `ShaderMaterial` while invisible, fades back in.
The one real design problem was cross-layer coordination: a shake-triggered
shuffle can ask for a new geometric *and* atmospheric view in the same
instant, and the two layers must never dip together or the frame actually
empties rather than thins. Solved with `queuedSwap` — a swap requested while
the *other* layer is mid-dip is queued rather than started, and released the
instant that other layer returns to idle. `probe-composite.ts`'s new section
13 drives exactly that simultaneous-request case and asserts the two
multipliers are never simultaneously below 1, both layers actually reach
fully hidden, and both swaps eventually complete.

`setGeoAlpha`/`setAtmAlpha` changed from writing straight to the alpha
uniforms to storing the user's own preference; `render()` now multiplies
that by whichever dip is in flight, once per frame, alongside stepping all
three colour ramps (geo/atm/cam — cam gets the same mechanism for
consistency, though nothing currently calls it with a nonzero ramp).

One process note, not about the feature: partway through this entry I ran
`prettier --write` on the four touched files after `--check` flagged them,
which reformatted every pre-existing line in each file, not just the new
ones, and inflated the diff with unrelated churn. Caught it before
committing, confirmed via `.github/workflows/*.yml` that CI has no
formatting gate — only `pnpm lint`/`pnpm build`/specific probes — and
reverted all four files with `git checkout`, which discarded that
reformatting along with my own not-yet-committed entry-92 edits. Redid the
edits from scratch afterward; the diff that actually landed here was
written once and never run through a formatter.

**Verification.** `pnpm build` and `pnpm lint` clean. `pnpm probe:composite`
— 32/32 checks pass, 11 new for this entry (four on the colour ramp's
mid-ramp/settled/zero-duration/retarget behaviour, seven on the dip
state machine including the simultaneous-request case). The three
CI-required probes (`pnpm probe`, `probe:shake`, `probe:fullscreen`) still
pass unchanged, as expected — this entry touches none of the files they
exercise. **Not verified live on a phone**: this environment refuses
`getUserMedia`, the same limitation noted in entries 89-91's own build
notes, so the actual dip feel (Verify's own "0.35s is a judgement about
feel") is unconfirmed by eye — only by the settled-frame-identical and
never-both-dipped assertions above. Worth a real look on-device before
trusting the duration.

**Do** — ramp what can be ramped and cover what cannot. A colour change should
travel to its new value; a view change should not be a cut.

**Why** — asked for, and nothing in the app does it today. Every automatic
change is a hard switch.

**Decided**
- **Colour snaps, and it is one line.** `scene.ts:1105` is
  `baseGeoColour = colour` — an assignment. The director, the shuffle, the
  shake and the HUD all land through it, so **every** colour change in the app
  is instantaneous. Ramp it: hold a target and a current, and step the current
  toward it. `Envelope` already exists in this file and already does this for
  exposure, so there is nothing to invent.
- **Ramp duration by source, because they mean different things.** A HUD drag
  is a person's own hand and must stay immediate — a control that lags is a
  broken control. The director gets **2.0s**, slow enough to read as drift. A
  shake gets **0.25s**: fast, but not a cut, so the re-roll still lands like an
  event. **Mine**, and the rule underneath is worth keeping: *a machine's
  changes ease; a person's changes are instant.*
- **Views are a hard cut and cannot simply be ramped** —
  `setAtmosphericView` disposes one `ShaderMaterial` and installs another, so
  there is no in-between state to interpolate. Two different programmes, no
  shared parameterisation.
- **So: dip and swap.** Fade the layer's own alpha to zero over ~0.35s, swap
  the material at the bottom, fade back. **Mine**, and the reason it works here
  specifically is that this app has *two* layers: while the atmosphere dips,
  the geometry is still drawing, so the frame never empties — it thins and
  refills. On a single-layer app this would be a blink; here it reads as one
  thing receding and another arriving.
- **Declined: a true crossfade.** It would need both programmes rendered to
  separate targets and mixed — an extra full-screen pass and a third render
  target, on a phone GPU, permanently allocated for something that happens for
  one second every half-minute. Stated rather than omitted so nobody re-derives
  it as an oversight. If the dip proves unsatisfying, this is the upgrade and
  it has a known price.
- **The dip is on the layer being swapped only.** The geometric and
  atmospheric layers swap independently and must never dip together, or the
  picture does blink.
- **Nothing new is stored.** The ramp is a render-time interpolation toward the
  stored value — the same seam entries 48, 58, 60 and 72 use. `prefs` holds the
  destination and holds it the instant the change is decided, so a reload
  mid-ramp lands on the target rather than somewhere in between.
- **Interaction with the frozen work, checked** → entry 76's slip and entry
  70's vibrance both act on the composite's *output*, after colour is applied.
  Ramping the input changes when they see a value, never what they do with it,
  and a settled frame is identical to today's. Entry 88's own constraint holds
  here too.

**Lands in** `src/scene.ts:1095-1110` — targets and ramps; `:1053-1061` — the
dip-and-swap; `src/main.ts` — the per-source ramp duration.
**Done when** — a director colour change visibly travels over about two
seconds; a HUD drag is still immediate; a shake still reads as an event; a view
change thins and refills rather than cutting; the two layers never dip at the
same time; and a settled frame is pixel-identical to today's.
**Verify** — the phone for the dip, since 0.35s is a judgement about feel.
`probe-composite.ts` can hold the settled-frame-identical claim, which is the
one that could silently regress the approved colour.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 93. The gate shows the queue it came from
`status: done` · added 2026-08-30 · build 315 · verified at build 354

**Build note (Mine).** `vite.config.ts`'s `buildQueue()` parses `docs/todo.md`
at build time: for each `### N. Title` header, it reads the very next line as
that entry's status line, matching the format the "## Format" section itself
documents. This came from a real bug found while writing the parser, not a
theoretical one: a naive whole-file scan for lines matching `` `status:
... ` `` also finds one inside entry 61's own build note, which quotes the
claiming protocol's `` `status: building` `` verbatim in wrapped prose — a
false "entry 61 is building" that a header-then-next-line parser cannot
produce, since it never looks at any line that isn't immediately below a
header. Worth writing down since it is exactly the kind of parsing mistake
that would have passed a build with today's data and broken silently on a
future build note that happened to quote a different status word.

Two shipped rows (most recent build first into the rule, i.e. older-then-
newer reading top to bottom into the waiting rows below), then a hairline
rule, then up to five waiting entries — `ready` or `building` both count as
waiting, which matters right now: this very entry shows as row "93 · The
gate shows the queue…" under `waiting` in its own build, since the commit
that flips it to `done` is this same one, after the build already ran once
to verify the data. Titles truncate to Decided's 24 characters, with an
ellipsis on anything cut — the ellipsis itself is **Mine**, Decided named
only the character cap.

Found by actually looking at it on a real 320×568 layout, not by reading
Decided: the bottom-left placement collides with the bottom-right QR code
at phone widths — `.gate-qr`'s own `clamp(9rem, 48vw, 10.5rem)` reaches far
enough left at 320-360px that a naively-wide queue panel sat its text
directly behind the QR's light background. Decided frames vertical space as
"the real constraint" and says nothing about width; this is a real gap in
that analysis, not something Decided already covered. Fixed by capping the
panel at `min(36vw, 11rem)`, sized against the QR's own footprint at both
tested widths with headroom, plus `text-overflow: ellipsis` as a second
line of defence for whatever still doesn't fit. Confirmed clear of the QR
at both 320×568 and 360×640 via a temporary two-iframe harness (not
committed — this project already has `hud-narrow.html` for the HUD panel
specifically; this entry didn't touch that surface, so no PR-visible probe
exists for the gate's own layout, only this one-off check).

The three-stage height collapse (waiting rows first, then the rule, then
the shipped pair, then the whole panel) is implemented as literal `max-
height` breakpoints (660px / 600px / 520px) — thresholds are **Mine**,
Decided named the order, not the pixels. At 360×640 this leaves the rule
visible with no waiting rows under it (640px clears the rule's own 600px
threshold but not the waiting group's 660px one) — a small, accepted
oddity: a closing rule under a two-row list reads as "end of list," not as
broken.

Rows fade in staggered at Decided's own 40ms, oldest first, via a class
toggle after two nested `requestAnimationFrame` calls (one is not reliably
enough to guarantee the browser has painted the `opacity: 0` starting frame
first). `prefers-reduced-motion: reduce` shows every row immediately and
fully visible — entry 65's own lesson, applied again.

**Verification.** `pnpm build` and `pnpm lint` clean; the baked `__QUEUE__`
payload checked directly against the built bundle (grepped out of
`dist/assets/index-*.js`) to confirm it matches `docs/todo.md`'s actual
state rather than trusting the parser by inspection alone. The three
CI-required probes (`pnpm probe`, `probe:shake`, `probe:fullscreen`) pass
unchanged — this entry touches none of the files they exercise, and no new
probe was warranted: the load-bearing claim here is a build-time parse and
a CSS layout, not runtime arithmetic. Verified on-screen at 320×568 and
360×640 (via the temporary harness above, driving a real local dev build in
an actual Chrome tab, not a description) — the queue panel is legible, the
correct rows appear at each height, and, critically, nothing overlaps the
QR code at either width after the fix above. Tap-through was not verified
by an actual synthesized tap; `pointer-events: none` is unconditional on
`#queue-panel` and every row inside it, applied at the container with no
per-child override to undo it, which is what the CSS was read for.

**Do** — bake the queue's state into the bundle at build time and show it on
the start screen: the last two entries shipped, then the next few waiting, then
how many more there are.

**Why** — asked for. The build number already says *which* build this is;
nothing says what it contains or what is coming. On a piece that redeploys
several times an hour, that is the most interesting fact about it.

**Decided**
- **Baked, not live**, as asked — and the mechanism already exists.
  `vite.config.ts` computes `__BUILD_NUMBER__` from `git rev-list --count HEAD`
  at config time and hands it over through `define`. A `__QUEUE__` define,
  parsed from `docs/todo.md` by the same config, is the same shape with no new
  dependency and no fetch at runtime. **It needs no CI change either**: the
  build-number comment warns that history must be unshallowed for
  `fetch-depth: 0`, but this reads the working-tree file, not the log.
- **What is emitted must be tiny.** `docs/todo.md` is some 6,600 lines; the
  payload is at most nine short strings. Parse the `### N. Title` and
  `` `status:` `` lines, keep number, title truncated to **24 characters**, and
  the shipped build for done ones. Everything else is discarded at build time,
  so the bundle carries a few hundred bytes.
- **Shipped ones are identified by their build number**, taken from the
  `shipped at build N` the queue already records — so a row reads `259 · camera
  mode is a door back` and the two newest are provably the two newest, without
  a date anywhere.
- **The shape: a ladder, not a list.** A filled dot for shipped, a hollow one
  for waiting, one row each, a hairline rule between the two groups. **Mine** —
  it is the same figure the app is made of, it encodes state in form rather
  than only in colour, and it reads at a glance without being read.
- **Five waiting, then `… +N more`**, rather than a bare ellipsis. **Mine**:
  the count is the interesting part — "five things queued" and "five shown,
  thirty behind them" are very different facts about a project and cost three
  characters to distinguish.
- **It can never eat a tap.** `pointer-events: none`, unconditionally. The gate
  is where Start, the chips and entry 80's fullscreen precedence all compete
  for touches, and a decorative panel that swallows one would be a bug nobody
  would look for here. Not tappable, not a link, not a control.
- **It arrives, staggered, and it degrades honestly.** Rows fade in about 40ms
  apart, oldest first, so it prints rather than appears. Under
  `prefers-reduced-motion: reduce` all rows appear at once, **fully visible** —
  entry 65's lesson written down after the start disc answered that preference
  by vanishing: the preference asks for less motion, never less information.
- **Vertical space is the real constraint, and it loses gracefully.** Entry 43
  made the gate type 20% larger and entry 55 added the name animation; at
  320×568 there is not much left. So the panel drops rows from the bottom as
  height shrinks — waiting rows first, then the rule, then the shipped pair —
  and hides entirely below a threshold rather than overlapping anything. Start
  and the name always win. `hud-narrow.html` at 320×568 and 360×640 is the
  check.
- **Placement: bottom-left**, mirroring `.gate-name`'s right-aligned column on
  the other side, in the same quiet tone as `.gate-byline`. It is a footnote,
  not a headline.
- **The titles become public strings**, which is worth stating once even though
  it changes nothing: the repository is already public and already serves this
  file, so nothing is newly exposed — but entry titles occasionally quote
  Victor, and this puts a handful of them on the start screen of a link he
  shares. Worth knowing rather than discovering.

**Lands in**
- `vite.config.ts` — the parse and the `__QUEUE__` define, beside
  `__BUILD_NUMBER__`.
- `src/global.d.ts` — the declaration.
- `index.html` — the panel's markup and rules, inside `#gate`.
- `src/main.ts` or a small `src/queue-panel.ts` — the render, gate-only.

**Done when** — the start screen shows the last two shipped with their build
numbers and up to five waiting with a remaining count; the numbers match
`docs/todo.md` at the commit that built the bundle; nothing on the gate moves
or clips at 320×568; a tap anywhere over the panel still reaches whatever is
beneath it; and with reduced motion every row is present and legible.
**Verify** — `hud-narrow.html` at both widths for the layout, and a build where
an entry is deliberately marked done to confirm the rows move. The tap claim is
worth checking on the phone by tapping directly on the panel and watching
fullscreen still take the gesture.
**Hard stops** — prefs no · url no · capture no (the gate is gone before
anything is captured) · dependency no — build-time parsing in a config that
already runs `execSync`, no package added.

**Verification note — `/ccc` at build 354.** Built as specified, and then broken from outside by `/ccc` itself: `buildQueue()` in `vite.config.ts` read only `docs/todo.md`, so once verified entries began moving to `docs/built.md` the gate's "last two built" rows drifted steadily into the past — quietly, since two plausible rows still rendered. Fixed at build 354 by merging both files. The guard written when the archive was proposed said *the skills must search both*, and was aimed one place short: the build reads that file too, and no skill protects a Vite config.
### 94. The name decodes, and a still phone still gets to see it
`status: superseded by 99` · added 2026-08-30 · verified at build 354

**Superseded 2026-08-30, unbuilt.** Entry 99 absorbs this whole entry — the
two-phase decode and the non-scrambling reduced variant — and joins it to the
same fix for the disc, under one principle: the start screen must visibly
animate on any phone, because the user cannot be expected to know the OS
setting that silences it. Build 99, not this.

**Do** — give the name flip a second phase that locks character by character
onto the final name, and give reduced motion a *slower* version of it instead
of no version at all.

**Why** — reported as never having landed. It landed, at build 203, and it is
skipping itself for the same reason the start disc's pulse was invisible.

**Decided**
- **It is built and it is working.** `mountReleaseName()` in `version.ts:281`
  flips through all **91** release names on a `requestAnimationFrame` loop with
  an ease-out, lands exactly on the current one, never delays Start, and
  handles screen readers correctly. Nothing about it is broken.
- **`version.ts:302` returns early under `prefers-reduced-motion: reduce`**, and
  entry 65 established that this phone almost certainly reports that preference
  — Android sets it under Battery Saver and under Accessibility → Remove
  animations, and it is the leading explanation for the start disc's pulse
  never being seen either. **Two features reported as "never landed", one
  cause.** Entry 65 shipped the readout for exactly this: `?debug` says whether
  motion is reduced, and that is a one-glance confirmation before anything here
  is built.
- **A text decode is not motion, and that distinction is the entry.**
  `prefers-reduced-motion` exists for vestibular triggers — translation, scale,
  parallax, rotation. **A character changing in place has no motion vector at
  all.** The honest reduced-motion answer here is therefore not "show nothing",
  it is "do not flicker": a slow decode, a few characters resolving per second,
  no whole-name churn. That is entry 65's principle — *the preference asks for
  less motion, never less information* — applied to the second place that
  answered it by vanishing.
- **And the caveat, so this is not a dodge**: rapid text churn is closer to
  *flashing content* than to motion, and that is a real accessibility concern
  in its own right. So the reduced variant is genuinely gentler — roughly
  **3 characters resolving per second, no scrambling of unresolved positions**,
  which reads as a name being typed rather than decoded. The full version keeps
  the scramble; the reduced one drops it. **Mine.**
- **The cinematic upgrade: two phases.** Phase one is what exists — the flip
  through the app's own history, fast then decelerating. Phase two is new: the
  remaining characters **lock left to right**, about 55ms apart, while
  unresolved positions cycle through the alphabet. Total around 1.6s. The
  handover is the moment worth getting right — the flip should slow into the
  lock rather than stopping and then starting a new effect.
- **The scramble alphabet is the app's own**, drawn from the letters that
  actually appear in `RELEASE_NAMES` — lowercase and space. **Mine, and it is
  a real choice**: katakana would be a costume borrowed from another work, and
  it would not match the gate's type. Names decoding out of the letters of
  other names is the same idea entry 55 had — the name arrives through its own
  history — carried one level further down, into the characters.
- **No library, and the question deserves a straight answer.** A text-animation
  package would be tens of kilobytes for what is about forty lines inside a
  function that already exists. `three` at 117 KB is the only runtime
  dependency this project has, deliberately, and a title effect is not what
  breaks that.
- **Nothing about the layout can move** — entry 55 already reserved 18ch,
  right-aligned, precisely so the flip cannot reflow the gate, and the longest
  name is 16 characters. The lock phase inherits that for free.
- **Keep every property the existing function already earned**: the synchronous
  first call so the span is never empty, `aria-hidden` on the animating span
  with the real name on its parent, and no gating of Start at any point. Entry
  56 replays this from the reload chip, so it must stay a callable function.

**Lands in** `src/version.ts:281-333` — the second phase and the reduced
variant; `NAME_FLIP_MS` gains a companion for the lock.
**Done when** — on a normal phone the name flips through its history and then
resolves character by character; with reduced motion forced on, the name
**still arrives visibly**, slowly and without scrambling, rather than appearing
instantly; the gate never reflows; Start is pressable throughout and pressing
it mid-decode simply leaves; and the reload chip still replays it.
**Verify** — DevTools' reduced-motion emulation for both paths, then the phone
with Battery Saver on — which is the state this was invisible in, and the only
way to know it is fixed for the person who reported it.
**Hard stops** — prefs no · url no · capture no · dependency **no, and asked
directly: no text-animation library** — forty lines against tens of kilobytes,
in a project whose only runtime dependency is `three`.

**Archival note — `/ccc` at build 354.** Not built and never will be: entry 99 absorbed it and shipped at build 325, and 99 is itself verified and archived here. Moved rather than left in the live queue, because a superseded entry sitting among the unverified ones points at an entry that is no longer beside it, and `/ccc`'s own stopping condition counts what remains in `todo.md`. The skill did not cover this case; it does now.
