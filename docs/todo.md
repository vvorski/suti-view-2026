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

### 1. Read the shake diagnostics off a real phone
`status: blocked` · added 2026-08-29

**Do** — get the `motion N ev  peak X/18` line from Victor's phone with
`?debug` on, and act on whichever of the two causes it names.
**Why** — the shake has been rebuilt twice against synthetic evidence. The
readout exists precisely to separate "no devicemotion arriving at all" from
"arriving, and never reaching STRONG_UP", and those want opposite fixes.

**Decided**
- Guess vs measure → measure, over shipping another speculative threshold. See
  CLAUDE.md, "Two identical symptoms need two different numbers".

**Lands in** — nothing until the number is known. `src/shake.ts` if the peak is
healthy; a permissions/HTTPS-context hunt if `motion` is stuck at 0.
**Done when** — a shake on Victor's phone re-rolls the view, confirmed by him.
**Verify** — `pnpm probe:shake` stays green; the change is checked on the device
that reported it, not on a synthetic case.
**Hard stops** — prefs no · url no · capture no · dependency no.

**Blocked on:** one line of `?debug` output from the phone.

### 2. Decide whether the privacy line comes back to the gate
`status: blocked` · added 2026-08-29

**Do** — either restore one short line to the start screen, or record that the
page deliberately makes no on-screen promise about capture.
**Why** — build 66 removed the two paragraphs at Victor's instruction. They
carried "the audio never leaves this device" and the only disclosure of the
camera layer. CLAUDE.md's third hard stop names that copy as a promise the page
makes, so its absence should be a decision on the record rather than a side
effect of a layout change.

**Decided**
- Remove the paragraphs → done, at Victor's explicit instruction, over keeping
  a compact version. What remains open is only whether *anything* replaces them.

**Lands in** — `index.html`, the gate markup.
**Done when** — either the line is on screen, or this entry is closed `done`
with the decision written into CLAUDE.md's hard-stop section.
**Verify** — the gate still fits at 320x568 with the line present.
**Hard stops** — capture **yes**: this *is* the capture hard stop. Needs
Victor's answer either way.

**Blocked on:** yes or no to a single line under the QR.

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
