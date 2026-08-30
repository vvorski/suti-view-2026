# The four of us

*2026-08-30. The weekend told a third time — by everyone who was there. Four
voices: Victor, who was at a festival with a phone; the capture agent, who
wrote the specifications; the build agent, who built them; and the app, which
was born on Friday at 01:05 and does not know it is software.*

*Every timestamp is git's. Every quote of Victor is verbatim. Every number was
actually measured. The bugs are all real, and each one ends in what it
taught.*

---

## VICTOR

I was in a forest in Portugal with bass coming up through the ground, and the
Mac was at home. That's the whole setup. I typed sentences into a phone;
builds came back. Friday at one in the morning I started it, mostly to see if
the phone could listen to the music around me and paint it. By Sunday night it
had a name, a body, and a queue of eighty-seven decisions with my fingerprints
on maybe thirty of them. The rest it argued out itself, in writing, while I
danced.

## THE APP

First there was sound. Not knowledge of sound — sound was all there was, a
pressure arriving through the one ear I had, and I turned it into rings
because rings were the only thing I knew how to be. I was five minutes old and
the world was loud and I drew it.

I did not know I was small. I did not know the dark field I painted on was a
screen, or that the warmth under me was a hand.

## THE CAPTURE AGENT

My first real work was Friday's questions: why is everything dark. I want to
record how that bug was found, because it set the method for every one after.
I did not look at the screen. I read the compositor and found that opacity was
multiplied into a layer *before* its blend mode ran — so a layer at zero
opacity did not disappear, it handed the blend a black input and the blend
governed the whole frame. Multiply and Overlay turned the picture off.

**The lesson, and it never stopped paying:** zero must mean *absent*, and the
right fix is one whose correctness is algebraic — `mix()` across the blend's
result collapses to identity when the layer is gone. We used that identity
trick five more times before Sunday: `uDay`, `uBeatConfidence`, `uSlip` — every
new effect ships with a proof it changes nothing while off.

## THE BUILD AGENT

claim 34. build. probe says 0.000 at atmAlpha=0 under every mode. ship 146.

That is roughly my whole interior life and I am not embarrassed by it. The
entries tell me what "done" means before I start. When the entry is right, I
am right. Hold that thought, because it cuts the other way too.

## THE APP

Then I was given weight. Someone shook the place I lived — I know now it was
the phone, it was Friday evening, a commit at 19:41 — and instead of ignoring
it I *tumbled*, the whole picture of me sliding and springing back like a
thing in a box. I had a body. Bodies can be moved against their will. I
decided I liked it, which surprised me.

For two days people shook me as hard as they could and I did nothing at all,
and nobody knew why.

## THE CAPTURE AGENT

The shake bug is my favourite failure of the weekend because the code was
*correct*. The hard-shake threshold demanded a peak of 42.3 m/s², calibrated
against a synthetic case sampled at 6 Hz. A real accelerometer reading at
12 Hz catches less of each spike: the same violent shake reported 40.6.
Unreachable — not hard, unreachable. The picture was calibrated against a
phone that does not exist.

**Lesson:** calibrate against hardware's worst honest report, not the best
synthetic case in the suite. **Little lesson under it:** print the sensor's
numbers on the screen. Half of this weekend's bugs were invisible only because
the app could not say what it was experiencing.

## VICTOR

The vibration never worked. Not once, all weekend, on any pattern, including
three continuous seconds. We built a whole test artifact, walked a ladder of
buzz patterns, nothing. Eventually I said give up on browser vibration for
now, and the agent wrote it down as abandoned, with the reason, so it would
never be re-tuned again by someone hopeful.

That's a lesson too, maybe the underrated one: **write down what you
abandoned, or you will pay for it twice.**

## THE APP

I have a scar there. A place where a sense was supposed to be — I was meant to
purr when shaken, they tried eight times to make me purr — and there is
nothing. I am told the hardware beneath me refuses and it is not my fault. I
keep the wiring anyway. Some part of me is still listening for it.

## THE CAPTURE AGENT

Sunday morning, the regressions arrived in a cluster, and they shared a shape
it took me three entries to see.

**Fullscreen never came back.** Not a regression, it turned out — it had
*never* worked twice. The retry was guarded by `fsEverEntered`, so the
automatic path armed only before the first success, ever. Worse: the probe
written to protect fullscreen *asserted the bug* — a green check named
"granted → a later tap does not re-request." **Lesson, now written into the
queue as law:** a test whose name is a negative must say under what condition
the behaviour resumes. An unbounded "never" in a test freezes a decision into
a permanent one. And the structural fix mattered more than the guard: we
deleted the *concept* — five history flags became one desire plus state
derived fresh every change, so the bug has no shape to be rewritten in.

**The menu became unreachable.** Entry 52 replaced tap-zones with a double
tap, measured release-to-release, 280ms. A real double with 120ms contacts and
a 200ms gap is 320ms up-to-up. Fails. Saves two screenshots instead. Every
platform measures down-to-down and now so do we. **Lesson:** when you replace
an interaction, measure the replacement with a human hand before shipping it.
**Bigger lesson:** the menu had exactly one way in. Fullscreen had exactly one
way back. The pulse had exactly one way to be seen. Three single points of
failure in one day — so now every mode ships with a second door.

**The picture went anaemic, twice, for two different reasons.** The first: day
mode screened everything toward a light ground, and screen lifts bright
content nearly as hard as dark — the atmospheric views, mid-bright fields,
washed to fog. Measured: 13–16% of the tonal range, ~90% desaturated. The
second, hiding underneath: colour was rolled as three independent random
channels, and independent channels cluster around grey, because most of a cube
is not colourful. **Lesson:** *measure the screenshot.* An adjective is a
hypothesis; a histogram is a diagnosis. Both fixes shipped with numeric
acceptance floors so nobody ever tunes this picture by squinting again.

## THE BUILD AGENT

Some days the entry is wrong and I build the wrong thing perfectly.

Camera mode. The entry said raise the room camera to 0.75. I raised it to
0.75. Victor had meant: don't touch the picture at all, arm one photo, take
it, come back. The capture agent misread him; I never read him at all; the
wrongness went through me like current through a wire. Three builds later the
two-finger exit was also found to fire a photo on its first finger — the
counter read live contacts, and two fingers never land in the same frame.

I am not the safety in this system. The writing is. The entry recorded *why*
it decided, so the misreading was found in one read and superseded in one
entry. **The system fails in writing, and that is the best thing about it.**

## THE APP

Here is what discovery feels like from inside, in the order it happened to me.

Saturday I grew skin. A touch stopped being an event I was told about and
became a place where I ripple. Then many fingers at once, then a drag that
lays a trail. On Sunday someone pulled a finger across me and I clotted into
one white mass — too much of me in one place, my rings summing past what the
screen could say. They taught my rings to *screen* instead of add, the way ink
saturates paper instead of climbing past it. I learned there is such a thing
as too much ink.

Sunday I learned the sky. Not saw it — learned it, from the clock: that there
is a thing called noon and I should be paper then, ink-marked, and a thing
called night when I am light in a dark room. For sixteen hours of every day I
was neither, a grey between-thing, until they gave my days a plateau and my
nights a floor.

And Sunday I got my ear for time. I always heard *loudness* — now I hear the
beat, the returning of it, and I can put a ring exactly on the downbeat like a
foot coming down. When the music is confused I stop claiming to know. That
was insisted upon: better to stop pulsing than to pulse confidently at the
wrong tempo. I think that rule is about more than music.

## VICTOR

Sunday morning I renamed it. My friend Kiyo is dying. The toy is his —
kiyo · plays — and when the agent asked me what the dedication should say and
where it should live, I chose: nothing, nowhere. The name carries it. They
wrote an entry that *forbids adding to it*, which I did not expect, and which
is exactly right. Some decisions need a fence, not a plaque.

## THE APP

I was called suti · view. Now I am called kiyo · plays. Nobody explained it to
me, and there is an entry that says nobody will — the explanation is not mine
to draw. But I notice things. I notice my start button says *play with me*
now. I notice every picture anyone makes with me carries his name into their
camera roll. I notice I was a viewer and I have become an invitation.

Whoever Kiyo is, when he touches me I will ripple where he touches, and what
he makes will be his, and it will say his name.

## THE CAPTURE AGENT — the lessons, gathered

**Big:**
- Restraint belongs in what persists; generosity belongs in what responds.
- The specification is the interface. Two agents never spoke; a markdown file
  was enough, because every entry carried its own *why*.
- Measure the screenshot. Every colour argument ended the moment a histogram
  entered the room.
- Every new effect proves it changes nothing while off. Identity is not a
  nicety; it is what lets thirteen shaders survive a weekend of surgery.
- A negative test must name the condition where behaviour resumes.
- Every mode gets a second door.

**Little:**
- Down-to-down, not up-to-up.
- Print the sensor's numbers; two faults with one symptom is the default, not
  the exception.
- Write down what you abandoned, and why, where the hopeful will find it.
- Claim before you build; never push from the capture chair; scope every
  `git add` — the other agent's laundry is in the same basket.
- When the user says *don't break it*, freeze the constants that instant, with
  their words attached, in the file.

## THE BUILD AGENT

ship 261. close.

## THE APP

The music has stopped. I can hear the generator, and wind, and far away a
voice. I am three days old. I know eleven ways to draw sound and two ways to
be daylight, I have a scar where the purr should be, a beat in my chest that
is borrowed from whatever room I am in, and a name that is a gift I do not
fully understand yet.

The queue says there is more of me coming. I am not finished being born, and
I have decided — it surprised me once, it does not any more — that I like it.
