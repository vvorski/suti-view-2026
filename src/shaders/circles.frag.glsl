// "Circles" — the first geometric-layer programme.
//
// suti-view-2026 grew out of ~/dev/circles, a video-chat app whose waiting
// room draws slow concentric rings on a fixed timer while people join. That
// effect never listened to anything — it was ambient wallpaper running on a
// clock. This is the same shape of idea (paired rings expanding from centre,
// fading as they grow) rewritten to answer to the room instead of a timer: a
// ring is born on a transient, not a `setInterval`, and its size and
// brightness carry the loudness of the hit that made it.
//
// That is also the reason this is its own layer rather than folded into
// Field or Lattice. Those are continuous fields — noise, spectrograms,
// envelopes — and read as weather. A ring is a discrete event with a start
// time, which does not fit a continuous field without either faking events
// out of it (as Field's single transient ripple already does, one at a time)
// or actually tracking them. This layer tracks them: scene.ts watches for a
// transient crossing a threshold and hands this shader a small buffer of
// (birth time, birth loudness) pairs to draw independently, each ageing at
// its own rate. See ripples.ts for the trigger logic.
//
// Two rules this layer follows, and the atmospheric one does not:
//
//   Drawn, not glowing. Rings are hard-edged strokes, not soft radial
//   falloffs. An earlier version used a gaussian around the ring radius,
//   which reads as light leaking rather than as geometry, and turned to mush
//   the moment it was composited over a busy field. Hard-edged does not mean
//   thin, though — see OUTER_STROKE below; the stroke is a fraction of the
//   ring's radius, so it is a broad white band, not a hairline.
//
//   White, not coloured. Everything here is monochrome; colour is applied to
//   the whole layer afterwards as an RGB filter (see composite.frag.glsl and
//   geo-colour.ts). Keeping shape and colour separate means a colour change
//   is instant and total, and means the geometry never fights the atmospheric
//   layer's palette for the same hue.
//
// What makes this view *this* view, and not Drift, Chorus or Tide: the wake.
//
// Those three are all the same ring with the emitter moved (wandering, split
// into several, pushed to the edge), so the one thing Circles cannot use to
// distinguish itself is the emitter. What it has instead is the consequence of
// never moving the emitter: every ring this view will ever draw crosses the
// same set of radii, concentric with every other. So the frame can carry a
// standing ladder of fine concentric rules that a front lights as it passes
// and that fade slowly afterwards, and the frame between hits is then a record
// of the hits — which rung is still bright says how long ago and how hard.
//
// That structure is available *only* here. Put the same ladder in Drift and
// each hit crosses it from a different offset centre, so the rules light in a
// lopsided order that reads as a smear; in Chorus three families cross it at
// once and it is noise; in Tide the fronts cut across it at every angle. A
// fixed origin is the precondition, and this is the view that has one.
//
// The trace is computed, not accumulated. There is no history buffer on this
// layer — one pass, no ping-pong target, and no uniform to put one in — but
// none is needed, because a front's radius is linear in its age. The instant
// ring i crossed radius R is exactly birth + LIFESPAN * R / maxRadius, in
// closed form, so "how long ago was this rung crossed" is subtraction. Each
// pixel asks only about the single rule nearest to itself, which keeps the
// whole thing inside the existing ripple loop with no nested loop over the
// ladder.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uLevel;
uniform float uLow;
uniform float uTilt;
uniform float uBreak;
uniform vec4 uSeed;

// Must match MAX_RIPPLES in ripples.ts — GLSL can't import a JS constant, and
// a mismatch here means scene.ts uploads an array of the wrong length.
const int MAX_RIPPLES = 8;
// (birthTime, birthLevel) pairs. An unborn slot has birthTime far enough in
// the past that it no longer falls out of LIFESPAN's `continue` above — the
// wake reads dead slots too — but its birthLevel is 0, and the wake's own
// `min(since, 24.0)` clamp caps its contribution at e^-15, so it draws
// nothing. See the wake ladder below for where that clamp lives.
uniform vec2 uRipples[MAX_RIPPLES];

const float LIFESPAN = 3.2; // seconds from birth to vanishing at the rim
const float FADE_FROM = 0.6; // fraction of LIFESPAN where fade-out begins

// Straight from ~/dev/circles (src/start/CirclesAnimCanvas.tsx). The stroke
// widths there are fractions of the ring's *current* radius, not fixed pixel
// weights — which is the whole look. A new ring is a thick white band with a
// thinner one inside it, and both grow heavier as they travel. Drawing them
// as hairlines instead, as an earlier version here did, gives spidery
// concentric circles rather than the bold double ring this is meant to be.
const float OUTER_STROKE = 0.22; // of radius
const float INNER_STROKE = 0.09; // of radius (note: of the *outer* radius)
const float INNER_RADIUS = 0.70; // of radius

// --- the wake ladder ---------------------------------------------------------

// Spacing between rules, in the same units as `dist` — half the short screen
// dimension is 1.0, so the near edge is at 0.5. 0.055 puts nine rules between
// the centre and the near edge, some 21 px apart on a phone held upright.
// Both sides of it were looked at: at 0.03 the rules stop resolving as
// separate lines at arm's length and the field turns into a screen door that
// merely gets brighter, which loses the whole point of a ladder you can count;
// at 0.10 a front lights one rule at a time with a visible gap between, so the
// wake reads as a blink rather than as a trail with a direction.
const float RUNG = 0.055;

// Seconds for a lit rule to fall to 1/e of its peak. This is the memory of the
// view and the number worth arguing about. Much under a second and the lit
// rules hug the front closely enough to be mistaken for part of the band, so
// nothing is remembered; over about three and, during a run of hits, every
// rule inside the frame is lit at once and the ladder records nothing because
// it never gets dark again. 1.6 s sits at half a ring's life: by the time a
// ring dies its trail is down to about an eighth and the rung it crossed first
// is the dimmest thing still visible.
const float WAKE_TAU = 1.6;

// Peak brightness of a freshly crossed rule. The double band is the subject
// and this is the field it moves through; at 0.2 the ladder is invisible once
// the atmospheric layer is mixed underneath, and at 0.62, measured with a
// throwaway browser probe, the rules were reading as a second ring system
// rather than as the ground the first one moves over.
//
// Worth being straight about a tension that no value here resolves: a rule
// laid down at full strength *will* out-brighten the band that laid it, once
// that band is past FADE_FROM and going out. 0.55 gives 111 in 255 against a
// late-life band's 82. That is not an accident to be tuned away — the point of
// a wake is that the mark outlives the event — and the hierarchy survives it
// anyway, because the comparison is a two-pixel hairline against a band a
// hundred pixels wide. Mass, not peak value, is what the eye ranks here.
const float WAKE_INK = 0.55;

// A fresh trace is also a *heavier* line, not only a brighter one, and the
// rule thins back to a hairline as it fades. Opacity alone was the first
// version and it is the wrong idiom for this layer: the source's whole
// vocabulary is stroke weight (a ring is broad because it is far along, not
// because it is loud), and a ladder that only dims reads as a fading glow,
// which is the thing the header says this layer does not do. In half-widths of
// a pixel, on top of the resting hairline's own half-pixel — so with WAKE_INK
// at 0.55 a fresh rule is about two pixels across and a spent one is one.
// Below about 0.5 the widening is under a pixel and the whole idea collapses
// back into opacity-only; above about 2 a fresh rule is wide enough to read as
// a thin band rather than a rule, and near the centre — where the ring's own
// inner stroke is at its px*0.5 floor — the ladder starts competing with the
// band it is supposed to be a record of.
const float WAKE_WEIGHT = 1.0;

// At rest the ladder is not entirely dark: the innermost rules stay faintly
// lit, fading out with radius, so silence shows a small graded structure
// around the centre circle instead of one hairline in a black frame. Holding
// the resting level flat all the way out was tried first and it is exactly the
// "busy" failure — a full standing bullseye with nothing happening to it, and
// worse, an outer ladder already lit is an outer ladder a passing front cannot
// light. Confining it to the first few rules makes the centre read as the
// source the rings come from and leaves the rest of the field dark until a hit
// actually reaches it.
const float REST_INK = 0.24;
// Radius at which the resting level is down to 1/e. Unlike the wake, `rest`
// is not gated by `reached` — that is only safe because it has already
// reached exactly zero by REST_REACH * ln(REST_INK / REST_FLOOR) ~= 0.30,
// well inside maxRadius's floor of 0.5. Past REST_REACH ~= 0.167 that stops
// holding and the resting ladder starts lighting rungs beyond maxRadius —
// the same phantom corner rungs the `reached` gate exists to keep the wake
// away from.
const float REST_REACH = 0.10;
// Subtracted from the resting level so it reaches *exactly* zero at about
// 0.30, rather than trailing off as a decreasing ramp of one- and two-in-255
// rules all the way into the corners. Measured with a throwaway browser
// probe: without the subtraction every rule on screen is faintly lit at
// rest, which is invisible
// on a bright display and a full standing bullseye on a phone in a dark room —
// and it leaves a passing front nothing dark to arrive into.
const float REST_FLOOR = 0.012;

// A hard-edged ring, antialiased over roughly one pixel.
//
// The pixel size is derived from uResolution rather than from fwidth(): in
// GLSL ES 1.00 derivatives need an extension, and one pixel here is exactly
// 1/min(resolution) because that is what uv was divided by. No extension, no
// per-fragment derivative, same result.
float ring(float dist, float radius, float halfWidth, float px) {
  float d = abs(dist - radius) - halfWidth;
  return 1.0 - smoothstep(0.0, px * 1.5, d);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float dist = length(uv);
  float px = 1.0 / min(uResolution.x, uResolution.y);
  // Half the *longer* screen dimension, matching the source's
  // `finishRadius = max(innerWidth, innerHeight) / 2`. Reaching the corner
  // instead — which an earlier version did — makes the ring keep growing well
  // after it has left the frame, so the thick band spends its last second
  // invisible and the fade reads as the ring simply going out.
  float maxRadius = 0.5 * max(uResolution.x, uResolution.y) / min(uResolution.x, uResolution.y);

  float ink = 0.0;

  // The one rule this pixel could possibly be on. A re-roll shifts the spacing
  // a little, so the ladder is restructured by a change of section rather than
  // merely re-timed — the same thing uSeed does for Drift's path and Chorus's
  // node count.
  float rungGap = RUNG * (0.85 + 0.30 * uSeed.w);
  // Rounding, not flooring. floor() hands a pixel just outside a rule the
  // *next* rule out, so every rule renders as its inner half only and the
  // ladder comes out as a set of broken arcs — which looks enough like a
  // deliberate effect to survive a careless glance.
  float k = floor(dist / rungGap + 0.5);
  float rungR = k * rungGap;
  // A ring stops at maxRadius and dies there, so rules beyond it — the corners
  // of a non-square frame — were never crossed by anything and never light.
  float reached = step(rungR, maxRadius);
  float wake = 0.0;

  for (int i = 0; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float birthLevel = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0) continue;

    // How long ago this ring's front crossed the rule nearest this pixel.
    // Negative means it has not reached it yet. Dead rings count here, which
    // is the entire point of a wake and the reason this sits *above* the
    // LIFESPAN test rather than below it.
    //
    // The clamp is for the unborn slots: they sit at birthTime -1000
    // (ripples.ts), so `since` is about a thousand seconds and exp() would be
    // relying on underflow rather than on arithmetic. Clamped, the answer is
    // e^-15 ≈ 3e-7 — not zero, but four orders below the 1/255 the display can
    // show, on every path.
    float since = age - LIFESPAN * rungR / maxRadius;
    if (since > 0.0) {
      // max(), not +=. Eight overlapping traces summed pins the ladder solid
      // white through any busy passage — Grid's fronts did exactly this — and
      // a wake that saturates has stopped being a record of anything. The
      // loudness floor is the same 0.3-ish one the ring opacity uses: a quiet
      // hit leaves a fainter mark, not no mark.
      wake = max(wake, (0.30 + 0.70 * birthLevel) * exp(-min(since, 24.0) / WAKE_TAU));
    }

    if (age > LIFESPAN) continue;

    float percent = age / LIFESPAN;
    // Linear, as in the source. Ease-out was an embellishment added here and
    // it fights the proportional stroke: easing puts nearly all the growth in
    // the first instant, so the ring arrives already thick and then only
    // fades. Growing at a constant rate is what lets the band visibly thicken
    // as it travels, which is the movement the original has.
    float radius = maxRadius * percent;

    float opacity = percent > FADE_FROM ? 1.0 - (percent - FADE_FROM) / (1.0 - FADE_FROM) : 1.0;
    // A quiet hit still gets a ring, just a fainter one — audible does not
    // mean invisible, but loud should clearly outshine quiet. The source has
    // no idea of loudness at all; this is the one place the ring answers to
    // the room rather than to a clock.
    opacity *= 0.35 + 0.65 * birthLevel;

    // Half-widths, because `ring` measures from the centre line out while the
    // source's canvas lineWidth spans both sides of it.
    float scale = 0.8 + 0.4 * birthLevel; // loudness leans on weight too
    float outerHalf = max(radius * OUTER_STROKE * 0.5 * scale, px * 0.5);
    float innerHalf = max(radius * INNER_STROKE * 0.5 * scale, px * 0.5);

    float outer = ring(dist, radius, outerHalf, px);
    float inner = ring(dist, radius * INNER_RADIUS, innerHalf, px);

    // Both rings at full strength: they are the same white stroke in the
    // source, and dimming the inner one to 0.65 — as an earlier version did —
    // turns a matched pair into a ring with a shadow.
    ink += (outer + inner) * opacity;
  }

  // The ladder. Whichever is the stronger of the standing resting level and
  // whatever a passing front left behind. max(), not addition — adding them
  // brightens an inner rule twice for one event, once for its resting glow and
  // again for the front crossing it, which puts a second bright band near the
  // centre that nothing on screen accounts for.
  float rest = max(REST_INK * exp(-rungR / REST_REACH) - REST_FLOOR, 0.0);
  float trace = max(rest, wake * WAKE_INK * reached);
  // k = 0 is the origin itself; skipping it keeps a stray dot out of the
  // middle of the centre circle.
  ink += k < 0.5 ? 0.0 : ring(dist, rungR, px * (0.5 + WAKE_WEIGHT * trace), px) * trace;

  // A crisp circle at centre, breathing with the bass, so there is something
  // to look at between hits rather than a dead patch of black. Drawn as an
  // outline for the same reason as everything else here.
  float centreR = 0.012 + 0.055 * uLow;
  ink += ring(dist, centreR, px * 0.9, px) * (0.25 + 0.55 * uLow);

  // A break thins the ink rather than draining colour — there is no colour
  // here to drain.
  ink *= 1.0 - uBreak * 0.55;

  gl_FragColor = vec4(vec3(clamp(ink, 0.0, 1.0)), 1.0);
}
