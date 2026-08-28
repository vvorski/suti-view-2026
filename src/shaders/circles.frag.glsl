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
//   Drawn, not glowing. Rings are hard-edged strokes, not soft radial
//   falloffs. An earlier version used a gaussian around the ring radius,
//   which reads as light leaking rather than as geometry, and turned to mush
//   the moment it was composited over a busy field. Hard-edged does not mean
//   thin, though — see OUTER_STROKE below; the stroke is a fraction of the
//   ring's radius, so it is a broad white band, not a hairline.
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

// Straight from ~/dev/circles (src/start/CirclesAnimCanvas.tsx). The stroke
// widths there are fractions of the ring's *current* radius, not fixed pixel
// weights — which is the whole look. A new ring is a thick white band with a
// thinner one inside it, and both grow heavier as they travel. Drawing them
// as hairlines instead, as an earlier version here did, gives spidery
// concentric circles rather than the bold double ring this is meant to be.
const float OUTER_STROKE = 0.22; // of radius
const float INNER_STROKE = 0.09; // of radius (note: of the *outer* radius)
const float INNER_RADIUS = 0.70; // of radius

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
  // Half the *longer* screen dimension, matching the source's
  // `finishRadius = max(innerWidth, innerHeight) / 2`. Reaching the corner
  // instead — which an earlier version did — makes the ring keep growing well
  // after it has left the frame, so the thick band spends its last second
  // invisible and the fade reads as the ring simply going out.
  float maxRadius = 0.5 * max(uResolution.x, uResolution.y) / min(uResolution.x, uResolution.y);

  float ink = 0.0;

  for (int i = 0; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float birthLevel = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0 || age > LIFESPAN) continue;

    float percent = age / LIFESPAN;
    // Linear, as in the source. Ease-out was an embellishment added here and
    // it fights the proportional stroke: easing puts nearly all the growth in
    // the first instant, so the ring arrives already thick and then only
    // fades. Growing at a constant rate is what lets the band visibly thicken
    // as it travels, which is the movement the original has.
    float radius = maxRadius * percent;

    float opacity = percent > FADE_FROM ? 1.0 - (percent - FADE_FROM) / (1.0 - FADE_FROM) : 1.0;
    // A quiet hit still gets a ring, just a fainter one — audible does not
    // mean invisible, but loud should clearly outshine quiet. The source has
    // no idea of loudness at all; this is the one place the ring answers to
    // the room rather than to a clock.
    opacity *= 0.35 + 0.65 * birthLevel;

    // Half-widths, because `ring` measures from the centre line out while the
    // source's canvas lineWidth spans both sides of it.
    float scale = 0.8 + 0.4 * birthLevel; // loudness leans on weight too
    float outerHalf = max(radius * OUTER_STROKE * 0.5 * scale, px * 0.5);
    float innerHalf = max(radius * INNER_STROKE * 0.5 * scale, px * 0.5);

    float outer = ring(dist, radius, outerHalf, px);
    float inner = ring(dist, radius * INNER_RADIUS, innerHalf, px);

    // Both rings at full strength: they are the same white stroke in the
    // source, and dimming the inner one to 0.65 — as an earlier version did —
    // turns a matched pair into a ring with a shadow.
    ink += (outer + inner) * opacity;
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
