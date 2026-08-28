// "Circles" — the first geometric-layer programme.
//
// suti-view-2026 grew out of ~/dev/circles, a video-chat app whose waiting
// room draws slow concentric rings on a fixed timer while people join. That
// effect never listened to anything — it was ambient wallpaper running on a
// clock. This is the same shape of idea (paired rings expanding from centre,
// fading as they grow) rewritten to answer to the room instead of a timer: a
// ring is born on a transient, not a `setInterval`, and its size and
// brightness carry the loudness of the hit that made it.
//
// That is also the reason this is its own layer rather than folded into
// Field or Lattice. Those are continuous fields — noise, spectrograms,
// envelopes — and read as weather. A ring is a discrete event with a start
// time, which does not fit a continuous field without either faking events
// out of it (as Field's single transient ripple already does, one at a time)
// or actually tracking them. This layer tracks them: scene.ts watches for a
// transient crossing a threshold and hands this shader a small buffer of
// (birth time, birth loudness) pairs to draw independently, each ageing at
// its own rate. See ripples.ts for the trigger logic.
//
// Two rules this layer follows, and the atmospheric one does not:
//
//   Drawn, not glowing. Rings are hard-edged lines a pixel or two wide, not
//   soft radial falloffs. An earlier version used a gaussian around the ring
//   radius, which reads as light leaking rather than as geometry, and turned
//   to mush the moment it was composited over a busy field.
//
//   White, not coloured. Everything here is monochrome; colour is applied to
//   the whole layer afterwards as an RGB filter (see composite.frag.glsl and
//   geo-filters.ts). Keeping shape and colour separate means a filter change
//   is instant and total, and means the geometry never fights the atmospheric
//   layer's palette for the same hue.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uLevel;
uniform float uLow;
uniform float uTilt;
uniform float uBreak;
uniform vec4 uSeed;

// Must match MAX_RIPPLES in ripples.ts — GLSL can't import a JS constant, and
// a mismatch here means scene.ts uploads an array of the wrong length.
const int MAX_RIPPLES = 8;
// (birthTime, birthLevel) pairs. An unborn slot has birthTime far enough in
// the past that `age` always exceeds LIFESPAN and it contributes nothing.
uniform vec2 uRipples[MAX_RIPPLES];

const float LIFESPAN = 3.2; // seconds from birth to vanishing at the rim
const float FADE_FROM = 0.6; // fraction of LIFESPAN where fade-out begins

// A hard-edged ring, antialiased over roughly one pixel.
//
// The pixel size is derived from uResolution rather than from fwidth(): in
// GLSL ES 1.00 derivatives need an extension, and one pixel here is exactly
// 1/min(resolution) because that is what uv was divided by. No extension, no
// per-fragment derivative, same result.
float ring(float dist, float radius, float halfWidth, float px) {
  float d = abs(dist - radius) - halfWidth;
  return 1.0 - smoothstep(0.0, px * 1.5, d);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float dist = length(uv);
  float px = 1.0 / min(uResolution.x, uResolution.y);
  // Reach the far corner, not just the nearer edge, so a ring genuinely exits
  // the frame before it is done rather than fading inside it.
  float maxRadius = 0.5 * length(uResolution) / min(uResolution.x, uResolution.y);

  float ink = 0.0;

  for (int i = 0; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float birthLevel = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0 || age > LIFESPAN) continue;

    float percent = age / LIFESPAN;
    // Ease-out: a shockwave, not an inflating balloon — most of the travel
    // happens in the first instant, then it coasts to the rim.
    float eased = 1.0 - (1.0 - percent) * (1.0 - percent);
    float radius = maxRadius * eased;

    float opacity = percent > FADE_FROM ? 1.0 - (percent - FADE_FROM) / (1.0 - FADE_FROM) : 1.0;
    // A quiet hit still gets a ring, just a fainter, thinner one — audible
    // does not mean invisible, but loud should clearly outshine quiet.
    opacity *= 0.35 + 0.65 * birthLevel;

    // Line weight carries loudness, since brightness alone can't once the
    // layer is a flat white: a hard line at 40% grey and one at 100% read as
    // much more alike than a thin line and a thick one do.
    float weight = px * (0.6 + 1.9 * birthLevel);

    float outer = ring(dist, radius, weight, px);
    float inner = ring(dist, radius * 0.7, weight * 0.7, px);

    ink += (outer + inner * 0.65) * opacity;
  }

  // A crisp circle at centre, breathing with the bass, so there is something
  // to look at between hits rather than a dead patch of black. Drawn as an
  // outline for the same reason as everything else here.
  float centreR = 0.012 + 0.055 * uLow;
  ink += ring(dist, centreR, px * 0.9, px) * (0.25 + 0.55 * uLow);

  // A break thins the ink rather than draining colour — there is no colour
  // here to drain.
  ink *= 1.0 - uBreak * 0.55;

  gl_FragColor = vec4(vec3(clamp(ink, 0.0, 1.0)), 1.0);
}
