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

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uLevel;
uniform float uLow;
uniform float uMid;
uniform float uTilt;
uniform float uBreak;
uniform vec4 uSeed;

// Must match MAX_RIPPLES in ripples.ts.
const int MAX_RIPPLES = 8;
uniform vec2 uRipples[MAX_RIPPLES];

const float LIFESPAN = 2.9;
const float FADE_FROM = 0.5;

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

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

  // Chebyshev distance in cells — this is what makes the fronts square.
  float ring = max(abs(cell.x), abs(cell.y));
  float maxRing = 0.5 * length(uResolution) / min(uResolution.x, uResolution.y) / cellSize;

  float rand = hash(cell);

  vec3 col = vec3(0.0);
  float lit = 0.0;
  float hue = fract(uSeed.x + uTilt * 0.3);

  for (int i = 0; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float birthLevel = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0 || age > LIFESPAN) continue;

    float percent = age / LIFESPAN;
    float eased = 1.0 - (1.0 - percent) * (1.0 - percent);
    float front = maxRing * eased;

    // A cell lights when the front reaches it and decays after — the front
    // has thickness so it reads as a band of cells, not a one-cell line.
    float thickness = 1.4 + 2.2 * birthLevel;
    float d = abs(ring - front);
    if (d > thickness) continue;

    float intensity = 1.0 - d / thickness;
    // Stagger cells within the band so the front has texture rather than
    // switching on as one solid square.
    intensity *= 0.45 + 0.55 * rand;

    float opacity = percent > FADE_FROM
      ? 1.0 - (percent - FADE_FROM) / (1.0 - FADE_FROM)
      : 1.0;
    opacity *= 0.35 + 0.65 * birthLevel;

    float amount = intensity * opacity;
    lit += amount;
    col += hsv2rgb(vec3(fract(hue + float(i) * 0.075 + rand * 0.06), 0.62, 1.0)) * amount;
  }

  // Inset each cell slightly so the grid reads as separate tiles with dark
  // mortar between them, rather than a continuous field that happens to be
  // quantised.
  float inset = max(abs(within.x), abs(within.y));
  col *= 1.0 - smoothstep(0.72, 0.96, inset);

  // A faint standing grid, breathing with the mids, so the structure is
  // visible between hits instead of the screen going entirely black.
  float rule = smoothstep(0.90, 0.99, inset);
  col += vec3(0.16, 0.19, 0.32) * rule * (0.05 + uMid * 0.22);

  // Bass swells the whole field slightly from the centre outward.
  col += vec3(0.20, 0.17, 0.34) * uLow * exp(-length(uv) * 2.6) * 0.35;

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * 0.7, uBreak * 0.8);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
