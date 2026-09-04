---
name: aaa
description: Use when an idea arrives that should be captured without derailing whatever is being built — takes a rough idea, does the recon, decides everything it can defend and asks only about hard stops and genuine taste forks, then appends a build-ready entry to docs/todo.md. Invoke as /aaa <idea>.
---

# aaa — idea in, buildable entry out

Catch an idea mid-flight and leave it in a state somebody can pick up cold.

**Core principle: an entry is ready when someone with no memory of this
conversation can build it without making a single judgement call you could have
made for them.** Entries do not fail by being short. They fail by containing an
unresolved fork, and the builder's guess is worse than its question.

This is the light path. `spec-to-issue` and `auto-issue-gogo` are the heavy one
— a full spec on a GitHub issue, labels, a branch per issue, an autonomous
loop. Use those when work will be handed to an agent unattended. Use this when
the point is to *not stop*: the main loop keeps building, and the idea lands in
`docs/todo.md` ready for later.

**`/bbb` builds what this one writes, and `/ccc` checks what `/bbb` shipped.**
Read its *How the pair fits together* section once — the seam between them is
what makes either work. The short form: an entry is the only channel between
the two, this half never builds and that half never invents, `building`
protects an entry's text but not its idea, and only `/bbb` pushes.

## The shape of the run

**Recon → decide → write → commit.** Four steps, and the first is what earns
you the right to do the second without asking.

### 1. Recon first, briefly

Never ask what you could answer yourself — and, now, never ask what you could
*decide* yourself. Recon is what turns a guess into a call you can defend.
Spend a couple of tool calls establishing:

- Where the idea would land. Grep for the thing it touches; get `file:line`.
  **Count what you find, never recall it** — entry 106's Lands-in said "the six
  ripple shaders" and there were seven; Rose had arrived after that sentence was
  written and nobody re-counted.
- **Search `docs/todo.md` *and* `docs/built.md` for it first** — one `grep` over
  both, never one file. `built.md` is where verified entries are archived, and
  it is where the answer usually is: the highest-value finding this skill
  produces is *"that is already built, here is the line that hides it"*, and
  searching only the live queue is exactly how that finding gets missed. Twice
  in one weekend the right action
  was to strengthen an existing entry rather than write a new one (73, then 89).
  A second entry for a fault already diagnosed splits the record and the queue
  builds the weaker half. If it is already captured, *edit that entry* — add the
  new evidence, sharpen its Decided, mark its build order — and say so in the
  report. A new number is for a new idea.
- Whether it already exists, partly. Half of all ideas here turn out to be
  "the thing is there but does not do X", which changes every question.
- **Which existing pattern it is.** This project has two, and naming which
  settles most of the design for free: **pure-state modules** (`shake.ts`,
  `ripples.ts`, `emitter.ts`, `touches.ts`, `motion-bias.ts`, `rgb-slip.ts` —
  state plus a pure update function, no DOM, no clock of its own, probeable
  headless) and **render-time influence** (a value modulated where it reaches
  the renderer, never written back to stored prefs — entries 48, 58, 60, 72,
  87). An addition that needs no new module, no new uniform and no new
  dependency is one that fits; needing all three is the signal to stop and ask
  whether the shape is wrong.
- **What the landing site already argues.** Read the comments where the change
  would go, not just the code. In this repo comments carry reasoning and
  refusals — *"Linear, as in the source. Ease-out was an embellishment…"* — and
  **a reasoned comment outranks an entry that did not know about it.** Entry 96
  asked for a change four shaders had already argued against; the builder was
  right to refuse. Finding that at recon is cheaper than finding it at build,
  and usually the idea is right and only its *where* is wrong (see entry 106,
  which moved the same effect to the one number nobody had argued about).
- **What this project has already decided about questions of this shape.**
  `docs/` is not background reading, it is where the defensible defaults live,
  and skipping it is how a settled argument gets reopened as a fresh taste
  question. The one that decides the most forks:
  `docs/the-toy-wants-to-be-played-with.md` — **restraint belongs in what
  persists, generosity belongs in what responds.** A thing that changes on its
  own while nobody is touching it should be slow, quiet and hard to trigger; a
  thing that answers a person should answer immediately and slightly more than
  expected. That rule settled nine decisions in a day, and later settled *"more
  active when the phone is left alone"* — which sounds like it contradicts every
  restraint in the codebase and does not, because a phone alone on a table has
  no other responding thing. If a fork looks like a taste call, check there
  before spending one of the user's answers on it.
- Which of CLAUDE.md's four **Hard Stops** it trips — stored `Prefs` shape, URL
  parameter shape, capture and privacy, new runtime dependency — and the
  **circular control surface** constraint, which is non-negotiable and rules
  out any control that is not an arc.

Recon is for grounding the decisions, not for designing the thing. Two or three
calls. If it is taking longer, the idea is a project and wants `spec-to-issue`.

### 1a. If the report is "it's not working" or "it hasn't landed"

**Prove it is absent before writing an entry to build it again.** Three separate
features were reported missing in one week and every one of them was fully
built and wired: camera mode (entry 87, build 273), the RGB slip (entry 76,
build 249), the start-screen animations (entry 65, build 220). Writing a
build-it entry for any of them would have shipped a second copy of a working
feature and left the real fault in place.

Establish, in this order, and stop at the first that answers:

1. **Does the code exist and run?** `git log -S` the constant or the function.
   A feature can be present, correct, and *never observable*.
2. **What masks it?** This is where all three actually were. Camera mode was
   invisible because an ordinary tap already saved a photo, so arming changed
   nothing you could see. The slip cancelled itself because its direction was
   `normalize()`d off an oscillating spring and flipped three times a second.
   The animations were gated on `prefers-reduced-motion` with an invisible
   fallback. **In each case the fix removes the masker; it does not rebuild the
   feature.**
3. **Is it behind a default-off switch or a device state?** `prefs.gravity`
   defaults `false`, and a phone that has already stored `false` keeps it — so
   flipping a default never reaches an existing install. Say so in the entry and
   require the verification to be done with the switch *on*.
4. **Never ask the user to inspect an OS setting.** Five rounds went into a
   `prefers-reduced-motion` hypothesis the user could not see or confirm; the
   answer was *"What animation settings what are you talking about"*, and the
   entry that finally worked (99) **removed the dependency on that state**
   rather than asking about it again. If a diagnosis needs something only the
   device knows, put it in the on-screen readout — the app is where the problem
   is reported, so it is where the diagnosis belongs.

### 2. Decide by default; ask only when you cannot

**Take your own recommendation.** If you can see the better option and say why,
choose it and move on. An idea captured in ninety seconds with six defensible
calls on the record beats one that took four rounds of questions to reach the
same place. The user's attention is the scarcest thing in the loop, and every
question spends it.

A decision is yours when you can defend it in one sentence against the
alternative. Almost all of them are: which file it lands in, what a constant
should be, whether to preserve existing behaviour, which of two implementations
is tidier, what the entry's done-when should measure, build order between
entries.

**Three things are never yours, and no amount of independence changes that:**

1. **A Hard Stop.** The stored `Prefs` shape, URL parameter shape, capture and
   privacy, a new runtime dependency. These are the user's to license, always.
   Without an explicit approval the entry is `blocked`, not `ready`, and no
   recommendation substitutes for the answer.
2. **A non-negotiable being overridden.** The circular control surface, the
   audio-never-leaves-the-device promise. Name the constraint, quote it, and
   let the user decide whether to override their own rule.
3. **A taste call with no defensible default.** Not "which is nicer" — that you
   decide — but a genuine fork where both answers are coherent and the choice
   expresses what the thing *is*. Bigger than Start or matching it. A blend
   mode per layer or one moved control. If you can argue either side equally
   well, it is theirs.

When you do ask, ask once. Batch up to four into a single `AskUserQuestion`,
lead every one with a recommendation and the reason, and make the options
concrete enough to choose between at a glance. `[No preference]` is a valid
answer and means the choice reverts to you — take it, and record it as yours.

**Recon still comes first, and matters more now.** The fewer questions you ask,
the more the decisions rest on what you found rather than on what you assumed.
A number from the codebase — how much vertical room there is, what a constant
already governs, whether the thing half exists — is what makes a self-made call
defensible instead of a guess wearing confidence.

### 3. Write the entry

Append to `docs/todo.md` under `## Entries`, numbered one past the highest
existing number. The format is specified at the top of that file — read it
rather than reproducing it from memory here, so the two cannot drift.

**Draft with a placeholder, not a number.** Write the entry to a scratch file
with `{N}` wherever its own number would go, and let step 4 pick the number.
Several agents capture into this one file at once, and the number you read
during recon is stale by the time you write: one afternoon produced two 112s,
two 113s, two 115s, two 116s, two 117s and two 118s, each pair from two
sessions that had both read the same highest header minutes apart. The
window that matters is between *reading the highest number* and *committing
the file*, and drafting inside it is what made it minutes long. Nothing else
in this step changes; only where the number comes from.

If the entry has to refer to its own number in other places — 109's status
line pointing at its follow-up, a note in `built.md` — write those with the
same `{N}` placeholder in the same scratch file's instructions, so step 4
substitutes them all in one pass. Never edit another file with a number you
have not committed yet.

Two fields carry the weight:

- **Decided** — one line per fork, each recording what was chosen *and what it
  was chosen over*. The rejected option is what stops the decision being
  reopened by whoever builds it.

  **Mark whose call each one was.** A decision the user made and a decision you
  made are not the same kind of fact, and an entry that blurs them claims an
  approval nobody gave — the failure `spec-to-issue`'s Approvals table exists
  to prevent. Write `→ chosen, over rejected.` for theirs, and
  `→ chosen, over rejected. **Mine**, because …` for yours. The reason is not
  optional on yours: it is the only thing that makes the call auditable, and
  the only way the user can overturn it later without re-deriving it.
  **A superlative may only be given once.** Entry 90 said *still → the most
  willing* and, four lines later, *dancing → shortest holds*. That is not a
  decision, it is two adjectives, and it shipped as one — the fork survived
  inside prose that read like a resolution. If two options are both described as
  the extreme of the same axis, the entry has an unresolved fork in it. The
  repair is a **ladder with numbers**: every option ranked on one scale, so the
  ordering is checkable rather than atmospheric.

  **When an entry replaces or corrects another, say so at both ends.** The new
  one carries `supersedes N` on its `status:` line and names in Decided what it
  changes and why; the old one gets its status updated so nobody builds it. 94
  and 99, 72/78 and 87, 96 and 106 all did this, and it is the only reason the
  queue can be read cold without building something already overturned.

- **Done when** — an observable outcome. Never "it works". A number, a state
  visible on screen, or a thing a probe asserts.

  **When the entry answers a "not seeing it" report, Done-when must measure the
  thing the eye already failed at.** Not "it should look dispersed" — *peak
  red-to-blue separation in device pixels, and zero direction reversals through
  one decay*. Whoever ships it next cannot check an impression, and an
  impression is what let three built features be reported as missing.

Two more this project's entries carry as standing requirements, because every
effect here is layered onto a picture people have already approved:

- **The identity when off.** Any new modulation must state what it costs when
  its input is neutral, and the answer must be *exactly nothing* — the same
  discipline `uDay`, `uBeatConfidence`, `uSlip` and `uMoonBloom` already follow.
  Prefer an identity that falls out of the maths over one bolted on with a
  clamp: entry 106's bloom is zero at both new and full moon *because* the
  waxing term is a sine that vanishes there, which is stronger than a guard and
  cannot be forgotten.
- **Build order, stated.** If an entry only makes sense after another, say so on
  the `status:` line (`build after 88`, `build before 90–92`). Entries are
  claimed in the order somebody reads them, not in the order you wrote them, and
  a dependency living only in your head gets built backwards.

**Verify** should name this project's actual gates — `pnpm build`, `pnpm lint`,
the relevant `pnpm probe:*` — plus the on-screen check at 320×568 and 360×640
that CLAUDE.md requires for anything touching a shared surface.

### 4. Commit, do not push

One command picks the number, appends, and commits — in that order, with
nothing between them:

```bash
# 1. another agent mid-edit? its half-written entry must not ride in your commit
git status --short docs/todo.md            # must be empty; if not, wait a few
                                           # seconds and re-check, do not stash
# 2. number, append, commit, as one step
N=$(( $(grep -o '^### [0-9]*\.' docs/todo.md | tr -dc '0-9\n' | sort -n | tail -1) + 1 ))
sed "s/{N}/$N/g" "$SCRATCH/entry.md" >> docs/todo.md
git add docs/todo.md && git commit -m "todo: entry $N — ..."
# 3. prove it: every header number appears exactly once
grep -o '^### [0-9]*\.' docs/todo.md | sort | uniq -d   # must print nothing
```

Step 3 is the check that makes the rest honest. If it prints a number, two
entries share it and **yours is the later one** — the other was there when
you read the file — so renumber yours to the new highest-plus-one, fix any
reference you wrote to it, and `git commit --amend`. Do not renumber the
other agent's entry: `/bbb` claims by grepping the header, and an entry that
changes number under an agent that has already read it is the worse failure.

**Committed so the queue is not left dirty** — `auto-issue-gogo` refuses to
start on a dirty tree, and a stray note would block it. Committed *at once*
also because the uncommitted window is the whole concurrency problem: a
second agent that reads the file while your entry is written but not
committed sees your number and takes the next one; one that reads before you
write takes yours.

**Not pushed**, deliberately: the build number is the commit count, so every
pushed commit redeploys the site and burns a release name. A captured idea is
not a release. It rides along with the next real change.

## Refusals

Say so plainly and stop, rather than writing a weak entry:

- **The idea is a project, not a task.** More than about three forks *you
  cannot decide*, or it spans layers. Forks you can settle yourself no longer
  count towards that — an idea with a dozen obvious calls in it is a small
  entry, not a project.
- **A fork cannot be resolved.** Only for the three kinds above: an unlicensed
  Hard Stop, an override of a non-negotiable, or a genuine taste fork the user
  is unavailable to settle. Write the entry as `blocked`, with a
  **Blocked on:** line naming exactly what would unblock it — one question, not
  a summary. Everything else you decide and mark as yours; `blocked` is not
  where uncertainty goes to wait.
- **It contradicts a non-negotiable.** A rectangular control, or anything that
  breaks the audio-never-leaves-the-device promise. Name the constraint, quote
  it, and let the user decide whether to override their own rule.

## Report back

One short paragraph, not a recital of the entry:

- the number and title,
- its status, and if blocked, the one thing it waits on,
- anything the recon turned up that changes the idea — that is the part worth
  their attention, and the part they cannot see,
- **the calls you made on their behalf**, in one line. Not all of them, the
  ones they might disagree with. Independence is only tolerable if it is
  visible: a decision made silently is a decision they cannot overturn.

**When recon overturns the premise, lead with that.** The most valuable reports
this skill has produced were not entries — they were *"this is built, here is
the line that hides it"*. If the answer to an idea is that the thing already
exists, or that the fault is somewhere else entirely, say so first and plainly.
That is worth more than any entry, and burying it under one wastes it.

**Own an error in the entry, not only in the chat.** Entry 72 specified the
wrong camera because the capture agent misread the request; entry 87 supersedes
it and says so on the record. The chat scrolls away and the file does not — a
correction that lives only in conversation will be re-derived by whoever reads
the entry cold.
