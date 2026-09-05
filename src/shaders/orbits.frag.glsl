// "Orbits" — docs/todo.md entry 135, a variation on the *emitter*, not the
// mark. Circles / Shards / Grid / Rose (and their own variations) are all a
// shape thrown from an origin that expands and dies at the rim; Drift,
// Chorus and Tide move that origin but keep the shape and the "born, grows,
// gone" lifecycle. Orbits keeps neither: a hit is a small circle that is
// *born already at its final size* and never grows — what changes over its
// life is its position, swinging round the frame's centre on a real Kepler
// ellipse, leaving a short arc of its own recent path behind it. Nothing
// else in this layer has a body that *moves* rather than expands.
//
// The two rules every geometric view here answers to still hold: hard-edged
// strokes (no falloffs), and white ink only — colour is the composite's own
// RGB filter (geo-colour.ts), same as every sibling.
//
// The physics, and why it needed a headless probe before it went anywhere
// near this file. A body's angular rate is Kepler's third law dressed as a
// constant: ω(r) = K / r^1.5 for a *circular* orbit at radius r, matching the
// entry's own figure (K = 1.6). That same K is a full two-body gravitational
// parameter in disguise — mu = K^2 — so a flung body (finger position *and*
// drag velocity, both real) isn't a separate special case; it's the general
// two-body orbit through that state under the same mu, of which every
// circular body here is the e=0 special case. That is worth having, because
// it is the only way "closed form" is actually true rather than a phrase:
// standard orbital-mechanics closed form (orbital elements from a state
// vector, then Kepler's equation solved by Newton's method for position at
// any later time), verified against an independent RK4 integration of the
// literal two-body equation of motion in a throwaway script
// (scratchpad, not checked in) before any of this was trusted in a shader
// that cannot be single-stepped. That script caught two real bugs this
// comment records because the next person touching this needs to know they
// are load-bearing, not decoration:
//
//   1. Capping eccentricity by holding the semi-major axis `a` fixed and
//      inflating the tangential speed can silently place the fling's own
//      start position *outside* the resulting ellipse (past its apoapsis) —
//      not a small error, a different curve, wrong from age zero. The fix
//      clamps the tangential/radial *inputs* before anything is derived from
//      them (a floor on tangential speed, a matching ceiling on radial
//      speed, both solved in closed form for "eccentricity first reaches the
//      cap"), so whatever comes out has already, by construction, passed
//      through the fling's own position.
//   2. Mean anomaly must be propagated in the orbit's own rotational frame
//      (always advancing) and mapped to the world's fixed anticlockwise
//      frame only once, via the orbit's own spin sign — propagating it
//      directly in world angle is right for one spin direction and silently
//      backwards for the other, and the error nearly *cancels once every
//      orbital period* (both directions return to the same point), so a
//      probe that only checks whole periods would have shipped it.
//
// Eccentricity is capped at 0.92 — Decided's parameters allow a genuinely
// near-radial fling to approach e=1, a needle-thin ellipse whose periapsis
// passage is both a visual spike (the body crosses most of its arc in a
// couple of frames) and a numerical one (Newton's own solve for eccentric
// anomaly degrades as e -> 1; the verification script needed millions of
// RK4 steps to resolve a periapsis at e=0.99 at all). A fast, near-radial
// throw still swings out near the rim and back, exactly as Decided asks; it
// no longer threads a needle at the centre to do it.
//
// Per-pixel cost. Twenty-four ripple slots, each one ring (the body) plus
// one arc test (the trail) against this pixel's own polar position — no
// nested loop over the ladder the way Circles' wake needs, because a body
// has nothing standing between hits the way a wake ladder does. The
// eight audio and any non-flung touch slots are pure circular formulae (no
// Newton solve at all); only a slot with genuine drag data pays the six
// Newton iterations, and there are at most sixteen of those.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uBreak;
uniform vec4 uSeed;
uniform float uMoonLife; // docs/todo.md entry 96 — lifespan multiplier, same as every other ripple-drawing view

// Must match MAX_RIPPLES in ripples.ts — GLSL can't import a JS constant, and
// a mismatch here means scene.ts uploads an array of the wrong length.
const int MAX_RIPPLES = 24;
const int AUDIO_RIPPLES = 8;
const int TOUCH_RIPPLES = MAX_RIPPLES - AUDIO_RIPPLES;
uniform vec4 uRipples[MAX_RIPPLES];

const float PI = 3.14159265359;

// K in ω_circ(r) = K * r^-1.5 (Decided's own figure) — and, doubled, the
// whole two-body gravitational parameter every flung ellipse is solved
// under: mu = K^2, so a circular body and a flung one obey the same law,
// not two different ones that happen to agree at e=0.
const float K_GRAV = 1.6;
const float MU = K_GRAV * K_GRAV;

// No orbit is allowed to reach here — see the header's own note on why a
// near-radial fling is capped rather than allowed to approach 1.
const float MAX_E = 0.92;

// Seconds from birth to vanishing, and the fraction of that life where the
// fade-out begins — Circles' own figures, reused because Decided asks for
// "like Circles'" rather than a new pair.
const float LIFESPAN = 3.2;
const float FADE_FROM = 0.6;

// Radius below which a fling's own start position (or an audio body's
// formula radius) is clamped before it reaches K_GRAV's -1.5 power or an
// orbital-mechanics divide — the audio radius formula (0.12 to 0.67) never
// approaches this, but a tap near dead centre would.
const float R_MIN = 0.04;

// Seconds of birth-gap that still counts as one unbroken drag rather than
// two unrelated touches — Strings' own CHAIN_GAP (entry 134), reused for the
// same reason: it is already tuned against emitter.ts's 0.15s/0.05uv spawn
// cadence, and a second number here would only be able to drift from it.
const float CHAIN_GAP = 0.25;

// How old the freshest touch slot may be and still stand in for "a finger is
// down right now" — the entries' own shared recon (135's header): a held
// finger refreshes this every 0.15s, so a bit over twice that clears a still
// hold while a lifted finger goes stale within two spawn intervals.
const float LIVE_WINDOW = 0.3;

// The body radius, small and constant — it does not grow or shrink over its
// life the way every other view's mark does, which is the entire point of
// this axis (Decided/the entry's own figures).
const float BODY_R_BASE = 0.012;
const float BODY_R_LEVEL = 0.02;

// Reference radius for the trail's own arc-length-not-angle scaling, tied to
// the resting body's own orbit below (REST_R) rather than picked
// separately — a body sitting at that radius gets exactly the base angle
// Decided names (25-60 degrees, uSeed's own re-roll), and a body nearer or
// farther gets a wider or narrower angle so the arc it actually paints on
// screen stays roughly the same length. Clamped in degrees so a body very
// near the centre does not unfold into most of a circle, and one near the
// rim does not thin to nothing.
const float REF_R = 0.3;
const float TRAIL_MIN = 0.14; // radians, ~8 degrees
const float TRAIL_MAX = 1.57; // radians, ~90 degrees

// The resting body's own orbit radius and size — Decided's "sun", present
// regardless of any hit so the frame is never black. Not gated on silence:
// it is cheap, and drawing it unconditionally is simpler than a fade nobody
// asked for, and no other body ever sits exactly at this radius.
const float REST_R = REF_R;
const float REST_BODY_R = 0.008;

float hash(float x) {
  return fract(sin(x * 127.1) * 43758.5453123);
}

// A hard-edged ring, antialiased over roughly one pixel — Circles' own idiom.
float ring(float dist, float radius, float halfWidth, float px) {
  float d = abs(dist - radius) - halfWidth;
  return 1.0 - smoothstep(0.0, px * 1.5, d);
}

// Wraps an angle to (-pi, pi].
float wrapAngle(float a) {
  return mod(a + PI, 2.0 * PI) - PI;
}

// The previous touch slot in spawn order, wrapping within the touch band —
// spawnAt's own cursor only ever increments (ripples.ts), so index order
// inside [AUDIO_RIPPLES, MAX_RIPPLES) is time order for one unbroken run.
// Strings' own touchPrev (entry 134), copied rather than shared — no import
// between GLSL files exists.
int touchPrev(int i) {
  int p = i - 1;
  if (p < AUDIO_RIPPLES) p += TOUCH_RIPPLES;
  return p;
}

// Reshapes a raw drag velocity so its tangential component always points the
// system's own way (spinSign, uSeed's own re-roll) — Decided: "prograde for
// every body". The radial component (in/out, from the actual swipe) is left
// alone; only the sign of the tangential part is forced, its magnitude kept.
vec2 forceProgradeVelocity(vec2 r0, vec2 v0, float spinSign) {
  float r0mag = max(length(r0), R_MIN);
  vec2 rhat = r0 / r0mag;
  vec2 rperp = vec2(-rhat.y, rhat.x); // world anticlockwise perpendicular
  float vr = dot(v0, rhat);
  float vt = abs(dot(v0, rperp)) * spinSign;
  return vr * rhat + vt * rperp;
}

// A real two-body orbit through (r0, v0) under MU — see the header's own
// account of the two mistakes fixed here before this was trusted. Angles
// (argPeriOrbit, and nu/M inside orbitStateAtAge below) live in the orbit's
// own rotational frame, which always advances forward; spinSign is the only
// place that frame is mapped onto the world's fixed anticlockwise one.
struct Orbit {
  float a;
  float e;
  float argPeriOrbit;
  float m0;
  float n;
  float spinSign;
};

Orbit orbitFromFling(vec2 r0, vec2 v0) {
  float r0mag = max(length(r0), R_MIN);
  vec2 rhat = r0 / r0mag;
  vec2 rperp = vec2(-rhat.y, rhat.x);
  float rawVr = dot(v0, rhat);
  float rawVt = dot(v0, rperp);

  // Eccentricity cap — clamp the inputs, not anything derived from them (see
  // the header). vtFloor and vrCeiling both come from solving vis-viva
  // (v^2 = mu(2/r - 1/a)) together with h = r0*vt and e^2 = 1 - h^2/(mu a)
  // for the boundary case e == MAX_E: vtFloor at vr=0 (the smaller root),
  // vrCeiling at whatever vt cleared that floor (which guarantees the
  // ceiling is >= 0, since the floor is exactly the point where it hits 0).
  float vtFloor2 = (MU / r0mag) * (1.0 - MAX_E);
  float vtSign = rawVt < 0.0 ? -1.0 : 1.0;
  float vt = vtSign * sqrt(max(rawVt * rawVt, vtFloor2));
  float vrCeiling2 = max(
    0.0,
    2.0 * MU / r0mag - vt * vt - (MU * MU * (1.0 - MAX_E * MAX_E)) / (r0mag * r0mag * vt * vt)
  );
  float vrSign = rawVr < 0.0 ? -1.0 : 1.0;
  float vr = vrSign * min(abs(rawVr), sqrt(vrCeiling2));

  float v2 = vr * vr + vt * vt;
  float energy = 0.5 * v2 - MU / r0mag;
  float a = -MU / (2.0 * energy); // > 0 always: e <= MAX_E < 1 makes every orbit bound by construction
  float h = r0mag * vt;
  float e = sqrt(max(0.0, 1.0 - (h * h) / (MU * a)));
  float theta0 = atan(r0.y, r0.x);
  float spinSign = vt < 0.0 ? -1.0 : 1.0;

  float argPeriOrbit;
  float m0;
  if (e < 1.0e-3) {
    argPeriOrbit = theta0;
    m0 = 0.0;
  } else {
    float cosNu0 = clamp((a * (1.0 - e * e)) / r0mag / e - 1.0 / e, -1.0, 1.0);
    float nu0 = acos(cosNu0); // orbital-frame true anomaly at birth, in [0, pi]
    if (vr < 0.0) nu0 = -nu0; // falling toward periapsis is negative nu, direction-agnostic
    argPeriOrbit = theta0 - spinSign * nu0;
    float cosE0 = (e + cosNu0) / (1.0 + e * cosNu0);
    float sinE0 = (sqrt(max(0.0, 1.0 - e * e)) * sin(nu0)) / (1.0 + e * cosNu0);
    float e0 = atan(sinE0, cosE0);
    m0 = e0 - e * sinE0;
  }
  float n = K_GRAV * pow(a, -1.5); // = sqrt(mu/a^3) — a is always > 0, so this never hits pow's own NaN case

  Orbit o;
  o.a = a;
  o.e = e;
  o.argPeriOrbit = argPeriOrbit;
  o.m0 = m0;
  o.n = n;
  o.spinSign = spinSign;
  return o;
}

// Position (as radius, world angle) at a given age, for a flung (elliptical)
// body. Six Newton iterations from Broucke's own improved starting guess,
// E0 = M + e*sin(M) — the textbook E0 = M overshoots badly near periapsis at
// high eccentricity (a residual of 0.49 rad survived six iterations from it
// at e=0.99 in the verification script) where Broucke's guess converges to
// under 1e-6 across the whole eccentricity range this file allows.
vec2 orbitStateAtAge(Orbit o, float age) {
  float m = o.m0 + o.n * age; // orbital frame — n is always positive
  float e = o.e;
  float en = m + e * sin(m);
  for (int i = 0; i < 6; i++) {
    en -= (en - e * sin(en) - m) / (1.0 - e * cos(en));
  }
  float r = o.a * (1.0 - e * cos(en));
  float cosNu = (cos(en) - e) / (1.0 - e * cos(en));
  float sinNu = (sqrt(max(0.0, 1.0 - e * e)) * sin(en)) / (1.0 - e * cos(en));
  float nu = atan(sinNu, cosNu); // orbital frame
  float theta = o.argPeriOrbit + o.spinSign * nu; // mapped into world only here
  return vec2(r, theta);
}

// A circular body — the e=0 special case, taken directly rather than
// through the general machinery above: no Newton solve, and it is what
// every audio body and every non-flung touch (a plain tap, no drag data) is.
vec2 circularStateAtAge(float r, float theta0, float spinSign, float age) {
  float omega = K_GRAV * pow(max(r, R_MIN), -1.5);
  return vec2(r, theta0 + spinSign * omega * age);
}

// The ellipse's own polar radius at a given *world* angle — used to test
// whether this pixel sits on the curve at all, independent of where the body
// currently is. r(nu) = a(1-e^2)/(1+e*cos(nu)) in the orbital frame; cos is
// even, so mapping world angle to nu (nu = spinSign*(phi-argPeri)) can be
// dropped straight into the cosine without the spinSign multiply surviving —
// cos(spinSign*x) == cos(x) regardless of spinSign's sign.
float ellipseRadiusAt(Orbit o, float phi) {
  return o.a * (1.0 - o.e * o.e) / (1.0 + o.e * cos(phi - o.argPeriOrbit));
}

// Trail visibility for a pixel at (rho, phi) against a body currently at
// (bodyR, bodyTheta) moving in direction spinSign: positive, within
// `window` radians, exactly when phi is an angle the body already swept
// through (not one still ahead of it) — verified sign convention: for
// spinSign=+1 theta increases with age, so an earlier (already-passed)
// angle is smaller, making bodyTheta-phi positive; for spinSign=-1 theta
// decreases, so an earlier angle is larger, and multiplying by spinSign
// flips it positive the same way. One formula, both directions.
float trailFade(float bodyTheta, float phi, float spinSign, float window) {
  float behind = spinSign * wrapAngle(bodyTheta - phi);
  if (behind < 0.0 || behind > window) return 0.0;
  return 1.0 - behind / window;
}

// Arc-length-constant trail window — see REF_R's own comment. `baseAngle` is
// uSeed's own re-roll (25-60 degrees, Decided), and TRAIL_MIN/MAX keep a body
// very near the centre or very near the rim from unfolding into most of a
// circle or thinning to nothing.
float trailWindow(float r, float baseAngle) {
  return clamp(baseAngle * REF_R / max(r, 0.05), TRAIL_MIN, TRAIL_MAX);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float px = 1.0 / min(uResolution.x, uResolution.y);
  float rho = length(uv);
  float phi = atan(uv.y, uv.x);

  // Decided: a re-roll flips the whole system's rotation direction and the
  // trail's own base length together, restructuring the view rather than
  // merely retiming it — the same "one re-roll, several consequences" habit
  // Drift's path and Chorus's node count already use.
  float spinSignGlobal = uSeed.x < 0.5 ? 1.0 : -1.0;
  float baseAngle = radians(mix(25.0, 60.0, uSeed.y));

  float lifespan = LIFESPAN * uMoonLife;

  // The live finger — the newest touch slot young enough to still be "right
  // now" rather than a trail already going cold (see LIVE_WINDOW's own
  // comment, and the entries' shared recon this file's header cites).
  bool haveFinger = false;
  vec2 fingerPos = vec2(0.0);
  float bestAge = 1.0e6;
  for (int i = AUDIO_RIPPLES; i < MAX_RIPPLES; i++) {
    float b = uRipples[i].x;
    if (b < -900.0) continue;
    float age = uTime - b;
    if (age < bestAge) {
      bestAge = age;
      fingerPos = uRipples[i].zw;
      haveFinger = age < LIVE_WINDOW;
    }
  }

  float ink = 0.0;

  // Audio bodies — always circular (Decided). Loudness sets *where* the
  // orbit sits, not how it grows: a loud hit lands close in and races
  // (Kepler's own r^-1.5), a quiet one drifts further out and slower.
  for (int i = 0; i < AUDIO_RIPPLES; i++) {
    float birth = uRipples[i].x;
    if (birth < -900.0) continue;
    float age = uTime - birth;
    if (age < 0.0 || age > lifespan) continue;
    float level = uRipples[i].y;

    float r = 0.12 + 0.55 * (1.0 - level);
    float theta0 = hash(birth) * 2.0 * PI;

    vec2 base = circularStateAtAge(r, theta0, spinSignGlobal, age);
    vec2 bodyPos = r * vec2(cos(base.y), sin(base.y));
    float speed = 1.0;
    if (haveFinger) {
      float d = length(bodyPos - fingerPos);
      speed = 1.0 + 0.8 * exp(-d / 0.15); // Decided's own figures — "reads as gravity"
    }
    vec2 st = circularStateAtAge(r, theta0, spinSignGlobal, age * speed);
    float bodyTheta = st.y;
    vec2 pos = r * vec2(cos(bodyTheta), sin(bodyTheta));

    float percent = age / lifespan;
    float fade = percent > FADE_FROM ? 1.0 - (percent - FADE_FROM) / (1.0 - FADE_FROM) : 1.0;
    float opacity = fade * (0.35 + 0.65 * level);

    float bodyR = BODY_R_BASE + BODY_R_LEVEL * level;
    float dBody = length(uv - pos);
    ink = max(ink, ring(dBody, bodyR, max(bodyR * 0.35, px * 0.6), px) * opacity);

    float window = trailWindow(r, baseAngle);
    float ringMask = ring(rho, r, px * 1.2, px);
    ink = max(ink, ringMask * trailFade(bodyTheta, phi, spinSignGlobal, window) * opacity);
  }

  // Touch bodies — a fling if the previous slot in spawn order is close
  // enough in time to be the same drag (Strings' own CHAIN_GAP test,
  // entry 134), a plain circular body otherwise: a tap carries no velocity
  // to fling with, and gets the same treatment an audio hit does, at its own
  // finger position rather than a hashed angle.
  for (int i = AUDIO_RIPPLES; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    if (birth < -900.0) continue;
    float age = uTime - birth;
    if (age < 0.0 || age > lifespan) continue;
    float level = uRipples[i].y;
    vec2 r0 = uRipples[i].zw;
    float r0mag = max(length(r0), R_MIN);

    int prevI = touchPrev(i);
    float bPrev = uRipples[prevI].x;
    bool chained = bPrev > -900.0 && (birth - bPrev) >= 0.0 && (birth - bPrev) <= CHAIN_GAP;

    float bodyR = BODY_R_BASE + BODY_R_LEVEL * level;
    vec2 pos;
    float bodyTheta;
    float orbitR;

    if (chained) {
      vec2 prevPos = uRipples[prevI].zw;
      vec2 v0 = (r0 - prevPos) / max(birth - bPrev, 1.0e-3);
      vec2 vProg = forceProgradeVelocity(r0, v0, spinSignGlobal);
      Orbit o = orbitFromFling(r0, vProg);

      vec2 base = orbitStateAtAge(o, age);
      vec2 basePos = base.x * vec2(cos(base.y), sin(base.y));
      float speed = 1.0;
      if (haveFinger) {
        float d = length(basePos - fingerPos);
        speed = 1.0 + 0.8 * exp(-d / 0.15);
      }
      vec2 st = orbitStateAtAge(o, age * speed);
      orbitR = st.x;
      bodyTheta = st.y;
      pos = orbitR * vec2(cos(bodyTheta), sin(bodyTheta));

      float window = trailWindow(orbitR, baseAngle);
      // The ellipse's own polar curve at this pixel's angle — an
      // approximation, the same idiom every ring() call here already makes
      // for a circle: distance is measured radially, not as the true
      // perpendicular distance to the curve, which is unnecessary at the
      // stroke widths this layer draws with.
      float curveR = ellipseRadiusAt(o, phi);
      float ringMask = ring(rho, curveR, px * 1.2, px);
      float percent = age / lifespan;
      float fade = percent > FADE_FROM ? 1.0 - (percent - FADE_FROM) / (1.0 - FADE_FROM) : 1.0;
      float opacity = fade * (0.35 + 0.65 * level);
      ink = max(ink, ringMask * trailFade(bodyTheta, phi, spinSignGlobal, window) * opacity);

      float dBody = length(uv - pos);
      ink = max(ink, ring(dBody, bodyR, max(bodyR * 0.35, px * 0.6), px) * opacity);
    } else {
      float theta0 = atan(r0.y, r0.x);
      vec2 base = circularStateAtAge(r0mag, theta0, spinSignGlobal, age);
      vec2 basePos = r0mag * vec2(cos(base.y), sin(base.y));
      float speed = 1.0;
      if (haveFinger) {
        float d = length(basePos - fingerPos);
        speed = 1.0 + 0.8 * exp(-d / 0.15);
      }
      vec2 st = circularStateAtAge(r0mag, theta0, spinSignGlobal, age * speed);
      bodyTheta = st.y;
      orbitR = r0mag;
      pos = orbitR * vec2(cos(bodyTheta), sin(bodyTheta));

      float percent = age / lifespan;
      float fade = percent > FADE_FROM ? 1.0 - (percent - FADE_FROM) / (1.0 - FADE_FROM) : 1.0;
      float opacity = fade * (0.35 + 0.65 * level);

      float window = trailWindow(orbitR, baseAngle);
      float ringMask = ring(rho, orbitR, px * 1.2, px);
      ink = max(ink, ringMask * trailFade(bodyTheta, phi, spinSignGlobal, window) * opacity);

      float dBody = length(uv - pos);
      ink = max(ink, ring(dBody, bodyR, max(bodyR * 0.35, px * 0.6), px) * opacity);
    }
  }

  // The resting body — Decided's "sun", present regardless of any hit so
  // silence is never a black frame. A plain circular orbit with no birth
  // time of its own; uTime itself is its age.
  {
    float omega = K_GRAV * pow(REST_R, -1.5);
    float theta = spinSignGlobal * omega * uTime;
    vec2 pos = REST_R * vec2(cos(theta), sin(theta));
    float dBody = length(uv - pos);
    ink = max(ink, ring(dBody, REST_BODY_R, px * 0.7, px) * 0.4);
  }

  // A fixed anchor at the centre — Decided's own figure, unmodulated by
  // anything (unlike Circles' breathing centre mark, which this entry does
  // not ask for).
  ink = max(ink, ring(rho, 0.02, px * 0.6, px) * 0.6);

  // A break thins the ink rather than draining colour — there is no colour
  // here to drain, same as every sibling in this layer.
  ink *= 1.0 - uBreak * 0.55;

  gl_FragColor = vec4(vec3(clamp(ink, 0.0, 1.0)), 1.0);
}
