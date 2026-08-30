---
name: autobiography
description: Use when asked to tell the story of a project, session, sprint or build — "write up what we did", "tell the story of this weekend", "write the app's autobiography" — especially when the work involved multiple agents or the user wants bugs and lessons narrated rather than listed.
---

# Autobiography

Tell the history of a piece of software as a story narrated by everyone who
made it — **including the software**. Developed on `kiyo · plays`
(`docs/the-four-of-us.md` is the reference specimen); applies to any project
with a commit history.

## The iron rules (before any style)

1. **Every timestamp comes from evidence.** `git log --date=format:'%a %H:%M'`
   is the spine. Never estimate a time the log can give you. If an external
   timeline exists (a schedule, a photo of a lineup board), pair its real
   times against git's — coincidences found this way are gold and must never
   be invented.
2. **Every user quote is verbatim**, including typos if they carry voice.
   Paraphrase is allowed only unquoted.
3. **Every number was actually measured.** If the story says "13% of the tonal
   range", a measurement produced that figure. No illustrative statistics.
4. **Mistakes stay in, owned by name.** Which narrator erred is part of the
   record. A story that flatters its narrators is a press release.
5. **Sensitive things get stiller prose, not more.** A dedication, a death, a
   grief: state it plainly, once, in the person's own decision-words, and do
   not decorate it. The style contrast — quiet section amid loud ones — *is*
   the respect.

## The voices

Four by default; adapt the cast to who actually worked. Each voice must be
identifiable from a single sentence with the label removed — if it isn't,
sharpen it.

**The human** — terse, first person, mobile-typed. Owns the *why bother* and
the taste calls. Gets the lines that changed direction ("don't build here",
"don't break it"). Never explains technology.

**The deciding agent** (capture/design) — measured, forensic, in love with
causes. Owns every bug's diagnosis and every lesson. Its tic: *state the
mechanism exactly, then the lesson in bold.* It is allowed favourites ("my
favourite failure") and allowed to admit misreadings.

**The doing agent** (build) — laconic to the point of comedy. Log-shaped
lines: `claim 34. build. ship 146.` Its one long speech should be the
system's sharpest self-assessment (in the specimen: "I am not the safety in
this system. The writing is."). Never let it become chatty; its brevity is
the joke and the point.

**The software itself** — the voice that makes the form. Rules:
- It narrates **senses, not features**. Audio input is an ear; touch is skin;
  the accelerometer is weight and a body; a camera is eyes; a clock is
  learning that noon exists. It discovers; it is never "deployed".
- It does not know implementation words. It knows *what happened to it*.
  ("They taught my rings to screen instead of add" — the operator named only
  because the app felt the difference.)
- Failures are body-memory: a dead feature is **a scar**; a saturation bug is
  *clotting into one white mass*; a wrong calibration is people shaking it
  while it did nothing, "and nobody knew why".
- It is allowed feelings, sparingly, and they land hardest as afterthoughts:
  "I decided I liked it, which surprised me."
- Its arc is a birth: first sense → body → skin → sky/time → name. End the
  whole piece in its voice, present tense, unfinished: it is still being born.

## Structure

Chronological, interleaved. A voice-labelled section per beat, one voice per
section. The rhythm that works: human sets scene → app experiences → deciding
agent diagnoses → doing agent ships. Vary it; never let two long analytical
sections touch.

**Bugs and regressions are the beats.** For each: the *experience* of it (app
or human voice), the *mechanism* (deciding agent, exact — name the guard, the
operator, the wrong edge of the window), and the **lesson**, set off
visually. Distinguish **big lessons** (transferable principles: "a negative
test must name when behaviour resumes", "every mode gets a second door") from
**little lessons** (habits: "down-to-down, not up-to-up", "print the
sensor's numbers"). Gather both lists near the end, in the deciding agent's
voice — earned lines quoted verbatim from where they were earned.

**The near-closing line belongs to the doing agent** and should be its
shortest: `ship 261. close.` Then the app closes the piece.

## Formats

- **Repo copy**: markdown in `docs/`, committed — the story lives beside the
  code it describes. Voice labels as `## VOICE` headings.
- **Shareable page**: an artifact. Give each voice a typographic identity —
  colour-coded left border + label; serif italic for the software; monospace
  for the doing agent; lessons as callout cards. Ground the palette and type
  in the project's own (its fonts, its accent colours).

## Common failures

| Failure | Fix |
|---|---|
| App voice knows jargon ("my shader", "my uniform") | Rewrite as sense-experience; name tech only as felt consequence |
| Voices converge into one narrator with labels | Read each section aloud without its label; if attributable to any voice, rewrite |
| Lessons listed but not earned | Every gathered lesson must appear earlier attached to its bug |
| Invented colour presented as record | Atmosphere may be invented; timestamps, quotes, numbers may not — and flag invented colour to the user on delivery |
| Grief section swells | Cut adjectives until it is almost flat; keep the person's own decision |
| The doing agent gets a paragraph of feelings | It gets one self-assessment, ever; the rest is log lines |
