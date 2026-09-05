// "Strings" — a geometric-layer programme, and the first to put a hand on the
// mark rather than merely near it.
//
// Every other view here is a shape thrown from an origin: a ring (Circles), a
// splinter (Shards), a cell front (Grid), a spoke (Rose), or one of those same
// rings from somewhere else (Drift, Chorus, Tide). None of them is a thing
// you take hold of — a finger only ever tells them where to be born. This is
// a new mark, not another emitter variation (docs/todo.md entry 134): nine
// straight strings spanning the frame, each bound to its own slice of the
// spectrum, and a finger doesn't just spawn something near them — it BENDS
// one: pulls it taut, plucks it on release, or strums across several in a
// pass. The nine lanes are themselves a kind of fixed multi-origin (echoing
// Chorus's several fixed points), but that isn't the axis this entry is
// building on; direct manipulation is, and none of the other eight views
// have it.
//
// The picture. Nine hard lines run the full long axis, evenly spaced across
// the short one — portrait gives nine verticals, landscape nine horizontals,
// decided from uResolution with no orientation flag anywhere else in the
// project (Cells reads its own aspect the same way). String k is tuned to
// spectrum band k (bass at one edge, treble at the other — which edge is
// bass is a uSeed reroll), and its resting shape is a decaying standing wave,
// first mode by default:
//   x(y) = A * sin(pi*m*y/L) * cos(w*t) * exp(-t/tau)
// with w faster for the higher-tuned strings and tau = 1.4s (long enough to
// read as a note, short enough that six plucks in a row still stack
// legibly). In silence every string still hums at the tiny amplitude its
// band's current energy gives it, so the frame is never nine dead hairlines.
//
// Per-pixel cost. A pixel only ever belongs to its nearest lane — the gaps
// between lanes (about a ninth of the short axis) are far wider than
// anything drawn on them — so the standing-wave maths runs once per pixel,
// not nine times: the same trick Circles' wake ladder uses ("the one rule
// this pixel could possibly be on"). Finding which of the sixteen touch slots
// or eight audio slots is currently exciting that one lane is still an O(24)
// scan, the same budget Circles' own ripple loop already spends.
//
// The touch model — what a finger reads, and its limits. There is no live-
// finger uniform (docs/todo.md's own recon, shared with entries 135-136): the
// newest touch slot is the best available stand-in for "a finger is down
// right now", written every 0.15s while held (engine/emitter.ts). What the
// recon doesn't quite say, and what building this found: emitter.ts's own
// afterlife (2-4s, entry 102) keeps spawning on that exact same 0.15s
// cadence after release, with or without the gravity chip on — so age alone
// cannot tell a still-held finger from one that let go a second ago; it does
// not "go stale within two spawn intervals" by age by itself. What DOES fall,
// every step, is the level: a genuine hold's charge only rises (or holds
// steady mid-drag), while the afterlife's is releaseCharge times a shrinking
// fraction of its own remaining life. So "released" here is a level-drop
// found by walking the touch ring buffer backward through its own index
// order — which is spawn order, since spawnAt's cursor only ever increments —
// not a bit anyone actually wrote down. It is a heuristic and it has a known
// failure: a drag that slows abruptly enough, mid-hold, to drop the level by
// more than LEVEL_EPS between two consecutive spawns reads as an early
// release and fires a small premature pluck while the finger is still down.
// Fixing this properly wants a uniform the touch dispatcher writes directly,
// which is a stop-and-ask under this entry's own scope (CLAUDE.md: a new
// uniform is a conversation, not a quiet addition) — so it is disclosed here
// rather than pretended away.
//
// White, hard-edged, no colour — colour is the composite's RGB filter
// (geo-colour.ts), same as every sibling in this layer.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uBreak;
uniform vec4 uSeed;
uniform sampler2D uSpectrum;

// Must match MAX_RIPPLES in ripples.ts — GLSL can't import a JS constant, and
// a mismatch here means scene.ts uploads an array of the wrong length.
//
// Twenty-four: eight audio slots, sixteen touch slots in
// [AUDIO_RIPPLES, MAX_RIPPLES) — see ripples.ts.
const int MAX_RIPPLES = 24;
const int AUDIO_RIPPLES = 8;
const int TOUCH_RIPPLES = MAX_RIPPLES - AUDIO_RIPPLES;
uniform vec4 uRipples[MAX_RIPPLES];

const float PI = 3.14159265359;

// Nine, not six or twelve — Decided's own figure (docs/todo.md entry 134): at
// 360px, one lane per thumb width. Six is too sparse to strum across and
// twelve is thinner than a thumb can pick out.
const int N_STRINGS = 9;
const float SPACING = 1.0 / float(N_STRINGS); // of the short axis's own 1.0 span

// Seconds for a plucked string's envelope to fall to 1/e. A pluck should be
// audible-length, not a flash or a drone; six strums a second (a fast swipe
// across all nine) still stack legibly at this figure because each is nearly
// gone by the time the next lands.
const float TAU_DECAY = 1.4;

// Radians/second for string 0 (the bass-tuned end, wherever uSeed puts it),
// rising 2 rad/s per string — Decided's own figures. Faster strings visibly
// shimmer rather than merely nod, without approaching a strobe at 60fps.
const float OMEGA_BASE = 6.0;
const float OMEGA_STEP = 2.0;

// uv units: how close a finger has to land on a lane, at first contact, to
// grab it — about half a lane's own half-gap (SPACING*0.5 ~= 0.056), so a
// deliberate touch on a string catches it but a finger passing between two
// lanes on its way somewhere else does not.
const float GRAB_DIST = 0.05;

// Seconds: how old a touch slot may be and still count as "right now" for the
// live-finger read, rather than a trail already going cold. A little over
// twice SPAWN_INTERVAL (0.15s, emitter.ts) — a held finger refreshes well
// inside this, and true silence since the last touch clears it within a
// couple of frames.
const float LIVE_WINDOW = 0.35;

// Seconds: how close two touch slots' birth times must be to count as the
// same unbroken gesture, walking the ring buffer backward. Matches the
// consecutive-slot spacing entry 134's own recon describes for strumming.
const float CHAIN_GAP = 0.25;

// The level drop, walking backward through the touch chain one spawn at a
// time, that reads as "this is where the release happened" rather than
// ordinary jitter in a still-held drag's speed term. See the header's own
// disclosure: this is a heuristic, not an exact signal, and a large enough
// mid-hold slowdown can still trip it early.
const float LEVEL_EPS = 0.02;

float hash(float x) {
  return fract(sin(x * 127.1) * 43758.5453123);
}

// A hard-edged line, antialiased over roughly one pixel — same idiom as
// Circles' own ring(), just measuring a straight-line distance instead of a
// radius.
float line(float d, float halfWidth, float px) {
  return 1.0 - smoothstep(0.0, px * 1.5, d - halfWidth);
}

// Point-to-segment distance, for the pulled string's two straight spans.
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

// A lane's resting position across the short axis: nine even divisions of its
// own 1.0 span, jittered up to +-15% of the gap between them so a re-roll
// restructures the spacing rather than only the tuning (Decided). 15% of a
// 0.111 gap is +-0.017, well inside half the gap (0.056), so lanes never
// re-order.
float lanePos(int i) {
  float rest = -0.5 + (float(i) + 0.5) * SPACING;
  float jitter = (hash(float(i) * 17.0 + uSeed.w * 131.0) - 0.5) * 2.0 * 0.15 * SPACING;
  return rest + jitter;
}

// The previous touch slot in spawn order, wrapping within the touch band —
// spawnAt's own cursor only ever increments (ripples.ts), so index order
// inside [AUDIO_RIPPLES, MAX_RIPPLES) is time order for one unbroken run.
int touchPrev(int i) {
  int p = i - 1;
  if (p < AUDIO_RIPPLES) p += TOUCH_RIPPLES;
  return p;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float px = 1.0 / min(uResolution.x, uResolution.y);

  // No orientation flag anywhere else in the project — this reads
  // uResolution itself, once, the same way Cells reads its own aspect ratio.
  bool portrait = uResolution.x < uResolution.y;
  float longExtent = max(uResolution.x, uResolution.y) / min(uResolution.x, uResolution.y);
  float across = portrait ? uv.x : uv.y;
  float along = portrait ? uv.y : uv.x;
  float alongNorm = clamp((along + 0.5 * longExtent) / longExtent, 0.0, 1.0);

  bool bassAtNegative = uSeed.x < 0.5;

  // --- read the touch buffer once, for the whole frame -----------------------
  //
  // headIdx: the freshest touch slot — the best available stand-in for "a
  // finger is down, here" (see the header's own disclosure on its limits).
  int headIdx = AUDIO_RIPPLES;
  float headAge = 1e6;
  bool haveTouch = false;
  for (int i = AUDIO_RIPPLES; i < MAX_RIPPLES; i++) {
    float b = uRipples[i].x;
    if (b < -900.0) continue;
    float age = uTime - b;
    if (age < headAge) {
      headAge = age;
      headIdx = i;
      haveTouch = true;
    }
  }

  // Walk the ring buffer backward from the freshest slot. chainStart tracks
  // pure contiguity (how far back this unbroken gesture reaches, regardless
  // of level) and gives "where the finger first landed". releaseIdx wants
  // "where it last looked live" — and a first pass here locked onto the
  // *nearest* level-drop to head instead: emitter.ts's afterlife decays
  // fraction-of-remaining-life smoothly, so every consecutive pair inside it
  // drops by a similar amount and the very first step back from head already
  // qualifies. Fixed by not stopping there — keep extending releaseIdx
  // through the whole run of consecutive drops, and only settle once a step
  // stops dropping (that step's `prev` is back in the live plateau, so the
  // drop just before it was the true release). Confirmed against a direct
  // ripples.ts/emitter.ts simulation (a 0.33s hold, a yank, then release)
  // before trusting it in the shader: this now lands on the last genuinely
  // live spawn, not the first afterlife one.
  int chainStart = headIdx;
  int releaseIdx = headIdx;
  bool foundRelease = false;
  if (haveTouch) {
    int cur = headIdx;
    for (int step = 0; step < TOUCH_RIPPLES; step++) {
      int prev = touchPrev(cur);
      float bCur = uRipples[cur].x;
      float bPrev = uRipples[prev].x;
      if (bPrev < -900.0 || (bCur - bPrev) > CHAIN_GAP) break;
      chainStart = prev;
      bool decreased = uRipples[cur].y < uRipples[prev].y - LEVEL_EPS;
      if (decreased) {
        releaseIdx = prev;
        foundRelease = true;
      } else if (foundRelease) {
        break;
      }
      cur = prev;
    }
  }

  bool live = haveTouch && !foundRelease && headAge < LIVE_WINDOW;

  // Which lane the gesture grabbed, decided once at first contact and held
  // regardless of where the finger wanders after — Decided: "fixed at first
  // contact... even if the finger crosses others".
  float grabAcross = haveTouch ? (portrait ? uRipples[chainStart].z : uRipples[chainStart].w) : 0.0;
  int kGrab = 0;
  float bestGrabD = 1e6;
  for (int i = 0; i < N_STRINGS; i++) {
    float d = abs(grabAcross - lanePos(i));
    if (d < bestGrabD) {
      bestGrabD = d;
      kGrab = i;
    }
  }
  bool grabbed = haveTouch && bestGrabD < GRAB_DIST;
  bool pulling = grabbed && live;
  bool justReleased = grabbed && foundRelease;

  float fingerAcross = portrait ? uRipples[headIdx].z : uRipples[headIdx].w;
  float fingerAlong = portrait ? uRipples[headIdx].w : uRipples[headIdx].z;

  // --- which lane is this pixel nearest ---------------------------------------
  int k = 0;
  float bestD = 1e6;
  for (int i = 0; i < N_STRINGS; i++) {
    float d = abs(across - lanePos(i));
    if (d < bestD) {
      bestD = d;
      k = i;
    }
  }

  float ink = 0.0;

  // The standing wave for this pixel's own lane — skipped entirely while that
  // lane is the one currently pulled, since the bent shape below replaces it.
  if (!(pulling && k == kGrab)) {
    // bandIdx runs bass(0)->treble(N-1) by TUNING, independent of which
    // physical edge uSeed put the bass end on — so a re-roll swaps which side
    // of the screen is bass without changing which strings ring fast.
    int bandIdx = bassAtNegative ? k : (N_STRINGS - 1 - k);
    float band = (float(bandIdx) + 0.5) / float(N_STRINGS);
    float energy = texture2D(uSpectrum, vec2(band, 0.5)).r;
    float omega = OMEGA_BASE + OMEGA_STEP * float(bandIdx);

    // The hum: no decay, follows the room in real time, tiny — "px-scale" per
    // Decided, so it textures the resting line without ever reading as a
    // second, louder event beside an actual pluck.
    float humAmp = 0.01 * energy;
    float humDisp = humAmp * sin(PI * alongNorm) * cos(omega * uTime);

    // The strongest thing currently exciting this lane, picked by envelope
    // rather than summed — this layer's own max()-not-sum rule (see the
    // header), applied here to a signed displacement rather than an unsigned
    // ink: "strongest" has to mean "largest current envelope", not "largest
    // raw value", or an old, nearly-decayed pluck could win purely on sign
    // against a fresh one.
    float bestEnv = -1.0;
    float bestAmp = 0.0;
    float bestAge = 0.0;
    float bestMode = 1.0;

    for (int i = 0; i < MAX_RIPPLES; i++) {
      float birth = uRipples[i].x;
      if (birth < -900.0) continue;
      float age = uTime - birth;
      if (age < 0.0) continue;

      bool qualifies = false;
      float amp = 0.0;
      float mode = 1.0;

      if (i < AUDIO_RIPPLES) {
        // A loud hit plucks the bass end, a quiet one the treble end —
        // Decided's own mapping: a hit carries no position, and this keeps a
        // loud passage on the bass strings, which is where the eye expects
        // the weight to sit.
        float level = uRipples[i].y;
        float trebleIdx = bassAtNegative ? float(N_STRINGS - 1) : 0.0;
        float bassIdx = bassAtNegative ? 0.0 : float(N_STRINGS - 1);
        int targetK = int(clamp(floor(mix(trebleIdx, bassIdx, level) + 0.5), 0.0, float(N_STRINGS - 1)));
        if (targetK == k) {
          qualifies = true;
          amp = 0.06 * level;
          mode = 1.0;
        }
      } else {
        // Strum: this slot and the one immediately before it in spawn order
        // straddle this lane, and did so recently enough to be one drag
        // rather than two unrelated taps.
        int prevI = touchPrev(i);
        float bPrev = uRipples[prevI].x;
        if (bPrev > -900.0 && birth - bPrev >= 0.0 && birth - bPrev <= CHAIN_GAP) {
          float xPrev = portrait ? uRipples[prevI].z : uRipples[prevI].w;
          float xCur = portrait ? uRipples[i].z : uRipples[i].w;
          float lane = lanePos(k);
          if (sign(xPrev - lane) != sign(xCur - lane)) {
            qualifies = true;
            amp = 0.04 * uRipples[i].y;
            mode = 1.0;
          }
        }
        // Release: exactly one slot in the whole buffer can be releaseIdx.
        if (!qualifies && justReleased && i == releaseIdx && k == kGrab) {
          float pullAcross = portrait ? uRipples[i].z : uRipples[i].w;
          float pullAlong = portrait ? uRipples[i].w : uRipples[i].z;
          float pullAlongNorm = clamp((pullAlong + 0.5 * longExtent) / longExtent, 0.0, 1.0);
          qualifies = true;
          amp = min(abs(pullAcross - lanePos(k)), 0.15);
          // 1 at the middle, up to 4 at an end — the physics a guitarist
          // knows, and free once mode is a parameter rather than fixed at 1.
          mode = 1.0 + floor(3.0 * (2.0 * abs(pullAlongNorm - 0.5)));
        }
      }

      if (!qualifies) continue;
      float env = amp * exp(-age / TAU_DECAY);
      if (env > bestEnv) {
        bestEnv = env;
        bestAmp = amp;
        bestAge = age;
        bestMode = mode;
      }
    }

    float pluckDisp = bestAmp * sin(PI * bestMode * alongNorm) * cos(omega * bestAge) * exp(-bestAge / TAU_DECAY);
    float displacement = humDisp + pluckDisp;

    float d = abs(across - (lanePos(k) + displacement));
    // A fresh, strongly plucked string is drawn heavier as well as brighter —
    // the same idiom Circles' proportional stroke uses, so "loud" reads as
    // weight rather than only as brightness.
    float halfWidth = px * (0.6 + 10.0 * min(abs(displacement), 0.1));
    float lineInk = line(d, halfWidth, px);
    ink = lineInk * (0.55 + 0.45 * min(abs(displacement) * 30.0, 1.0));
  }

  // The pulled string: two straight segments from each end to the fingertip,
  // drawn independently of which lane a pixel is nearest to, since the bend
  // travels wherever the finger does and that is very often nowhere near its
  // own resting lane. Two segments, not a curve — a pulled string is tension,
  // and tension reads as a corner (Decided).
  if (pulling) {
    float restAcross = lanePos(kGrab);
    vec2 p = vec2(along, across);
    vec2 endA = vec2(-0.5 * longExtent, restAcross);
    vec2 tip = vec2(fingerAlong, fingerAcross);
    vec2 endB = vec2(0.5 * longExtent, restAcross);
    float d = min(segDist(p, endA, tip), segDist(p, tip, endB));
    float bentInk = line(d, px * 0.75, px);
    ink = max(ink, bentInk * 0.95);
  }

  // A break thins the ink rather than draining colour — there is none here.
  ink *= 1.0 - uBreak * 0.55;

  gl_FragColor = vec4(vec3(clamp(ink, 0.0, 1.0)), 1.0);
}
