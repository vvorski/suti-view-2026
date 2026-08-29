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

// Passthrough AR: the room, under everything. See camera.ts.
//
// A third layer rather than a third *view*, so that every existing programme
// and every merge mode works over it without knowing it exists — the views
// stay what views.ts says they are, a fragment shader plus a label.
uniform sampler2D uCamera;
uniform float uCameraMix;  // 0 = no camera, and then this costs nothing
// Cover-fit scale, computed against the drawing buffer in scene.ts. The camera
// is landscape and the canvas is usually portrait; without this the room is
// stretched to the frame, which reads as a bug immediately.
uniform vec2 uCameraFit;

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

  // The room goes underneath, and the picture becomes light falling on it.
  //
  // Screen, not alpha: neither layer has an alpha channel to composite with —
  // both are opaque, dark-grounded and bright-marked. Screening is what makes
  // white line work read as *projected onto* the room rather than *pasted
  // over* it, and it leaves black exactly where the picture is black, which is
  // most of the frame.
  //
  // Sampled from vUv, deliberately NOT the tumbled uv above. The tumble makes
  // the picture feel knocked about by the phone; a view of the actual room
  // already appears to move when the phone moves, so tumbling it too would
  // double-count that motion and read as broken rather than physical.
  //
  // At uCameraMix == 0 this collapses to `col` exactly — no cost, no drift in
  // what every existing view already looks like.
  if (uCameraMix > 0.0) {
    vec2 camUv = (vUv - 0.5) * uCameraFit + 0.5;
    vec3 cam = texture2D(uCamera, camUv).rgb;
    vec3 lit = 1.0 - (1.0 - cam) * (1.0 - col);
    col = mix(col, lit, uCameraMix);
  }

  gl_FragColor = vec4(col, 1.0);
}
