// "Tide" — a geometric-layer programme, and the third variation on Circles.
//
// Circles, Drift and Chorus all put the emitter somewhere inside the frame, so
// a ring always opens outward from a visible point and the eye is drawn to the
// middle. This puts the emitter *on the frame's edge*, at a point picked per
// hit, so a ring is born off at the side and the only part of it that is ever
// on screen is the leading arc sweeping inward across everything. Nothing here
// has a centre; hits arrive from a direction.
//
// The origin is hashed from the ring's birth time, the same trick as the other
// two variations and for the same reason: uRipples carries only (birthTime,
// birthLevel) (see ripples.ts), so an origin has to be recoverable from birth
// alone, or a ring's centre slides while it is on screen.
//
// Two things had to change from Circles' ring, both because the travel is much
// longer here — an edge origin is nearly a frame away from the far corner,
// where a centred one is half a frame from anywhere:
//
//   The stroke stays proportional to the radius, as in the source, but the
//   constant is under a third of Circles'. Circles' 0.22 was tried here and
//   the arithmetic is what happens: a radius that reaches twice the
//   half-diagonal gives a band a third of the frame wide, and on screen that
//   is not rings at all — it is white slabs with black slivers between them.
//
//   The inner companion sits a fixed distance behind the outer ring rather
//   than at 0.70 of its radius. A proportional inner radius is right when the
//   ring is centred and the radius spans half a frame; here the same 0.70
//   leaves the companion half the frame's width behind by mid-life, and the
//   pair stops reading as a pair — it reads as two unrelated arcs.
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

// Longer than Circles' 3.2, because the arc has roughly twice as far to go:
// keeping Circles' lifespan would send the front across at twice Circles'
// speed, which is a wipe rather than a wave arriving. Not twice as long
// either — an arc that dawdles stops being an event.
const float LIFESPAN = 3.8;
const float FADE_FROM = 0.55;

const float OUTER_STROKE = 0.070; // of radius — see the header
const float INNER_GAP = 0.10; // fixed, in screen units: how far the companion trails
const float INNER_WIDTH = 0.40; // of the outer stroke

// How far inside the frame the standing edge rule sits.
const float SHORE_INSET = 0.022;

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

  // Far enough for any arc to have left the frame by the time it dies,
  // whichever edge it started from: the origin is at most one half-diagonal
  // from centre and the far corner is another, so twice that bounds it. Using
  // the exact per-ripple distance instead would make arcs from the long edges
  // travel at a different speed from arcs off the short ones, and a wave that
  // changes pace depending on where it came from looks like a bug.
  float travel = 2.0 * length(halfExtent) * uMoonReach;
  // docs/todo.md entry 96 — same abundance scaling as Circles.
  float lifespan = LIFESPAN * uMoonLife;
  // docs/todo.md entry 106 -- computed once for the same reason lifespan
  // above is: every opacity test below reads it. Waxing raises it (stays
  // full almost to the rim, then fades quickly); waning lowers it (fades
  // almost immediately, trailing off for most of the ring travel).
  float fadeFrom = FADE_FROM + uMoonBloom;

  float ink = 0.0;

  for (int i = 0; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float birthLevel = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0 || age > lifespan) continue;

    // A direction, then the point where that ray leaves the frame. Picking a
    // point on a *circle* instead is a line shorter and wrong on a phone: a
    // circle of the short half-dimension only touches the left and right
    // edges, so every origin near the vertical would be born a long way inside
    // the frame and the view would stop being an edge emitter for half its
    // hits.
    // docs/todo.md entry 33: a touch ring is born at the frame edge nearest
    // the finger, rather than at a hashed direction — point the same ray
    // toward the touch instead of a random angle, and the existing
    // ray-leaves-the-frame math below finds the nearest edge point for free.
    float a = i < AUDIO_RIPPLES
      ? (hash(birth) + uSeed.x) * TAU
      : atan(uRipples[i].w, uRipples[i].z);
    vec2 dir = vec2(cos(a), sin(a));
    vec2 hit = halfExtent / max(abs(dir), vec2(1e-3));
    // docs/todo.md entry 132 — the edge origin is unchanged (a ring still
    // arrives from the frame's own edge, which is where the water is), but
    // the distance is measured in the hanging centre's frame so the whole
    // travel reads as sweeping toward where the picture now sits.
    vec2 origin = dir * min(hit.x, hit.y) + uOrigin;

    float dist = length(uv - origin);

    float percent = age / lifespan;
    float radius = travel * percent;

    // docs/todo.md entry 79 — touch rings only (see Circles' own comment on
    // this same variation for the full reasoning): a deterministic per-slot
    // hash nudges radius (phase) and stroke width just enough that a drag's
    // trail of near-simultaneous rings reads as a sequence, while leaving
    // the audio ring's own appearance untouched.
    radius *= i < AUDIO_RIPPLES ? 1.0 : 0.98 + 0.04 * hash(float(i) + 31.0);
    float slotStroke = i < AUDIO_RIPPLES ? 1.0 : 0.88 + 0.24 * hash(float(i) + 11.0);

    float opacity = percent > fadeFrom ? 1.0 - (percent - fadeFrom) / (1.0 - fadeFrom) : 1.0;
    opacity *= 0.35 + 0.65 * birthLevel;

    float scale = (0.8 + 0.4 * birthLevel) * slotStroke;
    float outerHalf = max(radius * OUTER_STROKE * 0.5 * scale, px * 0.5);
    float innerHalf = max(outerHalf * INNER_WIDTH, px * 0.5);

    float outer = ring(dist, radius, outerHalf, px);
    float inner = ring(dist, max(radius - INNER_GAP, 0.0), innerHalf, px);

    ink = 1.0 - (1.0 - ink) * (1.0 - (outer + inner) * opacity);
  }

  // The shoreline: a hard rule just inside the frame, which is the locus every
  // arc is born on. It is doing the job Circles' centre circle does — keeping
  // the frame from going black between hits — but it also says where the next
  // hit can come from, which is the only cue this view has that its origins
  // are anywhere in particular.
  float dEdge = min(halfExtent.x - abs(uv.x), halfExtent.y - abs(uv.y));
  ink += ring(dEdge, SHORE_INSET, px, px) * (0.10 + 0.45 * uLevel);

  // A break thins the ink rather than draining colour — there is none here.
  ink *= 1.0 - uBreak * 0.55;

  gl_FragColor = vec4(vec3(clamp(ink, 0.0, 1.0)), 1.0);
}
