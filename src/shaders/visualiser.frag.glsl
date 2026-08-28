// Nocturnal field: domain-warped fractal noise, lit from within by whatever the
// microphone is hearing.
//
// Three things drive it, on deliberately different timescales:
//
//   uFlow      motion, integrated from level — quiet coasts, loud churns
//   uTilt      colour, from spectral balance, smoothed over ~2.5s
//   uBreak     structure, when the sound drops below its own recent norm
//
// The separation is the point. Colour that chased every transient would strobe;
// motion that ignored them would feel dead. So onsets go to shape, spectral
// balance goes to hue, and only sustained change moves the whole composition.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uFlow;      // audio-integrated phase; the main motion clock
uniform float uLevel;     // 0-1 overall drive
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uTransient; // 0-1, decays in ~0.16s
uniform float uTilt;      // 0 = bass-heavy, 1 = treble-heavy; slow
uniform float uBreak;     // 0-1, sound dropped below its recent norm
uniform float uSurge;     // 0-1, re-entry after a break
uniform sampler2D uSpectrum;

// --- value noise -------------------------------------------------------------

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  // Quintic fade: smoother second derivative than smoothstep, which matters
  // because these gradients are stretched very wide and cubic creases show.
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Four octaves. Five looked marginally better and cost ~20% more fill on a
// mid-range phone, which is not a trade worth making at this size. This runs
// three times per pixel (twice for the warp, once for the field) and is by far
// the dominant cost in the shader.
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8); // rotate between octaves to break axis alignment

  for (int i = 0; i < 4; i++) {
    sum += amp * noise(p);
    p = rot * p * 2.02;
    amp *= 0.5;
  }
  return sum;
}

// --- palette -----------------------------------------------------------------

// Two full ramps, crossfaded by spectral tilt. Bass-heavy material runs deep
// blue into violet and magenta; treble-heavy runs midnight into teal and gold.
// Because uTilt is smoothed over seconds, a track moves through these rather
// than flickering between them — a bassline and a breakdown genuinely look
// different, but no single hi-hat changes the colour of the screen.
//
// Neither ramp reaches white. It is a nocturnal thing and blowing out to white
// would betray it.
vec3 palette(float t, float energy, float tilt) {
  vec3 bass = mix(vec3(0.04, 0.04, 0.15), vec3(0.26, 0.11, 0.42), smoothstep(0.18, 0.68, t));
  bass = mix(bass, vec3(0.60, 0.16, 0.40), smoothstep(0.62, 1.0, t) * energy);

  vec3 air = mix(vec3(0.02, 0.06, 0.13), vec3(0.10, 0.40, 0.45), smoothstep(0.18, 0.68, t));
  air = mix(air, vec3(0.72, 0.54, 0.22), smoothstep(0.62, 1.0, t) * energy);

  return mix(bass, air, tilt);
}

void main() {
  // Aspect-corrected, centred coordinates. Using the shorter side as the unit
  // keeps the composition identical in portrait and landscape.
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

  float radius = length(uv);
  float angle = atan(uv.y, uv.x);

  // A break pulls the whole composition inward, and the surge on re-entry
  // throws it back out. This is the most legible signal on the screen because
  // it moves everything at once rather than changing a shade.
  float zoom = 1.0 + uBreak * 0.30 - uSurge * 0.22;
  uv *= zoom;
  radius *= zoom;

  // --- domain warp ---------------------------------------------------------
  // Two fbm lookups displace the coordinates before the third reads them. This
  // is what turns bland cloud noise into something with filaments and eddies.
  vec2 drift = vec2(uTime * 0.012, uTime * -0.008); // never fully still
  vec2 p = uv * 1.6 + drift;

  vec2 warp = vec2(
    fbm(p + vec2(0.0, uFlow * 0.35)),
    fbm(p + vec2(5.2, 1.3) - vec2(uFlow * 0.28, 0.0))
  );

  // Warp strength tracks the low end, so bass thickens and curls the structure
  // rather than only brightening it.
  float warpAmount = 0.45 + 1.30 * uLow + 0.55 * uLevel;
  float field = fbm(p + warp * warpAmount + vec2(uFlow * 0.18, 0.0));

  // --- spectral rings ------------------------------------------------------
  // The scalar bands say how much; the spectrum texture says what shape. Map
  // radius to frequency so bass sits at the centre and the top end at the rim,
  // and let the highs decide how much of it shows.
  float specSample = texture2D(uSpectrum, vec2(clamp(radius * 0.85, 0.0, 1.0), 0.5)).r;
  float rings = sin(radius * 34.0 - uFlow * 1.4 + angle * 0.5) * 0.5 + 0.5;
  field += rings * specSample * (0.06 + 0.30 * uHigh);

  // --- transients ----------------------------------------------------------
  // An onset pushes a ripple outward from the centre instead of flashing the
  // frame. A full-frame flash reads as a beat marker; this reads as the field
  // being struck.
  float ripple = sin(radius * 18.0 - uTransient * 9.0) * exp(-radius * 2.2);
  field += ripple * uTransient * 0.45;

  // --- shading -------------------------------------------------------------
  float energy = clamp(uLevel * 1.05 + uTransient * 0.35 + uSurge * 0.5, 0.0, 1.0);

  // Contrast opens up with energy: near-silence is a flat, almost featureless
  // dark, and structure resolves as sound arrives.
  float t = clamp((field - 0.5) * (1.1 + 2.3 * energy) + 0.5, 0.0, 1.0);
  vec3 col = palette(t, energy, uTilt);

  // A dim core that swells with the mids — the eye needs somewhere to rest.
  col += vec3(0.10, 0.14, 0.20) * uMid * exp(-radius * 2.6);

  // Vignette. Tighter when quiet, and tighter still during a break.
  col *= smoothstep(1.25, 0.18, radius * (1.18 - 0.16 * energy + 0.30 * uBreak));

  // A break drains the colour towards grey without going black. Losing the hue
  // is what makes the return of colour on re-entry worth watching.
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma), uBreak * 0.72);

  // Overall lift, floored well above zero: never a fully black screen, which on
  // a phone is indistinguishable from a crash.
  col *= 0.42 + 0.58 * energy;
  col *= 1.0 - 0.35 * uBreak;
  col += vec3(0.016, 0.019, 0.030);

  // Ordered-ish dither. Dark gradients band badly on 8-bit phone panels and
  // this is almost entirely dark gradients; a sub-LSB of noise costs nothing
  // and removes the contour rings completely.
  float grain = hash(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5;
  col += grain / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
