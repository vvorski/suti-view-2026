# Motion as a continuum

Research note, 2026-08-30. Prompted by: *"moving the phone always disturbs the
colours a little and shaking a lot scrambles all — we need to be constantly
aware of motion and physicality."*

The conclusion up front, because it is smaller than the question sounds: **the
continuum already exists and is already measured every frame. It is wired to
exactly one consumer, and that consumer is geometry.** Nothing about colour,
opacity, or any view parameter has ever been told the phone is moving. The
work is not building a motion sense. It is connecting the one that is already
running.

## What is measured today

`shake.ts` computes `disturb` on every motion sample: the AC component of
acceleration — gravity estimated as the slow-moving part and subtracted, not
differenced — normalised as

```
disturb = clamp01((mag - FLOOR) / (FULL - FLOOR))     // FLOOR 1.2, FULL 14
```

and decayed toward zero with a 0.7-second time constant. It is a proper
continuous quantity, not a flag, and `pnpm probe:shake` already prints it for
every handling case in the suite:

| what the phone is doing | disturb |
|---|---|
| still on a table | 0.00 |
| held in a hand (0.4 m/s² tremor) | 0.00 |
| walking (3 m/s², 2 Hz) | 0.15 |
| a nudge (8 m/s², one cycle) | 0.54 |
| a jolt (10 m/s², half cycle) | 0.57 |
| gentle sustained shake (12 m/s²) | 0.86 |
| deliberate shake (28 m/s²) | 0.98 |
| single hard knock (30 m/s²) | 0.98 |

That table is the whole range of ways a person handles a phone, already
resolved to two decimal places. Whatever "constantly aware of motion" is going
to be driven by, it is this number.

## What it drives, and what it does not

`disturb` kicks two springs — a rotation and a drift — and sets the overscan
that hides the corners they expose. `ROT_STIFF` 158 against `ROT_DAMP` 10.1,
capped at `MAX_ANGLE` 0.26 rad and `MAX_OFFSET` 0.055 uv, with the damping
ratios deliberately under 1 and the two frequencies deliberately different so
the picture does not move as one rigid object.

That is a considered piece of physical modelling, and it is the entire
consumer. `disturb` reaches the composite as `uTumble` and stops there.

So the app's response to being handled is **continuous in geometry and
discrete in everything else**. The only path from movement to colour is the
shake ladder, and that path requires a *qualifying* shake: three direction
reversals above 18 m/s² inside 1.2 seconds. Below that bar, movement produces
no colour change of any kind — not a small one, none.

**That discontinuity is the thing being complained about.** A held phone that
is being tilted and turned produces a picture that slides and rotates but whose
palette is exactly as still as a phone on a table. It reads as a machine with a
button on it rather than as an object with weight, and no amount of tuning the
shake threshold fixes that, because the problem is on the other side of the
threshold.

## Three tiers, one continuum

The useful frame is that physicality has three timescales, and the app
currently implements only the middle one.

**Posture — works while perfectly still.** `gravity()` already returns the
horizontal component of the gravity estimate as −1..1 = sin(tilt). It is a
*posture* signal rather than a motion one: it is meaningful when nothing is
moving at all, which is exactly the gap that `disturb` cannot fill. Today it is
read only when gravity mode is switched on (entry 30). A slow, always-on
colour bias from tilt would mean the picture is never in the same state twice
because the phone is never at quite the same angle twice — and it costs
nothing, because the number is already computed.

**Disturbance — the missing wire.** `disturb` into colour, continuously and
proportionally. This is the literal request: any movement shifts the palette a
little. The shake ladder then stops being a separate mechanism and becomes the
top of the same continuum — a hard shake scrambles everything because it is the
far end of a curve that has been responding all along, not because it crossed a
bar.

**Agitation — memory, which does not exist at all.** `disturb` decays in 0.7
seconds, so the app has no notion of *having been handled*. A phone carried
across a room for a minute and a phone that has sat on a table look identical
the instant the carrying stops. A slow accumulator — rising with `disturb`,
settling over something like thirty seconds — is what would make the toy feel
alive rather than merely reactive: a state your handling changes and that comes
back down on its own. This is the one genuinely new quantity, and it is about
four lines.

## Two constraints the code already knows about

**The floor is set above a hand.** `FLOOR = 1.2` has a comment explaining
itself: a phone face-up reads a few hundredths, *a hand holding it reads a few
tenths*, and 1.2 clears both "without needing real movement". So a held phone
reads `disturb` 0.00 **by design**. "Constantly aware" therefore cannot be
achieved by leaning harder on `disturb` — at rest there is nothing there to
lean on. Either the floor comes down, which the gravity-estimate comment warns
turns sensor noise into signal, or the at-rest tier is posture rather than
motion. Posture is the cheaper and more honest answer, and it is why tilt is
listed first above.

**Geometry is already saturated.** The caps carry the reason in the source:
past them "the image reads as broken rather than disturbed, and the overscan
needed to hide the edges would be a visible zoom". Entry 32 reached the same
conclusion from the other direction, refusing to touch the composite's
whole-frame scale on the grounds that it "is the one coupling that turns
responsive into nauseating". So new motion response should go into colour and
slow parameters, not into more movement. The picture should *change* more with
handling, not *swing* more.

## What this would be, as work

One entry, not a project, because the recon collapses most of it:

- `disturb` is already computed, normalised, decayed and probe-covered.
- `gravity()` is already computed and already capped against the same
  `MAX_OFFSET` the tumble uses.
- The shake ladder's constants do not move; it becomes the top of a curve
  rather than a threshold with nothing below it.
- The only new state is the agitation accumulator.

**Answered, 2026-08-30: slight but visible.** A still hand and a still table
should differ enough to notice if you look, and not more. So posture biases the
palette rather than repainting it, and picking the phone up should read as
waking something rather than as changing a setting.

That answer has a consequence worth stating before anyone builds it: **every
screenshot becomes slightly unrepeatable**, because the tilt at the moment of
capture is part of the picture. That is the intended trade and not a defect, so
nothing downstream should try to normalise it away — but it does mean a
side-by-side comparison of two builds has to hold the phone still in the same
attitude to be worth anything, which is a new rule for anyone judging a change
by eye.
