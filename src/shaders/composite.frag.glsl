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

vec3 overlayBlend(vec3 base, vec3 top) {
  vec3 lo = 2.0 * base * top;
  vec3 hi = 1.0 - 2.0 * (1.0 - base) * (1.0 - top);
  return mix(lo, hi, step(0.5, base));
}

void main() {
  vec3 base = texture2D(uAtmosphere, vUv).rgb;
  vec3 top = texture2D(uGeometry, vUv).rgb;

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
