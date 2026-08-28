# suti-view-2026

A microphone-driven WebGL field, built for a phone held in the hand rather than
a browser window on a desk.

**Live:** [suti-view-2026.pages.dev](https://suti-view-2026.pages.dev) ·
[vvorski.github.io/suti-view-2026](https://vvorski.github.io/suti-view-2026/)

Both serve the same build. Cloudflare Pages is the primary target; GitHub Pages
is there because it needs nothing but a public repo. Either works on a phone —
the microphone requires a secure context, and both are HTTPS.

Tap to begin and grant the microphone. **Tap anywhere again** for the control
panel — two layers, a merge mode, a mix, audio mapping, and a live readout.
Choices persist. Audio never leaves the device: no recording, no upload, no
backend.

## Two layers, composited

The screen is two independently-chosen views, rendered to their own off-screen
targets and blended by a third pass:

|                 |                          |                                  |
| --------------- | ------------------------ | -------------------------------- |
| **Geometric**   | Circles                  | discrete events — a ring per hit |
| **Atmospheric** | Field, Lattice           | continuous fields — noise, spectrograms, envelopes |

Pick each independently from the panel (or `?geometric=circles`,
`?atmospheric=lattice`; `?view=` still works as an alias for the atmospheric
side, for links from before the split). The **merge mode** dropdown picks how
the geometric layer combines with the atmospheric one underneath it — Normal,
Add, Screen, Multiply, Overlay, Difference — and the **mix** slider is a
universal opacity on top of that, Photoshop-style: 0% is pure atmosphere,
100% is the full blend, and the merge mode only decides what "full" looks
like in between. Keeping mix meaningful for every mode, rather than only for
Normal, means switching modes never requires also touching the slider to get
back to something legible. Default is Screen at 40% — the rings glow through
the field rather than fighting it for the same pixels.

A view is still nothing but a fragment shader plus a label — `scene.ts` never
learns what any of them do, geometric or atmospheric alike. The three-pass
render (geometric → target, atmospheric → target, composite → canvas) is the
real cost of the split: roughly the price of the atmospheric shader alone plus
a cheap composite, since Circles' per-pixel cost is small next to four-octave
fbm. The [adaptive pixel ratio](#performance) is what keeps that tenable on
weaker phones — it was already doing this job before the split, it just has
more to compensate for now.

### Circles, and why it is a separate layer

suti-view-2026 grew out of `~/dev/circles`, a video-chat app whose waiting
room draws slow concentric rings on a fixed timer while people join — ambient
wallpaper that never looked at what anyone was saying. Circles is the same
shape of idea, rewritten to answer to the room: a ring is born on a
transient crossing a threshold, not a `setInterval`, and its size and
brightness carry the loudness of the hit that made it (`ripples.ts`).

That is also why it lives in its own layer rather than folding into Field or
Lattice. A ring is a discrete event with a start time; Field and Lattice are
continuous fields with no notion of "an event just happened" beyond the single
one-at-a-time ripple/pulse they already borrow from `transient`. Reproducing
genuinely overlapping, independently-aging rings inside a continuous field
means actually tracking events, so `scene.ts` does: it watches for a
transient's rising edge, gated by a cooldown (a fast hi-hat pattern would
otherwise spawn a ring on every one) and silenced during a breakdown, and
hands the shader a small buffer of `(birth time, birth loudness)` pairs to
draw independently. `pnpm probe` checks the trigger logic — spawns on a clean
crossing, doesn't double-spawn on two hits close together, stays silent
through a breakdown — since none of that is visible by staring at rings on
screen.

### Lattice, and why it is built the way it is

Grey described the experience behind _Universal Mind Lattice_ (1981) as every
being and thing appearing as a toroidal fountain and drain of self-illuminating
energy — a cellular node, or jewel, in a network linking omnidirectionally
without end. That is unusually literal about its geometry, so the shader
implements the description rather than imitating the paintings:

- **Endlessness** — log-polar space repeats, so shells recede toward the centre
  forever and nothing terminates.
- **Radial symmetry** — a mirrored kaleidoscopic fold, giving bilateral symmetry
  inside each petal rather than a merely rotated tile.
- **Self-illumination** — everything is additive. No surfaces, no shading, no
  lighting model. This is what lets the palette stay that saturated.
- **The network** — glowing nodes on a hex-packed grid, joined by thin
  filaments. The node is the jewel; the filament is the link.
- **The fountain and drain** — the audio. The rim is now, the centre is ~8
  seconds ago, so the tunnel is a literal recording: a beat is a ring
  travelling inward, a section is a stretch of differently-coloured depth.

The palette bug worth recording: the first version set the colours by _mixing_ a
cool and a warm one, which is precisely how to ruin this idiom. Mixing
complementaries in RGB passes through grey, and the whole screen came out a
muddy brown. Complementaries have to be **assigned to opposing elements** — node
against filament — and never blended. Colour is now chosen by rotating a hue
with saturation pinned high, so it stays electric wherever the audio pushes it.

**The shape isn't fixed either.** Symmetry order, node density, tunnel depth,
and a spiral twist are all drawn from the seed — the same one colour and spin
come from — so a reshape (space bar, a vertical swipe, or a real structural
boundary in the music) is a genuinely different lattice, not a recoloured
version of the same one. The twist also breathes continuously via the flow
clock, on top of whatever the current reshape set it to, so the tunnel keeps
moving even through a long stretch where nothing structural happens. The
automatic reshape uses the same rising-edge-plus-cooldown trigger as Circles'
ripples (see below) — `novelty` crossing a threshold, gated by an 8-second
cooldown so the boundary's own decay tail can't retrigger it — reusing the
one signal this project already has for "the track just changed."

## Running it

```bash
pnpm install
pnpm dev          # then open the Network URL on your phone, same wi-fi
```

The dev server binds to `0.0.0.0` because testing this in desktop device
emulation is close to useless: the gesture unlock, the wake lock, and above all
the GPU fill-rate budget all behave differently on real hardware.

One caveat — `getUserMedia` requires a secure context. `localhost` counts;
`http://192.168.x.x` does not, so Chrome on Android will refuse the microphone
over plain LAN HTTP. Either use the deployed URL, or enable HTTPS on the dev
server, or add the origin under `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
iOS Safari is stricter still and wants real HTTPS.

```bash
pnpm build        # typecheck + production build
pnpm preview
pnpm lint
pnpm probe        # mapping behaviour, no browser required
./deploy/deploy.sh
```

## Tuning the mapping

Two tools, because judging this by eye alone does not work — a dark screen looks
identical whether the mapping produces nothing or the shader is simply too dim.

The **control panel** (tap anywhere) carries a live readout: frame time, the
pixel-ratio rung in use, and every parameter as a bar. That is the one that
works in a real room, on a phone, with real sound. `?debug` opens with it
already on.

Space bar or a **vertical swipe** re-rolls a `uSeed` uniform that each view
spends on whatever it doesn't already get from the music — Field gets a new
patch of noise, a spin, and a hue rotation; Lattice gets a new hue, a new
rotational symmetry order (4 to 9), a new node density, a new tunnel depth,
and a new spiral twist. A horizontal **swipe** instead steps the atmospheric
layer forward or back (left for the next one, right for the previous).

This used to be double-tap/double-click, and it did not actually work. The
control panel's tap-to-open listener has zero delay by design — it exists
specifically to open on a tap with no wait — so the first tap of an intended
double tap already opened the panel before a second tap could ever be
compared against it, and the second tap then landed on the now-visible scrim,
which the gesture listener deliberately ignores (so operating the panel
itself never also triggers a gesture underneath it). The double tap could
never complete; it just looked like the panel opening on an ordinary single
tap, because that is exactly what was happening. There is no way to tell "one
tap" from "the first half of two taps" without either holding every single
tap for the double-tap window before acting on it — which defeats the reason
the panel uses a zero-delay tap at all — or picking a gesture a tap cannot be
mistaken for. A swipe already has to clear a distance threshold to register,
so it sidesteps the ambiguity instead of resolving it, and the panel's own
tap-to-open listener checks the pointerdown-to-pointerup distance so a swipe
never also pops it open underneath.

`pnpm probe` runs the mappings over synthetic frames in Node — no browser, no
microphone — and prints their response curves. It exists because you cannot
conveniently produce a controlled −40 dB tone, a 120 bpm kick pattern and a
three-second breakdown on demand in a kitchen, and because a regression here is
invisible until you already dislike how something looks.

It has found every real bug in the mapping so far, none of which were visible on
screen:

- `level` pinned at 0.98 against a mid band of 0.06 — an AGC erasing the
  dynamics the whole design rests on
- `auto-normalised` capped at 0.33 on single-band material
- a fixed gain leaving 4% headroom at music levels, which is what made the
  visuals feel dead on a real phone

Two of its checks are close to pass/fail:

- a 120 bpm pattern must move `level` and `transient` while leaving `break` at
  zero
- `level` must read the same at 6 fps as at 60 fps

The second exists because of a real trap. `dt` is clamped so that returning from
a backgrounded tab does not slam every envelope to its target at once — but the
bound was 1/15 s, tight enough to bite during ordinary slow running. Once it
does, the envelopes advance more slowly than wall-clock, the running mean never
catches up to the instantaneous energy, and _everything measured against it pins
to 1.0_. It showed up as `level`, `low`, `mid` and `high` all sitting at exactly
1.00 in a throttled tab; a phone dropping to 10 fps would have hit the same
wall. The bound is now 1/5 s.

## How it fits together

```
main.ts            picks a mapping, owns the rAF loop
 ├─ permission-gate.ts   tap-to-start overlay, WebGL check, wake lock
 ├─ audio.ts             getUserMedia -> AnalyserNode -> AudioFrame
 ├─ mapping.ts           AudioFrame -> VisualParams   <- the swappable part
 └─ scene.ts             Three.js fullscreen quad + shaders/
```

The split between `audio.ts` and `mapping.ts` is the load-bearing one. Capture
is fixed; the interpretation of what was captured is expected to be rewritten
repeatedly, so it lives behind a one-method interface and nothing else knows how
it works.

## Mappings

Three ship. Switch with `?mapping=` in the URL, so they can be compared on a
phone without a rebuild:

- **`relative`** (default) — `level` is how loud this moment is against the last
  few seconds, not against an absolute scale. Self-calibrates between a quiet
  room and a sound system, keeping headroom at both.
- **`speech-band`** — fixed gain with soft saturation. Quiet genuinely reads as
  quiet and a long decay traces a curve instead of being normalised away. Right
  for ambient recording and voice; saturates on music at room volume.
- **`auto-normalised`** — every band stretched to fill its own range. Most
  robust against unknown material, at the cost of being unable to tell loud
  from quiet.

**Absolute loudness turned out to be the wrong drive signal**, and this is the
single most important thing the project learned. A gain tuned in a quiet room
leaves 4% headroom once real music plays — everything pins near maximum and the
visuals go inert exactly when there is most to react to:

```
byte              relative           speech-band
  10          0.44 (+0.56)          0.18 (+0.82)
 100          0.44 (+0.56)          0.83 (+0.17)
 200          0.44 (+0.56)          0.96 (+0.04)
```

The number in brackets is the headroom, which is the room the visuals have left
to move in. `relative` holds it constant at every input level.

## What reacts to what

Different signals move on deliberately different timescales. Colour that chased
every transient would strobe; motion that ignored them would feel dead.

| Signal      | Timescale | Drives                                                                                 |
| ----------- | --------- | -------------------------------------------------------------------------------------- |
| `transient` | ~0.16 s   | ripples struck outward from the centre                                                 |
| `level`     | ~0.28 s   | flow speed, contrast, warp, brightness                                                 |
| `tilt`      | ~2.5 s    | **colour** — bass-heavy runs blue→violet→magenta, treble-heavy runs midnight→teal→gold |
| `breakdown` | ~0.5 s    | motion stalls, frame contracts, colour drains to grey                                  |
| `surge`     | re-entry  | bloom and expansion coming out of a break                                              |

**Break detection** is the part with a real constraint: it has to fire on a
breakdown but not on the gap between two beats, and those differ only in
duration. A 0.3 s attack on the detector separates them. Against a synthetic
120 bpm pattern (60 ms hits, 440 ms gaps) `break` peaks at **0.000**, while
`level` still swings 0.26–0.93 — the beats are fully visible, and none of them
is mistaken for a drop.

It is also gated on the recent norm being audible at all, without which a silent
room reads as one continuous breakdown.

## Longer-timescale analysis

`mapping.ts` reacts within a second. That covers beats and breaks and nothing
else — it cannot tell a verse from a build, because it never looks further back
than its own envelopes. `features.ts` is the memory.

### Structural novelty — Foote, made causal

[Foote's self-similarity novelty](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S4_NoveltySegmentation.html)
is the standard method: build a self-similarity matrix over timbre features and
convolve a Gaussian-tapered checkerboard kernel down its diagonal. Homogeneous
sections form blocks; a boundary between two of them looks like a checkerboard,
so peaks in the convolution are section boundaries.

That kernel is centred, which means it needs half a window of **future** audio —
about a second of lag before the visuals could react to a change that has
already happened. So the kernel here is evaluated with the boundary at _now_:
the most recent half-window against the one before it. Same +1/−1 quadrant
structure, just causal. It gives up refining a boundary after the fact, which is
meaningless live, and buys back the entire lag.

**Mean-variance normalisation is not optional**, and skipping it is a silent
failure. Log magnitudes are all positive and sit in a narrow range, so the cosine
similarity between _any_ two frames is ~0.9 and cannot discriminate. Measured
novelty peaked at 0.13 on a bass-led → treble-led section change — something you
could not miss by ear. Centring the vectors turns the dot product into a
correlation spanning −1..1:

|                                   | before | after    |
| --------------------------------- | ------ | -------- |
| section change, constant loudness | 0.13   | **0.84** |
| steady 120 bpm beat               | 0.00   | **0.00** |

The second row matters as much as the first: beats must not read as structure.

### Fractal character — the 1/f exponent

Voss and Clarke showed musical audio power follows roughly 1/f — pink noise. The
exponent β is a real timbral descriptor: steep means energy concentrated low,
dark and smooth; shallow means energy spread up the spectrum, bright and noisy.

Since the shader is _already_ built on fractal noise, β drives the fbm octave
gain directly — the audio's spectral self-similarity sets the visual's. Dark
smooth music renders as smooth structure, bright noisy music as fine detail.

The trap here cost a rewrite. `getByteFrequencyData` returns values already
linear in **decibels**, not magnitude, so the obvious `log(byte/255)` is a
second logarithm on top of the first. Regressing dB against log-frequency
instead, with β = −slope/10, recovery of a known exponent improved from 0.06 to
0.5 units of output per unit of β:

```
beta   roughness      (0 = white, 1 = pink, 2 = brown)
0.0      1.000
1.0      0.584        <- where music mostly lives, mid-range
2.0      0.078
```

## Feeding audio to the GPU

Yes — and the useful part is not what you would expect.

**Not the FFT.** The browser's `AnalyserNode` already does that in native code;
reimplementing it as a fragment-shader butterfly would be slower, far more
complex, and WebGL2 has no compute shaders to do it properly. (WebGPU does, and
would be the route if this ever needed genuine DSP on the GPU.)

**The history.** What the GPU can do that the CPU cannot is hold the last few
seconds of spectrum and let _every pixel read a different moment of it_, every
frame, in a single texture fetch. `scene.ts` maintains a 256×64 rolling
spectrogram — time on x, log frequency on y, 16 KB, one column written every
33 ms for ~8.5 seconds of history. The shader renders it as a **polar
spectrogram**: radius is time into the past, angle is frequency. A beat becomes
a shell expanding outward; a section becomes a visible band of texture.

Reconstructing that per-pixel on the CPU is not merely slow, it is not possible
at frame rate. That asymmetry is the whole argument for putting audio on the
GPU.

## Design notes

The visual brief came from a reference recording — a quiet phone capture, no
beat, no sub-bass, swelling over about two seconds and then decaying for twenty.
The aesthetic is still built around **swell and decay rather than pulse**, even
though the default mapping now handles music too:

- Motion runs on `uFlow`, a phase the CPU integrates from the audio level, not
  on wall-clock time. Silence coasts the field almost to a stop; sound makes it
  churn; a break nearly freezes it. Only the slowest drift is time-driven, so a
  silent room still breathes.
- Onsets push a soft ripple out from the centre instead of flashing the frame.
  A full-frame flash reads as a beat marker; this reads as the field being
  struck.
- Neither palette ramp reaches white. It is a nocturnal thing.
- Contrast opens with energy: near-silence is nearly featureless, and structure
  resolves as sound arrives.
- A break drains the colour towards grey. Losing the hue is what makes its
  return on re-entry worth watching.

## Performance

The atmospheric shader is fill-rate bound — three fbm lookups per pixel, four
octaves each — so resolution is the dominant lever by a wide margin, and the
two-layer composite (geometric pass, atmospheric pass, blend pass) makes
resolution matter even more: the extra passes are cheap on their own, but they
still scale with however many pixels the ladder below has chosen.

It is **adaptive**. A fixed cap of 2.0 measured 52 fps on a real phone, close
enough to the edge that any added shader work would have pushed it under. Rather
than guess a lower constant and cost sharpness on hardware that never needed it,
the renderer measures its own frame time and walks a ladder
(1.0 / 1.25 / 1.5 / 1.75 / 2.0), stepping down above 18.5 ms and back up below
13.8 ms, with a 1.5 s settle between changes so it cannot oscillate. `?debug`
shows the rung currently in use.

After resolution, the octave count in `fbm()`.

WebGL context loss is handled rather than treated as an error: mobile browsers
reclaim contexts routinely when a tab is backgrounded.

## Deploying

Two targets, both on push to `main`.

**GitHub Pages** (`.github/workflows/pages.yml`) needs no configuration at all
beyond the repo being public — no token, no account, no dashboard.

**Cloudflare Pages** (`.github/workflows/deploy.yml`) needs two repository
secrets, both created by hand in the Cloudflare dashboard:

- `CLOUDFLARE_API_TOKEN` — a token with `Pages:Edit`
- `CLOUDFLARE_ACCOUNT_ID`

Until those exist that workflow fails at its last step; everything before it
still runs, so CI remains a useful check. `./deploy/deploy.sh` deploys to
Cloudflare from a machine with an authenticated `wrangler` session, no secrets
required.

The only difference between the two builds is `BASE_PATH`: Cloudflare serves at
the root of its own subdomain, GitHub under `/<repo>/`. `vite.config.ts` reads
it and defaults to `/`.
