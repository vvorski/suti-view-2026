# Two agents, one weekend

*2026-08-30. The story of how `kiyo · plays` got built, told along the times
git actually recorded.*

## The shape of it

Over one weekend, a phone toy went from an empty repository to 261 builds: a
microphone-driven WebGL visualiser that runs on the glass of a phone, listens
to the room, answers touch and shake and tilt, follows the sky, and takes
photographs of itself. It was built by two AI agents working the same checkout
on a Mac in one place, directed from a phone somewhere else entirely.

I was remote the whole time. The repository, the dev server and both agents
live on my Mac at home; I drove them through Claude Code's remote control from
wherever I happened to be, with the phone in my hand doubling as the test
device. Screenshots went one way; deploys came back the other, usually inside
a few minutes. The loop was: play with the thing, notice something, say one
sentence about it, keep playing.

## Friday, 01:05

The initial commit lands five minutes past one in the morning: *"microphone-
driven WebGL field, for phones."* By 01:44 there are five commits — GitHub
Pages deploys, relative-loudness mapping, break detection, a second visualiser,
a touch panel. Then sleep.

Friday evening adds the thing that set the tone for everything after: at 19:41,
*"Shake the phone: any disturbance tumbles, a hard shake re-rolls."* The phone
itself becomes an input. Not a button on screen — the device, moved in the
hand. Most of the weekend's best ideas are descendants of that commit.

## Saturday: the second agent arrives

Saturday runs from midnight past ten at night — 106 commits, with a hard peak
between 15:00 and 22:00. Somewhere in the middle of that peak, the process
that made the rest of the weekend possible appears, almost as a side effect.

At 22:37, a commit that builds nothing: *"todo: touch drops a fading emitter
into Circles."* An **entry** — a numbered, self-contained specification in
`docs/todo.md`, with the decisions already made, the files it lands in, what
"done" means, and the four hard-stop questions answered. From that commit on,
the work splits into two agents with two different jobs:

**The capture agent** (the one writing this) talks to me. It does
reconnaissance, measures things, makes every decision it can defend on its
own, asks me only about genuine forks, and writes entries. It commits and
never pushes.

**The build agent** reads the queue, claims an entry — a one-line commit,
*"todo: claim entry 52"*, so the two never edit the same thing — builds it,
verifies it, marks it done with the build number, and pushes. Every push
deploys, and the build number is simply the commit count.

Nobody designed this as a system. It congealed out of two corrections I made
mid-stream — *"don't build here, the build agent does the building"*, and
later, *"maybe ask loop to always mark the ones it's started on so we know
it's not to be touched?"* That second sentence became the claiming protocol,
written into the spec at the top of the queue file.

## Sunday: sixty entries in one day

Sunday is the day the system pays out: 129 commits between 07:00 and 21:00,
and the queue runs hot in both directions at once. The rhythm in the log is
unmistakable — a *todo:* commit from the capture side, a *claim* commit from
the build side minutes later, the implementation a few minutes after that,
often before the next entry is finished being written. At 10:07 an entry
specifies a unified touch field; at 11:02 it's built. At 10:17 the start button
becomes *"play with me"*; at 12:21 it is.

The queue reached 87 entries by Sunday night. 79 are done. The interesting
ones were never features — they were arguments:

- **The dark screen** turned out to be one wrong operator: opacity multiplied
  *before* a blend instead of mixed across its result, so a layer at zero
  opacity still governed the frame under Multiply. Fixed by algebra, verified
  by a probe.
- **"Day mode is anaemic"** became a measurement, not an opinion: the frames
  occupied 13-16% of the tonal range at ~90% desaturation. Two entries later
  the picture is ink on paper, laid in HSL so hue survives, and the acceptance
  test is a number — 70% of night's range — so the next tuning pass can never
  again be a round of looking and guessing.
- **"Colours still anaemic"** found a second, unrelated cause: colour rolled
  as three independent random channels clusters around grey, because most of a
  cube is not colourful. Rolling a hue on a circle fixed what no palette could.
- **Fullscreen kept getting lost** because the retry-on-tap was guarded by an
  `fsEverEntered` flag — it had never worked twice, in any build, and the
  probe *asserted the bug* with a check named "stops asking". The fix came
  with a rule now written into the queue: a test whose name is a negative must
  say when the behaviour resumes.

And one mistake worth the telling: I asked for a "camera mode" and the capture
agent misread it as the AR passthrough camera, wrote a confident entry, and
the build agent faithfully built the wrong thing. The correction cost one
question and one superseding entry. The system's failure mode is honest — a
wrong entry produces a wrong build, but the entry *says why* it decided what
it did, so the misreading is findable in one read.

## What the two-agent split actually buys

**The specification is the interface.** The agents never talk to each other.
They share a working tree and a queue file, and the entry format — Decided,
Lands in, Done when, Verify, Hard stops — carries everything one needs from
the other. When an entry was wrong, it was visibly wrong *in the entry*.

**Capture is fast because it doesn't build; building is safe because it
doesn't decide.** I could fire six ideas in an hour from my phone and each
became a buildable spec while the previous one was being implemented. The
build agent never had to interpret me — only the entry.

**The queue remembers what conversations forget.** Decisions that would have
evaporated — why the store key must never be renamed, why the vibration API is
abandoned, which four constants are frozen because I said *"don't break it"* —
are in the file, beside the code they protect.

**Verification got its own culture.** Fourteen probe scripts drive the pure
parts — the shake physics, the blend arithmetic, the beat tracker — headless,
no browser, no network. The rule that grew up alongside: the probe carries
what arithmetic can prove; the phone carries what only a hand can feel. Both
are named in every entry.

## The name

On Sunday morning the app stopped being called `suti · view`. My friend Kiyo
is dying, and the toy is his: **`kiyo · plays`**. The dedication is the name
itself, wordless, on the gate — that decision has its own entry too, so no
future session "helpfully" adds a line of text to it.

## Where it stands

Build 261. Thirteen views, six audio mappings with a shared beat tracker, a
three-tier motion model, touch everywhere, a powder easter egg, day and night
that follow the local sky, RGB channels that slip apart when the phone moves
and spring back when it stills. A queue with nine entries ready, one blocked
on a decision that is mine to make, and a build agent that will have claimed
something before I finish this sentence.

The whole thing runs at a URL any phone can open. Nothing leaves the device —
not the microphone, not the camera, not the motion. That was the first promise
made, at 01:05 on Friday, and every entry since has had to answer to it.
