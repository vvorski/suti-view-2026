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

**Correction, entry 108, 2026-09-04** — the "~5 of 24 hours" line above was
unreachable from this entry's own **Decided** anchors: 04:00/23:00 and
10:30/15:30, smoothstepped, produce 9.95 hours of mid-band, not ~5 — the two
sections were written in the same sitting and disagreed with each other, and
`probe-sky.ts`'s check 4 asserted `< 11`, loose enough to pass at the real
number, so nothing caught it before `/ccc` did at build 355. Entry 108 re-times
the same six anchors (dawn/dusk spans shortened from ~4 hours each to 1.5) for a
measured 4.90 hours, tightens the probe's threshold to 5.2, and this line is
now genuinely met rather than merely unflagged.
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
`status: done` · added 2026-08-31 · answered 2026-09-04 · build 374 · the remainder of 97, reopened under the new rule

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

**The answer, 2026-09-04 — Victor's call.** One line: **"i am"**. Not the
fuller *"listens · knows the hour · follows the moon"* sketched above — just
the app naming its own presence, in two words, in its own register. No
disclaimer, no list of senses, no live/available-only-if-granted logic: the
plainest of the three options on offer.

### 108. The sky's crossover is twice as long as entry 71 promised
`status: done` · added 2026-08-31 · answered 2026-09-04 · build 376 · found by `/ccc` at build 355

**Do** — move `DAYLIGHT_ANCHORS` to dawn 05:30/07:00/08:30 and dusk
17:45/19:30/21:45, and make `probe-sky.ts` assert the crossover *duration*
tightly enough to have caught this.

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

**The answer, 2026-09-04 — option B with a lingering dusk. Victor's call.**
Dawn 05:30/07:00/08:30, dusk 17:45/19:30/21:45. Measured on that table:
**4.90 h crossover**, night held 9.02 h, day held 10.08 h — against the
shipped 9.95 / 7.02 / 7.03. Day and night become states you sit inside for
the better part of ten hours instead of instants between two long smears.

**What the answering recon added, and it is the part that settles the size of
the move.** `skyForLocation` (`src/sky.ts:320`) does not use this table at
all: for anyone who has granted location it maps daylight from real solar
altitude across civil twilight, ±6°. Scrubbed minute by minute, that path's
own crossover is **0.98 h at the equator, 1.28–1.50 h at NYC, 1.57–2.03 h at
London, 2.23–5.70 h at Reykjavík**. So the app already spends one to two hours
a day in crossover for most of the inhabited world, and the clock fallback was
spending ten. The fallback had drifted five-fold from the thing it is a
fallback for, and that — not the entry's own arithmetic — is the real argument
for shortening it.

**Why not go all the way to the real sun's ~2 h.** That table was measured too
(06:00/06:45/07:30 and 19:00/19:45/20:30 → 2.12 h) and is the wrong move, for a
reason specific to *this* curve: the clock fallback is known to be wrong about
the hour — the file's own opening comment says it will call 2am night in
Reykjavík in June. A soft transition hides that error; a sharp one advertises
it, giving a decisive dawn at a visibly wrong time. **The fallback should be
gentler than the real path on purpose**, and roughly double is the right amount
of gentle.

**Decided**
- Ten hours or five → **five, taken as the ~4.2 h option B rather than the
  ~5.6 h option C.** Over keeping the shipped curve, which was the safe answer
  and the one "don't break it" pointed at. Victor's call, made against the
  three costed tables and the solar measurements above.
- Symmetric or lingering → **lingering dusk.** Dawn keeps option B's 3 h
  (05:30→08:30); dusk is stretched to 4 h (17:45→21:45), which is what takes
  the figure from 4.22 h to 4.90 h. Over the symmetric 3+3. Victor's call:
  evenings feel longer than mornings do, and the curve should say so.
- Are the approved colours at risk → **no, and this is why the entry can be
  built at all.** Only anchor *hours* move; every daylight *value* on the curve
  is one already on screen and already approved, and `WARMTH_ANCHORS` is not
  touched. **Mine**, because entries 68 and 70's approval is about what each
  end looks like, and this changes only how long each end lasts.
- What happens to `Sky.slope` and its one reader → **nothing needs
  recalibrating.** Peak slope rises 0.244 → 0.650 daylight-units per hour, but
  `PEAK_DAYLIGHT_SLOPE` in `engine/celestial.ts:78` is computed at module load
  by scrubbing this very curve, so `sunRateFor` stays normalised 0–1 by
  construction. What changes is that the sun's restlessness concentrates into
  the dawn and dusk hours instead of smearing across the day — the same
  improvement, appearing free in a second place. **Mine**, because it is a
  measurement, not a taste call.

**The correction this entry owes.** Its own **Lands in** said `probe-sky.ts`
needed "an assertion on the crossover *duration*, which is the check nobody
wrote". **That was wrong.** Check 4 at `scripts/probe-sky.ts:140-150` *does*
assert exactly that — `midBandHours < 11` — and it passed at 9.95 h because
the threshold was set loose enough to accommodate what had been built. The
check was written; its number was chosen to pass rather than to hold the
entry's promise. That is a worse failure than an absent check and the reason
this must not close by simply loosening it again: **the new threshold is
5.2 h**, sized to the 4.90 h the chosen table actually produces, so any future
drift of more than a few minutes fails the gate.

**Two existing probe checks fail on the new table and must be repaired, not
deleted** — both measured, both consequences of the transitions being steeper:

- **Check 2, `scripts/probe-sky.ts:78`** — "no per-minute daylight jump" asserts
  `maxDaylightStep < 0.01`. The new peak per-minute step is **0.01083, at
  07:44**. Raise the threshold to **0.015**. That 0.01 was never a perceptual
  limit: it was headroom over the *old* curve's peak of 0.00407, and 0.015
  keeps a comparable ratio over the new peak while still catching a genuine
  discontinuity. **Mine**, because the check's purpose is "no corner", and its
  number was always relative to whatever curve was shipped.
- **Check 5's second half, `scripts/probe-sky.ts:165-170`** — the
  anchor-straddling control asserts a ±5 min window across the 10:30 anchor
  moves less than 0.001. Across the new 08:30 anchor the same window moves
  **0.00580**, because the anchor now joins two short segments instead of two
  long ones. **Make the check relative rather than absolute**: assert the
  straddle is less than a tenth of the mid-transition delta measured beside it
  — 0.00580 against 0.10789 at 07:45 is 18.6×, so it passes with margin, and
  the check keeps its actual meaning (an anchor is flat *compared to* the
  middle of a segment) instead of depending on a constant that only held while
  the segments were four hours wide. **Mine**, over narrowing the window to
  ±1 min, which passes at 0.00024 but quietly weakens what is being claimed.

**Decided in advance, and unchanged by the answer**
- **The warmth anchors are untouched.** 71 said that curve was already right
  and left it alone; nothing here disagrees.
- **This does not reopen PAPER, INK or the vibrance lift.** Those are frozen
  (entries 68 and 70, build 234) and the crossover's *length* is independent of
  what either end looks like. **Mine.**
- **`skyForLocation` is not touched.** The real-position path is the standard
  this entry measured against, not a thing to bring into line with it.
  **Mine.**

**Lands in**
- `src/sky.ts:73-80` — `DAYLIGHT_ANCHORS`, the six hours only. Its comment
  above (`:64-72`) names 04:00/23:00 and 10:30/15:30 as the held ends and calls
  the hours "settled by eye"; that comment must be rewritten to the new hours
  and to *why* they are what they are, or it becomes exactly the kind of
  expired justification CLAUDE.md warns about.
- `src/sky.ts:26-35` — the file header's own paragraph claiming "the crossover
  is what it should be: an event, not most of the day". That sentence has been
  false since it was written, by a factor of two. It becomes true with this
  build; make it carry the measured number so it cannot go stale silently.
- `scripts/probe-sky.ts:30-35` — the daylight anchor table in check 1.
- `scripts/probe-sky.ts:96-115` — check 3's plateau and floor windows:
  day 10:30–15:30 → **08:30–17:45**, night 23:00–04:00 → **21:45–05:30**.
  Both verified to hold exactly on the new table (plateau min 1.000000, floor
  max 0.000000).
- `scripts/probe-sky.ts:140-150` — check 4's threshold, 11 → **5.2**.
- `scripts/probe-sky.ts:78` and `:165-170` — the two repairs above.
- `scripts/probe-sky.ts:158-162` and `:176-178` — checks 5 and 6 sample
  08:25/08:35 and 08:30/10:30 as "mid-dawn" and "at an anchor". Mid-dawn is now
  **07:45** (delta 0.10789 across ten minutes) and the anchor is **08:30**.

**Done when**
- `skyFor` scrubbed minute by minute over 24 h spends **4.90 h ± 0.05** with
  daylight strictly between 0.1 and 0.9, and `probe-sky.ts` asserts it against
  **5.2 h**, not 11.
- Night is held at ≤0.001 for at least 9 h and day at ≥0.999 for at least 10 h,
  asserted over the new windows rather than only at their edges.
- `pnpm probe:sky` passes with every check repaired rather than removed, and
  the count of checks does not go down.
- Entry 71's **Done when** carries a line recording that its "~5 of 24 hours"
  was unreachable from its own Decided anchors, that the figure is now met by
  this entry, and that the gap survived because check 4's threshold was sized
  to pass.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:sky`. Then the picture:
`views-probe.html` at a few scrubbed hours to confirm no colour moved, since
only hours were meant to. No HUD surface is touched, so the 320×568 / 360×640
pass is not required here. Finally, if it can be had, the phone across an
actual dawn — the only test of whether a crossover reads as an event, and the
one thing no probe can answer.

**Hard stops** — prefs no · url no · capture no · dependency no.

### 109. Camera mode ends when you put the phone down, not when a clock runs out
`status: done` · added 2026-09-02 · build 372 · follows the build-369 fix

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

### 110. Strata: the picture is sand between two panes of glass
`status: ready` · added 2026-09-04 · a new atmospheric view · independent of 108

**Do** — add an atmospheric view, **Strata**, in which the audio pours coloured
sand from whichever edge is up, the grains sift down under the phone's own
in-plane gravity and pile in layers along whichever edge is down; laid flat,
nothing falls — the pile holds and new grains hang as dust until the phone is
raised again; turned over, the pile becomes the source and rains back down.
**Why** — the app already measures which way is down and uses it three times
(entries 30, 61, 102), and every use is a *nudge*: the picture slides a little,
an emitter drops, powder skids. None of them makes lying-flat and held-upright
*different pictures*. A sand-art frame does exactly that with nothing but
gravity, and it is the one toy whose entire behaviour is "what angle am I at".

**What the recon settled, and it overturns the ask's own premise.** Victor asked
to *"use the axis detection"* — the `gravZ` component `shake.ts:370` keeps and
never exposes. **It is not needed, and must not be used here.** Three built
entries already reached this fork and decided it the same way; `built.md`'s
record of entry 102 is the clearest: *"Phone upright: that projection is the
full vector and things fall. Phone flat on a table: the vector points into the
screen, its in-plane length is zero, and the emitter stays exactly where it
was put — not by a rule saying so, but because there is nothing pulling it
… **A mode flag here would be strictly worse than the physics.**"* Flat-versus-
vertical is *already the physics* of the in-plane pair `shake.tilt()` returns:
`(0, 0)` flat, unit length vertical, every angle between correct for free, and
a sideways or upside-down phone handled with no case for it. `gravZ` would
only add face-up versus face-down, and a sand frame lying on its face behaves
exactly like one lying on its back. **Decided against, on that reasoned
record.**

**A naming trap the builder will fall into unless told.** `uTilt` in
`caustics`, `cells` and `aurora` (`scene.ts:573`, default 0.5) is *spectral*
tilt — bass-versus-treble balance — and has nothing to do with the phone. The
phone's tilt reaches `scene.ts` only through `setMotion(tiltX, tiltY,
disturb)` (`:364`, `:1495`), where it currently feeds a colour bias and
nothing else; **no fragment shader has ever received the phone's tilt.** This
entry does not change that: the tilt is consumed in TypeScript by the sediment
model below, and what the shader receives is the resulting picture.

**Decided**
- A new view, or gravity applied to the existing picture → **a new atmospheric
  view.** Over a composite-level "sift" that would let any view's pixels fall
  and pile. **Mine**: the second modifies every approved picture at once —
  Victor's *"both ways has good colours, finally, don't break it"* covers all
  of them — and needs a feedback render target `scene.ts` does not have; the
  first is additive, costs the other fourteen views nothing, and matches
  `views.ts`'s own rule that *"adding one is a file plus a line here."* The
  identity when off is therefore total: a view not selected draws nothing.
- Where the state lives → **a pure-state module, `src/engine/sediment.ts`,
  uploaded as a `DataTexture` — the shape `uHistory` already is.** Over
  simulating in the shader with a ping-pong target. **Mine**: `views.ts`
  says a view is *"nothing but a fragment shader plus a label"* and that the
  constraint is deliberate; a view with its own render target breaks that for
  everyone. The spectrogram already accumulates its state in TypeScript
  (`historyTexture`, `scene.ts:550`) and hands it over as a texture, so this
  is the second tenant of an existing pattern, not a new one. It is also what
  makes the model probeable headless, which a shader never is.
- The model → **a falling-sand cellular automaton on a fixed low-resolution
  grid, colour per cell.** Over a heightfield (a pile along one edge as a 1D
  profile), which cannot be turned over — the whole point of a sand frame is
  that flipping it makes the pile the source, and a profile has no way to
  fall. **Mine.** Entry 61 wrote *"a cellular-automaton sand model this entry
  is deliberately not"* about the powder egg's pile; that was a scope line for
  that entry, not a rule for the project, and this entry is exactly that
  model on purpose. Grid **96 cells across the short side**, the long side by
  aspect (≈170 tall in portrait: ~16k cells, one pass a frame, trivially
  cheap in TypeScript; the upload is ~64 KB a frame, less than the spectrum
  ring already moves).
- Which way is down, on a square grid → **the dominant in-plane axis of
  `tilt()`, with the minor component's sign choosing which diagonal a blocked
  grain slips to first.** Portrait, landscape, upside-down and every diagonal
  hold fall out of that: a phone leaned to the left builds its pile in the
  bottom-left corner rather than flat along the bottom. **Mine**, over
  rotating the grid into the gravity frame, which makes the flip continuous
  but the pile's own cells shear on every re-sample.
- What "flat" is → **in-plane magnitude below `0.2`** — the same `AIM_TILT_MIN`
  `camera-arm.ts:33` already uses for "flat, not held up", about 11.5°, so
  the app has one notion of flat. **Mine.** Below it, **landed grains do not
  move at all** (sand lying flat stays where it lies); **airborne grains lose
  their fall and take a random walk** instead, at about a cell every 0.25 s,
  and never land. Raising the phone drops every one of them at once — the
  reward for picking it up, and the reason the dust exists at all.
- What pours, and where → **each spectrum band is a source along the up
  edge, bass at one end, treble at the other, emitting grains in proportion
  to its energy.** Over a single central pour. **Mine**: the pile's *shape*
  then becomes the long-run spectrum of whatever has been playing and its
  *layers* become the history, which is the spectrogram's whole idea rotated
  ninety degrees and given weight. Reads `uSpectrum`'s own bands; no new
  analysis.
- Grain colour → **the atmospheric layer's colour, shifted by spectral tilt
  at birth** — darker and warmer for a bass-heavy moment, lighter and cooler
  for a bright one, ±0.08 in lightness and the same magnitude in hue, both
  chosen so a track with changing texture writes visible strata and a steady
  one writes a plain pile. **Mine** on the magnitudes; the layer colour as
  the base is the only choice consistent with every other atmospheric view.
- Pour rate → sized so a loud passage fills about **a fifth of the frame in
  ninety seconds** of continuous vertical play, and silence pours nothing.
  **Mine.** Faster and the frame is full before a song ends; the frame filling
  is not a failure — see the next line — but it should take a whole side of a
  record to get there.
- A full frame → **the pile simply stops growing**; new grains that find no
  room are dropped. Nothing fades, nothing scrolls. **Mine**: a sand frame
  that has all its sand at the bottom is finished, not broken, and the person
  turns it over — which is the gesture this entry exists for. The turn-over is
  also the only reset there is; no tap, no shake clears it (a shake still
  disturbs the picture through `uTumble` like every other view — that is
  untouched and needs nothing here).
- No motion data at all (desktop; iOS with the sensor refused) → **assume
  portrait-down**, `g = (0, 1)` in screen space, rather than `(0, 0)`. Over
  the refusal-is-behaviour answer of letting the view hang as dust for ever.
  **Mine**: a view that can never do anything on a laptop is not a smaller
  feature, it is an inert one, and portrait-down is what a phone in a hand
  almost always is. The condition is *no `devicemotion` sample has ever
  arrived*, which is the `samples` count `hud.ts:1507` already prints as
  `motion N ev`. The camera-arm expiry fault found at build 373 (armed mode
  dies in 15 s on any device with no motion data — not yet an entry) needs
  the identical test, so **expose it once from `shake.ts`** and let that fix
  read it when it is written.
- Gated by `prefs.gravity`? → **No.** Over sitting behind the `grav` chip like
  entries 30 and 102. **Mine**: those are gated because they move an approved
  picture; here the falling *is* the picture, and a Strata that ignores
  gravity has nothing left to show. Selecting the view is the consent.
- Frozen while backgrounded → the model advances only when `render()` runs,
  so a tab in the background does not fill or dissolve anything while unseen.
  Falls out of where the tick lives; no timer of its own. **Mine.**

**Lands in**
- `src/engine/sediment.ts` — new: `createSedimentState(w, h)`, `updateSediment
  (state, dt, tiltX, tiltY, bands, colour)`, pure, no DOM, no clock; the
  eighth pure-state module beside `posture.ts`, `camera-arm.ts`,
  `motion-bias.ts`.
- `src/shaders/strata.frag.glsl` — new: samples the sediment texture with
  soft cell edges, nothing else. Reads no audio uniforms itself — the
  pouring already happened in TypeScript.
- `src/views.ts:90-133` — one line in `ATMOSPHERIC_VIEWS`, the eighth.
- `src/scene.ts` — a `uSediment` `DataTexture` beside `uHistory` (`:550`,
  `:585`) and a per-frame `updateSediment` call in `render()`, fed from
  `motionTiltX/Y` (`:1496`) which are already there — no new setter from
  `main.ts`, the same "no new plumbing" shape entries 76 and 104 used.
- `src/shake.ts` — expose whether any motion sample has ever arrived, for the
  portrait-down fallback; written to be shared with the camera-arm fix above.
- `scripts/probe-sediment.ts` — new, and `package.json`'s `probe:sediment`.
- `views-probe.html` — Strata renders beside the other seven from the same
  synthetic audio, per CLAUDE.md; this is where "looks like sand, not like a
  bar chart" is judged.

**Done when**
- Headless, from empty: 90 s of synthetic loud audio with `tilt = (0, 1)`
  fills **18–22 %** of cells, all of them landed, none above a cell with
  nothing under it; the pile's column heights correlate with the synthetic
  band energies (bass-heavy input → the bass end of the pile is taller).
- Then `tilt = (0, 0)` for 60 s: **the landed count does not change by a
  single cell**; airborne grains present at the flip are still airborne and
  have all moved.
- Then `tilt = (0, -1)`: within 10 s at least 90 % of the previously landed
  grains are landed again against the opposite edge.
- `tilt = (0.7, 0.7)`: the pile's centre of mass sits in the corresponding
  corner, not along an edge.
- `tilt = (0.1, 0.1)` (below the flat threshold) behaves as `(0, 0)`.
- With the no-motion flag set and `tilt = (0, 0)`, grains fall as if `(0, 1)`.
- A frame at 96×170 with 16k cells updates in under **2 ms** in the probe.
- In `views-probe.html`, Strata is visibly banded after the synthetic run and
  no other view's output has changed by a pixel.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:sediment`, then
`views-probe.html` looked at, then the phone: hold it up, watch it pour; lay
it on the table, watch the dust hang; turn it over. The HUD is untouched — the
view arrives in the existing atmospheric band — so the 320×568 / 360×640 pass
is not required, but the band should be opened once to confirm the eighth
option seats under the notch.

**Hard stops** — prefs no (a new value on an existing validated enum, as
Fringe and Rose were) · url no (`?atmospheric=strata`, a new value not a new
parameter) · capture no · dependency no. The control surface is unchanged.

### 111. The slip goes further, and further still when the phone has been moving
`status: ready` · added 2026-09-04 · unfreezes 76 · build after nothing

**Do** — raise the RGB slip's cap, put a response curve on its target so
ordinary handling reaches a visible fraction of that cap, and let the cap
itself stretch with how much the phone has been moving lately.

**Why** — the effect is built, correct and passing its probe, and Victor's
report is that it "doesn't appear strong". It isn't: at a nudge it is 3.3px of
total red-to-blue separation on a 1080px phone, along the same axis the tumble
is simultaneously sliding the whole picture 59px down.

**The freeze is lifted, by name.** Entry 76 is `done · FROZEN` and says the
four constants are "not to be retuned… If a future request wants the effect
changed, that is a new entry with Victor's word in it, not a tweak." This is
that entry, and the word is: **"make it stronger, also can you detect ongoing
motion then it should stretch further"** (2026-09-04). `MAX_SLIP` and the
target curve are in scope. `STIFF = 400` and `DAMP = 14` are **not** — the
ζ 0.35 overshoot is what "flicks apart and bounces back" means and nothing in
the request is about the spring's feel.

**Decided**
- **How much stronger, and why the old ceiling was mis-calibrated** → `MAX_SLIP`
  0.006 → **0.010** uv. **Mine**, and this is the load-bearing recon finding:
  entry 76 justified 0.006 as "about two to four pixels on a phone… past a few
  pixels line art stops looking dispersed and starts looking broken." Entry 104
  then measured it and found the *comment* wrong, not the geometry — 0.006 uv
  is 6.5px per channel, **13px total**, because the compositor's `uv` spans the
  full frame width. So the "broken" ceiling was never tested at 3–4px; the
  approved-and-liked picture has been sitting at 13px the whole time, and the
  argument that 13px is the limit is an argument that was actually made about a
  number three times smaller. 0.010 uv is 21.6px total at the cap — a real
  increase, still under twice what has already been looked at and approved.
- **A curve on the target, not only a bigger cap** → the magnitude spring
  chases `pow(disturb, 0.6)` rather than `disturb`. **Mine**, because raising
  the cap alone barely changes what anyone feels: `disturb` is
  `(mag − 1.2) / (14 − 1.2)`, so a nudge at 8 m/s² asks for 0.53 of the range
  and a hand tremor asks for nothing at all. The exponent front-loads exactly
  the small-`disturb` regime ordinary handling lives in — the same shape and
  the same reason `shake.ts`'s `busyness()` takes `sqrt(calm)` — without
  touching `FLOOR`, which is what keeps a phone lying on a table at zero.
- **"Ongoing motion" is `busyness()`, which already exists** → the cap becomes
  `MAX_SLIP + busyness * SUSTAIN_SLIP`, with `SUSTAIN_SLIP = 0.010`. **Mine**,
  over inventing a second slow envelope inside `rgb-slip.ts`: entry 88 already
  built precisely this signal — `calm`, an EMA of `disturb` at `CALM_TAU = 25s`,
  read as `sqrt(calm)` — for the adaptive shake bar, and a second one at a
  different time constant would drift from it and give the app two disagreeing
  opinions about how busy the phone is. It is `shake.ts:502`, currently
  `private`.
- **The stretch holds during a shake rather than compounding** → `updateCalm`
  freezes while a detection is in progress or cooling down, and that freeze is
  inherited unchanged. **Mine**: the request is that *ongoing* motion stretches
  the slip, and a gesture inflating its own cap mid-gesture is the same
  self-eating fault entry 88's freeze was written to prevent.
- **Exposed as a per-frame fact, not a clearing accessor** → `busyness: number`
  joins `ShakeFrame` (`shake.ts:900`) beside `disturb`, `Tumble.busyness()`
  becomes public, `STILL_FRAME` reports 0, and it reaches the shader path
  through `setMotion`'s existing call in `main.ts:1627` gaining a fourth
  argument. **Mine** — it is exactly as much a per-frame fact as `disturb` is,
  and `ShakeFrame`'s own comment is explicit that non-clearing per-frame values
  belong there so two watchers see the same reading.
- **The whole magnitude stays in `rgb-slip.ts`** → `updateRgbSlip` gains a
  `busyness` parameter and computes its own cap; `MAX_SLIP` keeps its name and
  its export so `engine/index.ts:80` and the probe are unchanged in shape.
  **Mine**, over computing a cap in `scene.ts` and passing it in — `scene.ts`
  accumulating analysis is the specific drift CLAUDE.md's refactor rule names.
- **Direction, spring feel and the still-phone identity are untouched** → the
  held direction, `PEAK_RATIO`, `PEAK_TAU`, `STIFF` and `DAMP` are all entry
  104's and entry 76's and stay exactly as they are.

**Identity when off** — exactly nothing changes on a still phone, and it falls
out of the maths rather than a guard: `pow(0, 0.6)` is 0, so the spring's
target is 0, so `amount` is 0, so `magnitude` is 0 and `updateRgbSlip` returns
`{x: 0, y: 0}` before the cap is ever consulted. `busyness` at 0 leaves the cap
at exactly `MAX_SLIP`, so a device that has never moved is byte-identical to a
build with `SUSTAIN_SLIP` deleted.

**Lands in** — `src/engine/rgb-slip.ts` (the curve, `SUSTAIN_SLIP`, the new
`busyness` parameter and the cap it computes; `MAX_SLIP` 0.006 → 0.010, and its
own comment, which entry 104 has already corrected once and which must state
the new pixel figure); `src/shake.ts:502` (`busyness()` public), `:768` and
`:900` and `:833` (`ShakeFrame`, the returned frame, `STILL_FRAME`);
`src/main.ts:1627` (`setMotion` call); `src/scene.ts:838` and `:1287` (the
stored value and the `updateRgbSlip` call); `scripts/probe-rgb-slip.ts` (the
handling table, which must now be printed at three busyness levels).

**Done when** — `pnpm probe:rgb-slip`'s handling table prints, at `busyness`
0: a peak of **at least 1.8× today's** printed figure for the *nudge*
(0.00307), *jolt* (0.00368) and *sustained low agitation* (0.00171) rows; a
cap of 0.010 uv, which the probe's own pixel line reports as **21.6px total
red-to-blue separation** at 1080px wide. At `busyness` 0.5 the cap is 0.015
(32.4px) and at 1.0 it is 0.020 (43.2px). The still-on-a-table and
hand-tremor rows still print **0.00000 at every busyness level** — the curve
must not lower the floor. Entry 104's four assertions still pass unchanged:
zero direction reversals through a knock's decay up to 120 m/s², zero through
a 5 Hz, 3 Hz and 2 Hz sustained shake, a cross-aimed second hit re-aims the
axis, and every case settles back to zero.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:rgb-slip` and
`pnpm probe:shake` (the latter because `busyness()` changing visibility must
not change the adaptive bar it feeds — the walking-then-shake case is the
one that would catch it). Then the phone, which is the only place the actual
question is answered: nudge it once and look for colour on the edges, then
carry it around for a minute and nudge it again — the second nudge must be
visibly further apart than the first. No HUD surface changes, so no 320×568
pass is owed.

**Hard stops** — prefs no · url no · capture no · dependency no. The frozen
constants of entry 76 are overridden, with Victor's word quoted above and by
the mechanism entry 76 itself specifies.
