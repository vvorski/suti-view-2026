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

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

// A soft radial glow rather than a hard antialiased stroke. Everything else
// in this project is emissive light, not drawn line-art, and a crisp edge
// here would read as a UI element sitting on top of the visuals instead of
// part of them.
float ring(float dist, float radius, float halfWidth) {
  float d = (dist - radius) / max(halfWidth, 1e-4);
  return exp(-d * d * 2.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float dist = length(uv);
  // Reach the far corner, not just the nearer edge, so a ring genuinely exits
  // the frame before it is done rather than fading inside it.
  float maxRadius = 0.5 * length(uResolution) / min(uResolution.x, uResolution.y);

  vec3 col = vec3(0.0);

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
    // A quiet hit still gets a ring, just a dim, thin one — audible does not
    // mean invisible, but loud should clearly outshine quiet.
    opacity *= 0.35 + 0.65 * birthLevel;

    float outer = ring(dist, radius, radius * 0.10 + 0.012);
    float inner = ring(dist, radius * 0.7, radius * 0.05 + 0.007);

    // Each ring keeps the hue it was born with rather than drifting with the
    // room's current tilt as it ages — a ring is a moment, and repainting an
    // old one would make its fade read as a colour change rather than a
    // light going out. The per-ripple offset keeps overlapping rings from a
    // fast passage reading as one flat colour.
    float hue = fract(uSeed.x + uTilt * 0.4 + float(i) * 0.11);
    vec3 ringCol = hsv2rgb(vec3(hue, 0.75, 1.0));

    col += ringCol * (outer + inner * 0.8) * opacity;
  }

  // A soft anchor at centre, breathing with the bass, so there is something
  // to look at between hits rather than a dead patch of black.
  col += vec3(0.35, 0.30, 0.55) * uLow * exp(-dist * dist * 30.0) * 0.6;

  // A break drains colour without erasing structure — the same treatment the
  // atmospheric layer gives itself.
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * 0.7, uBreak * 0.8);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
