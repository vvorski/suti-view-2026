# The toy wants to be played with

Design note, 2026-08-30. Victor's words, recorded because nine decisions in one
day all moved the same way and the tenth should not have to be argued from
scratch.

## The pattern

Every one of these was decided toward restraint when it was first built, and
every one was overturned toward invitation today:

| what | was | is |
|---|---|---|
| touch, entry 33 | Circles only | every geometric view |
| a tap, entry 50 | opens the panel, does not emit | plays, everywhere |
| the hard shake, entry 36 | needed 42.3 m/s², unreachable | 34.2 |
| the director, entry 45 | off by default, silent for 180s | always on, 30s |
| the fullscreen chip, entry 42 | tucked in the corner, off the picture | the middle of the screen |
| the gate's type, entry 43 | small, out of the picture's way | a fifth larger, on a band |
| the picture, entry 47 | dark | a day mode that survives sunlight |
| a still hand, motion note | identical to a still table | slight but visible |
| the emitter in a screenshot, entry 50 | keep the frame clean | keep the ring you made |

Nine, in one direction, in one day.

## Why the old answers were not wrong

This is the part worth keeping, because "we were too timid" is the lazy reading
and it is false. Each restraint was chosen against a real failure that had
already happened or was about to:

- The director's 180-second suspend exists because **an autopilot that
  overrides a deliberate choice thirty seconds later is worse than no
  autopilot**. That is still true. It is simply no longer the failure we have.
- The tumble's caps exist because past them **the image reads as broken rather
  than disturbed**, and entry 32 refused whole-frame scale as *the one coupling
  that turns responsive into nauseating*. Still true. Still binding.
- The gate was stripped because **a permanent label in the corner of a piece
  left running is litter**. Still true, and it is why entry 44 keeps the chip
  treatment on the start screen only.

So the rule is not "be louder". Each of those decisions was correct against the
failure it was aimed at.

## What actually changed

**The cost function.** All of that restraint was tuned for a piece left
running, alone, on a propped-up phone — where the enemy is *annoyance*: a
strobe, a nag, a thing that fidgets while you are trying to look at it.

The app is now being handed to people. In someone's hands for thirty seconds,
the enemy is not annoyance. It is **invisibility** — a shake that does nothing,
a mode that waits three minutes, a tap that is politely ignored. A person who
touches a thing and gets nothing back does not conclude "how restrained". They
put it down.

Both failures are real, and the app has to survive both, because the same
build does both jobs. The resolution is not to pick one:

> **Restraint belongs in what persists. Generosity belongs in what responds.**

A thing that changes on its own while nobody is touching it should be slow,
quiet, and hard to trigger — the tumble caps, the director's dead bands, the
faded corner. A thing that answers a person should answer immediately, visibly,
and without a threshold in front of it — touch, shake, tilt.

That is why entry 45 could drop the director's suspend to 30 seconds while
entry 32 still refuses to touch whole-frame scale, and why both are right.

## Using it

When a fork is "should this be easier to trigger", ask which half it is in.

- **It responds to a person** → no threshold, immediate, slightly more than
  expected. Make the first touch worth a second one.
- **It happens on its own** → every dead band and cap already in the code
  stays, and the burden is on the change to say why.

And when the answer is genuinely both — the shake, which is a person's gesture
producing an autonomous-looking change — the person's half gets the generosity
and the picture's half keeps its caps. That is exactly what entries 35 and 36
did: the ladder got easier to climb, and nothing about what it does at the top
got wilder.
