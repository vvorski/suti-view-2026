// "Rose" — docs/todo.md entry 101, and the dual of Circles rather than a
// fourth variation on it (those keep the ring and move the emitter; this
// keeps the emitter and turns the ring into its own right angle).
//
// A ring is the locus of constant radius; a spoke is the locus of constant
// angle. Circles' rings are born at the centre and travel outward in radius.
// Rose's spokes are born at an angle and travel *in angle* — they sweep. That
// single substitution is the whole entry: the wake ladder, the touch
// behaviour, the double stroke, all fall out of transposing Circles'
// radius-based reasoning onto angle instead.
//
// The wake ladder is Circles' own argument rotated. Circles can have a
// standing radius ladder because every ring crosses the same set of radii,
// concentric with every other — the emitter never moves. Every one of Rose's
// spokes sweeps through the same set of *bearings* for the same reason — the
// centre never moves either — so the frame can carry a standing set of fine
// rules at fixed angles, lit as a spoke passes and fading afterwards. Between
// hits the picture says which directions were struck, and how long ago.
//
// One place the dual is not exact: Circles' rings travel outward once and
// stop (radius is bounded, monotonic), so a rung is crossed at most one time
// and "how long ago" is a single subtraction. A spinning spoke keeps sweeping
// past the same bearing every revolution, so this file's own closed form
// below has to find the *most recent* of several crossings, not the only
// one — the extra floor()/mod() Circles' own formula does not need is exactly
// that difference, not a departure from it. A dead ripple's spoke is treated
// as frozen at the angle it reached at the moment its own life ran out
// (`T = min(age, lifespan)` below), which is what stops the periodic
// crossings and lets the wake actually fade rather than pulsing forever on
// every later revolution a live spoke would have made.
//
// White and hard-edged like the rest of the layer; colour is an RGB filter
// applied afterwards (see geo-colour.ts). **Every tuning constant below not
// already Circles' own (LIFESPAN, FADE_FROM, OUTER_STROKE, INNER_STROKE,
// INNER_RADIUS, WAKE_TAU, WAKE_INK, WAKE_WEIGHT — all reused verbatim) is
// Mine.**

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uLevel;
uniform float uLow;
uniform float uBreak;
uniform float uBeat;
uniform float uBeatConfidence;
uniform float uBpm;
uniform vec4 uSeed;
// docs/todo.md entry 96 — the moon's own abundance, over ripple reach and
// lifespan only, same as every other view in this layer.
uniform float uMoonReach;
uniform float uMoonLife;
// docs/todo.md entry 106 — the moon's third quality, over the opacity
// envelope only. Same shape as circles.frag.glsl's own uMoonBloom.
uniform float uMoonBloom;

// Must match MAX_RIPPLES in ripples.ts — GLSL can't import a JS constant.
const int MAX_RIPPLES = 24;
const int AUDIO_RIPPLES = 8;
uniform vec4 uRipples[MAX_RIPPLES];
uniform vec2 uOrigin; // docs/todo.md entry 132 — the geometric centre, hanging under gravity

const float TAU = 6.28318530718;
const float PI = 3.14159265359;

const float LIFESPAN = 3.2; // Circles' own value — the comparison this family shares.
const float FADE_FROM = 0.6;

// Circles' own two stroke constants and its inner-radius ratio, reused
// verbatim rather than re-tuned — "same idiom, same two constants, rotated"
// is Decided's own words. Circles scales a stroke's width by a fraction of
// the ring's own *current radius* — the distance it has travelled since
// birth — so a young ring is a hairline and an old one a bold band; here
// they scale by a fraction of the spoke's own current *sweep*, the angle
// travelled since birth, for the same reason. `INNER_RADIUS` is Circles'
// own "inner ring at 0.70 of the outer ring's radius" — the dual is a
// second spoke trailing the front one at 0.70 of the sweep travelled so
// far, not a shorter ray at the same bearing — a shorter, narrower ray at
// the *same* angle as the broad one is a strict subset of it and would
// never be visible, a mistake this file made once and caught by reading a
// pixel dump back out of a throwaway harness (build note, entry 101).
const float OUTER_STROKE = 0.22;
const float INNER_STROKE = 0.09;
const float INNER_RADIUS = 0.70; // of the sweep travelled so far — the trailing spoke's own delay

// **Mine.** Base angular speed, rad/s, at zero loudness; a rosette born from
// silence still turns, just at the slow end. Scaled by loudness below the
// same way Circles scales stroke weight — a hit's energy goes into the turn
// as well as the mark. At OMEGA_BASE=0.9 a full-strength hit sweeps a little
// over four radians (roughly two thirds of a full turn) across its own
// LIFESPAN, which is enough motion to read as spinning within one ring's
// life without blurring into a solid disc.
const float OMEGA_BASE = 0.9;
const float OMEGA_LOUD = 0.8; // additional fraction of OMEGA_BASE at full loudness

// **Mine.** Ladder spacing, in radians — the angular equivalent of Circles'
// RUNG (0.055 of the radius). 24 rules around the full circle sit about 15°
// apart, close enough to resolve as individual bearings at arm's length
// without collapsing into a screen door, the same balance RUNG's own comment
// describes for the radial case.
const float RUNG_ANG = TAU / 24.0;

// **Mine.** How fast the whole ladder creeps between hits, rad/s, so silence
// leaves a slowly turning field rather than a dead one — Done-when's own
// requirement. Slow enough that a hit's own spin is clearly a different,
// faster motion.
const float CREEP_RATE = 0.05;

// Circles' own wake constants, unchanged: the question "how long should a
// mark last, and how much heavier is a fresh one" does not depend on whether
// the standing structure is keyed by radius or by angle.
const float WAKE_TAU = 1.6;
const float WAKE_INK = 0.55;
const float WAKE_WEIGHT = 1.0;

// Chorus' own scalar hash, reused verbatim — it only has to decorrelate a
// handful of birth times spaced at least ripples.ts's MIN_INTERVAL apart.
float hash(float x) {
  return fract(sin(x * 127.1) * 43758.5453123);
}

// **Mine.** The four symmetry orders Decided names, picked by section
// (uSeed.x) rather than continuously — a rosette is recognisably 5-fold or
// 8-fold, never "6.3-fold", so this is a lookup, not chorus.frag's
// continuous `3.0 + floor(...)`.
float nFold(float seedX) {
  float idx = floor(seedX * 4.0);
  if (idx < 1.0) return 3.0;
  if (idx < 2.0) return 5.0;
  if (idx < 3.0) return 6.0;
  return 8.0;
}

// A hard-edged ring, antialiased over roughly one pixel — Circles' own
// helper, used here only for the small centre mark.
float ring(float dist, float radius, float halfWidth, float px) {
  float d = abs(dist - radius) - halfWidth;
  return 1.0 - smoothstep(0.0, px * 1.5, d);
}

// The dual of `ring()`: a hard-edged line at constant *angle* rather than
// constant radius. `angDist` is the shortest angular gap from this pixel's
// bearing to the spoke's own bearing; multiplying by `dist` turns that into
// an arc length in the same units `ring()` measures radius in, so the same
// one-pixel antialiasing band applies. `halfWidthAng` is an angle (see call
// sites for what fraction of what) rather than a fraction of a radius —
// which is why a spoke reads as a beam that is narrow near the hub and
// wider toward the rim, the compass-rose/lighthouse figure Decided's own
// naming already describes, rather than a ruler-straight line of constant
// pixel width.
float spoke(float angDist, float dist, float halfWidthAng, float px) {
  float halfWidth = max(halfWidthAng * dist, px * 0.5);
  float d = angDist * dist - halfWidth;
  return 1.0 - smoothstep(0.0, px * 1.5, d);
}

// Shortest signed gap from angle `b` to angle `a`, wrapped into (-PI, PI] —
// the standard fix for the fact that raw subtraction is wrong across the
// +-PI seam atan2 uses.
float angDiff(float a, float b) {
  return mod(a - b + PI, TAU) - PI;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float px = 1.0 / min(uResolution.x, uResolution.y);
  // Circles' own finish radius — half the longer screen dimension — reused
  // unchanged so the two views fill the same disc.
  float maxRadius = 0.5 * max(uResolution.x, uResolution.y) / min(uResolution.x, uResolution.y) * uMoonReach;
  float lifespan = LIFESPAN * uMoonLife;
  // docs/todo.md entry 106 — same reasoning as circles.frag.glsl's own
  // hoisted fadeFrom: both loops below read it at their own opacity test.
  float fadeFrom = FADE_FROM + uMoonBloom;

  // docs/todo.md entry 132 — the rose hangs with the geometric centre. Both
  // the radius and the angle are measured from it, so the whole figure
  // translates rather than shearing about a centre that stayed put.
  vec2 rel = uv - uOrigin;
  float dist = length(rel);
  float phi = atan(rel.y, rel.x); // hoisted once, shared by every audio spoke and the ladder below

  float n = nFold(uSeed.x);
  float fold = TAU / n;

  // The ladder's own current rotation — Decided's "the whole ladder creeps",
  // quantised to one rung per beat once the tracker is confident. At
  // uBeatConfidence == 0 `mix` returns `creepContinuous` exactly, so the beat
  // term contributes nothing and this renders identically to a version with
  // it removed — the same algebraic-identity discipline as `uDay`/`uSlip`.
  float rungGapAng = RUNG_ANG * (0.85 + 0.30 * uSeed.w);
  float creepContinuous = uTime * CREEP_RATE;
  float beatPeriodSec = uBpm > 0.0 ? 60.0 / uBpm : 1.0;
  float creepQuantised = uBpm > 0.0 ? floor(uTime / beatPeriodSec) * rungGapAng : creepContinuous;
  float creep = mix(creepContinuous, creepQuantised, uBeatConfidence);

  // The one rule this pixel could possibly be nearest to, same rounding
  // reasoning as Circles' own `k` (round, not floor, or every rule renders
  // as its trailing half only).
  float kRung = floor((phi - creep) / rungGapAng + 0.5);
  float rungPhi = kRung * rungGapAng + creep;

  float ink = 0.0;
  float wake = 0.0;

  for (int i = 0; i < AUDIO_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float birthLevel = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0) continue;

    float T = min(age, lifespan); // frozen after death — see file header
    float theta0 = hash(birth) * TAU;
    // Odd slots turn the other way — Decided's own line, and the ring
    // buffer's own index is the only per-ripple label available that isn't
    // itself derived from birth time (chorus.frag's own header explains why
    // birth-derived indexing is the wrong source of "randomness" here: it
    // would walk in strict rotation on a steady beat). Index parity has no
    // such bias.
    float dirSign = mod(float(i), 2.0) < 0.5 ? 1.0 : -1.0;
    float omega = OMEGA_BASE * (1.0 + OMEGA_LOUD * birthLevel) * dirSign;
    float theta = theta0 + omega * T;

    // How long ago this rosette's own N-fold symmetry last swept past the
    // rule nearest this pixel. Folded into one spoke's own period/n, since
    // N-fold symmetry means all N spokes cross a given rung on the same
    // recurring cadence — see the file header on why this needs a period
    // and a most-recent-crossing search that Circles' own one-shot formula
    // does not.
    float s = sign(omega);
    float omegaAbs = abs(omega);
    float firstCross = mod(s * (rungPhi - theta0), fold) / omegaAbs;
    float period = fold / omegaAbs;
    if (firstCross <= T) {
      float nPeriods = floor((T - firstCross) / period);
      float tCrossLast = firstCross + nPeriods * period;
      float since = age - tCrossLast;
      if (since > 0.0) {
        wake = max(wake, (0.30 + 0.70 * birthLevel) * exp(-min(since, 24.0) / WAKE_TAU));
      }
    }

    if (age > lifespan) continue;

    float percent = age / lifespan;
    float opacity = percent > fadeFrom ? 1.0 - (percent - fadeFrom) / (1.0 - fadeFrom) : 1.0;
    opacity *= 0.35 + 0.65 * birthLevel;
    float scale = 0.8 + 0.4 * birthLevel;

    // Circles' stroke width is `OUTER_STROKE * radius`, and `radius` is
    // `maxRadius * percent` — a fraction of the frame's own bounded size,
    // scaled by age. The width below is the direct dual: a fraction of
    // `fold`, the bounded size of one spoke's own angular slot, scaled by
    // the same `percent`. `fold` is what bounds this correctly regardless of
    // spin speed or loudness — a first version scaled width by `omegaAbs *
    // T` (the angle actually swept) instead, which is unbounded: a loud,
    // fast-spinning rosette swept several multiples of `fold` well before
    // its own death, so its stroke grew wide enough to blur every fold into
    // a solid disc — caught by reading a pixel dump back out of a throwaway
    // harness a few seconds into a live ripple's own life, where the first,
    // too-wide-at-birth version had looked fine (build note, entry 101).
    float outerHalfAng = fold * OUTER_STROKE * 0.5 * scale * percent;
    float innerHalfAng = fold * INNER_STROKE * 0.5 * scale * percent;

    // Circles' inner ring sits at 0.70 of the *outer ring's own radius* —
    // trailing the front, not a second front at the same radius. The dual
    // trails the same way: a second spoke at 0.70 of the sweep travelled so
    // far, not a shorter ray at the same bearing (which a first version of
    // this file drew, and which is invisible by construction — a shorter,
    // narrower ray at the *same* angle as the broad one is a strict subset
    // of it, so "inner" would never be seen).
    float thetaInner = theta0 + omega * T * INNER_RADIUS;

    float relOuter = mod(phi - theta, fold);
    float angDistOuter = min(relOuter, fold - relOuter);
    float relInner = mod(phi - thetaInner, fold);
    float angDistInner = min(relInner, fold - relInner);

    float edgeMask = 1.0 - smoothstep(maxRadius - px * 1.5, maxRadius, dist);
    float outer = spoke(angDistOuter, dist, outerHalfAng, px) * edgeMask;
    float inner = spoke(angDistInner, dist, innerHalfAng, px) * edgeMask;

    // docs/todo.md entry 79, applied here by /ccc at build 350: screened, not
    // added. Rose was written after 79 shipped and inherited Circles' stroke
    // vocabulary without inheriting its finding — sixteen simultaneous touch
    // rosettes summing linearly pin the frame to white, which is the "one
    // colour mass" 79 exists to stop, and a rosette is N spokes rather than
    // one ring so it reaches that ceiling N times faster than Circles did.
    // Ink laid on ink, the way 79 puts it, rather than light added to light.
    ink = 1.0 - (1.0 - ink) * (1.0 - (outer + inner) * opacity);
  }

  // Touch rosettes — docs/todo.md entry 33's own convention, entry 101's own
  // resolution for it: spawn a rosette at the finger, do not light the
  // (centre-keyed) ladder, since an off-centre sweep does not cross the
  // ladder's bearings in any way its arithmetic understands. One `atan` per
  // live slot, exactly as many as touches actually on screen — the `age`
  // guard already skips the rest, same as Circles' own touch loop skips the
  // extra `length()`.
  for (int i = AUDIO_RIPPLES; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float birthLevel = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0 || age > lifespan) continue;

    vec2 origin = uRipples[i].zw;
    vec2 rel2 = uv - origin;
    float tDist = length(rel2);
    float tPhi = atan(rel2.y, rel2.x);

    float theta0 = hash(birth) * TAU;
    float dirSign = mod(float(i), 2.0) < 0.5 ? 1.0 : -1.0;
    float omega = OMEGA_BASE * (1.0 + OMEGA_LOUD * birthLevel) * dirSign;
    float theta = theta0 + omega * age;

    float percent = age / lifespan;
    float opacity = percent > fadeFrom ? 1.0 - (percent - fadeFrom) / (1.0 - fadeFrom) : 1.0;
    opacity *= 0.35 + 0.65 * birthLevel;
    float scale = 0.8 + 0.4 * birthLevel;

    // Same fold-bounded, percent-scaled width and 0.70-of-sweep trailing
    // spoke as the audio loop above — see its own comment for why.
    float outerHalfAng = fold * OUTER_STROKE * 0.5 * scale * percent;
    float innerHalfAng = fold * INNER_STROKE * 0.5 * scale * percent;
    float thetaInner = theta0 + omega * age * INNER_RADIUS;

    float relOuter = mod(tPhi - theta, fold);
    float angDistOuter = min(relOuter, fold - relOuter);
    float relInner = mod(tPhi - thetaInner, fold);
    float angDistInner = min(relInner, fold - relInner);

    float edgeMask = 1.0 - smoothstep(maxRadius - px * 1.5, maxRadius, tDist);
    float outer = spoke(angDistOuter, tDist, outerHalfAng, px) * edgeMask;
    float inner = spoke(angDistInner, tDist, innerHalfAng, px) * edgeMask;

    // docs/todo.md entry 79, applied here by /ccc at build 350: screened, not
    // added. Rose was written after 79 shipped and inherited Circles' stroke
    // vocabulary without inheriting its finding — sixteen simultaneous touch
    // rosettes summing linearly pin the frame to white, which is the "one
    // colour mass" 79 exists to stop, and a rosette is N spokes rather than
    // one ring so it reaches that ceiling N times faster than Circles did.
    // Ink laid on ink, the way 79 puts it, rather than light added to light.
    ink = 1.0 - (1.0 - ink) * (1.0 - (outer + inner) * opacity);
  }

  // The ladder itself: whichever rule is nearest this pixel's bearing, lit
  // by whatever wake a passing spoke left there, dark otherwise — Done-when's
  // own "dark in the directions nothing has swept" rules out Circles' own
  // REST_INK standing glow here; that glow exists because Circles wants the
  // centre to read as a source between hits, which the spoke hub below
  // already does on its own.
  float rungAngDist = abs(angDiff(phi, rungPhi));
  float rungArc = rungAngDist * dist;
  float rungHalf = px * (0.5 + WAKE_WEIGHT * wake);
  float rungLine = 1.0 - smoothstep(0.0, px * 1.5, rungArc - rungHalf);
  float rungMask = 1.0 - smoothstep(maxRadius - px * 1.5, maxRadius, dist);
  ink += rungLine * wake * WAKE_INK * rungMask;

  // A crisp circle at the hub, breathing with the bass — every view in this
  // family keeps one, so there is something to look at between hits.
  float centreR = 0.012 + 0.055 * uLow;
  ink += ring(dist, centreR, px * 0.9, px) * (0.25 + 0.55 * uLow);

  ink *= 1.0 - uBreak * 0.55;

  gl_FragColor = vec4(vec3(clamp(ink, 0.0, 1.0)), 1.0);
}
