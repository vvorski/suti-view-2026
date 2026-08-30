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
`status: done` · added 2026-08-29 · shipped at build 88

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
`status: done` · added 2026-08-29 · shipped at build 90

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
where a segmented-looking band would sit under text. **Checked and clear:**
texture only ever lands on `Opacity`, which never sits under an option band's
text in any group — the concern doesn't materialise given the final scope.

**Build note:** Listening has no scalar band at all — its one control, Map, is
an enum band, and enum bands are the ones explicitly excluded from texture
above. So "ticked, like a measure" was never drawn as new stroke treatment;
Listening's identity rests on being the only single-band group and its own
icon instead. Recorded in `docs/hud-design.md` rather than silently dropped —
see "Listening — no texture, because it has no value band" there. Confirmed
this doesn't fail the greyscale test: Listening (1 band) and Camera (4 bands)
are structurally distinct from the 6-band geo/atm pair on sight, and geo vs
atm — the one pair identical in band count and type — are told apart by
Opacity's solid-vs-halo texture, checked directly in greyscale.

### 8. Let the buzz report how hard you shook
`status: done` · added 2026-08-29 · shipped at build 91

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
- A haptics library instead of hand-written patterns → **no library, improve
  the patterns here.** Asked and answered 2026-08-29. It is the dependency
  hard stop, and it buys nothing that would help: Safari implements no
  Vibration API at all, so no library can produce an iPhone buzz, and on
  Android every one of them is a wrapper over `navigator.vibrate` — which
  `haptics.ts` already wraps, with motor spin-up patterns, reduced-motion
  suppression and instrumented status that a generic wrapper would not have.
  This entry is where that effort goes instead.

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

**Build note.** `takeStrong`/`takeDouble` return `number` in place of
`boolean` — the peak in m/s², or 0 for "nothing fired" — rather than adding a
sibling getter: `peak` never reaches 0 for a real detection (it takes at
least `STRONG_UP` to fire), so every existing `if (shake.takeStrong())`
call site keeps working unchanged. `STRONG_UP` is now exported from
`shake.ts` so `haptics.ts` shares the exact same floor rather than a second
copy of the number that could drift. Scaling only ever multiplies *up* from
the existing baseline patterns (1x at the floor, up to 1.8x at
`PEAK_CEILING` = 45 m/s², matching `probe-shake.ts`'s own "violent shake"
case) and only touches the *on* pulses — never the gaps, which are the
entire signal that tells a single confirmation from a double. `pnpm
probe:haptics` is new: stubs `navigator.vibrate`, imports `haptics.ts`
directly, and asserts the floor reproduces the untouched baseline, the
ceiling scales by exactly `MAX_SCALE`, scaling is monotonic, and nothing
ever drops below baseline.

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
`status: done` · added 2026-08-29 · shipped at build 94

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

**Build note.** Shipped as `Envelope(4.0, 4.0)` — attack matching release
exactly, per the Decided direction above. Swept 1.5 through 4.0 first, and
the two literal Done-when numbers turned out to trade against each other at
*every* value above 1.5, not just some: raising the attack at all moves the
beat-pattern swing below 0.677 before the sustained recovery even reaches
0.6 (e.g. at 1.55, swing is already 0.673 while `level`@11.25s is still
0.58). No value satisfies both thresholds as literally written. **Mine**:
took this as the swing number having been an incidental fact about the *old*
attack, not a requirement to hold exactly — the Why section's actual
constraint is "must not cost per-hit response", and every value tested still
reads beats clearly (even at 4.0, swing is 0.575 against 0.985 unchanged
transient peak; a beat pattern with `break` still pinned at 0.000 and level
still swinging 0.39–0.96). Chose 4.0 over splitting the difference (e.g.
3.0, swing 0.603) because it is the value the entry's own Decided section
pointed at, and because sustained recovery is the actual complaint this
entry exists to fix — at 4.0, `level` at t=11.25s is 0.74 and stays above
0.6 through 14.25s, against 0.58-and-falling before. Verified nothing else
in `pnpm probe` moved: novelty, roughness, ripple triggers and frame-rate
independence are all identical to before.

### 13. The double shake's window is too short for a human hand
`status: done` · added 2026-08-29 · shipped at build 96

**Do** — give the escalation its own timer instead of borrowing
`STRONG_COOLDOWN`, and set it long enough that two deliberate shakes with a
natural pause between them still read as a double.
**Why** — on Victor's phone with `?debug`, two shakes flash white and never
red: singles are detected and the escalation never fires.

**Decided**
- Is this a detector fault or a window fault → **window.** Confirmed on the
  phone before writing this: the flash goes white, so `detectStrong` is firing
  and only the escalation is missing. That rules out the whole family of
  sensor faults `SUSTAIN_LEVEL` exists to cover, and rules out `QUIET_GAP`,
  which arms *earlier* the longer the pause is.
- Why the window is the suspect → arithmetic, not a hunch. `STRONG_COOLDOWN`
  is 1.5s measured from the *first* fire (`shake.ts:347`), and the second
  shake has to be fully earned inside what is left of it — three reversals at
  a hand's ~4 Hz is about 0.75s on its own. That leaves under 0.75s for the
  pause, and a deliberate pause between two shakes is longer than that. The
  probe never caught it because its only double case spaces them **0.35s**
  apart (`probe-shake.ts:175`), which is faster than a hand can pause.
- Two timers or one longer one → **two.** **Mine**, because one constant is
  currently doing two unrelated jobs — "one shake must not fire twice" and
  "how long the escalation stays armed" — and simply raising it would weaken
  the first to fix the second. This is the second-tenant refactor CLAUDE.md
  asks for as part of the change, not after it.
- `DOUBLE_WINDOW` = 3.0s → **Mine**, over 2.0 and 4.0. It has to hold a pause
  (~1s) plus a second shake earning itself (~0.75s) plus hesitation, which 2.0
  barely does and is what the current 1.5 fails at. Above ~4s a person who
  shakes, looks at the result, and shakes again gets an unasked-for shuffle;
  3.0 sits below that.
- What "two shakes, 2s apart" means → **a double, where today it is asserted
  to be two singles** (`probe-shake.ts:218`). **Mine**, and the one call here
  worth disagreeing with: it changes what the gesture *is*. Two shakes two
  seconds apart is a person asking twice, not a person shaking twice by
  coincidence. The rejection case it currently provides is replaced by the
  same pair spaced 4s, which keeps the property that matters — that unrelated
  shakes minutes or seconds apart do not shuffle the picture.
- Does the buzz change → **no.** `DOUBLE_PATTERN` is already distinct and
  already ships; nothing about it depends on the window.

**Lands in**
- `src/shake.ts:80` — `STRONG_COOLDOWN` keeps its 1.5s and its current job; a
  new `DOUBLE_WINDOW` sits beside it with the reasoning above.
- `src/shake.ts:343-385`, `detectStrong` — `escalating` currently reads
  `this.cooldown > 0` (line 346). It needs its own countdown, set alongside
  the cooldown at lines 322 and 381, and read at 375. `armedForDouble` and
  `quietFor` are unchanged.
- `scripts/probe-shake.ts:173-184` — the 0.35s case stays (a fast double must
  keep working); add one at a human cadence, ~0.9s of quiet between the two
  bursts; change the 2s case's expectation to a double and add a 4s case
  expecting none.

**Done when** — `pnpm probe:shake` reports ≥1 double for the 0.35s case, ≥1
for the new 0.9s case, ≥1 for the 2s case, and 0 for the 4s case, with the
knock-plus-rebound row still at 0 strongs and 0 doubles. Then on the phone:
two shakes with a comfortable pause flash **red**.
**Verify** — `pnpm probe:shake` is the primary evidence and the knock rows are
the regression guard. Also `pnpm build`, `pnpm lint`. No HUD surface changes,
so no 320×568 / 360×640 check is owed — but the phone check above is not
optional, because a window tuned for a hand cannot be proven by a synthetic
sinusoid.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 14. Both ends of every value band are off the screen
`status: done` · added 2026-08-29 · shipped at build 97

**Do** — give scalar bands their own angular span, inside the quadrant the
screen actually occupies, and use it for the track, the fill, the knob and the
drag alike.
**Why** — 100% cannot be set on any colour or opacity band, because the angle
it lives at is off the right edge of the screen; 0% has the same problem off
the bottom.

**Decided**
- Is this really unreachable, or just fiddly → **unreachable, and both ends,
  not one.** Measured rather than eyeballed: the hinge is at `(w+10, h+10)`
  (`hud.ts:746`) and the sweep is 165°–285° (`hud.ts:52`), so at 320×568 the
  on-screen part of every scalar band runs 14%–86%, and at the innermost
  radius only 17%–83%. The same at 360×640 and 390×844 — it barely moves,
  because both the radii and the hinge scale with the viewport.
- Root cause → **a 120° sweep about a corner hinge cannot fit in a 90°
  corner.** From a bottom-right hinge the screen occupies exactly the angles
  between 180° and 270°; the sweep is 30° wider than that, so 15° hangs off
  each end, and the `+10`px offset takes a little more. This is why no drag
  technique fixes it: `angleFrom` uses only the angle, and the 285° ray is
  outside the viewport at *every* radius, not just at the band's.
- Why RGB and not the enum bands → enum bands are read at the notch (225°),
  dead centre of the quadrant, and are spun past it. Their ends being
  off-screen costs nothing. Only `ScalarBand` maps a value onto the sweep's
  ends, which is why this presents as "can't set RGB to 100".
- Span → **190°–260°**, symmetric about the 225° notch as the current one is,
  so 50% stays where it is. **Mine**, over 186°–264° and 192°–258°: at 320×568
  it puts both ends 8.3px inside the viewport (10.6px at 360×640), where 186°
  leaves 1px — no margin at all — and 192° spends another 4° of travel to buy
  margin the 24px grab arc already provides.
- The drawn track shrinks too, rather than keeping the full sweep as a rail →
  **shrinks.** **Mine**, because a track whose end cannot be reached is lying
  about its range, which is the actual bug rather than a side effect of it.
  Scalar bands will therefore be visibly shorter arcs than the enum bands and
  the tick rim; that reads as the two kinds of control being different kinds,
  which they are.
- Cost, named rather than discovered later → the full range now spans 70°
  instead of 120°, so every value band is about 1.7× more sensitive per degree
  of thumb travel. At the innermost band that is still ~129px of arc for
  0–100%, or under 1% per pixel. Acceptable for a colour gain; if it ever is
  not, the answer is a finer band, not a wider sweep.

**Lands in**
- `src/hud.ts:52` — a `SCALAR_A`/`SCALAR_B` pair beside `SWEEP_A`/`SWEEP_B`,
  carrying the quadrant reasoning above. `SWEEP_*` keeps the wedge, the tick
  rim and the enum bands.
- `src/hud.ts:588`, `angleToUnit` — the only place a pointer angle becomes a
  value; it reads `SWEEP_*` today and must read `SCALAR_*`.
- `src/hud.ts:879-885`, `paint`'s scalar branch — `va`, `fillD` and the knob
  all derive from the `a0`/`a1` set at line 849; the scalar branch needs the
  scalar pair instead.
- `src/hud.ts:778` and `:833` — the drawn track and the `GRAB_PX`-wide hit arc
  for scalar bands, both currently `arcPath(r, a0, a1)`.

**Done when** — on `hud-probe.html` at 320×568 and at 360×640, dragging any
colour band to each end reads `R 100` and `R 0` in its caption, with the knob
visibly inside the screen at both; and the same for an opacity band. Today the
same drag stops at roughly 85 and 15.
**Verify** — the on-screen check above is the evidence, at both sizes, per
CLAUDE.md; `hud-probe.html` reaches the HUD without the mic gate and can be
driven from `javascript_tool`. Also `pnpm build`, `pnpm lint`. Check one enum
band still spins across its full sweep afterwards — that is the property most
at risk from touching shared angle constants.
**Hard stops** — prefs no (values stay 0–1; only the angle they sit at moves)
· url no · capture no · dependency no.

**Build note.** `hud-probe.html`'s `bandPoint(i, t)` gained a third param,
`scalar` (default `false`, matching every existing enum-band call site
unchanged), since it now has to know which span to aim at. **Mine**: a
default that preserves every prior call rather than requiring every caller
to be touched. Verified on screen at 320×568 and 360×640 via
`hud-narrow.html`: dragging the R band to each extreme now reads `R 100`
and `R 0` with the knob clearly inside the viewport both times (previously
stopped short of both ends), and a `View` enum band still spins its full
range and commits correctly — confirms `SWEEP_*` and `SCALAR_*` didn't
cross-contaminate.

### 15. Shuffle depth follows how hard you shook
`status: done` · added 2026-08-29 · shipped at build 98

**Do** — make the shake's intensity decide *how much* of the picture is
re-rolled, from a bare re-seed at the gentlest qualifying shake up to
everything at the hardest, instead of the current two fixed outcomes.
**Why** — the shake is the app's one eyes-free gesture and it currently has
two settings, on and more-on; the detector already measures how hard it was
and throws that number away at the moment it decides what to change.

**Decided**
- Graded or on/off → **graded**, as a deterministic ladder of thresholds, over
  rolling each parameter with a probability proportional to intensity.
  **Mine**, because a probabilistic version can hand back a hard shake that
  changed almost nothing by luck, which is the same complaint as today's, and
  it cannot be asserted in a probe. A ladder is predictable and testable, and
  "more things changed" is the readable property either way.
- Where the number comes from → **`peak`, already returned by `takeStrong()`
  and `takeDouble()`** (`shake.ts:476`, `:490`). No plumbing needed: `main.ts`
  already binds it as `strongPeak`/`doublePeak` (`:448`, `:458`) and passes it
  to the buzz. It is used at the shuffle site as a truthiness check and
  nothing more.
- Not `disturb` → it saturates. The probe table is the evidence: a deliberate
  28 m/s² shake, a violent 45 m/s² shake and a single hard knock all read
  `disturb` 0.98, so everything this entry wants to tell apart is already the
  same number. Same call entry 8 made, for the same reason.
- The 0–1 scale → **`(peak - STRONG_UP) / (PEAK_CEILING - STRONG_UP)`,
  clamped**, which is exactly the scale build 91 calibrated for the buzz:
  `STRONG_UP` (18) is the least peak that can ever reach a caller, and
  `PEAK_CEILING` (45) is `probe-shake.ts`'s own violent case. Do not invent a
  second scale.
- Where it lives → **move the 0–1 normaliser into `shake.ts` and export it**;
  `haptics.ts` derives its 1..`MAX_SCALE` multiplier from it rather than
  recomputing from the two constants. **Mine**: this is CLAUDE.md's
  export-rather-than-duplicate rule arriving on schedule — one intensity
  scale, two consumers, and `haptics.ts` already says in as many words that a
  plain 0–1 number wants somewhere to plug in.
- The ladder, each rung including the ones below it → re-seed always · **0.20**
  adds both layers' colours · **0.45** adds the merge modes · **0.70** adds
  both views · **0.90** adds opacity, mapping and the camera layer's colour.
  **Mine**, ordered by how little of what you had survives: a colour shift is
  recognisably the same picture, a view change is a different instrument. In
  the probe's own terms a deliberate 28 m/s² shake lands at 0.37 (colours) and
  the violent 45 at 1.0 (everything), which is the spread this is for.
- Opacity, which entry 6 excluded → **in, at the top rung, floored at 0.35.**
  You asked for everything scrambled at a hard shake; the floor keeps the
  reason it was excluded, which was that a shuffle able to hand back a black
  screen looks like a crash and is recoverable only by shaking at nothing.
- Mapping, which entry 6 also excluded → **in, at the top rung only.** Entry 6
  ruled it out as "how it hears, not what it looks like", and that is
  overturned deliberately: at the top of the scale the ask is a different
  instrument, not a different palette. Flagged because it reverses a recorded
  decision rather than filling a gap in one.
- The camera → **still never switched on, at any intensity.** Not a taste call
  and not reachable by "everything": turning a sensor on without a gesture
  asking for it is the capture hard stop. The camera *layer's colour* rolls at
  the top rung, which changes a colour and not a permission.
- Does the double survive → **yes: a double is a full scramble regardless of
  peak.** **Mine**, and the load-bearing one. A phone whose accelerometer
  clips at 2g can never produce a peak near 45, so on that hardware the ladder
  compresses to its bottom rung and there would be no way to ask for
  everything — the same class of silent, device-specific dead end the
  sustained path in `shake.ts` exists to cover. The double is the
  deterministic route, and intensity is the expressive one.
- Build order → **entry 13 first.** It stops being a nicety once the double is
  the guaranteed route to a full scramble: today that gesture never fires at
  all.

**Lands in**
- `src/shake.ts` — export the 0–1 normaliser beside `STRONG_UP`; no change to
  detection.
- `src/haptics.ts` — `intensityMultiplier` consumes the shared normaliser
  instead of recomputing it from the two constants.
- `src/main.ts:186-207`, `shuffled()` — takes the depth and returns only the
  fields that rung includes, so a caller cannot apply more than was earned.
  The 0.2 colour floor already there stays; opacity gets its own 0.35 floor.
- `src/main.ts:448-467` — the double branch asks for a full scramble; the
  strong branch passes `strongPeak` through instead of testing it.
- `scripts/probe-shake.ts` — print `peak` and the resulting depth per case.

**Done when** — `pnpm probe:shake` prints a depth per case, and the gentle
sustained 12 m/s² case re-seeds only, the deliberate 28 case reaches colours
and no further, and the violent 45 case reaches everything; the double case
reaches everything at any peak. Then on the phone: a gentle qualifying shake
visibly changes only the pattern, a hard one changes the views, and the HUD
opened afterwards shows values matching whichever happened.
**Verify** — `pnpm probe:shake` for the ladder and `pnpm probe:haptics` to
prove the shared normaliser did not move the buzz scaling build 91 just
calibrated. Also `pnpm build`, `pnpm lint`, and the on-screen check at 320×568
and 360×640 because the HUD must show the shuffled values.
**Hard stops** — prefs no (writes existing fields) · url no · capture **no,
explicitly: no rung switches the camera on** · dependency no.

**Build note.** `Hud.adopt()` gained `geoAlpha`/`atmAlpha`/`mapping` fields,
all optional — needed because `shuffled()` now has to reach opacity and
mapping at the top rung, and `adopt()` previously had no way to apply either.
`shuffled(prefs)` became `shuffled(depth)`: the old version always returned
every field (harmlessly re-applying the current value when a rung wasn't
reached), which would have been actively wrong for mapping specifically —
`onMapping` re-creates the live `Mapping` instance and discards its envelope
state, so a shuffle that didn't reach the top rung would have thrown that
state away for nothing on every single shake. The new version omits a field
entirely below its rung, and `adopt()`'s existing `if (next.x)` guards do the
rest. Confirmed on screen via `hud-probe.html`: called `hud.adopt()` directly
(a shuffle isn't reachable through a pointer gesture) with all four top-rung
fields set, and every HUD band — geo/atm Opacity, cam R/G/B, the Listening
group's Map selection — showed the adopted values after opening. `pnpm
probe:shake`'s new depth column matches the entry's own worked numbers
exactly: the 12 m/s² sustained case depths at 0.00, the 28 m/s² deliberate
case at 0.36 (entry estimated 0.37), the 45 m/s² violent case at 0.94, and
every double case at 1.00 regardless of its own measured peak.
`pnpm probe:haptics` unchanged after moving `PEAK_CEILING` into `shake.ts`.

### 16. Start reads bigger, and the disc breathes instead of ticking
`status: done` · added 2026-08-29 · shipped at build 99

**Do** — raise the Start label's type a step, and add a slow scale breathe to
the disc on a period that does not divide into the ring's, so the two never
settle into a repeating beat.
**Why** — the label is at its 0.82rem floor on every phone width, and the one
piece of motion on the screen is a single 3.4s cycle that repeats identically
and reads as a tick rather than as something alive.

**Decided**
- What "bigger" is → **`clamp(0.95rem, 4vw, 1.15rem)`**, from
  `clamp(0.82rem, 3.4vw, 1rem)` (`index.html:176`). **Mine**, and worth
  knowing why it is the floor that matters: 3.4vw is 10.9px at 320 and 12.2px
  at 360, so the middle term never wins on a phone and the label is 13.1px
  everywhere. The new floor makes it 15.2px, about a sixth bigger, and the cap
  only ever applies on a tablet.
- Does this disturb entry 4 → **no.** That entry made the QR bigger than
  Start, and it is the *disc* that is measured — `min(36vw, min(20vh, 8rem))`,
  about 114px at 320×568, against the QR's ~154px. The label grows inside a
  disc that does not, so the relationship entry 4 fixed is untouched. "START"
  at 15.2px with its 0.14em tracking is about 56px wide in a 114px disc.
- Nor the byline → the screen's rule is that exactly one thing dominates, the
  filled disc. Louder type *inside* that disc serves the rule rather than
  competing with it, which is not true of anything outside it.
- CSS or a JS frame loop → **CSS, and this is not a preference.** Entry 3
  deliberately capped the start screen's idle frame rate at build 84; driving
  a pulse from `requestAnimationFrame` would spend exactly what that entry
  saved. Transform and box-shadow animations are composited and cost the app's
  loop nothing.
- How the motion becomes non-linear without a frame loop → **two animations on
  incommensurate periods.** The ring keeps 3.4s; the breathe runs at 5.9s, so
  the pair returns to the same phase roughly every 200s rather than every
  cycle. That is what stops it reading as a metronome, and it is free.
- The breathe itself → **`scale`, 1 to 1.035, `alternate`, on a
  `cubic-bezier(0.4, 0, 0.2, 1)`.** **Mine**: about 4px of growth on a 114px
  disc, which is "lightly"; `alternate` mirrors the easing so it dwells at
  both ends the way breathing does, where a 0-100% keyframe loop snaps back.
- Use the `scale` property, not `transform: scale()` → **required, not
  stylistic.** `#start:active` already sets `transform: scale(0.97)`
  (`index.html:191`), and an animation on `transform` outranks it, so
  animating that property would silently delete the press feedback. `scale` is
  its own property and composes with the `transform` on `:active`.
- Does the ring survive → **yes, both run.** **Mine**, and the call worth
  disagreeing with: "the button should pulsate" could mean replacing it. They
  do different jobs — the ring says *which* thing to press, which is its
  stated purpose in the comment above it, and the breathe says the thing is
  live. On a screen with one deliberate focal point, both point at the same
  place.
- Reduced motion → **already handled, and check it stays that way.**
  `index.html:247` sets `#start { animation: none }`, which is the shorthand
  and so kills both. The breathe must therefore be an `animation`, not a
  `transition` loop, or it escapes that override.

**Lands in**
- `index.html:176` — the label's `font-size`.
- `index.html:178` — the `animation` shorthand gains the second animation.
- `index.html:184-188` — a `@keyframes start-breathe` beside `start-pulse`.
- `index.html:192` — `#start:disabled` sets `animation: none`; confirm that
  still stops both, which it does as a shorthand.

**Done when** — at 320×568 the Start label renders at 15.2px against today's
13.1px, in a disc whose diameter is unchanged and still visibly smaller than
the QR; the disc's `scale` varies between 1 and 1.035 over 5.9s while the ring
keeps 3.4s; pressing it still visibly depresses to 0.97; and with
`prefers-reduced-motion: reduce` the disc is completely still.
**Verify** — the on-screen check at 320×568 and 360×640, which is the whole of
the evidence here: the gate is the first thing on screen and needs no probe
page to reach. Emulate reduced motion in devtools for the last clause. Also
`pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no. All of it is
CSS in `index.html`.

**Build note.** Verified on screen via a fresh iframe pair sized exactly
320×568 and 360×640 (the same technique `hud-narrow.html` uses, since
`resize_window` doesn't reliably change what `index.html` itself measures
here — see CLAUDE.md's harness-traps list). `getComputedStyle(#start).fontSize`
reads exactly 15.2px at both sizes (up from the old 13.1px), the disc stays
~114px/~128px, `getAnimations()` shows both `start-pulse` and `start-breathe`
running, and the `@media (prefers-reduced-motion: reduce) { #start }` rule
still resolves to a full `animation: none` shorthand, confirmed by reading
its serialised `cssText` directly rather than only trusting the source.

### 17. In fullscreen the circles are ellipses
`status: done` · added 2026-08-29 · shipped at build 101

**Do** — size the drawing buffer from the canvas's own client box rather than
from `window.innerWidth`/`innerHeight`, and re-check it periodically, so the
buffer's aspect can never disagree with the box it is stretched across.
**Why** — in fullscreen every round thing is an ellipse, which means the
canvas is being scaled by different factors on the two axes.

**Decided**
- Where it is *not* → **the shaders, by construction.** Every view normalises
  with `(gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x,
  uResolution.y)` — one scalar for both axes, so a circle is round in the
  drawing buffer whatever the buffer's shape. Worth stating because "circles
  are not round" reads like a shader bug and thirteen shaders is a long place
  to look.
- Where it is → **the buffer and the CSS box disagree.** `#canvas` is
  `position: fixed; inset: 0; width: 100%; height: 100%`
  (`index.html:44-50`), so CSS always paints it across the whole viewport,
  while `applySize` sizes the buffer from `window.innerWidth`/`innerHeight`
  (`scene.ts:341`). Two numbers for one quantity; when they differ the browser
  stretches the buffer to fit, on each axis independently, and that is exactly
  an ellipse.
- Why fullscreen specifically → the viewport changes shape at a moment when
  nothing reliably re-reads it. `resize` is the only trigger bound
  (`main.ts:409`), fullscreen does not dependably fire one before the viewport
  has settled, and `permission-gate.ts:104` already watches `fullscreenchange`
  but records the state and says in as many words that it deliberately does
  not act on it. Same shape as the iOS rotation bug already patched at
  `main.ts:410-413` with a delayed second resize — this is that bug's other
  half, unpatched.
- Why `setSize(..., false)` makes it invisible rather than obvious → the
  `false` tells three not to touch the canvas's style, which is right, CSS
  owns the layout. The side effect is that a stale size shows up as silent
  distortion instead of as a canvas that is visibly the wrong size.
- Fix → **read `canvas.clientWidth`/`clientHeight` in `applySize`.**
  **Mine**, over adding a `fullscreenchange` listener: the listener fixes this
  instance, the client box removes the class. The canvas's client box *is* the
  rectangle CSS is stretching the buffer across, so sizing from it makes the
  two numbers one number. `window.innerWidth` was always a proxy for it.
- Plus a re-check every 30 frames in the render loop → **Mine.** A listener
  can only catch causes someone thought of, and this file's own history is a
  fullscreen fault that survived several builds with nobody noticing.
  Comparing the client box to the last applied size is two reads and a branch;
  at 30 frames it is twice a second, which bounds any distortion to about half
  a second and keeps the layout reads far away from a per-frame cost. The
  existing `resize` listener stays as the immediate path so a rotation does
  not wait for the tick.
- Not a per-frame check → reading `clientWidth` can force layout, and paying
  that 60 times a second to fix something that changes twice a session is the
  wrong trade.

**Lands in**
- `src/scene.ts:339-350`, `applySize` — the two `window.inner*` reads become
  the canvas's client box; everything downstream (`getDrawingBufferSize`,
  `uResolution`, both render targets, `applyCameraFit`) already derives from
  that and needs no change.
- `src/scene.ts`, the render loop beside `adapt()` — the frame counter and the
  size comparison.
- `src/main.ts:409-413` — unchanged, but read it first: the delayed
  re-resize there is the precedent this generalises.

**Done when** — in devtools on the running app, `canvas.width /
canvas.height` equals `canvas.clientWidth / canvas.clientHeight` to within a
pixel's rounding, both in and out of fullscreen, and immediately after
entering fullscreen rather than only after a rotation. On the phone with
`?geometric=circles`, a circle measures the same across as it does down in
fullscreen; today it does not.
**Verify** — the on-screen check at 320×568 and 360×640, and the fullscreen
check on a real handset, because Chrome refuses fullscreen to a window that is
not frontmost and an automated one therefore proves nothing — the reason
`probe-fullscreen.ts` stubs the API rather than driving it. Also `pnpm
probe:fullscreen` unchanged, `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Build note.** Verified what this harness can actually verify: with
`?geometric=circles`, `canvas.width/canvas.height` matches
`canvas.clientWidth/canvas.clientHeight` to full floating-point precision in
a normal window, and in *both* a 320×568 and a 568×320 iframe (a portrait and
a landscape box are the structural stand-in for what fullscreen or a rotation
actually changes — the aspect the canvas is stretched across). Both `pnpm
build` and `pnpm lint` clean; `pnpm probe:fullscreen` unchanged, as expected —
this entry doesn't touch the fullscreen request path, only what sizes the
buffer.

**Not verified here, and said so rather than claimed otherwise:** the 30-frame
periodic re-check (`checkSize()`) needs the render loop to actually advance,
which runs on `requestAnimationFrame` — and rAF never fires in this session's
non-frontmost automation window (already in CLAUDE.md's harness-traps list).
So the *initial* sizing fix is confirmed on screen; the periodic catch-all's
live behaviour, and real fullscreen entry on a handset, are exactly what the
entry's own Verify section already flags as needing a real device — still
owed there.

### 18. A tap along the bottom saves the frame
`status: done` · added 2026-08-29 · shipped at build 102

**Do** — a tap in a band across the bottom of the screen writes the current
canvas to a PNG the phone saves, instead of opening the HUD.
**Why** — the picture is the point of the app and there is no way to keep one.

**Decided**
- **Capture hard stop → licensed by Victor, 2026-08-29, camera included.**
  Asked as "a screenshot persists a frame to the device — do you license it?",
  answered **"Yes — including camera frames"**. So the saved PNG is whatever
  the canvas holds, live passthrough and all, and this entry deliberately does
  not refuse the capture while camera opacity is non-zero. Nothing uploads,
  no network request, no new permission prompt; the file goes to the phone
  the person is holding.
- Gestures → **unchanged.** Asked, answered "leave swipes alone, only add the
  screenshot tap". Vertical swipe still re-rolls, horizontal still moves the
  atmospheric programme, and the camera is still raised by its opacity band in
  the HUD — there is no camera *mode* and no gesture for it, which is worth
  writing down because the request assumed otherwise.
- The blank-PNG trap → **capture inside the render loop, not in the tap
  handler.** `WebGLRenderer` is built without `preserveDrawingBuffer`
  (`scene.ts:154-159`), so the buffer is cleared after compositing and
  `canvas.toBlob()` from an event handler returns an empty image. The tap sets
  a flag; the loop calls `toBlob` immediately after `renderer.render()` on the
  next frame. **Mine**, over setting `preserveDrawingBuffer: true`: that costs
  a buffer copy on every frame forever, on a mobile target, to serve a tap
  that happens twice a session.
- Where the band is → **full width, the bottom 15% of the viewport, sitting
  above `env(safe-area-inset-bottom)`.** **Mine**: 15% is about 85px at
  320×568, big enough to hit one-handed without taking tap-to-open away from
  the rest of the screen, and the inset keeps it clear of the home indicator
  and the Android gesture bar, which own the very bottom edge. `index.html`
  already uses that inset in two places.
- Tap versus swipe → the band fires only if the pointer went down *and* up
  inside it having travelled less than `TAP_SLOP_PX` (12, already defined in
  `hud.ts:88` as exactly this boundary). A swipe that starts in the band still
  belongs to `gestures.ts`.
- While the HUD is open → **the band is inert.** The panel owns the screen
  then, and `gestures.ts` already sets the precedent by ignoring anything
  landing on `.hud-scrim`.
- Confirmation → **one white flash, reusing `#shake-flash`.** **Mine**: the
  shutter flash is the universal idiom, the element exists with an `.on` class
  that does exactly this, and it needs no new DOM. Unlike the shake flash it
  is not gated behind `showStats` — this one is feedback, not diagnostics.
  No buzz: `haptics.ts` is deliberately narrow about not becoming a
  vibrate-on-every-interaction layer, and a tap you are looking at does not
  need one.
- Filename → **`suti-<build>-<release-name>-<timestamp>.png`**, e.g.
  `suti-91-soft-breathe-20260829-1432.png`. **Mine**, because `RELEASE_NAME`
  and `__BUILD_NUMBER__` are already in the bundle, and a screenshot that
  names the build it came from is the difference between a bug report you can
  act on and one you cannot.
- iOS Safari → **accepted as degraded, not worked around.** `<a download>` is
  not honoured there; it opens the image in a tab and the user long-presses to
  save. That matches how this project already treats the platform split —
  fullscreen is `unsupported` on iPhone and haptics are "a bonus on one
  platform, absent on the other". A `navigator.share({ files })` route would
  fix it and is deliberately **not** in this entry: it hands the file to an OS
  sheet that can send it somewhere, which is further than the licence asked
  for. Worth a separate ask if the tab behaviour proves annoying.

**Lands in**
- `src/scene.ts` — a `requestCapture()` on the visualiser interface
  (`scene.ts:118` is where `resize` sits) and the `toBlob` call after
  `renderer.render()` in the loop.
- `src/main.ts` — the bottom-band pointer listener, next to where
  `bindGestures` is wired, and the flash.
- `index.html` — nothing new to draw; the band is a hit test, not an element,
  so the screen gains no furniture. `#shake-flash` is reused as-is.

**Done when** — a tap in the bottom band on a phone produces a saved PNG whose
pixels match what was on screen (not a blank or black image), named with the
build number, while a tap anywhere above the band still opens the HUD and a
swipe starting in the band still re-rolls or changes the programme. With the
camera up, the saved file contains the camera frame — that is the licensed
behaviour, not a defect.
**Verify** — on the phone, because a blank capture is exactly what a desktop
browser with a different compositing path can fail to reproduce. Also the
on-screen check at 320×568 and 360×640 to confirm the band does not eat
tap-to-open, `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture **yes, licensed above** ·
dependency no.

**Build note.** `TAP_SLOP_PX` exported from `hud.ts` rather than a second
copy of 12 in `main.ts`. The band-vs-panel conflict is real: both the
screenshot tap and hud.ts's tap-to-open use the identical travel threshold,
so any qualifying screenshot tap would also qualify to open the HUD. Solved
by registering the band's `pointerdown`/`pointerup` pair on the *capturing*
phase — capture always runs before bubble regardless of registration order —
and calling `stopPropagation()` there when a tap both lands in the band and
qualifies, which halts the dispatch before it ever reaches hud.ts's
bubble-phase listener on `document`. A swipe starting in the band needs no
such guard: gestures.ts's own 60px threshold is already far past
`TAP_SLOP_PX` (12px), so nothing can satisfy both a screenshot tap and a
swipe on the same gesture. `env(safe-area-inset-bottom)` has no JS
equivalent, so `index.html` publishes it as a `--safe-bottom` custom
property on `:root`, read back via `getComputedStyle` — no new visible
element, matching the entry's own "the band is a hit test, not an element."

**Verified**: the filename format and the band's hit-test math, both checked
in isolation against the entry's own worked example (`suti-91-soft-breathe-
20260829-1432.png` — the isolated check reproduced this exact shape) and
against boundary cases with and without a safe-area inset. `pnpm build`,
`pnpm lint`, `pnpm probe:fullscreen`, `pnpm probe:shake`, `pnpm
probe:haptics` all clean.

**Not verified here, and said so rather than claimed otherwise:** the actual
save-a-PNG path needs the render loop to tick at least once after a capture
is requested (rAF, which never fires in this session's non-frontmost
automation window — CLAUDE.md's harness-traps list) and needs microphone
access to get past the gate at all, which the automated browser here left
permanently pending with no visible prompt. Both are exactly what this
entry's own Verify section already requires a real phone for — "a blank
capture is exactly what a desktop browser with a different compositing path
can fail to reproduce" — so this was never going to be fully provable here.
Still owed on a real device: an actual saved PNG with correct, non-blank
pixels, and confirming a tap above the band still opens the HUD and a swipe
starting in the band still fires.

### 19. A way back into fullscreen once it has been lost
`status: done` · added 2026-08-29 · shipped at build 105

**Do** — show a single circular fullscreen chip, on the icon arc, whenever
fullscreen has been lost and the platform supports getting it back.
**Why** — coming back to the browser drops you out of fullscreen and there is
no route back in: the exit is recorded and deliberately not acted on, so
nothing re-enters and nothing offers to.

**Decided**
- Do not simply re-arm the silent retry → **the deliberate-exit decision
  stands.** `permission-gate.ts:110` records an exit and says in as many words
  that it does not act on it, which is right: a tap that silently drags
  someone back into fullscreen they chose to leave is hostile. That decision
  is exactly *why* this wants a chip. An explicit control is the only way to
  offer the way back without fighting the person who left.
- When it shows → **`exited` and `refused` only.** Never `active`, and never
  `unsupported`: iPhone Safari has no element fullscreen at all
  (`permission-gate.ts:61`), and a button that can never work is worse than no
  button. The state is already tracked and already surfaced —
  `fullscreenStatus()` feeds the `full <state>` line in the debug readout
  (`hud.ts:1007-1012`).
- Where it sits → **the icon arc, in the slot a seventh chip would take.**
  Circular chips along an arc are the permitted vocabulary, and reusing the
  chips' own radius and step means it reads as one of them rather than as a
  floating button bolted on.
- Visible with the panel closed → **yes, and this is the implementation
  consequence worth planning for.** The point is to offer the way back the
  moment you notice, not after opening a panel. The chips live in the HUD's
  container, so this one has to be a sibling that borrows the arc geometry —
  which means `placeChips`'s maths gets exported rather than copied. That is
  CLAUDE.md's export-rather-than-duplicate rule, same as entry 15's intensity
  scale.
- **`placeChips` has to fit the row, not assume it.** It centres on
  `CHIP_ARC_MID` (`hud.ts:761`), so a seventh chip does not append a slot — it
  re-centres all seven and pushes the first one off the left edge. At 320×568
  the arc radius is 345.6px and the step is 8.8°, so six chips start at 210°
  and a seventh would start at 205.6°, putting the leading chip's left edge at
  **-5.7px**. The fix is to clamp the start angle to the smallest one that
  keeps that edge on screen — about 209° with a 4px margin — and lay out from
  there, so the row slides toward the reachable end instead of centring blind.
  **Mine**, and it is the refactor the repo asks to be part of the change:
  `CHIP_ARC_MID` is a hand-tuned constant chosen against a 320px screen, and
  this is the seventh of something.
- Nothing moves today → with six chips the centred start is 210°, already
  clear of the 209° clamp, so the clamp is inert until the seventh appears.
  That is the property to assert rather than to hope for.
- Room for exactly one more → the eighth slot would land at 271.6°, whose chip
  runs off the right edge. Worth recording so the next chip is not added on
  the assumption that the last one fitted.
- The glyph → four corner brackets, the universal fullscreen mark. Straight
  lines inside a chip are fine: the non-negotiable governs the *control
  surface*, and the `cam` icon (`hud.ts:225-228`) is already two straight
  brackets around a circle.
- Tapping it → calls the existing `goFullscreen()` (`permission-gate.ts:137`)
  unchanged. A chip tap is a user gesture, which is the one condition that
  call has.

**Lands in**
- `src/hud.ts:755-768`, `placeChips` — the start-angle clamp, and exporting
  the placement so a non-HUD element can sit on the same arc.
- `src/hud.ts:217`, `ICONS` — the new glyph.
- `src/permission-gate.ts` — nothing changes in `goFullscreen()`; the module
  needs to notify when `fsState` changes so the chip can appear and vanish
  without polling.
- `index.html` — the chip element, as a sibling of the HUD rather than inside
  it.

**Done when** — leaving fullscreen (switch apps and come back, or swipe out)
makes the chip appear within a frame or two; tapping it returns to fullscreen
and the chip disappears; on a platform reporting `unsupported` it never
appears at all. At 320×568 with the chip showing, all seven icons are fully on
screen, and with it hidden the six sit exactly where they do today — same
pixels, not merely similar.
**Verify** — on the phone, because leaving and re-entering fullscreen by
switching apps is the case that cannot be reproduced in a desktop browser, and
Chrome refuses fullscreen to a window that is not frontmost anyway. The
on-screen check at 320×568 and 360×640 covers the arc arithmetic. Also `pnpm
probe:fullscreen` unchanged, `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no (fullscreen prompts nothing
and captures nothing) · dependency no.

**Build note.** `permission-gate.ts`'s `fsState` assignments were all routed
through one `setFsState()` helper (previously seven direct assignments across
five call sites) so the new change-notification could not be added at only
some of them by accident — a bug class worth naming since it is exactly the
shape of fault this file's own history already has. Two of those call sites
had `fsError` set *after* the state change; reordered so a listener reading
`fullscreenStatus()` during the notification never sees a stale error message
paired with the new state.

`chipPosition(index, n, chipSize)` is a pure function exported from `hud.ts`
rather than a method on the `Hud` instance, since its one external caller (the
fullscreen chip in `index.html`) needs to compute a position for an element
`Hud` itself knows nothing about. `Hud.setFullscreenChipShown(shown)` is the
other half: it only tells the HUD's *own* six chips how many total slots to
share, so they make room before the external chip is shown.

Verified the regression this entry was most at risk of: driving
`setFullscreenChipShown(true)` then `(false)` on the real `hud.ts` returns
every one of the six chips to pixel-identical positions (`JSON.stringify`
equal, not merely close) to before either call. With it left `true`, at both
320×568 and 360×640, computed the would-be 7th chip's own rect via the same
exported `chipPosition()` the real element uses and confirmed all seven
bounding boxes stay on screen — leftmost edge 3.7px in at 320 wide, 5.9px at
360, matching the entry's own "~4px margin" prediction. `pnpm build`, `pnpm
lint`, `pnpm probe:fullscreen`, `pnpm probe:shake`, `pnpm probe:haptics` all
clean.

**Not verified here, and said so rather than claimed otherwise:** the actual
lost-and-regained fullscreen cycle needs switching apps and returning on a
real handset — Chrome refuses fullscreen to a window that isn't frontmost, so
nothing about entering or losing real fullscreen can be driven from this
automation session. The chip's static markup, its default-hidden state, and
its glyph were confirmed to exist correctly in `index.html`; whether it
actually appears within a frame or two of losing fullscreen on a phone is
exactly what the entry's own Verify section already requires a real device
for.

### 20. Shake answers before Start, and stands down while the panel is open
`status: done` · added 2026-08-29 · shipped at build 106

**Do** — start the motion listener on load wherever it needs no permission, so
shaking the start screen visibly tumbles the preview behind it, and drop the
discrete shuffle while the HUD is open.
**Why** — the shake is the app's signature gesture and nothing announces it;
the one screen where a person is holding the phone and not yet doing anything
is the one screen it does not work on.

**Decided**
- Teaching it → **wordlessly, by answering on the gate.** Asked, and the
  answer was the preview tumble over any copy. The canvas behind the gate is
  already drawing (`main.ts`'s idle params), so a shake that visibly knocks it
  about teaches the gesture before anything has been pressed, and build 66's
  decision to strip the gate to Start and the code stands untouched.
- What a gate shake does → **tumbles, and nothing else.** No re-seed, no
  shuffle, at any intensity. **Mine**: before Start there is no audio and the
  preview is a fixed idle programme, so re-rolling views would change what the
  person is about to walk into for reasons they cannot connect to anything.
  The tumble is already the continuous, thresholdless half of `shake.ts`,
  written to say "the device is being listened to" — this is that half doing
  exactly its stated job, not a new behaviour.
- Where it works → **Android on load, iOS still at the tap.**
  `DeviceMotionEvent.requestPermission` exists only on iOS and iPadOS, so
  feature-detect it: present means defer to the gate gesture exactly as today,
  absent means add the listener immediately. On iOS this is not a limitation
  to work around but a rule — the accelerometer is behind the same live-gesture
  requirement as the microphone, and `permission-gate.ts:236-255` documents the
  load-bearing order the three gesture-spending calls already have. Do not add
  a fourth claimant to it.
- A gesture that only works on one platform → accepted, consistent with how
  this project already treats the split: fullscreen is `unsupported` on
  iPhone, haptics are "a bonus on one platform, absent on the other". Nothing
  is lost on iOS that works there today.
- Reaching for a sensor before any gesture → **named rather than waved
  through.** Entry 6's rule is "nothing may reach for a sensor without a
  gesture asking for it", and this does. It is licensed by the answer above,
  and it differs from the camera case in every way that made that rule: no
  permission prompt, no OS indicator, nothing recorded, no network, and
  nothing persisted. If that reasoning does not hold, the fix is to drop the
  gate half and keep the panel half — they are independent.
- Shake while the HUD is open → **the discrete shuffle stands down; the tumble
  continues.** **Mine**: the tumble is ambient and harmless, but a shuffle
  rewrites the values the person currently has a finger on, which is the same
  fault as a control lying about its state. `gestures.ts` already excludes
  anything landing on `.hud-scrim`, and `main.ts:540` already tests
  `.hud-scrim.open` — reuse that selector rather than adding a second notion
  of "the panel is up".
- Dropped, not queued → the pending flags must still be **consumed and
  discarded** while the panel is open. Leaving them set means a shake made
  during editing fires the instant the panel closes, which is worse than
  either behaviour: the picture changes with no gesture anywhere near it.
- No buzz on the gate → `haptics.ts` is deliberately not a
  vibrate-on-everything layer, and a tumble is continuous, so there is no
  discrete event for a buzz to confirm.

**Lands in**
- `src/main.ts:442` — `startShake(motion)` moves earlier behind the
  feature test; the gate path keeps passing its own `motion` result.
- `src/main.ts`, the render loop's shake branch — the `.hud-scrim.open` guard
  around the `takeStrong`/`takeDouble` handling, consuming both regardless.
- `src/permission-gate.ts:255` — unchanged. Read the comment above it first;
  it explains why nothing new may be added to that gesture.

**Done when** — on an Android phone, shaking the start screen visibly tumbles
the picture behind the gate and changes nothing else about it; on iPhone the
start screen is unchanged. After Start, a shake with the panel open leaves
every band exactly where it was, and closing the panel afterwards does not
then fire a shuffle. The tumble still responds in both cases.
**Verify** — on the phone, both platforms if one is reachable, because a
desktop browser has no accelerometer and the whole entry is about when the
listener exists. `pnpm probe:shake` must pass unchanged — nothing here touches
detection. Also `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no (nothing stored; the wordless route avoids a
first-run flag) · url no · capture **yes, narrowly: the accelerometer starts
without a gesture on Android** — licensed above, with the reasoning and the
fallback recorded · dependency no.

**Build note.** `hasMotionPermissionGate()` (exported from `shake.ts`) is the
one feature test both the gate's early start and `requestMotionAccess()`'s
own gating now share — previously that check existed only inlined inside
`requestMotionAccess()`, and duplicating it in `main.ts` risked the two ever
disagreeing about which platform needs a gesture. `shake` moved from `const`
to `let`: on iOS/iPadOS it starts as the same harmless stub the
permission-refused path already returns, then gets replaced once the gate
gesture's own `motion` result is in — everywhere else it is the real sensor
from load and that replacement is a no-op check that changes nothing.

The panel-open guard wraps only the *actions* (shuffle, buzz, flash,
`director.suspend()`), not the consumption: `shake.takeDouble()`/
`takeStrong()` are still called every frame regardless, exactly preserving
the original mutual-exclusion structure (`if (takeDouble()) … else { const
strongPeak = takeStrong(); … }`) so a flag can never be left set to fire
later when the panel closes.

Verified what this harness can verify: `pnpm probe:shake`'s full table is
byte-for-byte identical to before this entry, confirming nothing here
touches detection, exactly as the entry requires. Unit-tested
`hasMotionPermissionGate()` in isolation against all three platform shapes
(no `DeviceMotionEvent` at all, `requestPermission` present, absent) since
this session's own automation Chrome happens to expose
`DeviceMotionEvent.requestPermission` and so cannot exercise the
"Android, starts immediately" branch live — confirmed instead by forcing
each shape directly. `pnpm build`, `pnpm lint`, `pnpm probe:fullscreen`,
`pnpm probe:haptics` all clean.

**Not verified here, and said so rather than claimed otherwise:** whether a
real shake on a real gate visibly tumbles the idle preview needs an actual
accelerometer and the render loop actually advancing (`requestAnimationFrame`
never fires in this session's non-frontmost automation window), so the
described behaviour is confirmed by code review and by every gate the code
does pass, not by watching it happen. Exactly what the entry's own Verify
section already flags as needing a real phone, both platforms if one is
reachable.

### 21. The shuffle's floors multiply, and the screen goes dark
`status: done` · added 2026-08-29 · shipped at build 108

**Do** — floor what a layer's brightness actually *is*, rather than flooring
each of the two numbers that produce it.
**Why** — a hard shake can leave the atmospheric layer at 7% brightness, and
it persists, which is the "everything got very dark" nobody could account for.

**Decided**
- The mechanism → **two independent floors that multiply.**
  `composite.frag.glsl:96` is `base = atmosphere * uAtmAlpha * uAtmColour`, so
  a layer's brightness is the *product* of its opacity and its colour gain.
  The shuffle rolls opacity in [0.35, 1] (entry 15) and each colour channel in
  [0.2, 1] (entry 6). Either floor alone is defensible; 0.35 × 0.2 = **0.07**,
  and there is nothing in the code that ever looks at the product.
- Whose mistake → **entry 15's, which is to say mine.** Entry 6 refused to
  roll opacity at all, and its stated reason was exactly this: a shuffle that
  can hand back a black screen looks like a crash. Entry 15 overturned that
  with a floor chosen by reasoning about opacity in isolation, next to a
  colour floor written for a different entry, and the two were never
  multiplied together. Recorded plainly because the next person to raise a
  floor here needs to know which mistake to avoid.
- Why it looked like it came from nowhere → the roll writes through to
  `prefs`, so a single unlucky hard shake survives a reload and every
  subsequent session. Nothing about the moment it happened is still visible
  afterwards.
- Fix → **a floor on the product, applied by lifting the dominant channel.**
  Opacity's floor rises to 0.5; after a colour is rolled, its largest channel
  is lifted to at least 0.5 if it is below. Worst case becomes 0.5 × 0.5 =
  **0.25**, against 0.07 today. **Mine**, and lifting the *largest* channel
  rather than scaling all three is the load-bearing detail: it preserves which
  channel dominates, so the roll keeps the hue it chose and only gains
  strength. Scaling all three would wash every dim roll toward grey and quietly
  remove half the palette the shuffle exists to explore.
- Not a floor on the composite → tempting, and wrong. The two layers combine
  through a merge mode that can be anything, so a composite-level floor would
  have to model every mode; the per-layer product is the quantity the shader
  actually multiplies and the one a floor can be reasoned about.
- Recovery, for anyone already dark → shaking again re-rolls, and since entry
  14 the opacity bands can be dragged to 100% again, so the HUD is now a real
  way out. That was not true when entry 6 wrote its warning.

**Lands in**
- `src/main.ts`, `shuffled()` — the `channel()`/`colour()` helpers and the
  `SHUFFLE_EVERYTHING` alpha rolls.
**Done when** — a hundred synthetic top-rung shuffles, run in a probe or a
console loop, never produce a layer whose `alpha * max(r, g, b)` is below
0.25, and the observed minimum today is around 0.07. On the phone, repeated
hard shakes never land on a screen that reads as off.
**Verify** — `pnpm probe:shake` unchanged (detection is untouched), `pnpm
build`, `pnpm lint`, and the on-screen check at 320×568 and 360×640 while
shaking hard enough to reach the top rung repeatedly.
**Hard stops** — prefs no (existing fields, same ranges) · url no · capture no
· dependency no.

### 22. A hard shake may raise the camera
`status: done` · added 2026-08-29 · shipped at build 112

**Do** — at the top rung only, sometimes roll the passthrough level, including
up from zero.
**Why** — the camera is the one layer the shuffle cannot touch, so "give me
something else entirely" can never hand back the room.

**Decided**
- **Capture hard stop → licensed by Victor, 2026-08-29.** Asked as "may a
  shake switch the camera on? that's the capture hard stop, refused three
  times so far", answered **"Yes — a hard shake may turn it on"**. This
  overturns a rule stated in entries 6, 15 and 20 and repeated in `main.ts`'s
  own comments as "not a taste call". Those comments must be corrected in the
  same change, not left contradicting the code.
- Which rung → **the top one only** (`SHUFFLE_EVERYTHING`, depth ≥ 0.90).
  **Mine**: the licence was for a *hard* shake, and switching a sensor on is
  the largest thing the shuffle can do, so it belongs where the ask is
  unambiguous rather than where a firm-ish shake could reach it.
- "Sometimes" → **one roll in three at that rung**, and when it rolls, a level
  in [0, 0.6]. **Mine**: zero is included deliberately, so the same gesture
  that can raise the camera can also put it away — `main.ts` already releases
  the sensor outright at zero. The 0.6 cap is because passthrough at 1 leaves
  the room and no visualiser, which is not a picture the shuffle should be
  able to hand you.
- **It may only raise the camera where permission already exists.** This is
  the technical wall, not a scruple: a `devicemotion` event carries no user
  activation, so `getUserMedia` called from the shake path has no gesture
  behind it. Where permission was already granted the stream opens; where it
  was not, the prompt is either suppressed or appears with nothing on screen
  to explain it. So the roll raises from zero only when the camera has
  already been granted — `navigator.permissions.query({ name: 'camera' })`
  where supported, and otherwise a session flag set the first time the camera
  came up. Everywhere else the roll skips silently and the rest of the top
  rung proceeds.
- Consequence worth stating → on a fresh install the camera can still only be
  started from the HUD, by hand. The shake inherits the permission; it never
  asks for it.

**Lands in**
- `src/main.ts`, `shuffled()` — the `SHUFFLE_EVERYTHING` block gains
  `passthrough`, guarded by the grant test.
- `src/main.ts:171-190` and `:596` — the comments asserting the camera is
  never switched on by a shuffle. They are now wrong; rewrite them to say what
  the rule became and who changed it.
- `src/camera.ts` — nothing new, but read how `startCamera` reports failure:
  a refused stream must leave passthrough at zero rather than at the rolled
  value, or the HUD will show a camera that is not running.

**Done when** — with camera permission already granted, repeated top-rung
shakes eventually raise the passthrough and eventually put it back to zero,
and the HUD's camera opacity band agrees with what is on screen each time.
With permission never granted, no number of shakes produces a permission
prompt or a non-zero passthrough.
**Verify** — on the phone, both with permission granted and in a fresh profile
where it is not, because the whole entry turns on that distinction and a
desktop browser's permission model is not the one that matters. Also `pnpm
build`, `pnpm lint`.
**Hard stops** — prefs no (existing field) · url no · capture **yes, licensed
above** · dependency no.

**Build note.** `applyPassthrough` and a new `hasCameraPermission()` were
factored out of the HUD's own `onPassthrough` handler in `main.ts` rather
than duplicated for the shake path — the two differ only in *who is allowed
to call this with a non-zero level*, which is `hasCameraPermission()`'s job,
not the passthrough logic's own. `hasCameraPermission()` tracks its own
`cameraEverGranted` session flag rather than relying solely on
`navigator.permissions.query`, since that API's 'camera' descriptor is not
universally implemented and the flag is the only answer available within a
single session before the very first grant.

The roll lives in a new `maybeRollCamera()`, not inside `shuffled()` itself:
raising the camera needs an async permission check `shuffled()` cannot make,
since it stays synchronous and pure for every other field. It runs as a
second, independent async step after `shuffle()` returns, and calls
`panel.adopt({ passthrough })` a second time once resolved — `Hud.adopt()`
gained a `passthrough` field for this, deliberately the only field in it
that never itself calls a handler: the caller has already done the asking
and the visualiser call by the time `adopt()` sees it, so `adopt()` only
ever needs to make the HUD's own opacity band agree with what already
happened.

The stale "the camera is never switched on at any depth" comment in
`shuffled()`'s own docstring — asserted by entries 6, 15 and 20 as
non-negotiable — is rewritten to say what the rule became and who changed
it, per this entry's own instruction not to leave code and comments
disagreeing.

Confirmed on screen via `hud-probe.html`: `hud.adopt({ passthrough: 0.42 })`
updates `prefs.passthrough` and the camera group's Opacity band caption
reads "Opacity 42" immediately. `pnpm build`, `pnpm lint`, `pnpm
probe:shake` all clean, the last unchanged — this entry adds a side effect
alongside an existing shuffle, not a new detection path.

**Not verified here, and said so rather than claimed otherwise:** the actual
permission-gated behaviour — a granted camera eventually getting raised and
lowered by repeated top-rung shakes, and a never-granted one never producing
a prompt or a non-zero passthrough — needs a real phone in both permission
states, which a desktop automation browser cannot meaningfully stand in for.
Exactly what the entry's own Verify section already requires a device for.

### 23. The picture answers the light in the room
`status: done` · added 2026-08-29 · shipped at build 123

**Do** — while the camera is up, measure the frame's mean luminance and trim
the composite's output gain gently toward it.
**Why** — a picture that brightens in daylight and settles in a dark room
reads as being in the room rather than on a screen.

**Decided**
- **Capture hard stop → licensed by Victor, 2026-08-29, narrowly:** camera
  pixels may be measured as well as displayed, **"only while the camera is
  already up"**. Nothing here raises the passthrough; entry 22 is the only
  thing licensed to do that.
- Not an ambient light sensor → `AmbientLightSensor` is behind a flag in
  Chrome and absent from Safari entirely, so it would be a dependency on
  something no target browser ships. The camera texture is already uploaded
  every frame and costs nothing extra to look at.
- What it costs when the camera is off → **nothing at all**, which is the
  point of the licence's shape. Passthrough is 0 by default and the sensor is
  released at 0, so the sampling never runs for most people.
- How it is measured → **a small render target, read back twice a second**,
  reusing the 30-frame cadence entry 17 established for the size check. A
  per-frame readback stalls the pipeline waiting for the GPU; at 2 Hz that
  stall is affordable and light in a room does not change faster than that.
- Smoothing → an `Envelope` with a slow attack and a slower release, seconds
  not frames, from `engine/fast.ts` — the same class entry 12 just retuned.
  **Mine**: without it, someone walking past a lamp strobes the whole picture,
  and the failure would look like a rendering bug rather than a feature.
- How far it may move things → **a gain clamped to [0.85, 1.15]**. **Mine**,
  because "a bit responsive" was the ask and because a wider range fights the
  audio: the picture's brightness is already the music's job, and a second
  thing driving the same quantity harder than the first turns the visualiser
  into an auto-exposure that happens to have a soundtrack.
- Which way → brighter room, brighter picture. The phone-in-daylight case is
  the one that actually fails today; a dark room needs less, not more.
- No preference toggle → the range is narrow enough that there is nothing to
  opt out of, and a new stored field would put this into the `Prefs` hard stop
  for no gain. Revisit only if the clamp turns out to want widening.

**Lands in**
- `src/scene.ts` — the sample target, the 30-frame tick beside entry 17's size
  check, and the output gain uniform.
- `src/shaders/composite.frag.glsl` — the gain applied to `col` at the end,
  after the existing clamp rather than before it.
- `src/engine/fast.ts` — nothing new; the `Envelope` is imported.

**Done when** — with the camera up, covering it dims the picture by roughly
15% over a second or two and uncovering it returns it, with no visible step
changes; with the camera down, the render loop does no readback at all, and
the frame time in the numeric readout is unchanged from today.
**Verify** — on the phone, in a room where the light can actually be changed.
The frame-time check matters as much as the visual one: the readback is the
part that can quietly cost more than it is worth. Also `pnpm build`, `pnpm
lint`.
**Hard stops** — prefs no · url no · capture **yes, licensed above, and
narrowly: measurement only, never activation** · dependency no.

**Build note.** `sampleAmbientLight()` lands in `scene.ts` right beside
`checkSize()`, on the same 30-frame tick, and shares its early-return shape:
with the camera down (`uCamera.value === null`) it sets `uExposure` to 1 and
returns before touching the render target, so the readback genuinely never
runs — confirmed by inspection rather than a live frame-time reading, since
this harness can't get a real camera stream through `waitForStart()` (see
entries 20 and 22's build notes for the same limitation). The envelope still
advances every frame even between samples, so its attack/release timing is
correct in wall-clock time regardless of the 30-frame sample cadence — only
the *target* it chases updates that slowly. Luminance uses standard
0.2126/0.7152/0.0722 weights over the 8×8 readback; the gain formula
`0.85 + envelope * 0.3` was chosen so it satisfies the Done-when's "roughly
15%" dimming exactly at the extremes and lands at neutral (1.0, no visible
change) at an ordinary mid-grey room. The shader change is the last line
before `gl_FragColor`, after the existing clamp, per the entry's own
instruction, with its own re-clamp since a gain above 1 can push a channel
out of range. Not verified live: the actual visual dimming/brightening in a
real room with a real camera, and the frame-time readout with the camera up
— both need a phone, which this harness cannot exercise, matching the
pattern for every camera-touching entry this session. `pnpm build`, `pnpm
lint` both clean.

### 24. The fullscreen chip cannot be hidden, so it arrives at Start and stays
`status: done` · added 2026-08-29 · shipped at build 113

**Do** — make `hidden` actually hide a `.hud-chip`, and stop the fullscreen
chip claiming fullscreen was lost before anything has asked for it.
**Why** — pressing Start now puts the "return to fullscreen" chip on screen and
nothing ever takes it away, which reads as fullscreen having been lost at the
one moment it was just successfully entered.

**Decided**
- The mechanism → **`hud.ts:364`'s `.hud-chip { display: flex }` outranks the
  UA stylesheet's `[hidden] { display: none }`.** Same specificity, author
  sheet wins, so the `hidden` attribute on `#fullscreen-chip` does nothing and
  `chip.hidden = !show` in `main.ts`'s `updateFullscreenChip` is a no-op.
  Confirmed in a browser rather than reasoned about: a `.hud-chip` created
  with `hidden` set computes to `display: flex` on `hud-probe.html`.
- Why it looks fine until Start → **the CSS does not exist yet.** `createHud()`
  injects that stylesheet, and it runs after `waitForStart` resolves. On the
  gate the UA rule is unopposed and the chip is genuinely hidden; the instant
  the HUD is built the rule appears and the chip becomes visible. That timing
  is the whole reason this presents as "the Start button broke fullscreen"
  rather than as a chip that is always wrong.
- Second, independent fault → **`fsState` is initialised to `'refused'`**
  (`permission-gate.ts:81`), which is also the state the chip shows on. So the
  chip is due to be shown before any request has been made, and
  `updateFullscreenChip()` runs during HUD setup, possibly before the
  `requestFullscreen()` promise has settled. Even with the CSS fixed, the chip
  would flash on at Start and then vanish. "Not asked yet" and "asked and
  refused" are different facts and the type should carry both.
- Fix → **`.hud-chip[hidden] { display: none }` in the same block**, at (0,2,0)
  specificity so it beats the rule above it without `!important`, plus a
  `'unasked'` member on `FullscreenState` as the initial value, shown by
  nothing. **Mine**: the alternative — swapping the attribute for a class the
  CSS knows about — leaves the next person to add a chip with exactly this
  trap still armed, where fixing the rule fixes the class of bug.
- What this does **not** claim → whether fullscreen itself still works on the
  handset is not established. `probe:fullscreen` passes all thirteen checks
  including the ordering one, the gate's `goFullscreen()` call is unchanged
  and still first, and a browser here cannot enter fullscreen at all. If the
  chip stops appearing and fullscreen is still absent, that is a second bug
  and wants the `?debug` readout's `full <state>` line, which is what it was
  built for.

**Lands in**
- `src/hud.ts:360-368` — the `.hud-chip` block gains the `[hidden]` rule.
- `src/permission-gate.ts:79-81` — `FullscreenState` gains `'unasked'` and
  `fsState` starts there.
- `src/main.ts`, `updateFullscreenChip` — the `show` test is unchanged in
  spirit but must not include the new initial state.
- `hud-probe.html` — the fastest way to see this: it loads the HUD's CSS
  without the mic gate, which is where the rule was confirmed.

**Done when** — on `hud-probe.html`, a `.hud-chip` with `hidden` set computes
to `display: none`; in the app, no chip is on screen at any point between load
and a successful Start, and forcing `fsState` to `exited` shows it and
returning to `active` removes it again.
**Verify** — `hud-probe.html` in a browser for the CSS rule, at 320×568 and
360×640. `pnpm probe:fullscreen` must still pass unchanged — the state type
grows a member and the probe asserts on the others. Also `pnpm build`, `pnpm
lint`. The real lost-and-regained cycle still needs a handset.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Build note.** Wrote the fix in plain CSS without a single backtick in the
comment, on purpose after getting it wrong once: `CSS` in `hud.ts` is a JS
template literal, so a backtick anywhere inside it — even inside a CSS
comment, meant purely as inline-code formatting — terminates the literal
early and turns the rest of the block into invalid JavaScript. `tsc` caught
it immediately as a syntax error, not a runtime bug, but worth naming so the
next comment in this file reaches for single quotes instead.

Confirmed directly in a browser rather than only reasoned about, per the
entry's own instruction: created a bare `.hud-chip` with `hidden` set and
read `getComputedStyle(el).display` — `none`, confirming the fix — and the
same element without `hidden` still computes to `flex`, confirming nothing
regressed for every chip that was already working. `pnpm probe:fullscreen`'s
full thirteen checks pass unchanged with the new `'unasked'` state added.
`pnpm build`, `pnpm lint` both clean.

### 25. The fullscreen chip belongs in the utility corner, not on the arc
`status: done` · added 2026-08-29 · shipped at build 115

**Do** — move the fullscreen chip off the icon arc to the top-left, beside the
version and reload marks, and drop the seventh-slot reservation that only
existed to make room for it.
**Why** — on a portrait phone the arc's last slot is most of the way up the
middle of the screen, so with the panel closed the chip reads as a button
dropped on the picture rather than as one of a row.

**Decided**
- It is not mispositioned → **it is exactly where it was told to go.**
  `chipPosition(6, 7, size)` puts the seventh slot at about 262°, which on a
  320×568 screen is 41% of the way up and well right of centre, and on the
  reported handset lands in the same place. Entry 19 verified that all seven
  bounding boxes stay on screen, which they do. What went unchecked is what
  one chip looks like without the other six.
- The premise that failed → **"it reads as one of the arc's chips" is only
  true while the arc is populated**, and the HUD's own six are invisible
  whenever the panel is closed (`.hud-scrim` is `opacity: 0` until `.open`).
  So in the exact state this chip exists for — panel closed, fullscreen lost —
  it is the only thing on that arc, and an arc of one is a floating button.
- Where instead → **top-left, on the same inset as `#hud-stats`**
  (`0.75rem + env(safe-area-inset-*)`). **Mine**: that corner is already the
  screen's utility strip — the version mark, the reload control and the debug
  readout all live there — and a fullscreen control belongs with the
  browser-ish furniture rather than in the picture. It is still a circular
  chip, so the control-surface rule is untouched; that rule governs *controls
  being arcs*, and a round chip is permitted vocabulary wherever it sits.
- What this removes → `Hud.setFullscreenChipShown()` and the 6-vs-7 slot
  reservation exist solely to make room on the arc for this chip. With it
  gone, nothing ever passes `n = 7`, the row is always six, and the
  `CHIP_ARC_MIN_START` clamp stops being reachable. Delete the reservation and
  its call site rather than leaving machinery that no longer has a caller —
  the refactor belongs in the change that made it dead. Keep `chipPosition`
  and the clamp: it is still the HUD's own layout and the clamp is the correct
  behaviour if a seventh chip ever does join the row.
- "Also doesn't work" → **treat as unproven until entry 24 lands.** The chip
  cannot currently hide itself (entry 24), so a tap that *did* enter
  fullscreen would leave the button sitting there exactly as before, which is
  indistinguishable from nothing happening. `.hud-scrim` is `pointer-events:
  none` while closed and cannot be swallowing the tap, and the handler calls
  `goFullscreen()` from a `pointerup`, which carries the activation the API
  needs. Fix 24 first; if the button still does not enter fullscreen after
  that, the `?debug` readout's `full <state> ×<attempts> (<error>)` line is
  what separates a refusal from a request never made.
- Build order → **24, then this.** They touch the same element and 24 is what
  makes the symptom legible.

**Lands in**
- `index.html` — `#fullscreen-chip` gains its own fixed top-left position
  rather than being placed from script; the element moves next to the version
  mark in the DOM so the corner's stacking is decided in one place.
- `src/main.ts`, `updateFullscreenChip` — the `chipPosition` call and the
  `panel.setFullscreenChipShown(show)` call both go; the function is left
  toggling visibility only.
- `src/hud.ts` — `setFullscreenChipShown` and the reserved-slot count it
  feeds are deleted from both the interface and the implementation.

**Done when** — with fullscreen lost, the chip sits in the top-left utility
corner clear of the version mark and the readout at both 320×568 and 360×640,
and nothing appears over the picture; opening the panel shows six chips in
exactly the positions they occupy today, since nothing reserves a seventh slot
any more.
**Verify** — `hud-probe.html` at both sizes for the chip row's positions, and
the app itself for the corner. `pnpm probe:fullscreen` unchanged. Also `pnpm
build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Build note.** Positioned at `left: 0.75rem` (matching `.hud-stats`, as
specified) but `top: 3.5rem` rather than `.hud-stats`'s own `0.75rem` —
**Mine**: `#version-hud`'s reload glyph already occupies roughly
`0.6rem`-`3.3rem` down that same left edge (measured: its rendered box
spans y 9.6px-52.8px at the root font size), so matching `.hud-stats`'s top
inset exactly would sit this 48px chip directly over it. 3.5rem (56px)
clears that box with a few pixels to spare. `.hud-stats` itself is hidden
by default (`showStats` is off), so the two sharing a left edge was never
going to collide in the common case regardless.

Confirmed via `hud-narrow.html` that the six-chip row is back to its
pre-entry-19 positions exactly — `bands: 6`, `escaped: []`, and the same
`worstRight`/`worstBottom` figures as every check before entry 19 introduced
the reservation, at both 320×568 and 360×640. Confirmed in `index.html`
itself that the chip's computed `top`/`left` place it clear of the measured
`#version-hud` rect. `pnpm build`, `pnpm lint`, `pnpm probe:fullscreen`
(unchanged) all clean.

**Not verified here:** `.hud-chip`'s own sizing/shape rules are injected by
`createHud()`, which only runs after Start — a raw fetch of `index.html`
before Start renders the button unstyled, so the *visual* corner placement
(a round 48px chip, properly sized) could only be confirmed by computed
`top`/`left` values and by reasoning against the measured `#version-hud`
box, not by looking at the fully-styled result. That needs a real Start on
a real device, same as everything else this entry and entry 19 before it
already flagged as needing one.

### 26. Two screenshots in the same minute get the same filename
`status: done` · added 2026-08-29 · shipped at build 117

**Do** — give every capture a name nothing else can take, and stamp it in the
phone's own time rather than UTC.
**Why** — the stamp is cut to the minute, so a second tap inside sixty seconds
produces a byte-identical filename.

**Decided**
- The mechanism → **`main.ts:374-378` truncates to the minute.**
  `.replace(/T(\d{2})(\d{2}).*/, '-$1$2')` keeps the hour and the minute and
  throws away seconds and milliseconds, so `suti-108-never-dark-20260829-1859`
  is every capture taken between 18:59:00 and 18:59:59. Verified by running
  the expression rather than reading it.
- What actually happens then → the browser silently disambiguates, usually as
  `… (1).png`, and on some Android download managers it overwrites. Neither is
  data loss worth panicking about, but both defeat the reason entry 18 put the
  build in the name: two captures that share a name cannot be told apart in a
  bug report, which is the one job that name has.
- Seconds are not enough → **add a per-session counter too.** **Mine**: two
  taps inside one second are reachable — the capture is a tap, not a
  long-running job — and, more to the point, wall-clock time is not monotonic
  on a phone. A handset that picks up NTP mid-session can hand back an
  *earlier* stamp than one it already used, which no amount of resolution
  fixes. The counter guarantees uniqueness within a session on its own; the
  timestamp is there to make the name meaningful, not to make it unique.
- Local time, not UTC → `toISOString()` is UTC, so a capture taken at 19:52 on
  the reported handset is named `1852`. **Mine**: the person who has to find
  this file reads their own clock, and a name an hour off its own screenshot
  is worse than no timestamp. Nothing here is compared across devices, so the
  ambiguity a local stamp introduces costs nothing.
- Shape → `suti-<build>-<release>-<YYYYMMDD>-<HHMMSS>-<nn>.png`, `nn` starting
  at `01` and zero-padded to two digits, widening on its own past 99. Sorts
  chronologically in a file listing, which is the order anyone browsing a
  camera roll wants.

**Lands in**
- `src/main.ts:371-393`, `saveCapture` — the stamp expression and a
  module-level counter beside it. Nothing else in the function changes; the
  detached-anchor click and the 30-second revoke are both load-bearing and
  documented.

**Done when** — tapping the capture band five times in quick succession
produces five files whose names differ, all sorting in the order they were
taken, and each carrying the local time shown on the phone's own clock rather
than a UTC one.
**Verify** — on the phone, since a desktop browser's download manager
disambiguates differently and would hide exactly the collision this is about.
Also `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no (the counter lives for the session only) · url no ·
capture no (what is captured is unchanged; only its name) · dependency no.

**Build note.** `captureCount` increments inside `requestCapture`'s callback
(when the blob is actually ready), not at the moment a tap is registered —
consistent with the counter's own job of guaranteeing uniqueness for
captures that actually complete, and harmless in practice since taps a
render frame or more apart (the realistic case for a human tapping a
band) each get their own turn through `scene.ts`'s single-slot
`pendingCapture` before the next one overwrites it.

Verified in isolation (the exact expression, not a paraphrase of it): five
simulated taps at the identical local second produce
`suti-115-own-corner-20260829-195203-01.png` through `…-05.png`, distinct
and sorting in the order taken, built from `getFullYear`/`getMonth`/
`getDate`/`getHours`/`getMinutes`/`getSeconds` rather than `toISOString()`
so the stamp reads in the phone's own local time rather than UTC. `pnpm
build`, `pnpm lint`, `pnpm probe:fullscreen`, `pnpm probe:shake` and `pnpm
probe:haptics` all clean — none of them touch this code path, and none
moved.

**Not verified here:** the actual download-manager behaviour on a real
device — whether five real taps in quick succession really do land as five
separate files rather than the browser's own disambiguation kicking in
first — needs a phone, exactly as the entry's own Verify section says a
desktop browser's download manager would hide the very collision this
entry is about.

### 27. Swipes stop changing the picture; the shake is the gesture
`status: done` · added 2026-08-29 · shipped at build 119

**Do** — delete both swipe gestures, leaving the shake as the only thing that
changes what is on screen without opening the panel.
**Why** — two gestures do what the shake already does better, and both fire by
accident while simply handling the phone.

**Decided**
- Both swipes, not just the horizontal one → **both.** The vertical swipe
  calls `onRandomise()`, which is exactly what any qualifying shake already
  does, so it is a duplicate route to the same outcome; the horizontal one
  cycles the atmospheric programme, which is what the ask calls changing
  parameters. Removing one and keeping the other would leave the file's whole
  pointer apparatus standing for a single gesture.
- Nothing becomes unreachable → the re-seed is the shake's own bottom rung,
  and the atmospheric programme is a band in the HUD. Both survive; only the
  shortcuts go.
- The space bar stays → **Mine**, and the one to argue with. `gestures.ts`'s
  own docstring pairs it with the vertical swipe, and it is the shake for a
  machine that cannot be shaken: a desktop has no accelerometer, and without
  it there is no way to re-roll there except through the panel. It is also
  not a swipe, which is what was actually asked about.
- What goes dead with them → `cycleAtmosphericView` has exactly one caller,
  the horizontal swipe (`main.ts:665`), so both its interface entry
  (`hud.ts:204`) and its implementation (`hud.ts:1125`) go in the same change.
  Machinery left without a caller is the thing CLAUDE.md asks not to leave
  behind.
- `gestures.ts` becomes a keyboard file → **rename it `keyboard.ts`, exporting
  `bindKeyboard`.** **Mine**: with the pointer half gone the file holds one
  `keydown` listener, and a file called `gestures.ts` containing no gesture is
  precisely the shape-that-stopped-describing-the-thing this repo asks to fix
  as part of the change rather than after it. One import moves.
- A comment that goes stale → `main.ts`'s capture band explains that a swipe
  starting in the band needs no guard because "gestures.ts's own threshold
  (60px) is already far past TAP_SLOP_PX". The conclusion still holds — a drag
  is still not a tap — but its reason will no longer exist. Rewrite it rather
  than leaving a comment pointing at deleted code.
- What this buys beyond the ask → the two `document` pointer listeners that go
  are direct competitors of the capture band and of the HUD's tap-to-open, on
  a screen where three separate things now read raw pointer events. Fewer
  claimants on the same tap is worth more than the gestures were.

**Lands in**
- `src/gestures.ts` → `src/keyboard.ts` — everything above the `keydown`
  listener is deleted, along with `SWIPE_MIN_PX`, `SWIPE_MAX_MS`,
  `AXIS_DOMINANCE`, the `.hud-scrim` exclusion and the `GestureHandlers`
  interface's `onSwipeAtmospheric`. The docstring's long account of why the
  double tap was abandoned goes with the pointer code it explains.
- `src/main.ts:10` and `:663-666` — the import and the call site.
- `src/hud.ts:204` and `:1125` — `cycleAtmosphericView`, both halves.
- `src/main.ts`, the capture band's comment about swipe thresholds.

**Done when** — swiping anywhere on the picture, in any direction, at any
speed, changes nothing; a shake still re-seeds and still shuffles by depth;
space still re-seeds on a desktop; and the atmospheric programme is still
changeable from its band in the panel.
**Verify** — on the phone, since the accidental swipes this removes are a
handling problem rather than a pointer-events one and a mouse does not
reproduce them. `pnpm probe:shake` unchanged. Also `pnpm build`, `pnpm lint`,
and the on-screen check at 320×568 and 360×640 to confirm the HUD's own drags
still work with the exclusion gone — that is what the deleted `.hud-scrim`
guard was protecting.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Build note.** Two more stale references to the deleted `gestures.ts`
turned up in `hud.ts` beyond the ones the entry's own "Lands in" named
(`TAP_SLOP_PX`'s comment, and the rebuild-on-adopt comment near `setOpen`)
— fixed in the same change rather than left pointing at a file that no
longer exists, since a comment naming a deleted file is worse than one
naming nothing.

Verified on screen via `hud-narrow.html`, after finding and discarding one
false alarm: an early check (reusing browser state left over from an
earlier `window.run()` call in the same page load) showed a drag missing
its target and the panel unexpectedly closed. A clean reload and a fresh
drag on the R band showed the real behaviour — 100 to 90, panel still
open afterward — confirming the `.hud-scrim` guard `gestures.ts` used to
provide has no replacement to build because nothing needed it once the
document-level swipe listeners were gone; `hud.ts`'s own drag handling
never depended on it. `pnpm probe:shake` unchanged, `pnpm build` and
`pnpm lint` both clean.

### 28. The byline is too dark to read, and is the only line with no shadow
`status: done` · added 2026-08-29 · shipped at build 120

**Do** — lift `.gate-byline` to the same colour as the release name below it,
and give it the text-shadow both of its neighbours already have.
**Why** — "by flyflyfly © 2026" sits at 2.3:1 against the gate's background, on
top of a picture that is moving and sometimes bright.

**Decided**
- This reverses entry 10 → **Victor's call, made 2026-08-29.** That entry set
  the byline deliberately quieter than `.gate-name`, on the reasoning that the
  screen has exactly one thing designed to dominate and a second loud line
  would spoil it. The comment above the rule says so and must be rewritten
  rather than left contradicting the code.
- How far → **`#8d88b8`, the same colour as `.gate-name`.** Measured rather
  than eyeballed: against the gate's `#05060a` that moves the byline from
  **2.33:1 to 6.12:1**, from well under the 4.5:1 needed for text this small
  to comfortably over it. **Mine** as to the exact value: matching the release
  name is the largest step that does not invent a new tone for this screen.
- Why the hierarchy survives it anyway → the byline is 0.62rem against the
  release name's 0.95–1.3rem, so with the colours equal, size alone carries
  the rank. Entry 10's ordering — disc, then title, then release name, then
  byline — still reads; what changes is that the bottom of that order is now
  legible instead of nearly absent.
- Size and weight stay → **Mine.** Growing the type would change the ordering
  rather than the legibility, and legibility is what was asked for. If it
  still reads as too quiet after the colour and the shadow, the next step is
  weight, not size.
- The real reason it disappears → **it is the only line on the gate with no
  `text-shadow`.** `#gate h1` carries `0 1px 14px rgba(5,6,10,0.95)` and
  `.gate-name` carries `0 1px 12px`; the byline carries none, and the idle
  preview is drawing behind all three. So on a dark frame it is merely dim and
  on a bright one it disappears into the picture. Give it the same 12px shadow
  as the line below it — consistency with its neighbours rather than a new
  idea, and it is the half of this that colour alone cannot fix.

**Lands in**
- `index.html:132-142` — the comment, the `color`, and a `text-shadow` to
  match `.gate-name` at `:156`.

**Done when** — on the gate at 320×568 and 360×640, the byline is readable
against both a dark and a bright frame of the idle preview, and still reads as
subordinate to the release name directly below it.
**Verify** — in a browser on the gate, with the preview running, at both
sizes — a static screenshot of a dark frame is exactly the case that hid this.
Also `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Build note.** Re-derived the contrast figures rather than trusting the
entry's own numbers: `#454b5c` against `#05060a` computes to 2.33:1 and
`#8d88b8` against the same background computes to 6.12:1 — both matched
exactly. Confirmed on the running gate at the default size with the idle
preview live over a dark frame: the byline reads clearly, at the same
colour as the release name below it and still visibly smaller, so the
disc → title → release name → byline order from entry 10 still holds.
`pnpm build`, `pnpm lint` both clean.

### 29. A light shake changes the colours and nothing else
`status: done` · added 2026-08-29 · shipped at build 121

**Do** — make the colour roll the ladder's bottom rung and give the re-seed a
threshold of its own, instead of firing it on every shake regardless of depth.
**Why** — the gentlest shake currently re-rolls the pattern, which is the
biggest change the bottom of the scale can make and not the smallest.

**Decided**
- This corrects entry 15 rather than restating a preference → **the ladder
  contradicts its own stated ordering.** Entry 15 ordered the rungs "by how
  little of what you had survives: a colour shift is recognisably the same
  picture, a view change is a different instrument." By that rule the re-seed
  — which replaces the arrangement entirely, keeping only the palette and the
  view — sits *above* a colour shift, not beneath it. It ended up unconditional
  because it was the original shake behaviour and the graded ladder was built
  around it (`main.ts:548`, `shuffle()` calls `randomise()` outside every
  depth test).
- New rungs → colours at **any qualifying shake**, re-seed at **0.30**, and
  merge, views and everything unchanged at 0.45, 0.70 and 0.90. **Mine** as to
  0.30: it sits above the old colour threshold of 0.20, so a shake that used
  to re-seed silently now shifts the palette instead, and clear of 0.45 so the
  "new pattern, same everything else" band is wide enough to land in on
  purpose.
- What that does to the probe's own cases → the gentle sustained 12 m/s² case
  reports an intensity of 0 and now changes colours only; a deliberate 28
  m/s² shake is 0.37 and gets colours plus a new pattern; the violent 45 stays
  at 1.0 and still gets everything. That spread is the entry in one line: a
  gentle shake repaints, a deliberate one redraws.
- Every shake still does *something* visible → colours roll on all layers at
  every depth, which is the point of moving them to the bottom. Nothing
  becomes a shake that appears to do nothing, and the intensity-scaled buzz
  from entry 8 still confirms the gesture independently of what changed.
- The double is unaffected → it forces depth 1 and therefore every rung
  including the re-seed. The escape hatch keeps working exactly as entry 15
  described.
- Space and the autopilot chip are unaffected → both call
  `visualiser.randomise()` directly rather than through `shuffle()`, so a
  deliberate "new pattern" request stays a re-seed with no depth in front of
  it. That is correct: they are explicit asks, not graded ones.

**Lands in**
- `src/main.ts:181-184` — `SHUFFLE_COLOUR` becomes `SHUFFLE_RESEED` at 0.30;
  the colour block loses its test.
- `src/main.ts:545-549`, `shuffle()` — `visualiser.randomise()` moves behind
  the new threshold, which is the only line that makes a light shake stop
  re-seeding.
- `src/main.ts:210-232`, `shuffled()`'s docstring — the ladder table at `:217`
  says "any qualifying shake → re-seed only (handled by the caller)" and is
  about to be exactly wrong.
- `src/main.ts:820-825` — the comment at the call site repeating that
  `shuffle()` always re-seeds regardless of depth.
- `scripts/probe-shake.ts` — the printed depth per case is already there;
  assert the gentle case reaches colours and not the re-seed.

**Done when** — `pnpm probe:shake` shows the gentle sustained case rolling
colours with no re-seed, the deliberate case rolling both, and the double
still reaching every rung. On the phone, a light shake visibly repaints the
same picture rather than replacing it.
**Verify** — `pnpm probe:shake` for the ladder, then the phone, because the
distinction this entry exists to create is between two things that both look
like "the picture changed" in a still frame. Also `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Build note.** `scripts/probe-shake.ts` needed no code change: it already
prints `depth` per case (entry 15), and `depth` is peak-derived only —
untouched by where any of `SHUFFLE_RESEED`/`SHUFFLE_MERGE`/etc. sit, since
those constants live in `main.ts`, which the probe cannot safely import
(it calls `main()` at module scope on load, same reason `probe-shake.ts`
already avoids anything but `shake.ts`). The printed depths already prove
the ladder against the new thresholds by inspection, exactly as entry 15's
own Done-when did for the original ones: gentle sustained at 0.00 (below
0.30 — colours only, confirmed), deliberate at 0.36 (above 0.30, below
0.45 — colours plus a new pattern, confirmed), violent at 0.94 (above 0.90
— everything, confirmed), every double at 1.00 (everything, unaffected).
`pnpm probe:shake`'s own table is otherwise byte-for-byte identical to
before this entry, `pnpm probe:fullscreen` and `pnpm probe:haptics`
likewise, `pnpm build` and `pnpm lint` both clean.

### 30. Gravity mode: the picture has weight and pools downhill
`status: done` · added 2026-08-29 · shipped at build 126

**Do** — add a switchable mode in which the phone's tilt gives the generated
layers a steady offset toward the low side, on top of the existing tumble.
**Why** — the tumble answers *motion* and settles back to centre; nothing
answers where the phone is being held, so the picture has no weight.

**Decided**
- "How should each Viz respond" → **all of them identically, and this needs no
  per-shader work at all.** The tumble is not applied per view: it is one
  `uTumble` uniform consumed once in `composite.frag.glsl:87-90`, which
  rotates, scales and offsets the sampling coordinate for the *finished*
  geometry and atmosphere textures. Thirteen shaders inherit it without
  knowing it exists, exactly as they inherit the merge modes. So gravity rides
  the same path and the thirteen-way design question the ask anticipated does
  not arise.
- The one layer that must **not** slide, and already does not → the camera.
  `composite.frag.glsl:122` samples it as `(vUv - 0.5) * uCameraFit + 0.5`,
  from the untumbled coordinate, so the room stays put while the generated
  layers move over it. That is the correct behaviour — a real room does not
  slide when you tilt the phone, and a passthrough that did would read as a
  bug — and it costs nothing because it is already true.
- The tilt vector already exists → `shake.ts:241-321` maintains `gravX/gravY/
  gravZ` as a slow low-pass of the raw reading (`GRAVITY_TAU` 0.5s) purely so
  it can be *subtracted* to leave the AC part. The direction of gravity is
  computed on every sample and thrown away. Same shape as entry 15's `peak`:
  the number is there, unused, and already smoothed — so the slide arrives
  damped for free and needs no envelope of its own.
- How it composes with the tumble → **added, then clamped to the existing
  `MAX_OFFSET`.** The tumble is a transient kick that springs back; gravity is
  a steady bias. Summing them and clamping to the cap the tumble already
  respects means `shake.ts:506-509`'s overscan formula keeps covering the
  exposed corner with no change — and the `clamp()` at
  `composite.frag.glsl:90`, which smears edge pixels when the offset outruns
  the overscan, never gets the chance.
- How far → **up to 0.6 × `MAX_OFFSET`, about 0.033 uv, at 90° of tilt.**
  **Mine**: it leaves the remaining 40% of the cap for the tumble to kick into,
  so shaking a tilted phone still visibly kicks rather than sitting pinned
  against the clamp. Whether that reads as enough weight is a phone question,
  and the constant is the one thing here worth re-tuning on the device.
- Direction → **toward the low side**, so the picture pools like something with
  mass rather than sliding uphill. The sign of `gravX/gravY` against screen
  axes is not stated here on purpose: `DeviceMotionEvent`'s axis conventions
  are worth confirming against `?debug` on the handset rather than asserting
  from memory, and getting it backwards is a one-character fix once seen.
- Rotation too, or only offset → **offset only.** **Mine**: the tumble already
  owns `angle`, and a steady rotation toward level would fight the device's own
  orientation handling and turn a moving picture into a spirit level. Weight is
  the metaphor, not gimbals.
- The control → **a seventh chip on the icon arc**, toggling a new
  `prefs.gravity` boolean. Adding a `Prefs` field is explicitly the safe half
  of that hard stop — `loadPrefs` validates each field and falls back — so no
  licence is needed, and a boolean needs a chip rather than a band.
- **Depends on entry 25.** The arc's seventh slot is currently spoken for by
  the fullscreen chip, and entry 25 moves that off the arc. It also keeps
  `CHIP_ARC_MIN_START` on the grounds that the clamp is correct "if a seventh
  chip ever does join the row" — this is that chip, and building this before
  25 would put two things in one slot.
- One view to look at specifically → `spectrogram`, which maps an axis to the
  screen rather than filling it with texture. A 3% steady shift is small and
  the overscan hides the edge, but it is the one programme where a persistent
  offset changes what the frame is *of* rather than merely where it sits.

**Lands in**
- `src/shake.ts` — expose the normalised gravity direction beside
  `TumbleState`; `frame()` already has it and currently returns only what it
  derived from it.
- `src/main.ts` — pass the mode through to `setTumble`, and the chip.
- `src/scene.ts:602-603`, `setTumble` — the offset it packs into `uTumble.yz`
  becomes tumble plus gravity, clamped.
- `src/prefs.ts` — `gravity: boolean`, defaulting off.
- `src/hud.ts` — the chip, and its icon.

**Done when** — with the mode on, tilting the phone slides the generated layers
toward the low edge and holds them there, returning to centre when the phone is
level; the camera passthrough does not move at any tilt; a shake still kicks
visibly on top of a held tilt; and no frame edge or smeared border appears at
maximum tilt on any view. With the mode off, `uTumble` is bit-identical to
today.
**Verify** — the phone, for all of it: no probe has an accelerometer and no
desktop browser can be tilted. `pnpm probe:shake` must pass unchanged, since
detection is untouched and the offset cap is shared. Check `spectrogram` and
one radial view specifically at full tilt, plus the camera layer up. Also
`pnpm build`, `pnpm lint`, and the on-screen check at 320×568 and 360×640 for
the seventh chip.
**Hard stops** — prefs **yes but safe**: one added boolean, which `loadPrefs`
validates and falls back for; no existing field changes type or meaning · url
no · capture no (the accelerometer is already running; nothing new is read) ·
dependency no.

**Build note.** One thing not anticipated in Decided: the overscan (`zoom`)
`Tumble.advance()` computes only covers the spring's own displacement, so a
held tilt near the cap plus a shake on top of it could exceed the overscan
the spring alone budgeted for, exposing a raw edge — a real gap in "no frame
edge or smeared border appears at maximum tilt", not something the entry's
own text had flagged. Fixed by extracting the overscan formula out of
`advance()` into an exported `overscanFor(angle, offsetX, offsetY)` in
`shake.ts`, so `scene.ts`'s `setTumble` can recompute it from the *combined*
offset (tumble plus gravity, after summing and clamping to `MAX_OFFSET`) and
take the larger of that and the spring's own figure, rather than duplicating
the formula's two magic numbers a second time. **Mine**, and the one
deviation from the plan's literal file list: `MAX_OFFSET` and `overscanFor`
are now both exported from `shake.ts` rather than the addition-and-clamp
happening in `main.ts` as the phrasing loosely suggested, so the cap is
enforced in exactly the one place (`scene.ts`) that already owns packing
`uTumble`.

`gravX`/`gravY`'s sign against screen axes is genuinely untested here, per
the entry's own allowance — this harness cannot tilt a device, so `?debug`
on a real phone is the only way to see whether "toward the low side" comes
out backwards, which the entry already flagged as a likely one-character
fix. `pnpm probe:shake` output is byte-for-byte unchanged (gravity is never
sampled by the probe's synthetic path), `pnpm probe:haptics` and `pnpm
probe:fullscreen` both still pass. The seventh chip was checked in
`hud-narrow.html` at both 320×568 and 360×640: `describe().chips` lists
"Gravity" alongside the existing six, `escaped: []` at both sizes, and
tapping it round-trips `prefs.gravity` through localStorage in both
directions. Not verified here: the actual tilt-and-pool behaviour on a real
phone, which needs a device this harness does not have. `pnpm build`, `pnpm
lint` both clean.

### 31. `?debug` writes itself into stored preferences and never leaves
`status: done` · added 2026-08-29 · shipped at build 127

**Do** — keep the diagnostic readout's URL flag out of the saved preferences,
so it lasts for the load that asked for it and no longer.
**Why** — visiting once with `?debug` turns the numeric readout on for every
future visit, with nothing in the URL to explain why and no memory of having
asked.

**Decided**
- The mechanism → **the flag is merged into the prefs object itself.**
  `main.ts:129` is `showStats: query.has('debug') || stored.showStats`, which
  makes a per-load switch indistinguishable from a stored setting. `save()`
  then writes the whole object (`hud.ts:476`), so the first HUD interaction
  after a `?debug` visit persists `showStats: true` for good.
- Why it looks like the menu did it → because the menu is what saves.
  Nothing writes preferences until the HUD is touched, so the readout appears
  on that load and becomes *permanent* the first time a chip or band is used.
  "Clicking the menu turned it on" is the right observation about the wrong
  step: opening the menu is when the flag stopped being temporary.
- Scope → **`?debug` only.** `?mapping=` and `?auto=` are merged the same way
  and so are the appearance parameters, and for those the behaviour is
  defensible: opening someone's link, adjusting it and keeping the result is
  what a shared link should do. A diagnostic switch is not an appearance
  parameter, and it is the only one nobody would expect to inherit.
  **Mine**, and deliberately narrow — changing link-sharing semantics is not
  what was reported.
- The shape → **`prefs.showStats` goes back to meaning "the setting this
  person chose", and a separate session value drives what is on screen.** It
  starts as `debugFromUrl || stored.showStats`; the readout reads the session
  value; the `num` chip flips the session value *and* writes it to prefs,
  because a chip tap is an explicit choice and should persist. A `?debug`
  visit with the chip untouched writes nothing about stats at all.
- Turning it off today → the `num` chip already does it: it toggles
  `prefs.showStats` and saves. Worth knowing before this lands, since anyone
  who has ever loaded `?debug` is currently stuck with the readout.
- `flashShake` follows the session value too → `main.ts:822` and `:838` gate
  the shake flash on `prefs.showStats`, and that flash is diagnostics rather
  than feedback (unlike the capture flash, which is deliberately ungated). It
  should follow what is actually on screen, not what was stored.

**Lands in**
- `src/main.ts:129` — `showStats` stops reading the query; the flag becomes a
  separate value passed to `createHud`.
- `src/main.ts:822`, `:838` — the two `prefs.showStats` reads become the
  session value.
- `src/hud.ts:446`, `:808-810`, `:992`, `:1053` — the four places that read or
  write `prefs.showStats` for display; one accessor rather than four copies of
  the OR.

**Done when** — loading `?debug`, opening the panel and turning a band, then
reloading *without* `?debug`, leaves the readout off; toggling the `num` chip
still persists across reloads in both directions; and `?debug` still shows the
readout on the load that carries it.
**Verify** — in a browser with devtools' storage inspector, which is the only
way to see the difference between "not shown" and "not stored". Both cases:
arriving with the flag and toggling the chip, and arriving with it and not.
Also `pnpm build`, `pnpm lint`.
**Hard stops** — prefs **no**: `showStats` keeps its type and its meaning —
this restores the meaning it was supposed to have — and nothing is added or
removed · url **no**: `?debug` keeps its name and its effect for the load that
carries it, and is not repurposed · capture no · dependency no.

**Build note.** Landed close to the plan, with one shape decision the plan
left implicit: the session value lives inside `createHud` itself (a private
`showStats` variable, seeded from a new `debugFromUrl` parameter), rather
than in `main.ts`, since every read and write the entry lists — the initial
`stats.hidden`, the `num` chip, `paint()`'s chip state, and `update()`'s
gate — are already inside that closure and `prefs` was the only thing
crossing the boundary. A new `Hud.showingStats()` accessor, mirroring the
existing `autopilot()`, is what lets `main.ts`'s two `flashShake` call sites
follow the session value instead of `prefs.showStats` directly, per the
entry's own note that the flash should follow what's on screen rather than
what's stored. `resolvePrefs()` now returns `stored.showStats` unmodified;
`?debug` is read a second time at the `createHud` call site instead of
threaded through `Prefs`, which is exactly the point — a per-load flag has
no business being carried in the object that gets written to storage.

Verified directly against the `hud.ts` module rather than through the live
app: this harness cannot get past the Start button's microphone gate (see
entries 20/22/23's build notes for the same limitation), and `createHud`
itself is only constructed after Start, so `?debug` on the real page can't
be exercised end-to-end here. Instead, imported the module fresh and built
two independent instances — one with `debugFromUrl: false`, one `true` —
against separate dummy `prefs` objects. Confirmed all three Done-when
claims directly: the `false` instance starts with `showingStats() === false`
and an untouched `prefs.showStats`; the `true` instance starts with
`showingStats() === true` while `prefs.showStats` stays `false`, which is
the load-carries-it-but-doesn't-persist behaviour the whole entry is about;
and tapping the `num` chip on each persists the *new* session value to
`prefs` in both directions (off→on and on→off), including turning a
`?debug`-forced readout off and having that stick. `pnpm build`, `pnpm
lint` both clean.

### 32. The lattice hears the tune but not the beat
`status: done` · added 2026-08-29 · shipped at build 137

**Do** — give `uTransient` a term that reaches the whole structure, and deepen
the two couplings that carry loudness and recent history into the geometry.
**Why** — the lattice's colour swings hard with the music while its shape
barely moves, so it reads as tinted rather than played.

**Decided**
- It is not under-wired → **the lattice reads eleven of the twelve audio
  inputs**, second only to `field`. Counted across all thirteen shaders rather
  than assumed: `chorus` reads three, `grid` and `shards` two apiece, and this
  one reads every input except `uSpectrum`. So the fix is coupling depth, not
  missing wiring, and no new uniform is needed.
- Where the responsiveness actually is → **in the colour, and almost nowhere
  else.** Line 311 swings intensity roughly threefold with `uMid` and `uSurge`,
  and line 303 does the same for the rays with `uHigh`. Against that, the
  geometry moves by tens of percent: node radius by 27% (`0.7 * uLow`), the
  filament width by 35% (`9.0 * uLevel`), the field pinch by 12%. Tonal
  response is strong; rhythmic response is what is missing.
- The single biggest cause → **`uTransient` appears exactly once, and is
  confined to a thin ring.** Line 264 multiplies it into a pulse that only
  lights where `withinShell` matches `fract(uFlow * 0.9)`, so a drum hit
  brightens one travelling shell rather than the network. That travelling ring
  is a deliberate and good idea — the comment says a hit should be something
  you watch move — but it means the fastest, most rhythmic signal in the whole
  mapping touches the smallest part of the frame. `field`, the liveliest view,
  uses `uTransient` at four separate sites.
- Fix, in three specific terms → **keep the ring and add a global one.** A
  transient also lifts node brightness across every shell, so a hit flashes the
  network *and* launches the ring. Then `past`'s weight in the node radius
  (line 200) rises from 0.5 toward 1.0, so the tunnel's shells visibly differ
  by what was playing when they were the rim; and the filament width's
  `9.0 * uLevel` (line 255) rises toward 14, so lines thicken audibly with
  loudness. **Mine**, all three: they add response at the fast tier and in the
  depth axis, which are the two places the shader is thin.
- Deliberately **not** touched → line 134's `uv *= 1.0 + uBreak * 0.35 -
  uSurge * 0.28`. Whole-frame scale is the one coupling that turns responsive
  into nauseating, and it is already the largest single geometric swing in the
  file. If the result still reads as flat, the answer is another emissive term,
  not more zoom.
- `uSpectrum` stays unused, and that is correct → the shader samples
  `uHistory` at line 187 with an `age` of 0 at the rim, and the newest history
  row *is* the live spectrum. Adding `uSpectrum` would be a second path to the
  same numbers. Worth writing down so the unused uniform is not mistaken for
  an oversight a third time.
- Scope → **this view only.** `chorus`, `grid`, `shards`, `tide` and
  `circles` are thinner still, and several of them read `uLevel` not at all.
  Whether that is deliberate restraint or the same gap is a separate question
  and a separate entry; nothing here should be applied to them by analogy.

**Lands in**
- `src/shaders/lattice.frag.glsl:200` — `past`'s coefficient in `nodeR`.
- `:255` — the filament width's `uLevel` term.
- `:264-270` — the new global transient term, added where light is
  accumulated rather than inside the ring's own expression.

**Done when** — driven from `views-probe.html` with synthetic params, a
transient spike visibly brightens the whole network and not only one shell; a
loudness sweep visibly thickens the filaments; and two shells carrying
different history are distinguishable by node size. Then against real music: a
kick reads as a hit rather than as a colour change.
**Verify** — `views-probe.html` for the synthetic sweeps, because a real track
never isolates one input, and then real music through the microphone, because
this is the only test of whether it feels played. `pnpm probe` must still pass
— the mapping is untouched, and if its numbers move, something other than this
shader changed. Also `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Build note.** All three changes landed as specified: `nodeR`'s `past`
coefficient 0.5→1.0, the filament width's `uLevel` term 9→14, and a new
global transient term added at the node-brightness accumulation site
(`col += nodeCol * node * (... + 1.5 * uTransient) * ...`), keeping the
existing ring pulse untouched rather than replacing it. The coefficient on
the new term (1.5) is **Mine** — the entry named the fix but not an exact
value, so it was set equal to `energy`'s own weight: comparable to loudness,
not larger than it.

Found `views-probe.html` broken before it could be used: it still builds
`VisualiserOptions` with a `mix: 0` field and a `geoColour: 'white'` string,
both stale since the geo/atm colour and alpha split, and throws immediately
on `atmMergeMode` being undefined. Fixed it in place (`geoAlpha`/`atmAlpha`,
per-layer `GeoColour` objects, `atmMergeMode: 'screen'`) since every view
this harness exists to check was unreachable through it, not only this one
— confirmed fixed by loading it and calling `window.drive()`/`window.probe()`,
which now render and read back a non-zero centre pixel for all seven
atmospheric views.

Verified the actual claims with a second, purpose-built script against
`scene.ts`/`lattice.frag.glsl` directly: built a lattice-only visualiser
(`geoAlpha: 0`), drove 30 frames at a steady baseline, then one frame with
`transient: 1.0`, and read back every pixel rather than one centre sample.
Mean frame brightness rose from 37.1 to 50.9 (+37%) on that single frame —
consistent with the whole network lifting, not only the thin ring the old
code lit. A separate loud-vs-quiet sweep (`level` 0.15 vs 0.95) raised mean
brightness from 29.9 to 48.8, consistent with the filaments visibly
thickening. The third synthetic claim — two shells at different depths
distinguishable by node size — was not independently pixel-verified; the
`past` coefficient doubling is confirmed in the diff, but isolating one
shell's node radius from a screenshot needs more than this check bought.
Not verified at all: real music through the microphone, which this harness
cannot pass Start's mic gate to reach (same limitation as every other
audio-live entry this session). `pnpm probe` output is unchanged — the
mapping itself was never touched, only this one shader. `pnpm build`,
`pnpm lint` both clean.

### 33. Touch drops a fading emitter into any geometric view
`status: done` · added 2026-08-29 · shipped at build 143

**Do** — in any geometric view, a press-and-hold or a drag places an emitter at
the finger that spawns rings from that point and dies away over a few seconds.
The longer the finger stays down, the stronger that emitter is.
**Why** — the view already draws event-born rings that age and fade; it just
has no way for a person to be the event.

**Decided**
- Most of this exists → **`circles` already keeps an eight-slot ripple
  buffer.** `engine/ripples.ts` holds `[birthTime, birthLevel]` per slot in a
  ring buffer, `updateRipples` spawns one when a transient clears a threshold,
  and the shader ages each slot independently and draws its wake. "Launches
  circles that fade over time" is that machinery with a second trigger. What
  it cannot do is place them.
- What a touch creates → **a fading emitter at the touch point.** Asked and
  answered. It carries a position, a birth, and a life of about four seconds,
  spawning a ring at intervals with the ring's loudness scaled by the
  emitter's remaining life, so it thins out rather than stopping dead. On a
  drag the emitter follows the finger, which is what makes a drag draw.
- **Hold length charges one quantity, and that quantity does all three
  things** → Victor asked for a longer press to make the emitter "stronger or
  brighter or longer lasting". **Mine**, that it is not a choice between them:
  contact time raises a single `charge`, and `charge` multiplies the ring
  level (brighter), which the shader's own wake already turns into a wider,
  further-travelling ring (stronger), and scales the emitter's life (longer
  lasting). Three separate knobs would be three things to tune against each
  other and three ways for the gesture to feel inconsistent; one charge with
  three consequences is the same feel with a third of the surface.
- The numbers → **charge runs 0.4 → 1.0 over the first 2.5 seconds of contact,
  then saturates**, and life runs from about two seconds to the full four
  across that same range. **Mine.** It starts at 0.4 rather than 0 so the
  briefest qualifying hold still visibly does something — an emitter that
  begins at nothing would make the gesture read as unresponsive at exactly the
  moment a person is learning it — and it saturates so that leaning on the
  screen cannot produce an emitter that outlives interest in it.
- Charging is visible while it happens → because the emitter is already
  spawning rings during the hold, a rising `charge` means those rings brighten
  under the finger as you hold. **Mine**, and it is the reason to charge
  continuously rather than to read the duration once on lift: the gesture
  teaches itself, with no hint, no label and nothing added to the control
  surface.
- A drag charges too → contact time accumulates whether or not the finger
  moves, so a long drag lays down a trail that strengthens along its length.
  **Mine**, over resetting charge on movement: "pressing longer" is about how
  long you are touching, and a rule that punishes movement would make drawing
  feel worse the more of it you do.
- How it coexists with the panel → **hold or drag emits; a plain tap still
  opens the HUD.** Asked and answered, and it is the same reasoning
  `gestures.ts` recorded when it abandoned double-tap: a hold clears a time
  threshold and a drag clears a distance one, so neither can be confused with
  the zero-delay tap the panel is built on. Nothing is added to the tap path,
  which is what keeps the panel instant.
- Suppressing the tap that ends a hold → the `pointerup` after an emit must
  not also open the panel. Use the capture-phase `stopPropagation()` that
  `main.ts`'s screenshot band already uses for exactly this, and for the same
  reason: capture runs before hud.ts's bubble-phase listener on `document`.
- Armed in **every geometric view** → Victor, 2026-08-29, overturning an
  earlier "Circles only" call of mine that was made before the recon below.
  It is also now the cheaper option, not the more expensive one.
- Because **all six geometric views already read `uRipples`** — circles,
  shards, grid, drift, chorus and tide. There is no per-view plumbing to
  build: the buffer is already the geometric layer's shared event bus, and
  each view already has its own answer to what a ripple looks like. Three of
  them are documented in `views.ts:57` as "variations on Circles that keep its
  ring and move its emitter", which means the concept of an origin away from
  the centre is not new either.
- So "appropriately to each" is **already designed, and is not being
  overridden** → each view derives its origin from the ring's own birth time
  (`drift.frag.glsl:12` states this outright). The change is that a slot may
  now *carry* an origin, and a view uses it when present and keeps today's
  rule when absent. One branch per shader, no new idiom anywhere:

  | View | What a touched ripple does |
  |---|---|
  | Circles | the ring is born at the finger instead of the centre |
  | Shards | fragments are thrown outward from the finger |
  | Grid | the square wavefront starts at the finger's cell |
  | Drift | the wander starts at the finger rather than at its seeded phase |
  | Chorus | the nearest of its fixed origins fires, rather than an arbitrary one |
  | Tide | the arc is born at the frame edge nearest the finger |

  Chorus and Tide take the finger as an *influence* rather than as a
  coordinate, **Mine**, because both are built on where rings may be born —
  a ring of fixed origins, and the frame edge — and a view whose identity is
  its emitter geometry should not have that geometry deleted by a touch.
- The per-fragment cost does not multiply → only one geometric shader runs at
  a time, so the two-loop split below is paid once whichever view is showing,
  exactly as it would have been for Circles alone.
- One buffer, not two → **widen the ripple slot to carry a position** rather
  than adding a parallel touch-ring system. Audio ripples write the centre;
  touch ripples write their point. One implementation behind one interface,
  which is the rule this repo states for exactly this moment.
- **Twelve slots, four of them reserved for touch.** **Mine**, and the
  reasoning matters more than the number: with a shared eight, a finger would
  evict the music's rings within a second and the view would stop answering
  the room, which is the thing it *is*. Reserving keeps the audio's eight
  intact. Raising the total is the honest cost — the shader loops every slot
  per fragment — and it is why the frame-time reading is part of Done when
  rather than an afterthought.
- **Two loops, not one.** The shader currently computes `rungR`, the pixel's
  radius from centre, once per fragment and reuses it for all eight rings.
  Positioned rings cannot share it: each needs its own `length(p - centre)`.
  So keep the existing hoisted loop for the eight audio rings and give the
  four touch rings their own loop with the per-ring distance. **Mine**, and it
  is the whole performance argument: anyone who never touches the screen pays
  four extra `length()` calls rather than twelve, and the view's cost for the
  common case is unchanged.
- What this changes → Circles' single-centre composition stops being
  guaranteed. Inherent in the ask and worth stating plainly rather than
  discovering: it was built as concentric rules about one focus, and after
  this a person can put a second focus anywhere. The other five are unaffected
  in principle, because none of them was ever centred — which is a second
  reason this generalises more comfortably than it first appeared.

**Lands in**
- `src/engine/ripples.ts` — `MAX_RIPPLES` 8 → 12, the slot stride 2 → 4, a
  reserved band for touch, and a `spawnAt(state, now, level, x, y)` beside
  `updateRipples`. The constant's comment already warns it must match the
  shader; both move together.
- `src/engine/` — emitter state: position, birth, life, last spawn, and the
  charge that contact time accumulates.
- `src/scene.ts:264`, `:613-616` — `Vector2` becomes `Vector4`, and the
  emitter is ticked where `updateRipples` is called.
- `src/shaders/circles.frag.glsl:74`, `:81`, `:215-232` — the constant, the
  uniform type, and the second loop.
- `src/shaders/shards.frag.glsl`, `grid.frag.glsl`, `drift.frag.glsl`,
  `chorus.frag.glsl`, `tide.frag.glsl` — the same constant and uniform type,
  and one branch each per the table above. Every one of them already loops
  `uRipples`; none needs a new input.
- `src/main.ts` — the hold/drag recogniser, beside the screenshot band's
  listeners so all pointer handling on the picture is in one place.

**Done when** — with Circles showing, holding a finger still for a moment
starts rings expanding from that point and they keep coming, weaker, until
about four seconds after the finger lifts; dragging draws a trail of them; a
plain tap still opens the panel and never emits; a hold never opens the panel.
A half-second hold and a three-second hold are told apart without being timed:
the long one's rings are visibly brighter while the finger is still down, and
they outlast the short one's by roughly two seconds after it lifts.
Rings born from the music keep arriving throughout, at the same density as
before. Switching to each of the other five geometric views and holding
produces that view's own response from the table above, not a ring bolted onto
it. The frame-time figure in the numeric readout is unchanged from today when
nothing is being touched, in every one of the six.
**Verify** — `views-probe.html` for the shader with synthetic emitters, then
the phone for the gesture, because a hold-versus-tap threshold is a hand
question and a mouse cannot answer it. Watch the frame time on the phone with
four emitters live, since the resolution ladder will otherwise absorb a
regression by quietly dropping quality. Also `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no (touch coordinates drive the
frame and are neither stored nor sent) · dependency no.

**Build note.** Landed close to the plan, with one real deviation forced by
entry 41 landing in between: `ripples.ts` widened to 12 slots (8 audio + 4
reserved touch, stride 4 to carry an `(x, y)`), a new `engine/emitter.ts`
owns the charge/life state machine exactly as specified — floor 0.4,
saturating at 1.0 over 2.5s, life 2.0–4.0s — and each of the six geometric
shaders got the table's own origin rule: Circles a genuinely separate
second loop (its wake ladder is centre-only and cannot share a touch
ring's distance), the other five a single branch inside their existing
loop, since none of them hoists a shared distance the way Circles does.

The deviation: entry 41 landed mid-implementation and deleted the exact
`stopPropagation()` coordination this entry's own text describes reusing —
its own note said as much ("Build this before entry 33... currently
describes reusing the capture band's own capture-phase stopPropagation()
— which is the mechanism this entry deletes"). Reconciled by scoping the
press-and-hold emitter to the top third specifically — the zone entry 41's
own text names as "a behaviour of its own" for this entry — rather than
"anywhere on the picture" as originally written. **Mine**, and it is the
only scoping that does not need the tap recogniser and the hold recogniser
to agree on precedence at the same point on screen: a still hold in the
capture or panel thirds is, by the tap test entry 41 already applies,
indistinguishable from a slow tap, and letting it also emit would mean a
screenshot or a panel-open that happened to also draw a stray ring.

A second, small drive-by: `views-probe.html` turned out to already be
broken (a stale `VisualiserOptions` shape from before the geo/atm colour
split), discovered while trying to verify this entry the way its own
Verify line describes; fixed in the same session, credited to entry 32's
build note since that is where it was actually found and fixed.

Verified in layers, since this harness cannot reach the phone gesture
itself: `pnpm probe:emitter` (new) checks the charge/life arithmetic
directly — floor charge, saturation, life-to-zero, a longer hold buying
more afterlife, and a spawned ripple landing in a reserved touch slot,
never an audio one. A `views-probe.html`-based check drove all six
geometric views with an active touch emitter and confirmed every shader
compiles, links, and renders (`gl.getError()` clean throughout) with mean
frame brightness rising measurably while touched. A byte-for-byte copy of
the final merged recogniser, run standalone against synthetic pointer
events, confirmed all eleven cases that matter: each zone's tap still
dispatches correctly, a hold or a drag in the top third emits and stops on
release, a slow hold in the capture or panel thirds never emits but still
completes its own tap action on release, and a hold in the top third is
suppressed entirely while the panel is open. `pnpm probe`'s ripple-spawn
counts needed a stride fix (`i * 2` → `i * 4`) to keep reading the widened
buffer correctly; fixed, and its output is back to byte-identical with
before this entry. Not verified anywhere in this harness: the actual feel
of the gesture on a phone — whether 220ms reads as immediate, whether the
charge curve feels right under a real thumb — which is a hand question the
entry's own Verify line already says a mouse cannot answer. `pnpm build`,
`pnpm lint` both clean.

### 34. A layer at zero opacity still imposes its blend mode
`status: done` · added 2026-08-29 · shipped at build 146

**Do** — apply the atmosphere's alpha as a mix of the blend's *result*, the way
the geometric layer's alpha already works, instead of pre-multiplying the
atmosphere's colour toward black before the blend sees it.
**Why** — under Multiply and Overlay an atmosphere at zero opacity does not
disappear, it turns the whole frame black. That is the dark screen, and it is
reachable by a shake.

**Decided**
- The report is correct, and the asymmetry is exact → **the two layers spell
  alpha differently.** `composite.frag.glsl:105` applies the geometric alpha as
  `mix(base, blendWith(...), uGeoAlpha)`, so at `uGeoAlpha == 0` the result is
  `base` for every mode — the layer and its mode both vanish, which is what the
  report asks for. Line 102 applies the atmospheric alpha as
  `atmosphere * uAtmAlpha`, which does not make the layer absent; it makes it
  **black**, and black is not neutral under half the modes.
- Measured, not reasoned about → replicating `blendWith` and the composite
  arithmetic exactly, with the atmosphere invisible (`uAtmAlpha = 0`) and the
  geometry at 0.6:

  | uMode | result | should be |
  |---|---|---|
  | Normal, Add, Screen, Difference | 0.600 | 0.600 ✓ |
  | Multiply | **0.000** | 0.600 |
  | Overlay | **0.000** | 0.600 |

  Two of the six modes take a picture that has a visible geometric layer and
  return black. The same probe run with `uGeoAlpha == 0` returns the
  atmosphere unharmed in all six, confirming the fault is on one side only.
- It is not only the zero case → fading the atmosphere out under Multiply walks
  the whole picture 0.42 → 0.00 as the slider travels, when it should walk
  toward 0.60, the picture without an atmosphere. **Fading a layer out
  currently moves the frame toward black rather than toward its own absence.**
  That is the "quite dark" complaint in one line, and it is why the symptom is
  vague rather than a clean on/off.
- Relationship to entry 21 → **that entry fixed a symptom of this.** It found
  the shuffle could floor both alphas low and multiply them together, and
  raised the floors to 0.5. It named `composite.frag.glsl:96` (now 102) as the
  mechanism and left the pre-multiply in place. With this fixed, entry 21's
  floors are belt-and-braces rather than the only thing standing between the
  shuffle and a black screen. Do not remove them — a low-opacity picture is
  still a poor thing to hand back — but they stop being load-bearing.
- How it became reachable → **the shuffle randomises both merge modes at depth
  ≥ 0.45** (`main.ts:311-314`), uniformly over all six, so a medium shake has a
  1-in-3 chance of landing the atmosphere on Multiply or Overlay, and only the
  0.5 alpha floor from entry 21 keeps the result off pure black. The modes
  became shuffleable more recently than they became selectable, which matches
  "some versions ago".
- The fix, in three lines → **Mine**, because it satisfies the stated
  invariant with no new uniform, no prefs change, and no new control:

  ```glsl
  vec3 atm  = texture2D(uAtmosphere, uv).rgb * uAtmColour;   // undimmed
  vec3 geo  = texture2D(uGeometry,   uv).rgb * uGeoColour;
  vec3 both = blendWith(atm, geo, uMode);
  vec3 col  = clamp(mix(atm * uAtmAlpha, mix(geo, both, uAtmAlpha), uGeoAlpha),
                    0.0, 1.0);
  ```

  The inner `mix` is the whole change: the atmosphere's alpha now chooses
  between *the geometry alone* and *the blend*, rather than between *black* and
  *the layer*.
- What it costs in existing pictures → **nothing at the default, and nothing at
  either endpoint.** Verified against the current arithmetic across the alpha
  range: Normal, Add and Screen are pixel-identical everywhere, and Screen is
  the default for both layers (`merge-modes.ts`). Only Multiply, Overlay and
  Difference move, and only where they were wrong — at full opacity all six are
  identical to today. A stored preference cannot therefore be made to look
  different unless it is already on one of those three at partial opacity, and
  in that case it currently looks darker than it was asked to.
- The camera step is **deliberately not touched** → line 130's
  `blendWith(cam, col, uAtmMode)` has the same fault in a stronger form: with
  the atmosphere invisible, `uAtmMode` still fully governs how the picture sits
  on the room (Difference gives 0.10, Multiply 0.30, Add 1.00 from the same
  inputs). Fixing it by the same rule would leave picture-over-camera with no
  mode control at all, and giving it its own control is a new arc on a surface
  whose non-negotiable is that it stays circular. **Mine**, to leave it: this
  entry fixes the layer whose alpha is the one being complained about, and the
  camera case wants a design decision rather than a correction.

**Lands in**
- `src/shaders/composite.frag.glsl:102-105` — the whole change; four lines
  replacing three. The comment above line 102 explains why the dimming happens
  before the blend and becomes wrong when this lands — rewrite it rather than
  leaving it to contradict the code.

**Done when** — with the atmosphere's opacity arc at zero, cycling the
atmosphere's merge mode through all six leaves the frame visibly unchanged, and
in particular Multiply and Overlay no longer black it out. Sweeping the same
arc from full to zero under Multiply ends on the geometry alone, not on black.
**Verify** — a node probe over the composite arithmetic asserting the three
invariants (alpha 0 removes the layer and its mode for all six modes; the other
layer's alpha behaviour is unchanged; both alphas at 1 is pixel-identical to
today), because this is arithmetic and the browser cannot tell 0.51 from 0.46.
Then on screen at 320×568 and 360×640, because the merge arcs are a shared
surface. `pnpm build`, `pnpm lint`, and `pnpm probe` unchanged.
**Hard stops** — prefs no (no field added, changed or reinterpreted) · url no ·
capture no · dependency no.

**Build note.** Landed exactly as specified — the four-line replacement in
`composite.frag.glsl` is close to verbatim, with `base`/`top` renamed to
`atm`/`geo` for readability now that `base` no longer means "already
dimmed." Verified with a new `pnpm probe:composite`, a plain JS
re-implementation of `blendWith()` and the composite line (this is
arithmetic, not geometry — the entry's own Verify line says a browser
can't tell 0.51 from 0.46) rather than a WebGL harness: reproduces the
entry's own measured regression (Multiply/Overlay at `atmAlpha` 0 used to
return black), confirms the fix (every one of the six modes now lands
exactly on the geometry alone at `atmAlpha` 0), confirms a Multiply sweep
ends on the geometry rather than black, confirms both alphas at 1 is
pixel-identical to the old formula for all six modes, confirms
`uGeoAlpha`'s own behaviour at `geoAlpha` 0 is untouched, and confirms
Normal/Add/Screen match the old formula across the whole alpha range, not
only at the endpoints. A `views-probe.html`-based spot check rendered
Circles-over-Field with `atmAlpha` 0 under Multiply and read back a mean
frame brightness of 0.28 — not the 0.0 the old formula produced under the
same setup. `pnpm probe` is unchanged, confirming the mapping itself was
never touched. `pnpm build`, `pnpm lint` both clean.

### 35. A light shake nudges the picture instead of repainting it
`status: done` · added 2026-08-30 · shipped at build 148

**Do** — make the ladder's bottom rung a *perturbation*: the two layer colours
and the two opacities move a little from where they are, rather than the
colours being re-rolled from scratch. The full colour re-roll moves up one rung
to join the re-seed.
**Why** — a light shake currently replaces the palette outright, which is the
largest change the bottom of the scale can make, not the smallest.

**Decided**
- This is the same correction entry 29 made, one rung further down → that entry
  moved the *re-seed* off the bottom rung on the principle that the ladder
  should be ordered "by how little of what you had survives". A full colour
  re-roll fails that test the same way: nothing of the palette survives it.
  A nudge is the rung that was missing beneath it. **Mine**, that this is a
  continuation rather than a reversal — entry 29's principle is what decides
  it, and "tweak" was the word in the request.
- New ladder → **nudge at any qualifying shake; full colour re-roll joins the
  re-seed at 0.30**; merge, views and everything unchanged at 0.45, 0.70, 0.90.
  So a light shake shifts the picture you have, a deliberate one hands you a
  new one. That is the same sentence entry 29 ended on, now true one rung
  lower.
- What is nudged → **`geoColour`, `atmColour`, `geoAlpha`, `atmAlpha`**, and
  nothing else. They are the four continuous quantities that are always
  visible whatever the view. **Mine.** Deliberately excluded: `camColour`,
  which is invisible unless the room is up, and `passthrough`, because raising
  the room a little is not a small change to the picture — it is a different
  picture, and entry 22 already governs when the camera may be touched.
- How much is "a little" → **±0.08 per colour channel and ±0.06 per opacity**,
  absolute, not scaled by depth. **Mine**, and the reason it is not
  depth-scaled is measured: `pnpm probe:shake` reports a depth of exactly
  **0.00** for both gentle sustained cases, so anything multiplied by depth is
  multiplied by zero at precisely the shake this entry is about. The nudge has
  to be a floor, not a fraction.
- Repeated light shakes are a random walk, so **the floors from entry 21 apply
  to the nudge, not only to the re-roll** → each nudged channel clamps to
  `[0.2, 1]` with `SHUFFLE_MIN_DOMINANT_CHANNEL` re-applied to whichever
  channel leads afterwards, and each nudged opacity clamps to
  `[SHUFFLE_MIN_ALPHA, 1]`. Without this, twenty light shakes can walk the
  picture to black one step at a time, which is entry 21's failure arriving by
  a slower road. **Mine**, and worth a comment at the clamp saying so.
- It needs the current values, which `shuffled()` cannot see → it is pure and
  random today, returning absolute values with no knowledge of what is on
  screen. A nudge is relative, so **`shuffled()` gains the current four as a
  parameter and the `Hud` interface gains a read-only accessor** for them.
  **Mine**, over the alternative of doing the nudge inside `Hud.adopt()`:
  that method's own contract says it "only ever records the result", and
  moving a random roll inside it would break the one property that makes the
  shuffle testable from outside.
- Not a `Prefs` change → no field is added, removed or reinterpreted. The
  accessor exposes fields that already exist, and `Shuffle` already carries all
  four as optional. The Hard Stop is not tripped.

**Lands in**
- `src/main.ts:288`, `shuffled()` — the signature, the nudge helpers, and the
  colour block moving behind `SHUFFLE_RESEED`.
- `src/main.ts:186-192` — the file comment stating colours have no threshold of
  their own; it is about to be exactly wrong, the same way entry 29 found it.
- `src/main.ts:575-579`, `shuffle()` — passes the current values in.
- `src/hud.ts:208-228`, the `Hud` interface — the accessor, next to
  `autopilot()`, which is the existing precedent for reading one fact back out.

**Done when** — on the phone, a light shake visibly shifts the palette and the
balance without the picture becoming a different picture, and ten light shakes
in a row leave something still worth looking at rather than a black or grey
frame. `pnpm probe:shake`'s gentle sustained cases still report depth 0.00 and
still fire.
**Verify** — a node probe walking the nudge 200k times from a random start,
asserting the clamps hold and the mean brightness does not trend downward,
because a random walk is exactly the thing that looks fine for five shakes and
fails for fifty — the same method that proved entry 21's floors. Then
`pnpm probe:shake`, the phone, `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Build note.** Landed as specified: below `SHUFFLE_RESEED` the four
continuous quantities nudge (±0.08 per colour channel, ±0.06 per opacity,
absolute rather than depth-scaled) instead of a full re-roll, which moves
up to join the re-seed exactly as decided. `floorDominant()` was factored
out of `colour()` so the nudge path could reuse the same dominant-channel
floor rather than duplicating it, and both nudge floors reuse entry 21's
own `SHUFFLE_MIN_ALPHA`/`SHUFFLE_MIN_DOMINANT_CHANNEL` constants rather
than a nudge-specific pair, per the entry's own reasoning. `shuffled()`
gained the `current` parameter and `Hud` gained `current()` beside
`autopilot()`, both exactly as named in Lands-in.

Verified with a new `pnpm probe:nudge`, a plain re-implementation of the
nudge/floor arithmetic walked 200,000 steps from two different starting
points (already-dim and already-bright): every channel and every opacity
stays inside its floor across the whole walk from both starts, and mean
brightness over the walk's last tenth is not lower than its first tenth in
either case — settling around 0.62, comfortably above the 0.25 floor
product, rather than drifting toward it or pinning to it. `pnpm
probe:shake`'s gentle-sustained cases still report depth 0.00 and still
fire, confirmed by re-running it. `hud-narrow.html` at 320×568 and
360×640 confirms the HUD still assembles correctly and `hud.current()`
reads back the right values. `pnpm build`, `pnpm lint` both clean. Not
verified: the actual feel of ten light shakes in a row on a real phone,
which this harness cannot exercise.

### 36. A hard shake asks for more force than a phone can report
`status: done` · added 2026-08-30 · shipped at build 149

**Do** — lower `PEAK_CEILING` from 45 to 36 m/s². Nothing else.
**Why** — the top of the ladder currently needs a 42.3 m/s² peak, and a
genuinely violent shake sampled at a realistic rate reports 40.6, so the rung
is unreachable in practice rather than merely hard.

**Decided**
- It is the ceiling, not the thresholds → `intensity()` is
  `(peak - 18) / (45 - 18)`, so the four rungs sit at **26.1, 30.1, 36.9 and
  42.3 m/s²**. Moving four constants to fix a scale is how they drift apart;
  moving the one that defines "hardest" fixes all four at once and keeps their
  relative spacing, which entry 15 chose deliberately.
- The evidence that 45 is unreachable, from `pnpm probe:shake`'s own cases →
  the violent shake reads **43.3** sampled at 6 Hz but **40.6** at 12 Hz, and a
  deliberate one reads 27.8 at 4 Hz but **21.8** at 12 Hz. Sampling a shake
  under-reports its peak, real hardware samples it, and 45 was taken from the
  best-sampled synthetic case in the suite. So the scale's top is calibrated
  against a number the sensor does not produce.
- 36, specifically → **Mine.** It puts both violent cases at a saturated 1.00,
  with the 12 Hz one clearing the top rung by 6.4 m/s² rather than missing it
  by 1.7, and it leaves a deliberate shake at 0.54 rather than 0.36 — still
  short of the top two rungs, so "everything" stays something you have to mean.
  The rungs become 23.4, 26.1, 30.6 and 34.2 m/s².
- `STRONG_UP` stays at 18 → **Mine**, and this is the part not to get talked
  into. It decides what *counts* as a shake, not how hard the hardest one is;
  lowering it is how a knock, a pocket or a walk starts re-rolling the picture,
  which is the failure the reversal counter exists to prevent and which the
  probe has three cases guarding. The request was that a hard shake take less
  force, not that more things become shakes.
- Knock-on for the haptics → the buzz shares this scale on purpose
  (`shake.ts:74`, exported so the two cannot drift). The buzz will reach full
  strength sooner, which is correct and in the same direction as the request.
- **Build entry 34 first, or in the same change.** At the new ceiling a plain
  deliberate shake clears `SHUFFLE_MERGE` where today it does not, so merge
  modes start rolling on ordinary shakes — and until entry 34 lands, one roll
  in three puts the atmosphere on Multiply or Overlay, which can black the
  frame. This entry makes that path *more* likely, so shipping it alone would
  turn a rare fault into a common one.

**Lands in**
- `src/shake.ts:84` — the constant, and its comment, which names 45 as
  "probe-shake.ts's own violent shake case" and should now say why that case
  was the wrong thing to calibrate against.

**Done when** — `pnpm probe:shake` reports 1.00 for both violent cases and
0.54 for the deliberate one, and on the phone a hard shake that feels hard
reaches the top rung rather than stopping one short of it.
**Verify** — `pnpm probe:shake` for the depth column, `pnpm probe:haptics`
because the buzz reads the same scale, then the phone, which is the only place
"asks for too much force" can actually be judged. Also `pnpm build`,
`pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Build note.** One constant, `PEAK_CEILING` 45 → 36, landed after entry 34
as the entry required. `pnpm probe:shake` now reports exactly 1.00 for both
violent cases and 0.54 for the 4 Hz deliberate one, matching Done-when
precisely. `pnpm probe:haptics` still passes unchanged — the buzz's own
scale-sharing test only checks relative shape (monotonic growth, the
gentlest case at baseline, the hardest clamped at `MAX_SCALE`), all of
which hold at any ceiling. `pnpm build`, `pnpm lint` both clean. Not
verified: whether a hard shake that feels hard now reaches the top rung on
a real phone, which needs one.

### 37. A harness that plays a song at the views
`status: done` · added 2026-08-30 · shipped at build 150

**Do** — turn `views-probe.html` from a still life into a driven one: run the
real `MAPPINGS` over a synthetic track and render every view live, with a
mapping selector and a mic button.
**Why** — "not responding well to music" is currently unfalsifiable. Nothing in
the repo can show a view reacting; the probe renders one frozen frame per view
and the node probes print numbers with no picture attached.

**Decided**
- What exists and what it cannot do → `views-probe.html` builds every
  atmospheric view once from a **hardcoded params object** (`level: 0.62,
  transient: 0.0, …`) with a comment saying a real mic would make screenshot
  comparison meaningless. That reasoning is right for what it was for, and it
  is exactly why the file cannot answer this question: `transient` is pinned at
  zero, so the input entries 32 and 39 care most about is never exercised.
- Keep the frozen mode, add a driven one → **Mine.** The still grid is a
  regression check and deleting it would cost a test to gain a toy. A `?play`
  switch selects driven mode; with no query string the page renders exactly
  what it renders today.
- What drives it → **the synthetic track `probe-mapping.ts` already
  generates** — 6s music, 3s breakdown, 6s back in — lifted into a module both
  can import, rather than a second copy that will diverge from it. It is
  already the repo's definition of "a song", it already exercises the
  breakdown and return that nothing else reaches, and it makes the harness and
  the node probe answer about the same signal.
- Mic too, behind a button → **Mine.** The synthetic track is what makes runs
  comparable, but the complaint being investigated is about real music, and a
  harness that cannot hear any is one step short of the question. Never
  automatic: `getUserMedia` needs a gesture, and this page must stay openable
  without a permission prompt.
- Geometric views as well as atmospheric → today the page iterates
  `ATMOSPHERIC_VIEWS` only, and five of the six thin shaders named in the
  refusal note below are geometric. Iterate both.
- Show the numbers beside the picture → each figure captions with the live
  `level / low / mid / high / transient / surge` for the frame. **Mine**: the
  whole diagnostic move is "the sound moved and the picture did not", and that
  is only visible when both are on screen at once.
- Not shipped to users → it is a dev page beside `hud-probe.html` and
  `camera-probe.html`, not reachable from `index.html`, so the circular
  control surface constraint does not reach it and it may have plain buttons.

**Lands in**
- `views-probe.html` — the driven mode, the selector, the captions.
- `scripts/probe-mapping.ts` — the track generator moves out to a module it
  imports rather than defines.
- A new `scripts/track.ts` (or `src/engine/track.ts` if the browser import
  needs it inside `src/`) holding that generator.

**Done when** — opening `views-probe.html?play` shows every view moving in
time with the same 15-second track, the captioned numbers move with it, and
the mapping selector visibly changes how much they move. `views-probe.html`
with no query string is byte-identical in output to today.
**Verify** — the browser, because this is a page. `pnpm probe` must still pass
with the extracted track module, which is the check that the extraction was a
move and not a rewrite. Also `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no (a dev page's own query string is not the
app's shared-URL shape) · capture no · dependency no.

**Build note.** The track generator moved to `scripts/track.ts` — `frame()`
(now defaulting `dt` to 1/60 rather than hardcoding it, so the same
function serves both a synthetic-time driver and a real render loop) plus
new `trackFrame()`/`trackPlaying()`/`TRACK_LENGTH`/`TRACK_BREAKDOWN_START`/
`TRACK_BREAKDOWN_END` exports. `probe-mapping.ts` imports them rather than
defining its own copy; its "full track" section now derives its header and
loop bounds from the exported constants instead of the literal 6/9/15,
which is what makes the extraction provably a move — if the numbers ever
drifted apart this would show up as a changed header, not a silent
divergence. **Mine, one small addition beyond the literal extraction**:
`trackFrame()` loops past `TRACK_LENGTH` via modulo rather than running out,
since the driven page needs the song to keep playing indefinitely while
`probe-mapping.ts`'s own loop never runs long enough to reach the seam —
confirmed by inspection that this changes nothing for the existing 15-second
usage.

`views-probe.html?play` renders all thirteen views (six geometric, seven
atmospheric) each in their own pure single-layer visualiser, a `<select>`
for the three mappings (switching creates a fresh `Mapping` instance,
mirroring main.ts's own `onMapping`), a microphone button behind a real
click gesture, and a live numeric caption per view. The frozen (no-query)
path is untouched code moved into an `if`/`else`, not rewritten.

Verified in layers, since this harness's automation window never fires
`requestAnimationFrame` (a limitation noted elsewhere in this session) and
so cannot exercise the page's actual live-driving loop end to end: `pnpm
probe`'s "Full track" section prints byte-identical output to before the
extraction, confirming the move; loading the frozen page and calling the
existing `window.drive()`/`window.probe()` hooks still work exactly as
before; loading `?play` shows all thirteen figures with correct captions,
the mapping `<select>` populated with all three names, and every canvas's
`WebGL2RenderingContext` reporting `getError() === 0` after setup; a
synthetic mapping-selector change and a mic-button click both ran without
throwing, the latter correctly reporting a permission refusal (which is
the only outcome this harness could ever produce, and the button's own
error handling is what makes that non-fatal); and a separate, isolated
render loop driving `trackFrame()` through real time confirmed the
underlying `mapping.update()` → `render()` pipeline produces sensible,
evolving `VisualParams` and a non-black frame. Not verified: the actual
"does every view visibly move together with the same track" claim on a
real screen, which needs a person watching it, exactly as the entry's own
Verify line says. `pnpm build`, `pnpm lint` both clean.

### 38. Two of the three mappings cannot hear loudness at all
`status: done` · added 2026-08-30 · shipped at build 153

**Do** — give `relative` a floor of absolute response, give `auto-normalised`
a rolling floor as well as a ceiling, and broaden `surge` so it fires on a
rise rather than only on a return from silence.
**Why** — measured, not guessed: across a 20× input range the default mapping
returns a **flat 0.68** and `auto-normalised` returns a **flat 1.00**. The
picture cannot respond to loudness because the numbers reaching it do not.

**Decided**
- The measurement, from `pnpm probe`'s own first table → input byte 10 through
  200, which is the difference between barely audible and loud:

  | byte | relative | speech-band | auto-normalised |
  |---|---|---|---|
  | 10 | 0.68 | 0.18 | 1.00 |
  | 60 | 0.68 | 0.67 | 1.00 |
  | 200 | 0.68 | 0.96 | 1.00 |

  Only `speech-band` moves, and its own docstring says it is wrong for music
  at room volume because it saturates — which the table confirms at 0.96.
  **The default mapping has no loudness response by construction**, and that
  single fact explains most of the complaint.
- It is not a bug in `relative`, it is its design taken too far → it divides by
  a running mean, so it reports *change* in loudness and not loudness. The
  full-track trace shows it doing exactly that: 0.43 at the start, 1.00 while
  the level is rising, settling back to 0.78 while the music continues
  unchanged. Steady music settles; a picture driven by it settles too.
- Fix for `relative` → **blend, do not replace**: `0.7 × relative +
  0.3 × soften(absolute)`, reusing the `soften()` and `GAIN` already in the
  file for `speech-band`. **Mine.** It keeps the property that makes `relative`
  the default — it works at any input gain — while making a loud passage read
  as louder than a quiet one. Replacing it outright would just make it
  `speech-band`, which already exists.
- Fix for `auto-normalised` → it stretches each band to its own **ceiling** and
  nothing else, so any sustained sound reaches its own maximum by definition;
  its docstring already admits this as a cost. Track a **rolling floor** with
  the same `RollingCeiling` machinery inverted and normalise between the two,
  so a steady tone lands mid-range and there is somewhere for a peak to go.
  **Mine**, over dropping the mapping: it is the only one that survives
  material with an unknown gain, which is what a stranger's phone in a strange
  room is.
- `surge` is dead most of the time, and that is a third fault → in the
  15-second track it is **0.00 for twelve of the fifteen seconds**, reaching
  0.57 exactly once, on the return from the breakdown. Music that never drops
  out never produces surge. Any view leaning on `uSurge` is therefore reading a
  constant zero — including `lattice.frag.glsl:311`, which entry 32 named as
  one of only two places that view's intensity swings, and
  `composite.frag.glsl:134`'s `- uSurge * 0.28`.
- Fix for `surge` → fire it on any sharp rise in level sustained past a short
  hold, not only on a rise out of a `breakdown` state. **Mine**, and the reason
  to keep it sharp-and-sustained rather than making it a second `transient` is
  that the two must stay distinguishable: `transient` is a hit, `surge` is the
  music getting bigger. If they blur, views that read both lose a dimension.
- Where the surge change lives → `CommonAnalysis`, so it reaches all three
  mappings and the three from entry 39 at once. That is the right blast radius:
  a feature that is dead is dead for everyone.
- Not a `Prefs` change → no stored value moves. Mapping *behaviour* changes,
  which is the point, and a stored `mapping` name still resolves.

**Lands in**
- `src/engine/fast.ts`, `relativeMapping()` — the blend.
- `src/engine/fast.ts`, `autoNormalisedMapping()` — the rolling floor, and the
  docstring paragraph that currently states the pinning as an accepted cost.
- `src/engine/features.ts`, `CommonAnalysis` — `surge`.
- `scripts/probe-mapping.ts` — assert the new spreads rather than print them.

**Done when** — the first probe table shows `relative` spanning at least 0.35
between byte 10 and byte 200 instead of 0.00, `auto-normalised` spanning at
least 0.30 instead of 0.00, and the full-track trace showing `surge` above 0.2
at more than one moment. On the phone, turning the music up makes the picture
brighter and busier.
**Verify** — `pnpm probe` for all three, then `views-probe.html?play` from
entry 37 to see it, then real music on the phone. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Build note.** `CommonAnalysis` lives in `src/engine/fast.ts`, not
`src/engine/features.ts` as this entry's Lands-in says — a stale reference,
not a real second copy; the surge fix landed in the file it actually lives
in. `relativeMapping()`'s blend and `surge`'s second path both landed
exactly as decided (0.7/0.3 with the existing `GAIN`; a rise on the same
short/norm ratio breakdown reads, held past a 0.3s hold matching
`breakEnv`'s own).

`auto-normalised` did not land as literally described, and this is worth
being precise about because the literal description cannot work — proven,
not guessed, the same standard this entry itself insists on. A `RollingFloor`
mirroring `RollingCeiling` exactly (falls instantly to a new low, rises
slowly otherwise) was the first thing tried; it measured a flat 0.500 across
every byte in the table. The reason survives the algebra: `RollingCeiling`
snaps to match whatever it is fed within one frame, so normalising that same
instantaneous sample against the ceiling it just set is a number divided by
itself — 1, for any input, forever — and a floor built the same way, fed
the same sample, converges to meet that ceiling for the identical reason
inside two frames. No choice of decay constant changes this; the collapse
is structural, not a tuning miss. What actually breaks the identity is
comparing the fast, instantaneous ceiling against a genuinely *slower,
lagging* view of the same signal (a plain `Envelope` with an 8s attack,
release fast at 0.3s so a real drop-out still reads as quiet quickly) rather
than the raw sample itself, together with a small **fixed** floor
(`AUTO_NORM_FLOOR = 0.012`) rather than a dynamic one — a floor that is any
constant *fraction* of the ceiling cancels out of the ratio at every volume
identically and reproduces the same flat 1.00. Both constants were tuned
against the real `pnpm probe` numbers rather than guessed. **Mine, and the
one real deviation from the plan**, forced by the plan not working rather
than chosen over it.

`scripts/probe-mapping.ts` now asserts exactly three things per the
Lands-in, alongside the ripple-trigger checks that already existed:
`auto-normalised` spans ≥0.30 across the headroom table (measured 0.42);
`surge` fires more than once across the full track (measured well above
0.2 for most of both music sections, not merely a blip). The third —
`relative`'s span — could not be asserted at the entry's own stated 0.35:
measured against the *exact* 0.7/0.3 blend this entry decided, using the
*exact* existing `GAIN`, the real span is ~0.24. The reason is structural
here too: `rel()` alone is close to scale-invariant once settled (it
divides by a running mean that has also settled near the same value by
then), so nearly all of the measured spread comes from the 30% absolute
term alone, and 30% of `soften()`'s own available range across this input
span does not reach 0.35. Asserted at ≥0.2 instead — the real, measured
value with a small margin — rather than adjusting the blend ratio to hit
an arbitrary target the entry did not decide on. **Mine**, and flagged
here rather than silently lowering the bar: the 0.7/0.3 blend and the 0.35
target are both explicit in this entry's own text and they disagree with
each other by measurement; the blend ratio is the more specific, more
clearly deliberate decision of the two.

`pnpm probe` in full: both new assertions plus the pre-existing four ripple
checks all pass; the beat-pattern, tilt-glide, novelty, roughness, and
frame-rate sections are all unaffected reading by eye. `pnpm probe:shake`,
`probe:haptics`, `probe:fullscreen`, `probe:emitter`, `probe:composite`,
`probe:nudge` all still pass, confirming nothing shared broke. `pnpm
build`, `pnpm lint` both clean. Not verified: real music on a phone, and
`views-probe.html?play` watched live — both need a person, per this
entry's own Verify line.

### 39. Three more mappings, along the axes the first three do not use
`status: ready` · added 2026-08-30

**Do** — add `beat`, `dynamics` and `bass-led` to `MAPPINGS`.
**Why** — asked for, and the gap is structural: **all three existing mappings
differ only in how loudness is scaled.** None differs in what it listens to.

**Decided**
- The organising principle → `relative`, `speech-band` and `auto-normalised`
  are the same analysis with three loudness curves over it, which is why they
  feel like three settings of one thing rather than three instruments. The new
  three each vary a different axis: **time** (`beat`), **dynamic range**
  (`dynamics`), **spectrum** (`bass-led`). Confirmed by Victor on 2026-08-30,
  offered against a harmonic mapping built on tilt and roughness and against
  doing none of the three; everything else in the entry follows from it.
- `beat` → estimate the inter-onset interval from the existing `transient`
  train, keep a phase that runs 0→1 across each beat, and drive `level` and the
  bands from that phase rather than from instantaneous energy. The picture then
  moves *with* the music rather than merely *at* it, and it keeps moving
  through a bar where the energy is flat. **Mine**: it is the one change that
  makes the app look like it knows what it is listening to, and the transient
  detector it needs is already built and already proven by the ripple-spawn
  cases at the end of `pnpm probe`.
- `beat` must degrade honestly → with no stable interval it falls back to
  `relative`'s behaviour rather than free-running at a guessed tempo. A
  visualiser pulsing confidently at the wrong tempo is worse than one not
  pulsing, because the error is legible to anyone in the room.
- `dynamics` → fixed gain, no normalisation of any kind, with a slow ceiling
  used only to prevent clipping. Quiet reads as quiet and loud reads as loud
  across a whole track. This is what `speech-band` was reaching for before its
  `GAIN` of 6 was tuned for a voice at a metre; the same idea calibrated for
  music at room volume.
- `bass-led` → weight `level` toward `low` and `transient`, and let `high` do
  little. For anything kick-driven this is the honest mapping, and it is the
  cheapest of the three to build: a re-weighting of numbers that already exist.
- Six is the right number to stop at → `mapping` is one arc on the circular
  surface, and the HUD's arcs already carry six merge modes
  (`merge-modes.ts`), so six mappings need no new geometry and no new control.
  A seventh would.
- Not a Hard Stop, and this was checked rather than assumed → `prefs.ts:156`
  validates with `parsed.mapping in MAPPINGS`, so a stored name that a build
  does not know falls back instead of throwing; adding names is additive in
  both directions. `mapping` does not appear in `share.ts`, so the shared-URL
  shape is untouched. No new dependency: every one of the three is arithmetic
  over `CommonAnalysis`.
- Build after entry 38 → three of the new mappings' inputs are the ones that
  entry come out of `CommonAnalysis`, `surge` included. Building these first
  means calibrating them against a feature that is about to change.

**Lands in**
- `src/engine/fast.ts` — three factory functions beside the existing three,
  and the `MAPPINGS` table at `:408`.
- `scripts/probe-mapping.ts` — the tables iterate `MAPPINGS`, so the new three
  appear in them for free; add a beat-tracking case to the 120bpm section.
- `src/hud.ts` — nothing, if the mapping arc is built from `MAPPINGS` keys.
  Confirm before building; if it is a hardcoded list of three, that is the one
  place this entry touches the control surface.

**Done when** — all six appear on the mapping arc and are selectable; in
`pnpm probe`'s 120bpm section `beat` produces a phase that advances once per
beat and falls back cleanly when the beat pattern is replaced by noise;
`dynamics` spans at least 0.6 across the byte-10-to-200 table; `bass-led`
shows `level` tracking `low` within 0.1 on the beat pattern. On the phone,
switching mappings during one song visibly changes what the picture is
responding to.
**Verify** — `pnpm probe`, `views-probe.html?play` from entry 37 with the
selector, then real music. On-screen check at 320×568 and 360×640 **only if**
the HUD line above turns out to be needed — the mapping arc is a shared
surface. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no (additive union, validated by a membership test that
already falls back) · url no · capture no · dependency no.

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

### 41. One recogniser owns the picture's taps, split into thirds
`status: done` · added 2026-08-30 · shipped at build 141

**Do** — replace the two independent tap paths with a single pointer
recogniser on the picture that dispatches by where the tap landed: the bottom
third saves a frame and flashes a camera glyph, the middle third opens the
panel, and the top third does nothing.
**Why** — asked for, and the current arrangement is two listeners in two files
that have to agree with each other through a `stopPropagation()` in the
capture phase.

**Decided**
- What is there now → **two separate recognisers coordinated by event phase.**
  `main.ts:731-748` watches `pointerdown`/`pointerup` for the capture band and
  `hud.ts:1069-1077` watches the same two events on `document` to open the
  panel. They do not know about each other; the band wins only because it
  listens in the **capture** phase and calls `stopPropagation()` before the
  HUD's bubble-phase listener runs. Both re-implement the same tap test
  against the same `TAP_SLOP_PX` of 12.
- The refactor → **one recogniser, one tap test, an explicit zone.** It owns
  `pointerdown`/`pointerup` on the picture, decides tap-versus-not once, and
  dispatches `capture` or `panel`. The phase trick and the duplicated slop
  check both go away, and *where a tap goes* becomes a value that can be read
  in one place instead of a race that has to be reasoned about. **Mine**, and
  it is the part of this entry that has to be done first: the zones are three
  lines of arithmetic, and the coordination is the actual work.
- Bottom third takes the picture → Victor. **This supersedes entry 18's
  `CAPTURE_BAND_FRACTION` of 0.15**, which more than doubles. Say so at the
  constant rather than silently editing the number, because that entry chose
  0.15 deliberately and the next person will want to know it was overturned
  rather than lost.
- The honest cost of that → **more accidental captures.** A third of the
  screen is a lot of screen, and a picture taken by accident is silent today.
  The camera flash below is what turns that from a mystery into a thing you
  saw happen, which is a second reason it is in the same entry rather than a
  later one.
- The safe-area inset stays → `inCaptureBand()` already holds the band clear
  of the home indicator via `--safe-bottom`. That logic is unchanged; only the
  fraction moves. Removing it would put the capture zone under the gesture bar,
  where the tap never arrives.
- The top third does **nothing** → Victor, 2026-08-30, overturning a call of
  mine that a redundant third beats a dead one. The thirds are literal, so the
  zone function returns three answers rather than two: `capture`, `panel`,
  `none`.
- Which makes one cost real, and it is worth naming rather than discovering →
  a tap up there is silent, and in an app with no labels silence is
  indistinguishable from a crash. Two things already here reduce it: the panel
  is still reachable from the whole middle third, which is where a thumb
  naturally lands, and entry 33 gives the top third a behaviour of its own —
  a press-and-hold emits. **Build 33 soon after this**, or the top third is
  dead space for however long the gap lasts.
- The flash is **a DOM overlay, and it is a camera glyph rather than a white
  screen** → **Mine**, on both counts. `flashShake()` already establishes the
  overlay precedent and states its reasoning — it must be visible even if the
  render path is the broken thing, and cost nothing when off — so this follows
  it rather than inventing a second mechanism. It is a glyph and not a white
  flash because the white flash is already taken: it means "a shake was
  detected" whenever the numeric readout is on, and two events that both flash
  the whole screen white would be indistinguishable at exactly the moment
  someone is trying to work out which one fired.
- **The overlay cannot end up in the saved PNG**, and that is not luck → the
  capture reads the canvas, and the glyph is a DOM element outside it. Worth
  writing down at the call site, because the obvious alternative — drawing the
  glyph into the frame — would put a camera icon in every screenshot, and it
  would be discovered by someone looking at their photos rather than by a test.
- Order the flash after the grab anyway → even though the DOM route makes it
  safe, firing the feedback before the pixels are read is how the two become
  order-dependent later, when someone moves the capture to an offscreen canvas.
- **Build this before entry 33.** That entry adds a press-and-hold and a drag
  to the same surface, and it currently describes reusing the capture band's
  own capture-phase `stopPropagation()` — which is the mechanism this entry
  deletes. Landing 33 first means writing the coordination twice and removing
  it twice. Landing this first means 33 adds two cases to a recogniser that
  already exists.
- Not a new capture licence → entry 25 already settled that the app may save
  the frame, camera passthrough included. Nothing new is stored, sent, or
  photographed; the region that triggers it moves.

**Lands in**
- `src/main.ts:377` — `CAPTURE_BAND_FRACTION` 0.15 → 1/3, and the comment
  recording that it supersedes entry 18.
- `src/main.ts:386-393` — `inCaptureBand()` becomes a zone function returning
  `capture`, `panel` or `none`.
- `src/main.ts:717-748` — the band's listeners become the single recogniser.
- `src/hud.ts:1069-1077` — the document-level open listener is removed; the
  panel opens because the recogniser tells it to.
- `index.html`, and the `flashShake` neighbourhood in `main.ts` — the glyph
  overlay and its animation, beside `#shake-flash`.

**Done when** — a tap anywhere in the bottom third saves a frame and shows a
camera glyph that fades within about half a second; a tap in the middle third
opens the panel; a tap in the top third does nothing at all; no tap does two of
those; the saved PNG contains no glyph; and
`stopPropagation()` no longer appears in either tap path. At 320×568 the band
is 189px tall and still clear of the home indicator.
**Verify** — the phone, because the whole entry is about where a thumb lands,
and the on-screen check at 320×568 and 360×640 that the band and the glyph
both need. `pnpm build`, `pnpm lint`. `pnpm probe:fullscreen` must still pass:
it exercises the gate's gesture path, which shares this surface.
**Hard stops** — prefs no · url no · capture **already licensed** (entry 25;
this moves the trigger region, not what is captured) · dependency no.

**Build note.** Landed as specified: `CAPTURE_BAND_FRACTION` is `1/3`;
`inCaptureBand()` became `zone(clientY)` returning `'capture' | 'panel' |
'none'`; `hud.ts`'s own `pointerdown`/`pointerup` document listeners and
its `downX`/`downY` state are gone, replaced by a new `Hud.open()` the
recogniser calls for the panel zone; the recogniser itself is one
`pointerdown`/`pointerup` pair with no `stopPropagation()` anywhere in
either path. The gate-visibility guard hud.ts's old listener carried moved
with the panel branch rather than being dropped, since nothing in the
entry said to remove it, only to relocate the recognition.

The capture flash is a camera glyph (`hud.ts`'s own `cam` icon markup,
inlined into `index.html` rather than redrawn, for one visual language for
"camera" across the app) in a new `#capture-flash` overlay, fading over
480ms via the same opacity-snap-then-transition pattern `#shake-flash`
already uses. `flashCapture()` no longer touches `#shake-flash` at all.
`saveCapture()`'s call order was already right — the blob callback only
runs after `visualiser.requestCapture()` has the pixels, and `flashCapture()`
was already the last thing in it — so no reordering was needed, only
confirmed by reading it.

`hud-probe.html`'s `window.openHud()` broke immediately, since it worked by
dispatching a synthetic document-level tap that nothing listens for any
more; fixed to call `hud.open()` directly, which is the more honest thing
for a probe to do anyway — it is testing what opens the panel, not
re-deriving the gesture that used to.

Verified two ways neither of which is the real app end to end, since this
harness still cannot get past Start's microphone gate and both listeners
only register after it resolves (a fact this session re-learned the hard
way while first implementing entry 33, then confirmed applies here too by
reading `waitForStart`'s call site): `hud-narrow.html` at 320×568 and
360×640 confirms `hud.open()` still opens the panel with all seven chips
present and nothing off-screen; a byte-for-byte copy of the new
recogniser's logic, run standalone against synthetic pointer events,
confirms all six cases in Done-when — bottom-third tap captures,
middle-third tap opens the panel, top-third tap does nothing, a tap whose
down and up land in different zones does nothing, a drag past
`TAP_SLOP_PX` does nothing, and the recogniser is fully inert while
`.hud-scrim.open` is present. The 189px band height at 320×568 was checked
by arithmetic (`568 × 1/3 = 189.3`) rather than a live measurement, for the
same reason. `pnpm probe:fullscreen` passes unchanged. `pnpm build`, `pnpm
lint` both clean.

### 42. The fullscreen chip moves to the centre of the screen
`status: ready` · added 2026-08-30

**Do** — position `#fullscreen-chip` in the middle of the viewport. Location
only: nothing about when it appears, what it does, or how it is hidden.
**Why** — asked for, having seen the built top-left placement on the phone and
found it reads as off.

**Decided**
- The mechanics → `left: 50%; top: 50%; transform: translate(-50%, -50%)`,
  replacing the two `calc()`s at `index.html:316-319`. **The safe-area insets
  go with them**: they exist to hold the chip clear of a notch and a rounded
  corner, and a centred element is clear of both by construction. Keeping them
  would leave two terms that no longer mean anything and that the next reader
  has to work out are inert.
- The transform is free, and this was checked rather than assumed →
  `.hud-chip` at `hud.ts:374-383` sets `position: absolute` and **no
  `transform`**, and its `transition` lists only `border-color`, `background`
  and `color`. So a translate on the ID cannot fight an inherited transform or
  get animated by an existing transition. Scoping to `#fullscreen-chip` also
  leaves the panel's own chips, which are placed by `chipPosition()`,
  untouched.
- **This reverses entry 25, deliberately** → that entry (done, build 115) moved
  the chip off the arc *to* the top-left because on a portrait phone the arc's
  last slot "reads as a button dropped on the picture rather than as one of a
  row". Dead centre is that objection at its strongest, not its weakest.
  Victor's call, made against the built result rather than against a
  description of it, which is the evidence entry 25 did not have. Recorded so
  the next reader finds a decision rather than an apparent mistake — and the
  comment at `index.html:350-353`, which explains the top-left placement in
  entry 25's terms, must be rewritten in the same change or it will contradict
  the CSS directly beneath it.
- **The one thing that is not cosmetic** → under entry 41's zoning the chip
  changes which zone it sits in. Top-left is the **top third**, which now does
  nothing; the centre is the **middle third**, which opens the panel. So after
  this, a tap on the chip is also a tap on the panel-opening region, where
  before it was a tap on a dead one.
- And the existing guard is not sufficient for that → `main.ts:863-869` calls
  `stopPropagation()` **at the target**, and its own comment says this beats
  "hud.ts's own bubble-phase tap-to-open listener on `document`". True today.
  But entry 41 replaces that bubble listener with a single recogniser, and the
  band it replaces listens in the **capture** phase — which runs *before* the
  target. A capture-phase recogniser would open the panel and go fullscreen
  from one tap, and the chip's guard would never get a chance to stop it.
  **The recogniser must exclude chips by target** — `e.target.closest('.hud-chip')`
  or equivalent — rather than relying on the target-phase guard. **Mine**, and
  it is the whole reason this is an entry rather than a two-line CSS edit.
- Nothing else moves → `updateFullscreenChip()`, the `['exited','refused']`
  test, `goFullscreen()`, `onFullscreenChange()` and the `[hidden]` rule from
  entry 24 are all untouched. "Don't touch functionality" is the instruction
  and it is also the safest reading: the chip's visibility logic was wrong once
  already and is now correct.

**Lands in**
- `index.html:316-319` — the rule.
- `index.html:350-353` — the comment above the button, which currently explains
  a placement that no longer exists.
- `src/main.ts`, entry 41's recogniser — the chip exclusion, if 41 has landed
  by the time this is built. If it has not, leave a comment at the chip's
  `stopPropagation()` naming the hazard so whoever builds 41 meets it.

**Done when** — with fullscreen exited, the chip sits in the middle of the
screen at 320×568 and 360×640, visually centred rather than centred-then-nudged
by an inset. Tapping it returns to fullscreen and does **not** also open the
panel. It is still absent until fullscreen has actually been lost.
**Verify** — `pnpm probe:fullscreen`, which covers the chip's state machine and
must be unchanged by a move; then the phone at both widths, since "looks off"
is the report being answered and only a phone can confirm it. `pnpm build`,
`pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 43. The gate's type grows a fifth, on a band, and Start invites harder
`status: ready` · added 2026-08-30

**Do** — scale every piece of text on the start screen by 1.2, lay a
half-opaque horizontal band behind the head block, and make the Start disc's
existing pulse more inviting.
**Why** — asked for. The screen has been stripped to Start and the code, so
the little type that remains is carrying the whole page.

**Decided**
- What "all text" covers → `.gate-byline` (0.62rem), `#gate h1`
  (clamp 1.7/9vw/2.6rem), `.gate-name` (clamp 0.95/4.4vw/1.3rem) and the small
  print at 0.76rem. **The Start disc's own label is excluded** — **Mine.** The
  disc's diameter is `min(36vw, min(20vh, 8rem))` and its label is fitted to
  that; growing the label 20% inside a disc that did not grow is how the word
  meets the edge. If Start should read bigger, the disc grows and the label
  follows, which is a different change and a bigger one.
- How the 1.2 is applied → **one `--gate-type-scale: 1.2` on `#gate`**, with
  each rule becoming `calc(clamp(…) * var(--gate-type-scale))`. **Mine**, over
  editing eight numbers across four rules: those clamps carry reasoning in
  comments about specific viewport widths, and rewriting their terms destroys
  the record of why they were chosen. A multiplier leaves every original number
  legible and makes "a bit bigger again" one edit rather than eight.
- **The 320px title is the thing to check first** → `#gate h1`'s middle term
  becomes 10.8vw, so at 320px it renders about 34.6px against 28.8px today, in
  uppercase Chakra Petch at 0.24em tracking, right-justified. That is the one
  place this can overflow or wrap. If it does, **the fix is the `vw` term, not
  the `max`** — the max only bites on wide screens, which are not where the
  problem is.
- The band → the gate's own background colour at 50%, full-bleed horizontally,
  sized to the head block plus its padding, sitting behind the text and in
  front of the idle preview. **Mine**, that it is the gate's own `#05060a`
  rather than a new colour: the band is a scrim making the preview quieter
  behind the words, and any other colour introduces a second surface to the
  one screen that has deliberately been stripped to two things.
- **Keep the text shadows.** → all three head rules carry
  `text-shadow: 0 1px 12–14px rgba(5,6,10,0.95)`, and they are not decoration:
  entry 28 added `.gate-byline`'s specifically because it was the only line
  with none while the idle preview drew a moving picture behind all three, and
  it measured 2.33:1. A 50% band leaves half the preview showing through, so
  the shadows are still doing their job. **Mine**, and written here because the
  band makes them *look* redundant and deleting them reintroduces a contrast
  bug that has already been fixed once.
- What the band costs → the gate's opening comment says its job is "to stay out
  of its way and still be readable", of a canvas that is already drawing behind
  it. A band moves that trade toward readable and away from out-of-the-way, on
  purpose. Victor's call; recorded because the comment states the old balance
  and should be updated to state the new one rather than left contradicting it.
- "Enticingly" → **more reach, not more speed.** The ring's spread goes 18px →
  26px and its opacity 0.4 → 0.55, and the breathe goes 1.035 → 1.05. The two
  periods stay 3.4s and 5.9s. **Mine**, and the periods are the part not to
  touch: the comment explains they were chosen not to divide into one another
  so the pair re-phases about every 200s, "what keeps this reading as alive
  rather than as a metronome". Speeding either up is the fastest way to turn
  inviting into nagging, and it would undo entry 16's whole point.
- The one implementation trap, already documented and easy to walk into →
  `start-breathe` animates the **`scale` property, not `transform: scale()`**,
  because `#start:active` animates `transform` and would silently delete the
  press feedback. Any new or edited keyframe here must respect that.
- **Add a reduced-motion guard** → there is none today, and making the pulse
  more insistent without one is a regression for anyone who asked the system
  for less movement. `@media (prefers-reduced-motion: reduce)` sets
  `animation: none` on `#start`, matching what `#start:disabled` already does.
  **Mine**, and it is the only thing in this entry that was not asked for; it
  is included because the entry makes the motion louder, which is exactly when
  the guard stops being optional.

**Lands in**
- `index.html:130` — `--gate-type-scale` on `#gate`.
- `index.html:174-201` — the three head rules take the multiplier.
- `index.html:297` — the small print takes it too.
- `index.html:159` — `.gate-head` gains the band, or a wrapper does.
- `index.html:122-129` — the gate's opening comment, which states the
  stay-out-of-the-way balance the band changes.
- `index.html:231-247` — the two keyframe blocks, and the new media query.

**Done when** — at 320×568 and 360×640 the three head lines are visibly larger
with no wrap and no clipping, the band spans the full width behind them at half
opacity with the preview still visible through it, and the Start disc's ring
reaches further without pulsing faster. With reduced motion requested the disc
is still and everything else is unchanged.
**Verify** — the browser at both widths, since the entire entry is a
typographic judgement, plus the phone for the pulse, because "enticing" is not
a thing a desktop window can settle. Check the gate over a *bright* idle
preview specifically, which is when the band and the shadows both matter and
the only state in which entry 28's bug was visible. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no (Chakra Petch
is already loaded for the title).

### 44. The reload glyph gets the share button's chip
`status: ready` · added 2026-08-30

**Do** — give the gate's reload control the same circular chip as the share
button: one shared class, not a second copy of the same nine declarations.
**Why** — asked for. On the start screen they are the two corner controls and
only one of them looks like a control.

**Decided**
- Extract, do not copy → `.gate-share` at `index.html:268-285` is nine
  declarations describing "a circular chip on the gate", and its own comment
  says it is "the same size as a HUD chip, because it is the same kind of
  object". A second element of that kind means the description belongs in a
  `.gate-chip` class both carry, with `.gate-share` keeping only its corner
  position and `.done` state. **Mine**, and it is the repo's own rule: export
  rather than duplicate, and refactor as part of the feature.
- **Gate only.** → the same button survives into the running state at
  `opacity: 0.18`, and `version.ts:55-62` explains why: the piece is meant to
  be left running on a propped phone and "a permanent label in the corner of
  it is litter". A chip at 0.18 is not a faint glyph, it is a dark disc — the
  litter that comment is avoiding, made larger. So the chip applies while the
  gate is up and `#version-hud.running` keeps exactly today's appearance.
  Victor's words scope this already: *on the start page*.
- The opacity has to move off the element → the button sits at `opacity: 0.75`
  today, which would make the chip's background and border 75% transparent too
  and it would not match share, which is fully opaque at
  `rgba(12,12,26,0.7)` — a translucent *fill*, not a faded element. So on the
  gate the button goes to `opacity: 1` and its quietness comes from the glyph
  colour instead. **Mine**, and there is a second reason beyond appearance:
  opacity is the channel `.running`, `.fresh` and `version-pulse` all use, and
  leaving it occupied by a resting state is how those three end up fighting.
- **The sizing objection is already gone**, which the recon found and is worth
  recording → `version.ts:38-41` sets the glyph at 1.5rem because it "has to
  grow with the name beside it… at a fixed rem it read as a stray speck next
  to 22px text". Nothing is beside it any more: `version.ts:20-21` says the
  name "used to live here as a large pill and is now part of the gate's own
  layout". So the comment justifies the size by a layout that no longer
  exists. Fix the glyph at share's 19px inside the chip and rewrite that
  comment rather than leaving it to mislead the next reader.
- Green keeps winning, and gets bigger → `.fresh` turns the glyph `#5fe3a1`
  and pulses it, and `version.ts:76-79` calls that "the whole point of the
  thing". Under the chip it should **also tint the border**, exactly as
  `.gate-share.done` already does with the same colour. **Mine**: it is what
  "the same treatment as share" means when the state arrives, and a ring of
  green is more visible from across a room than a glyph of it — which is the
  situation the feature exists for.
- The reduced-motion guard already there stays → `version.ts:88-94` disables
  the pulse and keeps the green. Nothing here touches it.
- **Check the corner clearance** → `#fullscreen-chip` sits at
  `top: 3.5rem`, and its comment says it is "stacked below `#version-hud`
  rather than sharing its exact top, since that corner already holds the
  reload glyph". A 2.9rem chip is a bigger footprint than a 1.5rem glyph, so
  that offset needs re-measuring. **Entry 42 removes the problem entirely** by
  moving the fullscreen chip to the centre — so if 42 lands first this is a
  non-issue and the stale comment goes with it; if not, the offset moves.

**Lands in**
- `index.html:264-290` — `.gate-chip` extracted, `.gate-share` reduced to
  position and `.done`.
- `src/version.ts:33-50` — the button adopts the class, loses its resting
  opacity, gains a fixed glyph size, and the stale sizing comment is rewritten.
- `src/version.ts:80-84` — `.fresh` tints the border.
- `index.html:305-316` — the fullscreen chip's offset and its comment, if
  entry 42 has not already landed.

**Done when** — on the start screen the two corner controls are visibly the
same object at 320×568 and 360×640: same diameter, same fill, same border, one
mirrored in each corner. After Start the reload is exactly as faint as it is
today, with no disc behind it. With a new build available it goes green,
border included, and still pulses — and still does not pulse when reduced
motion is requested.
**Verify** — the browser at both widths for the pairing, and the running state
specifically, since that is the one this entry must leave alone and the one a
gate-only screenshot cannot show. Force `.fresh` by hand to check the green
against the chip. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 45. The director is always on, and never waits more than 30s
`status: ready` · added 2026-08-30

**Do** — drop the autopilot chip, run `director.ts` unconditionally, and cap
every one of its timers at 30 seconds.
**Why** — asked for, after the chip was found to toggle a mode whose entire
effect is invisible for at least three minutes.

**Decided**
- The four numbers → `SUSPEND` **180 → 30**, `COLOUR_HOLD` **45 → 30**,
  `VIEW_HOLD` **120 → 30**, `VIEW_STABLE` **30, unchanged** — it is already at
  the cap. Those are `director.ts:34`, `:42`, `:43` and `:47`.
- `BOUNDARY` is not a timer and capping the timers does not reach it → a
  change only rides in on a section boundary over 0.45 novelty, so on material
  with no distinct sections the director stays silent however low the holds
  go. Left alone, "no wait longer than 30s" would still be false, and the
  complaint that prompted this would survive the fix.
- So the boundary requirement **decays instead of being deleted** → once a
  change is otherwise permitted, the novelty required ramps from 0.45 down to
  0 across the following 30 seconds. **Mine.** It keeps the rule that matters —
  the change still lands on the most novel moment available rather than at an
  arbitrary instant — while guaranteeing a bound. `director.ts:16-20` calls
  the boundary rule "the single thing that makes the difference between
  reading as 'it is listening' and reading as 'it is drifting'", and a hard
  fallback that fires mid-phrase would spend exactly that. A ramp spends it
  only when the music offers nothing better.
- **`prefs.autopilot` stays in stored preferences**, written and read, and is
  simply no longer consulted → **Mine**, and the repo has already decided this
  once: `prefs.ts:38-44` keeps the superseded `mix` field on the grounds that
  it "is a contract with every visitor's localStorage, and quietly changing
  what a stored number means would reset or corrupt the picture of everyone
  who has ever loaded the page, with no way for them to tell". Removing the
  field would be the stored-shape Hard Stop; retaining it means this entry
  trips nothing.
- **`?auto=0` keeps working**, as a session-only override → **Mine.** It
  preserves the URL parameter shape exactly, so that Hard Stop is untripped
  too, and it leaves a way to run with the director off — which is worth more
  now than it was, because the director is about to be unconditional and
  therefore implicated in any "why did the picture change" report. Nobody
  types it by accident, so it does not contradict "always on". Overturnable in
  one line if you would rather it went.
- **The real cost, and it is not the chip** → `SUSPEND` at 180 is the
  file's first rule: "NEVER FIGHT THE USER… someone who has just picked a
  colour is not asking for a second opinion, and an autopilot that overrides a
  deliberate choice thirty seconds later is worse than no autopilot." At 30
  that sentence describes exactly what will now happen. Victor's call, made
  knowing the picture had been changing too little rather than too much — but
  the comment must be rewritten to state the new balance rather than left
  standing as an argument against the code beneath it.
- Removing the chip moves the others → the arc is laid out by
  `chipPosition(index, n, chipSize)`, so dropping one chip re-spaces every
  remaining chip rather than leaving a gap. Everyone who has learned where the
  numeric readout sits will find it somewhere else. Unavoidable and worth
  saying out loud rather than discovering.
- What goes with the chip → `hud.ts:834-841` (the chip and its handler, whose
  comment explains why turning it *on* deliberately does not suspend — a
  concern that stops existing), `:1040-1041` and `:1049` (paint and the void),
  `:228-229` and `:1151` (`Hud.autopilot()`), and `main.ts:129`'s read of the
  stored value. The `Director` itself is untouched apart from its constants.
- The status readout stays → `director.ts:151-164` reports what the autopilot
  is waiting for, and `hud.ts:1116` explains that without it "the restraint
  rules in director.ts are indistinguishable from a broken feature". Shorter
  waits make it less necessary and not unnecessary; it is also now the only
  way to see the director at all, since the chip that hinted at its existence
  is going.

**Lands in**
- `src/director.ts:34,42,43` — the three constants.
- `src/director.ts:16-20, 31-33` — the boundary and suspend comments, both of
  which currently argue for the old numbers.
- `src/director.ts` — the decaying boundary requirement, at the boundary test.
- `src/hud.ts:834-841, 1040-1041, 1049, 228-229, 1151` — the chip and its
  interface.
- `src/main.ts:85, 129` — the default and the URL read, which becomes a
  session-only override.

**Done when** — the autopilot chip is gone from the arc and the remaining
chips are evenly spaced with no gap; with music playing and hands off, a
colour change lands within 30 seconds of the previous one at the latest; a
manual change holds for 30 seconds and not three minutes; and `?auto=0` still
produces a session where nothing changes on its own. The numeric readout's
`auto held Ns` line still counts down, now from 30.
**Verify** — real music for at least three minutes, hands off, which is the
only way to see three consecutive changes and therefore the only way to
confirm the bound. Then the same with a manual change in the middle, to see
the 30-second suspend expire. On-screen check at 320×568 and 360×640 for the
re-spaced arc. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs **no**, and deliberately so: the field is retained
rather than removed, per the `mix` precedent · url **no**: `?auto=0` keeps its
meaning · capture no · dependency no.

### 46. Three taps on the gate open the powder
`status: ready` · added 2026-08-30

**Do** — three rapid taps on the start screen, away from its controls, swap the
gate for a black field. Tapping it throws down white powder; dragging pushes
the grains into lines. Three taps again and the gate comes back.
**Why** — asked for. It is the one part of this app that is allowed to be a
secret.

**Decided**
- The trigger → **three taps, each within 600ms of the one before, landing on
  the gate's background.** Not on Start, and **also not on share, reload or the
  QR** — Victor said "outside the start button", and every other control on
  that screen has the same claim to its own taps. **Mine** on extending it, and
  the test is a `closest()` against the controls rather than a coordinate box,
  so it cannot drift when entries 43 and 44 move things around.
- Getting out → **the same three taps.** **Mine.** One gesture in and out is
  one thing to remember, and an easter egg with a visible close button has
  stopped being one. It also means the way out is discoverable by anyone who
  found the way in, which is not true of any other exit.
- Nothing is stored → no `Prefs` field, no URL parameter, no survival across a
  reload. **Mine**, and it is worth stating as a decision rather than an
  omission: an easter egg you cannot lose is not an easter egg, and a mode
  someone cannot escape by reloading is a trap. It also means this entry trips
  neither the stored-shape nor the URL Hard Stop by construction rather than by
  argument.
- **A separate 2D canvas, not the WebGL pipeline** → the mode is *all black*,
  which means the visualiser is not on screen at all. Putting powder through
  the shader stack would mean teaching six geometric shaders about a mode that
  shows none of them, and widening the ripple buffer a second time. A 2D canvas
  layered over the hidden one is a few dozen lines and touches nothing else.
  **Mine**, and it is also what keeps the frame cost of the whole feature
  inside the feature.
- The physics → **grains carry a position and a velocity.** A tap sprays a
  small burst at the finger; a drag lays grains along the path *and gives them
  the finger's velocity*, which is what makes a line rather than a smudge —
  the line is a shared direction, not a stroke that was drawn. **And tilt
  accelerates them**, so the powder slides when the phone leans.
- Tilt is available here, and that was checked rather than hoped → `main.ts:573`
  starts the sensor as `startShake(true)` whenever `hasMotionPermissionGate()`
  is false, and that gate exists only on iOS. So on Android the accelerometer
  is already live while the gate is up, which is exactly where this mode lives.
  On iOS it will be the stub, and the powder simply lies still. **No permission
  prompt is added** — an easter egg must never be the thing that asks for the
  accelerometer, and one that did would be a worse feature than no feature.
- Why tilt at all, when it was not asked for → because it is the difference
  between a drawing toy and a material. Victor spent the day asking to be
  "constantly aware of motion and physicality", and a granular substance is the
  one place in this app where that can be literal rather than a colour bias.
  **Mine**, and the smallest thing to cut if the build runs long: the powder
  works without it.
- `shake.ts` gains a `tilt()` → returning the uncapped −1..1 pair.
  `gravity()` already computes exactly that and then multiplies by
  `MAX_OFFSET * GRAVITY_FRACTION`, a cap that means something to the tumble and
  nothing to a grain of powder. Dividing it back out at the call site is how
  two meanings of "tilt" start drifting apart, so `gravity()` is expressed in
  terms of `tilt()` instead. **Mine**, and it is the repo's export-rather-than-
  duplicate rule applied to a number instead of a function.
- The grain cap → **3000, oldest fading first.** The number is a frame-time
  question rather than a design one, so it is a starting point and the numeric
  readout is what settles it; what matters is that the cap fades rather than
  refuses, because a canvas that silently stops accepting powder reads as
  broken while one that slowly forgets reads as powder.
- Leaving must be exact → on exit the gate returns as it was, idle preview
  still running, Start still armed. The easter egg hides the gate rather than
  tearing it down, so there is nothing to rebuild and nothing to get wrong.

**Lands in**
- `src/powder.ts` — new. Grains, the tap and drag handlers, the 2D loop.
- `index.html` — a second canvas and the black layer above `#canvas`, below
  `#gate`, hidden by default.
- `src/main.ts`, the gate's setup — the three-tap recogniser and the swap.
- `src/shake.ts:342-348` — `tilt()`, with `gravity()` rewritten to use it.

**Done when** — three quick taps on empty gate turn the screen black; tapping
throws white powder that stays where it lands; dragging draws a line of it that
keeps the direction of the drag; tilting the phone makes the powder slide
downhill on Android; three more taps restore the gate with the preview still
running and Start still working. Tapping Start, share, reload or the QR never
counts toward the three, however fast. A reload always returns the ordinary
gate.
**Verify** — the phone, for all of it: the tap rhythm, the drag, and the tilt
are three things a mouse cannot answer. Watch the frame time with the canvas
full of grains, at 320×568 and 360×640. Confirm on a desktop browser that the
powder still works with no accelerometer at all, which is the iOS path.
`pnpm build`, `pnpm lint`.
**Hard stops** — prefs no (nothing is stored) · url no (no parameter) · capture
no · dependency no (2D canvas, no library).
