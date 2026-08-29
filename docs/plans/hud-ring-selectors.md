# Plan: every HUD selector is a circle

## Addendum (Task 3) — a circle is not yet rotary

Task 1 gave `mapping` a tap-to-pick fan: three small circles you tap
directly. That satisfies "every selector is a circle" as a shape claim, but
not the follow-up Victor gave once he'd seen it: **"fix the UI so all
controls are Rotary."** A control you tap is not rotary regardless of what
shape the target is. Task 3 below replaces the fan with an actual
turn-to-select dial, reusing the drag-and-snap physics the three main bands
already have rather than the tap-a-circle idiom Task 1 introduced.

**What stays as approved, and does not become rotary:** `auto` and
`numbers` are two-state toggles — there is nothing to turn *to* besides the
other state, so turning a dial to flip a coin is a control for a control.
They stay a direct tap on a circular chip, per Victor's explicit call when
this addendum was scoped. Task 2's colour rings (drag-along-an-arc) already
are rotary and need no revisiting.

## Context

The HUD (`src/hud.ts`) has two families of control today, and they don't
speak the same visual language. The three arc bands (geometric, merge,
atmospheric) and the mix arc are already rings — you swipe along a curved
track and whatever settles under the notch is selected. But the four
controls in the bottom-left corner (colour, auto, mapping, numbers) are
flat rectangular HTML buttons (`.hud-btn2`), and tapping "colour" opens a
rectangular panel of three linear range sliders (`.hud-rgb`).

Victor's request: make every selector in the HUD a circle, and make
selecting from one work by popping a different circular selector up on top
of the one that was tapped, so every selection in the HUD happens on a
ring rather than in a rectangle.

This is a look-and-interaction change confined to one file. It does not
change what is stored (`Prefs` in `prefs.ts` keeps its exact shape — same
fields, same meanings), what is read from the URL, what is captured, or
what runs. All four Hard Stops in `CLAUDE.md` are clear: no `Prefs` change,
no URL parameter change, no capture change, no new dependency — everything
here is built from the DOM/SVG primitives `hud.ts` already uses.

## Design

Two shapes of control exist among the four buttons, and they don't want the
same popup:

- **auto** and **numbers** are two-state toggles. A toggle has nothing to
  choose between besides on and off — popping a second selector on top of
  a two-state circle to ask "on or off?" is a control for a control. These
  become circular chips that flip state on a direct tap, exactly as they do
  today, just circular instead of rectangular.
- **mapping** is a fixed three-way cycle (Relative / Absolute / Normalised).
  Today a tap silently advances it by one with no visible choice. That
  becomes a genuine selector: tapping the mapping chip pops a small ring of
  three circular options fanned out around it; tapping one commits it and
  the popup closes. This is the "different selector on top of this one"
  the request describes, applied to the one control that actually has more
  than two states to offer.
- **colour** is not a discrete choice at all — it is three continuous 0-1
  gains. The existing rectangular panel with three linear sliders is
  replaced by a popup built from the same primitive as the main dial bands:
  three concentric partial rings around the colour chip, one per channel,
  each dragged along its own arc the same way a dial band is dragged along
  its track. This keeps the "selection happens on a ring" property for a
  continuous control instead of a discrete one, rather than forcing RGB
  into a tap-to-choose fan that would need 101 positions per channel.

Both new popups are positioned centred on the chip that opened them, drawn
into the existing full-screen `svg` (`.hud-dial`) so they can sit above
everything else the same way the current dial does — the four chips
themselves stay HTML, in `.hud-btns`, exactly where they are now.

## Global Constraints

Binding on every task. A task reviewer checks against these verbatim.

1. **No change to `Prefs`.** `prefs.ts` is untouched. Every value already
   stored (`geoColour`, `mapping`, `autopilot`, `showStats`) keeps its
   exact type and meaning — only how it is *set* changes.
2. **No new uniforms, no shader changes, no change to `views.ts` or
   `merge-modes.ts`.** This is HUD-only. The only file either task may edit
   is `src/hud.ts`.
3. **No new runtime dependency.** Build the fan-out and the radial sliders
   from the SVG/DOM/pointer-event primitives already used for the three
   dial bands and the mix arc in this file — do not reach for an icon
   library, a gesture library, or an animation library.
4. **Mobile-first, one thumb.** Every new hit target is at least the
   `GRAB_PX`-scale this file already uses elsewhere — do not shrink a tap
   target to fit a cramped layout. A popup must not require a second hand
   to dismiss: tapping the scrim, tapping the chip again, or picking an
   option all close it.
5. **The RGB values must still be exact and legible.** The current panel
   shows a live 0-100 readout per channel via `<output>`. The radial
   replacement needs some way to read the exact number too — a live label
   is enough; it does not need to be a `<output>` element specifically.
6. **Follow this file's existing idioms**, not new ones invented from
   scratch: `polar()`/`arcPath()` for geometry, `pointerdown`/`pointermove`
   with `setPointerCapture` for drags, `paintX()` functions that re-read
   state and re-render rather than storing derived UI state, and
   `e.stopPropagation()` on anything that must not also close the HUD via
   the scrim.
7. **Comments carry the reasoning**, in the register of the rest of this
   file — see the header comment and the comments on `R_GEO`/`PITCH`/
   `CUTOFF`/the `.hud-btns` CSS block for the register: what was tried,
   what failed, what breaks at another value.
8. **Verified on a GPU-having browser**, per `CLAUDE.md`'s "Verify in the
   thing, not in your head": a throwaway probe page driving `createHud`
   directly with stub handlers, screenshotted at each state named below.
   `pnpm build` passing is not evidence for a UI change — it proves types
   line up, nothing about whether a tap lands where it should or a popup
   renders in the right place.

## Task 1 — Circular chips, and a real selector for mapping

**File: `src/hud.ts` only.**

1. Replace `.hud-btn2` styling so `colour`, `auto`, `mapping`, and
   `numbers` render as circular chips (a fixed diameter, centred label or
   short glyph) rather than the current rectangular pills. Keep them in
   `.hud-btns`, in the same stacking order, at the same corner. `auto` and
   `numbers` keep their current tap-to-toggle behaviour, just in the new
   shape.
2. Give `mapping` a real popup: tapping it opens a small ring of three
   circular options (Relative, Absolute, Normalised) fanned out around the
   chip — drawn into the existing `svg`, positioned from the chip's own
   `getBoundingClientRect()` converted into the SVG's coordinate space (see
   `localAngle()` for the existing pattern of that conversion). Tapping an
   option commits `prefs.mapping`, fires `handlers.onMapping`, persists via
   `savePrefs`, and closes the popup. Tapping the mapping chip again, or
   tapping the scrim, closes it without changing anything.
3. Only one popup (mapping's fan, or a later task's colour rings) is open
   at a time — opening one closes any other.

Do **not** touch the RGB panel or the colour button's behaviour in this
task; that is Task 2, and touching both in one task makes either one's
diff too large to review as a unit.

### Verification
- Screenshot the closed HUD: four circular chips, correctly labelled,
  correctly positioned, same corner as before.
- Tap `auto` and `numbers`: state flips, chip reflects it, no popup
  appears.
- Tap `mapping`: three-option fan appears around the chip. Tap each of the
  three in turn and confirm `prefs.mapping` and the chip's own label update
  to match, and the fan closes after each pick.
- Open the mapping fan, then tap the scrim: it closes with no change.
- Open the mapping fan, then tap `auto`: the fan closes (only one popup at
  a time) and `auto` still toggles.

## Task 2 — Colour becomes three radial sliders

**File: `src/hud.ts` only.**

Replace `.hud-rgb`'s three linear `<input type=range>` rows with a popup
drawn the same way Task 1 drew the mapping fan: into the existing `svg`,
centred on the `colour` chip. Inside it, three concentric partial-ring
tracks — one per channel (R outermost, G, B innermost, or whatever nesting
reads clearest once it's on screen) — each a short arc (not a full circle;
a full 360° drag has no natural start/end for a 0-100 value) that the user
drags along, exactly the way `bindMixDrag` already turns an angle into a
0-1 value for the mix arc. Reuse that arithmetic rather than re-deriving
it. Each ring's fill length shows the current value the way the mix arc's
fill shows `prefs.mix`; each ring also gets a small numeric label so the
exact value is still legible (Constraint 5) — it does not need to be an
`<output>` element, since the whole popup is now SVG, but the number must
update live while dragging, the same as the existing `<output>` did.

The three-swatch preview (`.hud-swatch`) and the `colour` chip's own
`R/G/B` caption both currently read from `paintRgb()`; keep both working
against the new control, updating live while a ring is being dragged, not
only on release.

### Verification
- Tap `colour`: three concentric ring tracks appear around the chip, each
  showing the current channel value, matching what the old sliders showed
  for the same starting `geoColour`.
- Drag each ring through its own range: the fill sweeps, the numeric label
  updates continuously (not only at drag end), and `handlers.onGeoColour`
  fires with the changed channel.
- Release a drag: value persists (`savePrefs` called once, not on every
  move — match the old sliders' commit-on-release discipline, not the old
  panel's per-input persistence which this file's comments already flag as
  wrong for a dragged control).
- The swatch preview and the chip's caption both update to match, live.
- Reopen the HUD after a colour change: the rings show the persisted value,
  not the default.
- Tapping the scrim, or `colour` again, closes the popup without altering
  the pending drag's value beyond whatever was already committed.

## Task 3 — Mapping's fan becomes a turn dial

**File: `src/hud.ts` only.**

**This supersedes Task 1 §2.** Delete the tap-to-pick fan (`hud-fan-*`
elements, the fan-open state, the option `pointerup` handlers) and replace
it with a compact rotary control: a short arc track, popped centred on the
`mapping` chip exactly where the fan used to appear, carrying the same
three options (Relative / Absolute / Normalised) laid along it at a fixed
angular spacing. The user drags along the arc; whatever settles under a
notch when the drag ends is committed — the same interaction the three main
bands already have, at a smaller radius and a shorter arc.

**Do not duplicate the drag-and-snap arithmetic a second time.** The three
main bands already do exactly this — angle-to-index via `delta()`, clamped
rotation between `0` and `-(keys.length-1) * PITCH`, snap-on-release,
`restingRot()` to park the current value under the notch on open — all
inside `bindBandDrag()` and `Band<K>`, both keyed off the single fixed hinge
at `(cx, cy)`. This dial is the same shape of problem centred somewhere
else. Per this project's own rule about a boundary growing a second tenant
(`CLAUDE.md`, "Refactor as part of the feature"): the moment a second thing
needs the same arc-drag-and-snap logic, it stops being `bindBandDrag`'s
private implementation detail and becomes a function of an arbitrary
centre, radius, and option count that both the main bands and this dial
call. Generalise it; do not copy it.

The popup:
- Opens on tapping `mapping`, with the currently-selected option resting
  under the notch (mirroring `restingRot()`'s behaviour for the main
  bands).
- Closes three ways: completing a drag and releasing (turning to a value
  *is* choosing it — no separate confirm tap, matching how the main bands
  commit on release), tapping the scrim, or tapping the `mapping` chip
  again without having dragged.
- Stays mutually exclusive with Task 2's colour rings — opening this closes
  that popup and vice versa. Task 2 will have landed by the time this task
  starts; read its actual mechanism rather than assuming Task 1's flag
  shape, since Task 1's fan-open flag is exactly what this task deletes.
- A drag released before or past either end clamps to the nearest real
  option, the same way the main bands' rotation clamps rather than wraps.

**Also close a gap Task 1 left**, since this task rewrites the same
control's paint function anyway: `mapBtn` currently gets `aria-expanded`
but never `aria-pressed`, so unlike `rgbBtn`/`autoBtn`/`statsBtn` it never
visually reads as active while its popup is open. Give it the same
`aria-pressed` treatment the other three chips have.

Do **not** touch `auto`, `numbers`, or anything in Task 2's colour-ring
popup beyond the one hook needed for mutual exclusion.

### Verification
- Tap `mapping`: an arc with three positions appears where the fan used to,
  notch resting on whichever option `prefs.mapping` currently is.
- Drag from the current option toward another and release mid-arc, past
  the target: it snaps to the nearest real option, not to wherever the
  finger let go.
- Confirm the commit: `prefs.mapping` changed, `handlers.onMapping` fired
  once with the new value, `savePrefs` called, chip caption updated, dial
  closed.
- Drag past either end of the arc: clamps to the first/last option rather
  than wrapping or escaping the track.
- Tap `mapping` to open, then tap it again with no drag: closes, no change.
- Tap the scrim while the dial is open: closes, no change.
- Open the mapping dial, then open `colour`: the mapping dial closes (and
  the reverse, opening mapping while colour's rings are open, closes
  those).
- Drive the drag with real `PointerEvent`s carrying a `pointerId`
  (`pointerdown` → several `pointermove`s → `pointerup`) — this file uses
  `setPointerCapture`, and calling internal functions directly proves far
  less.
- `mapBtn` shows `aria-pressed="true"` while its dial is open, matching the
  other three chips.
