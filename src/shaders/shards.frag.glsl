// "Shards" — a geometric-layer programme.
//
// Circles answers a hit with a ring: one continuous curve, every direction
// treated alike. This answers the same hit with a burst of angular fragments
// thrown outward from centre, so the event has a *shape* as well as a size —
// a shatter rather than a wave.
//
// Like Circles it reads uRipples (see ripples.ts) rather than a timer, so
// every burst is a real transient with its own birth time and loudness. The
// difference is entirely in how a burst is drawn: Circles spends the ripple on
// radius, this spends it on radius *and* a rotational fold, which is what
// makes it read as debris instead of weather.
//
// The fold is done with mod() on the angle rather than a loop over K shards.
// A loop would be O(MAX_RIPPLES * K) per pixel — 40-odd iterations on a phone
// GPU for something a single modulo gets exactly right.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uLevel;
uniform float uLow;
uniform float uHigh;
uniform float uTilt;
uniform float uBreak;
uniform vec4 uSeed;

// Must match MAX_RIPPLES in ripples.ts — GLSL can't import a JS constant, and
// a mismatch here means scene.ts uploads an array of the wrong length.
const int MAX_RIPPLES = 8;
uniform vec2 uRipples[MAX_RIPPLES];

const float TAU = 6.28318530718;
const float LIFESPAN = 2.6; // shorter than Circles: debris, not a swell
const float FADE_FROM = 0.45;

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);
  float maxRadius = 0.5 * length(uResolution) / min(uResolution.x, uResolution.y);

  // Symmetry order is a seed choice, so a re-roll genuinely restructures the
  // burst rather than just recolouring it. 5..10 keeps the fragments readable
  // as separate pieces at the radius they spend most of their life at.
  float symmetry = 5.0 + floor(uSeed.y * 6.0);
  float sector = TAU / symmetry;

  vec3 col = vec3(0.0);

  for (int i = 0; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float birthLevel = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0 || age > LIFESPAN) continue;

    float percent = age / LIFESPAN;
    // Ease-out, as in Circles: a shatter throws hardest at the instant of the
    // hit and coasts after.
    float eased = 1.0 - (1.0 - percent) * (1.0 - percent);
    float radius = maxRadius * eased;

    // Each burst is offset and spun differently, so a fast passage reads as
    // several distinct events rather than one flickering figure. The spin
    // slows as the burst ages, like something losing angular momentum.
    float phase = fract(uSeed.z + float(i) * 0.137) * TAU;
    float spin = (fract(uSeed.w + float(i) * 0.41) - 0.5) * 2.2;
    float a = angle + phase + spin * (1.0 - (1.0 - percent) * (1.0 - percent)) * 1.6;

    // Fold the whole circle down into one sector, then measure how far this
    // pixel sits from that sector's centre line — the shard's spine.
    float folded = abs(mod(a, sector) - sector * 0.5);

    // Fragments narrow as they fly, which is most of what sells them as
    // shards rather than a rotating dashed ring.
    float halfWidth = sector * (0.30 - 0.17 * percent);
    float across = 1.0 - smoothstep(halfWidth * 0.35, halfWidth, folded);

    // ...and shorten, radially, around the burst's current radius. Squared by
    // multiplication rather than pow(): pow() with a negative base is
    // undefined in GLSL, and (dist - radius) is negative inside the front.
    float length_ = maxRadius * (0.20 - 0.13 * percent) + 0.02;
    float alongD = (dist - radius) / max(length_, 1e-4);
    float along = exp(-alongD * alongD * 2.4);

    float opacity = percent > FADE_FROM
      ? 1.0 - (percent - FADE_FROM) / (1.0 - FADE_FROM)
      : 1.0;
    opacity *= 0.30 + 0.70 * birthLevel;

    // A burst keeps the hue it was born with — repainting an old one would
    // make its fade read as a colour change rather than a light going out.
    float hue = fract(uSeed.x + uTilt * 0.35 + float(i) * 0.083);
    vec3 shardCol = hsv2rgb(vec3(hue, 0.70, 1.0));

    col += shardCol * across * along * opacity * 1.35;

    // A brief flash at the origin on the frame the burst is born, so the hit
    // itself is visible and not only its aftermath.
    col += shardCol * exp(-dist * dist * 90.0) * exp(-age * 9.0) * birthLevel * 0.9;
  }

  // High frequencies put a faint dusting between bursts, so silence between
  // hits is dark but not dead.
  col += vec3(0.22, 0.26, 0.42) * uHigh * exp(-dist * 2.2) * 0.16;

  // A break drains colour without erasing structure — the same treatment the
  // atmospheric layer gives itself.
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * 0.7, uBreak * 0.8);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
