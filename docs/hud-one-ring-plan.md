# HUD refactor: one ring, icons choose its target

> **Built.** What shipped differs from the plan below in four places, each
> noted here rather than quietly folded in:
>
> 1. **The ring is the existing wedge, not a new centred one.** The plan
>    proposed the chip-anchored `RING_A0..RING_A1` arc; "the big half circle"
>    and "the main ring" meant keeping the corner-hinged wedge and swapping
>    what its single band contains. That reuses the sweep, the notch, the
>    selector, the tick rim and both drag idioms instead of replacing them, and
>    it is why the bundle got 6 KB *smaller*.
> 2. **`cycleGeometricView` was deleted**, not ported — dead across `src/`.
> 3. **The colour chip keeps its swatch dot**, against the glyph-only choice.
>    With R, G and B now three separate targets the ring can only ever show one
>    channel, so the dot is the only place the composite colour appears at all.
>    It is not a redundant value label; it is the only view of the result.
> 4. **`setPointerCapture` no longer gates the drags.** Found while making the
>    ring testable, and a real robustness bug: see the CLAUDE.md section on
>    enhancements that abort what they enhance.
>
> `NAME_PAD` also had to move from 34 to 58 — at 34 the ring's name label
> landed inside the selector's arrowhead and rendered "A▼M". The
> escaped-viewport check passed throughout, because it measures whether things
> leave the screen and not whether they land on each other.


## The change

Today the HUD is four different control idioms stacked in one place:

- three always-visible concentric **bands** (geometric, merge, atmospheric),
  each a rotating radial selector with its own resting rotation and label ring
- a **mix arc** at `R_MIX`, continuous
- five **chips** (`RGB`, `AUTO`, `MAP`, `CAM`, `NUM`)
- three chip-anchored **popups** — the colour rings, the map dial, the camera
  ring — each with its own geometry, its own drag binding, and mutual-exclusion
  logic between all three

After: **one ring**, in the big half-circle style the camera and colour rings
already use (`RING_A0 = -50°` to `RING_A1 = 50°`). Icons select what the ring
controls. The ring is the only configuration surface in the app.

This is a simplification, not a restyling. It deletes an entire class of bug
rather than fixing it: `POPUP_DIM` exists because a chip-anchored popup reaches
172px across the bands and made the HUD illegible on a phone. With no bands,
nothing can cover anything, and the dimming, the mutual exclusion, and the
three separate popup geometries all go with it.

## The core abstraction

Everything the ring can control is one of two shapes. That is the whole model.

```ts
type RingTarget =
  | {
      kind: 'enum'
      name: string            // 'ATM'
      keys: readonly string[]
      label(k: string): string
      current(): string
      commit(k: string): void
    }
  | {
      kind: 'scalar'
      name: string            // 'MIX'
      tint?: string           // channel tints; CAM_TINT for the camera
      current(): number       // 0..1
      commit(v: number): void
      format(v: number): string
    }
```

`enum` snaps to detents and shows option labels around the arc. `scalar` runs
smooth and shows one formatted value. Both use the existing
`bindArcDrag(hit, origin, a0, a1, apply, onCommit)` unchanged — it already does
exactly this job for the camera ring.

The targets:

| icon    | kind   | controls                              |
| ------- | ------ | ------------------------------------- |
| `GEO`   | enum   | geometric view                        |
| `MRG`   | enum   | merge mode                            |
| `ATM`   | enum   | atmospheric view (7 options)          |
| `MIX`   | scalar | layer mix                             |
| `MAP`   | enum   | mapping                               |
| `CAM`   | scalar | camera passthrough                    |
| `RGB`   | —      | expands to `R` `G` `B` (see below)    |
| `AUTO`  | toggle | autopilot — not a ring target         |
| `NUM`   | toggle | numeric readout — not a ring target   |

`AUTO` and `NUM` stay plain toggles. A boolean is not ring-shaped, and forcing
it into one would be worse than the inconsistency.

## The icon row

Glyph only — no value beneath. Chosen deliberately for a quieter row.

**Consequence, accepted rather than discovered later:** the autopilot changes
the view on its own, and with no value on the icons there is nowhere to see
that it did unless the ring is pointed at that target. The ring's label covers
the active target and `NUM` reports the director's state; nothing else does.
If this bites, the chip markup already carries an unused `<b></b>` slot and
turning the labels on is a one-line change.

**`RGB` expands.** Tapping `RGB` replaces that one slot with three tinted
sub-icons `R` `G` `B`, and the ring takes the selected channel. Picking any
other target collapses it back. The row reflows by roughly two chip widths, so
the reflow must be checked at 320×568 before it is believed — the row is
already four chips wide there.

## Geometry

One ring, centred, in the existing `RING_*` constants. The mix arc's radius
`R_MIX` and the band radii `R_GEO`/`R_MRG`/`R_ATM` all disappear.

The ring is anchored to the dial centre, not to a chip. Chip-anchoring existed
so a popup sat above the button that opened it; with one permanent ring there
is no popup and no reason for it to move. This also removes the whole class of
"where is the chip on screen" measurement.

## What gets deleted

`CLAUDE.md` says deleting code deletes what it was doing, and this deletes a
lot. Audit each before removing — this list is the checklist, not the diff:

- `POPUP_DIM`, `popupOpen()`, `bandTracks`, the dimming in `paintBands()`
- `closeColourPopup()`, `closeMapDial()`, `closeCamRing()` and every
  cross-call between them
- `mapDial*` (labels, track, tick, hit, `mapRot`), `paintMapDial()`,
  `mapDialCenter()`, `MAP_R`, `MAP_PITCH`
- the colour ring arrays, `colourCenter()`, `ringRadius()`
- `Band<K>`, the `bands` array, `bandNamed()`, `restingRot()`,
  `restingRotOf()`, `paintBands()`, `PITCH`, `CUTOFF`, `LABEL_OFFSET`,
  `NOTCH`, `SWEEP_A`, `SWEEP_B`
- `cycleAtmosphericView` reaches into a band's `rot`, and is **bound to a swipe
  gesture** (`main.ts:180` → `gestures.ts:66`). It must keep working, against
  the target model instead. This is the trap in the refactor: the binding is
  not visible from `hud.ts`'s own surface, and the band it depends on is on the
  deletion list.
- `cycleGeometricView` sits on the `Hud` interface beside it and is **called
  from nowhere** — checked across `src/`. It is dead, and goes. Worth noting
  the asymmetry was invisible until looked for: the two read as a matched pair
  on the interface, and only one of them does anything.

## Hard stops

Checked against `CLAUDE.md`, all four are **no**:

1. Stored `Prefs` shape — unchanged. Every value the ring edits already exists.
2. URL parameters — unchanged.
3. Capture and privacy — nothing new captured, no request, no prompt.
4. New runtime dependency — none.

So this is implemented directly with `pnpm build` as the gate, no proposal
needed beyond this document.

## Verification

1. `pnpm build`, `pnpm lint`, `pnpm probe:fullscreen`, `pnpm probe:shake` clean.
2. **The assembly, not the parts.** `hud-narrow.html` at 320×568 and 360×640,
   with each target selected in turn, and with `RGB` expanded. The last HUD
   regression shipped because three tasks were each verified alone and the
   assembled screen never was.
3. Every target reachable and committing: change each, reload, confirm it
   persisted through `prefs`.
4. Swipe gestures still cycle the geometric and atmospheric views.
5. Autopilot still drives views with the HUD open, and the ring reflects a
   change the director makes while that target is selected.
6. `AUTO` and `NUM` still toggle.

## Sequencing

Small enough to keep the HUD working at every step, which matters because this
is the only way to change anything in the app.

1. Introduce `RingTarget` and the single ring, rendering alongside the existing
   bands. Wire `MIX` and `CAM` to it first — both scalar, both already ring-shaped.
2. Move the enum targets across (`GEO`, `MRG`, `ATM`, `MAP`), still alongside.
3. Move colour across, with the `RGB` expansion.
4. Delete the bands, the popups, and the dimming — the audit list above.
5. Re-check the assembly at both narrow sizes.

Steps 1–3 leave the app fully usable if interrupted. Step 4 is the irreversible
one and is where the deletion audit is spent.
