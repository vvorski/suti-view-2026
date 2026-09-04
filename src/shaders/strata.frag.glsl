// "Strata" — an atmospheric-layer programme.
//
// The picture is sand between two panes of glass. The audio pours coloured
// grains in from whichever edge is up, they sift down under the phone's own
// in-plane gravity, and they pile in layers along whichever edge is down.
// Laid flat nothing falls, the pile holds and new grains hang as dust; turned
// over, the pile becomes the source and rains back down.
//
// This file draws almost nothing. Every grain's position and colour was
// decided in TypeScript by engine/sediment.ts and arrived here as a texture,
// for the reason views.ts states as a rule: a view is "nothing but a fragment
// shader plus a label", and a view that needed its own ping-pong render
// target would break that for every other one. The spectrogram already
// established the shape — accumulate in TypeScript, hand over a DataTexture —
// and this is its second tenant.
//
// So there is no audio uniform here at all. The pouring already happened.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uLevel;
uniform float uBreak;
uniform float uRoughness;

// RGBA. rgb is the grain's own colour, a is 1 where there is a grain and 0
// where there is not. One texture, because occupancy is the alpha of the
// thing that occupies the cell and a second sampler for it would be a second
// fetch to learn what the first already knows.
uniform sampler2D uSediment;
// Cells across and down, so this can work in cell space without inferring it
// from the texture's own size (which GLSL1 cannot ask for anyway).
uniform vec2 uSedimentGrid;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  // The grid is laid out with y increasing downward — row 0 is the top of the
  // phone — because that is how the model reads "down", and gl_FragCoord's y
  // increases upward. Flipping here rather than in the model keeps the one
  // place that has to know about screen orientation in the file that is
  // already about the screen.
  vec2 cellUv = vec2(uv.x, 1.0 - uv.y);

  // Bilinear sampling is doing the work that would otherwise be a distance
  // field: at a phone's pixel density each cell is ~10px across, and a linear
  // fetch already gives a soft shoulder between a full cell and an empty one.
  // What it does not give is a *grain*, so the alpha is put through a
  // smoothstep to pull the edge back in — without it the sand reads as a
  // blurred wash, which is the atmospheric layer's failure mode, not its job.
  vec4 s = texture2D(uSediment, cellUv);
  float grain = smoothstep(0.18, 0.62, s.a);

  // The cell lattice, faintly. Sand is granular and a perfectly smooth pile
  // is the one thing that would give away that this is a grid pretending not
  // to be: a little variation per cell puts the grain back without drawing an
  // actual boundary anywhere.
  vec2 cell = cellUv * uSedimentGrid;
  vec2 f = fract(cell) - 0.5;
  float speck = 1.0 - 0.22 * smoothstep(0.16, 0.5, max(abs(f.x), abs(f.y)));

  // Depth in the pile, read straight off how much sand is around: a cell
  // whose neighbours are all full sits inside the mass and darkens a little,
  // one at the surface catches the light. That is the whole reason the pile
  // has strata to look at rather than being a flat silhouette — layers laid
  // down at different moments carry different colours, and the shading is
  // what makes the boundary between two of them visible at all.
  vec2 px = 1.0 / uSedimentGrid;
  float around =
    texture2D(uSediment, cellUv + vec2(px.x, 0.0)).a +
    texture2D(uSediment, cellUv - vec2(px.x, 0.0)).a +
    texture2D(uSediment, cellUv + vec2(0.0, px.y)).a +
    texture2D(uSediment, cellUv - vec2(0.0, px.y)).a;
  float buried = around * 0.25;
  float shade = mix(1.15, 0.78, buried);

  vec3 col = s.rgb * grain * speck * shade;

  // The level lifts the whole frame a little, so a loud passage brightens the
  // sand already lying there rather than only pouring more of it. Small: the
  // picture's subject is the pile's shape, and a pile that pulses with the
  // music would read as a meter.
  col *= 0.92 + 0.16 * uLevel;

  // Rough, noisy material desaturates a little — the same gesture Field and
  // Spectrogram make, so the three read as the same instrument.
  col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), uRoughness * 0.18);

  // A break drains the colour, as everywhere else in the stack.
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * 0.7, uBreak * 0.8);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
