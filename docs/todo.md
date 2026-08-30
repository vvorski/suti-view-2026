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
`status: done` · added 2026-08-30 · shipped at build 154

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

**Build note.** All three landed, plus the confirmed HUD line: `hud.ts`'s
mapping arc builds its keys from `Object.keys(MAPPINGS)` already, so
nothing there needed touching for the arc itself, but `MAPPING_LABELS` is
a `Record<MappingName, string>` and TypeScript correctly refused to compile
until all six had labels — the "only if needed" case, needed.

`beat` degrades exactly as decided: an edge-triggered onset detector feeds
a simple stability check (two consecutive inter-onset gaps within 15% of
each other) rather than a full statistical model, since the entry asks for
honest degradation, not a beat tracker good enough to trust blind — once
locked, phase resets to 0 on every onset and counts up at `dt/interval`;
unlocked, output is bit-identical to `relative`'s own formula, including
its entry-38 blend, so a steady tone (no onsets at all) reads exactly the
same on both. `dynamics` reuses `speech-band`'s exact `soften()` shape at
a recalibrated `GAIN` of 10; no separate clip-prevention ceiling was
added; `soften()`'s own exponential already saturates at 1.0 by
construction and a second bound on an already-bounded curve would have
nothing to do — noted as a deliberate simplification, not an oversight.
`bass-led` needed one real fix past the first draft: computing `level`
through its own separate output envelope measurably drifted apart from
`low`'s own envelope during a beat's decay even with near-identical time
constants (two independently-timed smoothers of related-but-different
signals will not stay locked together), failing the ≤0.1 tracking
requirement by 0.1-0.2 in testing. Fixed by building `level` directly from
the already-smoothed `low` with no envelope of its own on top.

`scripts/probe-mapping.ts` gained real assertions rather than only
inheriting the new columns "for free" as the Lands-in put it: `dynamics`'s
span (measured 0.77 against a 0.60 minimum), a `beat` lock test reading
the mapping's own documented consequence of locking (`level` peaking near
1 right after each onset — the only way to check "locked" from outside,
since `Mapping` exposes no other state) plus a fallback test against
onsets at genuinely random, unrelated intervals (a fixed LCG, not
`Math.random()`, so the run is repeatable), and `bass-led`'s
`|level - low| <= 0.1` check on the same 120bpm pattern used everywhere
else in this file.

All seven new/changed assertions pass; `pnpm probe`'s pre-existing sections
(beat pattern, tilt glide, novelty, roughness, frame rate, ripple triggers)
are unaffected. `probe:shake`, `probe:haptics`, `probe:fullscreen`,
`probe:emitter`, `probe:composite`, `probe:nudge` all still pass.
`hud-narrow.html` at 320×568 and 360×640 confirms all six mapping labels
render on the arc (`Relative`, `Absolute`, `Normalised`, `Beat`,
`Dynamics`, `Bass-led`) with nothing off-screen. `pnpm build`, `pnpm lint`
both clean. Not verified: real music on a phone, and `views-probe.html?play`
watched live with the selector — both need a person.

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

**Superseded at build 186 (entry 52).** The *zone* half of this entry — the
three screen thirds, `inCaptureBand()`, `CAPTURE_BAND_FRACTION`, and the
"top third does nothing on a plain tap" call — is gone: a single tap now
saves and a double opens the panel, anywhere on the screen, told apart by
time rather than position. The *one recogniser* half this entry's title is
actually about survives entirely unchanged and is exactly what made entry
52 small: one dispatch owning the picture's taps is what a temporal rule
needed to be built on top of. See entry 52's own build note for what
replaced the zones and why its Done-when here (bottom-third-saves,
middle-third-opens, top-third-silent) no longer describes the code.

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
`status: done` · added 2026-08-30 · shipped at build 157

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

**Build note.** The CSS and comment landed as specified. The recogniser
fix landed too, but not for the exact hazard this entry describes: entry
41's own recogniser was already built on the bubble phase rather than the
capture phase this entry assumed carried forward from the old screenshot
band, so the literal "capture-phase recogniser fires before the target"
race does not exist here — a chip's own `stopPropagation()` on its
`pointerup`, at the target, already runs before a bubble-phase document
listener ever sees the event. What the exclusion actually closes is a
narrower, still-real gap this entry's own reasoning implies but does not
spell out: a release that lands a pixel outside the button (an ordinary
touchscreen possibility, not an edge case invented for this) has a
different target, so the chip's own `stopPropagation()` never fires for
that specific event, and it would reach the recogniser regardless of
phase. Fixed with a `downOnChip` flag set from the `pointerdown` target
and checked through `pointerdown`/`pointermove`/`pointerup`, separate from
`downZone === 'none'` since that zone legitimately starts entry 33's own
hold-to-emit gesture, which a chip must not.

Verified with a byte-for-byte copy of the updated recogniser, run against
synthetic pointer events at a real centred `.hud-chip` element: a plain
tap on the chip, a down-on-chip-up-just-outside-it release, and a hold
started on the chip all produce no calls at all, while a plain tap
elsewhere in the same panel-zone third still opens the panel — confirming
the exclusion is scoped to chips, not the whole zone. The visual centring
itself was verified by computed geometry rather than a screenshot: with
`hud.ts`'s own `.hud-chip` base rule (`position: absolute`, which only
loads after Start, unreachable in this harness) reproduced manually, the
chip's bounding-box centre lands exactly on the window's centre, 0px off
in both axes — confirming the CSS math is correct independent of the
Start-gated harness limitation that made the live page read as
uncentred (no base rule loaded at all). `pnpm probe:fullscreen` passes
unchanged, `pnpm build` and `pnpm lint` both clean. Not verified: how it
actually looks on a phone, which this entry's own Verify line already
says only a phone can answer.

### 43. The gate's type grows a fifth, on a band, and Start invites harder
`status: done` · added 2026-08-30 · shipped at build 159

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

**Build note.** Landed as specified, with one factual correction worth
recording: the reduced-motion guard this entry says "there is none today"
for was already present (`@media (prefers-reduced-motion: reduce) {
#start { animation: none; } }`, from build "The start screen is the piece,
running", well before this entry existed) — checked via `git log -S`
rather than trusting the entry's own premise, since "add a guard" against
one that already exists would have meant a dead, unreachable second rule.
Nothing needed adding there; noted rather than silently skipped.

`--gate-type-scale: 1.2` landed on `#gate`, and `.gate-byline`, `#gate
h1`, `.gate-name` and `#error` all take it via `calc()` inside their
existing `font`/`font-size` declarations, none of the original clamp()
numbers touched. The band is a `.gate-head::before` rather than a new
wrapper element — `position: relative; z-index: 0` on `.gate-head` gives
it its own stacking context so the pseudo-element's `z-index: -1` stays
scoped to sitting behind this block's own text, and `inset: 0 -1.5rem`
reaches exactly past `#gate`'s own horizontal padding for a true
edge-to-edge band without touching markup. The pulse ring's spread and
starting opacity moved (18px→26px, 0.4→0.55) and the breathe's scale
moved (1.035→1.05); the two animation periods are untouched, as decided.

Verified in the browser via two iframes at 320×568 and 360×640 (the same
technique `hud-narrow.html` uses, for the same reason — this needs a true
viewport size, and `resize_window` does not reliably change one in this
harness): `#gate h1`'s computed font size measured 34.56px at 320px width
and 38.88px at 360px, matching the entry's own predicted "~34.6px" almost
to the decimal, with `scrollWidth === clientWidth` at both — no wrap, no
overflow, the one failure mode this entry flagged as worth checking first.
The band's computed background matched `rgba(5, 6, 10, 0.5)` exactly at
both sizes, and a screenshot confirms it visibly spans edge to edge behind
the text rather than only behind the (narrower, right-aligned) type
itself. `pnpm build`, `pnpm lint` both clean. Not verified: the pulse's
feel on a real phone, and the gate over a genuinely bright idle-preview
frame — both need a person and real hardware, per this entry's own Verify
line.

### 44. The reload glyph gets the share button's chip
`status: done` · added 2026-08-30 · shipped at build 165

**Build note** — extracted `.gate-share`'s nine declarations into `.gate-chip`
in `index.html`, applied to both corner buttons, exactly as Decided. Toggled
onto the reload button in JS (`mountVersionHud()`) and off it again in
`versionHudRunning()`, so "the chip applies while the gate is up" is a plain
class fact rather than a `.running`-scoped CSS selector.

Hit a real bug doing it, not just the planned refactor: the shared
`#version-hud button` base rule still declared `border: none; background:
transparent;` at specificity (1,0,1) — an ID selector with zero classes. A
bare `.gate-chip { border: ...; background: ...; }` sits at (0,1,0), and an ID
always outranks a class regardless of how many elements either selector
names, so the base rule's reset kept winning even after the button carried
`.gate-chip` and even after adding `#version-hud .gate-chip { font-size:
19px; }` overrides — those overrides only covered the properties I'd written
under that more-specific selector, not the ones still living on the plain
`button` rule. Caught it by `getComputedStyle`-ing the live reload button and
finding `background: rgba(0,0,0,0)` and `border: 0px none` despite the correct
class, width, height and radius. Fixed by moving `border: none; background:
transparent;` off the shared base and onto `#version-hud.running button`
instead, where they belong: that is the only state that still needs a
chip-less reset, and by the time `.running` is added `versionHudRunning()`
has already stripped `.gate-chip`, so nothing else is contesting either
property there either.

Verified: both corner buttons measured identical at 320×568 and 360×640 —
46.4px diameter, same background, same border, same radius — via two iframes
loading the live gate side by side (this project's usual workaround for a
harness that can't reliably resize `window.innerWidth`). The `.fresh` border
tint (`#version-hud .gate-chip.fresh`) verified green via computed style and
a matched-rule specificity dump. The running-state fade and the pre-existing
`.fresh` text-colour tint are CSS-transition/class-toggle-driven and did not
settle to their target values in this remote-automation tab even after
waiting past the transition duration — `getAnimations()` showed the correct
target keyframes (0.18, and the pre-existing green) with no conflicting rule
in the matched-rule dump, so this reads as the same "dynamic state doesn't
repaint in this harness" limitation hit repeatedly elsewhere this session,
not a real defect. Entry 42 had already moved the fullscreen chip to centre,
so its stale offset comment was already gone — nothing to do there.
`pnpm build` and `pnpm lint` both clean.

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
`status: done` · added 2026-08-30 · shipped at build 166

**Build note** — `SUSPEND`, `COLOUR_HOLD` and `VIEW_HOLD` all moved to 30 per
Decided; `VIEW_STABLE` was already there. The autopilot chip, its icon, its
`aria-pressed` case, its slot in `Hud.autopilot()`, and `panel.autopilot()`'s
read in the render loop are gone — the render loop now gates on a
session-only `autoOverrideOff` read straight from `?auto=` in `main()`,
never merged into `prefs`, specifically so it can never leak into storage
the next time an unrelated control calls `save()`. `prefs.autopilot` itself
is untouched: still declared, still round-tripped by `loadPrefs`/`savePrefs`,
just never read by anything any more, exactly as Decided.

**One judgment call on the boundary decay, worth stating precisely rather
than leaving to guess.** `requiredNovelty(sinceDue)` ramps `BOUNDARY` linearly
to 0 over `BOUNDARY_RAMP` (30s) seconds, counted from the moment a change's
*other* conditions clear — hold satisfied, distance/candidate-stability
satisfied — not from the previous change itself. That makes the honest
worst-case gap between two autopilot colour changes on a track with no
distinct sections **HOLD + BOUNDARY_RAMP = 60s**, not literally 30s. I
considered starting the ramp at the same origin as the hold timer, which
would make the decay complete exactly when the hold does and hit a clean
30s bound — but at `COLOUR_HOLD` now also 30, that collapses to "boundary
requirement is always already fully decayed the instant hold clears,"
which makes `BOUNDARY` dead weight in every ordinary case, not a decaying
rule — precisely what the entry's own text says this must not become: "the
boundary requirement decays instead of being deleted." Verified numerically
with a throwaway script: a constant sub-threshold novelty of 0.2 still
produces a change at ~47s since the prior one (30s hold + ~17s into the
ramp), and a genuinely novel boundary (≥0.45) still fires right at the
30s hold with no extra wait. In practice this rarely matters — real music
almost always offers a boundary well inside 30s of a change becoming due —
but the mathematically guaranteed bound is 60s and I'd rather say that
plainly than round it down to match the entry's title.

Verified the re-spaced arc directly: `hud-narrow.html` now reports 6 chips
at both 320×568 and 360×640 (down from 7), labelled geo/atm/cam/ear/num/grav
with no "Autopilot" among them, nothing escaping either viewport, and even
spacing in a screenshot of both frames side by side. Did not re-verify real
audio behaviour live (no probe exists for `director.ts` and the harness
cannot drive the microphone gate) — the numeric-readout's `auto held Ns`
line already reads `s.director.suspended`/`tillView`, which now count from
the new constants automatically, with no separate code path to break.
`pnpm build` and `pnpm lint` both clean.

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
`status: done` · added 2026-08-30 · shipped at build 180

**Build note** — `src/powder.ts` (new), a `#powder`/`#powder-canvas` pair in
`index.html` (z-index 6, between `#canvas` and `#gate`'s 10), and
`shake.ts`'s `tilt()` (uncapped, `gravity()` now expressed in terms of it),
all per Decided. The three-tap recogniser and the swap landed in `main.ts`
as planned, but not where the entry's own Lands-in text put it — see the
real bug below, found by testing rather than by reading.

**A real bug, caught only by simulating a real tap rather than a
script-dispatched one**: the recogniser was first written on `#gate`
itself, which reads naturally ("taps on the gate's own background") but is
wrong once powder is *active* — `#gate` is `display:none` at that point,
and a real finger cannot land on an element that is not rendered. Only a
`dispatchEvent()` called directly on the element bypasses hit-testing and
fires anyway, which is exactly why this passed a first, naive check and
would have shipped broken: the "getting out" gesture (Decided: "the same
three taps") would never have fired for an actual person, because their
tap lands on `#powder-canvas` — a DOM sibling of `#gate`, not a
descendant — which the `#gate`-scoped listener never sees. Fixed by moving
the listener to `document` and excluding `#version-hud` explicitly, which
it did not need before: that exclusion used to be free (the reload glyph
lives outside `#gate`'s subtree, so a `#gate`-scoped listener never saw it
either), and stops being free the moment the listener moves to `document`.
Re-verified against `#powder-canvas` as the actual dispatch target for the
exit gesture, and it now works.

**A second gap found in the same pass, before it could ship**: a
`document`-level tap counter with no lifetime bound would still be
listening after Start, where three quick taps on the running picture are
something entries 41/48/50 all make completely ordinary — summoning the
easter egg mid-session. Fixed by capturing the listener behind a
`stopGateTaps` closure, called the instant `waitForStart()` resolves,
right beside the existing `resumeIdle` listener cleanup that already runs
at that exact point for the same reason.

The cap-and-fade (3000 grains, oldest 200 fading linearly before removal)
and the physics constants (tilt accel, drag, burst size/spread, per-pixel
drag density) are all **Mine** — the entry names none of them, and calls
the 3000 figure itself "a starting point… the numeric readout is what
settles it," which this entry does not add a readout line for. Grains are
walled at the canvas edge (velocity zeroed, position clamped) rather than
wrapping or falling through, since nothing in the entry says powder should
leave the screen it is confined to.

Verified live: `getTilt()`'s wiring closes over the same `let shake`
`main.ts` reassigns once motion permission resolves, so it reads whichever
sensor is live without powder.ts holding a second reference. Confirmed via
synthetic `PointerEvent`s at both 320×568 and 360×640 (iframe technique):
three taps on the gate's background swap it for the black field and back;
taps on `#start`/`#share`/`#qr`/`#version-hud` never count toward the
three, in either direction; a tap sprays a burst and a drag lays a line
along its path, confirmed by `getImageData` pixel counts at both widths
(not by screenshot alone — a nested-iframe compositing artifact in this
harness left one of the two screenshots visually stale despite the DOM and
canvas state being verified identical and correct by direct inspection).
`requestAnimationFrame` had to be overridden to fire on a `setTimeout`
rather than a real frame, since this remote-controlled tab reports
`visibilityState: 'hidden'` and never calls a real `rAF` callback at
all — the same root cause behind the CSS-transition issue found in entry
44's build. Not verified: tilt sliding the powder (this harness has no
accelerometer and cannot synthesize `devicemotion`), the frame-time figure
with the canvas full of grains, and anything on an actual phone — all
explicitly named in the entry's own Verify text as needing a real device.
`pnpm build`, `pnpm lint` both clean.

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

### 47. Day mode: a light ground, so the picture survives daylight
`status: done` · added 2026-08-30 · shipped at build 194

**Build note** — `uDay` added to `composite.frag.glsl`, applied after the
exposure clamp exactly as Decided: `col = 1.0 - (1.0 - col) * (1.0 -
ground)` with `ground = 0.6 * uDay * (1.0 - uCameraMix)`. At `uDay = 0`
this is `col = 1.0 - (1.0-col)*1.0 = col`, an algebraic identity, not an
approximation — "pixel-identical to today" when off is a property of the
formula, not something that needs separate tuning to hold.

`scene.ts` needed the same kind of surgery entry 58 just did for colour: a
new `dayTarget`/`dayCurrent` pair, ticked toward each other at a fixed
rate (`dt / DAY_FADE_S`) once per frame in `render()`, rather than an
`Envelope`-style exponential tau — "about 400ms" reads as a duration the
toggle takes, not a time constant it asymptotically approaches, so a
linear ramp is the more literal reading. Both are seeded from a new
`VisualiserOptions.day` at construction (mirroring `geoAlpha`/`atmAlpha`'s
own pattern) rather than always starting at 0, so a session that left day
mode on finds it already on rather than fading in over 400ms on load.
`day: boolean` added to `Prefs` (the safe half of the stored-shape rule,
per Hard Stops) and threaded through `resolvePrefs()`'s fallback and
return, same shape as `gravity`.

The chip needed one more wire than `gravity`'s own precedent: `gravity` is
read straight from `prefs` by `main.ts` every frame, but day mode is a
`scene.ts` render setting with its own fade, so it needs an explicit call
on toggle. Added `onDayMode` to `hud.ts`'s `Handlers` interface (`main.ts`
wires it to `visualiser.setDayMode`), following the same
callback-on-user-action shape `onColour`/`onAlpha` already use rather than
inventing a new one. The sun glyph is eight `<line>` rays (four cardinal,
four diagonal) around a filled `<circle>`, in the same `ICONS`
`fill="currentColor"` vocabulary as every other chip.

Verified live via `scene.ts` loaded directly over Vite's dev server: five
settled frames at day off gave a reference pixel sum; pumping frames for
700ms after `setDayMode(true)` (long enough for the 400ms fade to
complete) gave a sum about 30% higher, confirming a real, substantial
lightening; toggling back off and pumping another 700ms returned to the
**exact same pixel sum** as the reference, not merely a close one —
concrete proof the round trip loses nothing. Separately verified the
entry's own named risk directly: with a fake `CameraSource` and
`setPassthrough(source, 1)` (full passthrough), day on and day off
rendered **bit-identical** sums, confirming `(1 - uCameraMix)` genuinely
retires the ground once the real room takes over, rather than trusting
the algebra alone. Confirmed via `hud-narrow.html` at 320×568 and 360×640
that the arc now reports 7 chips including "Day", with nothing escaping
either viewport. `pnpm build`, `pnpm lint`, `pnpm probe:composite` (the
existing blend-math regression guard), `pnpm probe:motion-bias`, and
`pnpm probe:ripples` all pass unchanged. Not verified: actual daylight
legibility on a real phone, which the entry's own Verify text says only
that can answer.

**Do** — add a day mode that puts the picture on a **light ground** instead of
a black one, on a chip, off by default.
**Why** — the picture is hard to read in daylight, which is where a phone
propped up in a room actually lives.

**Decided**
- **One change at the composite, not thirteen in the shaders** → all thirteen
  are built to *add light onto black*: `screen`, `add` and the ripple wakes all
  assume a dark ground, and re-authoring them is a different project. Whatever
  day mode is, it happens in `composite.frag.glsl` after everything else has
  drawn. **Mine**, and it is the constraint the two decisions below are chosen
  within.
- **Revised 2026-08-30, against nine screenshots: a curve cannot do this.**
  The original decision here was a gamma lift with a 0.06 black-level lift.
  Looking at what this app actually draws, that was wrong, and wrong for a
  reason worth keeping: **these pictures are mostly pure black.** Thin bright
  rings on an empty field. And `pow(0.0, 1.0/gamma)` is **0.0** — gamma raises
  midtones, and a frame that is four-fifths true black has almost no midtones
  to raise. The curve would have brightened the rings slightly and left the
  field exactly as dark, which is not what "much lighter" means and would have
  read as the feature not working.
- So the ground itself has to change → **screen the picture over a light
  ground**, `1 - (1 - col) * (1 - ground)`, with `ground` rising with
  `uDay`. Black becomes the ground colour, white stays white, and everything
  between lifts smoothly with **no clipping possible** — which a gain cannot
  promise. Starting at a ground of **0.6** at full day. **Mine**, and it costs
  nothing new: it is `blendWith`'s mode 2, already in this file and already
  the app's default merge mode.
- **Not an inversion**, which is the other way to get a light picture →
  `mix(col, 1.0 - col, uDay)` gives dark ink on white, and paper is
  undeniably the most legible thing in sunlight. It is rejected because
  inversion **changes every hue relationship in the app**: a warm orange ring
  becomes teal, the palette the shuffle rolls stops meaning what it meant, and
  every screenshot in the roll belongs to a different instrument. Screening
  over a ground lifts the picture without moving a single hue. **Mine**, and
  it is the difference between a lighter version of this app and a different
  app.
- One of the thirteen already proves it works → among those screenshots, the
  striped view fills its whole frame with a pale ground and stays perfectly
  legible. The visual language survives a light field; it has simply never
  been offered one.
- **A new uniform, because `uExposure` is already taken** → and this was
  checked: `scene.ts:589` writes `uExposure` every frame from the camera's
  light envelope (`0.85 + envelope * 0.3`) and `:547` resets it to 1 when the
  camera is down. A day mode written into that uniform would be silently
  overwritten on every frame the room is visible. So `uDay`, applied *after*
  the exposure line at `composite.frag.glsl:153`.
- `uDay` is **0..1 rather than a boolean** → identity at 0, so the whole
  feature costs nothing when off, which is the same shape `uCameraMix` and
  `uExposure` already use in that file. It also leaves room for the toggle to
  fade rather than snap, and for a future light sensor to drive it, without
  the uniform changing.
- The chip, and where it comes from → a boolean gets a chip rather than a
  band, which is the precedent `gravity` set at entry 30 and its comment
  states outright. **Entry 45 frees a slot by removing the autopilot chip**,
  so the arc's count comes back to where it is today. Build 45 first and the
  arc re-spaces once rather than twice.
- Stored as `day: boolean`, defaulting **off** → adding a field is the safe
  half of the stored-shape rule, so no Hard Stop. Off by default for the same
  reason `gravity` is: it changes what an untouched picture looks like, and a
  returning visitor should find what they left.
- **Entry 34 has since shipped (build 146), and that matters to this entry's
  premise** → it was the reason to wait: two merge modes forced the frame to
  black and the shuffle could land on them. That is fixed, and the picture is
  *still* "all very dark" in every screenshot. So the darkness left over is the
  app's own aesthetic rather than a defect, which is what makes this a feature
  rather than a workaround, and it removes the only ordering constraint that
  was in front of it.
- Scope is **the picture only** → not the HUD, not the gate. Both have their
  own contrast decisions already, and entry 28 fixed the gate's specifically
  against a measured 2.33:1. A global brightness that also touched them would
  reopen a settled question in a place nobody is complaining about.

- **The ground is neutral grey, `vec3(0.6)`** → not warm, not tinted, and no
  colour management: the same space everything else in that file is written
  in. **Mine**, and it is deliberate that it is boring — entry 53 tints this
  exact value from the hour of day, and a ground that already had an opinion
  about warmth would fight it. This entry supplies the number; 53 supplies the
  colour.
- **The ground scales by `(1.0 - uCameraMix)`** → this is the gap most likely
  to be missed, because it only shows up with passthrough raised. Screening a
  0.6 ground under a camera frame washes the room to milk, and the room does
  not need it: `uExposure` already answers the actual light in it
  (`scene.ts:589`). The ground exists to stand in for daylight when there is no
  daylight in frame, so it should retire as the real room arrives. **Mine.**
- **The toggle fades over 400ms** → `uDay` is 0..1 precisely so it can, and a
  chip that snaps the whole frame from black to grey reads as a glitch rather
  than a setting. 400ms is long enough to be a transition and short enough to
  feel like a button. **Mine**, and entry 53's override crossfade should use
  this same constant rather than inventing a second one.
- **The chip is a sun**, id `day`, label "Day" → a filled disc with eight rays,
  in the same 24×24 `viewBox` with `fill="currentColor"` that every entry in
  `ICONS` uses, sized by `.hud-icon` at 19px like the rest. **Mine**: the icon
  set is already a visual vocabulary — three wedges for geo, stacked waves for
  atm, concentric arcs for the ear — and a sun is the one shape that needs no
  explaining next to them. Not a moon: the chip is named for what turning it
  **on** does.

**Lands in**
- `src/shaders/composite.frag.glsl:65, 153` — the uniform and the screen, after
  the exposure clamp.
- `src/scene.ts:339` — the uniform's declaration, beside `uExposure`.
- `src/prefs.ts` — `day: boolean`, defaulting false.
- `src/hud.ts:274`, `ICONS` — the `day` sun glyph.
- `src/hud.ts` — the chip, beside `gravChip`.

**Done when** — with day mode on, the black field is visibly a light field and
the whole frame reads outdoors in sun; the rings and their colours are the same
colours, only sitting on light instead of dark; nothing clips. Toggling the
chip takes about 400ms rather than snapping. **With passthrough raised, the
room looks the same as it does with day mode off** — that is the
`(1 - uCameraMix)` term working, and it is the one failure this can ship with
unnoticed. With it off, the frame is pixel-identical to today. The frame-time
figure is unchanged in every one of those states.
**Verify** — outdoors, on the phone, in actual daylight, which is the only
place the question exists — a desktop monitor cannot answer it and neither can
a screenshot. Check it over both a bright view and a dark one, since a curve
that rescues the dark one may blow out the bright one. On-screen check at
320×568 and 360×640 for the chip. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs **no**: one boolean added, which is the safe half of the
rule · url no · capture no · dependency no.

### 48. Every view answers a touch, through the stream it already listens to
`status: done` · added 2026-08-30 · shipped at build 168

**Build note** — `src/engine/touch.ts` is new (distinct from `touches.ts`,
entry 49's per-id field): a pure envelope, `updateTouchStream(state, dt,
began, anyDown, maxSpeed) -> {transient, level, roughness}`, fed by
main.ts's own filtered read of `touchField.sample()`/`events()` rather than
reaching into the field itself — this module knows nothing about screen
zones or `.hud-chip`, same discipline as `touches.ts`. `pnpm probe:touch-
stream` (new) checks the spike-and-decay, the level floor snapping to 0 the
instant nothing is down, roughness tracking and saturating speed, and the
`Math.max` injection arithmetic as a standalone fact, since the real call
site is scene.ts and out of this module's own reach to test directly.

Three constants had no value named in the entry and are **Mine**, tuned by
feel rather than measured, same footing as `version.ts`'s gamma/lift in
entry 47: `TRANSIENT_DECAY_S = 0.25` (the entry says "about 250ms", so this
one is closer to given than guessed), `LEVEL_FLOOR = 0.35` (below the
loudest music gets it, so a resting finger reads as *added* liveliness
rather than as loud as the room), `ROUGHNESS_SPEED_SCALE = 0.3` (a
full-screen swipe in roughly a third of a second saturates roughness).

The injection sits exactly where Decided says — immediately before
`scene.ts`'s existing `uniforms.uX.value = params.X` copy, now `uniforms.uX
.value = Math.max(params.X, stream.X)` for level, transient and roughness
only (the three the entry names; low/mid/high/tilt/breakdown/surge/novelty
are untouched, since nothing in the entry asks a touch to fake a spectral
band or a section boundary). **`params` itself is never written** — only
read — which is what keeps the numeric readout honest: `main.ts` passes the
same `params` object to `visualiser.render()` and then to `panel.update()`
right after, and the entry's own text says the readout has to keep
reporting the mapping's own output. Confirmed by inspection (no `params.x =`
assignment appears anywhere in the diff) rather than by a runtime probe,
since the readout itself needs a live HUD to observe.

Exclusions applied in `main.ts`'s `dispatchTouches()`, not duplicated in
`engine/touch.ts`: the capture band (a contact's `zone` is fixed at contact
start, so one that began there stays excluded even if it later drags
elsewhere — the same fixed-zone semantics entry 49 already gives every
contact) and any `.hud-chip` contact, both per Decided. **One exclusion
beyond the entry's own text, and Mine**: also inert while `.hud-scrim.open`.
A HUD dial's own drag already `stopPropagation()`s before reaching this
field, but a tap on the scrim itself (closing the panel) would not, and the
picture is hidden behind the panel at that exact moment regardless — an
unstated gap I found by tracing what the field would see, not something the
entry called out, so it gets stated here rather than silently added.

Verified: `pnpm build`, `pnpm lint`, `pnpm probe:touch-stream`, and every
prior probe (`probe`, `probe:composite` in particular) unchanged and
passing. Also verified the actual shader-visible effect directly, without
the Start gate this harness cannot pass: loaded `scene.ts` over Vite's dev
server, called `createVisualiser()` on an offscreen canvas at pure
atmosphere (`geoAlpha: 0`, view `field`) — the same construction main.ts
does before the gate resolves, since nothing about the renderer needs the
microphone — and rendered the same low-resting `VisualParams` twice: once
with `setTouchStream(false, false, 0)`, once with `setTouchStream(true,
true, 5)`. `readPixels()` summed 5,541,338 with no touch and 6,261,361
with one active — a real, substantial brightness rise from the injected
level/transient/roughness, on the exact view family (atmospheric) this
entry exists for. The same run also passed the identical `VisualParams`
object into `render()` while the stream was active and confirmed every
field (`transient`, `level`, `roughness`) came back exactly as passed in —
concrete proof, not just an inspection of the diff, that the numeric
readout's honesty requirement holds. Not verified: two hands and real
music together, and the middle/top-third dispatch paths specifically,
since those need a live pointer through the actual Start-gated app rather
than a direct call into `scene.ts`.

**Do** — a touch injects an event into the feature stream just before it
reaches the uniforms: a transient on contact, a sustained level while the
finger is down, and drag speed into roughness. Every view reacts, in its own
idiom, with **no shader changed**.
**Why** — asked for, and the app is already a machine for turning events into
pictures. A touch should be an event.

**Decided**
- The measurement this rests on → the audio inputs each shader actually reads,
  counted across all thirteen rather than estimated:

  | views | audio inputs read |
  |---|---|
  | chorus, tide | 3 |
  | circles, drift, grid, shards | 4 |
  | aurora, spectrogram | 8 |
  | caustics, fringe | 10 |
  | cells | 11 |
  | field, lattice | 12 |

  The split is exact and it is the entry: **the six geometric views read 3–4
  inputs and all six read `uRipples`; the seven atmospheric views read 8–12 and
  none of them reads `uRipples`.** So the two halves of the app want opposite
  mechanisms, and each already has the one it wants.
- Which makes this and entry 33 **complementary, not overlapping** → entry 33
  gives the geometric views a *positioned* ripple, which is the only way to
  reach a view that reads four numbers. This entry gives the atmospheric views
  an *event*, which is the only way to reach a view that reads twelve and has
  no notion of a location. Together they are "every viz reacts". Neither alone
  is, and neither is a substitute for the other.
- One seam, and it is already there → `scene.ts:678-682` copies `params` into
  the uniforms inside `render(params, spectrum)`. Injecting immediately before
  that copy reaches all thirteen views at once. **No shader edit, no new
  uniform, no per-view design.** **Mine**, and it is the reason this is one
  entry rather than seven.
- **Inject by `max`, never by adding** → `transient = max(transient,
  touch.transient)`. A touch must not be able to *reduce* the music's own
  response, and a sum would push past 1 into whatever each shader does at
  saturation. **Mine.**
- What a touch actually pushes → **a transient spike on contact** decaying over
  about 250ms, **a level floor held while the finger is down**, and **drag
  speed into `roughness`**. The transient is the hit; the held level is what
  makes a resting finger keep the picture awake; the drag term is what makes
  moving feel different from pressing. **Mine**, and "sensitive" is the reason
  there is no threshold and no cooldown anywhere in it: every contact does
  something, immediately.
- **Diagnostics must stay honest** → the injection goes in at the render
  boundary, *after* the mapping has produced its numbers. The numeric readout
  reports the mapping's own output, so it keeps saying what the microphone
  heard rather than what a finger faked. **Mine**, and it matters more than it
  sounds: the readout is the instrument every audio entry in this queue is
  debugged with, and a touch that could forge a transient in it would poison
  entries 32, 37, 38 and 39 at once.
- **The capture band is excluded** → a tap low on the screen saves a frame, and
  the pulse fires on `pointerdown` while the save happens on `pointerup`. So
  without this exclusion every screenshot would contain the flash the finger
  just made. A screenshot should record the picture you were looking at, not
  the picture your finger caused. **Mine**, and it is the kind of thing found
  by someone looking at their photos a week later rather than by a test.
- Everywhere else, every zone reacts → including the middle third that opens
  the panel and the top third that entry 41 leaves inert. **Mine**: the point
  of the feature is that the surface is alive under a finger, and a dead
  region would be exactly the discoverability hole entry 41 already argues
  about. Opening the panel *and* pulsing the picture is not a conflict; it is
  two things a tap does.
- The honest limitation → an atmospheric view will answer *that* it was
  touched, not *where*. Four of the seven read enough inputs that a positioned
  version is possible later, but it needs a new uniform and seven shader edits,
  which is a separate entry and not this one.
- What this inherits, and it is worth knowing before judging the result → a
  view that reads three inputs will answer a touch about as thinly as it
  answers music. `chorus` and `tide` will barely move. That is entry 32's
  finding arriving from another direction, and the fix for it is entry 38 and
  the per-view work, not more touch.

**Lands in**
- `src/engine/touch.ts` — new. The envelope: contact, hold, release, drag
  speed.
- `src/scene.ts:124, 678-682` — the injection, immediately before the copy.
- `src/main.ts` — the recogniser feeds it; the capture band's zone does not.

**Done when** — in every one of the thirteen views, touching the screen
produces a visible change within a frame or two, and holding keeps the picture
livelier than it is with no finger. Dragging fast looks different from
dragging slowly. The numeric readout's audio figures do not move when the
screen is touched in silence. A screenshot taken from the bottom band contains
no touch flash.
**Verify** — the phone, in silence first, because that is the only condition in
which a touch's own contribution is separable from the music's. Then with music
playing, to confirm a touch reads as *added to* the music rather than as a
glitch in it. Walk all thirteen views. `views-probe.html?play` from entry 37
once that exists, since it is the only way to drive every view at once.
`pnpm build`, `pnpm lint`, and `pnpm probe` unchanged — the mapping is
untouched by design, so if its numbers move, the injection is in the wrong
place.
**Hard stops** — prefs no · url no · capture no, and it protects the existing
one · dependency no.

### 49. A touch field: one owner of every finger on the picture
`status: done` · added 2026-08-30 · shipped at build 167

**Build note** — `src/engine/touches.ts` is new, exactly as Decided, but with
one deliberate departure from the Lands-in text's placement: it is pure
(no DOM, no clock of its own — `down`/`move`/`up`/`cancel` all take
pre-extracted numbers and a caller-supplied `now`), because `engine/`'s own
directory comment states that rule for everything in it ("nothing here
touches the DOM, uses a global, or reads a clock") and the entry's own
Decided list never argues for lifting it. `main.ts` binds the actual
`document.addEventListener`s and calls into the field, same as it already
owned every pointer listener before this entry. This also means the module
runs and is checked under plain Node — `scripts/probe-touches.ts` (new,
`pnpm probe:touches`) exercises multi-id tracking, the four-slot cap, a
freed slot's reuse, zone/onChip persisting across a move, the event queue
draining exactly once, and the uv conversion's geometry — none of which
needed a browser.

`toShaderUv` moved out of main.ts into the field, also kept pure (takes a
plain `{left,top,width,height}` rather than reading
`canvas.getBoundingClientRect()` itself) — "coordinates convert once", per
Decided. `zone` is a `string` on `Touch`/`TouchFieldEvent` rather than a
literal union, since the field cannot import main.ts's own zone type
without knowing about screen thirds; main.ts still declares and owns the
real `'capture' | 'panel' | 'none'` type at its own call sites.

`main.ts`'s recognizer now drives the field instead of the scalars entry 41
used (`downX`/`downY`/`downZone`/`emitting`/`holdTimer` are gone). The
hold-timer became a per-frame check (`downFor >= HOLD_S`) rather than a
`setTimeout`, since a sampled field is naturally polled once per rendered
frame rather than armed once — indistinguishable to a finger at 60fps, and
it also means a HUD that closes mid-hold can let a hold resume, where the
old timer-armed version couldn't; noted rather than hidden, since it is a
behavioural difference from before this entry even though a minor one. The
panel-zone tap's gate-exclusion changed from `gate.contains(e.target)` to
`!gate.hidden`, since the field's event queue carries clientY/clientX but
not the original DOM target — same defensive purpose (comment already
called it "defensive rather than load-bearing"), different mechanism.

`scene.ts`'s single `emitter`/`touchActive`/`touchX`/`touchY` became four
fixed `{id, state}` slots reconciled each frame against whatever
`setTouches()` last reported: a touch already holding a slot keeps it; a
new id claims the first free slot; a slot whose id has dropped out of the
current set keeps ticking through its own afterlife (unchanged from
entry 33) rather than being freed immediately, freeing only once its own
`life` reaches 0. Verified this exact reconciliation loop against the real
`emitter.ts`/`ripples.ts` with a throwaway script: a 3s hold reaches full
charge and a 4.0s afterlife, the slot frees only after that afterlife
actually expires, four concurrent ids each claim their own slot, a fifth
is refused while all four are busy, and a freed slot is available to a
later id.

Verified the DOM-to-field wiring itself — not just the pure module — by
loading `engine/touches.ts` directly over Vite's dev server and dispatching
real `PointerEvent`s with two distinct `pointerId`s at `document`, mirroring
main.ts's exact listener code: both ids tracked with independent uv
positions, moving one left the other's position untouched, and lifting one
left the other present in `sample()`. This sidesteps the Start-gated
harness limitation hit repeatedly this session (`waitForStart()` needs a
microphone grant this environment cannot give) for everything the field
itself does, and was the strongest verification available short of a real
touchscreen and, per the entry's own Verify text, two actual people — no
substitute exists in this harness for either, so "the phone, with two
hands, and then with two people" was not performed. Frame-time impact is
reasoned rather than measured: the render pipeline itself is unchanged (no
new shader, no new texture, no new draw call — `MAX_RIPPLES`'s 12-slot
uniform upload is exactly as before), and the only new per-frame cost is
iterating at most four map entries and four fixed slots, so no
viewport-dependent regression is expected at 320×568 or 360×640.
`pnpm build`, `pnpm lint`, and every existing probe (`probe`, `probe:shake`,
`probe:slow`, `probe:haptics`, `probe:emitter`, `probe:composite`,
`probe:nudge`) all still pass unchanged.

**Do** — put every pointer on the picture behind one module that tracks them
by id, up to four at once, and hand its per-frame state to the four things
that want it. Nothing else reads a `PointerEvent`.
**Why** — people reach for this thing. Four separate features now want to know
where the fingers are, and the app can currently see one finger.

**Decided**
- The gap is exact and already measurable → `ripples.ts` **reserves four slots
  for touch** (entry 33), and `emitter.ts` models **one** emitter, and
  `main.ts` tracks **one** contact — `downX`, `downY`, `downZone`, `emitting`,
  `holdTimer` are all scalars. **The buffer downstream is built for four
  fingers and the input layer upstream can only produce one.** A second finger
  today either does nothing or takes the first one's state. That mismatch is
  the entry; everything else follows from closing it.
- Four, and it is not an arbitrary number → it is the reserved band in
  `ripples.ts`. Matching it means the framework can never overflow the buffer
  and the buffer is never starved by an input layer that cannot fill it.
- **The same argument entry 41 already won, one level up** → that entry deletes
  two independent tap recognisers coordinated by event phase. Entries 33, 46
  and 48 each need pointer facts, and each would grow its own listeners: three
  recognisers again, in three files, six months after the last three were
  merged. Doing this before they land is the difference between a framework and
  a second cleanup. **Mine**, and it is the whole reason to build it now rather
  than when it hurts.
- The shape → **a field that is sampled, not a stream of callbacks.** Per
  frame it answers: which pointers are down, where each is in shader uv, how
  long it has been down, its charge, its velocity, and a small queue of
  discrete things that happened since the last frame. **Mine**: shaders need a
  value per frame, the render loop is the only clock that matters here, and a
  callback-driven design would have four consumers each keeping their own copy
  of state that the frame then has to reconcile.
- Who consumes it, and none of them keeps its own copy →
  - **entry 41**'s dispatch reads the event queue and the zone each contact
    started in.
  - **entry 33**'s emitter becomes one per pointer. `emitter.ts` already says
    it is "pure state and a pure update function… no DOM, no clock of its
    own", so this is instantiation rather than a rewrite — the module was
    written for this without knowing it.
  - **entry 48**'s injection reads aggregates: contact and drag speed as the
    **max** across pointers, never the sum. Two fingers should not double the
    response into saturation; they should each be felt.
  - **entry 46**'s powder reads positions and velocities directly.
- Coordinates convert once → `main.ts` already carries `toShaderUv`, with a
  comment explaining that it converts against the canvas's client rect rather
  than the window because the drawing buffer can be a different aspect under
  the resolution ladder, and that y is flipped. That function moves into the
  field and no consumer does the conversion again.
- `pointercancel` is not an edge case here → a phone being handed between
  people generates cancels and lost captures constantly, and that is the
  literal scenario this entry exists for. Every pointer is removed on
  `pointercancel` and on `lostpointercapture` as well as on `pointerup`, and a
  pointer that has not been seen for a while is dropped, so a lost finger can
  never hold a ripple slot open forever.
- **Do not stall the build agent for this** → entry 33 is mid-build as a
  single emitter. Let it land as it is. `emitter.ts`'s purity means
  generalising it to four is a change to who calls it, not to what it does, and
  a half-finished entry rewritten mid-flight is how both end up wrong. Order:
  **41, then 33 as built, then this, then 48 and 46 as consumers.**
- What this is *not* → no new gesture, no new control, nothing on screen that
  was not there before. It is capacity. The visible change is that a second
  finger works, and that two people can touch the picture at once, which is the
  thing actually being asked for.

**Lands in**
- `src/engine/touches.ts` — new. The field, the per-id tracking, the uv
  conversion, the event queue.
- `src/main.ts` — the listeners become four lines that feed the field; every
  scalar named above goes.
- `src/engine/emitter.ts` — instantiated per pointer; the module itself is
  unchanged.
- `src/scene.ts` — the per-frame sample is passed in alongside the params.

**Done when** — two fingers on the picture produce two emitters at two places
at once, and lifting one leaves the other running. Four work; a fifth is
ignored rather than displacing one. Handing the phone to someone mid-drag
leaves nothing stuck on screen. A single finger behaves exactly as it does
after entry 33, with no visible difference. No file outside `touches.ts`
listens for a pointer event on the picture.
**Verify** — the phone, with two hands, and then with two people, because the
second is the case the entry is named for and it is not the same test. Check
the frame time with four emitters live at 320×568 and 360×640. Then hand the
phone over mid-drag and watch for an emitter that never dies — the failure
this can actually ship with. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 50. Touch is generous: a tap plays, everywhere
`status: done` · added 2026-08-30 · shipped at build 184 (built together with entry 57)

**Build note** — the hold/drag threshold that used to gate the geometric
emitter is gone from `main.ts`'s `dispatchTouches()`: the inclusion test
for the emitter is now `!t.onChip && !hudOpen`, with no zone and no
`downFor`/drag-distance check at all, so every one of the three zones —
top, panel, capture — qualifies from the instant a contact begins, exactly
per Decided. `HOLD_S` and the stale comment explaining the old
threshold-reconciliation between entries 33 and 41 are both deleted rather
than left as dead weight. `CHARGE_FLOOR` moved 0.4 → 0.6 in `emitter.ts`,
with its comment rewritten to describe what a *tap* is worth rather than
a threshold that no longer exists. Drag speed now boosts a spawned ring's
birth level on top of charge (`SPEED_LEVEL_SCALE`, **Mine**, no value
named in the entry), reading the same velocity `engine/touch.ts` already
computes for entry 48's atmospheric stream — "both read the velocity
entry 49's field already computes," per Decided.

"Rapid taps stack rather than replace, up to the four slots entry 49
establishes" **did not ship as literally written** — entry 57 landed in
the queue after this one and explicitly absorbs this exact clause,
replacing "four slots keyed by pointer" with "a pool of eight, keyed by
contact." Building them together (that entry's own instruction, to avoid
this one satisfying 57's Done-when by coincidence) means the stacking
behaviour shipped through 57's newer, more correct mechanism — see that
entry's build note for why pointer-keyed slots were wrong in the first
place (a finger that taps, lifts and taps again can reuse the same
pointer id on real hardware, and the old slots would have silently
treated that as one contact continuing rather than two).

Verified live, via `engine/touches.ts` and `engine/emitter.ts` loaded
directly over Vite's dev server (bypassing the Start-gated harness
limitation, same technique as entries 48/49): synthetic taps in all three
zones (`none`/`panel`/`capture`) each satisfy the emitter's inclusion
test with zone recorded but never checked; `createVisualiser()` renders a
frame with two simultaneous contacts and `gl.getError()` returns 0.
`pnpm build`, `pnpm lint`, and `pnpm probe:emitter` (extended with two new
checks for the speed boost) all pass. See entry 57's build note for the
shared pool-eviction and ripple-slot verification, which covers both
entries' Done-when together since they landed in one commit.

**Do** — make every contact leave something at the point it happened, with no
threshold in front of it. This entry is the taste direction for entries 33, 41,
48 and 49, and it overturns three specific decisions in them.
**Why** — Victor, 2026-08-30: "make it very touch sensitive in a playful way",
after watching people reach for the phone. Playful means the response arrives
before you have finished deciding to ask for it.

**Decided**
- **A tap emits.** → overturns entry 33's "hold or drag emits; a plain tap
  still opens the HUD". That call was right when a tap anywhere opened the
  panel, because the two would have fought over the whole screen. Entry 41
  has since given the panel **only the middle third**, so in the other two
  thirds a tap has nothing to fight and the threshold is protecting nothing.
  A gesture that requires you to *wait* is the least playful gesture there is.
- **In the middle third a tap does both** → the panel opens *and* an emitter
  lands. **Mine.** They do not compete: the panel is a HUD over the picture,
  the emitter is in the picture, and a tap that opens a menu while the thing
  underneath answers you is more alive than one that does only the
  administrative half.
- **The top third becomes the play zone**, and this sharpens rather than
  reverses Victor's earlier call → he chose "nothing" for a tap up there over
  "opens the menu", and that stands: nothing *administrative* happens. Which
  is exactly what makes it the one region where touching the picture is the
  only thing touching the picture does. Entry 41's discoverability worry is
  answered by this entry rather than by the menu — the third is not dead, it
  is the purest of the three.
- **The emitter fires in the capture band too, and appears in the saved
  frame** → **Mine**, and it is a deliberate split from entry 48's rule.
  That entry excludes the *flash* from the capture band so a screenshot does
  not contain the white pulse. That still holds, and the distinction is the
  reason: **the flash is UI and must never be in the picture; the emitter is
  picture and should be.** A frame with the ring your own finger made is a
  better thing to have saved than one without it.
- **A tap is instantly worth it** → `emitter.ts`'s `CHARGE_FLOOR` of 0.4 was
  chosen as "the briefest hold that clears the gesture threshold". With no
  threshold left, the floor is now what a *tap* is worth, and it should be
  higher — **0.6**, with `CHARGE_TIME` unchanged at 2.5s so a hold still
  climbs to something more. **Mine**: the first touch anyone gives this thing
  is a tap, and it is the only chance to make them touch it twice.
- **Rapid taps stack rather than replace** → up to the four slots entry 49
  establishes, so drumming on the screen with one finger builds up rather than
  restarting. **Mine**, and it is the difference between a toy and a control:
  a control debounces, a toy accumulates.
- **A fling throws further** → drag speed scales the emitted ring's birth
  level, so a fast swipe leaves a brighter, wider trail than a slow drag over
  the same path. Entry 48 already feeds drag speed into `roughness` for the
  atmospheric views; this is the geometric half of the same idea, and both
  read the velocity entry 49's field already computes.
- **What is deliberately not loosened** → the shake ladder's thresholds, and
  the tap-versus-drag distinction inside entry 41's dispatch. Sensitivity here
  means *the picture answers everything*; it does not mean the app should start
  guessing which administrative action you wanted. A screenshot taken by
  accident is still a bad outcome and entry 41 already names that cost.
- The honest risk → **more accidental captures**, because the bottom third now
  rewards touching it and then also photographs it. Entry 41 already accepted
  that cost and added the camera glyph so it is at least legible. If it becomes
  annoying in use, the answer is to move capture off a bare tap, not to make
  the picture less responsive — the responsiveness is the feature and the
  capture is the thing that can move.

**Lands in**
- `src/engine/emitter.ts` — `CHARGE_FLOOR` 0.4 → 0.6, and the comment that
  explains it in terms of a threshold that no longer exists.
- `src/main.ts` — the dispatch: a tap in any zone spawns an emitter, in
  addition to whatever else that zone does.
- Entry 41's zone handling — the middle third stops being exclusive.
- Entry 49's field — drag velocity into the emitted level.

**Done when** — a single tap anywhere on the picture leaves a visible ring at
the point it landed, in every geometric view, with no wait. Tapping in the
middle third opens the panel and leaves a ring. Drumming four times quickly
leaves four rings, not one. A fast swipe is visibly brighter than a slow one
along the same path. A screenshot taken from the bottom band contains the ring
but not the white flash.
**Verify** — the phone, and specifically **someone else's** hands: the entry
exists because of how other people reach for it, and the test of "playful" is
whether a person who has never seen it touches it a second time without being
asked. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no, and the emitter-in-frame
question is a picture decision rather than a new capture · dependency no.

### 51. The disc says "play with me"
`status: done` · added 2026-08-30 · shipped at build 188

**Build note** — the label carries its own line breaks as literal `\n`
characters (three in `index.html`'s markup for "play with me", two in
`permission-gate.ts`'s error-path relabel for "once more"), read by a new
`white-space: pre-line` on `#start` rather than `<br>` markup — this keeps
both labels plain-string assignments/literals, so `permission-gate.ts`'s
existing `textContent = '...'` pattern needed no restructuring, only a
new string. `#start` also gained `display: flex; flex-direction: column;
align-items: center; justify-content: center;`, since nothing centred
multi-line text vertically before (a single line's default button
rendering was centred enough on its own). `text-indent: 0.14em` is
removed entirely rather than retuned, per Decided — it existed only to
cancel wide tracking's trailing phantom space, and at the new 0.02em that
space is negligible.

Verified via two side-by-side iframes at 320×568 and 360×640: "play with
me" renders as three centred lowercase lines with even margins, computed
style confirms `textTransform: none`, `fontWeight: 600`,
`letterSpacing: 0.304px` (≈0.02em at the 320px-width font size),
`display: flex`, `whiteSpace: pre-line` — every Decided value landed as
declared. Forced the disabled/error state by hand (`textContent =
'once\nmore'; disabled = true`) and confirmed it renders as two centred
lines, legibly the same dimmed treatment as the primary label. `pnpm
build`, `pnpm lint`, and `pnpm probe:fullscreen` (named explicitly in
Verify, since nothing here is keyed on the label) all pass. Not verified:
the phone-at-arm's-length "does this read as friendly" judgment the
entry's own Verify text says only a real device can answer.

**Do** — change the Start button's label to "play with me", set in three
centred lines, and take the shout out of it.
**Why** — the toy wants to be played with, and the one word on the screen
currently issues an instruction.

**Decided**
- **Lowercase**, dropping `text-transform: uppercase` → Victor typed it
  lowercase and "PLAY WITH ME" is the opposite of friendly: it is the same
  sentence delivered as an order. **Mine**, and it is most of the "friendly"
  in this entry — the words alone do not get there while the CSS is still
  shouting them.
- **Three lines, one word each** → a circle is widest across its middle, so a
  short stack fits the shape where a single long line does not: "play with me"
  set on one line inside a 115px disc at 320px is not going to happen at any
  weight worth reading. Three centred lines at `line-height: 1.15`. **Mine.**
- **Tracking 0.14em → 0.02em**, and `text-indent: 0.14em` goes with it → that
  indent exists only to cancel the phantom space wide tracking adds after the
  last glyph, so it is not a separate decision, it is the same one. Wide
  tracking on lowercase reads as a luxury logotype, which is a different kind
  of unfriendly from shouting but still not warm.
- **Weight 700 → 600** → 700 was carrying a five-letter word alone. Three
  short lowercase words at 700 is a slab.
- **The disc does not grow, unless 320px says otherwise** → its diameter is
  `min(36vw, min(20vh, 8rem))`, which is about 115px at the narrowest target.
  Three lines at the current `clamp(0.95rem, 4vw, 1.15rem)` should sit inside
  that with room; if they do not, the disc grows through that existing
  expression rather than gaining a new rule. **The 320×568 check is the one
  that decides this entry**, and it is the same width entry 43's title check
  turns on.
- **`id="start"` stays, and so does every internal use of the word** →
  `main.ts:58`, `main.ts:517` and `permission-gate.ts` all address it by id, so
  renaming the concept would touch four files and a dozen comments to change
  nothing anybody sees.
- **Correction, 2026-08-30: the label is not a single string.** This entry
  first claimed the gate "only ever sets `disabled` on it, never its text",
  and said so as a checked fact. It is wrong. `permission-gate.ts`'s error
  path sets **`els.button.textContent = 'Try again'`**, which replaces the
  label outright — so after a failed start the disc says "Try again" and every
  type decision above has to hold for that string too.
- Which needs its own answer, and the friendly one is not "Try again" →
  **"once more"**, in the same three-line lowercase setting. **Mine.** "Try
  again" is the voice of a form that rejected you; a toy that failed to start
  should sound like it is still willing. Two words also fit the disc more
  comfortably than three, so nothing about the fitting changes.
- The error text itself is untouched → `#error` carries the actual reason
  (`explain(err)`), and that is where a real explanation belongs. The disc's
  job is the invitation, in both states.
- The disabled state needs no separate copy → `#start:disabled` dims it and
  stops the animation while permission is being asked for. A greyed "play with
  me" reads correctly as *not yet*, where a greyed "Start" read as *broken*.
- **One honest observation, not a blocker** → the gate's own comment records
  that the two paragraphs it used to carry are gone at Victor's instruction,
  and that one of them "carried the promise the page makes about the
  microphone". So after this change the first thing a stranger meets is an
  invitation to play, and the second is a browser asking for their microphone,
  with no sentence anywhere saying why. The friendlier the invitation, the
  larger that gap gets. Worth a decision at some point; not this entry's to
  make.
- **Build with or after entry 43** → that entry rescales the gate's type, adds
  the band and reworks the disc's pulse, and both touch `#start` and the same
  block of `index.html`. Doing them together means judging the screen once.

**Lands in**
- `index.html:437` — the label.
- `index.html:213-222` — `#start`'s type: case, tracking, indent, weight,
  line-height.

**Done when** — the disc reads "play with me" in three centred lowercase lines
at 320×568 and 360×640, with even margins inside the circle and no line
touching the edge. It still reads as the one thing on the screen to press.
Disabled, during the permission prompt, it is legibly the same words dimmed.
**Verify** — the browser at both widths, since this is a fitting problem inside
a fixed circle, and then the phone at arm's length, which is where "friendly"
is actually judged. `pnpm probe:fullscreen` must still pass — it drives the
gate, and this entry is the one that would break it if anything were keyed on
the label. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 52. Single tap saves a frame, double tap opens the menu
`status: done` · added 2026-08-30 · shipped at build 186

**Build note** — `zone()`, `CAPTURE_BAND_FRACTION` and `safeBottomInset()`
are deleted from `main.ts`, per Decided. In their place, `resolveTap(x, y)`
maintains a **list** of pending single-taps rather than one slot: each
`up` event that survives the existing exclusions (chip, HUD-open, gate
still showing, and the unloosened tap-vs-drag distance check) either
matches an existing pending tap within 30px — cancelling that one's timer
and opening the panel — or starts its own independent 280ms timer that, if
nothing arrives to pair with it, commits it as a single and saves (subject
to the 700ms rate limit).

**A real bug found and fixed before it shipped, not after**: the first
version used one global `pendingTap` slot. A second, spatially-unrelated
tap arriving inside another tap's still-pending window unconditionally
cancelled that first tap's timer — silently dropping its save rather than
letting each resolve independently. Caught by testing exactly the
scenario the entry's own Done-when names ("ten taps in five seconds save
no more than seven frames" only holds if unmatched taps don't cancel each
other): two taps landing 200px apart, both isolated, produced only one
`saveCapture` call instead of two. Fixed with the list-based design above,
re-verified: the same two-far-apart-taps case now produces two independent
saves, and a close pair still produces exactly one `panel.open()` and no
save.

**One number is inferred rather than quoted**: the entry states 280ms for
the save delay and 30px for the double's radius, but never a separate
"how long may a second tap be late" figure. There isn't a second number to
give — one timer serves both roles by construction: a second qualifying
tap arriving before it fires pre-empts it into a double, and the timer
itself firing *is* what commits a single. Stated as **Mine** in the code's
own comment rather than left implicit.

The touch stream's own capture-band exclusion (entry 48) is retired along
with the zone it depended on, rather than ported to some other rule —
**Mine**, since entry 52's own text never mentions the touch stream. The
alternative (excluding "the tap that is about to save") is not knowable
until 280ms after the fact, which the render loop cannot wait for; letting
the stream's contribution land in a saved frame matches the precedent
entry 50 already set for the geometric ring, on the same "it is picture,
not UI" reasoning.

Verified: `resolveTap`'s exact logic (copied faithfully, not paraphrased)
tested standalone in a browser tab, with real timers, for four cases: an
isolated tap saves; a close, quick pair opens the panel and does not save;
two far-apart-but-quick taps each independently save (the bug above,
confirmed fixed); and ten scattered taps over five seconds all eventually
saved when driven by real timers — which turned out to demonstrate a
harness limitation rather than the rate limit: this remote-controlled
tab's backgrounded `setTimeout` calls clamp to roughly 1000ms regardless
of the delay requested, coincidentally always exceeding the 700ms rate
limit and never exercising it. Re-verified the rate limit's own arithmetic
directly with injected timestamps instead (no real timers): ten taps at a
genuine 500ms cadence over five seconds correctly cap at five saves, comfortably
inside "no more than seven." `pnpm build`, `pnpm lint`, and `pnpm
probe:fullscreen` (named explicitly in Verify) all pass. Not verified:
anything requiring a real double-tap gesture from an actual finger, or the
frame-time/visual confirmation of the ring-under-finger claim in
Done-when, both of which need a phone this harness does not have.

**Do** — retire entry 41's three zones. A single tap anywhere saves a frame; a
double tap anywhere opens the panel.
**Why** — asked for. One rule for the whole screen instead of three regions
with no visible boundaries.

**Decided**
- **Double tap was tried before and could not work. It can now, and the reason
  is precisely that the roles swap** → recovered from the history this entry
  otherwise would have repeated. `gestures.ts`, before entry 27 deleted it,
  carried this: *"This used to be double-tap/double-click, and it did not
  actually work. The tap-to-open listener has zero delay by design — the panel
  exists specifically to open on a tap with no wait — so the first tap of an
  intended double tap already opened the panel before a second tap could ever
  be compared against it."* There is a commit named **"Fix:
  double-tap-to-randomise could never actually fire"**. The failure was never
  double-tap; it was that the **panel** sat on the zero-delay tap and
  pre-empted everything. Moving the panel *onto* the double removes the thing
  that broke it.
- Which names the price exactly → **whatever sits on the single tap must
  tolerate a delay**, because a single tap is only knowable once the
  double-tap window has passed. The panel could not tolerate that, and that is
  why it failed. **A save can**: nobody perceives a screenshot as late.
  **280ms.** So the capture happens 280ms after the tap, and the frame saved is
  the frame at that moment.
- **Play is not arbitrated, and this is the load-bearing decision** → entry
  50's emitter fires on `pointerdown`, immediately, before any of this
  resolves. It is not waiting on the window, it is not cancelled by a second
  tap, and it does not care which of the two actions the tap turns out to be.
  Otherwise every touch on the toy is 280ms late, which would undo entry 50
  entirely. **Mine.**
- **The collision worth your attention, and the thing to overturn if I have
  read it wrong** → entry 50, written an hour ago, says *"drumming four times
  quickly leaves four rings"* and *"if it becomes annoying in use, the answer
  is to move capture off a bare tap"*. This moves capture **onto** a bare tap,
  everywhere. Two consequences follow and neither is avoidable by cleverness:
  **every play-tap saves a photo**, and **four rapid taps are now two double
  taps**, so drumming opens and closes the panel instead of leaving four
  rings.
- How that is resolved, rather than pretended away → **the double requires the
  second tap within 30px of the first**, not just within the window. Drumming
  to play moves across the picture; a deliberate double tap does not. It makes
  the two separable most of the time, and *most of the time* is the honest
  claim — a person tapping twice in one spot to play will get the panel.
  **Mine**, and if it is wrong in the hand, the fix is to put capture on
  something that is not a bare tap, exactly as entry 50 predicted.
- The rate limit on saving → **one save per 700ms**, silently dropping the
  rest. **Mine.** Without it, a run of taps writes a run of near-identical
  PNGs, and the thing that makes a toy unpleasant is not a missing photo, it
  is a camera roll that has to be cleaned up afterwards.
- **Controls are excluded from both** → the fullscreen chip (entry 42, now in
  the centre of the screen), the HUD's own chips, and the gate's controls. A
  tap on a control is that control's tap and neither saves nor opens. This is
  the same `closest()` test entry 46 uses for the powder trigger, and after
  entry 49 it belongs to the touch field so there is one copy of it.
- **Entry 41 is superseded, not deleted** → its refactor is the reason this is
  small: one recogniser owning the picture's taps is exactly what a temporal
  rule needs, and it is already being built. What goes is the *zone* half —
  the thirds, `inCaptureBand()`, `CAPTURE_BAND_FRACTION`, and Victor's "top
  third does nothing" call, which stops having anything to be about. Mark 41
  when this lands so its Done-when does not contradict the code.
- The camera glyph survives and matters more → it was added in entry 41 because
  a tap-band capture is silent. Now that a capture can happen anywhere, it is
  the only thing that says one did. Entry 48's rule stands: the glyph is UI and
  stays out of the saved frame; entry 50's ring is picture and stays in.

**Lands in**
- `src/main.ts` — the recogniser: the 280ms window, the 30px radius, the
  700ms save limit; `inCaptureBand()` and `CAPTURE_BAND_FRACTION` go.
- `src/hud.ts` — the panel opens on the double rather than on a zone.
- `docs/todo.md` — entry 41's zone half marked superseded.

**Done when** — a single tap anywhere saves one frame about a quarter-second
later, with the camera glyph confirming it and the glyph absent from the PNG;
a double tap anywhere opens the panel and saves nothing; a tap on any chip does
neither; ten taps in five seconds save no more than seven frames; and in every
case the ring from entry 50 appears under the finger with no perceptible delay.
**Verify** — the phone, and specifically try to play with it for a minute
without meaning to take a photo, because that is the failure this entry can
ship with and no probe will find it. `pnpm probe:fullscreen` must still pass.
`pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture **already licensed** (entry 25),
though this makes it far easier to trigger, which is the cost named above ·
dependency no.

### 53. The picture follows the sky
`status: done` · added 2026-08-30 · shipped at build 196

**Build note** — `src/sky.ts` is new and pure: four anchors on a 24-hour
circle, wrapped by shifting any hour before the first anchor forward by
24 before the segment search, and smoothstepped between neighbours so the
derivative is zero at every anchor. `scripts/probe-sky.ts` (new, `pnpm
probe:sky`) checks all four anchors land exactly, that no per-minute step
anywhere in a full 24-hour sweep (midnight included) exceeds what a
genuine discontinuity would blow past by orders of magnitude, and that
smoothstep's own signature (slower near an anchor than at a segment's
midpoint) holds.

**One check in the entry's own Verify text doesn't actually hold, and the
probe says so rather than papering over it**: "loading at 06:25 and again
at 06:35 gives visibly different pictures" is false as stated, because
06:30 is itself an anchor, and "no corner anywhere" (Decided) requires a
*zero* derivative exactly there — the flattest point on the entire curve
is the one point this example picks. `probe-sky.ts` confirms the
06:25/06:35 delta is under 0.001 (not "visibly different") and tests the
entry's actual intent instead at the true steepest point, the midpoint of
the 06:30→13:00 segment (~09:45), where a ten-minute window genuinely is
visible. Both facts are asserted, not just the convenient one.

**A second conflict, resolved and stated**: entry 47 anticipated this
entry reusing its own 400ms chip-fade constant for "entry 53's own
override crossfade." Entry 53's own Decided text instead states "crossfades
over 1.2s" explicitly. Implemented as 1.2s — the later, more specific,
explicitly-authored number — with the conflict recorded in
`DAY_OVERRIDE_FADE_S`'s own comment rather than silently picking whichever
was more convenient.

**A judgment call on `uSky.x` vs `uDay`, since "one uniform, two numbers...
rather than adding a second one" reads as ambiguous between two designs**:
implemented with `uDay` (unchanged name, still driving the ground's
*amount*) receiving the override-blended effective value every frame, and
the new `uSky` vec2 carrying the clock's own *raw* daylight (ignoring any
override) alongside warmth — read in the shader only for `.y` (the warmth
tint), with `.x` present for the readout so it can honestly show "it's
2am, and the override is pinning it bright" as two separate facts rather
than one blended number. The alternative — retiring `uDay` and reading
`uSky.x` directly wherever it was — would have meant the readout could no
longer distinguish "the clock says bright" from "the override says
bright," which seemed like the wrong thing to lose for a numeral-storage
convenience.

Warmth tints the ground colour specifically (`vec3(0.6 + warmth*0.06, 0.6,
0.6 - warmth*0.06)`), not the whole finished picture — matching entry 47's
own anticipation ("This entry supplies the number; 53 supplies the
colour"). `views-probe.html`'s time scrub (Lands-in) was **not built** —
verification below used a `Date` monkey-patch directly against `scene.ts`
instead, which answers the same question (does the wiring respond
correctly to an arbitrary hour) without a permanent UI feature; flagged
here as an unaddressed Lands-in item rather than silently dropped.

Verified live via `scene.ts` loaded directly over Vite's dev server, with
`window.Date` monkey-patched to report fixed hours (avoiding this
backgrounded tab's real-timer throttling, hit again mid-verification —
20 real `setTimeout`-paced render() calls exceeded a 45s tool timeout
before completing, so the check was restructured around `uDay`/`uSky`'s
construction-time seed, which needs no elapsed time at all): a visualiser
constructed at 2am read back `{daylight: 0, warmth: -0.35}` — the anchor
exactly — with a pixel sum of 9,468,264; one constructed at 13:00 read
`{daylight: 1, warmth: -0.1}` — also exact — at 26,352,996, nearly 3×
brighter. A third constructed at 2am **with the override on** rendered
26,353,892 — matching the midday sum, not the night one — while its own
`stats().sky` correctly reported `daylight: 0` (the clock's honest
answer) alongside `override: 1` (what's actually driving the picture).
`hud-narrow.html` confirms 7 chips including "Outdoor" (relabelled from
entry 47's "Day") at both 320×568 and 360×640 with nothing escaping.
`pnpm build`, `pnpm lint`, `pnpm probe:sky`, `pnpm probe:composite`,
`pnpm probe:motion-bias`, and `pnpm probe:ripples` all pass. Not
verified: the phone at two genuinely different hours, which the entry's
own Verify text says only that can answer.

**Do** — drive the picture's brightness and colour temperature from the local
clock, on a continuous curve: cool and dark at night, warm at dawn, bright at
midday, warmest at dusk, with no step anywhere including across midnight.
**Why** — asked for. A thing left running in a room should belong to the hour
it is in.

**Decided**
- **The local clock only. No geolocation, and this is not a small point** →
  "day night cycle" invites a sunrise/sunset lookup, which means a location
  permission on a page whose one promise is that nothing leaves the device.
  A permission prompt for a lighting effect is disproportionate on its own; on
  this page it is also the wrong kind of ask. `new Date()` needs nothing and is
  already used once, at `main.ts:492`, for the screenshot's filename.
- The honest cost of that → **the cycle is stylised, not astronomical.** In
  Reykjavík in June the app will call 2am night while it is broad daylight
  outside. That is the correct trade for a toy, and it should be written at the
  anchor table so nobody later "fixes" it with a geolocation call.
- **One uniform, two numbers** → `uSky = vec2(daylight, warmth)`, daylight 0..1
  and warmth −1..1, both at their neutral values costing nothing. **Mine**, over
  two separate uniforms: they are always computed together from one clock and
  always applied together in one place, and splitting them is how one gets
  updated without the other.
- The anchors, on a 24-hour circle → **02:00 daylight 0.0 warmth −0.35;
  06:30 daylight 0.35 warmth +0.50; 13:00 daylight 1.0 warmth −0.10;
  19:30 daylight 0.40 warmth +0.60.** Warm at both ends and coolest in the
  small hours, which is what a sky actually does. Numbers to start from and
  settle by eye.
- **Smoothstep between adjacent anchors, not linear** → the derivative is zero
  at each anchor, so the change eases in and out instead of turning a corner.
  Linear interpolation between four points is a triangle wave, and a triangle
  wave is exactly the "sharp jumps" this entry exists to avoid — they would be
  at the anchors rather than between them, but they would be there.
- Wrapping is the part that breaks if it is not thought about → the last anchor
  interpolates *forward into* the first across midnight, on a circle. A table
  indexed 0..23 with no wrap gives a discontinuity at exactly the hour nobody
  is testing at.
- **It rides entry 47's tone curve rather than adding a second one** → that
  entry establishes `uDay` and the gamma-plus-black-lift applied after
  `uExposure`. `daylight` *is* that control, now driven by a clock instead of
  only by a chip. Warmth is a small tint at the same site, **±6% on red and
  blue** — a bias, not a filter, because at filter strength the visualiser's
  own palette stops being the thing you are looking at.
- Which changes what entry 47's chip means → it stops being "day mode on/off"
  and becomes **an override that pins daylight to 1**, for reading the screen
  outdoors at any hour. Its stored `day` boolean is unchanged, so no Prefs
  work; only the label and the wiring. **Build 47 first**, or the two will each
  write `uDay` and the last one to run will win.
- Toggling that override **crossfades over 1.2s** → the clock's own movement is
  imperceptible by construction, so the only way to produce a jump is a chip,
  and the chip is the one place easing is needed. **Mine.**
- **It is deliberately unnoticeable in the moment** → over a minute the change
  is invisible; over an evening it is obvious. That is what "like the sky"
  means and it should be stated plainly, because the natural bug report is
  "nothing is happening" and the natural wrong fix is to speed it up. Sampling
  once a second is ample; per-frame would be waste.
- **Testable without waiting for dusk** → the clock is a pure function, so the
  harness from entry 37 gets a time scrub and the numeric readout prints the
  current pair. **No new URL parameter**, deliberately: the URL shape is a Hard
  Stop and a debugging convenience is not worth spending it, when a dev page
  and a readout answer the same question.
- Interaction with the camera's own light response → `uExposure` is already
  driven from the room's brightness when passthrough is up (`scene.ts:589`).
  The two are complementary and must not be merged: one is what the room is
  doing now, the other is what the hour is. They multiply, and both are gentle
  enough that they can.

**Lands in**
- `src/sky.ts` — new. The anchor table, the wrapped smoothstep, one exported
  pure function of a `Date`.
- `src/scene.ts:339` — `uSky` beside `uExposure`, sampled once a second.
- `src/shaders/composite.frag.glsl:153` — the tint, at the tone curve entry 47
  puts there.
- `src/hud.ts` — entry 47's chip becomes the override.
- `views-probe.html` — the time scrub.

**Done when** — the picture at 3am is visibly darker and cooler than at 1pm on
the same phone with the same settings; loading at 06:25 and again at 06:35
gives visibly different pictures with nothing in between that could be called a
step; scrubbing the harness through 24 hours shows no corner anywhere,
midnight included; and the override chip pins it bright at any hour, fading
rather than snapping.
**Verify** — the harness for the whole 24 hours, because that is the only way
to see the curve at once, and then the phone at two genuinely different hours,
because the harness cannot tell you whether the night end is too dark to enjoy.
`pnpm build`, `pnpm lint`.
**Hard stops** — prefs no (entry 47's `day` boolean is reused, no field added)
· url no (deliberately: no scrub parameter) · capture no · dependency no, and
**no geolocation** — see the first decision.

### 54. A shake says so, in light
`status: done` · added 2026-08-30 · shipped at build 200

**Build note** — `#shake-pulse` (new, `index.html`), an inward
`box-shadow` at the frame's edges rather than a full-screen tint, driven
by a `--pulse-amt` CSS custom property `shakePulse()` sets from
`intensity(peak)` before adding an `.on`/`.double` class. Both classes
restart their own animation via the same offsetWidth-reflow trick
`flashShake`'s double path already used — needed for `.on` too now, since
an `animation` (unlike `#shake-flash`'s `.on`, which is a plain
`transition`) does not restart just from re-adding a class that was never
removed for a frame. `PULSE_MIN`/`PULSE_MAX` (0.15/0.9) are **Mine** — the
entry says "scale with depth" but names no floor, and 0 would mean the
gentlest qualifying shake produces no visible confirmation at all, which
is the exact failure this entry exists to close.

Found and fixed one timing imprecision before it shipped: the double
keyframes' second peak first landed at 55% of a 410ms animation (≈225ms),
not the ~190ms Decided actually asks for. Recomputed to land the second
peak at 46% (188.6ms, confirmed via `getAnimations()`'s own timing
resolution rather than eyeballing the percentages).

Verified live via `index.html`'s real `#shake-pulse` element (present
regardless of Start, unlike `shakePulse()`'s own JS which lives inside
`main.ts`'s Start-gated closure and isn't separately callable) — the
function's exact logic replicated against the real DOM and real CSS: a
light shake (peak 8.5, just past `STRONG_UP`) set `--pulse-amt` to 0.1875;
a hard one (peak 18, at `PEAK_CEILING`) set it to 0.9, confirming the
scaling. `el.getAnimations()` (not real-time playback, which this
backgrounded remote-controlled tab throttles into not advancing at all —
the same harness limitation hit repeatedly this session) confirmed the
single pulse's declared keyframes (0.9 → 0, 220ms) and the double's
(0.7 → 0.05 → 0.7 → 0, 410ms, second peak at 188.6ms) match Decided
exactly. A forced-visible screenshot at 320×568 confirms the effect reads
as a glow at the frame's edges with the centre of the picture still dark
— "knocked rather than lit," not a flash — and a second check at 360×640
confirmed the same computed opacity on that frame too (its own screenshot
came back visually blank, the same nested-iframe compositing artifact
found in earlier entries this session, not a real difference — the
computed style was checked directly rather than trusted from the image
alone). `pnpm build`, `pnpm lint`, and `pnpm probe:shake` (named
explicitly in Verify, confirming the detector itself is untouched) all
pass. Not verified: shaking a real phone once and twice and telling them
apart by feel, which the entry's own Verify text says only that can
answer, and the reduced-motion variant's own real-time playback, for the
same throttling reason.

**Do** — give a detected shake a visible confirmation that scales with how hard
it was and tells a single from a double, always on, not gated behind the
numeric readout.
**Why** — entry 40 abandoned the buzz. The shake is now the one gesture in the
app with no confirmation at all, which is the exact gap `haptics.ts` was
written to close.

**Decided**
- The gap, stated precisely → `haptics.ts` opens by saying the shake "is the
  one action with no obvious cause-and-effect on screen: the picture was
  already moving, and it changes to a different picture that is also moving."
  The buzz was the answer to that sentence, and the buzz is gone. `flashShake`
  is not a replacement: it is gated on `panel.showingStats()`, which nobody has
  on. So in ordinary use a shake is unconfirmed.
- Entry 1 predicted this exact entry → it recorded that on iOS, where vibration
  is unfixable, "the entry would have become *replace the haptic with something
  visual*". That turned out to describe Android too. Nothing here is a new
  idea; it is the branch that was already written down.
- **Not a white full-screen flash** → `flashShake`'s own comment explains why
  it stays behind a debug gate: "a flash on every shake once this ships
  permanently would turn a quiet instrument into a strobe." That reasoning
  still holds and it rules out reusing it. So: **a brief inward pulse at the
  frame's edges** — the picture looks knocked rather than lit. **Mine.**
- Which follows a pattern the file already set → `main.ts:429`, the camera
  glyph from entry 41, says "Never gated behind `showStats`, unlike
  flashShake: this is feedback." The codebase already separates *feedback*
  from *diagnostic*, and this is feedback. `flashShake` stays exactly as it is,
  for the diagnostic job it does well.
- **Port the buzz's shape, not its numbers** → `CONFIRM_PATTERN` is
  `[26, 34, 62]` and `DOUBLE_PATTERN` separates two of those by 130ms, and
  those numbers are hard-won. They are also useless here: **26ms is a frame and
  a half at 60fps**, invisible. What transfers is the *shape* — one event for a
  single, two clearly-separated events for a double — at durations an eye can
  resolve: about **220ms** for a pulse and about **190ms** between the two of a
  double. **Mine**, and it is the trap worth naming, because copying the
  haptic constants across would produce a confirmation nobody can see and it
  would look like the feature failing rather than the timing being wrong.
- **Scale with depth, using `intensity()`** → the same 0–1 normaliser the
  shuffle's ladder already uses. A light shake gets a faint edge, a shake that
  reaches the top rung gets an unmistakable one. That is what the buzz did
  (entry 8's intensity scaling) and it is the more useful half of the
  confirmation: it says *how much changed*, not merely *something happened*.
  One normaliser, still one, now with a different second consumer.
- **Reduced motion softens it rather than removing it** → `prefers-reduced-
  motion` should not delete the only confirmation the gesture has; that
  reinstates the bug for the people who asked for less movement. Reduce the
  amplitude and lengthen the fade so it reads as a settle rather than a pulse.
  **Mine**, and it is the same call `version.ts` already made for the fresh-
  build dot: "It still goes green; it just stops blinking."
- **UI, so it stays out of the saved frame** → a DOM overlay beside
  `#shake-flash` and the camera glyph, not a shader term. Entry 48 fixed the
  rule and entry 50 confirmed it: the flash is UI and must never be in the
  picture, the emitter is picture and should be. A shake confirmation is UI.
  It also means it is visible even if the render path is the broken thing,
  which is the reason `flashShake` was a DOM overlay in the first place.
- What it must not become → a second thing that fires on every disturbance. It
  fires on `takeStrong()`/`takeDouble()` only, the same two calls the buzz
  used, so it says "a shake was accepted and the picture was re-rolled" and
  never "the phone moved". The tumble already answers the second question,
  continuously.

**Lands in**
- `index.html:58-90` — the overlay and its keyframes, beside `#shake-flash`.
- `src/main.ts:1021, 1037` — the call sites, ungated, taking the peak so the
  amplitude can scale.
- `src/main.ts:405` — `flashShake` unchanged; a comment saying which of the two
  is feedback and which is diagnostic, since they will now sit next to each
  other and the difference is not obvious from the names.

**Done when** — with the numeric readout off, a deliberate shake produces a
visible edge pulse and a double shake produces two that read as two; a light
shake's pulse is visibly weaker than a hard one's; nothing pulses when the
phone is merely moved or knocked; and a screenshot taken during one contains
no pulse. With reduced motion requested, the confirmation is still there and
is gentler.
**Verify** — the phone, in the hand, which is the only way to judge whether a
confirmation confirms; specifically shake once and twice in a row and check
you can tell which happened without looking for it. `pnpm probe:shake` must
still pass unchanged — this reads the detector and must not alter it. Also on
screen at 320×568 and 360×640, since an edge effect is the one kind that
behaves differently at different aspect ratios. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no (UI, deliberately outside the
frame) · dependency no.

### 55. The name arrives through its own history, and the byline glows
`status: done` · added 2026-08-30 · shipped at build 203

**Build note** — the entry's own "63 distinct names, from false calm to
four fingers" was accurate when written but stale by the time this was
built: ten more names had shipped since (this session's own entries 46
through 54). Re-extracted from `git log --follow` at build time rather
than trusting the entry's snapshot — 73 real names, "false calm" through
"edge glows" — plus this commit's own new name appended, for 74 total.
The entry's own reasoning ("the seed data is not invented and not lost;
it is sitting in the history") is exactly why the live extraction was
the right call over the stale count.

`RELEASE_NAMES` (new export) holds all 74; `RELEASE_NAME` is derived as
its last element, so every other reader — `version.ts`'s `title`
attribute, the deploy check that greps for the build number — is
untouched. `mountReleaseName()` becomes the flip's own entry point: a
plain `textContent` swap once per animation frame (never a per-character
scramble — nothing in Decided describes one, and `.gate-name`'s monospace
font is what the entry credits for making even a whole-word swap read as
clean rather than jittery), eased so `Math.floor((1-(1-t)²) * n)` lands 14
names in the first 10% of the 1.4s window and 0 in the last 10% — verified
directly against the pure time-to-index math, independent of frame timing.

**A real robustness gap found and fixed before it shipped**: the flip was
originally started with a bare `requestAnimationFrame(step)`, and this
harness's tab reports `visibilityState: 'hidden'` with `hasFocus: false`
(the same condition behind several throttling findings this session) —
under which real `requestAnimationFrame` never fires at all. The span sat
permanently empty, not merely un-animated. Fixed by calling `step(start)`
once, synchronously, before rAF ever gets a chance to run — an unstarted
flip is a worse failure than one that never finishes, and this guarantees
the oldest name paints immediately regardless of whether the tab ever
gets a frame. A genuinely focused, visible browser tab would never
trigger this path, but it costs nothing to not depend on that.

Width reservation (`#release-name { display: inline-block; min-width:
18ch; text-align: right }`) is sized to `release-name.ts`'s own **stated
maximum** (18 characters) rather than today's actual longest name (15,
"already playing") — **Mine**: reserving at the file's documented ceiling
means a future name within that limit can never reflow this, where
reserving at today's historical maximum would need revisiting the moment
someone picks a 16-character name in good faith.

Verified live via `version.ts` loaded directly (mounting a fresh
`#release-name` span, since the real page load's own instance froze
empty for the reason above): with a `requestAnimationFrame` override
(this tab's real one never fires), the flip started at "false calm" (the
true oldest) and settled on exactly "own history" (the true `RELEASE_NAME`)
after the window closed. `aria-hidden="true"` on the animating span and
`aria-label="own history"` on its parent confirmed independent of
animation state. Reduced motion verified two ways: `matchMedia` mocked
for the JS-side flip showed "own history" immediately with no
intermediate names; the CSS-side `@media (prefers-reduced-motion:
reduce)` rule for `.gate-byline` was read back directly from the live
stylesheet and confirmed `animation: none` with the glow held at exactly
0.3 (half the peak 0.6, i.e. mid-strength, not removed). The ordinary
glow's own `getAnimations()` confirmed 4700ms, infinite iterations, and
the dark shadow term identical across all three keyframes while only the
glow term animates 0 → 0.6 → 0. `pnpm build`, `pnpm lint`, and `pnpm
probe:fullscreen` all pass. Not verified: the phone, and specifically
reduced motion as a live device setting rather than a mocked API, which
the entry's own Verify text names as the one to test first.

**Do** — on load, run the release-name chip through every name this app has
ever had, first to last, character by character, settling on the real one. And
give the byline a slow glow.
**Why** — asked for. The gate is two lines of type and a disc, and one of those
lines can carry the whole history of the thing you are about to open.

**Decided**
- **The names exist and can be recovered**, which is what makes this buildable
  → `git log --follow -- src/release-name.ts` yields **63 distinct names**,
  from **"false calm"** to **"four fingers"**, longest "already playing" at 15
  characters. The seed data is not invented and not lost; it is sitting in the
  history and needs extracting once.
- `RELEASE_NAMES`, an array, with **`RELEASE_NAME` kept as a derived export of
  its last element** → so `version.ts` and every other reader is untouched.
  **Mine**, and it is what turns this from an API change into an addition.
- Which changes the release convention, for the better → the file's docstring
  says the name is "changed in the same commit as the work it names". It
  becomes **appended** in that commit instead. One line either way, and an
  append cannot silently lose the previous name the way an edit does — the
  drift already visible in the history, where some pushes moved the build
  number without renaming, becomes visible rather than invisible.
- **Monospace is what makes a character flip possible**, and it is already
  there → `.gate-name` is set in `ui-monospace`. A per-character flip in a
  proportional face jitters every glyph sideways on every frame and reads as a
  fault. Worth writing down, because someone changing that font later would
  break this without any obvious connection.
- Width is reserved, not animated → the chip holds the width of the longest
  name in the list, so the line never reflows mid-flip. The head is
  right-aligned, so an unreserved width would make the whole line walk
  leftward and back. **Mine.**
- **Not all 63 legibly** → at a readable pace that is half a minute, and this
  is a load animation on a screen with a button people want to press. About
  **1.4 seconds**: fast through the early history, decelerating into the last
  few names so the final ones are readable and the real one lands as an
  arrival rather than a stop. **Mine** — the effect should feel like riding the
  history, not like reading a list.
- **It never delays Start** → the disc is live and pressable from the first
  frame, and pressing it during the flip is not a special case, it just leaves.
  A load animation that gates the one action on the screen is a splash screen,
  which this app does not have and should not acquire.
- Screen readers get the name, not the flipping → the animating characters are
  `aria-hidden`, with the real name on an `aria-label`. Otherwise this
  announces sixty-three names to someone who asked for one.
- **Reduced motion shows the final name immediately** → and here, unlike entry
  54's shake confirmation, removing the animation costs nothing at all: the
  end state *is* the content. Given that `prefers-reduced-motion` may well be
  reported on the phone this is being built for, that path is not hypothetical
  and should be the one tested first.
- The byline's glow → **added alongside entry 28's dark shadow, never
  replacing it.** That entry put `text-shadow: 0 1px 12px rgba(5,6,10,0.95)`
  on `.gate-byline` because at `#454b5c` over the moving idle preview it
  measured **2.33:1**, under the 4.5:1 small text needs. A light glow helps
  over a dark preview and does nothing over a bright one, which is exactly the
  case entry 28 fixed. Two shadows, comma-separated, dark one first. **Mine**,
  and the entry says so explicitly because a glow makes the dark shadow look
  redundant and it is not.
- The glow's period → **4.7s**, chosen against the disc's existing 3.4s and
  5.9s so the three do not fall into step. Entry 16 established that reasoning
  for the disc's own pair; a third animation on the same small screen makes it
  matter more, not less. **Mine.**
- Reduced motion holds the glow **static at mid-strength** rather than removing
  it → the request was for the name to look alive, and a still glow is still a
  glow. Same call as entry 54 and as `version.ts`'s fresh-build dot.

**Lands in**
- `src/release-name.ts` — `RELEASE_NAMES` seeded with the 63, `RELEASE_NAME`
  derived, and the docstring's "changed" becoming "appended".
- `src/version.ts:171-183` — `writeReleaseName()`, which currently sets
  `textContent` once, becomes the animation's entry point.
- `index.html` — `.gate-name`'s reserved width; `.gate-byline`'s second shadow
  and its keyframes; both reduced-motion branches.

**Done when** — loading the gate runs the chip through the history in about a
second and a half and stops on the current name, with no reflow of the line
above or below it and no delay to the disc; the byline breathes a glow on a
cycle that never syncs with the disc; with reduced motion requested the name
is simply correct from the first frame and the glow is present but still. A
screen reader announces one name.
**Verify** — the browser for the flip and the reflow, then the phone, and
**specifically with reduced motion turned on**, since that is a live
possibility on the target handset rather than an edge case. Check the byline
over a bright preview, which is the state entry 28's measurement came from.
`pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 56. With the panel open, reload moves to the top right and names itself
`status: done` · added 2026-08-30 · shipped at build 208

**Build note** — `hud.ts`'s `setOpen()` now dispatches a `hud-panel` custom
event on `document` (`{detail:{open}}`) right after toggling the scrim, since
`version.ts` has no other reason to import `hud.ts` and shouldn't gain one for
one boolean. `version.ts` listens for it and toggles `.panel-open` on
`#version-hud` and `.gate-chip` on its button. `.panel-open` repositions the
HUD to the top-right at the same `1.1rem` offsets `.gate-share` uses; a second
rule, `#version-hud.running.panel-open button` (specificity 1,2,1), restates
the chip's border/background/opacity, pre-empting the exact fight entry 44
already found once: `#version-hud.running button` at (1,1,1) still beats a
bare `.gate-chip` at (1,1,0) on ID-then-class-then-element tiebreak. A new
`#version-hud-name` span, hidden by default, carries the flip text — reused
from `.gate-name` styling per the entry's own instruction, so it reads as the
same object returning. `flipThenReload()` mirrors entry 55's eased
time-to-index walk through `RELEASE_NAMES` over 600ms (vs. that entry's
1.4s — a confirmation in front of a click, not an arrival), then calls
`location.reload()`; reduced motion reloads immediately, no flip. The `.fresh`
case needed no extra code: the click handler doesn't branch on `.fresh`, so a
green-pulsing chip flips to the name you're on and reloads into entry 55's own
load animation, landing on a name never seen — exactly as the entry predicted
("nothing extra is needed to get this; it falls out").

Found and fixed one gap along the way: `hud-probe.html` was missing
`day: false` in its `prefs` object and `onDayMode` in its `createHud()`
handlers — a latent hole from entry 47 that nothing had exercised since no
probe drives the Outdoor chip. Fixed as a small side-correction.

Verified live against the real dev-server page (not just unit logic):
`document.dispatchEvent(new CustomEvent('hud-panel', {detail:{open:true/false}}))`
against the actually-mounted `#version-hud` confirmed the position/class
toggle both ways via `getComputedStyle`. The click-triggered flip was
verified through the real DOM path (`button.click()`) by sampling
`#version-hud-name`'s text at two points inside the 600ms window (40ms in:
an early name from `RELEASE_NAMES`; 140ms in: `RELEASE_NAME` itself, already
settled) — short enough that `location.reload()` never fires, so the test
tab never actually navigates away. `window.location.reload` cannot be stubbed
in Chrome (`Object.defineProperty` throws `Cannot redefine property: reload`
— it's non-configurable), which is why the test samples mid-flight rather
than intercepting the reload call itself. Panel-open positioning and the
absence of viewport overflow were also confirmed at true 320×568 and 360×640
viewports — `resize_window` reports success but does not actually shrink this
harness's window below roughly 614×425 (a `hud-narrow.html` comment already
on file records the same finding against an earlier tool), so verification
used the same iframe-based technique that file establishes: an iframe sized
exactly 320×568 / 360×640 gives a true `window.innerWidth`/`innerHeight`
inside it. Did not reproduce the numeric-readout-visible case specifically —
`.hud-stats` only mounts after the real Start gesture, which needs motion
permission and camera/mic grants this harness can't drive end-to-end — but
the CSS rule that fixes the collision applies unconditionally on
`.panel-open`, independent of whether stats are showing, and its effect
(button background/border/opacity, HUD position) was confirmed directly.

**Do** — while the HUD panel is open, the reload control becomes a full chip in
the top-right corner. Clicking it runs the name flip quickly and then reloads.
**Why** — asked for. In the running state the reload is an 18%-opacity glyph in
a corner that something else is already using, and pressing it produces a
second of nothing.

**Decided**
- The right corner is genuinely free, and the code says why → `version.ts:19-24`
  records that the reload "went to the right when the gate's type was
  left-justified; the type is right-justified now and **the share icon has
  taken that corner**, so it comes back to the left." That is true of the
  **gate**. `#share` is markup *inside* `#gate` (`index.html:429`), so once the
  gate goes the corner is empty. This does not contradict that comment; it
  completes it — the sentence "both corners are only ever going to hold one
  small round thing each" still holds, in both states.
- **It also fixes a collision nobody has filed** → `.hud-stats` sits at
  `left: 0.75rem; top: 0.75rem` and `#version-hud` at `0.6rem`/`0.6rem`. With
  the numeric readout on, the reload glyph is **underneath the first line of
  it**. Entry 25's comment already worked around this once by stacking the
  fullscreen chip below rather than beside. Moving reload to the right while
  the panel is open takes the two apart at exactly the moment both are on
  screen.
- **Only while the panel is open** → closed, it stays the faded 0.18 glyph in
  its corner, unchanged. `version.ts:84-88` is explicit that this is "a piece
  meant to be left running on a propped-up phone, and a permanent label in the
  corner of it is litter", and a full chip visible at all times is that litter
  with a border on it. The panel being open is already the signal that someone
  is operating the thing rather than watching it. **Mine.**
- The chip is entry 44's, reused → that entry extracted `.gate-chip` from
  `.gate-share` for exactly this kind of second user, and it shipped at build
  165. Nothing new is designed here; the class exists and the reload already
  wears it on the gate.
- **What the click does, and why it is not just decoration** → a reload
  currently looks like nothing happening until the page goes. The flip is
  feedback occupying that gap, and it names the build you are leaving. **About
  600ms**, against entry 55's 1.4s on load: this one is a confirmation in front
  of an action someone is waiting on, not an arrival.
- Where the name appears, since there isn't one → `version.ts` drops the name
  entirely in the running state. So the flip needs a surface, and it is a
  transient line **beside the chip, right-aligned, set exactly like
  `.gate-name`** — so it reads as the same object returning rather than a new
  one appearing. It is removed when the reload fires. **Mine.**
- **Requires entry 55** → the flip, the `RELEASE_NAMES` array and the
  per-character machinery all come from there. Building this first means
  writing that animation twice.
- The `.fresh` case is the best version of this → when a new build is waiting
  the glyph is already green and pulsing. Clicking it then flips to the name
  you are *on*, reloads, and entry 55's load animation lands on a name you have
  never seen. Two animations either side of the reload, and the pair says
  exactly what happened. Nothing extra is needed to get this; it falls out.
- Reduced motion reloads immediately → no flip, no delay. Unlike entries 54 and
  55, there is nothing to soften here: the animation is pure feedback in front
  of a navigation, and someone who asked for less motion is better served by
  the navigation happening.

**Lands in**
- `src/version.ts:17-31` — a panel-open branch on `#version-hud`'s position,
  and the `.gate-chip` class applied in that state.
- `src/version.ts:208` — the click handler: flip, then `location.reload()`.
- `src/hud.ts` — whatever signals "panel is open" to `version.ts`; the
  `.hud-scrim.open` class is already the fact, it just is not visible outside
  the HUD today.

**Done when** — opening the panel moves the reload to the top right as a chip
matching the share button's look, clear of the numeric readout; closing the
panel returns it to the faint corner glyph; clicking it shows the name for
about half a second and then reloads; with a new build waiting, the sequence
ends on the new name. With reduced motion, it reloads at once.
**Verify** — the phone with the numeric readout **on**, since the collision this
also fixes is only visible in that state, at 320×568 and 360×640. Force a
`.fresh` state by hand to see the two-animation sequence. `pnpm build`,
`pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 57. A drag lays a trail, and taps accumulate
`status: done` · added 2026-08-30 · shipped at build 184 (built together with entry 50)

**Build note** — `MAX_RIPPLES` 12 → 24 in `ripples.ts` and all six
geometric shaders (`AUDIO_RIPPLES` unchanged at 8, so `TOUCH_RIPPLES` goes
4 → 16 automatically), verified across all seven sites by entry 59's
probe, built and landed just ahead of this one for exactly the reason its
own Decided text gives. `emitter.ts` gained a distance trigger
(`SPAWN_DIST = 0.05` uv, **Mine**) alongside the existing time trigger, so
a spawn fires on *either* — a drag now leaves a continuous-looking line
rather than rings every 150ms regardless of speed, while a stationary
hold (no distance to spend) still relies on the clock exactly as before.

**The emitter pool is the harder half, and it required a real
architectural change, not a parameter bump.** Entry 49 kept four fixed
scene.ts slots keyed by the touch field's own pointer id — reasonable
when "one emitter per currently-down finger" was the whole requirement,
wrong once "a finger that taps, lifts, and taps again should leave two"
is: a platform's pointer id can be reused across two separate contacts of
the same finger, and slots keyed by that id would read a second tap as
"the same emitter continuing," silently dropping the stacking this entry
and entry 50 both ask for. Fixed with a `contactId` layer: `main.ts` now
mints a fresh, monotonically increasing id on every qualifying `down`
(kept in a `Map<pointerId, contactId>`, cleared on `up`/`cancel`) and
`scene.ts`'s pool — now 8 slots, up from 4 — is keyed by that id instead.
"Oldest recycled first" is implemented as least-remaining-`life` recycled
first when the pool is full and no slot has naturally freed: a literal
spawn-order FIFO would need a second field this pool has no other use
for, and the least-life emitter is, in every case that matters, the one
closest to disappearing on its own regardless — recycling it early is the
least noticeable choice available. **Mine**, stated as an interpretation
of "oldest" rather than assumed identical to it.

Verified: a synthetic pointer id tapping, lifting, and tapping again
(via `engine/touches.ts` loaded directly over Vite's dev server, real
`PointerEvent`s dispatched at `document`, mirroring `main.ts`'s exact
listener code) mints two distinct contact ids, not one reused — the
precise bug this entry exists to close. A standalone script against the
real `emitter.ts`/`ripples.ts` filled all 8 pool slots with 8 fresh
contacts, released them, and confirmed a 9th contact arriving mid-decay
recycles a slot rather than being dropped. `scene.ts`'s `setTouches()`
call (with real `contactId`/`speed` fields) rendered one frame through
`createVisualiser()` with `MAX_RIPPLES` at 24 and `gl.getError()` returned
0 — the shader compiles and runs with the new bound. `pnpm probe:ripples`
(entry 59) confirms all seven sites agree at 24/8; `pnpm probe:emitter`
(extended with two new checks) confirms the distance trigger and the
speed boost. `pnpm build`, `pnpm lint` both clean.

Not verified: real frame-time cost of sixteen `length()` calls per
fragment against four — the entry's own pass/fail condition — since this
harness has no GPU frame-time measurement and no physical phone. This is
the one finding that could still reverse the touch-slot count if it
fails on real hardware; the entry's own fallback (12 touch slots instead
of 16) is unapplied and would need a one-line revert of `MAX_RIPPLES` to
20 if that measurement comes back bad.

**Do** — spawn ripples by **distance travelled** as well as elapsed time, raise
the touch slot count so a trail is longer than four rings, and let a finger
leave more than one emitter behind it.
**Why** — asked for. A drag currently drips rather than draws, and a second tap
takes the place of the first.

**Decided**
- Why a drag drips → `emitter.ts:38` is `SPAWN_INTERVAL = 0.15`, and
  `:110` spawns only when that much time has passed. **A ripple every 150ms
  regardless of how far the finger moved**, so a fast swipe across the whole
  screen leaves about seven rings spread over its length and a slow one leaves
  the same seven bunched up. The spawn is metered by the clock when the thing
  being drawn is a path.
- The fix → **spawn when *either* the interval has elapsed *or* the finger has
  moved a set distance since the last spawn.** Distance in shader uv so it is
  independent of screen size, starting at about **0.05** — roughly twenty rings
  across the frame. The time term stays: it is what makes a *stationary* hold
  keep emitting, which is entry 33's behaviour and should not change.
- **The trail is capped at four rings today, and that is the harder half** →
  `ripples.ts:24-26`: `MAX_RIPPLES = 12`, `AUDIO_RIPPLES = 8`, leaving
  **`TOUCH_RIPPLES = 4`**. The touch band is a ring buffer, so the fifth ring
  of any drag overwrites the first. Spawning more often without more slots
  makes a *shorter* trail, not a longer one — it would recycle faster.
- So the slots go up → **`MAX_RIPPLES` 12 → 24, audio unchanged at 8, touch
  4 → 16.** **Mine**, and the audio band deliberately does not move: it was
  right before this entry and nothing here is about the music.
- **The honest cost, and it is a real one** → entry 33 split the shader into
  two loops precisely because positioned rings cannot share the hoisted
  `rungR`: each needs its own `length(p - centre)`. So this takes the
  positioned loop from **4 to 16 `length()` calls per fragment, in six
  shaders**. That is the largest per-fragment cost increase anything in this
  queue has asked for. **Frame time is a pass/fail condition below, not an
  observation** — and if it does not hold, the fallback is 12 touch slots
  before anything else is touched, because a shorter trail is still a trail
  and a dropped frame rate is not recoverable by taste.
- Emitters accumulate, which is the other half of "only starts one" → an
  emitter should belong to **a contact, not to a pointer**. A finger that taps,
  lifts, and taps again leaves two, because the first is still dying (entry 33
  gives it two to four seconds of life after release). A pool of **8**, oldest
  recycled first. `MAX_TOUCHES` stays at 4 — that is how many fingers may be
  down *at once*, which is a different number from how many emitters may be
  alive, and conflating them is why one finger currently yields one emitter.
- **This absorbs entry 50's "rapid taps stack rather than replace"** → that
  clause is the same behaviour asked for from the other direction, and 50 is
  still unbuilt. Build them together, or 50's Done-when ("drumming four times
  quickly leaves four rings") will be satisfied by this entry and look like a
  coincidence.
- What does **not** change → the emitter still follows the finger while it is
  down, and the ripples it spawns still stay where they were born. That is
  already true — `spawnAt(state, now, level, x, y)` records the position — and
  it is the reason this entry is a metering change rather than a new system.

**Lands in**
- `src/engine/emitter.ts:38, 110-112` — the distance term beside the interval,
  and the last-spawn position it needs.
- `src/engine/ripples.ts:24-26` — `MAX_RIPPLES` 24, `TOUCH_RIPPLES` 16, and the
  comment at `:16` warning that every geometric shader must match.
- `src/shaders/circles.frag.glsl` and the five other geometric shaders — the
  `MAX_RIPPLES` constant, which GLSL cannot import.
- `src/engine/` — the emitter pool, and its ownership moving off the pointer.

**Done when** — dragging a finger across the screen leaves a line of rings
along the whole path rather than a handful near the end, and dragging slowly
over the same path leaves a line of similar density; holding still keeps
emitting exactly as it does today; four quick taps leave four separate places
that fade independently; and the frame-time figure in the numeric readout with
sixteen touch ripples live is within a frame of what it is with none, at
320×568 and 360×640.
**Verify** — the phone, for the drag and the frame time, since sixteen
`length()` calls per fragment is a thing only a real GPU under a real
resolution ladder can answer. `views-probe.html` for the trail's shape in each
of the six geometric views, because "a line of emitters" means something
different in Tide and Chorus, which take a position as an influence rather
than a coordinate. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 58. Motion reaches the colour, continuously
`status: done` · added 2026-08-30 · shipped at build 190

**Build note** — `src/engine/motion-bias.ts` is new and pure, same
discipline as `ripples.ts`/`emitter.ts`/`touch.ts`: no DOM, no clock. It
implements the three tiers via one construction, not three: `rotate(ax,
ay, amount)` is a zero-sum three-way opponent-axis split (an equilateral-
triangle/Maxwell-triangle basis) that makes `dr + dg + db === 0` an
algebraic identity for any input, so "brightness-neutral" holds exactly
rather than approximately. Posture, disturbance and agitation each call
it with the *same* tilt direction, scaled by their own driving quantity
(1, `disturb`, and the new `agitation` accumulator respectively) — **Mine**,
since the entry gives three magnitudes but no channel mapping and no
statement that the three should point in independent directions; the
entry's own "carried across a room" imagery reads as disturbance and
agitation amplifying whichever way the phone already leans, not
introducing hues posture wouldn't already point toward.

`scene.ts` needed a real change, not just a new uniform write: `geoColour`/
`atmColour` used to be direct, one-shot uniform writes from
`setLayerColour()`, and a render-time bias needs the *stored* value kept
somewhere JS can re-read every frame while the uniform itself gets
overwritten with base-plus-bias each render. `setLayerColour('geo'/'atm',
...)` now updates a plain local `baseGeoColour`/`baseAtmColour` instead of
writing the uniform directly; `render()` recomputes both uniforms from
base plus the current bias every frame. `cam` is untouched — the entry
names `geoColour`/`atmColour` specifically as the stored preferences in
question. `stats()` gained a `motion: {posture, disturbance, agitation}`
field (the readout's own new "bias post/dist/agit" line — labelled "bias"
rather than "motion", since that word already names the accelerometer
sample-count diagnostic two lines above it).

**One number is inferred, not quoted**: agitation's own dynamics ("rises
with disturb, settles over about 30 seconds") are implemented as the same
snap-up/exponential-decay envelope `shake.ts`'s own `Tumble` class already
uses for the identical problem (`this.disturb > this.envelope`) — an
explicit reuse of an established idiom rather than a new curve shape,
**Mine**, since the entry names the settle time but not the rise
behaviour.

**A spec-internal tension, resolved and stated rather than silently
picked**: Decided's "what agitation is for" bullet describes it as
something that "scales the other two" (a multiplier), while two bullets
later it is described as one of "three [that] are additive and clamp
together" with its own independent peak (an addend). These are different
mechanisms. Implemented as **additive**, matching the more specific,
numbered description (posture ±0.06, disturbance ±0.12, agitation ±0.08,
combined and clamped) — the "scales" framing still holds in effect,
because agitation's own term is proportional to the agitation value,
which itself only rises when the phone is actually handled, so its
contribution is 0 exactly when "not scaling anything" is the correct
answer (a phone untouched for 30s+).

Clamping is done as a **uniform scale-down of the combined vector**, not a
per-channel clamp — the only form that cannot break the zero-sum
guarantee, since clamping each channel independently would let two
channels clip while the third didn't, moving the sum away from 0 exactly
when the effect is largest.

`scripts/probe-motion-bias.ts` (new, `pnpm probe:motion-bias`) adapts
rather than copies the entry's own Verify instruction ("walk it 200k
times... asserting luminance never trends downward, the same method that
proved entry 21's floors"): that method exists for a colour that
*accumulates* across a session (repeated nudges compounding into the same
stored value), and this bias has no such walk — it is recomputed fresh
every frame against whatever the stored colour already is, never written
back into it. So the probe checks the stronger, exact property this
design's architecture actually guarantees: `|r + g + b| < 1e-9` across
200,000 random `(tiltX, tiltY, disturb, dt)` draws, plus unit checks for
each tier's own peak, the zero-tilt/zero-bias case, and agitation's snap-
up-then-30s-settle shape.

Verified live via `scene.ts` loaded directly over Vite's dev server (the
same construction main.ts uses before the mic gate resolves): rendering
one frame at zero tilt and one at full tilt on one axis produced genuinely
different pixels via `readPixels()`, while the `geoColour` object passed
to `createVisualiser()` came back with every field exactly as given —
concrete proof the bias never touches stored colour, not just an
inspection of the diff. `stats().motion` correctly reported `posture: 1`
for that same full-tilt call. A separate call confirmed `setLayerColour()`
still changes the rendered output correctly through the new base-tracked
indirection. `pnpm build`, `pnpm lint`, `pnpm probe:motion-bias`, and
`pnpm probe:shake` (named explicitly in Verify, confirming the detector
itself is untouched) all pass. Not verified: anything requiring a held,
tilted, or waved phone, which the entry's own Verify text names as
needing a real device for four of its states, and the 320×568/360×640
on-screen check the Lands-in text does not actually ask for (this entry
touches no layout, only colour).

**Do** — wire `disturb` and tilt into the picture's colour as a continuous,
render-time bias, and add the slow agitation accumulator that gives the app a
memory of having been handled.
**Why** — `docs/motion-as-a-continuum.md`, and Victor's answer to the question
it left open: a still hand should differ from a still table **slightly but
visibly**. The research is done; this is the entry it asked for and that I
failed to write at the time.

**Decided**
- The three tiers, from the note → **posture** (tilt, meaningful while
  perfectly still), **disturbance** (`disturb`, already computed and decayed
  with a 0.7s constant), and **agitation** (new: rises with `disturb`, settles
  over about 30 seconds). The app implements only the middle one today, and
  only into geometry.
- **`FLOOR = 1.2` is why posture has to exist** → its comment says a hand
  holding the phone "reads a few tenths" and 1.2 clears that deliberately, so
  a held phone reads `disturb` **0.00 by design**. "Slightly but visibly
  different from a table" therefore cannot come from `disturb` at all; at rest
  there is nothing there. Tilt is the only signal with anything to say, which
  is why the note listed it first and why it is not optional here.
- **A render-time bias, never a write to stored colour** → `geoColour` and
  `atmColour` are stored preferences that the shuffle, the director and the
  HUD all write. A motion bias that touched them would persist, fight three
  other writers, and turn up in a shared URL. It goes in at the **same seam
  entry 48 established**: just before `scene.ts` copies params into uniforms.
  **Mine**, and the pattern is now the app's answer to "a transient influence
  that must not poison stored state or diagnostics" — touch used it first, this
  is its second user, and that is worth naming so the third does not invent a
  third way.
- **Brightness-neutral, and this is the safeguard that matters** → the bias
  rotates colour between channels rather than scaling it down. Entry 21 exists
  because two independent floors multiplied into a black screen, and entry 35
  had to re-apply those floors inside its nudge for the same reason. A
  continuous bias is a random walk that runs for the whole session, so a
  bias that can darken *will* darken. It may move hue; it may not reduce total
  luminance. **Mine.**
- The magnitudes, all "slight but visible" as answered → **posture up to
  ±0.06** per channel at a full 90° tilt, **disturbance up to ±0.12** at
  `disturb` 1.0, **agitation up to ±0.08**, applied on top. The three are
  additive and clamp together, so the worst case is a visible shift and never a
  different palette.
- **What agitation is for**, since it is the only new state → it scales the
  other two. A phone that has been carried across a room answers a tilt more
  than one that has been sitting on a table for a minute. That is the
  difference the note was reaching for between *reactive* and *alive*: the toy
  has a state your handling changes, and it comes back down on its own. About
  **30 seconds** to settle, which is long enough to survive a pause and short
  enough that a phone put down goes quiet within a track.
- The diagnostics show all three → posture, disturbance and agitation as
  numbers in the readout. Without them, "is this doing anything" is
  unanswerable for a feature whose whole design brief is *slight*, and that is
  the same trap `director.ts:151` had to add `status()` to escape.
- **Geometry is untouched** → the tumble's caps stay exactly where they are.
  The note is explicit, and so is entry 32: past those caps "the image reads as
  broken rather than disturbed", and whole-frame scale is "the one coupling
  that turns responsive into nauseating". This entry adds response in colour,
  which is the axis with room in it.
- Screenshots stop being reproducible, and that is intended → recorded in the
  note when the question was answered. The tilt at the moment of capture is
  part of the picture. Nothing downstream should normalise it away, but anyone
  comparing two builds by eye now has to hold the phone the same way for both.

**Lands in**
- `src/shake.ts:342-348` — `tilt()`, the uncapped −1..1 pair; `gravity()`
  rewritten in terms of it rather than the two dividing the same numbers by
  different constants.
- `src/engine/motion-bias.ts` — new. The agitation accumulator and the pure
  function from (tilt, disturb, agitation) to a colour bias.
- `src/scene.ts`, the params copy — the bias applied at entry 48's seam.
- `src/hud.ts` — three numbers in the readout.

**Done when** — a phone held still in the hand is visibly, slightly different
from the same phone on a table; tilting it slowly walks the palette and
tilting back walks it home; waving it about shifts the colour further than
tilting does; a phone that has just been carried responds more than one that
has sat for a minute, and settles back within about thirty seconds. Total
brightness never falls as a result of any of it — check by leaving it running
and handled for ten minutes and confirming the picture is no darker than it
started.
**Verify** — the phone, held, tilted, waved and put down, which is four states
no probe reproduces. Then a node probe over the bias function alone, walking it
200k times from random motion inputs and asserting luminance never trends
downward — the same method that proved entry 21's floors, and necessary for the
same reason. `pnpm probe:shake` must be unchanged: this reads the detector and
must not alter it. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs **no**, deliberately: nothing is stored, which is what
keeps it out of the shuffle's and the director's way · url no · capture no ·
dependency no.

### 59. Assert the ripple constants match, across seven files
`status: done` · added 2026-08-30 · shipped at build 182

**Build note** — `AUDIO_RIPPLES` exported from `ripples.ts`, and
`scripts/probe-ripples.ts` (new, `pnpm probe:ripples`) reads the six
geometric shaders as text, matched by regex against `const int
MAX_RIPPLES = N;`/`const int AUDIO_RIPPLES = N;`, discovered by `readdir`
over `src/shaders/*.frag.glsl` and filtered to files that declare either
constant — exactly the grep-not-a-list approach Decided asks for, so a
future seventh geometric view is covered automatically. Also asserts
`ripples.ts`'s own pair is internally coherent (`0 < AUDIO_RIPPLES <
MAX_RIPPLES`) and that exactly six shaders were found, so a future rename
or a shader moved out of `src/shaders/` can't silently make the check
vacuous by matching nothing.

Did exactly what the entry's own Verify text asks rather than trusting the
green run: edited `circles.frag.glsl`'s `MAX_RIPPLES` to 24 by hand, ran
the probe, watched it fail naming the file and both numbers (`found 24`
against the expected 12), then reverted and watched it pass again. `git
diff --stat` confirms the shader file carries no diff after the revert.

`pnpm build`, `pnpm lint`, and `pnpm probe:ripples` all clean on the tree
as it stands today. Landing this before entry 57 (which is Decided's own
stated reason to build it now) means the next entry's twelve-of-fourteen
site migration gets checked by a probe that already existed and already
proved it can fail, rather than one written alongside the change it is
meant to catch.

**Do** — a probe that reads the six geometric shaders as text, extracts
`MAX_RIPPLES` and `AUDIO_RIPPLES` from each, and fails if any disagrees with
`ripples.ts`.
**Why** — the same two numbers are declared **fourteen times** and kept in step
by hand, the comments say so, and entry 57 is about to change both.

**Decided**
- The count, which is worse than the comments admit → `ripples.ts:24-25`
  declares `MAX_RIPPLES = 12` and `AUDIO_RIPPLES = 8`, and **each of the six
  geometric shaders declares both again** (`circles.frag.glsl:81-82` and its
  five siblings). Fourteen declarations of two facts. The comment at `:72` says
  "Must match MAX_RIPPLES in ripples.ts — GLSL can't import a JS constant",
  which is true and is a reason to *check* it, not a reason to trust it.
- **`AUDIO_RIPPLES` is not even exported** → it is module-private in
  `ripples.ts`, so nothing outside that file can read the number it is supposed
  to agree with. Exporting it is part of this entry and is the smaller half.
- What a mismatch actually does, since "they might drift" is too vague to
  motivate the work → if `ripples.ts` is **higher**, an array of 12 uploads
  into a `uniform vec4[8]` and the extra ripples are dropped or rejected
  depending on the driver. If a shader is **higher**, its loop reads uniforms
  that were never written — garbage positions, rings appearing where nothing
  was touched. **Either way it is one view out of six misbehaving**, which is
  precisely the bug that survives testing: five views look right, the sixth is
  assumed to be a shader quirk.
- Why now rather than at leisure → the pair has already survived one change
  (8 → 12, entry 33) and **entry 57 changes both again** (12 → 24, audio 8,
  touch 16). Twelve of the fourteen sites move in one commit. This probe is
  worth more before that lands than after it.
- **Read the shaders as text, do not compile them** → the numbers are `const
  int` declarations matched by a regex, and a probe that needs a GL context
  cannot run in node beside the others. `probe-mapping.ts`, `probe-shake.ts`
  and the rest all run under `node --experimental-strip-types` and touch no
  browser; this joins them. **Mine.**
- It also asserts the *pair* is coherent → `AUDIO_RIPPLES < MAX_RIPPLES`, and
  the touch band non-empty. `ripples.ts` computes `TOUCH_RIPPLES = MAX_RIPPLES
  - AUDIO_RIPPLES` while the shader loops `[AUDIO_RIPPLES, MAX_RIPPLES)` —
  the same split expressed two ways, so a change that broke the relationship
  would produce a negative band in one encoding and an empty loop in the other.
- Which shaders are in scope → the six that declare the constants, discovered
  by grep rather than listed, so a seventh geometric view added later is
  covered without anyone remembering to add it. **Mine**, and it is the
  difference between a check and a checklist.
- Not a build-time codegen → generating the GLSL constants from the TS ones
  would remove the duplication entirely and is the tidier answer, but it means
  a shader preprocessing step this project does not have, for two integers.
  A probe costs twenty lines and catches the same failure. **Mine**, and worth
  revisiting only if a third constant ever needs sharing.

**Lands in**
- `scripts/probe-ripples.ts` — new, and a `probe:ripples` script beside the
  others in `package.json`.
- `src/engine/ripples.ts:25` — `AUDIO_RIPPLES` exported.

**Done when** — `pnpm probe:ripples` passes on the tree as it stands, and fails
with a named file and both numbers when either constant is edited in one place
only. Deliberately test that: change one shader, watch it fail, change it back.
**Verify** — the probe itself is the verification; the check that matters is
that it *fails* when it should, since a green check that cannot go red is
worse than no check. Run it before and after entry 57 moves twelve of the
fourteen sites. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 60. The start screen rolls its own look, without keeping it
`status: done` · added 2026-08-30 · shipped at build 213

**Build note** — the gate's visualiser is now constructed from
`shuffled(SHUFFLE_VIEWS, ...)` rather than straight from `prefs`, called
directly rather than through `panel.adopt()` — `adopt()` writes to `prefs`
and calls `save()`, which is exactly what must not happen here. At
`SHUFFLE_VIEWS` (0.7) every field `shuffled()` can produce is at or above
`SHUFFLE_RESEED` (0.3) and `SHUFFLE_MERGE` (0.45), so colours get a full
re-roll (not the below-`SHUFFLE_RESEED` nudge) and both merge modes roll too;
it's below `SHUFFLE_EVERYTHING` (0.9), so alphas, camColour and mapping are
left alone, matching the entry's "not the alphas and not the mapping". The
legibility floor (`SHUFFLE_MIN_DOMINANT_CHANNEL`, entry 21) comes along for
free since it's the same `colour()` helper every other shuffle rung already
uses — nothing new needed there. The `current` argument passed in is never
actually read at this depth (the reseed branch ignores it); it's there only
to satisfy `shuffled()`'s signature.

`?rgb=` skips the roll entirely rather than being carved around as one
field — **Mine**, per the entry's own framing that "the gate shows your
stored picture" is the *correct* behaviour for a link naming a specific
colour, not just a fallback for the one field that would otherwise conflict.

The real bug this entry's Done-when actually catches: the gate and the
running session share one `visualiser` instance. Nothing before this entry
ever needed to distinguish "what the gate is showing" from "what Start
should restore", because they were always the same prefs. Once the gate can
show something else, an explicit restore is required or Start would hand
you whatever the gate happened to roll, not your stored picture — so
`main()` now calls `setGeometricView`/`setAtmosphericView`/`setLayerColour`
(geo and atm)/`setMergeMode` (geo and atm) against `prefs` right after
`live = true`, before anything else can read the visualiser's state.
Unconditional, not gated on whether a roll actually happened, so it stays
correct if a later change adds another path that could leave the gate's
visualiser out of sync.

Verified live against the real dev server, with a fixed stored palette
(`geoColour` pinned to pure red) set directly in `localStorage` so a rolled
look would be unmistakable against it. Reloading repeatedly produced
visibly different pictures each time — different view geometry, different
colour cast — confirmed by screenshot comparison across reloads. `?rgb=`
held the same requested colour and the same picture shape across two
consecutive reloads, unlike the unqualified reloads. `localStorage` was read
back byte-identical to what was written, both after a plain reload and after
loading the gate inside a 320×568 iframe — the gate never writes to storage.
Layout at 320×568 and 360×640 (via the same iframe technique `hud-narrow.html`
already established, since `resize_window` cannot actually shrink this
harness's window — see entry 56's build note) showed no overflow on the
title, byline or Start disc, over several different rolled looks.

Not verified: an actual Start click through to a running session. Chrome in
this harness never resolves (or visibly denies) the live microphone-permission
prompt `waitForStart()` needs, a limitation already hit and disclosed in
several earlier entries this session. The restore-on-Start code path itself
is exercised only by code reading, not a live click; it is a direct,
unconditional set of calls against `prefs` (the stored values), not
conditional logic, which is the case most amenable to reasoning about
correctness from the code alone.

**Do** — give the idle preview behind the gate a fresh random look on every
load — colours, views, merge modes — and throw it away the moment Start is
pressed, restoring the stored preferences exactly.
**Why** — the gate currently shows whatever palette you last left, on every
load, forever. It reads as frozen because it is.

**Decided**
- **Not a regression, which is worth saying before anyone goes looking for
  one** → `main.ts:541-542` passes `geoColour: prefs.geoColour` and
  `atmColour: prefs.atmColour` into the visualiser built for the gate, and
  `git log -S` puts that line back at "HUD: merge mode goes back between the
  layers". The preview has **never** rolled. What changed is not the code but
  the number of loads: a palette that settled once now greets you every time,
  and the more the app is opened the more obviously stuck it looks.
- **The preview is a poster, and it should show what the piece can do** → the
  gate's own comment says the start screen "can simply be the piece instead,
  running quietly behind the words", rather than "a poster for something
  absent". A poster that shows one frozen palette forever undersells the
  thirteen views and the six merge modes behind it. Rolling the look is the
  same argument that comment already makes, carried one step further.
- **It must not touch stored preferences**, and that is the whole engineering
  content → what Start restores has to be exactly what was stored, or a
  visitor loses their picture by opening the page. This is the third user of a
  pattern the app has already settled twice: a transient influence applied
  where the values reach the renderer, never written back. Entry 48 established
  it for touch, entry 58 uses it for motion, and this uses it for the gate.
  **Mine**, and the alternative — rolling into `prefs` and restoring on Start —
  is one thrown exception away from overwriting somebody's saved picture.
- What is rolled → **colours, both views, both merge modes.** Not the alphas
  and not the mapping: `SHUFFLE_MIN_ALPHA` exists because two low alphas
  multiply toward black (entry 21), and the gate is the one screen where a dim
  preview also makes the type unreadable — entry 28 measured that at 2.33:1.
  The alphas stay at their stored values, which are already floored. **Mine.**
- **Legibility is a constraint on the roll, not a hope** → the gate's type sits
  over this. Entry 43 added a gradient scrim and entry 28 added shadows, both
  because a moving picture behind words is hard to read, and both were tuned
  against the picture as it is. A roll that can land on a bright field must not
  make the title vanish. So the roll uses the same dominant-channel floor the
  shuffle uses and nothing brighter, and **the 320×568 check here is about the
  words, not the picture.**
- One roll per load, not a cycle → the preview does not keep changing while
  someone reads the screen. It is a still life that happens to move, and a gate
  that reshuffles under you while you are deciding to press a button is
  restless rather than alive. **Mine.**
- Interaction with entry 55 → that entry animates the release name on load. Two
  things arriving at once is fine and probably good: the name flips in while
  the picture is already whatever it is. Neither waits for the other, and
  neither delays Start.
- The `?rgb` URL parameter still wins → `main.ts:106` reads a colour from the
  URL, and a shared link that names a colour must show that colour, on the gate
  as well as after Start. The roll applies only when nothing was asked for.
  **Mine**, and it is the one case where "the gate shows your stored picture"
  is still correct behaviour.

**Lands in**
- `src/main.ts:530-548` — the visualiser built for the gate takes rolled values
  rather than stored ones, with the `?rgb` case falling through.
- `src/main.ts` — the handover at Start, which must apply the stored
  preferences as they were.
- `src/main.ts:327-370`, `shuffled()` — the roll should reuse its `colour()`
  and its floors rather than growing a second palette generator.

**Done when** — loading the gate twice in a row gives two visibly different
pictures, and the title, byline and release name are readable over both at
320×568 and 360×640; pressing Start returns exactly the picture and settings
that were stored, with nothing altered by having looked at the gate; a link
carrying `?rgb` shows that colour on the gate; and a reload after Start still
restores the stored picture rather than a rolled one.
**Verify** — the browser, reloading ten times and reading the type over every
one of them, which is the failure mode this can actually ship with. Then check
`localStorage` before and after visiting the gate and confirm it is byte
identical. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs **no**, and this entry is mostly about making sure of
that: nothing is written · url no (`?rgb` keeps its meaning) · capture no ·
dependency no.

### 61. The powder becomes a material: hold piles, drag pushes, motion moves it
`status: done` · added 2026-08-30 · shipped at build 216

**Build note** — a process note first: this entry was implemented without the
`status: building` claim commit the queue's own protocol calls for (an
oversight on my part). Checked before writing this note: `docs/todo.md`'s
entry 61 was untouched by the concurrent session in the interim (two of its
docs-only commits landed on entries 63/64/68 while this was in flight), so
nothing collided — but the claim step is not optional going forward.

`powder.ts`'s drag no longer lays grains: `spawnDragSegment` and
`DRAG_GRAINS_PER_PX`/`DRAG_VELOCITY_FRACTION` are gone (deleted, not zeroed —
`DRAG_GRAINS_PER_PX = 0` would still have spawned one grain per move event,
since the old code's `Math.max(1, ...)` floor doesn't know the rate is
meant to be off; deletion is the honest way to make "instead of laying new
ones" literally true). `pushGrains(x, y, vx, vy)` replaces it: every grain
within `PUSH_RADIUS_PX` (40, the entry's own number) gets an impulse scaled
by the finger's own pixel velocity and a linear falloff to the radius's
edge. A hold vs. a drag is told apart by `lastMovedAt`, which only advances
on a move past `HOLD_STILL_PX` (3px — real touch input jitters even under a
"still" finger); once `STILL_DELAY_S` (0.12s, **Mine**) has passed since the
last real move, `step()` piles continuously at `PILE_RATE_PER_S` (60, the
entry's number) at the last known position, and the two are mutually
exclusive by construction — piling stops the instant a real move resumes.
Disturb adds a small random-walk jitter to every grain (`DISTURB_JITTER_ACCEL`,
**Mine**, well under `TILT_ACCEL` so carrying the phone reads as a tremor,
not a slide). A `takeStrong()` peak scatters every grain outward from the
field's own centre, scaled by `intensity(peak)` (`SCATTER_SPEED_PX_S`,
**Mine**).

The actual coordination bug the entry names, found by tracing it rather than
assuming it: `Tumble.takeStrong()` is one-shot — read-and-cleared — and
`idleFrame` in `main.ts` was already calling it, unconditionally, every idle
tick, discarding the result (a deliberate no-op, per its own comment, so a
shake taken pre-Start doesn't retroactively fire something once the live
loop starts reading it after Start). Nothing before this entry ever needed a
*second* reader of that one-shot value. The powder's own render loop is a
second, independent `requestAnimationFrame` chain running alongside
`idleFrame`'s — if powder tried to call `shake.takeStrong()` itself from
that loop, it would race `idleFrame`'s own call for whichever fires first in
a tick, and the loser would always see zero. Fixed by keeping `idleFrame` as
the *only* caller of `shake.takeStrong()`/`.frame()` (as it already was),
routing its return into a `pendingScatterPeak` closure variable instead of
discarding it, and having the widened `getMotion()` getter passed into
`mountPowder` read-and-clear that variable itself — the same one-shot shape
`takeStrong()` has, just relayed through one more hop, with a single
consumer at each end. `takeDouble()` is left exactly as it was (still
unconditionally discarded): nothing here gives it a job.

Also on the third tap: `goFullscreen()` is now called on entry (never on
exit — Decided, Mine, matches the entry's "leaving the egg does not leave
fullscreen").

Verified: `pnpm build`, `pnpm lint`, `pnpm probe:shake` (unchanged, per the
entry's own Verify line — confirmed still green, not just assumed). Live
against the real dev server: the three-tap toggle correctly swaps gate for
powder and back (confirmed via `gate.hidden`/`powder.hidden`), and a
script-dispatched tap on the powder canvas produces a visible burst
(confirmed by canvas pixel readback, both immediately and after the render
loop's next draw). `goFullscreen()` does not throw and produces no console
error on a script-dispatched (untrusted) tap, consistent with the function's
own documented silent-refusal design — `document.fullscreenElement` stayed
false, which is the expected outcome of an untrusted gesture, not a defect.

Not verified live: continuous piling, the push impulse, disturb's jitter and
the shake scatter, all of which only show up as the render loop keeps
ticking over real seconds. This session's Chrome tab has, over the course of
this conversation, gone from the previously-documented "no real rAF, but a
`setTimeout`-based polyfill fires roughly once a second" (entries 44 and
onward) to a tab whose `setTimeout` calls — patched or native — stopped
firing at all after several minutes backgrounded: an 8-second and a 9-second
wait, on two separate attempts, produced zero canvas change even for grains
that should have been settling under their own decaying velocity, let alone
piling. This is a harness limitation, escalating over the session's own
lifetime, not a code defect — the state-machine half (toggle, burst) is
confirmed live because it does not depend on the render loop ticking more
than once. In its place, the four per-frame formulas (push falloff, pile
accumulation, scatter's zero-at-rest and nonzero-under-a-real-peak) were
checked as isolated arithmetic in a throwaway Node script: all four correct.
One thing found there worth recording as a non-bug: `PILE_RATE_PER_S`
accumulated as `IEEE-754` floats loses exactly one grain per second to
floating-point rounding (59 rather than 60 over 1s of continuous ticks at a
1/60s step) — cosmetically invisible in an easter egg and not worth a
correction.

**Do** — the easter egg enters fullscreen; a hold builds a pile; a drag pushes
the grains that are there instead of laying new ones; and shaking or moving the
phone moves the powder.
**Why** — entry 46 shipped at build 180 as a drawing toy. This makes it a
substance, which is what "powder" was always promising.

**Decided**
- **A drag stops depositing, and that is a reversal of shipped behaviour** →
  `powder.ts:62` is `DRAG_GRAINS_PER_PX = 0.5`, so dragging currently *creates*
  grains along the path. It should **push the grains already there**: an
  impulse to every grain within about **40px** of the finger, scaled by the
  finger's own velocity. `DRAG_GRAINS_PER_PX` goes to zero. Victor's call,
  and it is what makes the difference between drawing and handling.
- Three verbs, cleanly separated → **a tap bursts** (the existing
  `BURST_COUNT = 16`, unchanged, so there is still a fast way to put powder on
  screen), **a hold piles**, **a drag pushes**. **Mine** on keeping the tap:
  without it the only way to get any powder is to wait, and the first thing
  anyone does to a black screen is tap it.
- The pile → a stationary finger deposits continuously at about **60 grains a
  second**, with the existing `BURST_SPREAD_PX` of 6, so it grows where the
  finger is rather than appearing all at once. It is a pile by accumulation,
  not by stacking: grains do not rest on each other, and simulating that is a
  cellular-automaton sand model this entry is deliberately not.
- **Fullscreen on entry** → the third tap is a real user gesture, so
  `requestFullscreen()` is allowed there, and it puts no dialog on screen so it
  does not spend the gesture the way the microphone prompt does — the
  order-of-operations comment in `permission-gate.ts` is about calls that open
  dialogs, and this is not one.
- **Leaving the egg does not leave fullscreen** → **Mine.** Dropping out would
  be a second unrequested change of state, and the gate is better in fullscreen
  anyway; Start would only have to ask for it again a moment later. It also
  means `fullscreenStatus()` and the chip see one transition rather than two.
- Motion, in two kinds because the app already measures two → **`disturb`
  jitters, a shake scatters.** A continuous small jitter proportional to
  `disturb` so carrying the phone unsettles the powder, and on `takeStrong()`
  an outward impulse on every grain scaled by `intensity(peak)` so a shake
  throws it. Both numbers already exist and are already probe-covered; nothing
  new is measured.
- **The shake must not do both things at once** → `takeStrong()` is consumed by
  `main.ts`'s loop to re-roll the picture. While the powder is showing, the
  visualiser is not on screen, so the shake belongs to the powder and the
  shuffle must not also fire — otherwise a shake scatters the grains *and*
  silently re-rolls a picture nobody can see, and the picture a person comes
  back to is not the one they left. **Mine**, and it is the one coordination
  bug this entry can ship with.
- Tilt stays as built → `TILT_ACCEL = 900` via the `getTilt()` the module
  already takes. The getter widens to carry `disturb` and the shake events
  rather than three separate arguments, which keeps `powder.ts` a pure module
  taking one motion source.
- `CAP = 3000` is unchanged → a pile is dense rather than large, and the cap is
  a frame-time number that entry 46 already settled. If piling makes it feel
  short, that is a measurement to take on the phone, not a number to raise here.

**Lands in**
- `src/powder.ts:62, 133-141` — the drag becomes a push; the deposit goes.
- `src/powder.ts:55-58` — the hold's continuous deposit, beside the burst.
- `src/powder.ts:83` — the motion source widens from tilt to tilt plus
  `disturb` plus shake impulses.
- `src/main.ts:575-621` — `requestFullscreen()` on the third tap, and the
  shake's routing while the powder is up.

**Done when** — three taps open the egg fullscreen; holding a finger still
grows a visible pile under it; dragging through an existing pile moves it
rather than adding to it, and a fast drag throws it further than a slow one;
tilting slides it; carrying the phone unsettles it; a hard shake scatters it
across the screen and **does not** change the picture waiting behind the egg.
Leaving the egg leaves you in fullscreen on the gate.
**Verify** — the phone, for all of it, since every one of these is a hand or a
motion question. Check the picture behind the egg specifically: enter, shake
hard several times, leave, and confirm the visualiser is exactly as it was.
`pnpm probe:shake` unchanged. `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 62. Fullscreen comes back by itself, and windowed is a state the app knows it is in
`status: done` · added 2026-08-30 · shipped at build 217 (built together with entry 66)

**Build note** — built together with entry 66 as one change to
`permission-gate.ts`, per both entries' own text: 66 is the structural
version of the same fix 62 asks for from the UX side, and 66's own "Mine"
says as much ("with no 'ever entered' concept there is nothing for a future
guard clause to be written against"). See entry 66's build note for the
implementation; this entry's own specific pieces:

- The retry now listens on `#canvas` (`setFullscreenRetryTarget(canvas)`,
  called once from `main()` right after `canvas` is resolved), not `window`.
  This is also what satisfies "should not also arm a retry while the powder
  is showing" (entry 61's own coordination worry) for free: `#powder-canvas`
  sits above `#canvas` in z-index while the powder is up, so a tap there
  never reaches `#canvas`'s listener. No powder-awareness needed in
  `permission-gate.ts` at all — verified by reasoning about the DOM stacking
  established by entries 46/61, not by a live powder+fullscreen-loss test
  (compounding two things this harness already can't drive for real: a
  trusted fullscreen gesture and the powder's own render loop).
- `document.documentElement.dataset.fullscreen` is set to `'true'`/`'false'`
  from the same `fullscreenchange` handler that already tracks entry/exit —
  confirmed live (see entry 66's build note) via a direct import of
  `permission-gate.ts` in a real browser tab, not just the probe's own DOM
  stub.
- The fullscreen chip's own hidden-state logic (`main.ts`'s
  `updateFullscreenChip`) is unchanged — `'exited'`/`'refused'` are still the
  two states it shows on, and both still exist under the new model.

Not verified live: the actual chip click and `waitForStart` wiring, since
both sit behind the real Start gesture this harness cannot complete (the
microphone permission prompt never resolves). What was verified live instead
is `permission-gate.ts` itself, directly, which is where all of this
entry's and entry 66's logic actually lives.

**Do** — re-arm the fullscreen retry every time fullscreen is lost, not only
before the first entry, and mark the windowed state so the app can look and
behave like what it is.
**Why** — fullscreen is lost repeatedly and only comes back if you find the
chip. The recovery already exists; it is switched off after the first success.

**Decided**
- The cause, exactly → `permission-gate.ts:144` is
  **`if (fsArmed || fsEverEntered) return`**. `armFullscreenRetry()` arms a
  one-shot `pointerup` handler that re-enters fullscreen, and that guard makes
  it refuse forever once fullscreen has succeeded once. So the recovery is
  built, tested and correct, and it is unreachable in exactly the situation
  being complained about.
- The second half → `watchFullscreen()` at `:127-129` sets `'exited'` with the
  comment "**A deliberate exit. Recorded, deliberately not acted on.**" That
  was a real decision and Victor is overturning it: an exit is now to be
  treated as an accident until proven otherwise, because on a phone it usually
  is — a system back-swipe, a notification, the address bar reappearing.
- **What "never lose it" can actually mean**, and it is worth stating plainly
  so nobody builds toward the impossible version → **a browser will not enter
  fullscreen without a user gesture.** There is no API that keeps it. The
  strongest achievable behaviour is *re-enter on the very next touch of the
  picture*, silently, forever — which is what `armFullscreenRetry()` already
  does and what removing the guard delivers.
- **The retry listens on the picture, not on `window`** → today it is
  `window.addEventListener('pointerup', retry, true)`. Someone who left
  fullscreen to use the address bar or read a notification would be dragged
  straight back by their next tap anywhere. Scoping it to the canvas means the
  gesture that recovers fullscreen is the gesture that says "I am back to
  playing with this". **Mine**, and it removes the need for a cooldown, a
  deliberate-exit flag, or any attempt to read the user's mind.
- It does not consume the tap → the handler is capture-phase and does not stop
  propagation, so the touch that restores fullscreen also does whatever it
  normally does. That is already true and must stay true: with entries 50 and
  52 landing, that same tap is an emitter and a screenshot.
- **Windowed becomes a state the document declares** → a `data-fullscreen`
  attribute on the root element, set from the same `watchFullscreen()` that
  already tracks this. **Mine**, and the reasoning is that "behave differently
  in a window" is a request with no end: rather than guess which differences
  are wanted, give CSS and the HUD one honest fact to key off and let each
  difference be its own small decision later. The first user of it is the
  fullscreen chip, which is already conditional and can stop reimplementing the
  test.
- What is deliberately **not** decided here → what should actually look
  different when windowed. The viewport is shorter, the browser chrome is
  present, and the composition changes; whether the HUD moves, the resolution
  ladder relaxes, or the capture band shifts are separate questions with
  separate answers. This entry makes them answerable and answers none of them.
- Interaction with entry 61 → the powder now enters fullscreen on its third
  tap. It should not also arm a retry while it is showing, since the powder
  owns the screen and its own exit is a different thing from the app's. Route
  it the same way the shake is routed there.
- `probe-fullscreen.ts` is the guard on all of this → it covers the state
  machine and its docstring already records that a browser cannot prove
  fullscreen without real activation. The states change here; the probe's
  fourteen checks must be updated with them rather than around them.

**Lands in**
- `src/permission-gate.ts:143-153` — the guard, and the listener's target.
- `src/permission-gate.ts:120-132` — the exit branch calls
  `armFullscreenRetry()` and sets the root attribute.
- `scripts/probe-fullscreen.ts` — the re-arm case, which is the behaviour this
  entry exists for and has no coverage today.

**Done when** — leaving fullscreen by any route and then touching the picture
puts it back, every time, not just the first; touching the address bar or a
notification does not; the root element says which state it is in; and the
fullscreen chip still appears while windowed. `pnpm probe:fullscreen` passes
with a new case asserting the retry re-arms after a successful entry.
**Verify** — the phone, leaving fullscreen the way it actually gets lost: the
system back-swipe, and pulling down a notification. A desktop browser cannot
answer this — `probe-fullscreen.ts`'s own docstring says so — so the probe
covers the state machine and the phone covers the behaviour.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 63. The app is called kiyo · plays
`status: done` · added 2026-08-30 · shipped at build 219

**Build note** — every listed site changed exactly as specified: `index.html`
(`<title>`, the `<h1>` wordmark with its hairspace-flanked middot),
`public/manifest.webmanifest` (`name`/`short_name`), `src/share.ts`'s share
sheet title (plain spaces, no hairspaces — matching the entry's own "an OS
share sheet is not the place for typography"), `src/main.ts`'s screenshot
filename prefix (`suti-` → `kiyo-`), `README.md`'s heading, and
`package.json`'s `name` (→ `kiyo-plays`, kebab-case, not published anywhere).
`src/prefs.ts`'s `STORE_KEY` is untouched in value, with a new comment
explaining why, so the next person to notice the mismatch does not "tidy" it
into a settings-losing migration. `src/shaders/circles.frag.glsl`'s history
sentence is untouched, as decided. `grep -ril suti src/ index.html public/`
returns exactly `prefs.ts` and `circles.frag.glsl`, matching the entry's own
Done-when literally.

Verified live against the real dev server, not just by reading the diff: set
a fixed `localStorage` value under the old `suti-view:prefs` key, reloaded,
and confirmed both the tab title and the `#gate` wordmark read `kiyo · plays`
while the stored `geometricView`/`geoColour`/every other field came back
byte-identical — the actual claim behind "prefs yes, and answered by not
moving". Checked the wordmark for overflow at true 320×568 and 360×640
viewports (via the iframe technique — `resize_window` cannot shrink this
harness's own window, see entry 56/60's build notes): `kiyo · plays` is one
character longer than `suti · view` and entry 43's own CSS comment flags
this exact line as "the one place this change can overflow or wrap" at
320px — it does not, at either width.

Not verified live: `navigator.share`'s actual OS sheet title (this harness
has no OS share surface to open) and the installed-PWA `name`/`short_name`
display (would need an actual install). Both are single-line, low-risk
string changes read directly from the diff rather than exercised.

**Do** — replace the name everywhere a person sees it. Leave the repository,
both deploy URLs and the stored prefs key exactly as they are.

**Why** — the piece has a name now. `suti · view` described a viewer; this one
describes what it does with you, which is the same turn "play with me" and the
powder already made.

**Decided**
- **The wordmark keeps its treatment** → `kiyo&#8202;&middot;&#8202;plays`,
  lowercase, the same hairspace-flanked middot as `suti&#8202;&middot;&#8202;view`
  at `index.html:563`. Victor's call, over title case and caps. The
  construction is the identity, not the word inside it.
- **The repository and both URLs do not move.** Victor's call. `share.ts`
  exists so people send this to each other, and a Pages URL is not reliably
  redirected after a repo rename — so renaming the repo would quietly break
  links already in other people's messages. `vvorski/suti-view-2026`,
  `vvorski.github.io/suti-view-2026` and `suti-view-2026.pages.dev` stay, and
  so does `PROJECT_NAME` in `deploy/deploy.sh:13` and every reference under
  `.claude/` and in `CLAUDE.md:243`. Nothing about the deploy changes.
- **`STORE_KEY` stays `'suti-view:prefs'`** — `prefs.ts:21`. **Mine**, and it
  is the one place where doing the obvious thing is destructive: changing the
  key does not migrate anything, it silently hands every existing user the
  defaults and loses the view, the colours and the mapping they had chosen.
  A rename that costs people their settings to fix a string nobody sees is a
  bad trade. Leave it and put the reason in a comment, so the next person to
  notice it does not "tidy" it.
- Screenshot filenames **do** change: `suti-` → `kiyo-` at `main.ts:530`.
  **Mine** — this one is genuinely seen, in a camera roll, next to photos.
  Files already saved keep their names, which is correct: they were made by
  `suti · view`. The worked examples in entries 26, 39 and 44 are records of
  what shipped and are not to be rewritten.
- **`short_name` is `kiyo`, not the full wordmark.** `public/manifest.web
  manifest`. **Mine**: `short_name` is what sits under the home-screen icon
  with about twelve characters of room, and a middot rendered at that size in
  a launcher is a smudge. `name` takes `kiyo · plays` in full.
- The share sheet gets plain spaces → `'kiyo · plays'` at `share.ts:97`,
  matching how `'suti·view'` was already plain text there rather than carrying
  the hairspaces. An OS share sheet is not the place for typography.
- **History stays true.** `README.md:93` and `circles.frag.glsl:3` both say
  "suti-view-2026 grew out of `~/dev/circles`", and that sentence is about a
  repository and remains accurate. Rename the README's heading; do not rewrite
  its history, and do not touch shipped entries in this file.
- No collision with the name animation → entry 62's neighbour at
  `docs/todo.md:5433` animates `#release-name` and `.gate-byline` inside
  `.gate-name`. This entry touches only the `<h1>`. They can land in either
  order.
- Not decided here → whether **kiyo** appears anywhere else, in a dedication or
  a byline. That is the open question from the Kiyo conversation and it belongs
  in its own entry, not smuggled into a rename. **Answered by entry 69:
  nothing further is added — the name itself is the whole statement.**

**Lands in**
- `index.html:16` (`<title>`), `:563` (the `<h1>`).
- `public/manifest.webmanifest` — `name`, `short_name`.
- `src/share.ts:97` — the share sheet title.
- `src/main.ts:530` — the screenshot filename prefix.
- `src/prefs.ts:21` — a comment only; the value must not change.
- `package.json:2` and `README.md:1` — cosmetic; `package.json`'s `name` is not
  published anywhere and is safe to change.

**Done when** — the gate reads `kiyo · plays`, the tab and the installed app
say so, a shared link opens a sheet titled `kiyo · plays`, and a screenshot
saves as `kiyo-<build>-<release>-…png`. A browser that had prefs stored before
the change still has them after it. `grep -ril suti src/ index.html public/`
returns only `prefs.ts` and `circles.frag.glsl`.
**Verify** — the phone, with settings already stored: change a view, reload,
confirm it survived. That is the only part of this that can break anything.
**Hard stops** — prefs **yes, and answered by not moving**: the stored key is
untouched, so the shape and its meaning are unchanged and nothing migrates ·
url no · capture no (the filename changes, the capture path does not) ·
dependency no.

### 64. In daylight the picture is ink, not light
`status: superseded by 68` · added 2026-08-30

**Superseded 2026-08-30**, before being built. Entry 68 keeps this entry's
model and its density/colour split verbatim and widens the scope: measurement
of four day-mode frames showed the atmospheric layer is where the damage
actually is, so the exclusion decided here — geometry only — is the one thing
68 reverses. Build 68; do not build this.

**Do** — in day mode the geometric layer becomes dark ink on the light ground
instead of bright light on it. At night it stays exactly as it is.

**Why** — entry 47 lifted the ground to 0.6 and left the ink white, so a white
ring on a light ground has 0.4 of contrast where it used to have 1.0, and it is
*lighter* than the paper it sits on. Daylight legibility is the whole point of
day mode and this is the half that was missed: nothing readable in sunlight is
drawn in white light. It is drawn in ink.

**Decided**
- **The model, stated once so the algebra follows from it** → night is *light
  emitted in a dark room*, and it is additive. Day is *ink laid on paper*, and
  it is subtractive. Entry 47 supplied the paper and kept drawing with light.
  This supplies the ink.
- **The geometric layer only. The atmosphere keeps screening onto the paper.**
  **Mine**, and it is the fork this entry turns on. The geometric views are
  line art — thin bright figures on an empty field — and line art wants ink.
  The atmospheric views are fields of colour with no empty ground to speak of;
  making a field subtractive turns it into a dark wash over the whole frame,
  which is a duotone print rather than a lighter picture. It also matches what
  was asked for: *circles*.
- **Hue survives.** The naive version — inverting the finished picture — makes
  a blue ring yellow, and a person who chose blue would rightly call that
  broken. So split the geometry into a **density** (`max` channel, how much ink
  is here) and a **colour** (the geometry's own rgb), and lay the ink as
  `mix(paper, geoColour * INK, density)`. A white ring becomes near-black; a
  blue ring becomes dark blue. **Mine**, and it is why this is four lines
  rather than one.
- `INK = 0.12` — dark enough to read as black against a 0.6 ground, not so
  dark that a coloured ink loses its hue entirely. **Mine** as to the value.
- **The ink leads the paper.** This is the failure this design has to dodge and
  it is not obvious: entry 53 made `uDay` continuous and clock-driven, so dawn
  walks it from 0 to 1 — and if ink and ground cross over together, there is a
  stretch around `uDay ≈ 0.5` where a mid-grey ring sits on a mid-grey ground
  and the picture is at its *least* readable, in the exact hour day mode exists
  for. So drive the ink with `smoothstep(0.15, 0.55, uDay)` while the ground
  keeps its plain `uDay`: the ink goes dark before the paper comes up, and
  contrast never dips below what night already had. **Mine**.
- **Applied after exposure and scaled by `(1 - uCameraMix)`**, in the same
  place and on the same terms as the ground it belongs to. Carry `geo`'s
  density and colour down as two locals computed where `geo` is already
  sampled — the layer is gone by then, and re-sampling the texture a second
  time to recover it would be the expensive way to save two variables.
- **Identity at night is algebraic, not tuned** — the final `mix(col, inked,
  uDay * (1 - uCameraMix))` is exactly `col` at `uDay = 0`, the same property
  entry 47 was careful to give the ground. Nothing about the night picture can
  drift as a side effect of this.
- Deliberately **not** touching `uGeoColour` or anything stored → the ink is a
  render-time transform of what the layer already drew, at the same seam
  entries 48, 58 and 60 use. A person's chosen colour is unchanged, still what
  the HUD shows, still what a shared URL carries.
- Reversible if the field views turn out to want it too → the density/colour
  split works identically on the atmosphere. Excluded here on judgement, not
  on cost.

**Lands in**
- `src/shaders/composite.frag.glsl:126` — two locals where `geo` is sampled.
- `src/shaders/composite.frag.glsl:185-187` — the ground line, which gains the
  ink step after it.
- `scripts/probe-composite.ts` — it has no day-mode coverage at all today.

**Done when** — with day mode on, Circles reads as dark rings on a light
ground; a non-white `geoColour` reads as a dark version of itself rather than
its complement; at `uDay = 0` the frame is bit-identical to before the change;
and sweeping `uDay` from 0 to 1 never produces a frame with less ring-to-ground
contrast than at `uDay = 0`. That last one is the entry's real assertion and
belongs in `probe-composite.ts` as a sweep, not as a spot check.
**Verify** — the probe for the arithmetic, including the crossover sweep, then
a phone outdoors, which is the only thing that can answer whether 0.12 and 0.6
are the right pair. Entry 47's own Verify said the same and that half is still
unanswered.
**Hard stops** — prefs no · url no · capture no (the capture shows what is on
screen, and in daylight that is now the readable version) · dependency no.

### 65. The disc still pulses when motion is reduced, and the app says when it is
`status: done` · added 2026-08-30 · shipped at build 220

**Build note** — process lapse first, same as entry 61's: implemented before
committing a `status: building` claim. Checked before writing this note —
no concurrent commit touched this entry in the interim, so nothing
collided, but this is the second time; worth actually stopping to do the
claim commit as the very first action from here on, not just meaning to.

`#start`'s reduced-motion override changed from `animation: none` to
`animation: start-pulse-reduced 3.4s ease-out infinite`, a new keyframe
animating `background` between the resting `#9d9bf0` and the `:hover`
colour `#b9b7ff` at the midpoint — same period as `start-pulse`, no
box-shadow spread, no `scale`, matching the entry's own reasoning exactly
(the disc breathes in colour, not size). `main.ts` now reads
`window.matchMedia('(prefers-reduced-motion: reduce)').matches` once per
frame into a new `reducedMotion` field on the stats object passed to
`panel.update()`; `hud.ts` reports it in the readout as `os motion
reduced`/`os motion full`, appearing only when defined.

One naming collision found and fixed before shipping: the readout already
has a `motion ${samples} ev  peak ...` line — shake-sensor diagnostics,
unrelated to this entry. A first draft used the same `motion` prefix for
the new field, which would have put two differently-meaning lines starting
with the same word next to each other in the same readout. Renamed to `os
motion` specifically to keep them apart.

Verified live against the real dev server via the CSS Object Model, not
just by reading the source: confirmed `start-pulse-reduced` exists as an
actual parsed keyframes rule with two steps, and confirmed the
`@media (prefers-reduced-motion: reduce) { #start { ... } }` rule resolves
its `animation` shorthand to `start-pulse-reduced` at 3.4s ease-out infinite
— not `none`, and not silently pointing at a nonexistent keyframe name — a
class of typo neither `pnpm build` nor `pnpm lint` would have caught, since
neither TypeScript nor ESLint parses embedded `<style>` CSS.

Not verified, matching the entry's own stated limits exactly: real behaviour
on a phone with Battery Saver toggled, and even a DevTools
`prefers-reduced-motion: reduce` emulation, which needs the Chrome DevTools
Protocol's Emulation domain — this session's browser tools don't expose it.
`pnpm build`, `pnpm lint` both clean; no probe script covers this file's
embedded CSS today and the entry doesn't ask for one.

**Do** — give `#start` a reduced-motion pulse instead of switching it off, and
report `prefers-reduced-motion` in the `?debug` readout.

**Why** — the pulse has shipped twice (builds 99 and 159) and has never been
seen. The CSS is correct, so the cause is environmental and the app cannot
currently say which environment it is in.

**Decided**
- **What was ruled out first**, so nobody re-checks it: the rule at
  `index.html:421` is present and well-formed; `#start` is *not* `disabled` at
  load, so `:disabled { animation: none }` at `:453` is not firing; the
  reduced-motion override at `:514` is later in the file at equal specificity,
  so it does win, which is the point below; and `start-breathe` correctly uses
  the `scale` property rather than `transform`, so `#start:active` is not
  deleting it. Nothing about the authored animation is wrong.
- **The cause, most likely** → `@media (prefers-reduced-motion: reduce)` at
  `:514` sets `animation: none` and kills **both** animations outright. Android
  sets that query under Battery Saver and under Settings → Accessibility →
  Remove animations, neither of which announces itself to a web page. A phone
  in that state is also the leading explanation for entry 40's haptics, which
  failed on every rung — the same restricted-power posture, on the same
  handset, across the same weekend.
- **The file already disagrees with itself about this, and the other half is
  right.** Entry 41's shake pulse does not go silent under reduced motion — it
  swaps to `shake-pulse-reduced` and `shake-pulse-double-reduced` at `:174` and
  `:178`, keeping the signal and dropping the movement, with a comment that
  states the principle exactly: *"it still goes green; it just stops
  blinking."* `#start` is the inconsistency, not the precedent. The preference
  asks for less **motion**, not less **feedback**, and a disc whose entire job
  is to say *press me* is the last thing that should answer it by going still.
- **So: `start-pulse-reduced`** — the same 3.4s period, animating `background`
  between `#9d9bf0` and the `:hover` colour `#b9b7ff` rather than a travelling
  ring. **Mine.** No box-shadow spread (that is the movement), no `scale` (that
  is `start-breathe`, which stays off — it is literally size change and is what
  the preference is about). The disc breathes in colour instead of in size,
  which is legible across a room and moves nothing.
- **The readout is the load-bearing half, not the fix.** If reduced motion is
  *not* the cause, the change above alters nothing and we are guessing a fourth
  time. One word in the `?debug` line turns it into a fact at a glance —
  exactly the argument `shake.ts`'s own `diagnostics()` already makes for
  `samples` and `peak`, and for the same reason: two very different faults with
  one indistinguishable symptom.
- Confirming it explains **three** symptoms at once → the same query also
  silences the byline glow (`:329`) and both shake-flash tiers (`:112`,
  `:209`). If the readout says motion is reduced, the byline is not glowing
  either, and that is checkable on the same screen without changing anything.
- Not decided here → whether to offer an in-app override. A page that ignores a
  stated accessibility preference on the user's say-so is a real design
  question and it is not this entry's.

**Lands in**
- `index.html:514-516` — the override becomes a swap, not an off switch.
- `index.html` — one new `@keyframes start-pulse-reduced`, beside the shake
  pair it is modelled on.
- `src/hud.ts:1214` — the readout, beside the existing `full <state>` field.

**Done when** — with Android's "Remove animations" on, the disc still visibly
changes, in colour, on the same 3.4s period, and does not move or resize; with
it off, the ring and the breathe are exactly as they are today; and the `?debug`
readout states which of the two the phone is in.
**Verify** — the phone, with Battery Saver toggled both ways, which is the
whole question. A desktop can only rehearse it: DevTools can emulate
`prefers-reduced-motion: reduce`, which proves the CSS swaps but not that the
handset was ever in that state.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 66. Fullscreen is a desire, not a history — and the probe asserts the invariant
`status: done` · added 2026-08-30 · shipped at build 217 (built together with entry 62)

**Build note** — `permission-gate.ts`'s five flags (`fsState`, `fsError`,
`fsAttempts`, `fsArmed`, `fsEverEntered`) collapse to `wantFullscreen` (the
one desire, set true the first time anything calls `goFullscreen()`, never
set back to false) plus `fsState`/`fsError`/`fsAttempts` kept as plain
diagnostics, plus a re-added `fsArmed` — not eliminated, since the entry
itself asks the readout to show "whether the retry is armed" as
independent of `state`. What's actually gone is `fsEverEntered` and the
`||`-guard that conditioned re-arming on it; `grep -c fsEverEntered src/` is
0 (checked, including in a doc comment that named the flag historically —
the mechanical Done-when check doesn't distinguish code from prose, so that
comment was reworded rather than left as a false negative).

`watchFullscreen()`'s `fullscreenchange` handler now calls
`armFullscreenRetry()` unconditionally on every exit, not only from a
rejected `goFullscreen()` promise — "if we want it and we are not in it, arm
the retry", re-evaluated fresh every time, exactly as the entry states it.
`armFullscreenRetry()`'s own guard is `if (!wantFullscreen || fsArmed ||
!retryTarget) return` — no history term at all, so it cannot refuse a second
time for the same reason it refused every time after the first before this
entry.

**Deliberately verified the check can fail, not just that it passes** —
before running the final probe, temporarily reintroduced an `everEntered`
flag ORed into the same guard (the old bug's exact shape) and confirmed
`pnpm probe:fullscreen` failed 7 of its checks, specifically the new cycle's
second and third iterations (`armed was false`, state stuck on `exited`
instead of recovering) — exactly where the original bug would have shown up
had this check existed when it was introduced. Reverted immediately after
confirming the failure, then reran clean.

`probe-fullscreen.ts` rewritten: the DOM stub's `document.addEventListener`
was a bare no-op before this entry (the old cases never needed a real
`fullscreenchange` event, since every failure path they tested went through
`goFullscreen()`'s own promise rejection, not a genuine loss-while-active).
Entry 66's own invariant — recovery after any number of *real* losses, not
rejections — can't be exercised without one, so the stub now captures
`fullscreenchange` listeners for real and exposes `stub.exit()` to fire one
with `fullscreenElement` already null, simulating a system back-swipe. A
second stub target (a fake canvas-like object with its own listener map)
replaces the old `window`-based tap simulation, matching entry 62's retry
now living on `#canvas` rather than `window`. The two "unbounded negative"
checks (`granted → a later tap does not re-request`, `recovered → stops
asking`) are restated as `while active, a tap does not re-request` — bounded
by the entry's own naming convention ("a check whose name is a negative must
say under what condition the behaviour resumes"). The new case 6 runs the
entry's own example — enter, lose, tap, re-enter, three times — asserting
`state`/`armed` at every step, not just the final call count, so a
regression that only breaks the *second* cycle (exactly what the original
bug did) cannot hide behind a passing aggregate.

`hud.ts`'s readout line gains ` want`/` armed` beside `full <state>` — only
appended when true, so the common steady-state case (`full active`) reads
exactly as it always did and the two new words appear only when there is
something to say. Not verified via the real numeric readout on a phone
(requires a completed Start), but `fullscreenStatus()`'s new `want`/`armed`
fields were confirmed live against the real module: `active(want=true,
armed=false) → exited(want=true, armed=true) → active(want=true,
armed=false)` across two full loss/recovery cycles, and a tap on an element
other than the registered retry target was confirmed to leave `attempts`,
`state`, and `armed` all unchanged.

**Do** — replace the fullscreen flags with a single "do we want fullscreen"
plus state derived from the document, and change `probe-fullscreen.ts` to
assert the invariant rather than the current behaviour.

**Why** — asked how to stop this happening again. The honest answer is not a
bisect: it never worked, and the guard that was supposed to catch it asserts
the fault as correct.

**Decided**
- **It is not a regression, and that matters for the fix.** `git log -S` puts
  `if (fsArmed || fsEverEntered) return` in `7e24054`, the same commit that
  first introduced `fsEverEntered` — and `99b6315`, *"A way back into
  fullscreen once it has been lost"*, comes after it and shipped the chip
  precisely because the automatic path was first-entry-only. **Automatic
  re-entry has never worked twice in any build.** So there is no bad commit to
  find and no bisect to run, and "how do we make sure it doesn't happen again"
  cannot be answered by watching for a change — the thing was wrong when it was
  written.
- **The probe asserts the bug.** `probe-fullscreen.ts:113` is
  `'granted → a later tap does not re-request'`, checking `stub.calls === 1`,
  and `:143` is `'recovered → stops asking'`. Both are green today. Both are
  the defect, written down as a requirement. The probe's own docstring opens
  with *"fullscreen went missing for several builds and nothing noticed"* —
  it was written to stop exactly this, and it froze the fault instead.
- **Why they were written that way, because it was not carelessness** → they
  are anti-nag checks, and nagging is a real failure: a page that re-requests
  fullscreen on every tap is unusable. The mistake is that they condition on
  **history** ("has it ever succeeded") when the thing they mean conditions on
  **state** ("is it fullscreen right now"). Those two agree exactly until
  fullscreen is lost, which is the case nobody wrote a check for.
- **The rule worth keeping past this entry**: *a check whose name is a negative
  must say under what condition the behaviour resumes.* "Does not re-request"
  and "stops asking" are unbounded, and an unbounded negative is how a probe
  turns a decision into a permanent one. Restated: **"while active, a tap does
  not re-request"** — same protection, and it is now false in exactly the
  situation it should be.
- **The structural fix: remove the concept that made it expressible.** Five
  module-level flags currently model this (`fsState`, `fsError`, `fsAttempts`,
  `fsArmed`, `fsEverEntered`). Replace the history ones with **one desire**:
  `wantFullscreen`, true from the Start gesture, false only when the person
  leaves deliberately. Everything else is derived from
  `document.fullscreenElement` on each `fullscreenchange`, and the whole rule
  becomes one line — **if we want it and we are not in it, arm the retry** —
  re-evaluated every time, with no memory of how many times it has happened.
  **Mine**, and the point is not tidiness: with no "ever entered" concept there
  is nothing for a future guard clause to be written against, so the bug cannot
  be reintroduced in the same shape.
- **"Deliberately" is defined by entry 62, not re-decided here** → the retry
  listens on the picture rather than on `window`, so a person who left to use
  the address bar is not dragged back. That is what lets `wantFullscreen` stay
  true without becoming a nag, and it is why these two entries are one change.
- **The invariant the probe must assert instead** → a cycle: enter, lose, tap,
  re-enter — three times, with the stub's call count reaching 4. It is one
  loop, it fails today at the second iteration, and it is the check that would
  have caught this on the day it was written.
- **And say it on the phone** → the readout's `full <state>` field gains the
  desire and whether the retry is armed. State alone cannot distinguish "not
  fullscreen and trying" from "not fullscreen and given up", which is the
  distinction this whole entry is about.

**Lands in**
- `src/permission-gate.ts:85-92` — the flags collapse to `wantFullscreen` plus
  derived state.
- `src/permission-gate.ts:120-153` — `watchFullscreen` and
  `armFullscreenRetry` become the one rule.
- `scripts/probe-fullscreen.ts:113,143` — restate both negatives; add the
  cycle.
- `src/hud.ts:1214` — two more fields on the existing line.

**Done when** — the cycle check passes at three iterations and fails if
anything conditions arming on history again; both anti-nag checks still pass in
their restated form; and `grep -c fsEverEntered src/` is 0.
**Verify** — the probe carries this one, deliberately: it is deterministic
given a stubbed `requestFullscreen`, and the docstring already explains why a
browser here cannot answer it. The phone confirms the behaviour once, via entry
62's own Verify; the probe is what keeps it true afterwards.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 67. The menu opens on the second touch, and has a way in that cannot be missed
`status: done` · added 2026-08-30 · shipped at build 222

**Build note** — `resolveTap` became `resolveTapDown`, called from the
`down` branch of `dispatchTouches`'s events loop instead of `up`, with
`TAP_RESOLVE_MS` raised to 400 and measured from the first tap's own down.
`PendingTap` gained `pointerId`: since resolution now starts before it is
knowable whether a contact will end as a clean tap or a drag, the
`TAP_SLOP_PX` check moved to that same contact's later `up`, where a new
`cancelPendingTap(pointerId)` removes the entry its own `down` may have
started rather than letting a save fire for a completed drag. A `cancel`
event (pointercancel/lostpointercapture) cancels the same way — a real gap
the old up-triggered model never had, since nothing existed to leave
dangling before a contact's release was the only thing that mattered. The
two-finger tap is recognised in the same `down` branch: `nonChipDown`,
counted once from the existing `touchField.sample(now)` pass, hits exactly
2 the instant a second finger lands while a first is still down, which
opens the panel immediately and skips creating a pending single for that
second contact.

**Deviated from the entry's own "Lands in"**: it names
`scripts/probe-touch-stream.ts` for the two new checks, but that file tests
`engine/touch.ts`'s touch→atmosphere envelope — an unrelated pure module
with no tap-resolution logic in it. **Mine**: added `scripts/probe-tap.ts`
instead, a fresh file named for what it actually tests, following
`probe-nudge.ts`'s own established precedent for exactly this situation —
a plain re-implementation of the state machine "kept in lockstep with
main.ts by eye" — since `resolveTapDown`'s logic lives inline in `main()`'s
closure and main.ts cannot be imported into a Node script (it reaches for
`document` at module load). New `pnpm probe:tap` script in package.json.
Nine checks: the entry's own human-timing figure (down 0, up 90, down 240
opens); the bounded negative restated per entry 66's own naming rule ("a
lone tap does not open the panel *within its window*", checked one
millisecond before the window closes, then again as it closes and commits);
a second tap arriving after the window does not retroactively open
anything; a second tap inside the window but outside the 30px radius stays
independently pending rather than pairing; and a cancelled contact never
saves. All nine pass.

`pnpm probe:touches` and `pnpm probe:touch-stream` both rerun clean and
unchanged — neither this entry nor its fix touches `engine/touches.ts` or
`engine/touch.ts` themselves, only how `main.ts` reads their output.

Not verified live end-to-end: the actual double tap, drag-cancels-a-pending-
save, and two-finger-open behaviours all live inside `dispatchTouches`,
which only runs after `waitForStart()` resolves — gated behind the live
microphone permission prompt this harness cannot complete, the same limit
disclosed in entries 60–62's build notes. What was verified instead is the
extracted state machine (`probe-tap.ts`, against the exact same constants
and logic shape as the real code) and, by code reading, that the wiring
into the real event loop matches it: the same guard order (`onChip`,
`hudOpen`, `gateShowing`) the old up-based dispatch used, moved to gate the
new down-based one instead.

**Do** — recognise the double on the second tap's *down* rather than its up,
widen the window to 400ms measured from the first tap's down, and add a
two-finger tap as a second way in.

**Why** — the menu is genuinely harder to reach than it was, and it is one
gesture away from being unreachable at all.

**Decided**
- **When it was lost, and to what** → build 186, entry 52. Before it, the menu
  opened on a single tap in the middle third: a zero-delay gesture with a
  target a third of the screen high. After it, the menu needs a double tap
  landing inside 30px and inside 280ms. That trade was right — entry 52's
  reasoning about a zero-delay opener always winning the race against a second
  tap still holds — but the replacement was tuned optimistically and nothing
  measured whether a hand can actually land it.
- **The window is measured from the wrong edge.** `resolveTap` is called on
  `up`, so the 280ms runs from the first tap's *release* to the second tap's
  *release* — which means **the second tap's own contact duration is spent out
  of the budget**. A deliberate double with 120ms contacts and a 200ms gap is
  320ms up-to-up and fails, saving two screenshots instead of opening
  anything. Nobody's idea of "how fast did I tap" includes how long their
  finger rested on the glass. Every platform measures this down-to-down for
  exactly that reason.
- **So recognise it on the second `down`, not its up.** **Mine**, and it is
  strictly better on three counts: the second contact's duration leaves the
  budget entirely, the second tap's `TAP_SLOP_PX` check stops applying to a
  gesture that has not finished moving yet, and the menu appears the instant
  the finger lands rather than after it lifts — which is what "responsive"
  means here. This is also what Android's own `onDoubleTap` does.
- **400ms, still one number.** Entry 52's "the same wait looked at from either
  end of it" is right and survives: the single commits 400ms after the first
  *down*, and a second down inside that same 400ms opens the panel. Android's
  double-tap timeout is 300ms down-to-down and its slop is far wider than
  30px; 400 buys back the frame-quantisation this design adds on both ends
  (`dispatchTouches` drains once per rendered frame) without reaching the
  ~500ms where two deliberate separate taps start pairing. **Mine** as to the
  value. The save it delays is the one thing in the app that can tolerate a
  delay, which was entry 52's own argument.
- **`DOUBLE_TAP_RADIUS_PX` stays 30.** It is measured between two taps, not
  within one, and it is not what is failing.
- **A second way in, because one path is how the last three of these
  happened.** `hud.ts:408` is `.hud-scrim:not(.open) .hud-chip { pointer-events:
  none }` — **every chip is inert while the panel is closed**, so the double
  tap is not the main way to the menu, it is the *only* way. That is the same
  shape as entry 66's fullscreen: a single fragile path with no alternative and
  nothing asserting it still works. **A two-finger tap opens the menu too.**
  **Mine**: it cannot be confused with play (entry 50 is one contact), it
  cannot happen by accident with a thumb, and it costs nothing to hold in
  reserve. It is a safety net, not a taught gesture, and it does not need to be
  discoverable to be worth having.
- **Not a long press**, which is the obvious alternative → entry 57's emitter
  charges over 2.5s from the moment a contact begins, so any hold-to-open
  threshold sits inside the charge and would make the two gestures fight.
- **Assert it at human timing.** `probe-touch-stream.ts` should drive a
  synthetic double at figures a hand actually produces — down 0, up 90, down
  240 — and require the panel to open; today nothing anywhere asserts the
  menu can be opened at all. Per entry 66's rule, the paired negative gets its
  bound stated: **"a lone tap does not open the panel *within its window*"**,
  not "does not open the panel".

**Lands in**
- `src/main.ts:990-1030` — `resolveTap` takes the down point and time; the
  match runs from the `down` branch of the event loop rather than `up`.
- `src/main.ts:1041` — `dispatchTouches`, where the two-finger case is
  recognised.
- `scripts/probe-touch-stream.ts` — the two checks above.

**Done when** — a double tap at 240ms down-to-down opens the menu every time,
including when each contact rests 120ms on the glass; a single tap still saves,
400ms later; two fingers open the menu regardless of timing; and ten taps in
five seconds still save no more than seven frames, which entry 52 already
requires and this must not break.
**Verify** — the probe for the timing, then the phone, which is the only place
"every time" means anything. Try it one-handed with a thumb, which is the case
that fails today.
**Hard stops** — prefs no · url no · capture no (when a save fires moves by
120ms; nothing about what is captured changes) · dependency no.

### 68. Day mode uses the whole range, in colour
`status: done` · added 2026-08-30 · shipped at build 229 · supersedes 64

**Build note** — the shipped shader deviates from this entry's own literal
formula, deliberately, after finding it does not achieve what the entry
itself asks for. The sequence, honestly:

1. Implemented the entry's literal algebra verbatim: `density = max(col.rgb)`,
   `mix(paperColour, col * INK, density)`, PAPER=0.88, INK=0.10, warmth ±0.10,
   the two-schedule ink-leads-paper crossfade carried over from entry 64
   unchanged. Built `probe-composite.ts`'s day-mode section against it —
   contrast reached ~76% of night's (clears the 70% floor) but saturation
   reached only ~16% (badly fails it).
2. Confirmed this isn't a synthetic-data artifact: loaded the real dev
   server with `?rgb=100,20,20` (a pinned, fully saturated red, bypassing
   entry 60's gate-roll) and `atmAlpha:0`/`geoAlpha:1` (the geometric ring
   fully isolated, no atmosphere blended in at all — the exact bimodal case
   entry 64's original formula was built for and worked well on). The ring
   rendered as **plain grey**, not dark red. Screenshot-confirmed, not
   inferred from the numbers alone.
3. Diagnosed why: mixing a dark ink colour with a much lighter, near-neutral
   paper (0.88) lets the paper's absolute brightness dominate the channel
   *sums* at almost any non-trivial mix weight, even while barely touching
   the channel *differences* that carry hue — so saturation (which is
   essentially difference/sum) collapses long before the mix looks
   "mostly ink" by eye. This is exactly why entry 64's original, geometry-
   only version worked: line art is bimodal (a pixel is essentially all-ink
   or all-background, rarely between), so the damaging middle ground barely
   exists. A smoothly graded field — the atmosphere, i.e. the exact content
   this entry exists to fix — has no such gap.
4. Tried two more RGB-space variants before concluding the formula shape
   itself was the problem: steepening the density mix weight with a power
   curve, and tinting the paper faintly with the content's own hue. Both
   only traded contrast against saturation along the same curve — never
   both floors at once — confirmed by scanning multiple parameter values
   for each, not a single try.
5. **Stopped and asked Victor before redesigning**, since fixing this
   properly meant deviating from the entry's own specified algebra rather
   than tuning a number it already licensed me to tune. Given the choice of
   shipping the literal (visibly broken) formula, shipping it with the
   defect flagged as open, or implementing a fix, Victor chose the fix.
6. Implemented in HSL rather than RGB: `rgb2hsl`/`hsl2rgb` added to
   `composite.frag.glsl`. Hue is read once and carried through untouched;
   *lightness* crossfades toward 0.10 (ink) or 0.88 (paper) by density, on
   the same two-schedule (`inkAmt` via smoothstep, `paperAmt` linear)
   carried over from entry 64; *saturation* only fades toward
   `hsl.s * density` (the paper's own zero saturation, weighted by how much
   of this pixel is "empty") as `dayAmt = max(inkAmt, paperAmt)` — how far
   day mode has progressed overall — actually rises, rather than as an
   unconditional function of density alone, which is what broke identity at
   `uDay = 0` in the first version of this fix (caught before shipping: a
   dim, saturated pixel's saturation was getting scaled by its own density
   even at night, when nothing should move at all). Warmth is applied as a
   direct RGB bias on the paper end only, scaled by `paperAmt * (1 - density)`
   — HSL has no natural small-bias axis for it, and the ground is the one
   place a warmth tint needs to show, since a fully-inked pixel already
   carries its own hue.
7. Re-verified everything after the fix: `probe-composite.ts`'s contrast
   and saturation checks now both genuinely pass (0.78 and 0.77 of night's,
   both hard assertions, not diagnostics) against the same synthetic field
   that failed before; two new checks assert the specific failure found in
   step 2 directly (an isolated red ring stays saturated and red-dominant
   when inked); the identity-at-`uDay=0` check (now routed through a full
   HSL round-trip rather than skipped) passes for arbitrary colour, warmth
   and camera mix; the ink-leads-paper schedule fact from entry 64 is
   unchanged and still holds. Re-ran the exact live browser test from step 2
   — the same pinned red ring now renders as visibly dark red/maroon ink on
   light paper, not grey.

`pnpm build`, `pnpm lint`, `pnpm probe:composite` all clean; the shader
itself was confirmed to actually *compile* (not just type-check — GLSL
embedded in a template string is invisible to `tsc`/`eslint`) via a live
dev-server load with no console errors.

Judgment calls, all disclosed above and confirmed with Victor before
shipping: the HSL restructure itself (a deviation from the entry's literal
formula, not a numeric tune); the exact `dayAmt = max(inkAmt, paperAmt)`
saturation gate (**Mine**, needed to keep identity at night); and the
warmth bias staying in RGB space rather than being ported into HSL
(**Mine**, since it is a small, ground-only effect with no natural HSL
axis to live on).

Not independently re-verified: the entry's own real-capture measurement
table (four specific saved frames) — this session has no access to those
original files, only the numbers already in the entry's own text, and no
phone to re-shoot the four views on. The entry's own Verify line already
reserves that as the final word ("a phone outdoors, which is still the
only judge"); this build note's live checks are the closest available
substitute, not a replacement for it.

Also worth recording: while this was in flight, the concurrent session
filed docs/todo.md entry "colour is chosen as a hue, and survives the
composite", explicitly scoped as *"a second cause, separate from entry
68"* — a genuine, distinct problem (how `shuffled()` samples stored
colours in the first place, independent-per-channel, clustering near grey
before day mode ever touches the result) rather than an overlap with this
entry's own fix. No collision; left alone for its own build.

**Do** — replace the screen-onto-a-light-ground with the ink model from entry
64, applied to the **whole** picture rather than the geometric layer alone, and
hold it to a measured contrast and saturation floor.

**Why** — day mode is washed out and colourless. Not a little: measurably, on
frames the app saved itself.

**Decided**
- **The measurement, so this stops being a matter of taste.** Four day-mode
  captures, sampled over the middle 74% of the frame:

  | frame | mean L | p5 | p95 | contrast | mean sat |
  |---|---|---|---|---|---|
  | 57826de4 | 0.716 | 0.615 | 0.766 | 0.151 | 0.098 |
  | 5c82d26c | 0.683 | 0.609 | 0.757 | 0.148 | 0.147 |
  | e1a0829f | 0.726 | 0.639 | 0.770 | 0.131 | 0.103 |
  | 02dfa387 | 0.690 | 0.606 | 0.763 | 0.157 | 0.095 |

  **The picture occupies 13-16% of the available tonal range and is about 90%
  desaturated**, and `p5` never drops below 0.606 — nothing in any frame is
  darker than the ground. "Anaemic" is the correct word and these are its
  numbers.
- **Why it is far worse than entry 47 expected, and the diagnosis is precise.**
  Screen is `a + b − ab`, which lifts *bright* content nearly as much as dark:
  a mid-bright field at 0.5 screened onto 0.6 lands at 0.80. Entry 47 reasoned
  from "these pictures are mostly pure black, thin bright rings on an empty
  field" — and that is an exact description of the **geometric** layer and a
  wrong one for the **atmospheric** layer, which is a broad mid-bright field
  with no empty ground at all. A fix derived from one layer's histogram was
  applied to the composite of both. The screenshots are all atmospheric views,
  which is why they are the worst case.
- **Screening toward neutral is also what killed the colour.** Adding roughly
  0.6 to every channel takes (0.1, 0.2, 0.5) to (0.64, 0.68, 0.80): saturation
  falls from 0.80 to 0.20. The measured 0.04-0.15 is that, not a palette
  problem, and no amount of choosing better colours upstream can survive it.
- **So entry 64's model, whole-frame.** Ink density from the picture's own
  brightness, ink hue from its own chroma, laid on paper:
  `mix(paper, chroma * INK, density)`. Entry 64's exclusion of the atmosphere
  was decided on judgement — "a field made subtractive becomes a duotone print"
  — and the measurement overturns it: a duotone print is a far better outcome
  than a 15%-range wash, and it is what the geometric half was already getting.
  **This is the only thing 68 changes about 64**; everything else there,
  including the ink leading the paper through dawn, is carried over unchanged.
- **Paper rises to 0.88 and ink floors at 0.10.** That is a range of 0.78
  against night's ~1.0, where today's is 0.15. **Mine** — with a subtractive
  operator the paper can be near-white *because* the ink can reach dark, which
  is exactly the trade a screen cannot make.
- **The ground colour has to work harder now.** Entry 53's ±0.06 warmth was
  set against a ground that was one contributor among many; it is now the
  dominant surface of the whole frame, and ±6% on the largest area on screen is
  invisible. Widen it to ±0.10 in the day path. **Mine**, and it is a
  consequence of this entry rather than a revision of 53's reasoning.
- **The floors are the acceptance test, not adjectives.** A day frame must
  reach **at least 70% of the tonal range and 70% of the mean saturation** that
  the same scene reaches at night. Those two numbers are checkable offline on a
  rendered frame, they are what "anaemic" means quantitatively, and without
  them the next tuning pass is another round of looking at it and guessing —
  which is what produced this.

**Lands in**
- `src/shaders/composite.frag.glsl:175-187` — the ground line becomes the ink
  step, for the whole `col` rather than a layer of it.
- `scripts/probe-composite.ts` — the range-and-saturation floors, at
  `uDay = 0` and `uDay = 1`, plus entry 64's dawn sweep.

**Done when** — a day-mode frame of an atmospheric view measures contrast
≥ 0.70 and mean saturation ≥ 0.70 of the same view at night; `p5` sits near the
ink floor rather than near the paper; `uDay = 0` is bit-identical to today; and
the four frames above, re-shot, no longer look like fog.
**Verify** — re-shoot the same four views in day mode and run the same
measurement; the numbers in the table are the before, and they are reproducible
by anyone. Then a phone outdoors, which is still the only judge of whether 0.88
and 0.10 are the right pair.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 69. The name is the dedication, and nothing is added to it
`status: done` · added 2026-08-30 · shipped at build 231

**Build note** — exactly the entry's own size: an HTML comment above the
`<h1>` in `index.html` stating the name is deliberately wordless and that
nothing further is to be added, and a one-line answer appended to entry
63's own "Not decided here" note closing the open question. No visible
change, no code logic — `pnpm build`/`pnpm lint` clean, and there is
nothing else to run, per the entry's own Verify line.

**Do** — put the reason for the name beside the name, in `index.html`, and
close the question entry 63 left open.

**Why** — entry 63 shipped `kiyo · plays` at build 219 and deliberately left
"whether kiyo appears anywhere else, in a dedication or a byline" undecided.
Victor has now decided it: **wordless, on the gate, the name carries it.** An
open question left open is an invitation, and the next person to read that
entry would answer it by adding a line.

**Decided**
- **Nothing is added. No "for Kiyo", no byline, no README section, no release
  name.** Victor's call, made against the alternatives rather than by default:
  the piece is named after him and that is the whole statement. Anyone who
  needs to know, knows; a stranger opening the link finds a toy with a name.
- **So this entry is a comment and a status change**, not a feature. That is
  the correct size for it. The comment belongs at `index.html:563`, beside the
  `<h1>`, in the same voice every other decision in this file is recorded in —
  what it is, and what was decided against. This repo's house rule is that
  comments carry the reasoning, and there is no reasoning anywhere on screen or
  in the source for why the piece is called what it is.
- **Say that it is deliberately wordless**, explicitly, because the failure
  mode is specific: a future session reading a bare wordmark sees an omission
  and fixes it. The comment has to say the absence is the decision.
- Nothing is built for the co-creation either → also Victor's call. The naming
  is the act; there is no gallery, no kept frames, no seed exchange. Entry 63's
  own screenshot prefix already carries his name into every picture anyone
  makes with it, which needed no entry and remains the only place the name
  travels on its own.
- Deliberately **not** recorded in the gate's visible text, the README's prose,
  or a release name — each was offered and each was declined. Listing them here
  is the point: it is what stops the same three ideas being re-proposed as
  novel.

**Lands in**
- `index.html:563` — a comment above the `<h1>`.
- `docs/todo.md` — entry 63's "Not decided here" note, which this answers.

**Done when** — the source says why the piece is called `kiyo · plays` and that
nothing further is to be added, and no open question about the name remains in
this file.
**Verify** — reading it. There is nothing to run.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 70. Colour is chosen as a hue, and survives the composite
`status: done` · added 2026-08-30 · shipped at build 234 · build after 68

**Build note** — `main.ts`'s `channel()`/`colour()`/`nudgeChannel()` are gone;
`hueToColour(h, s)` (HSV with `v` pinned at 1) and its inverse
`colourToHueSat()` replace them. A fresh roll (`SHUFFLE_RESEED` and above)
is `hueToColour(random hue, 0.55-1.0 saturation)`; the below-`SHUFFLE_RESEED`
nudge converts the current colour back to hue/saturation, nudges each
(`NUDGE_HUE_DEG=20`, `NUDGE_SATURATION=0.08`, both **Mine** — the entry
names the floors, not a nudge size), clamps saturation to the same
`[0.55, 1]` a fresh roll lives in, wraps hue mod 360, and converts back.
`floorDominant`/`SHUFFLE_MIN_DOMINANT_CHANNEL` are deleted outright rather
than kept as dead code: the new roll guarantees the dominant channel is
exactly 1 by construction, at every step, so the floor they enforced can
never fire again — confirmed, not assumed, by `probe:nudge`'s 200k-step
walks (see below).

The vibrance stage lives in `composite.frag.glsl`, right after `col` is
computed and before the `uCameraMix` block — entry's own placement,
verified to matter: after the camera mix would repaint a real photograph
with borrowed saturation. `boost = 1.0 * (1.0 - sat)` (VIBRANCE=1.0, **Mine**)
scales the pull away from the pixel's own grey average, so a thin-colour
pixel lifts hard and an already-vivid one is left close to untouched.

`scripts/probe-nudge.ts` rewritten to match: the two dominant-channel
checks became "stays exactly 1" (a guarantee, not a floor) and a new
saturation-floor check; the settling-brightness check's own target moved
from 0.25 (0.5 alpha × 0.5 old channel floor) to 0.5 (0.5 alpha × the new,
always-1 dominant channel) — the arithmetic changed along with the model,
not just the assertion. All ten checks pass, from both a dim and a bright
seed.

`scripts/probe-composite.ts` gained the saturation floor as a simulation:
the new sampler feeding the real `composite()` line already in this file
(screen, the default merge for both geo-over-atmosphere and
atmosphere-over-camera), across a spread of alphas and per-pixel
intensities, then vibrance applied. Mean saturation 0.77, p95 1.00 — both
comfortably clear the entry's 0.30/0.60 floors. Worth recording honestly:
in this simulation, **the sampler fix alone (vibrance at zero) already
clears both floors** (asserted directly as its own check) — matching the
entry's own "this is the whole fix for cause one and two" framing, and
meaning vibrance is a genuine addition for the residual screen-desaturation
cause, not the only thing standing between this entry and its acceptance
test. Also added: an algebraic check that screening a real photograph onto
black (`col` = 0, the camera-only case) leaves the photograph's own colour
untouched, which is what the vibrance-before-camera-mix placement actually
buys.

Verified live against the real dev server: the shader compiles with no
console errors (embedded GLSL is invisible to `tsc`/`eslint`, same caveat
as entry 68), and two page loads (a fresh `localStorage`, no `?rgb`, so the
gate's own entry-60 roll picks the colour) each produced a clearly tinted,
non-grey picture — a vivid dark red on one load, a muted salmon on the
next — genuine variety, neither washed toward grey.

Not verified: a re-shoot of the entry's own four measured frames (this
session has no access to the original files, and this is a synthetic
simulation standing in for real render statistics, per this file's own
established docstring on why). The camera-untouched claim is verified
algebraically (vibrance's function signature never receives `cam`) rather
than by an actual passthrough session, since this harness cannot grant
camera permission any more than it can grant the microphone.

**Do** — roll colour as a hue at high saturation instead of three independent
channel gains, drop the floor that makes a pure channel impossible, and add a
vibrance stage before the camera mix.

**Why** — the picture is grey-ish in every view, in day *and* night, with the
camera up and down. Entry 68 fixes the daylight wash; this is the separate
reason colour is thin underneath it.

**Decided**
- **The measurement, four fresh frames** (middle 82%):

  | frame | mean L | contrast | mean sat | p95 sat | mean RGB |
  |---|---|---|---|---|---|
  | b7d4df77 | 0.578 | 0.273 | 0.096 | 0.151 | (0.56, 0.58, 0.56) |
  | 44dfb7bf | 0.455 | 0.157 | 0.122 | 0.230 | (0.46, 0.46, 0.41) |
  | 696e0c20 | 0.368 | 0.138 | 0.253 | 0.364 | (0.33, 0.39, 0.29) |
  | 3bdfa551 | 0.368 | 0.138 | 0.249 | 0.360 | (0.33, 0.39, 0.29) |

  Mean RGB is near-neutral in all four — the channels sit within 0.06 of each
  other. **Even the most colourful pixels (p95) only reach 0.15-0.36
  saturation.** These are *not* the pale frames from entry 68: mean luminance
  is 0.37-0.58, so this is thin colour, not a light ground, and it is a second
  cause that entry 68 does not touch.
- **Three things compound, and the first is the one nobody would guess.**
  `main.ts:336` is `const channel = () => 0.2 + Math.random() * 0.8`, drawn
  independently per channel. **Sampling r, g and b independently clusters
  around the grey diagonal** — the three values land near each other far more
  often than far apart, and near each other *is* grey. A colour picked this way
  is a random point in a cube, and most of a cube is not colourful.
- **The 0.2 floor makes a pure hue unreachable by construction.** With the
  smallest channel never below 0.2 and the largest at most 1, saturation is
  capped at 0.8 and averages about 0.5 — before any blending. `geo-colour.ts`'s
  own docstring names "a channel at zero is a genuine channel kill" as a
  *feature* of this model; the sampler is what never uses it.
- **Screen desaturates, and the composite screens twice.** `screen` is the
  default for geo-over-atmosphere *and* atmosphere-over-camera
  (`merge-modes.ts:26,36`), and `a + b − ab` pulls toward white, which pulls
  toward grey. So a colour that starts at 0.5 saturation arrives well under it,
  which is the gap between the 0.5 the sampler can manage and the 0.15-0.36
  measured.
- **So roll a hue, not three gains.** Pick a hue uniformly on the circle and a
  saturation in **0.55-1.0**, convert to the same three gains, keep the largest
  channel at 1 so brightness does not fall as saturation rises. **Mine.** This
  is the whole fix for cause one and two, and note what it does *not* change:
  `GeoColour` is still three numbers with the same meaning, `rgb=100,30,40`
  still says exactly what it said, and every stored pref and shared link is
  untouched. Only what the shuffle *chooses* changes.
- **Brightness and saturation are coupled in this model, which is the deeper
  point.** Gains can only ever remove light, so a saturated red must be
  `(1, 0, 0)` — a third of white's luminance. Keeping the max channel pinned at
  1 is what stops "more colourful" from meaning "darker", and it is why this
  cannot be fixed by picking nicer numbers by hand.
- **A vibrance stage, applied to the picture and not the room** → after the two
  layers combine and **before** the camera composite, so the visualiser gains
  colour and a real photograph of grass does not. Vibrance rather than flat
  saturation: scale by how unsaturated a pixel already is, so thin colour lifts
  and anything already vivid is left alone. **Mine**, and the seam matters —
  after the camera mix it would repaint the room.
- **`DEFAULT_GEO_COLOUR` stays white.** Deliberate, per `geo-colour.ts`: the
  geometry is kept out of the atmosphere's hue range so the layers do not fight.
  With the director always on (entry 45) the rolled colour is what anyone
  actually sees, so fixing the sampler fixes the experience without disturbing
  a decision that was made for a reason.
- **Not taken: renormalising the stored gains** so `(0.5, 0.1, 0.1)` reads as
  bright red rather than dim red. It is the tidier model and it is a **Hard
  Stop** — it changes the meaning of every stored pref and every shared `rgb=`
  link, silently. Raised here so it is on the record as considered and
  declined, not overlooked. If it is ever wanted it needs Victor's call and a
  migration, not a quiet reinterpretation.

**Lands in**
- `src/main.ts:335-370` — `channel()`/`colour()`/`nudgeChannel()` become a
  hue-and-saturation roll; the 0.2 clamp goes with them.
- `src/shaders/composite.frag.glsl` — the vibrance step, before the
  `uCameraMix` block.
- `scripts/probe-composite.ts` — the saturation floor.

**Done when** — a rolled colour has saturation ≥ 0.55 before blending; a
rendered night frame measures **mean saturation ≥ 0.30 and p95 ≥ 0.60**,
against the 0.10-0.25 and 0.15-0.36 above; the camera passthrough is
unchanged pixel-for-pixel at the same `uCameraMix`; and no stored pref or
`rgb=` link renders differently than it does today.
**Verify** — re-shoot these same four views and re-run the measurement; the
table above is the before. The camera claim is the one to check by hand, since
"the room is untouched" is the thing a vibrance stage most easily breaks.
**Hard stops** — prefs no (the shape *and* the meaning are unchanged; only the
sampler and a render-time stage move) · url no · capture no · dependency no.

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

### 72. Camera mode: the room becomes the picture, and a tap is the shutter
`status: done` · added 2026-08-30 · shipped at build 242

**Build note** — `main.ts` gained `cameraMode`/`preCameraMix` state and
`enterCameraMode()`/`exitCameraMode()`. Entering captures `prefs.passthrough`
(what the band was showing) before calling `applyPassthrough(0.75)` directly
— never through the HUD band's own commit path, so `prefs.passthrough`/
`panel.adopt()` are never touched, the same render-time-only seam entries
48/58/60 established. If the camera is refused (`applyPassthrough` resolves
to 0), `cameraMode` reverts to false and the glyph hides — there is nothing
to be "in camera mode" about without a camera actually showing. Exiting
restores `preCameraMix` the same direct way and hides the glyph.
`maybeRollCamera()` gained one guard line (`if (cameraMode) return`) so the
director can keep rolling views and colours while the mode is on without
ever touching the borrowed passthrough level.

`dispatchTouches`'s down-branch gained a `cameraMode` fork ahead of the
existing double-tap/two-finger dispatch: a qualifying second finger calls
`exitCameraMode()` instead of `panel.open()`; every other qualifying tap
fires `saveCapture()` + `flashShutter()` immediately, on `down`, gated only
by a 300ms rate limit (`CAMERA_SAVE_RATE_LIMIT_MS`, inverted from entry
52's 700ms per the entry's own reasoning: outside the mode that limit
guards against accidental taps, inside it every tap is deliberate) — no
`TAP_RESOLVE_MS` wait, no pending-tap bookkeeping, no drag check, because
entry 67's whole reason for that wait (learning whether a second tap is
coming to open the menu) does not exist here.

`hud.ts` gained a `shutter` chip (a shutter-button glyph, deliberately
distinct from the existing `cam` bracket-and-circle icon, which is a
different chip for a different thing — the passthrough band's own group)
and a new `close()` method on the `Hud` interface (`setOpen(false)`
exposed, alongside the existing `open()`) so the chip's own `onTap` can
close the panel directly rather than asking main.ts to call back into it —
"one tap enters the mode and closes the panel" is one gesture. The chip is
a momentary action, not a toggle: camera mode is not stored and nothing
tracks being "in" it for a pressed state to paint.

`index.html` gained `#shutter-glyph` (a thin stroked ring, 0.25 resting
opacity, DOM rather than canvas so `requestCapture`'s canvas read can never
include it — the same reasoning `#capture-flash` already established) and
its `shutter-pulse` keyframe (scale 1 → 0.85 at 40% → 1, 180ms, matching
the entry's own numbers exactly), triggered via the same reflow-restart
trick `flashShake`'s double-tap path uses, since a keyframe animation
(unlike `flashCapture`'s transition-based flash) does not restart merely
from re-adding an already-present class.

Verified live against the real dev server: the shutter chip, tapped
through the real, mounted `createHud()` (via `hud-probe.html`), correctly
closed the open panel and called `onCameraMode()` exactly once. The glyph
exists, hidden by default, at 0.25 opacity; its animation's actual
keyframes and timing were read via `getAnimations()` and confirmed
bit-for-bit against the entry's own numbers (180ms, scale 1/0.85/1 at
0/40%/100%) — not merely assumed from the source. No console errors on
load, confirming the new markup and CSS parse cleanly.

Not verified live: `enterCameraMode()`/`exitCameraMode()`/the
`dispatchTouches` camera-mode branch themselves, all of which are closures
inside `main()` reachable only through the real chip *after* `waitForStart()`
resolves — gated behind the live microphone permission prompt this harness
cannot complete, the same limit disclosed in entries 60-71's build notes
wherever they touched post-Start code. What was verified instead: every
piece reachable without Start (the HUD wiring, the CSS/animation, the
constants and guard logic by direct code review), and no probe script,
since the entry's own Lands-in names only `main.ts`/`hud.ts`/`index.html`
and the new logic is inline dispatch branching rather than an extractable
pure function the way entry 67's tap resolver was.

**Do** — make the camera a *mode*, not a dial. One tap of the camera chip
enters it; after that every tap of the picture takes a photo. A translucent
shutter glyph sits in the centre saying so, the visualiser keeps running over
the room, and the menu cannot open until you leave.

**Why** — the camera is currently a mix band buried in the panel, which is a
setting rather than an act. Nobody holds up a phone to adjust a slider.

**Decided**
- **The shutter is instant, and that falls out of the mode rather than being
  bolted on.** Outside camera mode a single tap must wait `TAP_RESOLVE_MS`
  (entry 67: 400ms) to learn whether a second tap is coming, because a double
  opens the menu. **In camera mode the menu cannot open, so there is no second
  meaning to wait for** — the tap fires the shutter on `pointerdown`, with no
  delay at all. This is the strongest argument for the mode existing: it makes
  the app's one genuinely laggy interaction disappear exactly where lag is
  least acceptable.
- **Entering** → a camera chip on the arc. One tap enters the mode *and*
  closes the panel, so "first click puts into camera mode" is literally one
  click and you are already looking at the room. **Mine.**
- **Leaving is the two-finger tap**, the same gesture entry 67 reserved as the
  guaranteed way to the menu. **Mine**, and the symmetry is the point: two
  fingers always means *get me out of what I am in*. In camera mode it exits to
  the normal picture rather than opening the panel, which keeps "the menu never
  opens in this mode" literally true while never stranding anyone. A mode with
  no exit is how the fullscreen and menu bugs both happened; this one gets its
  exit decided in the same entry that creates it.
- **The mix is a render-time override, never a stored write** — the seam
  entries 48, 58 and 60 established. Entering raises passthrough to **0.75**:
  the room is plainly the subject, the visualiser is plainly still on top of it.
  Leaving restores whatever the band was set to, so the mode borrows the dial
  and gives it back. **Mine** as to 0.75.
- **The glyph, and this is the "cool" part being spent deliberately in one
  place** → a thin aperture ring, centred, `currentColor` in the same `ICONS`
  vocabulary as every other glyph, resting at **0.25 opacity** so it reads as a
  viewfinder mark rather than a button. On a shutter it **contracts to 0.85
  scale and blooms back over 180ms** — the one mechanical gesture a camera
  makes — and then the existing `#capture-flash` fires unchanged. No shutter
  sound, no border flash, no vignette: the restraint is what makes the one
  movement read.
- **The glyph is never in the photo, and this needs no work** →
  `requestCapture` reads the WebGL canvas, and both the glyph and
  `#capture-flash` are DOM. Worth stating because entries 50 and 52 decided the
  *opposite* for the touch ring ("it is picture, not UI") and a builder
  reasoning from those would try to include this one.
- **The animation is untouched**, as asked: no pause, no freeze-frame preview,
  no dimming. The photo is of the live composite exactly as seen, which is what
  every capture in this app has always been.
- **Rate limit drops to 300ms** in the mode, from entry 52's 700. That limit
  exists so a flurry of accidental taps does not fill the camera roll; in
  camera mode every tap is deliberate and the constraint inverts. **Mine.**
- **The mode does not survive a reload.** **Mine**, and it is a privacy call
  rather than a convenience one: restoring it on load would open the camera
  and light the OS indicator without a gesture, which is the start gate's
  promise broken in the most visible possible way — `applyPassthrough`'s own
  comment already says exactly this about holding a stream behind a zero.
- **The director must not fight it** → entry 45 has it always on with a 30s
  ceiling, and it rolls the camera mix among other things (`CAMERA_ROLL_CHANCE`).
  While camera mode is on it may keep rolling views and colours — the picture
  should still be alive — but it must not touch passthrough. **Mine.**

**Lands in**
- `src/main.ts:908-945` — `applyPassthrough` gains the override/restore pair.
- `src/main.ts:990-1130` — the tap dispatch branches on the mode: shutter on
  `down`, no pending-tap bookkeeping, two fingers exit.
- `src/main.ts:853` — the director's camera roll skips while the mode is on.
- `src/hud.ts` — the chip; `index.html` — the glyph and its two keyframes.

**Done when** — one tap of the chip shows the room with the picture over it and
the panel gone; every tap after that saves a frame with no perceptible delay
and blooms the ring; a double tap saves two frames and does **not** open the
menu; two fingers return to the normal picture with the passthrough band back
where it was; the glyph appears in no saved PNG; and a reload comes back with
the camera off and dark.
**Verify** — the phone, pointed at something worth photographing. The delay
claim is the one to feel rather than measure: tap-to-flash should be
indistinguishable from instant, where today it is 400ms.
**Hard stops** — prefs no (the mix override is render-time; nothing stored
changes, and the mode itself is deliberately not stored) · url no · capture
**yes, and answered**: the frame is the same live composite `requestCapture`
already reads, the glyph and flash are DOM and cannot enter it, the filename
shape is unchanged, and nothing leaves the device · dependency no.

### 73. A frozen camera is reported, and the director never opens one
`status: done` · added 2026-08-30 · shipped at build 245

**Build note** — `camera.ts`'s `CameraSource` gained `isLive(): boolean`,
tracked continuously rather than checked once: `requestVideoFrameCallback`
re-registers itself on every real decoded frame (its own cadence is the
proof) where the browser has it; a `setInterval` comparing `currentTime`
every 500ms stands in where it does not. `isLive()` is
`performance.now() - lastFrameAt < 2000`. A `visibilitychange` listener
calls `video.play()` again whenever the page returns to visible and the
video is paused — nothing anywhere else in this app knew this camera
existed (`permission-gate.ts`'s and `version.ts`'s own listeners are about
fullscreen and a fresh-build dot), so without this a backgrounded tab's
own browser-level pause was never undone.

`main.ts`: `maybeRollCamera()`'s gate changed from `hasCameraPermission()`
(granted) to `cameraSource?.isLive()` (already open, already proven live)
— the actual fix, since a `devicemotion` event never carries the
activation `getUserMedia`/`play()` need, and every prior report of a
frozen camera traced to exactly this path reaching `startCamera()` two
awaits deep with no gesture behind it. `hasCameraPermission()` and
`cameraEverGranted` are deleted outright rather than kept: once raising
requires an *already-live* stream, "permission was granted" is strictly
weaker than what the check now needs, and nothing else in the codebase
read either. `applyPassthrough()` now closes and forgets a frozen
`cameraSource` before ever reusing or reporting a mix against it, so a
stream that stalled between visits does not go on masquerading as showing
something. The readout gained a `camera` field (`open`/`live`), read fresh
from `cameraSource?.isLive()` on every tick — `closed`/`frozen`/`live`,
matching entry 66's `want`/`armed` and `shake.ts`'s own `diagnostics()` in
spirit: a frozen camera and a working one are identical whenever the room
itself is still, and now the readout is what tells them apart rather than
a guess.

**Verified live, genuinely, not just algebraically** — a limitation this
session hit repeatedly with camera/microphone features (no real device
access here) was worked around by monkey-patching
`navigator.mediaDevices.getUserMedia` to hand the real, unmodified
`startCamera()` a `canvas.captureStream()` feed instead of a real camera —
matching `camera-probe.html`'s own established technique for exactly this
reason. Against the real exported function, not a stub: (1) a genuinely
redrawing canvas opened live, `isLive()` true within 300ms; (2) freezing
the canvas (stopping its own redraw loop, so `captureStream()` stops
emitting new frames — the same "advancing player, no new pixels" shape a
backgrounded real camera produces) correctly flipped `isLive()` to `false`
after the 2s timeout, while `video.paused` stayed `false` throughout — the
exact "not erroring, just not moving" case the whole entry is about; (3)
force-pausing the video element (what a real browser does on
backgrounding) and dispatching a synthetic `visibilitychange` with
`visibilityState: 'visible'` correctly resumed it (`paused` true → false).
`close()` was confirmed not to throw and to actually stop the interval/
listener it owns. `pnpm build`/`pnpm lint` both clean, and
`requestVideoFrameCallback` needed no type workaround — already in this
project's configured DOM lib.

Not verified: the actual `maybeRollCamera()`/`applyPassthrough()`
integration end-to-end (both live inside `main()`'s closure, reachable only
after `waitForStart()` resolves — the same Start-gated limit disclosed in
every entry since 60 that touched post-Start code) and the true behaviour
on a real phone camera specifically, which the entry's own Verify line
already reserves as the only real judge ("Neither is reproducible on a
desktop").

**Confirmed 2026-08-30**, reported as "coming back to browser camera is
frozen". That is the resume half below, and it is now the *primary* fault
rather than the second one — it is reproducible on demand (leave the tab or
lock the phone, come back), it needs no director and no shuffle, and it will
still be there after the auto-open half is fixed. **Build the
`visibilitychange` resume first**; the rest of this entry can follow in the
same change or a later one.

**Do** — stop swallowing the `play()` refusal, verify the video is actually
advancing, resume it when the page comes back, and forbid the auto-roll from
opening a camera it has no gesture for.

**Why** — passthrough sometimes shows one still frame forever, and most often
when the shuffle turned it on. Both halves of that sentence have a cause and
the code already names one of them.

**Decided**
- **The cause is written in the source, as an accepted cost.** `camera.ts:76`:
  `await video.play().catch(() => {})`, whose comment says *"The texture will
  simply hold the first frame; that is a poor passthrough rather than a failed
  one, and not worth refusing over."* **The frozen picture is that first
  frame.** The judgement was defensible when the only way to reach it was
  tapping a control; it stopped being defensible when the director could reach
  it too.
- **Why the auto path always hits it** → `maybeRollCamera` (`main.ts:851`)
  runs `await hasCameraPermission()` and then `await applyPassthrough(level)`,
  so `startCamera()` is two awaits deep in an async chain — any user activation
  has long expired. And the chain begins at a **shake**, which is a
  `devicemotion` event and was never an activation-triggering gesture in the
  first place. So on the auto path `play()` is refused essentially always, and
  the catch hides it. "Especially on auto select" is not a coincidence; it is
  the only path that reliably reproduces it.
- **So the director never opens a camera.** It may still turn passthrough
  *down*, and it may raise it when a stream is **already open and playing** —
  but a closed camera stays closed. **Mine**, and it is the same conclusion
  entry 72 reached from the other direction: an autonomous process opening a
  camera is not a thing this app should be able to do, regardless of whether
  the permission was granted earlier.
- **A second, independent freeze that hits even a properly-started camera** →
  nothing anywhere resumes the video. Browsers pause a video element when the
  page is hidden; the phone locks, or you switch apps, and on return the
  texture holds the last frame with no error of any kind. `visibilitychange` is
  listened for in `permission-gate.ts` and `version.ts` and neither knows the
  camera exists. Add a resume: on return to visible, `play()` again if
  `video.paused`. This is the "sometimes" that has nothing to do with the
  director.
- **Verify it is running rather than trusting `play()`.** A resolved `play()`
  is not proof of frames, exactly as entry 62 found a resolved
  `requestFullscreen` is not proof of fullscreen. Watch `video.currentTime`
  advance across a short window — or `requestVideoFrameCallback` where it
  exists, falling back to `currentTime` where it does not — and expose the
  answer on `CameraSource`.
- **Report it, because a frozen camera and a working one are identical when
  the room is still.** The readout gains the camera's state beside the
  fullscreen and motion fields it already carries. Same argument as
  `shake.ts`'s `diagnostics()` and entry 66's `want`/`armed`: this app's
  recurring failure is not that things break, it is that two different breakages
  present as one sentence.
- **A frozen stream is closed, not kept.** If the video never advances, release
  it and report 0 rather than holding a powered sensor and a lit OS indicator
  to show a still photograph — `applyPassthrough`'s own comment makes exactly
  this argument about holding a stream behind a zero mix.

**Lands in**
- `src/camera.ts:76-92` — the refusal stops being swallowed; `CameraSource`
  gains a liveness flag and a resume.
- `src/main.ts:851-860` — the auto-roll requires an already-playing stream.
- `src/main.ts:920-945` — `applyPassthrough` releases a stream that never ran.
- `src/hud.ts` — the readout field.

**Done when** — a shuffle deep enough to roll the camera never opens one that
was closed; locking the phone and returning shows live video again, not the
last frame; a refused `play()` leaves passthrough at 0 with the readout saying
why, instead of a still image at the requested mix; and the OS camera
indicator is never lit while the picture is frozen.
**Verify** — the phone: lock it and come back, and separately shake hard enough
to trigger a full shuffle with the camera closed. Neither is reproducible on a
desktop, where `play()` is not refused and the page is rarely hidden.
**Hard stops** — prefs no · url no · capture **yes, and answered**: this
strictly *reduces* when the camera opens — the director loses the ability
entirely — and adds no new path to a stream · dependency no.

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

### 75. A tempo every mapping can see, and geometry that lands on the beat
`status: done` · added 2026-08-30 · started 2026-08-30 · build 247

**Do** — promote the beat tracker out of one mapping into `CommonAnalysis`,
replace its two-gap tempo test with autocorrelation over onset strength, report
BPM, and give the shaders a beat phase. Add fields; change no existing
behaviour.

**Why** — asked for. There is already a beat tracker and it is better than
nothing, but it is private to one of six mappings, it is fragile in three
known ways, and the number it computes is never shown to anyone or to any
shader.

**Decided**
- **What already exists, because none of it should be thrown away.**
  `beatMapping()` (`fast.ts:549`) tracks inter-onset intervals: an onset when
  `transient` crosses 0.5, a lock when two consecutive gaps agree within 15%,
  `interval` smoothed 50/50, phase running 0→1 and reset on every onset, and a
  1.8× grace before the lock drops. The design instinct in its docstring is
  exactly right and is kept verbatim: *"a visualiser pulsing confidently at the
  wrong tempo is a legible error; one that has stopped pulsing is not."*
- **Fragility 1 — two consecutive gaps is the weakest possible estimator.**
  One missed onset gives a doubled gap, one extra hit gives a halved one, and
  either breaks the lock. Syncopation breaks it continuously. The standard
  answer, and what the literature has settled on, is **autocorrelation of the
  onset-strength signal** rather than clustering the interval list: it is
  robust precisely because it does not depend on any single onset being located
  correctly. Keep the onset detector; accumulate its strength into a rolling
  buffer and autocorrelate that.
- **Fragility 2 — octave errors, which are the known failure of every tempo
  estimator.** Peaks in an autocorrelation are harmonically related, so a
  140bpm track can lock at 70 or 280 and be internally consistent about it.
  The standard fix is to take the top few candidate lags and **score each by
  cross-correlating against an ideal pulse train**, then prefer the metrical
  level nearest a resting tempo around 120bpm. Without this step the tracker is
  right about the rhythm and wrong about the beat, which looks worse than not
  locking.
- **Fragility 3 — phase snaps to every onset.** `phase = 0` on any qualifying
  onset means a syncopated hit drags the beat off. Nudge phase toward the
  onset in proportion to how near it fell to the prediction, rather than
  snapping — the picture then keeps time *through* an off-beat instead of being
  pulled by it. A hit far from the prediction should barely move it.
- **Two smaller ones, both cheap.** The onset threshold is a fixed `0.5`, so a
  quiet source never crosses it and a loud one crosses constantly — make it a
  rolling median plus a delta, with 0.5 kept as the floor. And beat onsets
  should be weighted toward the **low band**, where the kick is, while
  `transient` keeps its broadband meaning for everything else. Add
  `beatStrength`; do not redefine `transient`.
- **Where it lives, and this is the whole "add, don't rip out" answer** → the
  tracker moves into **`CommonAnalysis`**, which all six mappings already
  construct and call. Every mapping then gains a tempo for free, **none of
  them changes what it returns**, and `beatMapping` keeps its exact behaviour
  while its private copy is deleted in favour of the shared one. Nothing is
  removed from the app; one thing is promoted.
- **Three new fields on `VisualParams`** — `beatPhase` (0→1 across a beat),
  `bpm` (0 when unlocked), `beatConfidence` (0-1, continuous). Purely additive:
  every existing consumer ignores them, and `beatConfidence` replacing a
  boolean `locked` is what lets a shader blend between beat-driven and
  energy-driven rather than switching.
- **Three new uniforms**, `uBeat`, `uBpm`, `uBeatConfidence`, beside the seven
  already there. **At `uBeatConfidence == 0` every view must render exactly as
  it does today** — the same algebraic-identity discipline entry 47 used for
  `uDay`, and the reason this can ship without re-tuning thirteen shaders.
- **One view first, then the rest.** Circles takes the beat; the other five
  geometric views follow in their own entry once it is proven on a phone
  against real music. **Mine**, and it is the same order entry 33 followed for
  touch, for the same reason: thirteen shaders re-tuned at once against a
  brand-new signal is not reviewable.
- **What "on the beat" should mean for geometry**, so it is not left to taste
  → an *event*, not a continuous drive. The bands already carry continuous
  energy and duplicating that on a beat clock gains nothing. A ring spawning on
  the beat, a rotation stepping a fixed amount, a colour advancing one notch —
  something that visibly *lands* — is what energy-driven mappings structurally
  cannot do, and it is the whole reason to have a tempo.
- **Report the BPM.** The user asked to measure it, and a tempo nobody can see
  cannot be debugged — the same argument that put `samples`/`peak` in
  `shake.ts`'s diagnostics and `want`/`armed` in entry 66. The readout gains
  `bpm` and confidence.

**Lands in**
- `src/engine/fast.ts:225-320` — `CommonAnalysis` gains the tracker;
  `:549-620` — `beatMapping` reads it instead of keeping its own.
- `src/engine/fast.ts:23-62` — the three `VisualParams` fields.
- `src/scene.ts:343-351, 876-884` — the three uniforms.
- `src/shaders/circles.frag.glsl` — the first consumer.
- `scripts/probe-mapping.ts` — the accuracy suite below.

**Done when** — against synthetic onset trains the tracker reports **120 ± 2
BPM within 4 seconds**, holds through a **missed beat** and through an
**inserted off-beat hit**, and does **not** report 60 or 240 for a 120 input —
the octave case being the one that most needs asserting because it fails
plausibly. All six mappings return byte-identical `level`/`low`/`mid`/`high` to
today for a given input. Circles is visibly on the beat with real music, and
identical to today when confidence is 0.
**Verify** — the probe carries the tracker, since it is arithmetic over a
synthetic onset signal and needs no audio. The phone carries "does it look like
it is on the beat", which no probe can answer. Test against something with a
weak or absent kick as well as a four-on-the-floor track — the honest failure
mode is that it locks beautifully to dance music and reports nothing for a
ballad, and that is acceptable only if it says so rather than guessing.
**Hard stops** — prefs no (no new mapping, no stored field; the six mapping
names are unchanged) · url no · capture no · dependency no — autocorrelation
over a small rolling buffer is a loop, not a library.

**Build note** — implemented as decided: `BeatTracker` lives inside
`CommonAnalysis` (`fast.ts`), fed by a new low-band-scoped `SpectralFlux`
instance for `beatStrength` (the existing `SpectralFlux.update()` grew
optional `loHz`/`hiHz` params rather than a new class, defaulting to full
spectrum so the broadband `transient` call site is untouched). `beatMapping`
now reads `c.bpm`/`c.beatPhase` and keeps only the `locked ? beatEnv :
fallbackLevel` shape that made it "beat-synced"; its own two-gap estimator,
and the five constants that tuned it (`BEAT_ONSET_THRESHOLD`,
`BEAT_MIN_INTERVAL`, `BEAT_MAX_INTERVAL`, `BEAT_STABILITY`,
`BEAT_LOCK_GRACE`), are deleted outright. All three `VisualParams` fields
land on all six mappings via the same trailing pass-through block every
mapping already shared for `breakdown`/`surge`/`novelty`/`roughness`.

Tracker design: onset strength resampled onto a fixed 50Hz ring buffer
(bucket = loudest sample seen in its 20ms span, not a time-weighted average —
onsets are spikes, and averaging blurs one toward invisibility against a
mostly-silent bucket), autocorrelated over a rolling 3.2s window every 0.5s.
Each autocorrelation peak is scored by a pulse-train comb search — the best
of every phase offset at that spacing — which is the octave disambiguator:
a true fundamental and its harmonics all score well under plain
autocorrelation, but only by searching every phase can a comb be found that
lines up with literally every onset rather than merely some of them. Among
candidates clearing a floor, the one nearest 120bpm wins. Phase runs
continuously at the estimated tempo (wrapping via modulo, not clamping at 1
the way the old tracker did — it is a live prediction, not a record of the
last hit) and a real onset nudges it toward 0 in proportion to how close it
already sat to a cycle boundary, per the entry's fragility-3 fix.

Three bugs found by testing before this shipped, none of them from a code
review — each surfaced by running the entry's own synthetic-onset-train
cases and finding a wrong number:
1. The confidence envelope was pushed with the frame's own `dt` (~16ms)
   instead of the ~500ms actually elapsed since the last push, so confidence
   climbed at roughly 1/30th its intended rate and never crossed the lock
   threshold inside any reasonable test window. Fixed by pushing with
   `BEAT_REFRESH_S` instead.
2. The octave tie-break first used a *relative* tolerance (a candidate had
   to score within 92% of the best). A single missed onset let a
   subharmonic's comb dodge the gap at some phase offset and score higher
   than the true fundamental's — which necessarily samples every onset,
   including the missing one — so the fundamental was wrongly excluded from
   the tie-break exactly on the entry's own "holds through a missed beat"
   case. Fixed by switching to an absolute floor (`BEAT_CANDIDATE_FLOOR`):
   a lag no longer has to be near the *best* score, only "clearly periodic
   on its own terms," which lets an imperfect-but-real fundamental compete
   even when a lucky subharmonic scores higher.
3. Random-interval (non-periodic) onsets still produced a confident,
   invented tempo — not one of the entry's own numeric Done-when cases, but
   squarely against its quoted design instinct ("one that has stopped
   pulsing is not [a legible error]") and its own Verify text ("acceptable
   only if it says so rather than guessing"). Root cause: at the slow end of
   the tempo range a 3.2s window holds as few as two comb positions, and
   searching every phase offset for the best of only two samples finds a
   spuriously perfect "period" in outright noise almost every time — a
   small-N multiple-comparisons problem, not a threshold problem. Fixed by
   requiring a phase offset to have at least `BEAT_MIN_COMB_SAMPLES` (4)
   confirming positions before its average counts for anything, which as a
   side effect means this tracker cannot confidently confirm a genuinely
   slow tempo (well under 120bpm) inside one 3.2s window — an honest
   trade-off for the window size the entry's own "within 4 seconds" figure
   requires at 120bpm, not one I'd claim covers the full 40-300bpm range
   with equal confidence at every tempo.

All numeric constants in the tracker's own timing/scoring
(`BEAT_BUCKET_S`, `BEAT_WINDOW_S`, `BEAT_REFRESH_S`, `BEAT_MIN_FILL_S`,
`BEAT_CANDIDATE_FLOOR`, `BEAT_MIN_COMB_SAMPLES`, `BEAT_MEDIAN_WINDOW`,
`BEAT_THRESHOLD_DELTA`, `BEAT_MIN_ONSET_GAP`, `BEAT_LOCK_CONFIDENCE`) are
**Mine** — the entry specifies the mechanisms, not these values. Same for
the beat-pulse ring's own shape in `circles.frag.glsl` (travels 30% of
`maxRadius`, fades linearly across that same span) — a restrained, single
extra `ring()` call reusing the existing primitive, deliberately not a
second full ripple system, since the entry itself defers exploring the
geometric language further to a future entry once this is proven on a
phone.

Verified: `pnpm build`/`pnpm lint` clean. `pnpm probe` — all thirteen checks
pass, including six new ones written directly against the entry's own
Done-when: 120±2bpm within 4s (locks by ~2s in practice), holds through one
missed beat, holds through one inserted off-beat hit, settles on 120 and
explicitly not 60 or 240, stays at bpm=0 against a flat kickless signal, and
does not invent a tempo from random-interval onsets (this last one only
after bug 3 above was found and fixed — it failed loudly before that).
Byte-identical regression for the five non-beat mappings confirmed by a
throwaway script diffing this build's output against `git show HEAD:` of the
pre-entry `fast.ts` across the headroom table, the 120bpm pattern, and the
full breakdown track — `===` on `level`/`low`/`mid`/`high` on every frame,
not just close. `beat` itself is not literally byte-identical to before —
the entry's own fragility-3 fix (nudge, not snap) necessarily changes its
behaviour on a syncopated hit, which is the point — but both of the
existing probe's `beat` checks (steady lock, noise fallback) still pass
unchanged. Live in a real WebGL context (`createVisualiser` via dynamic
import, same technique entries 71/73 used): rendered `circles` twice at
`beatConfidence=0` with different `beatPhase` values and got pixel-identical
readback both times, then rendered again at `beatConfidence=0.9` and got a
visibly different, phase-dependent result — the algebraic identity holds,
verified rather than merely reasoned about. `hud-probe.html`'s real,
mounted HUD confirmed the new readout line renders correctly both locked
(`beat  ###...  0.85  120 bpm`) and unlocked (`beat  #...  0.12  —`). No
320×568/360×640 check — nothing here touches a chip or a layout surface,
only one more line inside the existing stats `<pre>`.

Not verified, and not verifiable in this harness: "Circles is visibly on
the beat with real music" is the entry's own phone-only Verify line: no
probe can answer it. Also untested against a real ballad or anything with a
weak/absent kick — the closest proxy available here is the synthetic flat
signal, which correctly reports no tempo, but a real recording's spectral
texture is not that.

### 76. The channels lag behind the phone, and snap back
`status: done · FROZEN` · added 2026-08-30 · started 2026-08-30 · build 249

**Frozen 2026-08-30, by Victor: "colour lags has good colour, freeze that for
now."** The spring and the cap shipped at build 249 as
`STIFF = 400`, `DAMP = 14` (ζ 0.35, ω 20 rad/s) and `MAX_SLIP = 0.006`, and
those four numbers are **not to be retuned** — not to make the effect stronger,
not to make it subtler, not as a side effect of touching the tumble whose
springs sit deliberately at different frequencies from these.

The reason it needs saying: this landed first time, which is rare here, and the
constants look arbitrary enough to invite adjustment. They are not arbitrary —
ζ 0.35 is what produces the visible overshoot the entry was asked for, and
0.006 uv is the ceiling past which line art reads as broken rather than
dispersed. If a future request wants the effect changed, that is a new entry
with Victor's word in it, not a tweak.

**Do** — move the picture apart into its red, green and blue when the phone
moves, and let them spring back together when it stops. Its own module, its own
spring, its own uniform — sharing nothing with the tumble or with entry 58's
colour bias.

**Why** — asked for, and it fills a real gap: every motion response the app has
so far is either a rigid-body move (the tumble) or a colour shift (entry 58).
Nothing has ever come *apart*.

**Decided**
- **A separate module, as asked.** `src/engine/rgb-slip.ts`, in the same shape
  as `motion-bias.ts`, `ripples.ts` and `emitter.ts`: pure state, one pure
  update function, no DOM and no clock of its own, so it is probeable in node.
  It shares no state with the tumble and no state with the colour bias — the
  only thing it reads is a number they also read.
- **It needs no new plumbing at all.** `main.ts` already hands the whole
  `TumbleState` to `scene.ts` via `setTumble` (`:811`, `:1364`), so the slip is
  ticked inside `render()` from `disturb` and the tumble offset that are
  already sitting there. No new sensor path, no change to `shake.ts`, no
  change to `main.ts`. **Mine**, and it is most of why this is small.
- **Its own spring, deliberately unlike the tumble's.** The tumble is heavy and
  slow — ω ≈ 12.6 and 8.9 rad/s at ζ 0.4. The slip is **fast and looser**:
  ω ≈ 20 rad/s (`STIFF` 400) at **ζ ≈ 0.35**, so it flicks apart and visibly
  overshoots on the way back rather than easing home. That is what "bounce
  back" asks for, and making it a *different* frequency from the tumble is what
  stops the two reading as one effect — the same reasoning `shake.ts` already
  applies to keeping its own two springs at different frequencies.
- **Direction comes from the tumble's offset, not from raw acceleration.**
  That offset is already a spring-driven displacement pointing where the phone
  was kicked, so the channels separate *along the direction of movement* and
  the picture reads as lagging rather than as smearing at random. **Mine**, and
  it reuses existing state instead of adding a second interpretation of the
  accelerometer — which the motion spike already warns is where two meanings of
  "tilt" start drifting apart.
- **Red leads, blue trails, green holds still** — `+offset` on red, `−offset`
  on blue, green at the true position. Green carries most of the luminance, so
  leaving it undisplaced keeps the image sharp and the fringing reads as colour
  rather than as blur. This is what a real lens does and it is the reason the
  effect is legible at a couple of pixels.
- **`MAX_SLIP = 0.006` uv**, about two to four pixels on a phone. Small on
  purpose: this is a texture-sample offset, and past a few pixels line art
  stops looking dispersed and starts looking broken — the same ceiling
  argument `shake.ts`'s `MAX_ANGLE` comment makes about the tumble.
- **Where it happens, and the cost, stated plainly** → in
  `composite.frag.glsl`, at the point the two layers are sampled. Slipping
  channels means sampling each texture three times instead of once, so this is
  **6 samples where there are 2**. It goes behind `if (uSlip > 0.0)` — a
  *uniform* branch, identical for every fragment in the draw, which is the
  cheap kind on a mobile GPU — so a still phone pays nothing and the picture is
  bit-identical to today. That identity-when-off property is the same one
  entry 47 gave `uDay` and entry 75 gives `uBeatConfidence`.
- **The room is never slipped.** The sampling happens before the `uCameraMix`
  block, so passthrough is untouched for free — consistent with entries 72 and
  73 treating the room as real rather than as material.
- **It does not mix with anything.** Entry 58 shifts colour *values* and this
  shifts sample *positions*; they are orthogonal operations at different points
  in the pipeline and can both be on with no interaction to reason about.
  Entries 68/74's ink and 70's vibrance all happen later in the tail, on the
  finished `col`. Stated because "wire it up separately" was the request and
  this is what makes it true rather than a claim.

**Lands in**
- `src/engine/rgb-slip.ts` — new.
- `src/scene.ts:418` — `uSlip` beside `uTumble`; `:1002` — ticked in `render()`
  from the state `setTumble` already stores.
- `src/shaders/composite.frag.glsl:126` — the three-offset sampling.
- `scripts/probe-rgb-slip.ts` — new, modelled on `probe-motion-bias.ts`.

**Done when** — a still phone renders bit-identically to today; a nudge visibly
separates the channels along the direction of the nudge and they overshoot once
before settling; a hard shake reaches the cap without the picture reading as
broken; camera passthrough is unaffected at any mix; and the probe shows the
spring overshooting and returning to zero from every handling case in
`probe-shake.ts`'s own table.
**Verify** — the probe for the spring, the phone for whether 0.006 and ζ 0.35
are right. Watch it against a *still* hand as well as a moving one: `disturb`
reads 0.00 for a held phone by design, so this must be genuinely invisible at
rest rather than faintly jittering, which is the failure a directional effect
driven by a noisy signal would have.
**Hard stops** — prefs no (always on, no chip; the arc is scarce and this is
not a setting) · url no · capture no (it is picture, and lands in a saved frame
exactly as the tumble does) · dependency no.

**Build note** — implemented as decided. `src/engine/rgb-slip.ts` is a pure
module in the same shape as `motion-bias.ts`: `createRgbSlipState()` /
`updateRgbSlip(state, dt, disturb)`, a single 1D underdamped spring
(`STIFF=400` → ω=20, `DAMP=14` → ζ=0.35, exactly as specified) chasing
`disturb` as a moving target, clamped to `[0, 1]` and scaled by `MAX_SLIP`
(0.006) before it is returned — the caller applies no scaling of its own.
Exported through `engine/index.ts` alongside `motion-bias.ts`, per that
barrel's own existing precedent.

**One deviation from the literal Lands-in, disclosed rather than silent**:
the entry names one new uniform, "`uSlip` beside `uTumble`", and a literal
`if (uSlip > 0.0)` branch — both of which only make sense for a scalar. The
direction half of "direction comes from the tumble's offset" is therefore
read directly from `uTumble.yz` inside `composite.frag.glsl` itself
(`normalize(uTumble.yz)`), rather than a second `uSlipDir` uniform or any
JS-side vector combination — `uTumble` already carries that offset into the
shader every frame regardless of this entry, so this is genuinely "no new
plumbing", not merely close to it. `rgb-slip.ts` itself therefore knows
nothing about direction at all, which is a stricter reading of "the only
thing it reads is a number they also read" than a version that also fed it
`offsetX`/`offsetY` would have been. **Mine**.

Also **Mine**, and disclosed for the same reason: `amount` is floored at 0
as well as capped at 1, rather than left to swing negative the way an
unclamped spring naturally would on the way back through its target. An
unclamped version would let the R/B lead briefly and slightly reverse during
the ring, which is physically what "overshoots on the way back" describes
most literally — but the entry's own `if (uSlip > 0.0)` guard only re-enables
the 6-sample branch for a *positive* value, so a negative excursion would
silently render as "no slip" at exactly the moments it should be doing the
most, the opposite of the intended effect. Flooring at 0 is what keeps the
guard meaningful. Overshoot is still real and still verified (see below) —
just never as a sign reversal.

Wiring reuses the entry's own named seam exactly: `setMotion`'s existing
`motionDisturb` closure variable (already recorded every frame for
`updateMotionBias`, entry 58) is read again for `updateRgbSlip` inside
`render()`, and the result is written straight to `compositeUniforms.uSlip`.
No new setter method, no new closure variable for direction. In
`composite.frag.glsl`, the two original `texture2D(uAtmosphere/uGeometry,
uv)` lines are now the `else` branch of `if (uSlip > 0.0)`, unchanged
character-for-character; the `if` branch samples each three times (R at
`uv+off`, G at `uv`, B at `uv-off`) — 6 samples where there were 2, exactly
as Decided states, and paid only when `uSlip` is actually nonzero since it
is a uniform branch (identical for every fragment in the draw).

Verified: `pnpm build`/`pnpm lint` clean. New `scripts/probe-rgb-slip.ts`
(`pnpm probe:rgb-slip`), modelled on `probe-motion-bias.ts`: a still phone
never produces any slip; a spring chasing a realistically-decaying disturb
signal (the same 0.7s time constant `shake.ts`'s own `Tumble.disturb` decays
at) measurably *overtakes* the target it is chasing before both settle to
zero — the genuine-overshoot signature available to a floor-clamped
magnitude, see the deviation note above for why a sign-change count was the
wrong test for this design; a sustained hard disturbance reaches the cap and
the returned uv offset never exceeds `MAX_SLIP` under any input tried. The
handling table reuses `probe-shake.ts`'s own `still()`/`shaking()` driving
functions (kept in lockstep by eye, `probe-nudge.ts`/`probe-tap.ts`'s
established precedent) through a real `Tumble` for every *distinct physical
scenario* in that file's table (still, tremor, walking, nudge, jolt,
deliberate shake, violent shake, single knock, knock+rebound, sustained low
agitation) — narrower than the full table on purpose: the omitted rows
there only vary sensor sample rate against a physical scenario already
covered, which `updateRgbSlip` cannot see the difference of since it only
ever reads `disturb`, a number already computed by the time it arrives.
Every case: never exceeds `MAX_SLIP`, settles back to (near) zero after its
own settle period. All thirteen checks pass.

Live in a real WebGL context (`createVisualiser` via dynamic import, same
technique entries 71/73/75 used), with `performance.now()` monkey-patched to
a fixed instant so the comparison isolates `uSlip`'s own effect from the
picture's ordinary time-driven motion: two renders of a genuinely still
phone (`disturb=0`, no tumble offset) at the same frozen instant are
pixel-identical; the same scene with a real tumble offset and `disturb=1`
driven for twenty frames (long enough for the spring to actually rise, since
it is a spring and not an instant assignment) renders visibly differently.
No console errors. No 320×568/360×640 check — this entry adds no chip, no
pref, no layout surface; the picture itself is the only thing that changes,
and that is exactly what the live pixel comparison above already checked.

Not independently verified: whether 0.006 and ζ=0.35 are the right *feel* on
a real phone — the entry's own Verify text names this as the phone's
question, not the probe's.

### 77. Two rings: what the wedge edits, and everything else
`status: done` · added 2026-08-30 · started 2026-08-30 · build 253

**Do** — split the icon arc in two. The four layer selectors stay on the
current arc beside the control; the four global toggles move to a second,
wider, smaller ring outside it.

**Why** — there are eight chips on an arc whose own code says it works for six,
and the two at the far end read as decoration.

**Decided**
- **Which two are "the top two", computed rather than guessed.** The arc is
  centred off-screen at the bottom-right corner and sweeps from lower-left to
  upper-right, so chip order *is* height order. At 412×915 the row lands at
  y = 673, 642, 613, 587, 563, 541, **523, 508** — the two highest are the last
  two constructed: **`day` ("Sky: auto") and `shutter` ("Camera mode")**.
- **Why they read as dead**, and it is not one reason: `day` cycles auto → day
  → night (entry 71), and one tap from auto at a mid-sky hour lands on a state
  that looks almost identical to where it started — the control works and its
  first press is invisible. `shutter` (entry 72) does nothing visible at all if
  the camera is refused or absent. Both are real behaviours with no feedback,
  and both sit at the crowded end of the row where they are least likely to be
  tried twice.
- **The arc is genuinely over capacity, and the file says so.**
  `CHIP_ARC_MIN_START`'s comment: *"Centring blindly on `CHIP_ARC_MID` works for
  up to six chips… A seventh does not append a slot, it re-centres all seven and
  pushes the leading one off the left edge."* There are now eight. The row has
  been jammed against that clamp since the seventh, so every chip added since
  has been stealing margin from the first one.
- **So the split is not only tidier, it retires the clamp.** Four chips per
  ring is under the six the clamp was invented for, so both rings centre
  honestly on `CHIP_ARC_MID` again and `CHIP_ARC_MIN_START` stops being
  load-bearing. **That is the strongest argument for this change** — it fixes
  the layout problem rather than redistributing it.
- **The division is by what a chip *does*, not by importance.** Inner ring:
  `geo`, `atm`, `cam`, `ear` — these choose what the wedge edits, so they
  belong against the wedge. Outer ring: `num`, `grav`, `day`, `shutter` — these
  toggle something about the whole app and never change what the bands mean.
  That is the same line the file already draws in `GROUPS` versus the loose
  `mkChip` calls after it; this makes it visible.
- **Smaller drawn, not smaller to hit.** Outer ring at **R 1.22** and **0.8×**
  the drawn size, with the **touch target left at full size**. **Mine**, and it
  follows the idiom already in this file — `GRAB_PX`'s own comment, *"the
  thumb-safe minimum this file is built around; the drawn tracks are far
  thinner"*. A 27px tap target on a phone is the kind of thing that makes a
  control feel broken, and "a little smaller" is about visual weight.
- **One stale thing to fix while here.** `chipPosition` is exported with a
  comment explaining that the fullscreen chip needs the same arc — and entry 42
  moved that chip to the centre of the screen. It now has exactly one caller,
  in this file. Make it local and delete the justification, rather than leaving
  a comment that documents a caller that no longer exists.
- Not decided here → whether `day` and `shutter` should announce what they did.
  Both would benefit and it is a different question (feedback, not layout); the
  numeric readout already reports the sky state for anyone with it on.

**Lands in**
- `src/hud.ts:96-140` — a second radius and size factor; `chipPosition` takes a
  ring, stops being exported, and loses the stale comment.
- `src/hud.ts:887-940` — the two groups laid out separately, each with its own
  `n`.
- `src/hud.ts:953` — the placement loop.

**Done when** — the four layer icons sit on the current arc against the wedge
and the four toggles on a visibly wider, smaller arc outside them; every chip
is still tappable at its old size; nothing is clipped at 320×568 or 360×640,
which is the pair `hud-narrow.html` already checks; and `CHIP_ARC_MIN_START` is
no longer reached by either ring.
**Verify** — `hud-narrow.html` at both widths for clipping, then the phone with
a thumb, which is the only test of whether the outer ring is still comfortably
reachable at the top of the sweep — the corner the two dead-seeming chips
already occupy.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Build note** — implemented as decided. `chipPosition` takes a fourth
`ring: 'inner' | 'outer'` argument, chooses `R_CHIPS_INNER` (1.08, unchanged)
or the new `R_CHIPS_OUTER` (1.22) accordingly, and is no longer exported —
`placeChips` has been its only caller since entry 42 moved the fullscreen
chip off this arc, exactly as Decided says. `hud-probe.html`'s own dangling
`window.chipPosition = chipPosition` (unused even there — nothing in that
file ever read it back) is deleted along with it, rather than left importing
a name that no longer exists.

**How "smaller drawn, not smaller to hit" is actually achieved**, since the
entry names the two numbers (R 1.22, 0.8×) but not the mechanism: `mkChip`
now wraps its icon in a nested `<span class="hud-chip-face">`, and every
style that used to live on `.hud-chip` itself — the background, border,
border-radius, colour — moved onto that nested face. `.hud-chip` (the
actual `<button>`, and therefore the actual pointer-event target) is now an
invisible, always-3rem positioning box; `.hud-chip--outer .hud-chip-face`
alone gets `transform: scale(0.8)`. A CSS transform repaints an element
smaller without shrinking the box a pointer event hit-tests against — the
parent `<button>` — so the outer ring draws at 80% while its own tap target
stays the full 3rem, verified directly (see below) rather than assumed from
how transforms are generally supposed to work. **Mine**, since the entry
states the constraint ("touch target left at full size") but not how.

Ring membership is tracked via `chip.dataset.ring`, set once in `mkChip` and
read by `placeChips` to split the map into two lists before calling
`chipPosition` once per list — rather than inferring the split from
insertion order (which would have worked today, since the four inner chips
happen to be constructed first, but ties correctness to a call order nobody
would think to preserve on a later edit).

`R_CHIPS_OUTER_SCALE` (0.8) is a single named constant referenced both from
the CSS template literal (`transform: scale(${R_CHIPS_OUTER_SCALE})`) and
this build note, rather than a bare `0.8` typed once into the stylesheet
string — so the one number the entry actually specifies exists in the file
exactly once.

Verified: `pnpm build`/`pnpm lint` clean; `pnpm probe` unaffected (0
failures — this entry touches only layout). Live via `hud-narrow.html`'s
own `window.run()` at both 320×568 and 360×640: `escaped: []` at both — no
chip crosses its frame's edge. Confirmed the split and the size split
directly (not just visually): `.hud-chip`'s own `getBoundingClientRect()`
reads exactly 48×48 for all eight chips regardless of ring — the touch
target claim, checked, not assumed — while `.hud-chip-face`'s own rect
reads ~48-50px for the inner four and ~38-40px for the outer four (a
~0.79-0.8 ratio, matching `R_CHIPS_OUTER_SCALE` within a border pixel).
`describe().chips` confirms the inner four are exactly `Geometric layer,
Atmospheric layer, Camera layer, Listening` and the outer four exactly
`Numeric readout, Gravity, Sky: auto, Camera mode`, per Decided's own
division. A real tap on an outer-ring chip (`Gravity`, via `w.tap()` at its
real screen coordinates) correctly toggled `prefs.gravity` — the new nested
face element does not interfere with the existing `pointerup` listener,
which stayed on the button as before. `CHIP_ARC_MIN_START` (209°) is not
reached by either ring at either width — checked by hand against the same
formula `chipPosition` itself uses: at 320×568 the inner ring's leading chip
computes to 218.8° and the outer ring's to 220.3°, both comfortably above
the clamp; both rings have *more* margin at 360×640, since a larger `base`
only increases `r`, which only shrinks `step`. No console errors.

Not independently verified: the phone-with-a-thumb reachability question the
entry's own Verify text names as its half of this — outside what a
browser-only harness can answer.

### 78. Camera mode is a door back to the menu, not a one-way trip
`status: done` · added 2026-08-30 · started 2026-08-30 · build 260

**Do** — make the shutter chip stay live in camera mode and return to the open
menu when tapped, retire the two-finger exit, and show the chip as active while
the mode is on.

**Why** — you enter camera mode from the menu and there is no way back to it.
And the gesture that does exist takes an unwanted photo on the way out.

**Decided**
- **The complaint is exact and the design caused it.** Entry 72 decided the
  exit goes "to the normal picture rather than opening the panel". So the trip
  is one-way: enter from a chip, leave to a bare screen, then double-tap to get
  the menu back. Every other chip in the app leaves you where you were. This
  one does not, and that asymmetry is the whole of "not connected to the menu".
  **Overturned: exiting returns to the menu, open, as it was.**
- **The two-finger exit fires a spurious screenshot, every time.**
  `nonChipDown` is counted from `touchField.sample(now)` — the *live contact
  set* — so when the first finger lands it is 1, which falls through to the
  shutter and saves a frame; only the second finger makes it 2 and exits. Two
  fingers never land in the same 16ms frame in practice. So **the gesture for
  leaving camera mode is also the gesture for taking a picture you did not
  want**, and at a 300ms rate limit it is not swallowed either.
- **That bug cannot be fixed while both gestures start identically.** The
  shutter's whole value is firing on `down` with no wait (entry 72), and any
  scheme that waits to see whether a second finger is coming gives that back.
  A sequential two-finger tap is one-finger-then-one-finger, and no amount of
  care distinguishes its first contact from a photo.
- **So the exit becomes the chip, and the gesture goes away.** `e.onChip`
  contacts are already excluded before the camera branch is reached, so a chip
  tap can never fire the shutter — the conflict does not exist for a chip and
  cannot be introduced. **Mine**, and it fixes the bug by deletion rather than
  by another timing rule. The chip is also the only exit anyone would find
  without being told, which the two-finger gesture never was.
- **Which means the chip must be visible and live in camera mode**, alone —
  `.hud-scrim:not(.open) .hud-chip { pointer-events: none }` (`hud.ts:408`) is
  what makes every chip inert with the panel closed, so this one needs an
  explicit exception rather than the rule quietly not applying. Only the
  shutter chip; the rest stay inert.
- **The chip says which state it is in**, like `day` does. `hud.ts:1227` is
  currently `void shutterChip` — the unused-variable idiom — so nothing ever
  repaints it and it looks identical whether the mode is on or off. That is
  also half of why the mode feels disconnected: the menu never shows that it
  is running.
- **The centred glyph stays exactly as it is.** It says what a tap does; the
  chip says how to leave. Two different jobs and neither should take the
  other's — and entry 76's freeze does not apply here, but the same instinct
  does: the glyph shipped right and is not what is being complained about.
- **Check the same fault on the ordinary path.** `main.ts:1354` uses the same
  `nonChipDown === 2` test for the two-finger *menu* open (entry 67). Its first
  finger does not save immediately — it starts a pending tap — but that pending
  tap resolves 400ms later and may still write a frame after the menu opens.
  Same root, less visible. Confirm and fix in the same change.

**Lands in**
- `src/main.ts:1331-1347` — the camera branch loses its two-finger case.
- `src/main.ts:1035-1042` — `exitCameraMode` reopens the panel.
- `src/main.ts:1354` — the ordinary two-finger path's stray pending tap.
- `src/hud.ts:408` — the exception that keeps one chip live.
- `src/hud.ts:1005-1014, 1227` — the chip toggles, and paints its state.

**Done when** — entering from the chip and tapping it again returns to the menu
exactly as it was; no photo is ever saved by leaving; the chip visibly reads as
active while the mode is on; every other chip is still inert with the panel
closed; and a two-finger tap in the ordinary picture opens the menu without
leaving a frame behind 400ms later.
**Verify** — the phone, counting files: enter camera mode, take three photos,
leave, and confirm exactly three arrived. That count is the whole test and it
is the one nobody ran.
**Hard stops** — prefs no · url no · capture **yes, and answered**: this
strictly *reduces* what is written — the accidental frame on exit stops
happening, and no new path to a capture is added · dependency no.

**Build note** — implemented as decided, plus one interface addition the
entry names by consequence but not by shape. `dispatchTouches`'s camera
branch (`main.ts`) lost its `nonChipDown === 2` case entirely; the shutter
now fires unconditionally on every non-chip `down` while in the mode
(`e.onChip` contacts, including a tap on the shutter chip itself, are
already excluded above this branch, so the chip's own exit tap can never
also be read as a photo). `exitCameraMode` now calls `panel.open()` after
restoring the pre-mode passthrough mix. The ordinary two-finger `panel.open()`
path now cancels every still-pending single-tap before opening
(`for (const p of [...pendingTaps]) cancelPendingTap(p.pointerId)`) — the
exact fix the entry's own diagnosis names.

`onCameraMode` becomes a toggle at the call site
(`() => (cameraMode ? exitCameraMode() : enterCameraMode())`) rather than
always entering, since the chip is now the only way in *or* out. Threading
the chip's *displayed* state through needed one addition beyond what
Lands-in enumerates: a new `Hud.setCameraActive(active: boolean): void`,
called from both `enterCameraMode` (optimistically true, then false again
in the existing refusal-revert branch if the camera turns out refused or
absent) and `exitCameraMode` (false). Hud.ts owns no independent copy of
`cameraMode` — main.ts's boolean is the only source of truth, including its
own asynchronous revert, and the chip is only ever told the true value
after the fact rather than guessing optimistically on its own. Camera mode
stays render-time-only per the entry's own Hard Stop; this is state for
painting one chip, not a stored preference. **Mine**, since "the chip
toggles, and paints its state" describes the requirement, not the
plumbing it needs.

The live exception is `.hud-scrim:not(.open) .hud-chip--shutter[aria-pressed='true']
{ pointer-events: auto }` — a new `.hud-chip--shutter` class (added once,
where the chip is constructed) rather than an id or label selector, gated
on the same `aria-pressed` attribute the existing per-chip paint loop
already sets for every other chip, so there is exactly one place "is camera
mode on" gets decided. `void shutterChip` at the old `hud.ts:1227` is
unchanged — the variable is still otherwise unused; painting happens
through the generic `chips` map, not a direct reference to it.

`scripts/probe-tap.ts` (entry 67) gains the reimplementation's own
`openTwoFinger()`, mirroring the real fix's cancel-all loop, and a sixth
check: a first finger's pending single is confirmed gone, and no save fires
400ms later, once a second finger's two-finger open has already fired.
All twelve checks in that file pass, including the five pre-existing ones,
confirmed unaffected.

Verified: `pnpm build`/`pnpm lint` clean; `pnpm probe` 0 failures (unrelated
to this entry); `pnpm probe:tap` all 12 pass, including the new case 6
above, run first at the arithmetic level before touching a browser at all.
Live via `hud-probe.html`/`hud-narrow.html` (the touch-dispatch code itself
is gated behind Start's mic permission, same limitation this session hit
repeatedly for camera-adjacent code — see below): `setCameraActive(true)`
correctly flips the shutter chip's `aria-pressed` to `true` and its
computed `pointer-events` to `auto` while the panel is closed;
`setCameraActive(false)` reverts both; every *other* chip stays
`pointer-events: none` while closed regardless of camera state, confirming
the exception is scoped to the one chip it should be; a real synthesised
tap on the shutter chip (via `hud-narrow.html`'s own `window.tap()`, at
320×568) lands on the actual button element and fires `onCameraMode()`
through it, both with the panel closed and camera mode on; with camera mode
off and the panel closed, the same tap produces no call at all, confirming
the exception does not leak into the "haven't entered yet" state.
`hud-narrow.html`'s own clipping harness still reports 0 escaped elements
at 320×568 and 360×640 — unaffected, as expected, since this entry adds no
new chip and touches no layout. No console errors.

Not verified live, gated behind Start exactly as entries 67 and 72 already
disclosed for this same code region: `dispatchTouches`'s actual two-finger
and camera-branch dispatch, `enterCameraMode`/`exitCameraMode` themselves,
and therefore the specific claim "no photo is ever saved by leaving" and "a
two-finger tap opens the menu without leaving a frame behind" as end-to-end
behaviour rather than as the arithmetic `probe:tap` now proves. Reviewed
carefully by hand instead, and the `pendingTaps`/`cancelPendingTap` logic is
identical in shape to what `probe:tap` already executes. The entry's own
Verify line — the phone, counting files — is the phone's question, not
this session's.
`status: ready` · added 2026-08-30

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

### 80. Fullscreen has right of way
`status: done` · added 2026-08-30 · started 2026-08-30 · build 277

**Do** — when fullscreen is wanted and absent, the next touch of the picture
restores it **and does nothing else**: no emitter, no shutter, no pending
screenshot, no menu, no camera mode. Everything else waits its turn.

**Why** — a stated priority: fullscreen first and it blocks everything, then
camera or menu. Today the opposite is true — the tap does its ordinary job
*and* restores fullscreen, so the one gesture does two things at once.

**Decided**
- **This overturns a decision made on purpose**, so it is worth quoting what is
  being reversed. `armFullscreenRetry`'s comment: *"Does not stop propagation or
  call preventDefault itself, so the same tap still does whatever it normally
  does — with entries 50 and 52 landed, that same tap is also an emitter and a
  screenshot."* That was chosen as generosity — nothing is lost, you get both.
  Victor's ordering says the opposite: a tap that means *give me my screen back*
  should not also spend itself on something else.
- **`stopPropagation()` on the retry is not sufficient, and this is the trap.**
  The retry listens on `pointerup`, but the emitter and the camera shutter both
  fire on `pointerdown` (entries 50 and 72), and `touches.ts` records contacts
  through its own listeners rather than through the retry's. By the time the
  `up` arrives, a ring has already been drawn and a photo may already be
  written. **The block has to happen at `down`, in the dispatch, not on the
  listener.**
- **So the dispatch gets a first question, before every other branch** — *is
  fullscreen wanted and absent?* If yes, the contact is consumed: no
  `visualiser.setTouches` entry for it, no pending tap, no shutter, no
  two-finger case. The request itself still goes out on `up`, where entry 62
  put it deliberately (*"pointerup is the one every engine agrees on"* for
  activation), so this entry changes what a contact *does*, not how fullscreen
  is asked for.
- **The precedence is written down as one list**, in `main.ts`'s dispatch,
  because it now has four claimants on the same tap and they have never been
  ranked anywhere: **1. fullscreen · 2. camera mode · 3. menu · 4. play.**
  Camera mode above menu because in it the menu cannot open at all (entry 72),
  and play last because it is the only one that is never the *point* of a tap
  — entry 50's own generosity is what makes it the right thing to yield.
- **Entry 50 gets an explicit exception, not a quiet one.** *"A tap plays,
  everywhere"* is a principle this repo has defended repeatedly, and this is the
  first place it does not hold. It holds again the moment fullscreen is back —
  which is one tap. State it in the code beside the check, or the next reader
  will file it as a bug.
- **One tap, not a mode.** The block lasts exactly as long as
  `want && !document.fullscreenElement`, which after entry 66 is derived fresh
  every `fullscreenchange`. There is no state to get stuck in, and nothing to
  reset — the same property that made entry 66's rewrite worth doing.
- **The chip is unaffected.** It is `onChip`, excluded before any of this, and
  it is the deliberate way in for someone who left fullscreen on purpose and
  does not want to be dragged back by a tap on the picture.

**Lands in**
- `src/main.ts:1320-1360` — the precedence check at the top of the `down`
  branch, reading `fullscreenStatus()` which is already imported (`:25`).
- `src/permission-gate.ts:189-199` — the comment that documents the old
  behaviour, which becomes wrong the moment this lands.
- `scripts/probe-fullscreen.ts` — that a contact while `want && !active` is
  consumed, alongside the re-arm cycle entry 66 added.

**Done when** — leaving fullscreen and then tapping the picture restores it and
leaves no ring, no photo, no pending save and no menu; the tap after that
behaves entirely normally; in camera mode the same holds, so a tap while
windowed restores fullscreen rather than taking a picture; and the fullscreen
chip still works without any of this applying.
**Verify** — the phone, since fullscreen cannot be entered honestly anywhere
else. Count files again, as entry 78 does: leave fullscreen, tap once, and
confirm the camera roll is unchanged.
**Hard stops** — prefs no · url no · capture **yes, and answered**: strictly
fewer captures — a tap that used to save while windowed no longer does ·
dependency no.

**Build note** — implemented as decided. `dispatchTouches` computes
`fsBlocking = fullscreenStatus().want && !document.fullscreenElement` once,
fresh, at the top of every call — the same two facts entry 66 already
exposes, no new state. It gates three separate places, all needing the
same `!onChip` exception so the chip stays the deliberate way in Decided
names:
- The contact-sampling loop that feeds `visualiser.setTouches` (the
  emitter) and the atmospheric stream's `streamAnyDown`/`streamMaxSpeed` —
  a blocked non-chip contact now skips `nonChipDown++` too, not only the
  emitter, since "does nothing else" reads as nothing else, not merely "no
  ring". This was a **judgment call beyond Decided's own itemised list**
  (which names the emitter, the shutter, the pending save and the menu
  specifically, not the atmospheric stream or the two-finger counter) —
  **Mine**, on the reading that the *principle* stated ("everything else
  waits its turn") is the actual spec and the itemised list is illustrative
  rather than exhaustive.
- The `down`-kind event loop's own `streamBegan` flag, checked and skipped
  before it can be set to true — this is the actual block Decided asks for
  ("the block has to happen at down, in the dispatch, not on the
  listener"), placed before the existing `e.onChip || hudOpen || gateShowing`
  check so it also precedes the camera-mode branch (entry 87's own
  forward-reference: "a tap while windowed restores fullscreen rather than
  taking a picture" — confirmed by ordering, `fsBlocking`'s `continue` now
  sits textually above `if (cameraMode)`).
- `permission-gate.ts`'s `armFullscreenRetry` doc comment, rewritten: it no
  longer claims "the same tap still does whatever it normally does", which
  became false the moment this landed.

Verified: `pnpm build`/`pnpm lint` clean; `pnpm probe` 0 failures and
`pnpm probe:tap` all pass (both unaffected — this entry touches neither
file's own logic). `scripts/probe-fullscreen.ts` gained a new section
(case 7) reimplementing `fsBlocking` itself — kept in lockstep by eye
against `main.ts`, the same precedent `probe-tap.ts` set for logic that
lives inline in `main()`'s own closure and cannot be imported — driven
against the probe's own **real, unmodified `fullscreenStatus()`** output
across the identical loss/recovery cycle case 6 already exercises: not
consumed before ever asking, not consumed while active, a non-chip contact
consumed the instant fullscreen is lost, a chip contact never consumed
regardless of state, and no longer consumed immediately after the
consumed contact's own tap recovers it. All 39 checks across the file
pass, including the 32 pre-existing ones, confirmed unaffected.

Not verified live: this entry's own Verify text names the phone as the
only honest test ("fullscreen cannot be entered honestly anywhere else"),
and this session's own attempt to reach real `dispatchTouches` behaviour
live — documented at length in entry 87's build note just above this one —
got further than ever before (a real Start, a real running render loop)
but the synthetic touch dispatch itself did not cooperate for reasons not
resolved there either. `fsBlocking`'s own boolean logic is now covered
arithmetically against the real `fullscreenStatus()` signal (see above);
the three call sites that read it inside `dispatchTouches` are verified by
code review and by the diff's own shape, not by watching a real tap
consumed.

### 81. The director waits for the bar
`status: done` · added 2026-08-30 · started 2026-08-30 · build 279

**Do** — when the tempo is confident, hold the director's decision until the
next bar and fire it there. When it is not, fire immediately, exactly as now.

**Why** — `docs/what-resolume-knew-about-layers.md`, lesson 1. A change landing
0.4s after a downbeat reads as an accident; the same change *on* the downbeat
reads as intent. This is the largest difference in feel between kiyo and a VJ
tool, and entry 75 already shipped everything needed to close it.

**Decided**
- **Nothing about the director's own timing changes.** `SUSPEND` 30,
  `COLOUR_HOLD` 30, `VIEW_HOLD` 30, `BOUNDARY` 0.45 and `BOUNDARY_RAMP` 30 all
  stay. What changes is their meaning: they become **earliest**, not exact. A
  decision that becomes due at 30.0s fires at the next bar line after it.
- **Bounded wait, or it stops being a director.** At most **one bar** — beyond
  that, fire anyway. A tempo that drifts or drops mid-wait must never strand a
  decision. **Mine.**
- **`beatConfidence` is the switch, and there is no threshold to tune** →
  quantise when confidence is high, blend to immediate as it falls. Entry 75
  made confidence continuous specifically so consumers would not each invent a
  cutoff.
- **A bar is four beats**, counted from the tracker's own phase. Nothing in the
  app detects downbeats, so bar zero is simply where counting started — which
  is honest: an unmarked bar line still groups changes into fours, and that is
  what reads as musical. **Mine**, and it explicitly does not claim to know
  where "one" is.
- **Only the director quantises.** A shake, a tap and a chip are a person's own
  timing and must stay instant — entry 45's suspend already encodes that a
  deliberate choice outranks the autopilot.

**Lands in** `src/director.ts` — a pending-decision slot and the bar test;
`src/main.ts` — passing `beatPhase`/`beatConfidence` in, both already on
`VisualParams`.
**Done when** — with a steady four-on-the-floor, view and colour changes land
on a beat rather than between beats; with no lock, timing is unchanged from
today; and no decision is ever delayed more than one bar.
**Verify** — the phone against a track with an obvious beat. `probe-slow.ts`
can assert the bounded wait, which is the part that can strand something.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Build note** — implemented as decided. `Director` gains a bar clock
(`lastBeatPhase`/`beatsIntoBar`, incrementing on each beat-phase wrap —
phase decreasing rather than advancing — and marking a bar boundary on
every fourth one) and a single pending-decision slot (`pending`/
`pendingWaited`). The three hold/dead-band timers (`COLOUR_HOLD`,
`VIEW_HOLD`, `VIEW_STABLE`, `BOUNDARY`/`BOUNDARY_RAMP`) are untouched, per
Decided — they still decide *whether* something is due; what changed is
only what happens once it is.

Once due, a decision fires immediately in two cases — `beatConfidence`
low enough that `MAX_BAR_WAIT_S * beatConfidence` (the wait cap) collapses
to ~0, or a bar boundary already landed on the exact frame it became due,
where holding would only cost a full extra bar for nothing — and is
otherwise stashed as `pending` and re-checked every subsequent frame: it
fires the instant a bar boundary arrives, or once `pendingWaited` reaches
the cap, whichever comes first. The cap is recomputed fresh from the
*current* `beatConfidence` every single check, not fixed when the wait
began — Decided's own explicit worry ("a tempo that drifts or drops
mid-wait must never strand a decision") is what this buys: a lock lost
partway through a wait collapses the cap toward 0 and releases the
decision within a frame rather than leaving it stranded until some bar
that may never arrive.

`MAX_BAR_WAIT_S = 2.4` (**Mine**) is a fixed duration rather than a true
bar length at whatever tempo is actually playing, since only
`beatPhase`/`beatConfidence` reach this file — not `bpm` — per Lands-in's
own scope. Chosen against a nominal ~100bpm four-beat bar; "at most one
bar" is the ceiling this never crosses, not a promise to hit every
possible tempo's own bar length exactly, and is disclosed as an
approximation rather than presented as exact. `suspend()` now also clears
any pending decision — a decision the autopilot was holding for the next
bar is exactly as unwelcome mid-manual-edit as one that would have fired
on the spot, and "never fight the user" reads as covering both.

One small addition beyond Lands-in's literal text: `status()` gained a
`waitingForBar: boolean` field, in keeping with this file's own stated
philosophy for that method ("reporting the timers... stops 'restrained'
being indistinguishable from 'not running'"). **Not** wired into the HUD's
own printed readout — Lands-in scopes this entry to `director.ts` and
`main.ts` only, and extending `hud.ts`'s formatting was not asked for. **Mine**.

`scripts/probe-slow.ts` needed the two new arguments threaded through its
own existing `director.update()` call (using `params.beatPhase`/
`params.beatConfidence`, already present on every mapping since entry 75)
to keep building at all, and gained a new, fully isolated section driving
a fresh `Director` directly rather than through the full slow-analysis
pipeline: confidence 0 fires on the spot; confidence 1 with a bar already
arriving on the due frame also fires on the spot; confidence 1 with no bar
yet holds (`status().waitingForBar` confirmed true) and releases exactly
when the bar arrives; a confidence collapse mid-wait releases the held
decision within a frame rather than stranding it; and `suspend()` discards
a held decision outright, confirmed not to reappear afterward. All ten
pass. The existing five-section arrangement test (unmodified) still passes
its own two checks — the "drop"/"build" sections are genuinely rhythmic
(bpm 125) and may exercise real bar-quantisation incidentally, but only
the new isolated section proves each specific claim in Decided directly
rather than by coincidence of what a synthetic track happens to do.

Verified: `pnpm build`/`pnpm lint` clean; `pnpm probe`, `pnpm probe:tap`
and `pnpm probe:fullscreen` all unaffected (0 failures / all pass) — this
entry touches neither file. `pnpm probe:slow` is the entry's own named
Verify method for this file (no browser check listed), and all of its
checks pass, old and new.

Not independently verified: the entry's own phone-and-obvious-beat Verify
line — "does it visibly land on the beat" is not something an offline
probe can answer, the same limit every beat-adjacent entry since 75 has
disclosed.

### 82. The layers move apart
`status: done` · added 2026-08-30 · build 284

**Build note (Mine)** — `uAtmTumbleScale` (0.55) scales both the rotation and
the drift of `uTumble` for a second, atmosphere-only `uv` in
`composite.frag.glsl`; geometry keeps sampling the original `uv` unscaled, so
"1.0" for geometry is just the absence of a second uniform rather than a
literal `1.0` multiplier anywhere. The shared `uTumble.w` overscan is left
untouched — it's already sized for the geometry's full-strength motion via
`overscanFor` in `scene.ts`, and since the atmosphere's scale is always ≤ 1
that's always the larger of the two, so no second overscan computation was
needed, matching the entry's own reasoning.

The RGB-slip offset (entry 76) is now applied around each layer's own uv
(`uv` for geometry, `uvAtm` for atmosphere) rather than a single shared one —
not called out in Lands-in, but leaving the atmosphere's slip anchored to the
geometry's uv would have reintroduced exactly the "moves as one plane"
problem this entry exists to fix, just for the slip effect instead of the
tumble. Small judgment call, disclosed here.

`pnpm build`, `pnpm lint`, and `pnpm probe:composite` (the only probe that
touches this shader, in its blend/colour tail — the tumble uv itself isn't
part of that reimplementation) all pass. The bit-identical-at-scale-1 claim in
Done-when is a trig identity (scale 1 makes `uvAtm` collapse to exactly `uv`'s
own formula) rather than something I additionally probed numerically. Visible
parallax on a moving phone is the entry's own stated Verify and it says so
itself — "Depth is not measurable offline" — so that part is unverified by me
this session; the change is otherwise a straightforward, reviewed read of the
existing tumble math.

**Do** — give each layer its own multiplier on the tumble, so the geometry and
the atmosphere do not move as one rigid sheet.

**Why** — `docs/what-resolume-knew-about-layers.md`, lesson 2: the best ratio
of effect to cost in the whole note. Resolume transforms every layer
independently; kiyo transforms the composite.

**Decided**
- **The cause is one `uv`.** `composite.frag.glsl` computes a single tumbled
  `uv` and samples both layers with it, so the picture moves as one plane.
  Giving the geometric layer a larger multiplier and the atmosphere a smaller
  one makes the near thing move more than the far thing, which is parallax and
  is the whole trick.
- **Geometry 1.0, atmosphere 0.55.** **Mine** — the geometry is line art and
  reads as the near plane; the atmosphere is a field and reads as behind it.
  Not a new uniform each: one `uAtmTumbleScale`, since geometry keeping 1.0
  means today's tumble is unchanged for it.
- **Overscan follows the larger of the two**, not the average — `overscanFor`
  already exists and is already shared for exactly this reason (its comment
  says so). Cutting overscan to the smaller layer's need would expose the
  bigger one's corners.
- **No new state, no new plumbing** — one extra `uv` computation in a shader
  that already computes one, and one uniform.

**Lands in** `src/shaders/composite.frag.glsl:100-127`; `src/scene.ts` — the
uniform.
**Done when** — moving the phone separates the layers visibly; neither layer
shows an exposed corner at full tumble; and at `uAtmTumbleScale = 1` the frame
is bit-identical to today.
**Verify** — the phone. Depth is not measurable offline.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 83. Solo a layer without losing your settings
`status: done` · added 2026-08-30 · build 287

**Build note (Mine)** — `mkChip` in `src/hud.ts` gained an optional fifth
`solo` argument, wired only for the `geo`/`atm`/`cam` chips: a `pointerdown`
starts a 350ms timer (`SOLO_PRESS_MS`, not derived, my own figure), and if it
fires before `pointerup`/`pointercancel`/`pointerleave` arrives, the press
becomes a solo instead of the ordinary tap that switches the edited group.
`fired` is the flag that decides which behaviour a given press turned out to
be, checked by whichever release-shaped event happens to arrive — this is
what makes a genuinely-lost pointer (`pointercancel`, or `pointerleave` if a
finger slides off the small chip mid-hold) restore correctly rather than only
a clean `pointerup`, matching Done-when's "a release that never arrives
still restores."

`main.ts` forces the two un-soloed layers to alpha 0 directly through
`visualiser.setGeoAlpha`/`setAtmAlpha`/`setPassthrough` and restores by
re-reading `prefs.geoAlpha`/`prefs.atmAlpha`/`prefs.passthrough` fresh at
release rather than a value captured at press time — nothing is stored at
any point, so there is nothing that can go stale, and if a shuffle happened
to land mid-hold the release correctly shows whatever is actually current
rather than what was true when the press started.

One thing not in Lands-in, disclosed here: soloing forces the camera layer's
opacity through `visualiser.setPassthrough` directly rather than through
`applyPassthrough`, which I read closely before writing this. That function
closes the live camera stream outright on any mix ≤ 0 — its own comment says
this is deliberate, to avoid holding a powered, undrawn sensor open with the
OS indicator lit. Routing solo through it would have torn down and
re-acquired the real camera on every press and release, which is neither
momentary nor safe to assume always succeeds (a second `getUserMedia` call
per release). Setting the render value alone leaves `cameraSource` untouched
for the whole gesture, which is what "change nothing stored" should mean for
a live stream too, not just for prefs.

`pnpm build` and `pnpm lint` are clean. No probe touches chip pointer
wiring, so none was added or run for this one. Verify is explicitly phone-only
("holding a layer chip shows that layer alone... **Verify** — the phone"),
and this session's live-browser check hit the same microphone-permission wall
documented in earlier entries this window (the Start gate refuses to clear
without a granted mic, and this Chrome profile has no fake-device flag or way
to grant it that these tools reach) — so the actual on-screen solo/restore
was verified by close reading of the render seam and the event wiring, not
by touching a running instance. Disclosing rather than claiming a live check
I didn't get.

**Do** — a momentary solo on each layer: see that layer alone, change nothing
stored, release and everything is where it was.

**Why** — `docs/what-resolume-knew-about-layers.md`, lesson 3. To see what the
geometry contributes today you drag `atmAlpha` to zero and then try to put it
back. Resolume has had solo and bypass on every layer forever, and the reason is
that a mix you cannot inspect is a mix you tune by guessing.

**Decided**
- **It is the override seam, not a new mechanism** → entries 48, 58, 60 and 72
  all influence a value on its way to the renderer without writing prefs. Solo
  is that applied to alpha: the other layers' alphas are forced to 0 for the
  duration and the stored values are never touched, so there is nothing to
  restore and nothing that can be left behind by an interrupted gesture.
- **On the layer chips that already exist** — a **long press** on `geo`, `atm`
  or `cam` solos while held. **Mine**: those three chips already mean "this
  layer", the gesture cannot collide with the emitter charge (entry 57) because
  chip contacts never reach the picture, and momentary-while-held is what makes
  it impossible to leave the app in a soloed state.
- **Not a fourth chip.** Entry 77 has just finished making the arc fit; adding
  a mode chip for something momentary would spend the space it bought.

**Lands in** `src/hud.ts` — long-press on the three layer chips; `src/main.ts`
— the alpha override at the same seam.
**Done when** — holding a layer chip shows that layer alone and releasing
restores the exact previous mix; nothing is written to prefs at any point; a
release that never arrives (pointer cancelled) still restores.
**Verify** — the phone: solo, kill the app mid-hold, reopen, confirm the mix is
untouched.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 84. Each layer drifts on its own clock
`status: done` · added 2026-08-30 · build 290

**Build note (Mine)** — the fix itself is two numbers: `COLOUR_HOLD` 30→25,
`VIEW_HOLD` 30→45, in `src/director.ts`. Decided's own "the holds become
per-layer, not the logic" is literally true here — `update()`'s two due-checks
already gated `geoColour` and `atmosphericView` independently through their
own `sinceColour`/`sinceView` timers; the only thing that ever made them read
as one shared clock was both timers happening to carry the same value. Both
constants are now exported (they weren't before) so `probe-slow.ts` can
assert against them directly rather than a copied literal.

Verify names `probe-slow.ts` over a long synthetic run for the lockstep
claim, so I drove a bare `Director` directly through 8 alternating 90s-long
"flavour" phases (12 simulated minutes) engineered to be due for both a
colour and a view change on every switch, and recorded how far into each
phase each axis actually fired. One honest surprise while building this:
neither mean offset landed on `COLOUR_HOLD` or `VIEW_HOLD` themselves — 90s
per phase is long enough that `sinceColour`/`sinceView` are already well
past their own hold by the time each phase switches, so colour fires at
offset ≈0 (nothing left gating it) and view fires at ≈30s, timed by
`VIEW_STABLE` rather than `VIEW_HOLD` (the candidate itself only becomes new
at the switch and has to persist 30s before the due-check's `candidateHeld`
term is satisfied). I state this plainly in the probe's own comments rather
than picking a phase length that would have hidden it — it doesn't weaken
the entry's claim: the two axes still land at a persistent, non-closing gap
(colour always first, view always ≥30s later, checked every single phase,
never once at the same offset), which is exactly what "neither drifts into
lockstep" asks for, and the two clocks being genuinely different values is
what makes that gap exist at all rather than an artifact of one particular
scenario.

`pnpm build`, `pnpm lint`, and `pnpm probe:slow` all pass (10 pre-existing
bar-quantisation checks plus 7 new ones, all green). Not independently
verified on the phone this session — the "visibly change at different
times" half of Done-when is exactly the kind of multi-minute perceptual
claim `probe-slow.ts`'s own file comment says a screen can't be trusted to
judge in real time, and Verify names the probe rather than the phone for
that reason; SUSPEND-silences-both is covered by both the existing global
suspend logic (untouched) and a dedicated new check.

**Do** — split the director's holds so the atmosphere and the geometry change
on independent schedules rather than together.

**Why** — `docs/what-resolume-knew-about-layers.md`, lesson 4. Resolume's
autopilot is per layer. kiyo's director rolls the whole picture on shared
thirty-second holds, so everything changes at once and then nothing changes at
all.

**Decided**
- **The holds become per-layer, not the logic.** `COLOUR_HOLD` and `VIEW_HOLD`
  become a pair each; every dead band, the `BOUNDARY` novelty test and
  `SUSPEND` stay exactly as they are and stay global — a person's deliberate
  choice suspends the whole director, not one layer of it.
- **Atmosphere slower than geometry**, since it is the ground: **45s and 25s**
  against today's 30/30. **Mine.** Deliberately not multiples of each other, so
  the two do not re-synchronise into the behaviour this replaces — the same
  reasoning `index.html`'s start-button animation already uses for its 3.4s and
  5.9s periods.
- **Build after entry 81**, or the two rhythms land at arbitrary moments and
  the point is lost. Independent clocks are worth having *because* each one
  lands on a bar.

**Lands in** `src/director.ts:61-64` and the state it holds.
**Done when** — the atmosphere and the geometry visibly change at different
times; neither drifts into lockstep over several minutes; `SUSPEND` still
silences both.
**Verify** — `probe-slow.ts` over a long synthetic run, for the lockstep claim.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 85. A gentle shake asks for a shuffle and gets nothing
`status: done` · added 2026-08-30 · build 294

**Build note (Mine)** — a new `envelopePeak(envelope)` in `src/shake.ts`,
next to `intensity()`, maps the `disturb` envelope onto `intensity()`'s own
peak scale (`STRONG_UP`..`PEAK_CEILING`), calibrated so `SUSTAIN_LEVEL`
(0.55, the least envelope that can ever reach it) lands just past
`SHUFFLE_RESEED` and full saturation lands near what a hard reversal-path
shake already reports natively. `detectSustained`'s peak snapshot changes
from `this.strongPeak = this.peak` to
`Math.max(this.peak, envelopePeak(this.envelope))` — fixing defect 1 outright,
since a gentle sustained shake's `this.peak` alone was always going to be
0-ish there.

Beyond Lands-in's literal text (`intensity`, `detectSustained`'s snapshot,
and `probe-shake.ts`'s expectations): I also applied the same
`Math.max(this.peak, envelopePeak(this.envelope))` blend to `detectStrong`'s
own `strongPeak`/`doublePeak` snapshots, not just `detectSustained`'s.
Defect 2 (the deliberate shake's depth swinging from 0.54 to 0.21 across
sample rates) fires through the *reversal* path, not the sustained one, and
"stop deriving depth from instantaneous peak" only actually fixes it if the
reversal path gets the same treatment — leaving `detectStrong` untouched
would have fixed the entry's own headline defect while leaving its second,
equally-documented one exactly as broken as it started. The `Math.max`
means a hard shake's own genuinely-caught peak still wins outright (nothing
here can ever pull a strong reading down), so "the reversal path genuinely
measures a peak and should keep reporting one" still holds whenever the
sensor actually caught one.

Measured, not asserted: `pnpm probe:shake` now shows the gentle-sustained
rows at depth 0.42 (native) and 0.36 (@12Hz) — both past 0.30, both inside
the entry's own named 0.35-0.5 target — and the four deliberate-shake rows
(native/30/20/12Hz) all read depth 0.55, spread 0 rather than the ~0.1 Done-when
allows. That flat spread is not a tuning coincidence: 28 m/s² is double
`FULL` (14), so `disturb` saturates to 1 on the very first sample near any
peak regardless of how few samples a slow sensor delivers, and the reversal
counter only needs to see `STRONG_UP` (18, itself under `FULL`) crossed three
times to fire — so by the time it does, `envelope` has already locked at its
own ceiling at every rate tested. Two new checks added to `probe-shake.ts`
pin both numbers down (depth > 0.30 for both gentle rows; spread ≤ 0.1
across the four deliberate rows) so this doesn't silently regress.

Knock rejection and the double-shake counting logic are both completely
untouched — the fix only ever changes what value gets *reported* once
`strongPending`/`doublePending` are already true, never whether they become
true, so every existing count-based check (knock strong 0, double counts)
passed unmodified. `pnpm build`, `pnpm lint`, `pnpm probe:shake` (now 34
checks, up from 32) and `pnpm probe:haptics` (unaffected — it drives
`intensity()` directly with synthetic peaks, never through shake detection)
all pass. Not verified on a real phone this session; Verify names
`pnpm probe:shake` specifically, and its own header explains why synthetic
motion is what's tunable here at all.

**Do** — derive shuffle depth from evidence the detector actually has, so the
sustained path stops reporting zero and the same gesture means the same thing
on a slow-sampling phone.

**Why** — asked to check sensitivity across the shake modes. Two real defects,
both visible in `pnpm probe:shake`'s own output today.

**Decided**
- **Defect 1: the sustained path always reports depth 0.00.** From the probe:
  *gentle sustained shake (12 m/s², 3 Hz)* → `strong 1`, `peak 11.8`,
  **`depth 0.00`**; same at 12 Hz sampling. The path fires and the shuffle does
  nothing. The cause is exact — `detectSustained` sets `strongPeak = this.peak`,
  and `intensity()` maps peak over `[STRONG_UP 18, PEAK_CEILING 36]`, so a
  gesture that never reached 18 clamps to 0. **The sustained path exists
  precisely for shakes that never reach 18**, and then reports them as
  nothing. It is self-defeating by construction.
- **Defect 2: depth depends on the phone's sample rate.** Same deliberate
  shake: `depth 0.54` natively, `0.49` @30 Hz, `0.40` @20 Hz, **`0.21` @12 Hz`.
  The shuffle rungs are 0.30 / 0.45 / 0.70 / 0.90, so on a 12 Hz Android that
  shake **does not reach the first rung at all** while on an iPhone it reaches
  the second. Entry 36 lowered `PEAK_CEILING` for this exact reason and fixed
  only the ceiling; the mapping underneath is still rate-dependent.
- **Both have one fix: stop deriving depth from instantaneous peak.** Use the
  **`disturb` envelope**, which is normalised against `FLOOR`/`FULL` and
  computed from every sample regardless of rate — `shake.ts`'s own
  `SUSTAIN_LEVEL` comment already argues this, saying the envelope "does not
  care what absolute numbers the sensor reports, and it is computed from every
  sample regardless of rate". The argument was made and then only half used.
- **Keep `intensity(peak)` where it is honest** → the reversal path genuinely
  measures a peak and should keep reporting one; blend the two so a hard shake
  is unchanged and a sustained one gets a real number. A sustained shake should
  land around **0.35-0.5** — past the re-seed rung, short of views. **Mine.**
- **`PEAK_CEILING` and `STRONG_UP` do not move.** Entry 36 settled them against
  the probe and they are not what is wrong.
- Deliberately **not** changed: knock rejection, which the probe shows working
  exactly as designed — a single knock and a knock-plus-rebound both stay at
  `strong 0` while every real shake fires.

**Lands in** `src/shake.ts:95-110` (`intensity`), `detectSustained`'s peak
snapshot, and `probe-shake.ts`'s expectations.
**Done when** — the two gentle-sustained rows report a depth above 0.30; the
deliberate-shake rows report depths within ~0.1 of each other across 12, 20 and
30 Hz; every knock row still reports `strong 0`; and the double rows are
unchanged.
**Verify** — `pnpm probe:shake`, whose table is the whole test and already
prints every number this entry is about.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 86. One owner for the sensor, and watchers that cannot starve each other
`status: done` · added 2026-08-30 · build 298

**Build note (Mine)** — `ShakeSensor.frame(dt)` now returns a `ShakeFrame`
(`{ tilt, disturb, tumble, events }`, `Object.freeze`d) instead of a bare
`TumbleState`, and `takeStrong`/`takeDouble` are gone from `ShakeSensor`'s
own interface entirely — removed, not just discouraged, so nothing outside
`shake.ts` can call a clearing method even by accident. `Tumble` itself is
untouched: its own `takeStrong`/`takeDouble` are still called, but now only
from inside `frame()`, exactly once, with the double-wins-over-strong
precedence that used to live at main.ts's own call site moved in alongside
them (same comment, same logic, new home). `events` is `readonly
ShakeEvent[]`, at most one entry (`{kind:'strong'|'double', peak}`) per
frame.

`main.ts` gained one `let latestShake: ShakeFrame` replacing the old
`currentDisturb`/`pendingScatterPeak` pair; both the idle-preview loop and
the real loop now do `latestShake = shake.frame(dt)` and everything else
(`visualiser.setTumble`, `setMotion`, the double/strong branch, the powder's
`getMotion` closure, the numeric readout's `disturb`) reads from it. The
idle loop's old defensive `shake.takeDouble()` — called and discarded so a
double did not fire again once the real loop started reading — is gone
outright: since a `ShakeFrame` is replaced wholesale rather than
accumulated, the real loop's own first `frame()` call already only ever
reports what happened since the *last* `frame()` call (idle or real), so
there was nothing left to leak once destructive reads were confined to one
call site.

Powder's `getMotion()` now reads `latestShake` (tilt/disturb/the one event's
peak) without clearing anything, matching Decided's "reading is not
consuming" directly — if the powder's own rAF happens to run more than once
before main.ts's next tick, it now sees the same shake both times rather
than the second read getting 0. That's a real, if narrow, behaviour change
from before (the old closure cleared `pendingScatterPeak` on its own first
read), and it's the correct one per this entry's own stated goal, so I did
not try to preserve the old one-shot-per-read semantics on top of a
snapshot that is explicitly supposed to not do that.

Verify's own grep (`takeStrong`/`takeDouble` outside `shake.ts`) still
matches `probe-shake.ts`, which calls `tumble.takeStrong()`/`takeDouble()`
directly on a raw `Tumble` — exactly what Decided asks for ("probe-shake.ts
keeps driving Tumble directly, so its table stays comparable"), so I'm
reading the grep as scoped to `ShakeSensor`'s own consumers (main.ts,
powder.ts), not literally every file in the repo; a few stale comments in
both files that described the old clear-on-read mechanism were also
updated so they don't describe a mechanism that no longer exists.

`pnpm build` and `pnpm lint` are clean. `pnpm probe:shake` (34 checks) and
`pnpm probe:haptics` (10 checks) both pass unchanged — neither drives
`ShakeSensor` at all (the former drives `Tumble` directly, the latter drives
`intensity()` with synthetic peaks), which is exactly what "the physics
being untouched" as Verify's first half should mean. `pnpm probe:rgb-slip`
and `pnpm probe:motion-bias` (both touch `shake.ts`'s constants/Tumble
indirectly) also pass. Not separately verified on a real phone — this is a
plumbing change with no user-visible behaviour difference apart from the
powder narrowing noted above, and the entry's own Verify names the probe
and the grep, not the phone.

**Do** — make the shake sensor publish an immutable per-frame snapshot plus a
list of events, so any number of consumers can read it without consuming it.

**Why** — asked directly whether the model keeps watchers independent. **It
does not**, and the workaround is a hand-maintained convention that has already
been noted twice in comments.

**Decided**
- **Two of five accessors are destructive and nothing says which.**
  `frame(dt)` advances the springs and must be called exactly once per frame —
  a second caller double-integrates. `takeStrong()` and `takeDouble()` clear on
  read, so **the first caller wins and every other sees nothing**. `tilt()` and
  `gravity()` are pure. The type gives no hint, and the names only hint for
  two.
- **The convention already exists, undocumented as a rule.** `main.ts:717`
  says it out loud — *"`shake.frame()` and `shake.takeStrong()` both consume
  state"* — and the fix in place is that `main.ts` alone owns the sensor and
  re-publishes through `getMotion()`; `powder.ts` reads that snapshot rather
  than the sensor. `powder.ts:260` records the near-miss from the other side:
  *"takeStrong() actually returned something, since getMotion() clears it."*
  Two files carrying comments about the same hazard is the diagnosis.
- **The idle-preview loop proves the leak.** `main.ts:831-832` calls
  `takeDouble()` and throws the result away, purely so it does not fire later
  when the real loop starts reading. A model where you must consume an event to
  stop it happening is a model that leaks.
- **The fix is a snapshot plus events, not a subscriber API.** Once per frame
  the owner calls `frame(dt)` and produces `{ tilt, disturb, tumble, events:
  [...] }` — a plain frozen value. Consumers read fields and filter events, and
  **reading is not consuming**, so N watchers are independent by construction
  rather than by discipline. **Mine**: no callbacks, no registration, no
  ordering, nothing to unsubscribe — the same "pure state, sampled once per
  frame" discipline `touches.ts` already states in its own header.
- **`Tumble` keeps its internals.** This is the boundary, not the physics. The
  reversal counter, the envelope, the springs and every constant entry 36
  settled are untouched — and `probe-shake.ts` keeps driving `Tumble` directly,
  so its table stays comparable across the change.
- **This is what makes entry 85 safe to build**, and the two should land in that
  order: 85 changes what a shake *reports*, and the snapshot is what guarantees
  every consumer sees the same report.

**Lands in** `src/shake.ts` — `ShakeSensor` gains the snapshot; `src/main.ts:
717-731, 828-832, 1463-1510`; `src/powder.ts:260`.
**Done when** — no consumer outside the owner calls a clearing method; two
consumers reading the same frame both see the same shake; the idle-preview loop
no longer discards an event to suppress it; and `probe-shake.ts` passes
unchanged.
**Verify** — the probe for the physics being untouched, and a grep for
`takeStrong`/`takeDouble` outside `shake.ts` returning nothing.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 87. Camera mode is one shot: arm, shoot, done
`status: done` · added 2026-08-30 · started 2026-08-30 · build 273 · supersedes the mode built by 72 and 78

**Do** — camera mode arms a single photo. Tap the chip: the menu closes and the
camera glyph appears. The next tap takes **one** picture and leaves the mode.
Nothing about the picture changes while armed.

**Why** — Victor, asked directly: *"Enter camera mode display camera icon next
click takes picture exits camera mode."* That is not what entries 72 and 78
built, and the difference is not a detail — it is a different mode.

**Decided**
- **What is being corrected, plainly.** Entry 72 was mine and it misread the
  request. "Camera mode" was taken to mean the *passthrough* camera, so
  `enterCameraMode` calls `applyPassthrough(0.75)` and the room comes up at 75%
  — directly against the original request's own words, **"animation not
  affected"**. The build agent implemented the entry faithfully; the entry was
  wrong.
- **So entering touches the passthrough not at all.** No `applyPassthrough`, no
  `preCameraMix`, no restore — the room layer stays exactly wherever it was,
  including off, and the picture on screen does not change by one pixel when
  the mode is entered. What makes it a mode is the glyph, the instant shutter
  and the locked-out menu. Nothing visual.
- **One shot, and this dissolves three problems rather than solving them.**
  A mode that ends at the first photo has no exit gesture to design, so:
  entry 78's two-finger exit and its **spurious screenshot on the first
  finger** simply stop existing; there is no state to be stranded in; and
  "how do I get out" never has to be discoverable. The bug is deleted along
  with the gesture that carried it.
- **After the shot, back to the menu.** **Mine**, and it is the direct answer
  to *"camera mode is not connected to the menu!!"* — you entered from the
  chip, so you land back where you came from, and a second photo is a
  deliberate two-tap act rather than a held state that can be forgotten about.
  Reversible if it proves annoying in a burst; nothing else depends on it.
- **The shutter stays instant.** Entry 72's real insight survives intact and is
  now stronger: with the menu locked out *and* only one tap to interpret, the
  photo fires on `pointerdown` with nothing to wait for. That was always the
  best argument for the mode existing.
- **Kept from entry 78**: the chip paints its armed state (it was `void
  shutterChip`, so nothing repainted it), and the exception at `hud.ts:408`
  that keeps it live. **Dropped from entry 78**: the chip-as-exit, the
  two-finger case, and the reopen-on-exit plumbing, all of which existed to
  manage a mode that no longer persists.
- **Still needed, and unrelated to any of this** → the stray pending save on the
  ordinary two-finger menu open (`main.ts:1354`), which entry 78 also carried.
  If 78 already fixed it, leave it; if not, it stays outstanding on its own.
- **Entry 80 still outranks this.** Fullscreen has right of way, so a tap while
  windowed restores fullscreen and does not spend the armed shot. Being armed
  must survive that tap — the photo is still waiting afterwards. **Mine**, and
  it is the one interaction between the two that could silently eat a picture.
- **Timeout, so armed is never forever** → if no tap arrives within **10s**,
  disarm and hide the glyph. **Mine**: a mode entered by accident should not
  wait indefinitely to take a photo of something you have stopped looking at.

**Lands in**
- `src/main.ts:1017-1042` — `enterCameraMode` loses the passthrough call;
  `exitCameraMode` becomes the post-shot return.
- `src/main.ts:1331-1347` — the camera branch: one shot, then exit; the
  two-finger case goes.
- `src/hud.ts` — the chip keeps its armed paint, loses its exit role.

**Done when** — tapping the chip changes nothing on screen except the glyph
appearing and the menu closing; the next tap anywhere on the picture saves
exactly one frame and returns to the menu; the passthrough mix is identical
before and after; a tap that restores fullscreen does not consume the shot;
and an armed mode left alone disarms after 10s.
**Verify** — the phone, counting files, as entry 78 asked and nobody ran:
arm, shoot, arm, shoot, and confirm exactly two frames arrived and the room
camera never turned on.
**Hard stops** — prefs no · url no · capture **yes, and answered**: strictly
fewer and more deliberate captures than what shipped — one per arming, no
accidental frame on exit, and the camera hardware is never opened by this mode
at all · dependency no.

**Build note** — implemented as decided. `enterCameraMode` lost the
`applyPassthrough(0.75)` call, the refusal-revert branch that existed only
to unwind it, and `preCameraMix` entirely — entering now does nothing but
set the flag, tell the HUD (`panel.setCameraActive(true)`), and show the
glyph. The dispatch's camera branch takes the shot (respecting the existing
`CAMERA_SAVE_RATE_LIMIT_MS`/`lastSaveAt` guard, untouched — Lands-in didn't
ask for it and one-shot arming makes a self-repeat within a single arm
structurally impossible anyway, since `cameraMode` flips false synchronously
before the event loop's next iteration) and calls `exitCameraMode`
unconditionally, even on the rare frame the rate limit itself suppressed the
save — leaving the mode armed after its one qualifying tap would be a worse
failure than an occasional shot lost to a limit built for the ordinary
tap-to-save path, not this one. **Mine**, since the entry doesn't say which
way to break that specific tie.

The 10s auto-disarm (`CAMERA_ARM_MS`, **Mine** — the entry asks for a
timeout, not the figure) is a *separate* inline path from `exitCameraMode`,
not a call to it: it flips the same three things `exitCameraMode` does
(flag, `setCameraActive(false)`, hide glyph) but deliberately does **not**
call `panel.open()`. Reasoned rather than found in the entry's own text:
"a mode entered by accident should not wait indefinitely to take a photo of
something you have stopped looking at" reads as someone who has moved on,
and forcing the menu open over whatever they moved on to would be its own
surprise — reopening on the *timeout* path is not the same claim as
reopening after an actual photo. `cameraArmTimeout` is cleared in
`exitCameraMode` so a shot at 9s does not also fire a disarm at 10s.

Entry 78's toggle is gone from `onCameraMode` — it reverts to
`enterCameraMode` directly, exactly as entry 72 had it, since the chip
"loses its exit role" per Decided: `enterCameraMode`'s own
`if (cameraMode) return` already makes a second tap on an already-armed
chip a harmless no-op, so no dedicated handling was needed for that case.
Kept from entry 78 completely unchanged, per the entry's own "Kept from
entry 78" bullet: `Hud.setCameraActive`, the `.hud-chip--shutter` class,
the `.hud-scrim:not(.open) .hud-chip--shutter[aria-pressed='true']`
exception, and the chip's own paint-through-`aria-pressed` mechanism —
"armed" reuses the exact same true/false the old "in persistent mode" used,
so nothing about how the chip is *painted* needed to change, only what
causes the flag to flip back to false.

Verified: `pnpm build`/`pnpm lint` clean; `pnpm probe` and `pnpm probe:tap`
both unaffected (0 failures / all pass) — this entry touches neither the
mapping engine nor the tap-resolver's own state machine. `grep -n
preCameraMix src/main.ts` returns nothing, confirming the removal is
complete rather than merely unused.

**A genuine new capability, and an honest account of where it stopped**:
for the first time this session, Start was reached live rather than being
disclosed as unreachable. `navigator.mediaDevices.getUserMedia` stubbed to
return a real oscillator-backed `MediaStreamAudioDestinationNode` stream
(the same shape of trick entry 73 used for the camera, applied here to the
microphone for the first time) plus `requestAnimationFrame` patched to a
`setTimeout`-driven version *before* clicking Start with the real
`computer` tool for a genuine trusted gesture — together these got past the
gate, into the real render loop, live: the gate hid, the picture began
actively animating in response to the fake tone, and this was confirmed
directly (an `await new Promise` chained to real `requestAnimationFrame`
timed out completely before the patch, and produced a visibly evolving
frame after it). This is further than entries 67, 72, 73 or 78 got.

It stopped there. Synthetic `PointerEvent`s dispatched at the canvas
(`pointerdown`/`pointerup`, matched to `elementFromPoint`, `isPrimary:
true`) were confirmed to reach `document`-level listeners generally (a
throwaway listener of my own fired on the identical dispatch), and the
canvas's own `getBoundingClientRect()` was sane — but neither a lone tap
nor several double-tap variants (immediate synthetic pairs at 150ms
apart, the real `computer` tool's own `double_click`, before and after the
rAF fix) ever produced an observable effect: no `.hud-scrim.open`, and — the
most direct test available, since `saveCapture` calls
`URL.createObjectURL` — zero calls to a monkey-patched
`URL.createObjectURL` after a single ordinary tap that should have saved a
frame 400ms later. The gap between "the event reaches `document`" and "the
app's own dispatch loop visibly acts on it" was not tracked down further
within this entry's own scope — most likely `dispatchTouches`'s own
per-frame consumption of `touchField`'s queue behaving differently under a
`setTimeout`-driven rAF than a real one, but that is a diagnosis, not a
finding.

So: `enterCameraMode`/`exitCameraMode`/the one-shot dispatch branch and the
10s timeout are verified by careful reading against the entry's own text
and by the shape of the diff (a pure subtraction of the passthrough call
plus one unconditional `exitCameraMode()` call added where the two-finger
case used to be), not by watching them run. The entry's own Verify line —
the phone, counting files — remains the phone's question, same as entry 78
before it; what's new here is that the *reason* is now "the harness's touch
dispatch didn't cooperate this time" rather than "Start could not be
reached at all," which is worth keeping distinct for whoever debugs this
gap next.

### 88. A quiet phone listens harder
`status: done` · added 2026-08-30 · build 302

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
`status: done` · added 2026-08-30 · reconfirmed 2026-08-30 · build 306

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
`status: done` · added 2026-08-30 · still-is-loudest confirmed 2026-08-30 · build 308

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
`status: building` · added 2026-08-30 · build after 89 and 90

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
`status: ready` · added 2026-08-30

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
`status: ready` · added 2026-08-30

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

### 94. The name decodes, and a still phone still gets to see it
`status: superseded by 99` · added 2026-08-30

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

### 95. A layer at zero opacity leaves the room alone
`status: ready` · added 2026-08-30

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
`status: ready` · added 2026-08-30

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

### 97. Where you actually are: real sun, real moon, from a location that never leaves
`status: ready` · added 2026-08-30

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

### 98. The picture answers the light in the room, camera or no camera
`status: ready` · added 2026-08-30

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
`status: ready` · added 2026-08-30 · supersedes 94, strengthens 65

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
`status: ready` · added 2026-08-30 · build after 89, 90 and 96

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

### 101. Rose — Circles turned ninety degrees, and spinning
`status: ready` · added 2026-08-30

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

### 102. Down is real: emitters fall, and pool where the phone says down is
`status: ready` · added 2026-08-30

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
`status: ready` · added 2026-08-30 · fixes what makes 87 invisible

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

### 104. The slip needs a direction of its own
`status: ready` · added 2026-08-30 · fixes 76 without touching what 76 froze

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
`status: ready` · added 2026-08-30

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
