# suti-view-2026

A microphone-driven WebGL field, built for a phone held in the hand rather than
a browser window on a desk.

**Live:** [suti-view-2026.pages.dev](https://suti-view-2026.pages.dev) ·
[vvorski.github.io/suti-view-2026](https://vvorski.github.io/suti-view-2026/)

Both serve the same build. Cloudflare Pages is the primary target; GitHub Pages
is there because it needs nothing but a public repo. Either works on a phone —
the microphone requires a secure context, and both are HTTPS.

Tap to begin, grant the microphone, and the page renders a domain-warped noise
field lit by whatever it hears. Audio never leaves the device — there is no
recording, no upload, and no backend.

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

`?debug` in the URL overlays a live readout: the active mapping, frame time, and
the five parameters as bars. That is the one that works in a real room, on the
phone, with real sound.

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

Its most useful check is the beat test, the one thing close to pass/fail: a
120 bpm pattern must move `level` and `transient` while leaving `break` at zero.

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

The shader is fill-rate bound — three fbm lookups per pixel, four octaves each
— so resolution is the dominant lever by a wide margin.

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
