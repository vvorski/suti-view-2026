// "Fringe" — an atmospheric-layer programme.
//
// Two coherent sources, and the interference between them. Where the path
// difference to a pixel is a whole number of wavelengths the waves add and
// the pixel is bright; where it is a half-integer they cancel and it is dark.
// The dark curves are hyperbolae with the sources as foci, and they sweep
// bodily across the frame when a source moves — a very particular motion that
// no amount of noise reproduces.
//
// Organised around *superposition*. That is the point of it here: Field is
// noise, Lattice is symmetry, Spectrogram is a diagram, Aurora is a place,
// Caustics is focused light. This one is the only view whose whole structure
// comes from two numbers being added together.
//
// The wavelength is the interesting control. Long waves give a handful of
// broad lobes that feel like a slow tide; short waves give dense fringes that
// shimmer. uTilt drives it, so bass-heavy music opens the pattern out and
// treble closes it in.
//
// Aliasing is the real constraint here and it sets the ceiling on everything.
// A fringe pattern is a sinusoid in screen space, so once its period falls
// below about two pixels it aliases into moire garbage — and on a phone at
// devicePixelRatio 3 that happens sooner than it looks like it should. K_MAX
// exists for that reason and is not a taste value; raising it produces
// crawling interference with the pixel grid, which is exactly the artefact
// the pattern is otherwise made of, so it hides in plain sight.

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
uniform vec4 uSeed;

uniform sampler2D uSpectrum;

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

/** Spatial frequency ceiling, in radians per unit of the aspect-corrected
 *  frame. At the frame's short dimension this is roughly 60 fringe pairs
 *  across, which on a 1080-pixel-tall phone is ~9 pixels per fringe — enough
 *  margin that the pattern still resolves at devicePixelRatio 3 rather than
 *  beating against the grid. Raise it and the aliasing does not look like a
 *  bug, it looks like more fringes, which is why it is written down. */
const float K_MAX = 190.0;
const float K_MIN = 26.0;

void main() {
  vec2 p = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  // Centred and aspect-corrected: the sources must sit in a square space or
  // the hyperbolae come out sheared, which reads as a bug rather than a
  // viewpoint.
  vec2 uv = vec2((p.x - 0.5) * aspect, p.y - 0.5);

  // The two sources orbit slowly in opposite directions. Their separation is
  // what sets how many lobes cross the frame, and it breathes with the low
  // end so a bass note visibly opens the pattern.
  float t = uFlow * 0.09 + uSeed.x * 6.28;
  float sep = 0.20 + 0.11 * uLow + 0.05 * sin(uFlow * 0.13);
  vec2 s1 = vec2(cos(t), sin(t * 0.83)) * sep;
  vec2 s2 = -vec2(cos(t * 0.91 + 1.7), sin(t)) * sep;

  float r1 = length(uv - s1);
  float r2 = length(uv - s2);

  // Wavelength from tilt. Clamped hard — see K_MAX.
  float k = clamp(mix(K_MIN, K_MAX, uTilt), K_MIN, K_MAX);

  // The interference itself: the *path difference* only.
  //
  // The obvious thing to write is cos(r1*k) + cos(r2*k), and it is wrong for
  // this. That sum factors as 2*cos((a+b)/2)*cos((a-b)/2): the second term is
  // the path difference and gives the hyperbolae, the first is a concentric
  // carrier centred between the sources. Rendering the product draws both, and
  // what you get is a lattice of dots — the carrier chopping the fringes into
  // beads. It looks like a moire artefact, which is how it survived the first
  // pass: an interference pattern is exactly where a real aliasing bug would
  // hide. Keeping only (r1 - r2) leaves the fringes themselves.
  //
  // Phase advances on uFlow, so the bands sweep across the frame as the
  // sources move and stand still in silence.
  float phase = uFlow * 1.9;
  float path = (r1 - r2) * k - phase;

  // 0.5 + 0.5*cos is the physical fringe: bright where the waves arrive in
  // step, dark on the nodal hyperbolae where they cancel. Deliberately not
  // cos² — that is bright at both extremes and so draws twice the bands at
  // half the spacing, which halves the effective fringe period and walks
  // straight back into the aliasing K_MAX exists to avoid.
  float intensity = 0.5 + 0.5 * cos(path);

  // A third source, weaker, interfering with the first. Same difference-only
  // treatment for the same reason. It breaks the perfect two-source symmetry,
  // without which the pattern reads as a textbook figure rather than as
  // something alive.
  vec2 s3 = vec2(sin(t * 1.31), cos(t * 0.67)) * (sep * 1.9);
  float r3 = length(uv - s3);
  intensity += 0.30 * uHigh * (0.5 + 0.5 * cos((r1 - r3) * k * 0.7 - phase * 1.3));

  // Falloff from the sources, so the frame has a subject rather than filling
  // edge to edge at even brightness. 1/r would be the physical amplitude
  // falloff for a line source and is far too aggressive at this scale — the
  // corners went black — so this is a gentle exponential instead.
  float reach = exp(-min(r1, r2) * 1.15);
  intensity *= 0.28 + 0.85 * reach;

  // A transient sharpens the fringes momentarily: the contrast lifts rather
  // than the brightness, so a hit reads as the pattern snapping into focus.
  float sharpen = 1.0 + 1.6 * uTransient;
  intensity = clamp(intensity, 0.0, 1.0);
  intensity = pow(intensity, 1.0 / sharpen);

  // Colour: the fringes shift hue along their order, the way thin-film
  // interference does — the nearest thing to a physical justification for
  // putting a rainbow on this, and it keeps the two sources visually distinct
  // from their overlap region.
  float order = fract((r1 - r2) * k * 0.02 + uSeed.y);
  float hue = fract(uSeed.z + order * 0.18 + uTilt * 0.12 + uNovelty * 0.2);
  vec3 col = hsv2rgb(vec3(hue, 0.55 - 0.25 * intensity, 1.0)) * intensity;

  // The sources themselves, as small soft cores. Without these the pattern
  // has no visible cause and the lobes look arbitrary.
  col += vec3(0.9, 0.95, 1.0) * exp(-r1 * 26.0) * (0.35 + 0.9 * uLevel);
  col += vec3(0.9, 0.95, 1.0) * exp(-r2 * 26.0) * (0.35 + 0.9 * uLevel);

  col *= 0.45 + 0.85 * uLevel + 0.35 * uSurge;

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * 0.7, uBreak * 0.8);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
