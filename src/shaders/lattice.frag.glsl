// "Lattice" — a visionary-art visualiser, after Alex Grey.
//
// Grey's Universal Mind Lattice (1981) came out of an experience he described
// as every being and thing in the universe appearing as a toroidal fountain and
// drain of self-illuminating energy: a cellular node, or jewel, in a network
// linking omnidirectionally without end. That description is unusually literal
// about its geometry, and it is what this shader implements rather than any
// attempt to copy the paintings.
//
// Four properties do the work:
//
//   Endlessness      log-polar space repeats, so shells of lattice recede
//                    toward the centre forever. Nothing terminates.
//   Radial symmetry  a kaleidoscopic fold gives the mandala structure and the
//                    single central focus his compositions are built around.
//   Self-illumination  everything is additive. No surfaces, no shading, no
//                    lighting model — only emission, which is why the palette
//                    can be this saturated without turning to mud.
//   The network      glowing nodes on a grid, joined by filaments. The node is
//                    the jewel; the filament is the link.
//
// The fountain-and-drain is the audio's job: energy enters at the rim and
// travels inward as the history shells advance, so what you are looking at down
// the tunnel is literally the last eight seconds of sound.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uFlow;
uniform float uLevel;
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uTransient;
uniform float uTilt;
uniform float uBreak;
uniform float uSurge;
uniform float uNovelty;
uniform float uRoughness;
uniform sampler2D uSpectrum;
uniform sampler2D uHistory;
uniform float uHistoryHead;

const float PI = 3.14159265;
const float TAU = 6.28318531;

/** Rotational symmetry order. Six reads as sacred geometry without looking like a snowflake. */
const float SYMMETRY = 6.0;
/** Lattice shells per unit of log-radius. Higher is a denser, deeper tunnel. */
const float DEPTH = 2.4;
/** Nodes across one symmetry sector. */
const float ACROSS = 4.0;

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

// Colour is chosen in hue space, not by blending RGB.
//
// The first version mixed a cool and a warm colour together to set the palette,
// which is the classic way to ruin exactly this style: mixing complementaries
// in RGB passes through grey, and the whole screen came out a muddy brown. In
// this idiom complementaries are *assigned* to opposing elements — the node
// against the filament — and never blended into one another. Rotating a hue and
// keeping saturation pinned high guarantees the colours stay electric no matter
// where the audio pushes them.
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

  // A break collapses the tunnel inward; the surge on re-entry blows it open.
  uv *= 1.0 + uBreak * 0.35 - uSurge * 0.28;

  float radius = max(length(uv), 1e-4);
  float angle = atan(uv.y, uv.x);

  // --- kaleidoscopic fold ---------------------------------------------------
  // Mirror within each sector rather than merely repeating: mirroring produces
  // the bilateral symmetry inside each petal that makes the figure read as
  // ornament instead of as a rotated tile.
  float sector = TAU / SYMMETRY;
  float folded = abs(mod(angle + sector * 0.5, sector) - sector * 0.5);

  // --- log-polar depth ------------------------------------------------------
  // log(radius) turns "scale" into "distance", so a fixed step is a constant
  // zoom factor and the lattice can repeat forever without ever landing on a
  // boundary. Drift moves the whole structure inward: the drain.
  float depth = log(radius) * DEPTH - uFlow * 0.30;
  float shell = floor(depth);
  float withinShell = fract(depth);

  // --- history down the tunnel ---------------------------------------------
  // Each shell is a moment. The rim is now, the centre is ~8 seconds ago, so
  // the tunnel is a literal recording — a beat becomes a ring travelling
  // inward, and a section of the track becomes a visibly different stretch of
  // the depth.
  float age = clamp(-(depth - 1.5) / 9.0, 0.0, 1.0);
  float freqAxis = fract(folded / sector);
  float past = texture2D(uHistory, vec2(uHistoryHead - age, freqAxis)).r;

  // --- the lattice ----------------------------------------------------------
  // Grid coordinates: angle across, depth into the screen. Offsetting alternate
  // shells by half a cell gives a hexagonal packing rather than a square one —
  // the difference between a net and a chain-link fence.
  float across = folded / sector * ACROSS;
  float rowOffset = mod(shell, 2.0) * 0.5;
  vec2 cellId = vec2(across + rowOffset, depth);
  vec2 cell = fract(cellId) - 0.5;

  // Nodes: the jewels. Size breathes with the bass, so the whole network
  // inhales on a kick.
  float nodeR = length(cell) * (2.6 - 0.7 * uLow - 0.5 * past);
  float node = exp(-nodeR * nodeR * 7.0);

  // Filaments: the links. Distance to the nearer grid axis, kept thin — the
  // fine line work is most of why this style reads as drawn rather than
  // rendered.
  vec2 toLine = abs(cell);
  float filament = exp(-min(toLine.x, toLine.y) * (26.0 - 9.0 * uLevel));

  // Radiating rays from the centre — the "godhead" halo. Sharpened by the
  // treble, so cymbals and air make the figure bristle.
  float rays = pow(abs(cos(folded * SYMMETRY * 3.0)), 12.0 - 7.0 * uHigh);

  // --- pulses ---------------------------------------------------------------
  // A transient launches a ring travelling inward along the depth axis, so a
  // hit is something you watch move rather than a flash.
  float pulse = exp(-abs(withinShell - fract(uFlow * 0.9)) * 9.0) * uTransient;

  // --- accumulate light -----------------------------------------------------
  // Everything is emissive and added. That is the single most important choice
  // here: self-illumination is the whole visual premise, and any shading model
  // at all would flatten it into something ordinary.
  float energy = clamp(uLevel * 1.1 + uSurge * 0.5, 0.0, 1.0);
  float depthFade = exp(-age * 2.1); // far shells recede rather than crowding

  // Base hue rides spectral balance; a structural boundary rotates it somewhere
  // new and leaves it there, so a section change arrives as a colour rather than
  // a flash. Each shell is offset slightly, which makes depth read as a colour
  // gradient down the tunnel as well as a brightness one.
  float baseHue = fract(0.50 + 0.42 * clamp(uTilt + uNovelty * 0.4, 0.0, 1.0) + shell * 0.035);
  // Roughness — the audio's 1/f exponent — sets how far apart the two hues sit.
  // Smooth dark material keeps them close to a unified scheme; bright noisy
  // material drives them to full complementary opposition.
  float sep = 0.10 + 0.40 * uRoughness;

  vec3 nodeCol = hsv2rgb(vec3(fract(baseHue + sep * 0.5), 0.82, 1.0));
  vec3 lineCol = hsv2rgb(vec3(fract(baseHue - sep * 0.5), 0.92, 1.0));

  vec3 col = vec3(0.0);
  col += nodeCol * node * (0.55 + 2.2 * past + 1.5 * energy) * depthFade;
  col += lineCol * filament * (0.22 + 0.9 * energy + 0.8 * past) * depthFade;
  // Rays are a halo, not the subject. They were loud enough to flatten the
  // lattice into a bicycle wheel before this came down.
  col += lineCol * rays * (0.02 + 0.13 * uHigh) * depthFade;
  col += vec3(1.0, 0.96, 0.92) * pulse * 0.7 * depthFade;

  // Central core: the fountain's mouth. Always present, so the composition has
  // the single bright centre the style is built around.
  // Tight falloff on purpose. A wider core washed a pale haze across the whole
  // frame and greyed out the lattice it is supposed to sit inside.
  col += mix(nodeCol, vec3(1.0), 0.45) * exp(-radius * 11.0) *
         (0.45 + 1.3 * uMid + 0.9 * uSurge);

  // A break drains saturation without dimming the structure to nothing — the
  // lattice stays legible, it just stops being alive.
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * 0.8, uBreak * 0.75);

  // Deep ground, never pure black.
  col += vec3(0.012, 0.009, 0.030) * (1.0 - 0.5 * uBreak);

  // Soft rim falloff so the figure sits in the frame instead of being cropped.
  col *= smoothstep(1.95, 0.30, radius);

  // Tone curve: additive light blows out fast, and this keeps the highlights
  // from clipping to flat white while leaving the colour saturated.
  col = col / (1.0 + col * 0.55);

  // Dither. Dark saturated gradients band badly on 8-bit phone panels.
  col += (hash(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
