// Composites the three layers: geometric over atmospheric, both over the room.
//
// Each layer has its own opacity, which is the whole point. The old single
// `mix` was a crossfade — it moved weight from the atmosphere to the geometry
// and back, and could not turn *either* down. That made the camera underneath
// unreadable at every setting, because something was always landing on it at
// full strength. Two independent alphas fix that, and uGeoAlpha is exactly the
// old uMix under a truer name, so every picture the crossfade could make is
// still reachable with uAtmAlpha at 1.
//
// Each layer's own opacity is applied before its own merge mode gets a say —
// the familiar Photoshop-layer contract. 0 is "just what's beneath", 1 is
// "the full blend", and the merge mode only decides what "full" looks like in
// between. Keeping it universal, rather than only meaningful for Normal, means
// switching modes never requires also touching the opacity to get back to
// something legible. uMode and uAtmMode are each a property of the layer they
// belong to now, not one global picture setting — a blend mode describes how
// one layer combines with what is beneath it, which is a per-layer fact.

varying vec2 vUv;

uniform sampler2D uAtmosphere;
uniform sampler2D uGeometry;
uniform float uGeoAlpha; // 0-1, the geometric layer's own opacity
uniform float uAtmAlpha; // 0-1, the atmospheric layer's own opacity
// 0 normal, 1 add, 2 screen, 3 multiply, 4 overlay, 5 difference — see
// MERGE_MODES in merge-modes.ts, which both of these index into.
uniform int uMode;    // the geometric layer's own blend, over the atmosphere
uniform int uAtmMode; // the atmosphere's own blend, over the camera
// Every layer is drawn in white by its own shader; all of its colour is a gain
// applied here rather than inside each view. See geo-colour.ts.
//
// One per layer, including the camera. A tint on a real image is not the same
// gesture as a tint on generated line work — it is a filter over something that
// already has colours of its own — but it is the same arithmetic and the same
// control, and having the layers differ in what you can do to them was the
// thing that made the stack feel arbitrary.
uniform vec3 uGeoColour;
uniform vec3 uAtmColour;
uniform vec3 uCamColour;

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

// The picture answers the light in the room — docs/todo.md entry 23. 1 is
// identity, and is also everything this ever is while the camera is down, so
// a session that never raises passthrough pays nothing for this uniform
// existing.
uniform float uExposure;

vec3 overlayBlend(vec3 base, vec3 top) {
  vec3 lo = 2.0 * base * top;
  vec3 hi = 1.0 - 2.0 * (1.0 - base) * (1.0 - top);
  return mix(lo, hi, step(0.5, base));
}

// The one blend rule, applied wherever a layer needs to combine with what is
// beneath it. Shared by the geo-over-atm step and the atm-over-camera step
// below, rather than two copies of the same six-way ladder — the moment this
// entry's whole point (merge is a per-layer property, not a global setting)
// would otherwise be undone by the mode logic itself staying singular.
vec3 blendWith(vec3 base, vec3 top, int mode) {
  if (mode == 1) return base + top;
  else if (mode == 2) return 1.0 - (1.0 - base) * (1.0 - top);
  else if (mode == 3) return base * top;
  else if (mode == 4) return overlayBlend(base, top);
  else if (mode == 5) return abs(base - top);
  else return top; // normal
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

  // docs/todo.md entry 34. The atmosphere used to be dimmed before anything
  // else saw it — texture2D(uAtmosphere, uv).rgb * uAtmAlpha — so the merge
  // mode operated on a colour already darkened toward black. That is wrong
  // under any mode where black is not neutral (Multiply, Overlay): at
  // uAtmAlpha == 0 the atmosphere did not disappear, it turned the whole
  // frame black, because the blend still fully governed a black input.
  //
  // The fix keeps the atmosphere undimmed going into the blend, and instead
  // mixes uAtmAlpha across the blend's *result* — between the geometry alone
  // (what the picture looks like with no atmosphere at all) and the full
  // blend. That is the same shape uGeoAlpha already uses one line down, and
  // it is why zero opacity now means "this layer is absent", the way it
  // already did for the geometric layer.
  vec3 atm = texture2D(uAtmosphere, uv).rgb * uAtmColour;
  vec3 geo = texture2D(uGeometry, uv).rgb * uGeoColour;
  vec3 both = blendWith(atm, geo, uMode);

  vec3 col = clamp(
    mix(atm * uAtmAlpha, mix(geo, both, uAtmAlpha), uGeoAlpha),
    0.0,
    1.0
  );

  // The room goes underneath, and the picture becomes light falling on it.
  //
  // The blend here used to be hardcoded to screen, which is why it is not
  // simply another call to blendWith with uMode: the geometric layer's blend
  // governs geo-over-atmosphere, and the atmosphere's own uAtmMode is what
  // now governs how the resulting picture sits on the camera, replacing the
  // constant that used to do this unconditionally. Screen is still uAtmMode's
  // default, so nothing about the picture changes until this control is
  // touched — see merge-modes.ts's DEFAULT_ATM_MERGE_MODE.
  //
  // Sampled from vUv, deliberately NOT the tumbled uv above. The tumble makes
  // the picture feel knocked about by the phone; a view of the actual room
  // already appears to move when the phone moves, so tumbling it too would
  // double-count that motion and read as broken rather than physical.
  //
  // At uCameraMix == 0 this collapses to `col` exactly — no cost, no drift in
  // what every existing view already looks like. And with both alphas low,
  // `col` is near black, so at the default screen mode the blend leaves the
  // room almost untouched: that is the path to a readable camera, and it did
  // not exist before.
  if (uCameraMix > 0.0) {
    vec2 camUv = (vUv - 0.5) * uCameraFit + 0.5;
    vec3 cam = texture2D(uCamera, camUv).rgb * uCamColour;
    vec3 lit = blendWith(cam, col, uAtmMode);
    col = mix(col, lit, uCameraMix);
  }

  // Applied last, after the camera mix and after the existing clamp above —
  // this is a gain on the finished picture, not on either layer feeding it,
  // so it answers the room without changing how the layers relate to each
  // other. Re-clamped because a gain above 1 can push a bright pixel out of
  // range.
  col = clamp(col * uExposure, 0.0, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
