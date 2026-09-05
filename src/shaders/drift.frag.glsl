// "Drift" — a geometric-layer programme, and the first of three variations on
// Circles.
//
// All three keep Circles' ring exactly as it is — the same double stroke, the
// same weight proportional to the ring's own radius, the same linear growth —
// and change only *where* a ring is born. Circles fires every ring from the
// exact centre of the frame, so however many are alive they are always
// concentric, and a busy passage reads as one thick pulsing target. Here the
// origin wanders, so consecutive hits are born at different points and their
// rings cross rather than nest.
//
// The origin is a pure function of the ring's own birth time, and that is not
// a stylistic choice. uRipples carries (birthTime, birthLevel) and nothing
// else (see ripples.ts), so there is nowhere to record where a ring was born;
// re-deriving it from anything that moves — uTime, uFlow, uLevel — would slide
// the centre of a ring that is already on screen, and a ring whose centre
// moves after birth reads as a camera pan rather than as an event. Deriving it
// from `birth` alone nails it down for the ring's whole life, and costs one
// pair of sines per ripple.
//
// The consequence is the one thing on this layer that does not answer to the
// room: the path runs on the wall clock. uFlow, the audio's own motion clock,
// is the better parameter and cannot be used, because what is wanted is uFlow
// *at the instant of the hit* and only its current value is ever uploaded.
//
// White and hard-edged like the rest of the layer; colour is an RGB filter
// applied to the finished layer afterwards (see geo-colour.ts).

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uLevel;
uniform float uLow;
uniform float uBreak;
uniform vec4 uSeed;
// docs/todo.md entry 96 — the moon's own abundance, over ripple reach
// and lifespan only (colour stays the sun's alone). 1.0 at new moon or
// moon-down, identical to today; scene.ts is the only writer.
uniform float uMoonReach;
uniform float uMoonLife;
// docs/todo.md entry 106 -- the moon third quality, over the opacity
// envelope only (never the growth curve -- see FADE_FROM own comment).
// 0 at new moon, full moon or moon-down, identical to today; signed,
// added directly to FADE_FROM at every place this shader reads it.
uniform float uMoonBloom;

// Must match MAX_RIPPLES in ripples.ts — GLSL can't import a JS constant, and
// a mismatch here means scene.ts uploads an array of the wrong length.
//
// Twenty-four since docs/todo.md entry 57: eight audio slots as before,
// plus sixteen reserved for touch, up from four — see ripples.ts.
const int MAX_RIPPLES = 24;
const int AUDIO_RIPPLES = 8;
uniform vec4 uRipples[MAX_RIPPLES];
uniform vec2 uOrigin; // docs/todo.md entry 132 — the geometric centre, hanging under gravity

const float TAU = 6.28318530718;

const float LIFESPAN = 3.2; // seconds, as Circles — this is the comparison
const float FADE_FROM = 0.6;

// Circles' proportions, unchanged. The variation here is the emitter, so
// anything that changes how a ring is drawn would confound it.
const float OUTER_STROKE = 0.22; // of radius
const float INNER_STROKE = 0.09; // of the outer radius
const float INNER_RADIUS = 0.70; // of radius

// Fraction of each half-extent the origin can reach, so the wander adapts to a
// portrait phone rather than assuming a square. At 1.0 the path would touch
// the corners, where a ring shows only the quarter of itself that is still on
// screen; a little over half keeps the whole of a young ring visible wherever
// it is born, and still puts the emitter somewhere different every second.
const float WANDER = 0.55;

// Two incommensurate rates, so the path is a Lissajous that does not repeat on
// any timescale anyone will sit through. The speed is the whole design, and
// the thing it has to be measured against is not the beat but the rate a ring
// grows, maxRadius/LIFESPAN. Both sides of that were tried on screen:
//
//   Faster than a ring grows (0.83/0.61) and each new origin lands outside its
//   predecessor, so the families interlock in a chain rather than overlap.
//   Legibly not Circles, but the fronts meet at steep enough angles that it
//   reads as a tangle rather than as rings.
//
//   Half the rate below (0.28/0.20) and every origin sits deep inside the
//   previous ring. Not the failure it sounds like — it gives a handsome
//   eccentric nest, like a shell — but the offsets are small enough that a
//   glance still reads it as Circles seen from one side.
//
// These put the emitter's top speed just under the growth rate, which is the
// case where each ring is born inside the last one and visibly off its centre:
// a nest that leans, and leans further with every hit.
const float OMEGA_X = 0.55;
const float OMEGA_Y = 0.40;

// Where the emitter is at time t. Seeded phases, so a re-roll starts the
// wander somewhere else instead of merely re-timing the same tour.
vec2 emitterAt(float t, vec2 halfExtent) {
  return vec2(
    halfExtent.x * WANDER * sin(t * OMEGA_X + uSeed.x * TAU),
    halfExtent.y * WANDER * sin(t * OMEGA_Y + uSeed.y * TAU)
  );
}

// A hard-edged ring, antialiased over roughly one pixel. Pixel size comes from
// uResolution rather than fwidth(): derivatives need an extension in GLSL ES
// 1.00, and one pixel here is exactly 1/min(resolution), that being what the
// coordinates were divided by.
float ring(float dist, float radius, float halfWidth, float px) {
  float d = abs(dist - radius) - halfWidth;
  return 1.0 - smoothstep(0.0, px * 1.5, d);
}

// docs/todo.md entry 79 — deterministic per-slot variation for touch rings
// in the loop below, same one-liner tide.frag.glsl and rose.frag.glsl use.
float hash(float x) {
  return fract(sin(x * 127.1) * 43758.5453123);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float px = 1.0 / min(uResolution.x, uResolution.y);
  vec2 halfExtent = 0.5 * uResolution / min(uResolution.x, uResolution.y);

  // Deliberately Circles' finish radius — half the longer screen dimension —
  // and not the distance from this ring's origin to the far corner. A ring is
  // the same size wherever it was born, so an off-centre one leaves the near
  // edge early and dies before it reaches the far side. That is what makes a
  // family read as covering a region of the frame rather than all of it.
  float maxRadius = max(halfExtent.x, halfExtent.y) * uMoonReach;
  // docs/todo.md entry 96 — same abundance scaling as Circles.
  float lifespan = LIFESPAN * uMoonLife;
  // docs/todo.md entry 106 -- computed once for the same reason lifespan
  // above is: every opacity test below reads it. Waxing raises it (stays
  // full almost to the rim, then fades quickly); waning lowers it (fades
  // almost immediately, trailing off for most of the ring travel).
  float fadeFrom = FADE_FROM + uMoonBloom;

  float ink = 0.0;

  // docs/todo.md entry 122 — an ink budget for touch rings, same finding and
  // identity as Circles' own touch loop: a drag's sixteen slots at ≥0.74
  // opacity flood the frame solid; 1/sqrt(n) holds total ink energy constant
  // instead. Counted here (touch slots only, same `age`-alive test the loop
  // below uses) rather than handed down as a uniform, for the same reason
  // `lifespan` above is computed once per-shader: it differs with
  // `uMoonLife`, so TypeScript cannot know "alive" exactly. Exactly 1.0 for
  // a lone ring, and audio rings (`i < AUDIO_RIPPLES`) are never counted or
  // weighted, so a single tap or an audio-only frame is bit-identical.
  float touchAlive = 0.0;
  for (int i = AUDIO_RIPPLES; i < MAX_RIPPLES; i++) {
    float aliveAge = uTime - uRipples[i].x;
    if (aliveAge >= 0.0 && aliveAge <= lifespan) touchAlive += 1.0;
  }
  float touchWeight = inversesqrt(max(touchAlive, 1.0));

  for (int i = 0; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float birthLevel = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0 || age > lifespan) continue;

    // docs/todo.md entry 33: a touch ring's wander starts at the finger
    // rather than at its seeded phase — the one branch this view needs,
    // since it already recomputes its origin per ring rather than sharing
    // one hoisted value the way Circles does.
    // docs/todo.md entry 132 — the wandering emitter's whole path hangs with
    // the geometric centre; it keeps wandering, around a centre that has moved.
    vec2 origin = i < AUDIO_RIPPLES ? emitterAt(birth, halfExtent) + uOrigin : uRipples[i].zw;
    float dist = length(uv - origin);

    float percent = age / lifespan;
    float radius = maxRadius * percent; // linear, as Circles: the band thickens as it travels

    // docs/todo.md entry 79 — touch rings only (see Circles' own comment on
    // this same variation for the full reasoning): a deterministic per-slot
    // hash nudges radius (phase) and stroke width just enough that a drag's
    // trail of near-simultaneous rings reads as a sequence, while leaving
    // the audio ring's own appearance untouched.
    float slotPhase = i < AUDIO_RIPPLES ? 1.0 : 0.98 + 0.04 * hash(float(i) + 31.0);
    radius *= slotPhase;
    float slotStroke = i < AUDIO_RIPPLES ? 1.0 : 0.88 + 0.24 * hash(float(i) + 11.0);

    float opacity = percent > fadeFrom ? 1.0 - (percent - fadeFrom) / (1.0 - fadeFrom) : 1.0;
    opacity *= (0.35 + 0.65 * birthLevel) * (i < AUDIO_RIPPLES ? 1.0 : touchWeight);

    float scale = (0.8 + 0.4 * birthLevel) * slotStroke;
    float outerHalf = max(radius * OUTER_STROKE * 0.5 * scale, px * 0.5);
    float innerHalf = max(radius * INNER_STROKE * 0.5 * scale, px * 0.5);

    float outer = ring(dist, radius, outerHalf, px);
    float inner = ring(dist, radius * INNER_RADIUS, innerHalf, px);

    ink = 1.0 - (1.0 - ink) * (1.0 - (outer + inner) * opacity);
  }

  // The emitter itself, marked where it is *now* and breathing with the bass.
  // Circles puts a circle at the centre so there is something to look at
  // between hits; here it does that job and one more, which is to make the
  // wander visible. Without it the origins only exist as an inference from
  // where rings happen to appear, and the view looks like it is misfiring
  // rather than tracking something.
  float lead = length(uv - (emitterAt(uTime, halfExtent) + uOrigin));
  float leadR = 0.012 + 0.055 * uLow;
  ink += ring(lead, leadR, px * 0.9, px) * (0.25 + 0.55 * uLow);

  // A break thins the ink rather than draining colour — there is none here.
  ink *= 1.0 - uBreak * 0.55;

  gl_FragColor = vec4(vec3(clamp(ink, 0.0, 1.0)), 1.0);
}
