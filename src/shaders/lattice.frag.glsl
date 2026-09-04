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
//
// The shape itself is not fixed. Symmetry order, node density, tunnel depth,
// and a permanent spiral twist are all drawn from the seed (uSeed), which
// re-rolls on request and, on its own, at a real structural boundary in the
// music — so a section change is a genuinely different lattice, not just a
// different colour on the same one. The twist also breathes continuously via
// the flow clock, so the shape keeps moving even through a long stretch where
// nothing structural happens.

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
uniform vec4 uSeed; // re-rolled on demand; see scene.ts
// docs/todo.md entry 114 — the mouse cursor: xy in this shader's own uv space
// (the pointer needs no conversion, `toShaderUv` and the uv below are already
// the same space), z the eased 0-1 presence from engine/hover.ts. The first
// time a pointer has ever reached the atmospheric layer, which is why it is a
// uniform rather than a parameter. vec3(0,0,0) on any device without a mouse.
uniform vec3 uPointer;

const float PI = 3.14159265;
const float TAU = 6.28318531;

// How hard the lens pulls, and how far it reaches — docs/todo.md entry 114.
//
// The bound that matters is folding: the map stays injective while
// PULL < 4. For f(d) = d(1 + k*w(d/R)), f'(d) = 1 + k(w + t*w'), and
// (w + t*w') bottoms out at -0.25 for a smoothstep, so f' >= 1 - 0.25k. At
// 0.8 that is f' >= 0.8 — five times under the fold, with a fifth of a
// margin, so space compresses toward the cursor and never turns back on
// itself. Chosen visible rather than tasteful: the last motion effect to
// ship was reported as too subtle (entry 111). Peak apparent displacement is
// about 9% of the short screen dimension.
//
// REACH just under half the short dimension keeps this a local event on the
// picture rather than a whole-frame zoom.
const float POINTER_PULL = 0.8;
const float POINTER_REACH = 0.45;

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

// --- the things that live at the nodes -------------------------------------
// The lattice used to put a featureless jewel at every crossing. These are the
// alternatives it morphs between, and they are the reason the reference for
// this view is Alex Grey rather than generic sacred geometry: his lattices are
// populated — bodies and eyes sit in the grid as the things the network is
// made of, not as decoration laid over it.
//
// All three are drawn as emissive line work — a bright edge plus a soft aura —
// rather than filled silhouettes, to match everything else here.

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// A standing figure, arms raised outward. Built from capsules; abs(p.x) gives
// the bilateral symmetry for free and halves the distance evaluations.
float shapeFigure(vec2 p) {
  p.x = abs(p.x);
  float d = length(p - vec2(0.0, 0.62)) - 0.125;                    // head
  d = min(d, sdSeg(p, vec2(0.0, 0.44), vec2(0.0, 0.02)) - 0.085);   // torso
  d = min(d, sdSeg(p, vec2(0.02, 0.38), vec2(0.30, 0.50)) - 0.050); // upper arm
  d = min(d, sdSeg(p, vec2(0.30, 0.50), vec2(0.52, 0.30)) - 0.042); // forearm
  d = min(d, sdSeg(p, vec2(0.02, 0.04), vec2(0.14, -0.34)) - 0.060); // thigh
  d = min(d, sdSeg(p, vec2(0.14, -0.34), vec2(0.16, -0.72)) - 0.048); // shin

  float edge = exp(-abs(d) * 15.0);
  float aura = exp(-max(d, 0.0) * max(d, 0.0) * 22.0);

  // Chakra points down the midline — the detail that makes it read as an
  // energy body rather than a stick man.
  float chakra = 0.0;
  chakra += exp(-dot(p - vec2(0.0, 0.68), p - vec2(0.0, 0.68)) * 340.0);
  chakra += exp(-dot(p - vec2(0.0, 0.32), p - vec2(0.0, 0.32)) * 300.0);
  chakra += exp(-dot(p - vec2(0.0, 0.06), p - vec2(0.0, 0.06)) * 300.0);

  return edge * 0.85 + aura * 0.22 + chakra * 0.8;
}

// An eye: a lens outline from two overlapping discs, plus iris and pupil.
float shapeEye(vec2 p) {
  float upper = length(p - vec2(0.0, -0.52)) - 0.74;
  float lower = length(p - vec2(0.0, 0.52)) - 0.74;
  float d = max(upper, lower);                       // intersection = lens

  float outline = exp(-abs(d) * 17.0);
  float iris = exp(-abs(length(p) - 0.17) * 20.0);
  float pupil = exp(-dot(p, p) * 70.0);
  return outline * 0.85 + iris * 0.55 + pupil * 0.7;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

  // A break collapses the tunnel inward; the surge on re-entry blows it open.
  float breakScale = 1.0 + uBreak * 0.35 - uSurge * 0.28;
  uv *= breakScale;

  // docs/todo.md entry 114 — the cursor contracts space toward itself.
  //
  // A radial scale about the pointer, not a displacement along a normal:
  // normalize(uv - P) is singular exactly where the cursor is, which is the
  // one place the effect is strongest and the one place a NaN would be most
  // visible. This form has no singularity and is conformal, which is the
  // right kind of warp for a shader whose whole construction rests on
  // log-polar being conformal (see the note further down). Scaling the
  // sample coordinates outward is what makes the picture contract inward.
  //
  // The mandala's own centre does not move. The header above calls the
  // single central focus a composition decision, and dragging the log-polar
  // singularity around under the cursor would be a different work — a local
  // lens leaves that intact.
  //
  // P is scaled by breakScale too, so the lens stays under the cursor's
  // actual screen position mid-break rather than sliding up to 35% away from
  // the pointer exactly when the picture is moving most.
  //
  // Written as `uv += (uv - P) * amount` rather than the algebraically equal
  // `uv = P + (uv - P) * (1.0 + amount)`: at presence 0, or anywhere outside
  // the lens, `amount` is exactly 0 and `uv + 0.0` is bit-identical to uv.
  // The other form rounds through P and back, which is only *nearly* the
  // identity — and "pixel-identical outside the lens" is a claim this has to
  // meet exactly rather than approximately.
  vec2 P = uPointer.xy * breakScale;
  float lens = smoothstep(1.0, 0.0, length(uv - P) / POINTER_REACH);
  uv += (uv - P) * (POINTER_PULL * uPointer.z * lens);

  float radius = max(length(uv), 1e-4);
  // Seed spin re-orients which screen direction each petal points at.
  float angle = atan(uv.y, uv.x) + uSeed.z * TAU;

  // Rotational symmetry order, nodes-per-sector, and tunnel density all come
  // from the seed: one lattice reads as a dense honeycomb, the next as six
  // wide spokes, and nothing about the audio mapping has to change for that
  // variety to exist. The seed re-rolls on request (space bar, double-tap,
  // double-click) and, on its own, whenever the music crosses a real
  // structural boundary (see scene.ts) — a section change is a different
  // lattice, not just a different colour.
  float SYMMETRY = 4.0 + floor(uSeed.y * 6.0); // 4..9
  float ACROSS = 3.0 + floor(uSeed.w * 4.0); // 3..6
  // Shells per unit of log-radius. Higher is a denser, deeper tunnel. The
  // slow sine on top is a permanent breath, independent of any reshape, so
  // the tunnel is never perfectly still even through a long unchanging
  // stretch of the track.
  float DEPTH = 1.6 + 1.6 * fract(uSeed.x * 2.3 + uSeed.z * 0.7) + 0.18 * sin(uFlow * 0.07);

  // --- log-polar depth ------------------------------------------------------
  // log(radius) turns "scale" into "distance", so a fixed step is a constant
  // zoom factor and the lattice can repeat forever without ever landing on a
  // boundary. Drift moves the whole structure inward: the drain.
  float depth = log(radius) * DEPTH - uFlow * 0.30;

  // A permanent spiral: how far the grid winds per unit of depth is set by
  // the seed, so some reshapes are tightly coiled and others stay
  // architectural and straight, and it breathes gently over time via uFlow so
  // the shape keeps moving even between reshapes. Applied before the fold, so
  // it warps which direction each shell's grid points rather than just
  // rotating the whole image (uSeed.z already does that, once, above).
  float twist = (fract(uSeed.y * 7.3 + uSeed.w * 1.9) - 0.5) * 2.4;
  angle += depth * twist * (0.16 + 0.06 * sin(uFlow * 0.11));

  // --- kaleidoscopic fold ---------------------------------------------------
  // Mirror within each sector rather than merely repeating: mirroring produces
  // the bilateral symmetry inside each petal that makes the figure read as
  // ornament instead of as a rotated tile.
  float sector = TAU / SYMMETRY;
  float folded = abs(mod(angle + sector * 0.5, sector) - sector * 0.5);

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
  // inhales on a kick. `past`'s weight raised from 0.5 toward 1.0 — docs/
  // todo.md entry 32 — so two shells carrying different history are
  // distinguishable by node size, not only by colour.
  float nodeR = length(cell) * (2.6 - 0.7 * uLow - 1.0 * past);
  float node = exp(-nodeR * nodeR * 7.0);

  // --- what populates the lattice ------------------------------------------
  // The lattice's own cells are far too small to read as anything — at these
  // densities a cell is a few pixels across, which is right for a jewel and
  // useless for a figure. So the population sits on its own grid, a few times
  // coarser, laid over the same log-polar space.
  //
  // Drawing a recognisable figure here is only possible because a cell has a
  // *constant* screen aspect everywhere in the image: log-polar is conformal,
  // so a cell's screen width goes as radius*sector/ACROSS and its height as
  // radius/DEPTH — both linear in radius, so the ratio between them never
  // changes. Undo that ratio and a figure at the rim is the same shape as one
  // near the drain rather than smeared by the projection. Its *size* still
  // scales with radius, which is what makes them recede down the tunnel.
  // The population gets its own coordinates, deliberately *not* the lattice's.
  // Two things in the lattice's grid destroy a figure: the spiral twist shears
  // every cell, and the fold uses abs(), which mirrors each sector about its
  // centre line and so cuts every figure in half and reflects it. Both are
  // right for ornament and fatal for anything meant to be recognised. So this
  // takes the clean pre-twist angle and a *signed* fold, giving one upright,
  // whole figure per sector, head pointing outward.
  float figSector = TAU / SYMMETRY;
  // Screen width per unit figX is radius*figSector, height per unit figY is
  // radius*FIGDIV/DEPTH. Choosing FIGDIV so those match makes the figure cell
  // square at every symmetry order and tunnel density, instead of needing a
  // constant retuned by hand each time the seed changes the geometry. Both
  // scale with radius, so the aspect holds and only the size recedes.
  float FIGDIV = DEPTH * figSector;

  float cleanAngle = atan(uv.y, uv.x) + uSeed.z * TAU;
  float figX = (mod(cleanAngle + figSector * 0.5, figSector) - figSector * 0.5) / figSector;
  float figDepth = log(radius) * (DEPTH / FIGDIV) - uFlow * 0.30 / FIGDIV;
  float figY = fract(figDepth) - 0.5;

  // The cell is square, so ±0.5 on each axis; 1.5 scales it to ±0.75, which is
  // exactly the figure's half-height.
  vec2 fp = vec2(figX, figY) * 1.5;
  fp *= 1.0 - 0.12 * uLow;

  // Where in the cycle the population sits: bare lattice, then figures, then
  // eyes, then bare again. The seed sets where a reshape lands and uFlow walks
  // it on slowly, so it drifts by itself and jumps somewhere new on a
  // structural boundary — the same way everything else in this view behaves.
  float morph = fract(uSeed.z * 3.7 + uSeed.y * 1.3 + uFlow * 0.010) * 3.0;
  float wFigure = max(0.0, 1.0 - abs(morph - 1.0));
  float wEye = max(0.0, 1.0 - abs(morph - 2.0));
  float popAmount = wFigure + wEye;
  float population = shapeFigure(fp) * wFigure + shapeEye(fp) * wEye;

  // Filaments: the links. Distance to the nearer grid axis, kept thin — the
  // fine line work is most of why this style reads as drawn rather than
  // rendered.
  // Width's uLevel term raised from 9 toward 14 — docs/todo.md entry 32 —
  // so lines visibly thicken with loudness rather than only tinting.
  vec2 toLine = abs(cell);
  float filament = exp(-min(toLine.x, toLine.y) * (26.0 - 14.0 * uLevel));

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
  float baseHue = fract(
    0.50 + uSeed.x + 0.42 * clamp(uTilt + uNovelty * 0.4, 0.0, 1.0) + shell * 0.035
  );
  // Roughness — the audio's 1/f exponent — sets how far apart the two hues sit.
  // Smooth dark material keeps them close to a unified scheme; bright noisy
  // material drives them to full complementary opposition.
  float sep = 0.10 + 0.40 * uRoughness;

  vec3 nodeCol = hsv2rgb(vec3(fract(baseHue + sep * 0.5), 0.82, 1.0));
  vec3 lineCol = hsv2rgb(vec3(fract(baseHue - sep * 0.5), 0.92, 1.0));

  vec3 col = vec3(0.0);
  // The lattice recedes as the population comes forward — that is what makes
  // this a morph rather than an overlay. At full figure phase the grid is
  // still there, but as a ground the bodies stand in rather than a mesh
  // competing with them for the same lines.
  float recede = 1.0 - 0.55 * popAmount;

  // The global transient term docs/todo.md entry 32 asks for: the travelling
  // ring above is deliberately kept — a hit should be something you watch
  // move — but the same hit also lifts every node's brightness here, so it
  // flashes the whole network rather than only the one shell the ring is
  // passing through. Weighted the same as `energy` above: it is the other
  // fast, rhythmic term this shader was missing, not a bigger effect than
  // loudness already gets. **Mine** — the entry names the fix but not this
  // exact coefficient.
  col += nodeCol * node * (0.55 + 2.2 * past + 1.5 * energy + 1.5 * uTransient) * depthFade * recede;
  // The population is drawn in the node colour but brighter and less tied to
  // the spectrum — a body in the lattice is a presence, not a meter.
  col += mix(nodeCol, vec3(1.0), 0.30) * population *
         (1.5 + 1.1 * energy + 0.8 * past) * depthFade;
  col += lineCol * filament * (0.22 + 0.9 * energy + 0.8 * past) * depthFade * recede;
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
