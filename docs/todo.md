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

Add entries with `/aaa <idea>`, which asks the questions and writes the entry.
Writing one by hand is fine too; the format is below.

## Format

```markdown
### N. Title
`status: ready` · added YYYY-MM-DD

**Do** — one sentence, imperative.
**Why** — one sentence. The problem, not the solution.

**Decided** — every fork the user settled, and what it was chosen *over*.
- Question → chosen, over rejected.

**Lands in** — files, with line numbers where they are known.
**Done when** — an observable outcome, not "it works".
**Verify** — the gates, plus the on-screen check this project always wants.
**Hard stops** — all four answered. Any "yes" needs the user's approval quoted
in Decided, and without it the status is `blocked`, not `ready`.
```

`status:` is one of `ready`, `blocked` (needs a decision — say which), or
`done` (leave it, with the build number that shipped it).

## Entries

### 1. Make the shake's buzz actually perceptible
`status: ready` · added 2026-08-29 · unblocked 2026-08-29

**Do** — replace the single 40ms pulse with a pattern, so the confirmation is
felt on an Android actuator that cannot spin up inside 40ms.
**Why** — Victor cannot feel the buzz on shake. This was blocked on a `?debug`
reading and is not any more: two answers closed it without the trip.

**Decided**
- Platform → Android, Chrome. `navigator.vibrate` exists, so a buzz is possible
  and worth fixing; on iOS it would have been unfixable and the entry would
  have become "replace the haptic with something visual".
- Does the shake itself work → **yes, the picture re-rolls**. That closes the
  half of this entry that was about `motion`/`peak`: `takeStrong()` fires,
  `confirmBuzz()` is called, and the accelerometer path is fine. Two bugs, not
  one, and only the buzz is left.
- Where it ends → **one more attempt, then drop the haptic.** Try the pattern;
  if it still cannot be felt, delete `confirmBuzz()` rather than leave code
  that pretends to do something. The re-roll is its own confirmation. Chosen
  over adding a visual confirmation and over leaving it as best-effort — this
  bounds the chase to one round instead of a third guess.

**Lands in** — `src/haptics.ts`, `CONFIRM_MS` and the `navigator.vibrate` call.
**Done when** — a shake is felt on Victor's phone. If it still is not, the
`buzz` line in `?debug` distinguishes the two remaining causes without another
guess: `buzz off (reduced-motion) N` means the OS setting is suppressing it,
which is deliberate and correct behaviour rather than a bug; `buzz N/M` with
N==M means the platform accepted every pulse and the hardware simply is not
producing something perceptible at that duration.
**Verify** — on the phone. There is no probe for "can a person feel this", and
`hapticStatus()` already reports what was asked for and accepted.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Note:** a single short pulse is the known weak case. Rotational-mass
actuators need time to spin up, and a pattern (a short pulse, a gap, a longer
one) is felt where a flat 40ms is not. Try the pattern before raising the
duration — a long single buzz reads as an error, not a confirmation.

### 2. Record that the gate carries no privacy line
`status: done` · added 2026-08-29 · closed at build 68

**Do** — write the decision into CLAUDE.md's hard-stop section so the absence
reads as deliberate.
**Why** — build 66 removed the two paragraphs, which carried "the audio never
leaves this device" and the only disclosure of the camera layer. CLAUDE.md's
third hard stop names that copy as a promise the page makes, so its absence had
to be a decision on the record rather than a side effect of a layout change.

**Decided**
- Restore a line, or none → **none**, over one short line under the QR. The
  browser's own permission prompt is the consent point. Recorded in CLAUDE.md
  so nobody re-adds it as a bug fix or assumes it was lost in a refactor.

**Done** — CLAUDE.md, hard stop 3, now says the gate deliberately carries no
copy and names the build that removed it.

### 3. Cap the start screen's idle frame rate
`status: ready` · added 2026-08-29

**Do** — run the gate's idle render loop at about 30fps instead of every
animation frame, and stop it entirely after a minute with no interaction.
**Why** — build 63 put the visualiser behind the start screen, so a gate left
open now costs what running the app costs. That is a real change in idle power
draw on a phone, introduced as a side effect of a design change and not yet
paid for.

**Decided**
- Preview vs battery → keep the live preview, over reverting to a static gate.
  It is what made the screen work.
- Cap vs stop → both: throttle immediately, stop after idle, over choosing one.
- After it stops → **any touch or pointermove restarts it**, over staying
  stopped until Start. A gate left a minute would otherwise go permanently
  static, which looks like a crash on a screen whose whole point is that it is
  already running. Costs one listener and makes the first frame after a touch
  one tick late.

**Lands in** — `src/main.ts`, the `idleFrame` loop added in build 63.
**Done when** — the gate's frame interval is ~33ms rather than ~16ms, and the
loop has stopped after 60s untouched; both readable from the `?debug` fps line
before Start is pressed.
**Verify** — `pnpm build`, `pnpm lint`; watch the fps line on the gate. The
existing probes do not cover the gate loop and are not expected to.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 4. Make the QR bigger than Start on the gate
`status: ready` · added 2026-08-29

**Do** — grow `.gate-qr` from `clamp(5rem, 24vw, 7rem)` (80px at 320) to about
155px at 320, so the code is the largest object on the start screen.
**Why** — at 80px the code is a footnote, and handing the link to someone in the
room is one of the two things this screen is for. Start is the other, and it
keeps its authority by being the filled violet disc rather than by being bigger.

**Decided**
- How big → bigger than Start, ~155px, over matching Start at ~115px and over
  filling the width at ~272px. Deliberately reorders the hierarchy: the code
  becomes the largest object and Start stays dominant by colour and fill.
- Composition → **keep the order, QR last**, over putting it above Start and
  over a side-by-side row. The largest object lowest is stable rather than
  bottom-heavy, and side-by-side needs 270px of the 272 available at 320px and
  breaks the single right-hand axis everything else follows.

**Lands in** — `index.html`, `.gate-qr` (one `clamp`, and its twin on `height`).
**Done when** — the QR renders at ~155px at 320×568, is still the right-hand
column's flush edge, and the gate column still fits: there is 235px of vertical
spare at that size, so a 75px growth leaves 160px.
**Verify** — `pnpm build`, `pnpm lint`. Then the one that actually matters:
rasterise the QR at the size and opacity it renders, composited on the gate's
own background, and decode it back — bigger should not break scanning but it is
the check every change near this control has had, and the gradient behind it
differs at the new size. Look at it at 320×568, 360×640 and 412×915.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 5. Merge becomes a per-layer property; Mapping becomes its own "Listening" group
`status: ready` · added 2026-08-29

**Do** — give the geometric and atmospheric layers each their own merge mode
band, replacing the single global one, and rename the settings group to
Listening so the mapping band it is left holding reads as a category rather
than a leftover.
**Why** — a blend mode describes how one layer combines with what is beneath
it, so filing it as a global picture setting was a miscategorisation. The
atmosphere's combination with the camera is currently hardcoded to screen and
has never been adjustable at all.

**Decided**
- Move vs per-layer → per-layer, over simply moving the existing single control
  into the geometric group. That is new capability rather than a relabelling:
  the atmosphere gains a blend mode it has never had.
- Where mapping goes → its own group, renamed Listening, over duplicating it on
  every layer and over dropping it from the HUD. It drives every layer equally,
  so putting it on one would repeat exactly the mistake this entry fixes.
  Layers are what you see; Listening is how it hears, and naming the category
  is what makes a one-band group make sense.
- The Listening icon → **three concentric arcs, like sound arriving**, over
  keeping the diagonal-and-blocks and over a level meter. It is the only group
  that is not about what is drawn, and the meter shape is already taken by the
  numeric readout icon.
- The atmospheric layer's default merge → **screen**. Not a fork: that is what
  the shader hardcodes today, so defaulting to anything else would change every
  existing picture the moment the control shipped.

**Lands in**
- `src/shaders/composite.frag.glsl` — `uMode` becomes the geometric layer's
  mode; add `uAtmMode` and a second blend block for atmosphere-over-camera,
  replacing the hardcoded screen at the `uCameraMix` branch.
- `src/scene.ts` — `setMergeMode` takes a layer, like `setLayerColour` already
  does. New uniform beside `uMode`.
- `src/prefs.ts` — add `atmMergeMode`. Adding a field is safe; `mergeMode`
  keeps its name and meaning as the geometric layer's, so no stored value
  changes meaning.
- `src/hud.ts` — a merge band inside the `geo` and `atm` groups; the `set`
  group becomes `ear`, keeping only mapping. Its icon changes with it.
- `BAND_R` needs a **sixth radius**. Geometric becomes View, Merge, Opacity, R,
  G, B. About 0.33 is the value to use: the old mix arc lived at 0.30, so an
  arc that small is already proven draggable on a phone.

**Done when** — the geometric and atmospheric layers each show six and six
bands respectively, changing the atmospheric merge visibly changes how the
field sits over the camera, and the Listening group holds mapping alone.
**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:fullscreen`,
`pnpm probe:shake`. Then in `hud-probe.html`: drive every band in all four
groups, confirm `describe().straightEdges` is still 0, and check the sixth band
is reachable and does not collide with its neighbour. Look at it at 320x568 and
360x640 — six bands is one more than this wedge has ever drawn.
**Hard stops** — prefs **no** (adding `atmMergeMode`; `mergeMode` unchanged in
name and meaning) · url no · capture no · dependency no.

### 6. Double shake shuffles the whole picture
`status: ready` · added 2026-08-29

**Do** — a second hard shake within ~1.5s of the first escalates from the
current re-seed to a full shuffle of both views, the merge mode, and all three
layers' colour gains.
**Why** — a single shake re-rolls what the current views do with the audio,
which is a small change and sometimes reads as nothing happening. There is no
gesture for "give me something else entirely".

**Decided**
- How a double is detected → escalate, over holding the single back to wait for
  a second. The single keeps firing instantly as it does now and a second
  strong upgrades it; the alternative added about a second of latency to every
  single shake, which is the common case, to make the rare one cleaner.
- What gets rolled → both views, merge mode, and R/G/B on all three layers.
  **Not** opacity, over including it with a 25% floor and over including it
  unclamped: a shuffle that can hand back a black screen looks like a crash and
  is recoverable only by shaking again. **Not** mapping either — that is how it
  hears, not what it looks like.
- The camera is never switched on by a shuffle. Not asked, not a fork: turning
  a sensor on without a gesture is the capture hard stop.
- Does a double feel different → **yes, a distinct double pulse.** Single keeps
  one, the escalation gets two, so you can tell which happened without looking —
  which matters because the picture changed either way. Depends on entry 1
  landing first; a vocabulary of one buzz and two is worthless while neither is
  perceptible.

**Lands in**
- `src/shake.ts` — a second strong inside the existing `STRONG_COOLDOWN` window
  currently cannot fire at all. It needs to report "this was a double" without
  lowering the cooldown, which is what protects against knocks and set-downs.
- `src/main.ts`, the `takeStrong()` branch at ~318 — `randomise()` stays for a
  single; the shuffle is new and has to write through `prefs` and the same
  handlers the HUD uses, so the panel shows the truth afterwards.

**Done when** — one shake re-seeds as now; two inside 1.5s change both views,
the merge mode and the colours, and the HUD opened afterwards shows the new
values rather than the old ones. Opacity is untouched by either.
**Verify** — `pnpm probe:shake` must still pass unchanged: a knock and its
rebound still fire nothing, which is the property the cooldown exists for and
the one most at risk here. Add a case for two strongs inside the window and one
for two spaced beyond it. Then on the phone, because a double shake is a
physical gesture and no probe knows whether it is comfortable.
**Hard stops** — prefs no (writes existing fields) · url no · capture **no,
explicitly**: the shuffle must never raise `passthrough` · dependency no.

### 7. Give each layer type its own ring texture, and write down the design language
`status: ready` · added 2026-08-29

**Do** — make the stroke treatment of a band say what kind of layer it belongs
to, and record the resulting design language in `docs/hud-design.md`.
**Why** — every band is currently drawn identically. The only thing separating
the geometric layer from the camera is tint colour, so the wedge always looks
the same and you know where you are only from which icon is lit. Form carries
no information at all.

**Decided**
- What carries identity → **texture, describing the material**, over stroke
  weight (which encodes depth, not kind) and over cap treatment (too subtle to
  read at 320px). The form means something rather than merely differing:
  - **Geometric** — solid, square caps. Drawn line work.
  - **Atmospheric** — a soft wide halo behind the stroke. A continuous field.
  - **Camera** — segmented. Sampled reality, not drawn.
  - **Listening** — ticked, like a measure. Not a picture at all.
- R/G/B bands → **uniform on every layer**, over taking their layer's texture.
  A colour band must be recognisable as a colour band wherever it appears, so
  texture reliably means "which layer" and never "which kind of control".
- Where it is recorded → `docs/hud-design.md` with the reasoning, and a
  one-line pointer from CLAUDE.md, over a section inside CLAUDE.md. That file
  is a rules list and is already long; a design language with worked reasoning
  wants room.
- Texture on the thick option bands → **no, thin value bands only.** Victor had
  no preference, so this is my call and the reason is on the record: an option
  band is a 30px track with words on it, and texturing it puts pattern directly
  under text. That is the class of problem POPUP_DIM exists for, and this HUD
  has been made illegible by exactly it once already. Identity is carried by the
  value bands, which have no text to compete with.

**Lands in**
- `src/hud.ts` — the band drawing in `build()`. A texture per group, applied to
  the track and fill of every band except the three colour ones. `stroke-dasharray`
  for segmented, a second wider low-opacity path behind for the halo, tick marks
  for the measure.
- `docs/hud-design.md` — new. Must contain the circular rule and why, the
  texture-to-material mapping above, the `BAND_R` ladder with the reason for
  each number, the colour roles, and what is forbidden with examples.
- `CLAUDE.md` — one line pointing at it, next to the circular constraint.

**Done when** — the four groups are told apart with the colour removed. That is
the test worth running: render each group greyscale and check they are still
distinguishable, because if identity survives only in the tint then the texture
is decoration.
**Verify** — `pnpm build`, `pnpm lint`. In `hud-probe.html`: `describe()
.straightEdges` still 0 — a dashed arc is still an arc, a tick is not a
straight line in the forbidden sense, but the halo must not be drawn as a rect.
Look at all four groups at 320x568 and 360x640, and once with a greyscale
filter over the page for the test above.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Watch for:** the segmented camera texture and the enum band's option labels
compete for the same arc. Check the camera group specifically, where the
opacity band is outermost and carries no labels, against the geometric group,
where a segmented-looking band would sit under text.
