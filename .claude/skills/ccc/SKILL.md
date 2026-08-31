---
name: ccc
description: Use when reviewing what has already shipped — takes each entry marked done but not yet verified, youngest first, checks its Done-when claims against the code as it stands, fixes what it finds, and archives the entry to docs/built.md. The verification half of the /aaa and /bbb pair. Invoke as /ccc, or /loop ccc to keep going.
---

# ccc — done in, verified out

The third of three. `/aaa` turns an idea into an entry, `/bbb` turns an entry
into a build, and this one asks the question neither of them can: **did the
build actually do what the entry claimed?**

That question is not paranoia. Three features in one week were marked `done`,
were genuinely built and wired, and were reported by the user as missing —
camera mode, the RGB slip, the start-screen animations. Each had shipped
against an acceptance test of *it should look right*, and nobody looked. This
skill is what looks.

**Core principle: `done` is a claim, and this skill is where it either becomes
a fact or becomes a bug.** An entry that has been verified moves out of the
queue; one that has not stays in it, however long ago it shipped.

## The archive is the marker

`docs/todo.md` holds everything unfinished **or unverified**. `docs/built.md`
holds what has been checked. Moving an entry is not tidying — it is the
assertion that somebody re-read the entry and confirmed the code still does
what it says.

This is also the loop's stopping condition, which it would otherwise not have:
every `done` entry could be re-reviewed forever, so a review loop needs
somewhere for finished work to go. **The queue is empty when `todo.md` contains
no `done` entries.**

Two consequences, both binding:

- **Never move an entry you have not actually checked.** An archive that
  accumulates unverified entries is worse than no archive, because it looks
  like assurance.
- **Both other skills must search both files.** `/aaa`'s "is it already built?"
  recon and this skill's own history checks are the highest-value reads in the
  project — `grep -n 'pattern' docs/todo.md docs/built.md`, always both, never
  one.

## The shape of the run

**Select → re-read → check → act → archive → next.**

### 1. Select: youngest unverified first

```bash
grep -n 'status: done' docs/todo.md | tail -5    # youngest are last in the file
```

**Youngest first, and the reason matters** because it changes later:

- **Youngest-first finds build defects** — things shipped wrong and never
  looked at since. That is what the backlog is made of today.
- **Oldest-first finds decay** — things that were right when built and no
  longer are, because the code moved around them. That is the sweep to run over
  `built.md` *after* this queue is empty, and it is a different job.

Skip anything `ready`, `building` or `blocked` — those belong to `/bbb` or to
the user. One entry at a time.

**`superseded` is archived, not skipped.** An entry that another one absorbed
is settled: there is nothing to check, so archive it once its successor has
been verified, with a line saying which entry replaced it. Leaving it in the
live queue points at a successor that is no longer beside it, and this skill's
own stopping condition counts what remains in `todo.md`.

**Check what reads `todo.md` besides you.** Moving entries out changes a file
other things parse — `vite.config.ts` builds the gate's queue indicator from
it, and read only that one file until the archive split silently aged its
"last two built" rows by one entry per archival commit. Grep for the filename
outside `docs/` and outside the skills before the first move of a session.

### 2. Re-read the entry before reading any code

Read the whole entry, not the title. What you need from it:

- **Done-when**, which is the specification you are checking against. Not your
  impression of what the feature should do — the sentence the entry committed
  to.
- **Decided**, which tells you what was chosen *over* what. A build that took
  the rejected option is a real defect even if it works.
- **The status line**, which may carry a partial-ship clause: *"the expansion
  curve is deliberately incomplete — see build note"*. That is a disclosure, and
  condition 3 of CLAUDE.md's *Shipping part of an entry* says a follow-up entry
  should exist. **If it does not, that is the finding** — write it.
- **The build note.** `git log --grep="entry N"` finds it. It usually says what
  was left out and what could not be verified, and it is the fastest route to
  the weak spot.

### 3. Check every claim, not the feature in general

Go clause by clause through Done-when. For each:

- **Does the code do it?** Read the site, do not infer from the commit.
- **Does a probe assert it?** If the entry names one, run it. If the claim is
  checkable and nothing checks it, **extend the existing probe** — one probe per
  module, never a second for the same one.
- **Is the identity intact?** Almost every entry here promises the picture is
  unchanged when its input is neutral. That is the claim most likely to be
  quietly false and the easiest to test.
- **Is it observable?** The specific failure this skill exists for. A feature
  can be present, correct, and invisible — because something else masks it, or
  it sits behind a default-off preference no existing install will ever flip.
  Ask what a person would have to do to see it, and whether they would.

Run the project's gates once per entry rather than per claim: `pnpm build`,
`pnpm lint`, the probes the entry names.

### 4. Act on what you find

Three outcomes, and choosing between them is the judgement this skill asks for:

**It holds.** Say so in one line and archive it. Most entries are this, and
saying so quickly is what makes the loop worth running.

**A bug, and the fix is small and local.** Fix it, extend the probe so it
cannot come back, commit with the entry number in the message, and push. Then
archive. The fix rides on the entry it belongs to; do not open a new entry for
something you already fixed.

**A bug that needs design, or the entry's premise was wrong.** Do not build it
here. Write an entry in `docs/todo.md` the way `/aaa` would — the format is in
that file's header, Decided carries every fork with **Mine** and a reason — and
leave the parent in the queue, unarchived, with a line naming the new entry.
**An entry with an open finding against it has not been verified**, and moving
it would say it had.

### 5. Archive

Cut the entry from `docs/todo.md` and append it to `docs/built.md`, **in full
and unedited** — the reasoning is the value, and a summarised archive is a
deleted one. Add one clause to its status line:

```markdown
`status: done` · added YYYY-MM-DD · build NNN · verified at build MMM
```

Entry numbers are global and permanent. They are never reused, never
renumbered, and a number in `built.md` still resolves the same way it did in
`todo.md` — which is what keeps every `supersedes 94` and `build after 88`
readable years later.

Commit the move on its own, so a later `git log` can tell an archival from a
fix. Then push, and take the next one.

## What this skill does not do

- **It does not re-litigate taste.** If the build matches the entry and you
  would have chosen differently, that is not a finding. Decided settled it, and
  the user's approval is on the record there.
- **It does not improve working code.** A refactor that no claim requires is
  scope this skill has not been given. If it is worth doing, it is worth an
  entry.
- **It does not touch `blocked` entries.** Those wait on a person.
- **It does not verify what cannot be verified here.** Some Verify lines need a
  phone in a car, or two real nights a fortnight apart. Say which check stood in
  for it and archive on that basis, naming the gap — an honest partial
  verification recorded is worth more than an unreviewed entry left in the
  queue forever.

## How the three fit together

```
   /aaa            todo.md          /bbb           todo.md         /ccc        built.md
 idea ─▶ entry ─────▶ ready ─────▶ claim ─▶ build ────▶ done ─────▶ check ───────▶ verified
                       ▲                                             │
                       └───────────── new entry ──────────────────────┘
                          (a bug needing design, or a premise
                           the review proved wrong)
```

`/bbb` writes follow-up entries when a build ships partially. `/ccc` writes them
when a shipped build turns out not to hold. Both routes point back at the queue,
and that is deliberate: **every failure in this system becomes a numbered entry
rather than a memory**, which is the only reason the record gets more accurate
as it gets longer.

The rules across all three: an entry is the only channel between them; `/aaa`
never builds and `/bbb` never invents; `building` protects an entry's text but
not its idea; every `git add` names exact files, never `-A`; `/aaa` commits
without pushing, `/bbb` and `/ccc` push.
