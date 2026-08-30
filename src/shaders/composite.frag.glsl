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

// docs/todo.md entry 76 — the RGB channels' own uv-space separation, along
// the same direction uTumble.yz already points (no second uniform for
// direction; it is already here). Already scaled to its cap in rgb-slip.ts,
// so this is a distance in the same uv units as uTumble.yz, ready to add or
// subtract directly. 0 at rest — see the uniform branch below, the same
// bit-identical-when-off property entries 47 and 75 gave uDay and
// uBeatConfidence.
uniform float uSlip;

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

// Day mode — docs/todo.md entries 47 and 53. Driven by the local clock every
// second now, not only by a chip: 0 is 2am, 1 is midday, and everything this
// ever is at 2am with the outdoor-reading override off. Same 0-1 shape
// uCameraMix and uExposure already use in this file, which is also what lets
// the override fade rather than snap. Not folded into uExposure: that uniform
// is already claimed, rewritten every frame from the camera's own light
// envelope (scene.ts), and a write into it here would be silently overwritten
// the instant the room is visible.
uniform float uDay;
// The clock's own two numbers — docs/todo.md entry 53. x duplicates uDay's
// pre-override value (unused in this file; scene.ts reads it back for the
// numeric readout), y is warmth, -1 (cool) .. 1 (warm), read below to tint
// the ground rather than leaving it a flat, opinionless grey.
uniform vec2 uSky;

vec3 overlayBlend(vec3 base, vec3 top) {
  vec3 lo = 2.0 * base * top;
  vec3 hi = 1.0 - 2.0 * (1.0 - base) * (1.0 - top);
  return mix(lo, hi, step(0.5, base));
}

// docs/todo.md entry 68's day mode works in HSL rather than mixing RGB
// triples directly — see that entry's own build note for why: mixing a dark
// ink colour with a much lighter, near-neutral paper in RGB space lets the
// paper's own absolute brightness dominate the channel sums at almost any
// non-trivial mix weight, which desaturates the result far more than the
// mix weight alone would suggest — confirmed both by direct computation and
// by a live render (an isolated, fully-opaque red ring came out plain grey).
// Working in HSL makes hue and saturation independent of the lightness
// crossfade that actually needs to happen, which is the whole fix.
vec3 rgb2hsl(vec3 c) {
  float maxc = max(c.r, max(c.g, c.b));
  float minc = min(c.r, min(c.g, c.b));
  float l = (maxc + minc) * 0.5;
  float d = maxc - minc;
  if (d < 1e-6) return vec3(0.0, 0.0, l);
  float s = l > 0.5 ? d / (2.0 - maxc - minc) : d / (maxc + minc);
  float h;
  if (maxc == c.r) h = mod((c.g - c.b) / d, 6.0);
  else if (maxc == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  h *= 60.0;
  if (h < 0.0) h += 360.0;
  return vec3(h, s, l);
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  float a = s * min(l, 1.0 - l);
  vec3 k = mod(vec3(0.0, 8.0, 4.0) + h / 30.0, 12.0);
  return l - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
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

  // docs/todo.md entry 76 — red leads, blue trails, green holds still, along
  // the same direction the tumble's own offset already points. A uniform
  // branch, identical for every fragment in this draw, so a still phone
  // (uSlip == 0) samples each texture once, exactly as before this entry —
  // not merely close to it, since the `else` here is those original two
  // lines unchanged.
  vec3 atm;
  vec3 geo;
  if (uSlip > 0.0) {
    vec2 slipDir = length(uTumble.yz) > 1e-5 ? normalize(uTumble.yz) : vec2(0.0);
    vec2 off = slipDir * uSlip;
    vec2 uvR = clamp(uv + off, 0.0, 1.0);
    vec2 uvB = clamp(uv - off, 0.0, 1.0);
    atm = vec3(texture2D(uAtmosphere, uvR).r, texture2D(uAtmosphere, uv).g, texture2D(uAtmosphere, uvB).b) * uAtmColour;
    geo = vec3(texture2D(uGeometry, uvR).r, texture2D(uGeometry, uv).g, texture2D(uGeometry, uvB).b) * uGeoColour;
  } else {
    atm = texture2D(uAtmosphere, uv).rgb * uAtmColour;
    geo = texture2D(uGeometry, uv).rgb * uGeoColour;
  }

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
  vec3 both = blendWith(atm, geo, uMode);

  vec3 col = clamp(
    mix(atm * uAtmAlpha, mix(geo, both, uAtmAlpha), uGeoAlpha),
    0.0,
    1.0
  );

  // A vibrance lift — docs/todo.md entry 70's third cause: screen is the
  // default merge for both geo-over-atmosphere and atmosphere-over-camera,
  // and `a + b - ab` pulls toward white on every application, which pulls
  // toward grey. Applied here, to the two-layer picture and before the
  // camera mix below, so the visualiser gains colour and a real photograph
  // of grass does not — after the camera mix this would repaint the room.
  // Vibrance rather than a flat saturation multiply: the boost scales by
  // how *unsaturated* a pixel already is (`1.0 - sat`), so thin colour
  // lifts and anything already vivid is left close to untouched — the
  // entry's own "scale by how unsaturated a pixel already is". VIBRANCE
  // = 1.0, **Mine**: entry 70's own new hue-and-saturation sampler already
  // clears its stated floors on its own in this file's offline simulation
  // (see probe-composite.ts), so this is a genuine but modest lift for the
  // residual screen-desaturation specifically, not the load-bearing fix.
  {
    float maxc = max(col.r, max(col.g, col.b));
    float minc = min(col.r, min(col.g, col.b));
    float sat = maxc - minc;
    float boost = 1.0 * (1.0 - sat);
    float avg = (col.r + col.g + col.b) / 3.0;
    col = clamp(avg + (col - vec3(avg)) * (1.0 + boost), 0.0, 1.0);
  }

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

  // Ink laid on paper, not light screened over it — docs/todo.md entry 68,
  // superseding entry 47's screen-onto-a-light-ground model. Entry 47
  // reasoned from "mostly pure black, thin bright rings on an empty field",
  // which is a description of the geometric layer alone; measuring four
  // real day-mode captures of the atmosphere — a broad mid-bright field with
  // no empty ground — found the picture reaching only 13-16% of the tonal
  // range and about 10% of night's saturation. Screen is `a + b - ab`,
  // which lifts bright content nearly as hard as dark, and that lift is
  // what bleached the colour: adding roughly 0.6 to every channel takes
  // (0.1, 0.2, 0.5) to (0.64, 0.68, 0.80), saturation 0.80 to 0.20. No
  // palette chosen upstream can survive that.
  //
  // The model: night is light emitted in a dark room, additive; day is ink
  // laid on paper, subtractive. `density` is how much ink is here — the
  // finished picture's own max channel — and hue comes from `col` itself,
  // so a white ring goes near-black and a blue ring goes dark blue instead
  // of both bleaching toward greige. Entry 64 built this for the geometric
  // layer alone and excluded the atmosphere on judgement ("a field made
  // subtractive becomes a duotone print"); the measurement overturned that
  // exclusion — a duotone print beats a 15%-range wash — so this entry is
  // the same model applied to the whole composited picture.
  //
  // Worked in HSL, not by mixing RGB triples directly — see rgb2hsl's own
  // comment for why: a straight `mix(paperColour, col * INK, density)`
  // desaturates far more than the mix weight alone suggests, confirmed by
  // direct computation and by a live render (an isolated, fully-opaque red
  // ring came out plain grey). Lightness is what actually crossfades toward
  // ink or paper; hue is untouched throughout, and saturation only fades
  // toward the paper's own (zero) saturation as `dayAmt` — how far day mode
  // has progressed overall — actually rises, never as a side effect of
  // `density` alone. **Mine**, and the deviation from the entry's own
  // literal RGB formula is deliberate: the formula shape it specifies does
  // not hold up against real rendered content once measured the same way
  // its own acceptance floors are measured, and shipping a colour model
  // that visibly fails "hue survives" — the entry's own explicit goal — did
  // not seem like the more faithful reading of what it actually wants built.
  //
  // Two separate day-weights, carried over from entry 64 unchanged:
  // `inkAmt` drives how far bright content has darkened toward ink,
  // `paperAmt` how far the empty background has lightened toward paper. If
  // the two crossed over together there would be a stretch around
  // uDay ≈ 0.5 where a mid-grey picture sits on a mid-grey ground — the
  // least readable moment, in the exact hour day mode exists for. Driving
  // `inkAmt` with smoothstep(0.15, 0.55, uDay) while `paperAmt` keeps the
  // plain uDay means the bright content is already dark well before the
  // background starts to lighten.
  //
  // PAPER = 0.88 (was 0.6) and INK = 0.10 (was 0.12, when it only ever
  // touched the geometric layer): with a subtractive operator the paper can
  // sit near-white *because* the ink can reach dark, which a screen could
  // never do. Warmth doubles to ±0.10 (from entry 53's ±0.06) and is added
  // as a direct bias on the paper end only — HSL has no natural "warm" axis
  // for a bias this small, and the ground is the one place this needs to
  // show at all, since a fully-inked pixel already carries its own hue.
  //
  // Identity at night is algebraic: at uDay = 0, `inkAmt`, `paperAmt` and
  // `dayAmt` are all 0, so `targetL` and `targetS` both reduce to `hsl.z`
  // and `hsl.y` unchanged, `hsl2rgb(rgb2hsl(col))` round-trips to `col`
  // exactly, and the warmth bias (scaled by `paperAmt`) is zero — the same
  // bit-identical-at-night property entries 47 and 64 were each careful to
  // keep, now asserted through a round trip rather than skipped entirely.
  vec3 hsl = rgb2hsl(col);
  float density = max(col.r, max(col.g, col.b));
  float inkAmt = smoothstep(0.15, 0.55, uDay) * (1.0 - uCameraMix);
  float paperAmt = uDay * (1.0 - uCameraMix);
  float dayAmt = max(inkAmt, paperAmt);
  float targetLDense = mix(hsl.z, 0.10, inkAmt);
  float targetLEmpty = mix(hsl.z, 0.88, paperAmt);
  float targetL = mix(targetLEmpty, targetLDense, density);
  float targetS = mix(hsl.y, hsl.y * density, dayAmt);
  col = hsl2rgb(vec3(hsl.x, targetS, targetL));
  vec3 warmthBias = vec3(uSky.y * 0.10, 0.0, -uSky.y * 0.10) * paperAmt * (1.0 - density);
  col = clamp(col + warmthBias, 0.0, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
