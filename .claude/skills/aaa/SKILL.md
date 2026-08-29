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

## The shape of the run

**Recon → ask → write → commit.** Four steps, and the first is what makes the
second worth the user's time.

### 1. Recon first, briefly

Never open with questions you could have answered yourself. Spend a couple of
tool calls establishing:

- Where the idea would land. Grep for the thing it touches; get `file:line`.
- Whether it already exists, partly. Half of all ideas here turn out to be
  "the thing is there but does not do X", which changes every question.
- Which of CLAUDE.md's four **Hard Stops** it trips — stored `Prefs` shape, URL
  parameter shape, capture and privacy, new runtime dependency — and the
  **circular control surface** constraint, which is non-negotiable and rules
  out any control that is not an arc.

Recon is for informing the questions, not for designing the thing. Two or three
calls. If it is taking longer, the idea is a project and wants `spec-to-issue`.

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
- **Done when** — an observable outcome. Never "it works". A number, a state
  visible on screen, or a thing a probe asserts.

**Verify** should name this project's actual gates — `pnpm build`, `pnpm lint`,
the relevant `pnpm probe:*` — plus the on-screen check at 320×568 and 360×640
that CLAUDE.md requires for anything touching a shared surface.

### 4. Commit, do not push

```bash
git add docs/todo.md && git commit -m "..."
```

**Committed so the queue is not left dirty** — `auto-issue-gogo` refuses to
start on a dirty tree, and a stray note would block it.

**Not pushed**, deliberately: the build number is the commit count, so every
pushed commit redeploys the site and burns a release name. A captured idea is
not a release. It rides along with the next real change.

## Refusals

Say so plainly and stop, rather than writing a weak entry:

- **The idea is a project, not a task.** More than about three forks, or it
  spans layers. Say it wants `spec-to-issue` and a real spec.
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
