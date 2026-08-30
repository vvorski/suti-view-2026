// "Grid" — a geometric-layer programme.
//
// The third answer to "what does a hit look like". Circles gives it a ring,
// Shards give it a direction; this quantises it. Space is divided into cells
// and a hit travels outward as a square wavefront, lighting whole cells at a
// time. Nothing moves continuously — a cell is either lit or it isn't — which
// makes it the most legible of the three when there is a lot going on, and
// the most obviously synthetic.
//
// The square front comes from measuring distance with a Chebyshev metric
// (max of the axes) instead of Euclidean length. Same wavefront logic as
// Circles, different idea of what "how far" means; swapping the metric for
// abs(x)+abs(y) would give diamonds instead, which read as softer and lost
// the argument.
//
// Reads uRipples (see ripples.ts), so every front is a real transient.
//
// Like the rest of this layer it draws hard-edged white only; colour is an RGB
// filter applied to the finished layer (see geo-colour.ts).

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uLevel;
uniform float uLow;
uniform float uMid;
uniform float uBreak;
uniform vec4 uSeed;

// Must match MAX_RIPPLES in ripples.ts.
//
// Twenty-four since docs/todo.md entry 57: eight audio slots as before,
// plus sixteen reserved for touch, up from four — see ripples.ts.
const int MAX_RIPPLES = 24;
const int AUDIO_RIPPLES = 8;
uniform vec4 uRipples[MAX_RIPPLES];

const float LIFESPAN = 2.2;
const float FADE_FROM = 0.5;

// Cheap per-cell hash. Only needs to look unrelated between neighbours, not
// to be statistically sound.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

  // Cell size is a seed choice: a coarse grid reads as blocks, a fine one as
  // pixels, and both are worth having.
  float cellSize = 0.055 + fract(uSeed.y * 3.1) * 0.075;
  vec2 cell = floor(uv / cellSize);
  vec2 cellCentre = (cell + 0.5) * cellSize;
  // Position within the cell, -1..1 on each axis, for the inset below.
  vec2 within = (uv - cellCentre) / (cellSize * 0.5);

  float maxRing = 0.5 * length(uResolution) / min(uResolution.x, uResolution.y) / cellSize;

  float rand = hash(cell);

  float ink = 0.0;

  for (int i = 0; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float birthLevel = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0 || age > LIFESPAN) continue;

    // docs/todo.md entry 33: the wavefront starts at the finger's cell.
    // Chebyshev distance in cells — this is what makes the fronts square —
    // now measured from each ring's own origin cell rather than a value
    // hoisted once for all twelve, since a touch ring's origin moves.
    vec2 originCell = i < AUDIO_RIPPLES ? vec2(0.0) : floor(uRipples[i].zw / cellSize);
    float ring = max(abs(cell.x - originCell.x), abs(cell.y - originCell.y));

    float percent = age / LIFESPAN;
    float eased = 1.0 - (1.0 - percent) * (1.0 - percent);
    float front = maxRing * eased;

    // A cell lights when the front reaches it and decays after — the front
    // has thickness so it reads as a band of cells, not a one-cell line.
    float thickness = 0.55 + 0.85 * birthLevel;
    float d = abs(ring - front);
    if (d > thickness) continue;

    // Squared falloff: a front should have a bright leading band and go dark
    // quickly behind it, or eight overlapping fronts leave every cell faintly
    // lit and the square rings stop being visible as rings at all.
    float intensity = 1.0 - d / thickness;
    intensity *= intensity;
    // Stagger cells within the band so the front has texture rather than
    // switching on as one solid square.
    intensity *= 0.40 + 0.60 * rand;

    float opacity = percent > FADE_FROM
      ? 1.0 - (percent - FADE_FROM) / (1.0 - FADE_FROM)
      : 1.0;
    opacity *= 0.35 + 0.65 * birthLevel;

    // max, not sum. Summing was the bug: with eight fronts alive at once every
    // cell reached full white and the whole screen filled in, which is exactly
    // what this view is supposed not to do. A cell is lit by whichever front
    // is brightest on it, so overlapping fronts cross without saturating.
    ink = max(ink, intensity * opacity);
  }

  // Inset each cell with a hard edge, so the grid reads as separate tiles with
  // dark mortar between them rather than a continuous field that happens to be
  // quantised. A step, not a gradient — this layer is drawn, not lit.
  float inset = max(abs(within.x), abs(within.y));
  ink *= 1.0 - step(0.80, inset);

  // A standing rule on the cell boundaries, breathing with the mids, so the
  // structure is visible between hits instead of the screen going black.
  ink += step(0.93, inset) * (0.05 + uMid * 0.22);

  // A break thins the ink rather than draining colour — there is none here.
  ink *= 1.0 - uBreak * 0.55;

  gl_FragColor = vec4(vec3(clamp(ink, 0.0, 1.0)), 1.0);
}
