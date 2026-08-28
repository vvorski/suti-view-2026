// Composites the geometric layer over the atmospheric one.
//
// Opacity is applied before the merge mode gets a say — the familiar
// Photoshop-layer contract. 0% mix is "just the atmosphere," 100% is "the
// full blend," and the merge mode only decides what "full" looks like in
// between. Keeping mix universal, rather than only meaningful for Normal,
// means switching modes never requires also touching the slider to get back
// to something legible.

varying vec2 vUv;

uniform sampler2D uAtmosphere;
uniform sampler2D uGeometry;
uniform float uMix; // 0-1
uniform int uMode;  // 0 normal, 1 add, 2 screen, 3 multiply, 4 overlay, 5 difference
// The geometric layer is drawn in white; all of its colour is this gain,
// applied here rather than inside each view. See geo-colour.ts.
uniform vec3 uGeoColour;

// Physical disturbance of the device, as (angle, offsetX, offsetY, overscan).
// Applied here rather than in each view so every programme tumbles, including
// ones written later, and so both layers move as one picture — transforming
// them separately would shear the geometry off its own atmosphere. See
// shake.ts.
uniform vec4 uTumble;

vec3 overlayBlend(vec3 base, vec3 top) {
  vec3 lo = 2.0 * base * top;
  vec3 hi = 1.0 - 2.0 * (1.0 - base) * (1.0 - top);
  return mix(lo, hi, step(0.5, base));
}

void main() {
  // Rotate about the centre, scale up by the overscan, then drift. The
  // overscan is what keeps the rotated corners inside the source: without it
  // the render targets clamp at their edges and a tumble smears the outermost
  // row of pixels across the corner it exposed.
  vec2 p = vUv - 0.5;
  float c = cos(uTumble.x);
  float s = sin(uTumble.x);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) / (1.0 + uTumble.w);
  vec2 uv = clamp(p + uTumble.yz + 0.5, 0.0, 1.0);

  vec3 base = texture2D(uAtmosphere, uv).rgb;
  vec3 top = texture2D(uGeometry, uv).rgb * uGeoColour;

  vec3 blended;
  if (uMode == 1) blended = base + top;
  else if (uMode == 2) blended = 1.0 - (1.0 - base) * (1.0 - top);
  else if (uMode == 3) blended = base * top;
  else if (uMode == 4) blended = overlayBlend(base, top);
  else if (uMode == 5) blended = abs(base - top);
  else blended = top; // normal

  vec3 col = clamp(mix(base, blended, uMix), 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}
