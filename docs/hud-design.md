# The HUD's design language

This is the reasoning behind the control wedge in `src/hud.ts`, kept apart from
`CLAUDE.md` because a rules list has no room for *why*, and the why is most of
what keeps this consistent as more controls arrive. `CLAUDE.md` states the one
rule that must never be broken; this file explains everything built on top of
it.

## The one rule: circular, always

Every control is an arc about the wedge's hinge, just outside the screen's
bottom-right corner. No straight edges, anywhere, ever — not a slider track,
not a list row, not a settings panel with rectangular cards.

This was tried the other way first. A rectangular panel of sliders shipped and
was rejected on sight: it read as a settings screen bolted onto a piece of
generative work, not as part of it. The wedge is also a better fit for how a
phone is actually held — a thumb pivots from near the corner it rests in, so an
arc there is reachable one-handed in a way a panel across the whole width never
is.

What this allows: bands turned past a notch, arcs dragged for a value,
circular chips laid along an arc, text sitting on the notch line. What it
forbids: linear sliders, list rows, tables, cards, bottom sheets — any panel
whose own edges are the controls' edges. A new control that doesn't fit this
vocabulary is a sign to change the control, not to bend the rule.

## Texture: what a band's stroke says about its layer

Every band used to be drawn identically — a plain stroke, one width for a
"turn" band and another for a "drag" band, coloured only by its layer's tint.
That meant the *only* thing distinguishing the geometric layer's Opacity band
from the camera's was hue. Colour disappears in bad light, on a colour-blind
viewer, in a screenshot converted to greyscale for a bug report — anywhere
that isn't this exact screen in this exact room. Texture doesn't.

The rule: **texture describes the material, and only the layer's own thin
value bands carry it.**

- **Geometric — solid, square caps.** Drawn line work: the plainest possible
  reading of "a stroke", butted rather than rounded at its ends.
- **Atmospheric — a soft, faint halo behind the stroke.** A continuous field
  reads as a glow, not an edge — the halo is a second, wider, low-opacity path
  drawn behind the real one (`.hud-halo`, opacity 0.22, three times the stroke
  width).
- **Camera — segmented**, a dashed stroke. Sampled reality, not drawn: a
  passthrough image is built from discrete pixels, not a continuous line, and
  a broken stroke says so.
- **Listening — no texture, because it has no value band.** Its one control,
  Map, is a turned/enum band, and enum bands are explicitly excluded (below).
  Its identity doesn't need one anyway: it is the only group with a single
  band, so it is already unmistakable in shape, and its icon — three
  concentric arcs — is unlike anything else on the icon arc. Texture exists to
  break a tie; there's no tie here to break.

### Why only the thin bands, and not the turned ones

Only `Opacity` gets the treatment above. `View`, `Merge`, and `Map` — the
turned/enum bands — never do, on purpose: an enum band is a 30px+ track with
option labels sitting directly on it, and texturing it puts a pattern under
text. This HUD has been made illegible once already by exactly that shape of
mistake (see `POPUP_DIM` and the popup-over-bands history in `hud.ts`) — it
isn't a mistake worth repeating for a texture that's decorative, not
functional. A band with no text to compete with is where identity can live for
free.

### Why R/G/B stay uniform

Colour bands are the one thin-band exception: every layer's R, G, and B look
identical, deliberately. A colour band must be recognisable as *a colour
band* the instant you see it, on any layer — if texture varied by layer here
too, "which control is this" would depend on remembering which layer you're
in, exactly the ambiguity this whole entry exists to remove. Texture answers
"which layer"; it must never also have to answer "which kind of control".

### A watch-for that turned out not to bite

Camera's `Opacity` is segmented and sits at the wedge's outermost radius,
where option labels would otherwise be at their most crowded. That's not
actually a collision: the camera group has no `View` or `Merge` band above it
to put text there, and camera's own `Opacity` carries no option labels of its
own (it's a drag band, not a turn band). The concern was worth checking before
building this — it just didn't end up being true of the final shape, because
only `Opacity` ever gets textured, and `Opacity` never sits under text.

## `BAND_R`: the radius ladder

```
[0.88, 0.75, 0.63, 0.53, 0.43, 0.33]
```

Fractions of the smaller viewport dimension, outermost first, one slot per
band a group might draw. A group with fewer bands just uses the first few —
the spacing is fixed and never depends on how many happen to be in use.

- **0.88, 0.75** (View, Merge) — spaced 0.13 apart, the widest gap on the
  ladder. These are the two enum bands with the widest tracks
  (`max(30, base * 0.09)`, thicker than a scalar band's fixed 7px), so they
  need the most room to avoid visually merging into one another.
- **0.63** (Opacity) — 0.12 below Merge. Still an enum-to-scalar transition, so
  slightly more room than the scalar-to-scalar gaps below it.
- **0.53, 0.43, 0.33** (R, G, B) — spaced 0.10 apart, the tightest and most
  uniform spacing on the ladder, because three colour bands read as one
  related group and should look like it.
- **0.33 is new** (this entry, following on from the per-layer merge mode
  entry that took the ladder from five slots to six). It isn't a cautious
  choice: the old single merge-mode band lived at 0.30 in the now-retired
  `set` group, so an arc this small was already proven draggable on a phone
  before this ladder ever needed a sixth slot.

The grab arcs (`GRAB_PX = 24`, so 48px wide) overlap slightly at every gap
below 0.13 — true of R/G/B before this entry and still true now that Merge and
Opacity sit at a 0.12 gap too. This isn't a defect: grab arcs are drawn and
hit-tested in the same order as the bands array, innermost last, so the
innermost band of any overlapping pair always wins the ambiguous strip. That
has been true since the first three-colour-channel wedge and nothing here
changes it.

## Colour roles

Two colour systems are at work, and they never share a hue on purpose:

- **Layer tints** — geometric `#9d9bf0` (violet), atmospheric `#4dd6ff`
  (cyan), camera `#ffcf8a` (amber), listening `#c8c4e6` (pale violet-grey,
  deliberately close to geometric's since it's the "belongs to everything"
  group, not a fifth layer). These colour a group's chip and its non-colour
  bands' knobs/fills.
- **Channel tints** — R `#ff4d5e`, G `#4dff8f`, B `#5c8bff`. Fixed, and the
  same on every layer, for the same reason their texture is uniform: a colour
  band's own colour is part of what makes it legible as "the red channel"
  regardless of which layer it's tinting.

A layer tint and a channel tint are never the same hue family by coincidence —
if they collided, "what does this colour mean here" would depend on which
band you were looking at, which is the exact ambiguity texture and colour role
both exist to prevent.

## Forbidden, with examples

- **A straight track.** Any `<rect>` or `<line>` (other than a tick, which is
  radial and short, not a track) in the control surface. `hud-probe.html`'s
  `describe().straightEdges` asserts this at zero; it must stay zero.
- **Texture on an option band.** Dashing or haloing `View`, `Merge`, or `Map`
  puts a pattern directly under their option labels — the specific mistake
  `POPUP_DIM` exists to prevent elsewhere in this file, reintroduced through a
  different door.
- **A colour band that looks different per layer.** Defeats the one thing
  colour bands are for: being recognisable at a glance, on any layer, without
  reading a caption first.
- **A texture invented to fill a group that doesn't need one.** Listening has
  no manufactured texture. Giving it one anyway — texturing its `Map` band, or
  inventing a decorative element with no functional role — would be exactly
  the "identity survives only in the tint" failure this entry's own
  falsification test (render each group greyscale, check they're still
  distinguishable) is designed to catch, just self-inflicted instead of
  found by the test.
