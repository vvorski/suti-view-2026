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
//
// Like Circles, this draws hard-edged white geometry: no gaussian falloffs, no
// per-shard hue. Colour is applied to the whole layer afterwards as an RGB
// filter (see geo-colour.ts), so shape and colour stay separate concerns.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uLevel;
uniform float uLow;
uniform float uHigh;
uniform float uBreak;
uniform vec4 uSeed;
// docs/todo.md entry 96 — the moon's own abundance, over ripple reach
// and lifespan only (colour stays the sun's alone). 1.0 at new moon or
// moon-down, identical to today; scene.ts is the only writer.
uniform float uMoonReach;
uniform float uMoonLife;

// Must match MAX_RIPPLES in ripples.ts — GLSL can't import a JS constant, and
// a mismatch here means scene.ts uploads an array of the wrong length.
//
// Twenty-four since docs/todo.md entry 57: eight audio slots as before,
// plus sixteen reserved for touch, up from four — see ripples.ts.
const int MAX_RIPPLES = 24;
const int AUDIO_RIPPLES = 8;
uniform vec4 uRipples[MAX_RIPPLES];

const float TAU = 6.28318530718;
const float LIFESPAN = 2.6; // shorter than Circles: debris, not a swell
const float FADE_FROM = 0.45;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float maxRadius = 0.5 * length(uResolution) / min(uResolution.x, uResolution.y) * uMoonReach;
  // docs/todo.md entry 96 — same abundance scaling as Circles.
  float lifespan = LIFESPAN * uMoonLife;
  float px = 1.0 / min(uResolution.x, uResolution.y);

  // Symmetry order is a seed choice, so a re-roll genuinely restructures the
  // burst rather than just recolouring it. 5..10 keeps the fragments readable
  // as separate pieces at the radius they spend most of their life at.
  float symmetry = 5.0 + floor(uSeed.y * 6.0);
  float sector = TAU / symmetry;

  float ink = 0.0;

  for (int i = 0; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float birthLevel = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0 || age > lifespan) continue;

    // docs/todo.md entry 33: a touch-born burst throws its fragments outward
    // from the finger rather than from centre. dist/angle move inside the
    // loop for this — an audio burst still measures from centre every time,
    // so this costs one extra length()/atan() only on the four touch slots.
    vec2 origin = i < AUDIO_RIPPLES ? vec2(0.0) : uRipples[i].zw;
    vec2 rel = uv - origin;
    float dist = length(rel);
    float angle = atan(rel.y, rel.x);

    float percent = age / lifespan;
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

    // Width is held in *screen* units, not radians. An angular half-width is
    // the obvious way to write this and the wrong one: a constant angle spans
    // more and more screen the further out it travels, so the first version's
    // splinters had become solid slabs covering half the frame by the time
    // they reached the rim. Multiplying the folded angle by the radius gives
    // the arc distance from the shard's spine, which is what "thickness"
    // actually means here — so a splinter stays the same width all the way out.
    float w = 0.004 + 0.012 * birthLevel;
    float across = 1.0 - smoothstep(0.0, px * 1.5, folded * max(dist, 1e-4) - w);

    // Radial extent: long enough to read as a splinter rather than a dash,
    // short enough to stay a fragment. Shortens as the burst ages.
    float length_ = maxRadius * (0.12 - 0.07 * percent) + 0.010;
    float along = 1.0 - smoothstep(0.0, px * 1.5, abs(dist - radius) - length_);

    float opacity = percent > FADE_FROM
      ? 1.0 - (percent - FADE_FROM) / (1.0 - FADE_FROM)
      : 1.0;
    opacity *= 0.30 + 0.70 * birthLevel;

    ink += across * along * opacity;
  }

  // A thin ring at the origin that snaps outward on the highs, so the frame is
  // not empty between bursts. Always the frame's own centre — this mark says
  // where an *audio* burst comes from, unaffected by whatever a touch burst
  // in the loop above used as its own origin.
  float distFromCentre = length(uv);
  float centreR = 0.010 + 0.030 * uHigh;
  float centre = 1.0 - smoothstep(0.0, px * 1.5, abs(distFromCentre - centreR) - px);
  ink += centre * (0.20 + 0.5 * uHigh);

  // A break thins the ink rather than draining colour — there is none here.
  ink *= 1.0 - uBreak * 0.55;

  gl_FragColor = vec4(vec3(clamp(ink, 0.0, 1.0)), 1.0);
}
