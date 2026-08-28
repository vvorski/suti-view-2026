// "Aurora" — an atmospheric-layer programme.
//
// The only view here with a horizon. Field, Lattice and Spectrogram are all
// radial, organised around a centre point; this is organised around a
// direction — curtains hanging from the top of the frame, rippling sideways,
// brightest where the spectrum is loud at that horizontal position. On a
// phone held upright that is a much better fit for the shape of the screen
// than anything centred, and it is the one programme that looks like a place
// rather than a diagram.
//
// Frequency maps to horizontal position, so the curtains genuinely follow the
// music left-to-right rather than pulsing as one mass. Vertical drift is on
// uFlow, not uTime, so the whole thing slows to a crawl in silence and
// resumes when the room does — the swell-and-decay behaviour the whole
// project is organised around.

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
uniform vec4 uSeed;

uniform sampler2D uSpectrum;

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y);
}

// Three octaves is enough for a curtain edge — more just costs fill rate on a
// phone without changing the silhouette.
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  // Screen-space, 0..1, with y measured from the top so the curtains hang.
  vec2 p = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float x = p.x;
  float y = 1.0 - p.y;

  // Which slice of the spectrum this column answers to. The seed shifts and
  // can mirror the mapping, so a re-roll changes which way the music reads.
  float mirror = uSeed.w > 0.5 ? 1.0 - x : x;
  float band = fract(mirror * 0.85 + uSeed.z * 0.4);
  float energy = texture2D(uSpectrum, vec2(band, 0.5)).r;
  // Neighbouring slices, blended in, so a loud narrow band lifts a curtain
  // rather than a single hard column of pixels.
  energy = mix(energy, texture2D(uSpectrum, vec2(fract(band + 0.04), 0.5)).r, 0.35);
  energy = mix(energy, texture2D(uSpectrum, vec2(fract(band - 0.04), 0.5)).r, 0.25);

  vec3 col = vec3(0.0);

  // Three curtains at different depths. Nearer ones move faster and are
  // brighter, which is the whole of the parallax.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float depth = 0.45 + fi * 0.30;

    // Horizontal wander. uFlow rather than uTime: still air in a silent room.
    float wobble = fbm(vec2(x * (2.2 + fi * 1.1) * aspect, uFlow * (0.10 + fi * 0.04) + fi * 7.3));

    // Where this curtain's lower edge hangs to. Loud bands hang lower.
    float reach = 0.30 + 0.42 * energy + 0.16 * wobble + 0.10 * uSurge;
    reach *= 0.85 + 0.30 * depth;

    // Vertical profile: a band, not a slab. Real aurora are brightest near
    // their lower edge and thin out toward where they hang from, and stacking
    // three slabs that all sit at full brightness along the top edge just
    // saturates to white there — which is what the first pass did.
    float body = smoothstep(0.0, reach * 0.45, y) * (1.0 - smoothstep(reach * 0.55, reach, y));
    // Filaments running down the curtain, which is what stops it reading as a
    // flat gradient.
    float strands = fbm(vec2(x * (26.0 + fi * 14.0) * aspect, y * 3.0 - uFlow * (0.22 + fi * 0.08)));
    body *= 0.55 + 0.75 * strands;

    // A brighter lip along the bottom edge, as real aurora have. Squared by
    // multiplication, not pow(): pow() with a negative base is undefined in
    // GLSL, and this base goes negative above the lip. It returned NaN on the
    // first pass and took the whole curtain to black.
    float lipD = (y - reach * 0.82) / 0.055;
    float lip = exp(-lipD * lipD);
    body += lip * 0.5 * energy;

    float hue = fract(uSeed.x + fi * 0.11 + uTilt * 0.20 + energy * 0.12);
    col += hsv2rgb(vec3(hue, 0.62 - 0.12 * energy, 1.0)) * body * (0.30 + 0.26 * energy) / depth;
  }

  // A faint glow where the curtains hang from, so they look attached to
  // something rather than floating. Kept well under the curtains' own
  // brightness — it is a hint of a source, not a light of its own.
  col += vec3(0.13, 0.16, 0.30) * exp(-y * 14.0) * (0.10 + uLow * 0.28);

  // Sparse stars in the dark half, brightening with the highs. Cheap: one
  // hash per pixel, thresholded hard.
  float star = hash(floor(gl_FragCoord.xy * 0.6));
  col += vec3(0.75, 0.80, 1.0) * step(0.9985, star) * (0.35 + uHigh * 0.9) * smoothstep(0.25, 0.75, y);

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * 0.7, uBreak * 0.8);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
