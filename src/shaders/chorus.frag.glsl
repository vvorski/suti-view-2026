// "Chorus" — a geometric-layer programme, and the second variation on Circles.
//
// Same ring as Circles, same growth, same double stroke; the emitter is what
// differs. Instead of one origin at the centre there are several, spaced
// evenly around a circle, and each transient fires exactly one of them. Rings
// from different nodes are the same size at the same age, so where two
// families overlap their fronts cross at a shallow angle and produce the
// lens-shaped interference this view exists for. Drift gets crossings too, but
// from a single origin sliding between hits; here the origins are fixed and
// far apart, so the crossings are wide and symmetric rather than incidental.
//
// Which node fires is hashed from the ring's birth time, for the same reason
// Drift derives its path from birth: uRipples carries only (birthTime,
// birthLevel), so a ring's origin has to be recoverable from its birth alone
// or it will move underneath itself as it ages. Hashing the birth also beats
// the obvious alternative of using the loop index — uRipples is a ring buffer
// whose cursor advances one slot per spawn (ripples.ts), so indexing by slot
// would walk the nodes in strict rotation and a steady beat would draw a
// tidy carousel instead of anything colliding.
//
// White and hard-edged like the rest of the layer; colour is an RGB filter on
// the finished layer (see geo-colour.ts).

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uLevel;
uniform float uLow;
uniform float uBreak;
uniform vec4 uSeed;

// Must match MAX_RIPPLES in ripples.ts — GLSL can't import a JS constant, and
// a mismatch here means scene.ts uploads an array of the wrong length.
//
// Twenty-four since docs/todo.md entry 57: eight audio slots as before,
// plus sixteen reserved for touch, up from four — see ripples.ts.
const int MAX_RIPPLES = 24;
const int AUDIO_RIPPLES = 8;
uniform vec4 uRipples[MAX_RIPPLES];

const float TAU = 6.28318530718;

const float LIFESPAN = 3.2;
const float FADE_FROM = 0.6;

// Circles' proportions, unchanged — the variation is in the emitter alone.
const float OUTER_STROKE = 0.22; // of radius
const float INNER_STROKE = 0.09; // of the outer radius
const float INNER_RADIUS = 0.70; // of radius

// Radius of the arrangement, in units of half the *short* screen dimension.
// 0.30 puts the nodes about three fifths of the way to the side edges on a
// phone held upright: far enough apart that two families meet somewhere in the
// middle of the frame rather than immediately, close enough that a node's own
// rings still fill the frame before they die.
const float NODE_RADIUS = 0.30;

// Cheap scalar hash. It only has to decorrelate two birth times, and the
// spawn cooldown in ripples.ts guarantees they differ by at least 0.28 s,
// which is some 35 radians into the sine — plenty.
float hash(float x) {
  return fract(sin(x * 127.1) * 43758.5453123);
}

float ring(float dist, float radius, float halfWidth, float px) {
  float d = abs(dist - radius) - halfWidth;
  return 1.0 - smoothstep(0.0, px * 1.5, d);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float px = 1.0 / min(uResolution.x, uResolution.y);
  vec2 halfExtent = 0.5 * uResolution / min(uResolution.x, uResolution.y);
  float maxRadius = max(halfExtent.x, halfExtent.y);

  // Node count and the arrangement's rotation are both seed choices, so a
  // re-roll restructures the interference rather than just re-timing it. Three
  // is the fewest that still reads as an arrangement rather than as two points
  // and an axis. The ceiling is set by the buffer, not by the geometry: only
  // eight rings can be alive at once, so past seven nodes a run of hits mostly
  // lights each node once and nothing meets a neighbour's front.
  float nodes = 3.0 + floor(uSeed.x * 5.0);
  float sector = TAU / nodes;
  float phase = uSeed.z * TAU;

  float ink = 0.0;

  for (int i = 0; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float birthLevel = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0 || age > LIFESPAN) continue;

    // docs/todo.md entry 33: a touch ring fires the nearest of the fixed
    // nodes rather than an arbitrary hashed one — the finger is an
    // *influence* on which origin fires, not a new origin of its own, since
    // this view's identity is its ring of fixed nodes. Closed-form nearest
    // rather than a small loop over each node: the node spacing is exactly
    // `sector`, so rounding the touch's own angle to the nearest multiple of
    // it is the same answer a loop would find.
    float which = i < AUDIO_RIPPLES
      ? floor(hash(birth) * nodes)
      : mod(floor((atan(uRipples[i].w, uRipples[i].z) - phase) / sector + 0.5), nodes);
    float a = phase + which * sector;
    vec2 origin = NODE_RADIUS * vec2(cos(a), sin(a));
    float dist = length(uv - origin);

    float percent = age / LIFESPAN;
    float radius = maxRadius * percent;

    float opacity = percent > FADE_FROM ? 1.0 - (percent - FADE_FROM) / (1.0 - FADE_FROM) : 1.0;
    opacity *= 0.35 + 0.65 * birthLevel;

    float scale = 0.8 + 0.4 * birthLevel;
    float outerHalf = max(radius * OUTER_STROKE * 0.5 * scale, px * 0.5);
    float innerHalf = max(radius * INNER_STROKE * 0.5 * scale, px * 0.5);

    ink += (ring(dist, radius, outerHalf, px) + ring(dist, radius * INNER_RADIUS, innerHalf, px)) *
      opacity;
  }

  // The nodes themselves, so the arrangement is legible between hits and a
  // ring visibly comes *from* somewhere. Drawn with an angular fold rather
  // than a loop over the nodes, for the reason Shards folds its symmetry: a
  // loop would be up to seven more length() calls per pixel on a phone GPU for
  // something one modulo answers exactly.
  float r = length(uv);
  float folded = mod(atan(uv.y, uv.x) - phase + sector * 0.5, sector) - sector * 0.5;
  // Law of cosines: distance from this pixel to the nearest node. The max()
  // is not decoration — rounding can push the bracket a hair below zero on the
  // node itself, and sqrt of a negative is a NaN that survives every clamp
  // downstream and paints the pixel white.
  float dNode = sqrt(max(r * r + NODE_RADIUS * NODE_RADIUS - 2.0 * r * NODE_RADIUS * cos(folded), 0.0));
  float nodeR = 0.010 + 0.040 * uLow;
  ink += ring(dNode, nodeR, px * 0.9, px) * (0.22 + 0.55 * uLow);

  // A break thins the ink rather than draining colour — there is none here.
  ink *= 1.0 - uBreak * 0.55;

  gl_FragColor = vec4(vec3(clamp(ink, 0.0, 1.0)), 1.0);
}
