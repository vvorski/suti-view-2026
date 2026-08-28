// Nocturnal field: domain-warped fractal noise, lit from within by whatever the
// microphone is hearing.
//
// The brief was "slow swell and long decay, not pulse", so nothing here is
// driven by raw time alone. Motion advances on uFlow, a phase the CPU
// integrates from the audio level — quiet means the field nearly stops, loud
// means it churns, and the transition between them is gradual. Time only drives
// the slowest drift, so a silent room still breathes rather than freezing.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uFlow;      // audio-integrated phase; the main motion clock
uniform float uLevel;     // 0-1 overall drive
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uTransient; // 0-1, decays in ~0.2s
uniform sampler2D uSpectrum;

const float PI = 3.14159265;

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
// mid-range phone, which is not a trade worth making at this size.
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

// Deep blue at rest, warming through teal to a dim amber as energy arrives.
// Never reaches full white: the reference recording is a quiet nocturnal thing
// and blowing out to white would betray it.
vec3 palette(float t, float energy) {
  vec3 nightBlue = vec3(0.03, 0.05, 0.12);
  vec3 slate     = vec3(0.10, 0.20, 0.32);
  vec3 teal      = vec3(0.16, 0.42, 0.44);
  vec3 amber     = vec3(0.62, 0.40, 0.20);

  vec3 c = mix(nightBlue, slate, smoothstep(0.15, 0.55, t));
  c = mix(c, teal, smoothstep(0.45, 0.85, t) * (0.35 + 0.65 * energy));
  c = mix(c, amber, smoothstep(0.70, 1.0, t) * energy * energy);
  return c;
}

void main() {
  // Aspect-corrected, centred coordinates. Using the shorter side as the unit
  // keeps the composition identical in portrait and landscape.
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

  float radius = length(uv);
  float angle = atan(uv.y, uv.x);

  // --- domain warp ---------------------------------------------------------
  // Two fbm lookups displace the coordinates before the third reads them. This
  // is what turns bland cloud noise into something with filaments and eddies.
  vec2 drift = vec2(uTime * 0.012, uTime * -0.008); // never fully still
  vec2 p = uv * 1.6 + drift;

  vec2 warp = vec2(
    fbm(p + vec2(0.0, uFlow * 0.35)),
    fbm(p + vec2(5.2, 1.3) - vec2(uFlow * 0.28, 0.0))
  );

  // Warp strength tracks the low end, so bass — when there is any — thickens
  // and curls the structure rather than just brightening it.
  float warpAmount = 0.45 + 1.10 * uLow + 0.35 * uLevel;
  float field = fbm(p + warp * warpAmount + vec2(uFlow * 0.18, 0.0));

  // --- spectral rings ------------------------------------------------------
  // The scalar bands say how much; the spectrum texture says what shape. Map
  // radius to frequency so the bass sits at the centre and the top end at the
  // rim, and let the highs decide how much of it shows.
  float specSample = texture2D(uSpectrum, vec2(clamp(radius * 0.85, 0.0, 1.0), 0.5)).r;
  float rings = sin(radius * 34.0 - uFlow * 1.4 + angle * 0.5) * 0.5 + 0.5;
  field += rings * specSample * (0.05 + 0.22 * uHigh);

  // --- transients ----------------------------------------------------------
  // An onset pushes a soft ripple outward from the centre instead of flashing
  // the whole frame. Sparse broadband hits over a quiet floor was the texture
  // of the reference, and a full-frame flash reads as a beat that isn't there.
  float ripple = sin(radius * 18.0 - uTransient * 9.0) * exp(-radius * 2.2);
  field += ripple * uTransient * 0.30;

  // --- shading -------------------------------------------------------------
  float energy = clamp(uLevel * 1.15 + uTransient * 0.25, 0.0, 1.0);

  // Contrast opens up with energy: near-silence is a flat, almost featureless
  // dark, and the structure resolves as sound arrives.
  float t = clamp((field - 0.5) * (1.1 + 1.9 * energy) + 0.5, 0.0, 1.0);
  vec3 col = palette(t, energy);

  // A dim core that swells with the mids — the eye needs somewhere to rest.
  col += vec3(0.10, 0.14, 0.20) * uMid * exp(-radius * 2.6);

  // Vignette. Slightly tighter when quiet, so the frame closes in.
  col *= smoothstep(1.25, 0.18, radius * (1.18 - 0.16 * energy));

  // Overall lift, floored well above zero: never a fully black screen, which on
  // a phone is indistinguishable from a crash. 0.30 was measured against
  // silence and came out at roughly RGB 0.02 — technically not black, visually
  // indistinguishable from it.
  col *= 0.42 + 0.58 * energy;
  col += vec3(0.016, 0.019, 0.030);

  // Ordered-ish dither. Dark gradients band badly on 8-bit phone panels and
  // this is almost entirely dark gradients; a sub-LSB of noise costs nothing
  // and removes the contour rings completely.
  float grain = hash(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5;
  col += grain / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
