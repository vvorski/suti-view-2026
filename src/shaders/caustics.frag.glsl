// "Caustics" — an atmospheric-layer programme.
//
// Light through moving water: a bright web that wanders, pools where the
// surface happens to focus it, and thins where it spreads. Organised around
// *focusing*, which nothing else here is — Field is cloud, Lattice is
// symmetry, Spectrogram is a diagram and Aurora is a horizon. This one is a
// surface being lit from behind.
//
// What it is not: a real caustic. That means tracing rays through a refracting
// surface and measuring how much a beam's cross-section compresses — the
// Jacobian determinant of the refraction map — which needs several height
// samples per pixel plus their derivatives. The honest cheap stand-in is a
// ridged noise field: fold |h| about its midline so the zero crossings become
// thin bright lines, then sharpen. The maths is unrelated; the eye reads both
// as "light concentrated along curves that move", which is the whole job.
//
// Motion is on uFlow, not uTime, so still air means still water — the same
// swell-and-decay discipline the rest of the project follows.

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
uniform float uRoughness;
uniform vec4 uSeed;

uniform sampler2D uSpectrum;

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

// Four octaves. Three leaves the filaments too smooth to read as water and
// five costs fill rate for detail that vanishes under the sharpening below.
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.07;
    a *= 0.5;
  }
  return v;
}

/** One sheet of caustic web.
 *
 *  `scale` sets the mesh size and `phase` decorrelates the sheets so two of
 *  them never wander in step. The fold is |h*2-1| about the midline, which
 *  turns the noise field's zero set into ridges; squaring twice (rather than
 *  pow(x, 4.0), which is undefined for a negative base in GLSL and returned
 *  NaN the first time this was written with a signed argument) thins them to
 *  filaments and steepens the falloff so the dark between them stays dark.
 */
float sheet(vec2 p, float scale, float phase, float drift) {
  // Domain warp first: straight ridged noise gives an even mesh that reads as
  // fabric, not water. Displacing the lookup by another noise field is what
  // makes the cells stretch and crowd the way a real surface does.
  vec2 warp = vec2(
    fbm(p * scale * 0.5 + vec2(phase, uFlow * drift)),
    fbm(p * scale * 0.5 + vec2(phase + 4.7, uFlow * drift * 0.8 + 2.1)));
  vec2 q = p * scale + (warp - 0.5) * (1.7 + 1.1 * uLow);

  float h = fbm(q + vec2(0.0, uFlow * drift * 0.6));
  float ridge = 1.0 - abs(h * 2.0 - 1.0);
  ridge = ridge * ridge;
  ridge = ridge * ridge;
  return ridge;
}

void main() {
  vec2 p = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  // Corrected for aspect so the mesh is not stretched into ovals in portrait,
  // which is the orientation this is actually used in.
  vec2 uv = vec2(p.x * aspect, p.y);

  // Treble tightens the mesh, bass opens it out. uTilt is already slow and
  // smoothed, so this is a drift in character over a phrase rather than a
  // per-beat twitch.
  float scale = mix(3.4, 7.2, uTilt) * (0.85 + 0.30 * uRoughness);

  // Three sheets at different depths. Combined with max() rather than a sum:
  // summing three ridged fields that each peak at 1.0 saturates every
  // crossing to white and the web loses its structure — the same mistake
  // Grid made and had to be corrected for.
  float web = sheet(uv, scale, uSeed.x * 10.0, 0.16);
  web = max(web, sheet(uv, scale * 1.63, uSeed.y * 10.0 + 3.3, 0.11) * 0.78);
  web = max(web, sheet(uv, scale * 2.51, uSeed.z * 10.0 + 7.9, 0.07) * 0.55);

  // A transient brightens the whole surface briefly, as though the light
  // behind it flared. Added before the tint so it colours like the web does.
  web *= 0.55 + 0.85 * uLevel + 0.6 * uTransient;

  // Depth: the water is darker toward the bottom of the frame, so the sheet
  // reads as receding rather than as a flat plane of noise. Cheap, and it is
  // most of why this looks like a place.
  float depth = mix(1.0, 0.42, smoothstep(0.0, 1.0, p.y));

  // Colour. Deep teal ground, with the web itself much paler than the water
  // it sits in — light in water takes the water's colour only weakly, and
  // tinting the filaments fully to teal made them read as glowing algae.
  vec3 deep = vec3(0.016, 0.055, 0.085) * (0.6 + 0.9 * uLow);
  vec3 lit = mix(vec3(0.35, 0.85, 0.95), vec3(0.92, 0.98, 1.0), clamp(web, 0.0, 1.0));

  vec3 col = deep * depth + lit * web * depth * (0.55 + 0.5 * uMid);

  // Shafts: the light source itself, glimpsed as broad soft columns above the
  // web. Held well under the filaments' brightness — they are the subject.
  float shaft = fbm(vec2(uv.x * 2.1 + uSeed.w * 6.0, uFlow * 0.05));
  col += vec3(0.10, 0.20, 0.26) * shaft * (1.0 - p.y) * (0.25 + 0.75 * uHigh);

  // Re-entry after a silence lifts the whole surface briefly.
  col *= 1.0 + 0.5 * uSurge;

  // House convention: a break desaturates rather than dims, so a drop reads
  // as the colour draining instead of the picture failing.
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * 0.7, uBreak * 0.8);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
