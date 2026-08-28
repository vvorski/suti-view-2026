// "Spectrogram" — an atmospheric-layer programme.
//
// The one view here that is literally readable. Radius is time into the past,
// angle is log frequency: "now" is a point at the centre and the last ~8.5
// seconds spiral outward from it, so a phrase leaves a visible wake and you
// can see the shape of what just happened rather than only what is happening.
//
// Field and Lattice both *consume* the history texture — Field to tint by
// what came before, Lattice to modulate its shells — but neither draws it.
// This promotes it to the subject. It costs nothing extra to run: scene.ts
// already maintains the ring buffer (256 columns at 30Hz, 64 log-spaced
// frequency rows) for the other two.
//
// Reading it: bass sits at one angle and treble at another, so a sustained
// tone is a ray, a sweep is a spiral, and a drum hit is a full ring. Silence
// is a dark annulus that widens as it drifts out.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uFlow;
uniform float uLevel;
uniform float uLow;
uniform float uHigh;
uniform float uTilt;
uniform float uBreak;
uniform float uRoughness;
uniform vec4 uSeed;

uniform sampler2D uSpectrum;
uniform sampler2D uHistory;   // x = time (ring buffer), y = log frequency
uniform float uHistoryHead;   // where "now" sits in the buffer, 0-1

const float TAU = 6.28318530718;

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  float maxRadius = 0.5 * length(uResolution) / min(uResolution.x, uResolution.y);

  // Angle -> frequency. The seed rotates which way "bass" points, so a
  // re-roll re-orients the whole figure without changing what it means.
  float freqAxis = fract((angle / TAU) + 0.5 + uSeed.z);

  // Radius -> age. Squared so the recent past gets most of the screen area:
  // linear mapping crushes the last half-second into a dot at the centre,
  // which is exactly the part worth looking at.
  float t = clamp(dist / maxRadius, 0.0, 1.0);
  float age = t * t;

  // Walk backwards from the head. fract() handles the wrap for us.
  float past = texture2D(uHistory, vec2(fract(uHistoryHead - age), freqAxis)).r;

  // Two neighbouring rows, blended, so the frequency axis reads as continuous
  // rather than as 64 hard bands radiating out.
  float above = texture2D(uHistory, vec2(fract(uHistoryHead - age), fract(freqAxis + 0.015))).r;
  float energy = mix(past, above, 0.5);

  // Older data dims, so the figure has a clear "now" at its centre and fades
  // into the past rather than sitting at uniform brightness everywhere.
  float recency = 1.0 - t * 0.72;

  // Hue by frequency, which is the one mapping that makes the picture
  // legible: the same note is always the same colour.
  float hue = fract(uSeed.x + freqAxis * 0.62 + uTilt * 0.12);
  float sat = 0.78 - 0.30 * energy;   // loud goes toward white, not toward neon
  vec3 col = hsv2rgb(vec3(hue, sat, 1.0)) * pow(energy, 1.35) * recency * 1.9;

  // Faint spiral rules every second or so, as a time grid. Without them the
  // radius is uncalibrated and a wake has no sense of speed.
  float seconds = age * 8.5;
  float grid = smoothstep(0.90, 1.0, abs(fract(seconds) * 2.0 - 1.0));
  col += vec3(0.10, 0.13, 0.22) * grid * 0.30 * (1.0 - t);

  // The live spectrum as a bright core at the very centre, so "now" is a
  // distinct thing and not just the innermost pixels of the history.
  float live = texture2D(uSpectrum, vec2(freqAxis, 0.5)).r;
  col += hsv2rgb(vec3(hue, 0.55, 1.0)) * live * exp(-dist * dist * 120.0) * 1.6;

  // Rough, noisy material desaturates the whole figure a little — the same
  // gesture Field makes, so the two read as the same instrument.
  col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), uRoughness * 0.18);

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * 0.7, uBreak * 0.8);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
