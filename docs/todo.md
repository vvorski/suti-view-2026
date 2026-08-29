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

`status:` is one of `ready`, `blocked` (needs a decision — say which), or
`done` (leave it, with the build number that shipped it).

## Entries

### 1. Make the shake's buzz actually perceptible
`status: done` · added 2026-08-29 · shipped at build 68 — awaiting Victor's phone

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
`status: done` · added 2026-08-29 · shipped at build 84

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
`status: done` · added 2026-08-29 · shipped at build 85

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
`status: done` · added 2026-08-29 · shipped at build 77

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

### 8. Let the buzz report how hard you shook
`status: ready` · added 2026-08-29

**Do** — scale the confirmation pattern by the shake's own intensity, so a
firm shake feels different from a barely-qualifying one. `Tumble` already
tracks `peak`, the recent high-water AC magnitude in m/s²; carry it out of
`takeStrong()` and pick the pattern from it.
**Why** — the buzz currently says "heard you" and nothing else. The detector
already knows *how much* it heard and throws that number away at the moment it
would be most useful. A shake that only just cleared the threshold and one that
nearly threw the phone produce identical feedback, so there is no way to learn
where the threshold is except by trial.

**Decided**
- Scope → intensity on the **existing** single/double patterns, over building
  a general haptic vocabulary. **Mine**, because the two patterns already carry
  the meaning that matters (which thing happened); intensity is a second axis
  on top, and adding a third signal before the first two are confirmed
  perceptible on a real phone would be building on unverified ground.
- Where the number comes from → `peak`, over `disturb`. **Mine**: `disturb` is
  normalised and saturates at FULL, so everything from a brisk wave upward
  reads as 1.0 and the distinction this entry exists to make would be lost at
  exactly the top of the range where it is most interesting. `peak` is raw
  m/s² and does not saturate.
- Floor → the gentlest qualifying shake still gets a clearly perceptible
  pattern, not a whisper. **Mine**: a confirmation that can be too faint to
  feel is the bug builds 68 and 76 were both about, and reintroducing it as a
  feature would be absurd.

**Lands in** — `src/shake.ts` (`takeStrong`/`takeDouble` return the peak, or a
sibling reports it), `src/haptics.ts` (pattern scaled by intensity),
`src/main.ts` (pass it through).
**Done when** — a gentle qualifying shake and a hard one produce measurably
different patterns, verified by stubbing `navigator.vibrate` and comparing the
arrays; and the gentlest one is still above the durations that builds 68 and 76
established as perceptible.
**Verify** — `pnpm probe:shake` unchanged: this must not alter *whether*
anything fires, only what it feels like. The vibrate-stub check from build 76,
extended to assert two intensities differ. Then the phone.
**Hard stops** — prefs no · url no · capture no · dependency **no — see below**.

**On the libraries in the research.** All four are declined, and declining a
dependency needs no licence — only adding one does. The research's own
conclusion for a normal website is "no library is the best library", which
matches what is already here:

- **web-haptics / pulsar-haptics** — presets and pattern composition over
  `navigator.vibrate`. Checked against the npm registry rather than taken on
  description: `web-haptics` is **v0.0.6**, 65KB unpacked, published 2026-03-02;
  `pulsar-haptics` is **v0.2.0**, 8.6KB unpacked, published 2026-06-17. Both
  are pre-1.0, and 65KB is not a small thing to add to a bundle whose whole
  budget argument is Three.js at 117KB gzipped. `haptics.ts` is 100 lines, has
  the two patterns this app needs, and records why each number is what it is.
  (The research described `web-haptics` as having "substantial npm usage";
  v0.0.6 published in March is early software whatever the download count.)

  I could not read pulsar-haptics' actual intensity technique — npm returned
  403 — so nothing is claimed about how it does it. If entry 8's own approach
  turns out awkward, that page is worth a second look for the *method*, which
  is borrowable without the package.
- **browser-haptic** — pitched for its iOS `<label>`/switch-control trick.
  `haptics.ts:18` already names that trick and rejects it as not usable here,
  reached independently. It is also moot: the target phone is Android Chrome.
- **@capacitor/haptics, @capacitor/motion** — would mean shipping a native
  wrapper. This is a page on GitHub Pages; that is a different product.
- **shake.js** — the research itself says take the algorithm, not the package.
  Ours is already past it: shake.js is threshold-and-debounce, while this
  detector counts reversals *and* has a sustained-agitation path, which is what
  makes it reject a knock and its rebound. `pnpm probe:shake` asserts that, and
  a threshold-only detector fails it.

The one thing worth taking from the research is the idea above — continuous
shake energy driving the response rather than a boolean — and it needs no
dependency at all, because the number is already being computed.

**The WICG Web Haptics proposal is worth knowing about and not worth building
on.** Its own status text says the API "is in the early ideation and
interest-gauging stage, and the solution/design will likely evolve"; there are
no implementations and no timeline, and it notes that extending
`navigator.vibrate` "lacks broad engine support (absent in Safari/WebKit)".

What matters here is the shape it proposes: `navigator.playHaptics(effect,
intensity)` with intensity 0.0–1.0. That is the same axis entry 8 adds, which
means the work is forward-compatible by accident rather than by design — if
the API ever ships, the intensity number this entry computes maps straight onto
it and only the call site changes. It also lists iOS Core Haptics in its
platform mapping, so it is the one route by which an iPhone might ever feel any
of this. Nothing to do now; a reason to keep the intensity value as a plain
0–1 number rather than baking it into a duration.

### 9. Flash the screen on a detected shake, for debugging
`status: done` · added 2026-08-29 · shipped at build 81

**Do** — a white flash on any detected shake, single or double, when the
numeric readout is on.
**Why** — Victor reported the shake not working and no double detection, with
nothing to check it against. `pnpm probe:shake` passes every synthetic case
for both, and `main.ts` calls `takeDouble()` correctly — nothing in the code
points at a bug. What was missing is the one thing a probe cannot supply:
whether anything fires on this particular phone at all, and which kind.

**Decided**
- Gate → **`prefs.showStats`**, over a second `?debug` flag. **Mine**: that
  flag already means "diagnostics are visible", and a flash on every shake
  once this ships permanently would turn a quiet instrument into a strobe.
- Single vs double → **visually distinct**, a plain fade for one and a double
  pulse for the other, over one flash for both. **Mine**, for the same reason
  the buzz is two different patterns: the ambiguity in the report was
  specifically "is a double even detected", so the two cases have to be
  told apart by eye as well as by feel.
- Mechanism → a DOM overlay, over a shader uniform. **Mine**: it must stay
  visible even if the render path itself is what's broken, and cost nothing
  when off.

**Lands in** — `index.html` (`#shake-flash`, its CSS), `src/main.ts`
(`flashShake()`, called from both branches of the shake handler).
**Done when** — `?debug` on Victor's phone, a single shake washes the screen
white and fades; a shake-pause-shake pulses twice. Whichever fails to appear
is the same information entry 1 was blocked on before it was unblocked by
asking: a code-level fact rather than another guess.
**Verify** — `pnpm build`, `pnpm lint`. Confirmed by class/CSS inspection and a
screenshot with the gate hidden, both showing the intended state; the fade and
pulse *timing* could not be observed live in this session — see the note
below, now in CLAUDE.md.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Harness note, recorded because it cost real time to diagnose:** driving this
in the browser tool reported the transition "stuck" at full opacity —
`getAnimations()` showed one `running`, the classes were exactly right, and it
never advanced. `document.visibilityState` was `hidden`: Chrome throttles
frame-driven work in a non-frontmost automation window regardless of what
drives it — `requestAnimationFrame`, a CSS transition, or a `@keyframes`
animation — which is the same family as the already-documented rAF trap, one
step further. Added to CLAUDE.md's harness-traps list so it is not
rediscovered as a CSS bug.

### 10. A byline above the title on the start screen
`status: done` · added 2026-08-29 · shipped at build 86

**Do** — add "by flyflyfly \u00a9 2026" above `suti · view` on the gate, small
and quiet, on the same right-justified axis as everything else there.
**Why** — asked for directly; no problem being solved beyond attribution.

**Decided**
- Above *which* name → **above the title**, over above the release name.
  **Mine**: "the name" most naturally means the piece's own name — SUTI ·
  VIEW — not the build's codename, which is a diagnostic detail nobody but
  Victor is meant to read as identity.
- Weight → **quieter than the release name**, over matching it or the title.
  **Mine**: a byline that outweighs the title it sits above would read as the
  headline, and this screen already has one thing that dominates by design —
  the filled Start disc — everything else is deliberately receding from it.

**Lands in** — `index.html`, `.gate-head`: one `<div>` above the `<h1>`, one
small CSS rule reusing the existing right-justified block.
**Done when** — the line renders above the title, right-justified with it, at
320\u00d7568 without pushing the column past the available height (484px used
of 524 before this — see entry 4's headroom note; a byline this size costs
under 20px).
**Verify** — `pnpm build`, `pnpm lint`. Look at 320\u00d7568, 360\u00d7640,
412\u00d7915 — the column has been re-measured for every gate change this
session and this is another one.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 11. Double shake flashes red; the single flash holds longer
`status: done` · added 2026-08-29 · shipped at build 82

**Do** — give the double-shake flash its own red, distinct from the single's
white, and slow the single's fade so it is easier to catch by eye.
**Why** — asked for directly, refining the debug flash from entry 9. The two
kinds currently differ only by pulse shape (fade vs. double-pulse), both in
the same white — worth telling apart by colour too, and the single's 260ms
fade is quick to miss on a real device where you are also watching the phone
move.

**Decided**
- Red → **`#ff4d5e`**, over inventing a new colour. **Mine**: it is the app's
  own R-channel tint, already used and legible on the dark ground everywhere
  else in the HUD — reusing it keeps one colour language rather than adding a
  second red nobody chose on purpose.
- Single's fade → **260ms \u2192 450ms**, over a larger or smaller jump.
  **Mine**: keeps it clearly shorter than the double's 340ms *pulse sequence*
  while being long enough to register on a screen someone is also physically
  shaking.

**Lands in** — `index.html`, `#shake-flash.double` (add `background`) and the
base `#shake-flash` transition duration.
**Done when** — a single shake's flash is visibly white and holds noticeably
longer than before; a double's is visibly red rather than white.
**Verify** — `pnpm build`, `pnpm lint`. CSS/class inspection, as entry 9's
transitions cannot be observed progressing live in this harness — see
CLAUDE.md's harness-traps entry on backgrounded-tab animation stalls.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 12. Sustained loud passages relax back to baseline too fast
`status: ready` · added 2026-08-29

**Do** — slow the relative mapping's long-term energy floor so a loud section
keeps reading as loud, instead of the drive relaxing back toward its resting
value a couple of seconds after the loudness arrives.
**Why** — `pnpm probe`'s own "Full track" table shows it: `level` hits 1.00 at
0.75s into a loud section and has already relaxed to 0.53 by 5.25s, while the
underlying audio has not changed. The floor (`longEnergy`, attack 1.5s) rises
to meet the new loudness almost as fast as `level` itself moves, so the
normalizer chases the music instead of measuring it against a stable recent
history. Beat-to-beat response is fine — the same probe's 120bpm test shows a
0.677 swing with `break` correctly pinned near 0 — so this is specifically
about sustained dynamics (a section staying loud) reading as inert, which is
the shape of "feels poor in responding to the music."

**Decided**
- Scope: `relativeMapping`'s `longEnergy` envelope only, not `shortEnergy`,
  `bandEnv`, or the other two mappings. **Mine**, because the probe shows
  per-hit response (transient peak 0.985, beat swing 0.677) already working —
  widening the fix to constants that measure correctly would risk trading away
  behaviour that isn't broken to fix behaviour that is.
- Direction: raise `longEnergy`'s attack from 1.5s toward something at least
  as slow as its own 4.0s release (rather than faster than release, which is
  the mismatch causing this). **Mine**, because a "recent history" floor that
  rises faster than it falls cannot describe a *recent history* — it describes
  the current instant. The exact value is a build-time call against the
  probe's own numbers, not one to pin without re-running it.

**Lands in** — `src/engine/fast.ts`, `relativeMapping()`'s `longEnergy = new
Envelope(1.5, 4.0)` line only.
**Done when** — in `pnpm probe`'s "Full track" section, `level` during the
9.00s–12.75s recovery stays at or above roughly 0.6 through at least t=11s
(currently falls to 0.58 by 11.25s and keeps falling), while the 120bpm
beat-pattern swing stays at or above its current 0.677 — sustained response
must not cost per-hit response.
**Verify** — `pnpm probe` is the primary evidence (this is what surfaced the
problem and what proves the fix). Also `pnpm build`, `pnpm lint`. No on-screen
check — a DSP constant with no shared UI surface — but confirm by ear against
real music before calling it settled, since a synthetic flat-band probe cannot
prove *feel*, only rule out regressions.
**Hard stops** — prefs no · url no · capture no · dependency no.
