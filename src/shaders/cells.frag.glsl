// "Cells" — an atmospheric-layer programme.
//
// Space broken into discrete cells, each one lit by its own slice of the
// spectrum. Every other view here is a continuous field: Field is cloud,
// Caustics is a surface, Fringe is a wave, Aurora is a curtain, and even
// Spectrogram's polar diagram varies smoothly. This one is the only
// atmospheric view where the frame is *divided* — a pixel belongs to exactly
// one cell, and that cell has a single brightness.
//
// That matters musically as well as visually. A continuous field can only
// show the spectrum as a gradient; discrete cells show it as a chord. Ten
// cells lit at ten different levels reads as ten separate things happening,
// which is what a spectrum actually is and what none of the smooth views can
// say.
//
// Worley/Voronoi over a jittered grid: for each pixel, find the nearest
// feature point among the 3x3 neighbouring grid squares. Nine hashes and nine
// distances per pixel, which is the honest cost here — it is the most
// expensive view in the set, and the 3x3 neighbourhood is the reason it is
// only that. A 5x5 search would let the jitter go past one cell width without
// artefacts; at 3x3 the jitter has to stay under 0.5 or the true nearest
// point can fall outside the searched squares and cells develop straight
// seams along the grid lines. JITTER is therefore not a look control.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uFlow;
uniform float uLevel;
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uTilt;
uniform float uBreak;
uniform float uSurge;
uniform float uTransient;
uniform float uNovelty;
uniform float uRoughness;
uniform vec4 uSeed;

uniform sampler2D uSpectrum;

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(419.2, 371.9))) * 43758.5453);
}

/** How far a feature point may wander from its grid square's centre. Must
 *  stay below 0.5 for a 3x3 search to be correct — see the header. */
const float JITTER = 0.45;

void main() {
  vec2 p = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 uv = vec2(p.x * aspect, p.y);

  // Cell count. Bass-heavy music gives fewer, larger cells; treble breaks the
  // frame into more of them. Kept modest at the top end: past about 14 the
  // cells are small enough that the per-cell brightness reads as noise rather
  // than as a chord, which loses the entire point of the view.
  float density = mix(4.5, 13.0, uTilt) * (0.9 + 0.25 * uRoughness);
  vec2 g = uv * density;
  vec2 gi = floor(g);
  vec2 gf = fract(g);

  // f1 is the nearest feature point, f2 the second nearest. f2 - f1 is the
  // standard cheap edge measure: it goes to zero exactly on the boundary
  // between two cells, and is large in their interiors. Tracking f2 is why
  // the edges can be drawn at all without a second pass.
  float f1 = 8.0;
  float f2 = 8.0;
  vec2 nearestCell = vec2(0.0);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = gi + vec2(float(x), float(y));
      vec2 jitter = hash2(cell + uSeed.xy * 17.0);
      // Each cell drifts on its own phase, so the tessellation breathes
      // instead of sitting still. On uFlow: silence freezes the mosaic.
      vec2 point = vec2(float(x), float(y)) + 0.5
        + (jitter - 0.5) * 2.0 * JITTER
        + 0.14 * vec2(
            sin(uFlow * 0.23 + jitter.x * 6.28),
            cos(uFlow * 0.19 + jitter.y * 6.28));
      float d = length(point - gf);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        nearestCell = cell;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }

  // Which slice of the spectrum this cell answers to. A hash of the cell
  // index rather than its position, so neighbouring cells get unrelated
  // bands and the frame reads as a chord rather than as a gradient with
  // seams drawn on it.
  float band = hash1(nearestCell + uSeed.zw * 31.0);
  float energy = texture2D(uSpectrum, vec2(band, 0.5)).r;

  // Cells respond at their own pace. Without this every cell lights and
  // fades in lockstep and the whole mosaic flashes as one object, which is
  // precisely the "one continuous field" reading this view exists to avoid.
  float lag = 0.55 + 0.45 * hash1(nearestCell + 5.1);
  float lit = energy * lag;

  // Interior fill, brightest at the cell's centre and falling off toward its
  // edges, so a cell reads as a rounded tile rather than a flat polygon.
  float body = smoothstep(0.0, 0.55, f2 - f1);

  // The edge itself: a thin bright line where f2 - f1 approaches zero. This
  // is the structure of the view and is kept visible even in a cell with no
  // energy, so the tessellation persists through silence.
  float edge = 1.0 - smoothstep(0.0, 0.055, f2 - f1);

  float hue = fract(uSeed.x + band * 0.35 + uNovelty * 0.25 + lit * 0.1);
  vec3 fill = hsv2rgb(vec3(hue, 0.68 - 0.3 * lit, 1.0));

  vec3 col = fill * body * lit * (0.85 + 1.5 * uLevel);
  // A transient flares the edges rather than the fills — the mosaic snaps
  // into outline on a hit and settles back, which reads as the structure
  // being struck rather than merely lit.
  col += vec3(0.72, 0.80, 0.95) * edge * (0.10 + 0.30 * uMid + 0.85 * uTransient);

  // The ground under an unlit cell. Not black: a mosaic whose dark cells
  // vanish entirely stops being a mosaic and becomes scattered blobs.
  col += vec3(0.020, 0.026, 0.044) * body;

  col *= 1.0 + 0.45 * uSurge;

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * 0.7, uBreak * 0.8);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
