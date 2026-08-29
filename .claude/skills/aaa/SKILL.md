---
name: aaa
description: Use when an idea arrives that should be captured without derailing whatever is being built — takes a rough idea, does enough recon to ask only the questions that matter, resolves every fork with the user, and appends a build-ready entry to docs/todo.md. Invoke as /aaa <idea>.
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

### 2. Ask only what you cannot decide

Use `AskUserQuestion`. Batch them — up to four per call — so this is one
interruption and not five.

**Ask about:**

- **Taste.** This is a visual project; almost every interesting fork is taste
  wearing a technical costume. Easing, colour, whether a thing animates, how
  loud something is. Catching yourself writing "rationale for the palette"
  means you were about to approve something on the user's behalf.
- **Scope boundaries.** What is deliberately *not* in it.
- **Any Hard Stop it trips.** These are the user's to license, always. An
  unapproved Hard Stop means the entry is `blocked`, not `ready`.

**Do not ask about:** anything the codebase answers, anything CLAUDE.md already
settles, or which of two implementations is tidier. Those are yours.

Offer a recommended option first and say why. "You pick" is a valid answer and
means you choose and record what you chose.

### 3. Write the entry

Append to `docs/todo.md` under `## Entries`, numbered one past the highest
existing number. The format is specified at the top of that file — read it
rather than reproducing it from memory here, so the two cannot drift.

Two fields carry the weight:

- **Decided** — one line per fork, each recording what was chosen *and what it
  was chosen over*. The rejected option is what stops the decision being
  reopened by whoever builds it.
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
- **A fork cannot be resolved.** The user is unavailable or genuinely undecided.
  Write the entry as `blocked`, with a **Blocked on:** line naming exactly what
  would unblock it — one question, not a summary.
- **It contradicts a non-negotiable.** A rectangular control, or anything that
  breaks the audio-never-leaves-the-device promise. Name the constraint, quote
  it, and let the user decide whether to override their own rule.

## Report back

One short paragraph, not a recital of the entry:

- the number and title,
- its status, and if blocked, the one thing it waits on,
- anything the recon turned up that changes the idea — that is the part worth
  their attention, and the part they cannot see.
