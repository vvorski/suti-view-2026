# Built

Entries that shipped **and have been checked since**. `/ccc` moves them here,
one at a time, after re-reading each entry and confirming the code still does
what its **Done when** claims.

That distinction is the whole point of this file. In `docs/todo.md` a `done`
status means an agent said the work was finished. Here it means somebody went
back, read the entry cold, and verified the claim against the code as it now
stands. Three features in one week were marked done, were genuinely built and
wired, and were reported as missing — because *it should look right* was the
acceptance test and nobody looked. A `done` entry still sitting in `todo.md` is
therefore not an oversight; it is the review backlog.

**Entries are kept in full and unedited.** The reasoning is the value — what was
chosen, what it was chosen over, whose call it was, and what was already tried
and failed. A summarised archive is a deleted one.

**Numbers are global and permanent.** They are never reused and never
renumbered, so `supersedes 94` and `build after 88` resolve the same way here as
they did in the queue.

**Search both files, always.** The highest-value question either agent asks is
*is this already built?*, and answering it against one file is how a working
feature gets built twice:

```bash
grep -n 'pattern' docs/todo.md docs/built.md
```

Each entry carries one extra clause on its status line saying when it was
checked:

```markdown
`status: done` · added YYYY-MM-DD · build NNN · verified at build MMM
```

`build NNN` is when it shipped; `verified at build MMM` is when it was read back
against the code. The gap between them is how stale the check is — and once this
file is the whole record, an oldest-verified-first sweep is what catches decay,
which is a different fault from the ones caught on the way in.

## Entries
