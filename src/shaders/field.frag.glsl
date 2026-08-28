// Nocturnal field: domain-warped fractal noise, lit from within by whatever the
// microphone is hearing.
//
// Everything drives it on a deliberately different timescale:
//
//   uTransient  ~0.2s   ripples struck outward from the centre
//   uFlow       ~0.3s   motion, integrated from level — quiet coasts, loud churns
//   uBreak      ~0.5s   the sound dropping below its own recent norm
//   uTilt       ~2.5s   colour, from spectral balance
//   uRoughness  ~2s     fractal character, from the spectrum's 1/f exponent
//   uNovelty    ~10s    structural boundaries, via self-similarity
//   uHistory    ~8.5s   the last few seconds, as a polar spectrogram
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
uniform float uNovelty;   // 0-1, structural boundary (see features.ts)
uniform float uRoughness; // 0-1, from the spectrum's 1/f exponent
uniform sampler2D uSpectrum;
uniform sampler2D uHistory;   // rolling spectrogram: x = time, y = log frequency
uniform float uHistoryHead;   // where "now" is in the ring buffer, 0-1
uniform vec4 uSeed;           // re-rolled on demand; see scene.ts

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
// mid-range phone, which is not a trade worth making at this size. This runs
// three times per pixel (twice for the warp, once for the field) and is by far
// the dominant cost in the shader.
//
// `gain` is how much each successive octave contributes: 0.5 is classic pink
// fbm, lower is smooth and blobby, higher is rough and detailed. It is driven
// by the measured 1/f exponent of the audio, so the visual field's fractal
// character tracks the sound's. Dark smooth music renders as smooth structure;
// bright noisy music renders as fine detail. That correspondence is the whole
// reason for measuring the spectral slope at all.
float fbm(vec2 p, float gain) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8); // rotate between octaves to break axis alignment

  for (int i = 0; i < 4; i++) {
    sum += amp * noise(p);
    norm += amp;
    p = rot * p * 2.02;
    amp *= gain;
  }
  // Normalised so changing `gain` alters texture without also changing overall
  // brightness — otherwise roughness would read as a volume change.
  return sum / norm;
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

// Rotates a colour's hue while leaving its composition intact — the standard
// CSS-filter hue-rotate matrix. Used for uSeed rather than the audio uniforms:
// rotating the *whole* rendered image together is a coherent "different mood"
// each time you ask for one, which is not the same operation as mixing two
// colours into each other (that is what the palette() ramps are for, and
// mixing complementaries there is exactly the mistake that muddies Lattice —
// see lattice.frag.glsl).
vec3 hueRotate(vec3 col, float angle) {
  float u = cos(angle), w = sin(angle);
  mat3 m = mat3(
    0.299 + 0.701 * u + 0.168 * w, 0.587 - 0.587 * u + 0.330 * w, 0.114 - 0.114 * u - 0.497 * w,
    0.299 - 0.299 * u - 0.328 * w, 0.587 + 0.413 * u + 0.035 * w, 0.114 - 0.114 * u + 0.292 * w,
    0.299 - 0.300 * u + 1.250 * w, 0.587 - 0.588 * u - 1.050 * w, 0.114 + 0.886 * u - 0.203 * w
  );
  return clamp(m * col, 0.0, 1.0);
}

void main() {
  // Aspect-corrected, centred coordinates. Using the shorter side as the unit
  // keeps the composition identical in portrait and landscape.
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

  float radius = length(uv);

  // A break pulls the whole composition inward, and the surge on re-entry
  // throws it back out. This is the most legible signal on the screen because
  // it moves everything at once rather than changing a shade.
  float zoom = 1.0 + uBreak * 0.30 - uSurge * 0.22;
  uv *= zoom;
  radius *= zoom;

  // Whole-composition spin from the seed. Radius-based effects (rings,
  // ripple, vignette) do not care, but it re-orients which screen direction
  // the polar spectrogram's frequency axis lands on, and rotates the rings'
  // angle term — a free source of variety that costs nothing structural.
  // Computed from the spun uv, not the original, so it actually takes effect.
  float seedSpin = uSeed.z * 6.283185;
  float ss = sin(seedSpin), sc = cos(seedSpin);
  uv = mat2(sc, -ss, ss, sc) * uv;
  float angle = atan(uv.y, uv.x);

  // --- domain warp ---------------------------------------------------------
  // Two fbm lookups displace the coordinates before the third reads them. This
  // is what turns bland cloud noise into something with filaments and eddies.
  // uSeed.xy shifts where in the noise field we're reading from, so a
  // randomise call is a genuinely different patch of filament and eddy, not a
  // recoloured version of the same one.
  vec2 drift = vec2(uTime * 0.012, uTime * -0.008); // never fully still
  vec2 p = uv * 1.6 + drift + uSeed.xy * 41.0;

  float gain = 0.34 + 0.30 * uRoughness;

  vec2 warp = vec2(
    fbm(p + vec2(0.0, uFlow * 0.35), gain),
    fbm(p + vec2(5.2, 1.3) - vec2(uFlow * 0.28, 0.0), gain)
  );

  // Warp strength tracks the low end, so bass thickens and curls the structure
  // rather than only brightening it.
  float warpAmount = 0.45 + 1.30 * uLow + 0.55 * uLevel;
  float field = fbm(p + warp * warpAmount + vec2(uFlow * 0.18, 0.0), gain);

  // --- spectral rings ------------------------------------------------------
  // The scalar bands say how much; the spectrum texture says what shape. Map
  // radius to frequency so bass sits at the centre and the top end at the rim,
  // and let the highs decide how much of it shows.
  float specSample = texture2D(uSpectrum, vec2(clamp(radius * 0.85, 0.0, 1.0), 0.5)).r;
  // The angle term needs a whole-number coefficient. atan() returns (-PI, PI],
  // so `angle` jumps by 2PI across the -x axis, and only an integer multiple of
  // it survives that jump inside sin(). At 0.5 the phase jumped by PI instead
  // and the rings broke along a straight line from the centre out to the left
  // edge — one of the two seams this file used to draw. At 1.0 it is a
  // single-armed spiral and continuous the whole way round.
  float rings = sin(radius * 34.0 - uFlow * 1.4 + angle) * 0.5 + 0.5;
  field += rings * specSample * (0.06 + 0.30 * uHigh);

  // --- history: a polar spectrogram ---------------------------------------
  // Radius is time into the past, angle is log frequency. The last ~8 seconds
  // are on screen at once, so a beat becomes a shell expanding outward and a
  // section of the track becomes a visible band of texture. This is what the
  // rolling GPU texture buys: every pixel reads a different moment of history
  // in a single fetch, which no amount of CPU work could reproduce per frame.
  float age = clamp((radius - 0.12) / 1.05, 0.0, 1.0);

  // Frequency is folded across the circle rather than wrapped once around it.
  // The history texture's y axis does not wrap — row 0 is the bass and the last
  // row the top octave — so running it once around butts those two ends against
  // each other along atan()'s branch cut and draws a hard radial seam from the
  // centre out to the left edge. That was the most visible thing in this view,
  // present at every level and at every viewport size. abs(angle)/PI runs the
  // axis out and back again, so each end of it only ever meets itself.
  float freqAxis = abs(angle) / PI;

  // ...and then jittered by the warp field, because the axis is coarse in a way
  // that shows. scene.ts spaces its 64 rows logarithmically over 128 spectrum
  // bins, so the lowest nine rows read bin 1 alone and the tenth spans bins 1
  // and 2 — ten rows sharing essentially one value, an eighth of the frame
  // wide, with dead-straight rays down its edges where the row index steps. Displacing the lookup by noise we have
  // already computed makes those boundaries wander instead of radiate, which is
  // the difference between weather and a pie chart. 0.09 is about six rows peak
  // to peak: much less and the rays are still recognisably straight, much more
  // and the frequency ordering — the reason for drawing this in polar at all —
  // stops being readable.
  freqAxis = clamp(freqAxis + (warp.x - 0.5) * 0.09, 0.0, 1.0);

  // Walk backwards from the write head, wrapping — the texture repeats in x.
  float pastX = uHistoryHead - age;
  float past = texture2D(uHistory, vec2(pastX, freqAxis)).r;

  // Fades with age so the present stays dominant and old material becomes a
  // texture rather than competing for attention — and fades out again at the
  // very centre. `age` is clamped, so every pixel inside r = 0.12 reads the
  // newest column at full weight and the middle of the frame was a hard-edged
  // wheel of the current spectrum with a notch cut where the spectrum was
  // quiet. 0.17 is just past where the clamp releases, so the plateau is gone
  // before the history is at strength; below about 0.13 the wheel's edge comes
  // back, and much above 0.2 the recent past is missing from the middle of the
  // frame, which is where the eye is.
  field += past * (1.0 - age) * smoothstep(0.0, 0.17, radius) * (0.20 + 0.45 * uLevel);

  // --- transients ----------------------------------------------------------
  // An onset pushes a ripple outward from the centre instead of flashing the
  // frame. A full-frame flash reads as a beat marker; this reads as the field
  // being struck.
  float ripple = sin(radius * 18.0 - uTransient * 9.0) * exp(-radius * 2.2);
  field += ripple * uTransient * 0.45;

  // --- shading -------------------------------------------------------------
  float energy = clamp(uLevel * 1.05 + uTransient * 0.35 + uSurge * 0.5, 0.0, 1.0);

  // A structural boundary rotates the palette rather than flashing it. The
  // colour arrives somewhere new and stays there, which is what a section
  // change feels like; a flash would just read as another beat.
  float tilt = clamp(uTilt + uNovelty * 0.35, 0.0, 1.0);

  // Contrast opens up with energy: near-silence is a flat, almost featureless
  // dark, and structure resolves as sound arrives.
  float expanded = (field - 0.5) * (1.1 + 2.3 * energy) + 0.5;

  // ...and then the top is rolled off instead of clipped. Everything above adds
  // into `field` — the rings, the history, the transient ripple — so at a loud
  // moment most of the frame arrives here already past 1.0, and the clamp()
  // that used to be here left whole regions with no modelling in them at all —
  // saturated to the same palette colour, carrying only the vignette's gradient
  // across them. At uLevel 0.75 that was most of the lower half of the frame,
  // as a single flat wash; with the knee it is modelled the whole way up. The
  // share of the frame whose local luminance range is one code or less over an
  // 8px neighbourhood measured 4.9% before and 3.5% after, but treat those as
  // indicative only: the probe cannot be made reproducible (uTime and uFlow
  // keep advancing, so no two runs read the same patch of noise) and repeats of
  // one build spread several points. The flat wash is obvious by eye, which is
  // the evidence that actually settled this. Note that counting repeated RGB
  // triples will NOT find it — the dither at the end of main() puts the flat
  // region on several adjacent codes.
  //
  // Below KNEE this is exactly the straight line it replaces, and the two
  // pieces meet with the same slope, so nothing about the dark or the middle of
  // the picture moves; above it the curve approaches 1 without arriving and the
  // loud end keeps its modelling. Lower than 0.55 and the midtones start
  // compressing too, which flattens the ordinary case in order to fix the loud
  // one; higher and there is not enough curve left above the knee to hold the
  // highlights apart. 0.85 was tried and is not distinguishable from 0.55 at
  // the quiet end once the run-to-run spread above is accounted for, so the
  // lower value stays on the argument rather than on a measurement.
  const float KNEE = 0.55;
  float over = max(expanded - KNEE, 0.0);
  float t = clamp(min(expanded, KNEE) + (1.0 - KNEE) * over / (over + (1.0 - KNEE)), 0.0, 1.0);

  vec3 col = palette(t, energy, tilt);

  // --- depth -----------------------------------------------------------------
  // for no extra noise at all. warp.x is already a full fbm evaluation
  // of this patch, read at a different offset and drifting on uFlow * 0.35 in y
  // while the field it displaces drifts on uFlow * 0.18 in x — two layers of
  // the same medium moving at different rates, which is what parallax is. It
  // was only ever used as a displacement; reading it as a second deck as well
  // measured +1% frame time, inside the run-to-run noise. The honest version
  // would be an independent fourth fbm, and both ways of buying a genuinely new
  // noise layer were measured rather than assumed: at 1228x1706, four octaves
  // cost 1.70ms/frame, a fifth octave 1.91 and a fourth fbm 1.98 — +12% and
  // +16%. Neither is worth it when re-reading warp.x gets most of the picture.
  //
  // Multiplicative rather than additive, and the factor is zero-mean, so it
  // models the dark instead of washing it — an additive haze raises the floor
  // of every frame to buy structure in a few of them, and this is a nocturnal
  // thing on a dark ground. It is not quite mean-preserving in practice: warp.x
  // also feeds `field`, so it correlates with what it multiplies and the quiet
  // frame comes out a few code values brighter with this on than off. Small
  // enough to accept for what it buys, but it is a lift, not nothing.
  //
  // Weighted by (1 - t) so it is invisible where the near layer is lit and
  // carries the whole of the low end — both how a distant deck seen through a
  // near one behaves, and where the picture was previously a flat pedestal. 0.9
  // is +/-45% at the very bottom; at 0.4 the second deck is not visible as
  // structure, and past about 1.4 it reads as two fields fighting instead of
  // one behind the other. It can never reach zero, so nothing goes black here
  // that was not black already.
  col *= 1.0 + (warp.x - 0.5) * 0.9 * (1.0 - t);

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

  // The seed's remaining component rotates the finished image's hue as a
  // whole — a different mood on demand, without touching how the two ramps
  // above cross-fade against the music.
  col = hueRotate(col, uSeed.w * 6.283185);

  // Ordered-ish dither. Dark gradients band badly on 8-bit phone panels and
  // this is almost entirely dark gradients; a sub-LSB of noise costs nothing
  // and removes the contour rings completely.
  float grain = hash(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5;
  col += grain / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
