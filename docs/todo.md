# To-do

A capture buffer, so an idea can be caught and made buildable without stopping
whatever is being built right now.

This is deliberately *not* the GitHub issue queue. `spec-to-issue` and
`auto-issue-gogo` are the heavyweight path: a full spec, labels, a branch per
issue, an autonomous loop. That path is right when work is going to be handed to
an agent unattended. This file is right when an idea arrives mid-flight and the
only thing that matters is that it is written down in a state somebody can pick
up cold. An entry here can graduate to an issue later; nothing here has to.

## The rule

**An entry is ready when someone with no memory of the conversation can build it
without making a single judgement call you could have made for them.**

Entries do not fail by being short. They fail by containing an unresolved fork,
and the builder's guess is worse than its question. In a visual project almost
every interesting fork is a taste question wearing a technical costume — "should
the arc ease out or grow linearly" reads as implementation and is not.

Add entries with `/aaa <idea>`. It decides everything it can defend and asks
only about hard stops and genuine taste forks, so most ideas cost one answer or
none. Calls it made itself are marked **Mine** with a reason, which is what
makes them overturnable later without re-deriving them. Writing an entry by
hand is fine too; the format is below.

## Format

```markdown
### N. Title
`status: ready` · added YYYY-MM-DD

**Do** — one sentence, imperative.
**Why** — one sentence. The problem, not the solution.

**Decided** — every fork, what it was chosen *over*, and whose call it was.
- Question → chosen, over rejected.
- Question → chosen, over rejected. **Mine**, because reason.

**Lands in** — files, with line numbers where they are known.
**Done when** — an observable outcome, not "it works".
**Verify** — the gates, plus the on-screen check this project always wants.
**Hard stops** — all four answered. Any "yes" needs the user's approval quoted
in Decided, and without it the status is `blocked`, not `ready`.
```

`status:` is one of `ready`, `building`, `blocked` (needs a decision — say
which), or `done` (leave it, with the build number that shipped it).

Two things belong on the `status:` line beyond the status itself:

- **Build order**, when an entry only makes sense after another — `build after
  88`, `build before 90–92`. Entries are claimed in the order somebody reads
  them, not the order they were written, and a dependency living only in
  somebody's head gets built backwards.
- **What was left out**, when an entry ships partially — `the expansion-curve
  envelope is deliberately incomplete — see build note`. CLAUDE.md's *Shipping
  part of an entry* requires the follow-up entry to exist before the parent is
  marked `done`; this clause is what makes the omission visible without reading
  git.

## Claiming an entry

**Whoever starts building an entry sets it to `building` first, in its own
commit, before touching any other file.** Two agents work this file: one
captures entries, one builds them, and they share a checkout. `building` is how
each knows what the other is holding.

```markdown
`status: building` · added YYYY-MM-DD · started YYYY-MM-DD
```

Three rules follow from it:

- **A `building` entry is not to be edited by anyone else** — not amended, not
  superseded, not re-scoped. An entry rewritten under a builder mid-flight is
  how both halves end up wrong; it has already been avoided once by leaving
  entry 33 alone as a single emitter while entry 49 was written around it.
- **A capture session may still append entries that supersede a `building`
  one**, and should say so in the new entry rather than editing the old. The
  claim protects the text, not the idea.
- **Set it back to `ready` if the work is abandoned**, with a line saying what
  was learned. A `building` entry nobody is building is worse than a `ready`
  one, because it stops anybody else picking it up.

The status moves `ready` → `building` → `done` in the same commit as the work
it names, so the build number and the status never disagree.

## Entries

### 40. The buzz has never been tested apart from the shake
`status: blocked` · added 2026-08-30 · abandoned 2026-08-30

**Blocked on:** a phone that vibrates for anything at all. Not on this repo.

**Outcome, 2026-08-30 — browser vibration is given up on for now, Victor's
call.** The ladder was built and run on the phone, and **every rung failed,
including a flat 600 ms pulse and three continuous seconds**. Both are far
beyond anything the app sends, so this repo was never the cause, and the
system-level checks that follow from that — Do Not Disturb, silent mode, the
haptic level, battery saver, Chrome's site settings — did not recover it
either. The instrument did its job: it moved the question out of the app in
one tap and kept it out.

What that retires: entry 1's whole line of work — 22 ms, then 40 ms, then the
primed two-pulse pattern at build 68 — was tuning a signal against a phone
that was not going to produce one. **Do not reopen it, do not tune the
patterns again, and do not treat a silent shake as evidence about
`CONFIRM_PATTERN`.** If vibration is ever revisited, the ladder is the first
thing to run and its verdict is the gate.

Nothing has to be removed for this. `haptics.ts` opens by stating that the
Vibration API "is a bonus on one platform, absent on the other, and nothing
may be built to depend on it", and that promise is exactly what makes
abandoning it free: the code is silent where it is unsupported, costs nothing
when it does not fire, and no feature is waiting on it.

The consequence worth knowing: **a shake now has no confirmation at all.**
`flashShake()` is gated on the numeric readout being visible, so in ordinary
use the only evidence a shake registered is the picture changing — which is
the exact ambiguity `haptics.ts` was written to resolve, since "the picture
was already moving, and it changes to a different picture that is also
moving". Entry 1 anticipated this for iOS and said the entry would then become
"replace the haptic with something visual". That is now the open question on
Android too, and it wants its own entry rather than a note here.

**Do** — land the haptic ladder in the repo as `haptics-probe.html`, beside
`hud-probe.html` and `camera-probe.html`: a rung per pattern, coarsest first,
each firing `navigator.vibrate` from a real tap and reporting what it returned.
**Why** — a weekend of not feeling anything cannot currently distinguish "the
motor never moved" from "the shake was never detected", and those have nothing
in common.

**Decided**
- The two faults are indistinguishable from inside the app → the buzz only
  ever fires as a consequence of a detected shake, so a silent phone is
  evidence about the *pair*. Every haptics change so far — 22ms, then 40ms,
  then the primed pattern at build 68 — has been aimed at the buzz on the
  assumption the shake was fine. That assumption has never been tested, and it
  is free to test: a button is a user gesture, and a user gesture is all
  `vibrate()` needs.
- The ladder, coarsest first → **600ms flat, 300ms flat, the old bare `[40]`,
  `CONFIRM_PATTERN`, `CONFIRM_PATTERN` at MAX_SCALE, `DOUBLE_PATTERN`,
  `DOUBLE_PATTERN` at MAX_SCALE.** **Mine.** The top rung is far beyond
  anything the app sends, so failing it proves the fault is the phone or a
  system setting and not this repo — which is the single most valuable thing
  the page can establish, and it establishes it in one tap.
- Show the boolean → `vibrate()` returns false when the browser declines, and
  `haptics.ts` already counts `attempts`/`accepted`/`suppressed` for exactly
  this reason. Print the return beside each rung. A page of buttons that all
  return true while nothing is felt is a *different* finding from one where
  the calls are being declined, and the two want opposite next steps.
- The patterns are imported, not retyped → `CONFIRM_PATTERN` and
  `DOUBLE_PATTERN` are module-private in `haptics.ts` today. Export them for
  the probe rather than copying the numbers in, because a probe that tests
  last month's constants is worse than no probe. `MAX_SCALE` is already
  exported.
- What already exists and does **not** need building → `hapticStatus()` is
  wired: `main.ts:874` feeds it to the HUD and `hud.ts:189` has a field for
  it, so a `?debug` load already shows why there was or wasn't a buzz. **Check
  that line before writing any code for this entry** — if it says attempts are
  being made and accepted while a shake is being felt as nothing, the ladder
  will confirm the pattern is the fault; if attempts are zero, the shake never
  arrived and no haptics change can help.
- A published copy exists already and is not a substitute → the ladder was
  published as an artifact so it could be opened on the phone the same
  evening, without a dev server or a deploy. That URL is not in version
  control, does not track the constants, and cannot be run by anyone who does
  not have the link. This entry is what makes it survive.
- Not reachable from the app → a dev page like its two neighbours, so the
  circular control surface constraint does not apply and it may use plain
  buttons.

**Lands in**
- `haptics-probe.html` — new, at the repo root beside the other probe pages.
- `src/haptics.ts` — export `CONFIRM_PATTERN` and `DOUBLE_PATTERN`.

**Done when** — opening the page on the phone and working down it identifies
the first rung that can be felt, or shows that none can while every call
returns true. Either outcome names the next change; today neither is
available.
**Verify** — the phone, which is the only instrument that can answer this;
`pnpm probe:haptics` must still pass, since exporting the patterns must not
alter them. Also `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 71. The sky gets a noon and a night, and the override swings both ways
`status: done` · added 2026-08-30 · shipped at build 238 · build with or after 68

**Build note** — `sky.ts`'s single four-anchor table split into two:
`DAYLIGHT_ANCHORS` (six: 04:00/0.0, 06:30/0.35, 10:30/1.0, 15:30/1.0,
19:30/0.4, 23:00/0.0 — two pairs at equal value holding the night floor and
day plateau flat, the two original dawn/dusk anchors unmoved carrying the
transitions) and `WARMTH_ANCHORS` (the original four, untouched). Both
interpolated by one shared `interpolate()` generic over an anchor list,
rather than two copies of the wrap-and-segment-search logic.

**Honest finding, not silently corrected**: the entry's own Decided text
estimates the resulting mid-band at "~2.5 hours at each end of the day"
(~5 total). Measured directly (`probe:sky`, reproducible with the one-line
scrub the entry's own Verify credits): each transition is 4.6-5.3 hours,
~9.95 total — roughly double the estimate. The anchor *hours and values*
are the entry's own explicit "Mine as to the hours" choice and are exactly
what is implemented; the "~5" reads as an eyeballed guess at what those
anchors would produce, not re-derived from them. Implemented the anchors
as specified and recorded the true measured number in the probe and here,
rather than either quietly shipping a wrong comment or re-tuning anchor
hours the entry itself claimed as a deliberate choice. The qualitative
point — day and night are states held for hours, not instants touched
once — holds regardless: 9.95 hours of transition against 14.05 held is
still a real fix for a curve that spent 16 of 24 hours in between.

`scene.ts`: `overrideTarget`/`overrideCurrent` now range -1..1 (was 0..1);
the existing min/max chase logic needed no change, since it already moves
toward a target from either side. `uDay` splits into two branches at the
sign of `overrideCurrent` — `skyDaylight + (1-skyDaylight)*overrideCurrent`
for day-ward (unchanged from before), `skyDaylight*(1+overrideCurrent)`
for night-ward — both collapsing to plain `skyDaylight` at 0. New
`skyDaylightSample`/`skyDaylight` split: the sample updates once a second
as before, but `skyDaylight` (what `uDay` actually reads) chases it at
`SKY_CHASE_RATE = 1/3` (full-scale over ~3s) every frame, so a DST jump or
a tab resumed hours later fades rather than snapping. Warmth is not
chased — a secondary tint, and the entry's own finding was specifically
about `uDay`.

`prefs.ts` gained `skyOverride: 'auto'|'day'|'night'`, exported as
`SkyOverride`. `day: boolean` stays exactly as it was — read, written,
untouched in shape or meaning — with a new one-way migration: a valid
stored `skyOverride` always wins; absent that, a stored `day: true`
migrates in as `'day'`; `day` itself is never rewritten by this. Verified
live (not just by reading the code) against the real `loadPrefs()`: an
old-shaped stored value (`day: true`, no `skyOverride`) reads back as
`skyOverride: 'day'` with `day` still `true`; a modern stored value
(`skyOverride: 'night'`, `day: true`) reads back `'night'` — the newer
field wins over the older one exactly as specified, not merely by absence
of a bug in the one case that was easy to picture.

`hud.ts`'s day chip cycles `auto → day → night → auto` on tap, relabelling
itself each time (`'Sky: auto'`/`'Outdoor'`/`'Night'`) since `aria-pressed`
alone can no longer distinguish pinned-day from pinned-night. `prefs.day`
is no longer written by this chip at all — entry 71 supersedes it with
`prefs.skyOverride`, matching the entry's own "the old field is left in
place" for entry 69's process-lapse lesson applied deliberately this time,
not by oversight. Verified live: three taps against the real, mounted
`createHud()` (via `hud-probe.html`, not a stub) produced exactly
`onSkyOverride` calls `['day'], ['night'], ['auto']` in order, with the
chip's own `aria-label`/`aria-pressed` matching at every step.

`scripts/probe-sky.ts` rewritten for the two-table split: anchors checked
separately, new plateau/floor checks (sampled throughout each window, not
only at its labelled edge), the mid-band check restated with the true
measured ceiling (see the honest finding above) rather than the entry's
own estimate, and the steepest-transition-point check recomputed for the
new 06:30-10:30 dawn segment (~08:30, not the old curve's ~09:45). All
twenty checks pass.

Not verified live: the override fade's and the chase's own real-time
dynamics (the ~1.2s and ~3s durations) — `render()` computes its own `dt`
internally from wall-clock time with no way to inject a controlled value
from outside, and this harness's timers are independently unpredictable
(established in earlier entries this session). What was verified instead:
override *seeding* at construction (`stats().sky.override` reads exactly
0/1/-1 for `'auto'`/`'day'`/`'night'`, checked against a real, freshly
constructed `Visualiser` via direct module import — not a stub), and the
chase/fade formulas by code review, since both are simple, previously-
shipped patterns this entry only widens rather than replaces. The
`~10:30/15:30/23:00/04:00`-are-the-right-hours question is, per the
entry's own Verify line, only ever answerable on a phone across an actual
evening — not attempted here.

**Do** — reshape the sky's anchors so the day has a plateau and the night has a
floor, make the chip cycle auto → day → night instead of only pinning day, and
smooth the clock's own jumps.

**Why** — reviewed as asked. The mechanism is sound and well-made: a pure
function of the clock, four anchors smoothstepped on a wrapped circle, sampled
once a second, one 1.2s override fade, probe-covered, and the geolocation
refusal in `sky.ts`'s header is the right call made for the right reason. The
findings are about the *shape* of the curve and one missing direction, not the
machinery.

**Decided**
- **Scrubbed the actual curve** (`skyFor` over 24 hours — reproducible with
  one node line). Daylight touches 1.0 at 13:00 *exactly* and 0.0 at 02:00
  *exactly*; it sits in the 0.3-0.8 mid-band from about 06:00 to 22:00 —
  **sixteen hours of neither-day-nor-night**. Four anchors smoothstepped
  pairwise cannot produce a plateau: every anchor is a peak or a valley, so
  "day" is an instant, not a state.
- **Why that matters doubles once entry 68 lands.** 68's own dawn analysis
  identifies mid-`uDay` as the least readable zone — ink and paper converging —
  and mandates the ink leading the paper through dawn so the *crossover* is
  brief. But with these anchors the crossover is not dawn: it is **the entire
  morning, evening, and most of the afternoon**. A curve tuned when day mode
  was a chip nobody left on becomes the resident state of the picture the
  moment the clock drives it.
- **So: six anchors, holding the ends** → night 0.0 from 23:00 to 04:00, day
  1.0 from 10:30 to 15:30, with the existing warm dawn/dusk anchors carrying
  the transitions between them. The mid-band becomes ~2.5 hours at each end
  of the day instead of sixteen. Warmth keeps its four-point shape — warm at
  both ends, coolest in the small hours — since that part is right and was the
  original entry's whole point. **Mine** as to the hours; the principle (day
  and night are *states*, transitions are *events*) is the review's finding.
- **The override only goes one way, and the missing direction is the common
  case.** `uDay = skyDaylight + (1 − skyDaylight) × override` can force day at
  night — but nothing can force night at noon. A phone in a dark bedroom, a
  cinema, a bar at 2pm: the clock says full day, the picture is a lit sheet of
  paper, and there is no way back. The asymmetry is an accident of entry 47's
  chip ("Outdoor") predating the clock, not a decision anyone made.
- **So the chip cycles: auto → day → night → auto.** Same chip, same place,
  labelled by what it is currently doing. Night is a second override mixing
  toward 0 exactly as day mixes toward 1, through the same
  `DAY_OVERRIDE_FADE_S`. **Mine** as to the shape — a cycle on one chip over
  two chips, because the circular surface is the non-negotiable and a second
  chip spends scarce arc on the same concept.
- **Hard Stop, answered:** `prefs.day` is a stored boolean and its meaning must
  not change. **A new field** `skyOverride: 'auto' | 'day' | 'night'` is added
  (the safe half of the rule); `day: true` is read once as `'day'` for
  migration and the old field is left in place, exactly the shape `gravity`'s
  own addition followed. A stored `day: true` therefore behaves identically
  before and after.
- **The clock can snap; the override fade never covers it.** `skyDaylight` is
  assigned directly from `skyFor(new Date())` once a second — a DST jump, a
  timezone change in flight, or a tab resumed hours later lands as a one-frame
  step in `uDay`, and the 1.2s fade smooths only the *chip's* transitions.
  Chase the sampled value at a bounded rate (full-scale over ~3s) instead of
  assigning it. Three lines, and the once-a-second cadence stops being visible
  at the boundary between samples on a long dawn as well.
- **Warmth at night is dead weight, and stays dead** → the ground is scaled by
  `uDay`, so the "coolest in the small hours" anchor value is multiplied by
  zero all night. Reviewed and left alone deliberately: tinting the night
  picture from the clock would repaint the palette entries 58 and 70 own, and
  the anchor is still worth keeping correct for the hours where it shows.
- Not touched → the geolocation refusal, the 1-second sample, the pure-function
  boundary, and `probe-sky.ts`'s role as the scrubber. All right as they are.

**Lands in**
- `src/sky.ts` — the `ANCHORS` table grows to six for daylight; warmth keeps
  its four.
- `src/scene.ts:555-570, 904-925` — the night override joins the day one; the
  chased `skyDaylight`.
- `src/hud.ts:906` — the chip cycles and says which state it is in.
- `src/prefs.ts` — `skyOverride` added beside `day`, with the migration read.
- `scripts/probe-sky.ts` — the plateau (10:30-15:30 ≥ 0.999, 23:00-04:00
  ≤ 0.001) and the mid-band's total width.

**Done when** — a full-day scrub shows real night until 04:00, real day from
10:30, and no more than ~5 of 24 hours between 0.1 and 0.9; the chip reaches
night-at-noon in two taps and back to auto in one more; a DST-sized clock jump
takes ~3s on screen rather than one frame; and a stored `day: true` from before
the change still lands in forced day.
**Verify** — `probe-sky.ts` for the curve and the migration; the phone across
an actual evening for whether 10:30/15:30/23:00/04:00 are the right hours,
which a probe cannot answer and the original anchors' own comment ("settled by
eye") already concedes.
**Hard stops** — prefs **yes — a new field only**, `skyOverride`, with
`day: true` migrated on read and never rewritten; the existing field's type and
meaning are untouched · url no · capture no · dependency no.

### 74. Paper: true white, true black, and ink that takes or doesn't
`status: blocked` · added 2026-08-30 · build after 68

**Blocked 2026-08-30 — needs Victor's decision, and must not be built
meanwhile.** Entries 68 and 70 shipped (builds 229 and 234) and the result was
approved: *"both ways has good colours, finally, don't break it."* This entry
is the **only** pending work that touches the constants that approval is about
— it would move `PAPER` 0.88 → 0.97, `INK` 0.10 → 0.03 and add a
`pow(density, 0.7)` curve, in a composite that now lays ink in HSL with warmth
at ±0.10.

The decision needed is not "is paper a good idea" — it was asked for
explicitly, and the body below still holds. It is **whether whiter paper and
blacker ink are wanted now that the shipped middle looks right**, since those
are the same numbers being praised and the entry was written before anyone had
seen them working.

Do not build this on inference from the original request. It needs one look at
the two side by side, and the honest possibility is that the answer is no and
this entry is closed unbuilt.

**Do** — take entry 68's ink model and push it to actual paper: a white ground,
near-black marks, and a density curve so thin marks read as ink rather than as
grey.

**Why** — asked for directly, and it goes further than entry 68's numbers.
68 is being built now with a 0.88 ground and 0.10 ink, which were **Mine** and
are hereby overridden: Victor wants paper, and paper is white.

**Decided**
- **This does not touch entry 68**, which is `building`. Everything here is a
  change of values and one curve on the mechanism 68 ships. Build 68, then
  this. Nothing in 68's design is being revisited — the density/colour split,
  the ink leading the paper through dawn, and the `(1 − uCameraMix)` retirement
  all carry over exactly.
- **Ground 0.97, ink 0.03.** A range of 0.94 against night's ~1.0, where the
  measured original was 0.15. **Not pure 1.0/0.0**: a ground at exactly 1.0
  cannot show a highlight and clips anything the vibrance stage (entry 70)
  lifts, and ink at exactly 0.0 loses the hue that entry 68's colour split
  exists to preserve. Three percent at each end is the difference between
  paper and a clipped scan.
- **Ink takes or it doesn't** → `density = pow(density, 0.7)` before it is
  laid. Real ink is not linear: a mark is either on the page or the page is
  bare, and the interesting part is how quickly it commits. The plain linear
  density leaves every thin mark as mid-grey, which is exactly the "anaemic"
  reading in a paper palette. **Mine**, and 0.7 is a starting point the
  acceptance floor below can move.
- **The paper is warm, not blue-white.** Entry 53's `uSky.y` already carries
  warmth and entry 71 keeps it; at 0.97 it should read as cream at dawn and
  dusk and near-neutral at noon. Real paper is warm and a blue-white ground is
  the thing that makes a screen look like a screen. Entry 68 widened the tint
  to ±0.10 for the same reason and that value stands.
- **Camera off only**, as asked, and it is already true: 68 scales the whole
  ground by `(1 − uCameraMix)`, so a real room is never papered over. Restated
  here because "when camera off" is in the request and a builder should not
  have to go and check.
- **The floors move with the values.** 68 asks for ≥70% of night's tonal range
  and saturation; with a 0.94 range available that becomes **≥85% of the range**
  and the saturation floor stays at 70%, since ink laid on white desaturates
  mid-densities no matter how it is done and demanding parity there would be
  demanding something the model cannot give.

**Lands in**
- `src/shaders/composite.frag.glsl` — the two constants 68 introduces, plus the
  density curve.
- `scripts/probe-composite.ts` — the raised range floor.

**Done when** — day mode with the camera off is white paper with near-black
marks; a coloured layer reads as coloured ink rather than grey; contrast
measures ≥ 85% of the same scene at night; a warm hour gives cream rather than
blue-white; and passthrough at any non-zero mix is unaffected.
**Verify** — the same measurement entry 68 established, on the same four views,
plus a phone in real daylight. The number to watch is `p5`: it should sit near
0.03, where the original frames could not go below 0.606.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 107. Does the gate say what kiyo is aware of?
`status: blocked` · added 2026-08-31 · the remainder of 97, reopened under the new rule

**Do** — nothing yet. This is a question for Victor, raised because entry 97
shipped without the gate copy it asked for and `CLAUDE.md`'s amended Hard Stop
3 now says a conflict like that becomes a proposal rather than a silent no.

**Why** — entry 97 (build 321) asked the gate to name that the app uses the
phone's location for the sun and the moon. It was not built: the standing rule
said the gate carries no copy about capture or privacy at all, and the build
agent read that as louder than one entry's narrower ask. **That call was
right.** What was wrong is that it ended there — disclosed in a commit nobody
was scheduled to read, with the entry marked `done`.

**The question**
> The gate currently says nothing about what the app senses. Since entries 96,
> 97 and 100 it senses the room, the hour, the sky, the moon and — with
> permission — roughly where it is. Should the gate name any of that, and if
> so, as what?

**What the answer changes**
- **Nothing.** The browser's permission prompts are the consent point, the gate
  stays as clean as build 66 left it, and 97's ask is retired as superseded by
  the standing rule. This is the status quo and it is defensible — the app is
  more present for knowing where it is whether or not it announces it.
- **One line of awareness.** Not a disclaimer — no "your audio never leaves
  this device", which is the thing build 66 removed and which stays removed.
  Something in the app's own register, naming a sense rather than a policy:
  *"listens · knows the hour · follows the moon"*. It reads as the piece
  describing itself, which is what the amended clause now permits.
- **Awareness that answers.** The same line, but live: it names only what is
  actually available on this device right now, so a phone that refused location
  simply does not claim to know where it is. More honest, more work, and the
  only version that could be wrong in front of someone.

**Decided in advance, so the answer is a single choice and not a design
session**
- Whatever the answer, **no promise-shaped sentence appears on the gate.** The
  ban on reassurance copy is unchanged by this entry and is not up for review
  here.
- If it is a line, it goes in the app's voice and at the gate's existing type
  scale — no new band, no icon row, no second paragraph. **Mine.**
- If the answer is "nothing", this entry closes as `done` with the answer
  recorded, so nobody proposes it a third time.

**Lands in** `index.html` — the gate copy, and nothing else, whichever way it
goes.
**Done when** — Victor has answered, and the answer is written here.
**Verify** — on the phone, at the gate, in daylight, if there is anything to
see at all.
**Hard stops** — prefs no · url no · capture **yes, and that is the entire
point of the entry** · dependency no.

### 108. The sky's crossover is twice as long as entry 71 promised
`status: blocked` · added 2026-08-31 · found by `/ccc` at build 355 · blocks 71's verification

**Do** — nothing yet. A question for Victor, because the fix is a taste call
about how the picture looks across a day and the colours are approved.

**Why** — entry 71 set out to stop the picture spending most of the day in a
grey between-state. Its own **Done when** says *"no more than ~5 of 24 hours
between 0.1 and 0.9"*. Measured on the shipped build, scrubbing `skyFor()`
minute by minute through a full day: **9.95 hours.** The entry's Done-when is
not met and never could have been.

**The finding, precisely**
- **The build is not wrong. The entry is internally inconsistent.** `probe-sky`
  asserts all six anchors land exactly, and they do: 04:00→0.0, 06:30→0.35,
  10:30→1.0, 15:30→1.0, 19:30→0.4, 23:00→0.0. Those are the anchors entry 71's
  own **Decided** section names, hour for hour. The builder implemented
  precisely what was decided.
- **Those anchors cannot produce that number.** 04:00→10:30 is six and a half
  hours of rising and 15:30→23:00 is seven and a half of falling; smoothstepped,
  the part of that lying strictly between 0.1 and 0.9 is 9.95 hours. Decided
  and Done-when were written in the same sitting and disagree with each other,
  and nothing checked one against the other — the probe asserts the *anchors*,
  which is the easier claim and the one that passes.
- **It is still a large improvement, which is why nobody noticed.** Before 71
  the figure was ~16 hours, and the entry's own recon measured that. 9.95 is a
  38% reduction and the picture visibly has a noon and a night now. The claim
  that failed is the *degree*, not the direction.

**The question**
> The shipped curve spends about ten hours a day in the crossover rather than
> the five entry 71 asked for. You have since seen it and said *"both ways has
> good colours, finally, don't break it"*. Is ten hours what you actually want,
> or was five?

**Costed, so the answer is one choice**
- **Keep it, and correct the entry.** The curve is approved by inspection,
  which outranks a number written before anyone saw it. 71's Done-when gets a
  line saying the figure was wrong and the shipped hours are deliberate.
  **Nothing changes in the picture.** This is the safe answer and, given "don't
  break it", the likely one.
- **Take it to ~4.2 hours** — dawn anchors at 05:30/07:00/08:30, dusk at
  18:00/19:30/21:00. Night and day both get longer, the crossover becomes a
  genuine event. This is the shape 71 was actually reaching for. It also moves
  when the picture changes, which on a phone left running is the most visible
  edit in this list.
- **Take it to ~5.6 hours** — dawn 05:00/07:00/09:00, dusk 17:30/19:30/21:30.
  Meets the original figure with the gentlest move from what is on screen now.
- Measured, all three, by scrubbing the same minute-by-minute curve; the
  numbers above are outputs, not estimates.

**Decided in advance**
- **Whatever the answer, the warmth anchors are untouched.** 71 said that curve
  was already right and left it alone; nothing here disagrees.
- **This does not reopen PAPER, INK or the vibrance lift.** Those are frozen
  (entries 68 and 70, build 234) and the crossover's *length* is independent of
  what either end looks like. **Mine.**
- If the answer is "keep it", this closes as `done` with the answer recorded
  and entry 71 archived alongside it, so the discrepancy cannot be re-found and
  re-raised a third time.

**Lands in** `src/sky.ts` — `DAYLIGHT_ANCHORS` only, and only if the answer is
one of the two changes; `scripts/probe-sky.ts` — an assertion on the
crossover *duration*, which is the check nobody wrote and is what let a
Done-when go unmet through five months of builds.
**Done when** — Victor has answered; the answer is recorded here; and
`probe-sky.ts` asserts the crossover duration against whichever figure is
chosen, so this class of gap cannot recur silently.
**Verify** — the probe for the duration. Then, if anything moved, the phone
across an actual dawn, which is the only test of whether a crossover reads as
an event.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 109. Camera mode ends when you put the phone down, not when a clock runs out
`status: ready` · added 2026-09-02 · follows the build-369 fix

**Do** — replace the armed mode's wall-clock timeout with one that reads
whether the phone is still being held and aimed, and make the expiry visible
when it does happen.

**Why** — reported: *"the photo mode doesn't work"*. The immediate cause was a
10-second window that expired silently while the person was still framing, and
that is fixed at build 369 by raising it to 60s. This entry is the part the
number cannot fix: **a clock is measuring the wrong thing.**

**Decided**
- **The timeout's real job is "this was forgotten", and a clock is a poor
  proxy for it.** Sixty seconds is generous enough for most shots and still
  arbitrary: it expires on someone lining up a long exposure of a stage, and
  it keeps the mode armed for a phone that went into a pocket at second three.
  The app already measures the difference — entry 90's posture classifier
  distinguishes **still**, **carried**, **driving**, **dancing** and
  **handled**, and `shake.ts` has `disturb` continuously.
- **So: the arm persists while the posture is `handled` or the phone is
  plainly being aimed, and expires after a short quiet period once it is
  not.** A phone held up and moving is someone composing; a phone flat and
  still for fifteen seconds, or in a pocket, is someone who has moved on.
  **Mine**, and the shape is entry 90's own "it reads, it never writes".
- **Keep an absolute ceiling anyway.** Five minutes, whatever the posture, so
  a phone propped up and vibrating on a table cannot hold the mode open
  indefinitely. A rule with no bound is how the director latched shut (entry
  89) and the lesson transfers. **Mine.**
- **The expiry stops being silent, and this reverses entry 87 deliberately.**
  87 chose a quiet disarm because "the person has stopped looking, and forcing
  the menu back open over whatever they moved on to would be its own
  surprise". That was correct when a late tap still saved a frame — the
  expiry was unobservable *and* harmless. Since entry 103 a late tap does
  nothing at all, so the silence now hides a real failure. **The glyph should
  fade out visibly rather than vanish between frames**, which is a signal
  without being an interruption: it does not reopen the menu, so 87's actual
  objection is untouched.
- **Not decided here** → whether arming should survive a backgrounded tab.
  Related, separate, and needs the `visibilitychange` behaviour entry 73
  established to be thought about properly.

**And the process finding, which is the more useful half**

This fault existed because **two entries that are each correct do not
compose**, and nothing in the system looks for that. 87 and 103 were both
verified clause by clause by `/ccc` in the days before this was reported, and
both passed, because neither entry's **Done when** mentions the other. 87's
window was chosen against an assumption — *a late tap still saves* — that 103
removed without knowing it was load-bearing anywhere.

- **`/ccc` should read the entries a change supersedes.** 103's own Decided
  says it supersedes tap-to-save "and both reports close at once"; what it did
  not do is ask which *other* entries relied on the behaviour being removed.
  A grep for the removed mechanism's name across `docs/built.md` would have
  found 87's dependence on it in one read.
- **Camera mode has no probe and cannot have one as written.** It lives in a
  `main.ts` closure with DOM handles and `window.setTimeout`, so nothing
  headless can reach it. Every fault in it has been found by a person using
  the app. Extracting the arm/disarm state machine as a pure module — the
  `shake.ts`/`emitter.ts` pattern, state plus a pure update taking `now` —
  would make this entry's own rules testable and is most of its work.

**Lands in** `src/engine/camera-arm.ts` (new — pure state, pure update over
`now`, posture and `disturb`); `src/main.ts:1040-1075` — `enterCameraMode` and
the timeout give way to it; `index.html` — the glyph gains a fade-out;
`scripts/probe-camera-arm.ts` (new), which is the first probe this feature has
ever had.
**Done when** — a simulated trace of a phone held and moving keeps the mode
armed past 60s; the same trace going still expires it after the quiet period;
neither exceeds the five-minute ceiling; the glyph's disappearance is visible
rather than instantaneous; and taking a photo still exits immediately as entry
87 requires.
**Verify** — the probe for the state machine, which is the point of extracting
it. Then the phone: arm it, spend a slow minute framing something, and take
the picture — which is the gesture that was reported broken and the only test
that matters.
**Hard stops** — prefs no · url no · capture **yes, and it narrows**: the mode
that saves becomes harder to leave armed by accident, never easier ·
dependency no.
