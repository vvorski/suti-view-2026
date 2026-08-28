# suti-view-2026

A microphone-driven WebGL field, built for a phone held in the hand rather than
a browser window on a desk.

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
conveniently produce a controlled −40 dB tone in a kitchen, and because a
regression here is invisible until you already dislike how something looks. It
caught both bugs in the first pass: `level` pinned at 0.98 against a mid band of
0.06, and `auto-normalised` capped at 0.33 on single-band material.

Its second table is the useful one — the reference recording's swell-and-decay
shape run through both mappings:

```
 t          speech-band      auto-normalised
 2s        90 -> 0.604        90 -> 1.000
 8s        38 -> 0.496        38 -> 0.999
14s        16 -> 0.293        16 -> 0.994
20s         7 -> 0.146         7 -> 0.531
```

One traces the decay; the other holds a plateau and then falls off a cliff. That
is the whole difference between the two strategies, and it is why `speech-band`
is the default.

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

Two ship. Switch with `?mapping=` in the URL, so both can be compared on a phone
without a rebuild:

- **`speech-band`** (default) — drive comes from 250–1600 Hz, weighted for
  voice, with sub-bass contributing almost nothing. Suits ambient sound, rooms
  and speech.
- **`auto-normalised`** — each band gets its own rolling ceiling, so quiet
  material and loud material both reach the top of the visual range. More
  forgiving across unknown input; less faithful about what is actually loud.

Both end in an asymmetric envelope: fast attack, slow release.

## Design notes

The visual brief came from a reference recording — a quiet phone capture, no
beat, no sub-bass, swelling over about two seconds and then decaying for
twenty. So the visuals are built around **swell and decay rather than pulse**:

- Motion runs on `uFlow`, a phase the CPU integrates from the audio level, not
  on wall-clock time. Silence coasts the field almost to a stop; sound makes it
  churn. Only the slowest drift is time-driven, so a silent room still breathes.
- Onsets push a soft ripple out from the centre instead of flashing the frame.
  A full-frame flash reads as a beat, and there is no beat here.
- The palette tops out at a dim amber, never white. It is a nocturnal thing.
- Contrast opens with energy: near-silence is nearly featureless, and structure
  resolves as sound arrives.

## Performance

The shader is fill-rate bound, so the single biggest lever is the pixel-ratio
cap in `scene.ts` (currently 2 — phones report 3, which is ~9x the pixels of a
DPR-1 pass). After that, the octave count in `fbm()`. Four octaves and three
fbm lookups per pixel is the current budget.

WebGL context loss is handled rather than treated as an error: mobile browsers
reclaim contexts routinely when a tab is backgrounded.

## Deploying

Cloudflare Pages, via `.github/workflows/deploy.yml` on push to `main`. Needs
two repository secrets, both created by hand in the Cloudflare dashboard:

- `CLOUDFLARE_API_TOKEN` — a token with `Pages:Edit`
- `CLOUDFLARE_ACCOUNT_ID`

`./deploy/deploy.sh` does the same thing locally.
