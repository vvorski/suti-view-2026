---
name: bbb
description: Use when working the docs/todo.md queue — takes the next ready entry, claims it, builds it, verifies it against its own Done-when, ships it and marks it done, then goes back for the next one. The build half of the pair whose capture half is /aaa. Invoke as /bbb, or /loop bbb to keep going.
---

# bbb — entry in, build out

The other half of `/aaa`. That one turns an idea into an entry; this one turns
an entry into a build. Neither does the other's job, and the whole system rests
on that: **the entry is the interface, and it is written down.**

`auto-issue-gogo` is the heavyweight sibling — GitHub issues, labels, a branch
per issue, a PR. Use it when work is handed over unattended and reviewed
elsewhere. Use this one when the queue is `docs/todo.md`, the checkout is
shared, and the loop is meant to keep moving.

**Core principle: build what the entry says, and when you cannot, say so in
writing before moving on.** A silent deviation is the one failure this whole
arrangement exists to prevent. The system's defence is not that it never gets
things wrong — it is that **it fails in writing**.

## The shape of the run

**Select → claim → read the ground → build → verify → ship → close.**

### 1. Select

The queue is `docs/todo.md`. Read the `status:` line of every entry, not the
titles — the ordering that matters is not numeric.

- `ready` is workable. Everything else is not.
- **Honour build order.** A `status:` line saying `build after 88` or `build
  before 90–92` is binding. Entries are written in the order ideas arrive and
  must be built in the order they depend on each other; ignoring that is how a
  director fix lands after the three entries that assume it.
- **`blocked` means a person owes an answer**, not that it is hard. Skip it, and
  if it is blocked on something you can now settle from the code, say so rather
  than building it.
- **`building` is somebody else's.** Two agents share this checkout. Do not
  touch the entry, the files it names, or its status.

Take one. **One entry in flight at a time** — `deploy/deploy.sh` publishes
whatever is in the tree, so two in flight means one ships by accident.

### 2. Claim, in its own commit, before touching anything

```bash
# docs/todo.md: status: ready -> status: building · started YYYY-MM-DD
git add docs/todo.md && git commit -m "todo: claim entry N"
```

This is the entire concurrency protocol and it costs one commit. It goes
**first** — before reading widely, before any edit — because the window it
closes is the one where both agents pick the same entry.

### 3. Read the ground before writing any of it

The entry did its recon when it was written; the code has moved since. Spend a
few calls on:

- **What the landing site already argues.** Comments here carry reasoning and
  refusals. **A reasoned comment outranks an entry that did not know about it.**
  If the entry asks for something the code has explicitly decided against, that
  is a finding, not an obstacle — see *Shipping part of an entry* below.
- **Whether the Lands-in line is still true.** Count what you grep rather than
  trusting the number in the entry: one said "the six ripple shaders" and there
  were seven, because a view had been added after the sentence was written.
- **Whether it is already built.** Entries get superseded, and features get
  built as a side effect of neighbouring ones.
- **CLAUDE.md**, whose standing rules outrank any single entry. When one
  contradicts the entry, that is a proposal for the user — never a silent no.

### 4. Build

House rules that are not negotiable, all of them from CLAUDE.md and all of them
already paid for:

- **Refactor as part of the feature, not after it.** If the change would be the
  third copy of something, extract it now.
- **Preserve comments.** They are the documentation. Update the reasoning when
  the reason changes; never drop a comment because the code around it moved.
- **Prove the identity when off.** Any new modulation must leave the picture
  byte-identical when its input is neutral, and the entry usually says so. An
  identity that falls out of the maths beats one bolted on with a clamp.
- **Silence is a feature.** Nothing prints when there is nothing to say.

### 5. Verify against the entry's own Done-when, not against your confidence

Run this project's gates every time:

```bash
pnpm build          # tsc --noEmit && vite build — before every commit
pnpm lint
pnpm probe:<the ones the entry names>
```

Then the part that is actually load-bearing:

- **Extend the existing probe; do not add a second one for the same module.**
  A probe per module is findable; two are a coin toss.
- **Every claim the entry makes gets a check.** If Done-when says "no direction
  reversals through one decay", the probe counts reversals. If it says a number
  of pixels, the probe measures pixels. **Three features in one week were built,
  wired, and reported as missing** — because "it should look right" was the
  acceptance test and the eye had already failed at exactly that.
- **State what you could not verify.** Some Verify lines need two real nights a
  fortnight apart, or a phone in a car. Name what ran in place of it.

### 6. Ship

The status moves to `done` in **the same commit as the work it names**, so the
build number and the status can never disagree.

```markdown
`status: done` · added YYYY-MM-DD · build NNN
```

The build number is `git rev-list --count HEAD` **after** the commit lands — it
is the commit count, so it is one more than what you see before committing. Get
it wrong and the entry points at somebody else's build; two entries have already
needed a correcting commit for exactly this.

**The commit message is the build note**, and it is the deliverable that
outlives the code. Prose, at length where it earns it: what was built, what the
entry did not know, what surprised you, what you verified and what you could
not. This is the record the capture half reads when the next report arrives.

### 7. Close, then take the next one

Push. Say in one line what shipped and what it changes for the user. Then go
back to step 1 — under `/loop bbb`, without asking.

## Shipping part of an entry

Sometimes the right build is not the whole entry: it conflicts with a decision
already documented in the code, or with a standing rule in CLAUDE.md, or asks
for a verification no session can run. **Building it anyway is the worse
failure.** Declining is often better work than complying — one entry asked for a
change four shaders had explicitly argued against, and refusing it was correct.

Three conditions, and the third is the one that has already been got wrong:

1. **Ship only the part you are confident in.** Never force a change that
   overwrites a documented decision.
2. **Disclose twice** — at length in the commit, *and* in one clause on the
   entry's `status:` line, so the omission is visible without reading git.
3. **Write the follow-up entry before marking the parent `done`.** Not after.
   The remainder is either a new entry that finishes the job, or — if the
   omission is a conflict with a standing rule — an entry that puts the
   conflict to the user as a question.

Condition 3 is not bookkeeping. Two entries were disclosed exactly as 1 and 2
require and then sat marked `done` with a third of the request missing; the gap
surfaced a day later, by accident, while counting something else. **A disclosure
nobody is scheduled to read is indistinguishable from a silent drop.** An entry
in the queue is read by definition.

Writing that follow-up is the one moment this skill writes an entry rather than
building one. Match `/aaa`'s format exactly — `docs/todo.md`'s header is the
spec — and mark your own calls **Mine**, with the reason.

## Stop and ask

Stop, rather than deciding it yourself:

- **A Hard Stop the entry did not license.** If the work turns out to touch the
  stored `Prefs` shape, a URL parameter, capture and privacy, or a new runtime
  dependency, and the entry's own Hard-stops line did not answer for it, the
  entry is `blocked` — set it back, say what it needs.
- **A non-negotiable in the way.** The circular control surface, the
  audio-never-leaves-the-device promise. Name it, quote it, let the user decide
  whether to override their own rule.
- **The entry's premise is wrong.** If recon shows the thing already exists, or
  the fault is somewhere else entirely, **that finding is worth more than the
  build.** Say it first and plainly. Do not build a second copy of a working
  feature because an entry asked you to.

## How the pair fits together

```
        /aaa                     docs/todo.md                    /bbb
  idea ──▶ recon ──▶ entry ──────▶  ready  ──────▶ claim ──▶ build ──▶ done
                                      ▲                               │
                                      └──── follow-up entry ──────────┘
                                        (partial ship, or a premise
                                         the build proved wrong)
```

Four rules hold the seam, and all four are about not writing where the other
half is standing:

- **`/aaa` never builds. `/bbb` never invents.** An entry is the only channel
  between them. A build that quietly improves on its entry has broken the record
  even when the code is better.
- **`building` protects the text, not the idea.** `/aaa` may append an entry
  that supersedes one being built, and must — never edit under a builder.
- **Both scope every `git add` to exact files.** Never `git add -A`, never
  `git commit -a`: the other agent's work-in-progress is usually in the same
  tree.
- **`/aaa` commits and does not push; `/bbb` pushes.** The build number is the
  commit count, so a push redeploys and burns a release name. Captured ideas
  ride along with the next real build.

When `/bbb` finds a fault the entry was wrong about, the loop closes the other
way: it writes a follow-up entry, and `/aaa` reads it as evidence next time the
same symptom is reported. That return path is why the queue gets *more* accurate
as it gets longer, and it only works if both halves keep writing things down.
