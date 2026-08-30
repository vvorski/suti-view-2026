/**
 * Turns Character into decisions.
 *
 * `slow.ts` measures; this file has opinions. They are separate because they
 * fail differently — a wrong measurement is a bug with a right answer, a wrong
 * opinion is a taste argument — and because the measurement is worth having
 * even with the opinions switched off.
 *
 * Three rules govern everything here, and they are all about restraint:
 *
 *   NEVER FIGHT THE USER. Any manual change suspends the whole thing for
 *   SUSPEND seconds. Someone who has just picked a colour is not asking for a
 *   second opinion, and an autopilot that overrides a deliberate choice a
 *   half-minute later is worse than no autopilot — that is the balance at 30s;
 *   it used to be three minutes, when the whole system waited far longer than
 *   this file's other numbers now do (docs/todo.md entry 45).
 *
 *   NEVER ARRIVE UNANNOUNCED. A change only lands on a section boundary. The
 *   novelty curve is already there, so a new palette can coincide with the
 *   music changing rather than turning up in the middle of a phrase. This is
 *   the single thing that makes the difference between reading as "it is
 *   listening" and reading as "it is drifting" — which is also why capping the
 *   hold timers alone (entry 45) cannot bound the wait: on material with no
 *   distinct sections this rule stays silent no matter how low the holds go.
 *   So it decays rather than disappears — see BOUNDARY_RAMP below.
 *
 *   NEVER FLICKER. Every categorical decision goes through a dead band and has
 *   to hold its new answer for a while before it counts. A classification that
 *   oscillates between two nearly-tied options is worse than one that is
 *   slightly wrong and stable.
 */

import type { GeoColour } from './geo-colour'
import type { Character } from './engine'
import type { AtmosphericViewName } from './views'
import type { Posture } from './engine'

/**
 * docs/todo.md entry 90 — multipliers on `COLOUR_HOLD`/`VIEW_HOLD` by how
 * the phone is currently being held. Multipliers rather than five pairs of
 * constants, so the base numbers stay the one place either hold is tuned.
 * `still` is the *shortest* hold, not the longest — Victor's own call,
 * against every restraint this project chose while the picture was
 * something left running: a phone alone on a table has nothing else
 * supplying change, so the director is the only thing that can. `handled`
 * carries no multiplier of its own; a person actively playing with the
 * phone is already covered by `SUSPEND`, unchanged by this entry. The exact
 * figures are **Mine**; the ordering is Decided's.
 */
const HOLD_SCALE: Record<Posture, number> = {
  still: 0.55,
  dancing: 0.7,
  driving: 1.3,
  carried: 1.8,
  handled: 1,
}

/** Seconds of hands-off after any manual change. Used to be 180 — long enough
 *  to cover the length of most tracks — but the autopilot is unconditional
 *  now (entry 45), and a mode nobody can turn off has to give a deliberate
 *  choice back within a bound short enough that it never reads as ignored. */
const SUSPEND = 30

/** A change rides in on a boundary at least this novel — while there is time
 *  left to wait for one. See BOUNDARY_RAMP below for what happens once there
 *  is not. */
const BOUNDARY = 0.45

/** Once a change is otherwise due — its hold has cleared, its own conditions
 *  are met — but no boundary novel enough has arrived, BOUNDARY decays to 0
 *  across this many seconds rather than blocking forever. This is what turns
 *  "changes only land on a section boundary" into a rule with a bound: on
 *  material with no distinct sections at all, the change still lands, just
 *  without one to land on. A genuinely novel moment inside the ramp still
 *  wins early — the decay only matters once none arrives.
 *
 *  Exported for the same reason COLOUR_HOLD/VIEW_HOLD are (docs/todo.md
 *  entry 84): docs/todo.md entry 89's own probe cases assert real timings
 *  against this value directly rather than a hand-copied literal. */
export const BOUNDARY_RAMP = 30

/**
 * Minimum seconds between changes of each kind — and, since each kind only
 * ever touches one layer (`COLOUR_HOLD` gates `geoColour`, the geometry's
 * own axis; `VIEW_HOLD` gates `atmosphericView`, the atmosphere's), each
 * layer's own clock. Both sat at the same 30s from entry 45 until entry 84,
 * which is exactly what made the two layers read as one picture changing on
 * a single shared beat rather than two independent ones — docs/todo.md
 * entry 84, `docs/what-resolume-knew-about-layers.md` lesson 4.
 *
 * 25 and 45, geometry faster since it is the near plane and colour is cheap
 * to accept, atmosphere slower since it is the ground and a programme swap
 * replaces the whole picture. Deliberately not multiples of each other
 * (`index.html`'s start-button animation uses the same 3.4s/5.9s reasoning)
 * so the two do not resynchronise into the behaviour this replaces. The
 * logic that reads these — the two independent `sinceX >= X_HOLD` checks in
 * `update()` below — was already per-layer; only the two numbers being
 * equal was ever shared.
 *
 * Exported so probe-slow.ts's entry-84 check can assert the actual gap
 * against these values directly rather than a hand-copied literal that could
 * drift out of sync with them.
 */
export const COLOUR_HOLD = 25
export const VIEW_HOLD = 45

/** A suggested programme must be the suggestion for this long before it is
 *  acted on — the dead band that stops two near-tied options alternating.
 *  Already at entry 45's cap; unchanged by it. */
const VIEW_STABLE = 30

/**
 * docs/todo.md entry 81 — how long a decision that is otherwise due may
 * wait for a bar line before firing anyway, at full `beatConfidence`. Only
 * `beatPhase`/`beatConfidence` reach this file, not a tempo in bpm, so this
 * is a fixed duration rather than a true bar length at whatever tempo is
 * actually playing — chosen against a nominal ~100bpm four-beat bar (2.4s).
 * "At most one bar" is the ceiling a decision never crosses, not a promise
 * to hit every possible tempo's own bar length exactly. **Mine**.
 */
const MAX_BAR_WAIT_S = 2.4

/** Colour only moves if it would move far enough to notice. Below this the
 *  change is invisible and only costs a boundary that could have carried
 *  something worth seeing. docs/todo.md entry 89 — this is the *starting*
 *  requirement; `requiredStep` below decays it the same way `requiredNovelty`
 *  decays `BOUNDARY`, since an un-decaying distance floor was the actual
 *  cause of a colour that never moves against steady audio (see that
 *  function's own comment). */
const COLOUR_MIN_STEP = 0.18

export interface Directives {
  geoColour?: GeoColour
  atmosphericView?: AtmosphericViewName
}

/**
 * The palette ramp, dark to bright.
 *
 * Three stops rather than a hue rotation: a full sweep through HSV spends most
 * of its range somewhere muddy, and two of the three programmes underneath are
 * already strongly coloured. These are picked to stay in the cold half the
 * project lives in, with one warm end so "dark and steep" has somewhere to go
 * that is not just dimmer.
 */
const RAMP: ReadonlyArray<readonly [number, number, number]> = [
  [1.0, 0.35, 0.3], // ember — energy low and falling away fast
  [0.45, 0.95, 0.8], // jade  — the middle of the range, where most music sits
  [0.55, 0.7, 1.0], // cold  — flat, bright, energy all the way up
]

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * Flavour to colour.
 *
 * `bright` picks the position on the ramp. `noisy` desaturates towards white,
 * which is both the obvious metaphor — noise is white — and the thing that
 * keeps a noisy passage from reading as a *hue* when what changed was the
 * absence of pitch.
 */
export function colourFor(c: Character): GeoColour {
  const t = Math.max(0, Math.min(1, c.bright)) * (RAMP.length - 1)
  const i = Math.min(RAMP.length - 2, Math.floor(t))
  const f = t - i
  const wash = Math.max(0, Math.min(1, c.noisy)) * 0.6
  const mix = (k: number): number => lerp(lerp(RAMP[i][k], RAMP[i + 1][k], f), 1, wash)
  return { r: mix(0), g: mix(1), b: mix(2) }
}

/**
 * Flavour to atmospheric programme.
 *
 * This was four buckets on two axes, with a comment saying it was coarse on
 * purpose: a finer rule would need confidence the measurement does not have,
 * and every extra branch is another boundary where two options can tie. That
 * argument still holds, and these buckets are still coarse.
 *
 * What changed is the cost on the other side. There are seven atmospheric
 * views now, and a rule that can only ever name four means three of them are
 * reachable solely by someone going looking through the HUD — the autopilot
 * would never once show them, however long it ran. An unreachable programme
 * is a worse failure than a branch that sometimes picks the second-best of
 * two plausible answers.
 *
 * So: seven buckets, with every new split on an axis already in use rather
 * than a new one. `noisy` is the tiebreaker in both halves because it is, per
 * slow.ts, the one descriptor genuinely independent of the others — which
 * makes it the cheapest axis to hang another branch on.
 *
 *   rhythmic + dense      lattice     the busiest picture for the busiest sound
 *   rhythmic + noisy      cells       discrete tiles read a noisy spectrum as a chord
 *   rhythmic              spectrogram pulse laid out as time
 *   bright + noisy        caustics    texture, flowing, no fixed structure
 *   bright                aurora      the one with a horizon
 *   tonal + dense         fringe      interference needs sustained pitch to read
 *   otherwise             field       the default, and the quietest
 *
 * docs/todo.md entry 89 — returns `[best, second-best]` rather than one name,
 * so a suggestion that is stuck matching what is already on screen has an
 * honest fallback to offer rather than blocking forever (see director.ts's
 * own use of the second element). The second element is the leaf the nearest
 * tie-breaking comparison would have picked instead — the sibling one level
 * in, not an arbitrary or random alternative — so it stays an answer to the
 * same music, merely not the first one.
 */
export function viewFor(c: Character): readonly [AtmosphericViewName, AtmosphericViewName] {
  if (c.rhythmic > 0.5) {
    if (c.dense > 0.4) return ['lattice', c.noisy > 0.5 ? 'cells' : 'spectrogram']
    return c.noisy > 0.5 ? ['cells', 'spectrogram'] : ['spectrogram', 'cells']
  }
  if (c.bright > 0.55) return c.noisy > 0.45 ? ['caustics', 'aurora'] : ['aurora', 'caustics']
  return c.dense > 0.45 && c.noisy < 0.4 ? ['fringe', 'field'] : ['field', 'fringe']
}

const distance = (a: GeoColour, b: GeoColour): number =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b)

/**
 * How novel a boundary has to be, given how long a change has already been
 * otherwise due.
 *
 * `sinceDue` is negative before the hold has even cleared — a change is not
 * due yet, so this is called only once it's non-negative — and 0 at the
 * instant it clears, where the full BOUNDARY still applies: an ordinary
 * change still waits for a real section boundary, exactly as before entry
 * 45. From there the requirement falls linearly to 0 by BOUNDARY_RAMP
 * seconds later, which is what keeps a track with no distinct sections from
 * blocking a change forever rather than merely delaying it past its hold.
 */
function requiredNovelty(sinceDue: number): number {
  return BOUNDARY * Math.max(0, 1 - Math.max(0, sinceDue) / BOUNDARY_RAMP)
}

/**
 * docs/todo.md entry 89 — same shape as `requiredNovelty`, decaying
 * `COLOUR_MIN_STEP` to 0 across `BOUNDARY_RAMP` once a colour change is
 * otherwise due. Without this, a `wanted` colour equal to what is already
 * showing — the ordinary state of a steady character, not an edge case —
 * has a distance of ~0 forever, and no boundary, however novel, can make a
 * step of 0 clear a fixed floor above 0. The novelty gate already had this
 * decay (entry 45); the distance gate never did, and that gap is this
 * entry's actual bug, not a motion problem.
 */
function requiredStep(sinceDue: number): number {
  return COLOUR_MIN_STEP * Math.max(0, 1 - Math.max(0, sinceDue) / BOUNDARY_RAMP)
}

export class Director {
  private suspended = 0
  private sinceColour = COLOUR_HOLD
  private sinceView = 0
  private candidate: AtmosphericViewName | null = null
  private candidateHeld = 0
  // docs/todo.md entry 81 — the bar clock, and the one decision currently
  // waiting on it. `lastBeatPhase` detects a beat wrap (phase decreasing
  // rather than advancing); every fourth wrap is a bar line. Only ever
  // advances while `beatPhase` is actually moving, so an unlocked tracker
  // (pinned at 0, see fast.ts's own VisualParams doc) correctly never
  // claims a bar happened.
  private lastBeatPhase = 0
  private beatsIntoBar = 0
  private pending: Directives | null = null
  private pendingWaited = 0
  // docs/todo.md entry 89 — the view axis's own runner-up for the current
  // character, tracked alongside `candidate` so it is ready the instant the
  // primary suggestion turns out to be stuck matching what is on screen.
  private secondBest: AtmosphericViewName | null = null
  /** docs/todo.md entry 89 — which specific gate is closed, when something is
   *  otherwise due and not firing. Null whenever nothing is due, something
   *  did fire, or the autopilot is suspended/holding for a bar — see
   *  `status()`'s own comment for why this exists. */
  private blocked: string | null = null
  // docs/todo.md entry 90 — the hold values `update()` last actually used,
  // so `status()` reports `tillColour`/`tillView` against the same posture
  // scale the decision itself is being judged by, not the flat, unscaled
  // constant.
  private colourHold = COLOUR_HOLD
  private viewHold = VIEW_HOLD

  /** Call whenever the user changes anything by hand. */
  suspend(): void {
    this.suspended = SUSPEND
    // docs/todo.md entry 81 — a decision the autopilot was holding for the
    // next bar is exactly as unwelcome as one it would fire this instant;
    // "never fight the user" does not have an exception for "but I already
    // decided this before you touched anything".
    this.pending = null
  }

  /** Seconds until the autopilot resumes, 0 when it is live. */
  get quietFor(): number {
    return this.suspended
  }

  /**
   * What the autopilot is currently thinking, for the numeric readout.
   *
   * This exists because the three rules at the top of this file add up to
   * something that is, during any hands-on session, completely silent — and
   * indistinguishable from broken. Touching any control suspends it for
   * SUSPEND (30s). A programme swap then additionally needs a warm buffer,
   * VIEW_HOLD (45s, entry 84) since the last one, the same suggestion held
   * for VIEW_STABLE (30s), and a boundary that is either over BOUNDARY or has
   * simply waited long enough (BOUNDARY_RAMP). Every one of those is
   * deliberate and defensible; together they mean someone adjusting the HUD
   * and watching for a change will wait forever and conclude nothing is
   * connected.
   *
   * Reporting the timers does not weaken any of the rules. It just stops
   * "restrained" being indistinguishable from "not running".
   */
  status(): {
    suspended: number
    tillColour: number
    tillView: number
    candidate: AtmosphericViewName | null
    candidateHeld: number
    /** docs/todo.md entry 81 — a decision is currently held for the next
     *  bar line rather than having fired the instant it became due. Not
     *  wired into the HUD's own printed readout — Lands-in scopes this
     *  entry to director.ts and main.ts only — but reported here for the
     *  same reason every other timer in this method is: so "restrained"
     *  stays distinguishable from "not running" for whoever looks next.
     *  **Mine**. */
    waitingForBar: boolean
    /** docs/todo.md entry 89 — the gate actually blocking a due change, e.g.
     *  `"colour: step 0.04 < 0.18"` or `"view: candidate = current (field)"`.
     *  Null whenever nothing is due, something just fired, or the autopilot
     *  is suspended or already holding for a bar line. Exists because
     *  `tillColour`/`tillView` reaching 0 and staying there — the exact
     *  shape of the latch this entry fixes — was indistinguishable from "not
     *  running" without it: a diagnostic that goes quiet precisely when the
     *  fault fires is not a diagnostic. */
    blocked: string | null
  } {
    return {
      suspended: Math.max(0, this.suspended),
      tillColour: Math.max(0, this.colourHold - this.sinceColour),
      tillView: Math.max(0, this.viewHold - this.sinceView),
      candidate: this.candidate,
      candidateHeld: this.candidateHeld,
      waitingForBar: this.pending !== null,
      blocked: this.blocked,
    }
  }

  /**
   * Advance and decide. Returns null when there is nothing to do, which is
   * common but, since docs/todo.md entry 45, bounded: a change that is
   * otherwise due lands within BOUNDARY_RAMP of becoming due even if the
   * music never offers a boundary novel enough to carry it sooner.
   *
   * `current` is what is on screen now, so a decision that agrees with reality
   * is not reported as a change.
   *
   * `beatPhase`/`beatConfidence` are docs/todo.md entry 81: once a decision
   * is otherwise due, it is held until the next bar line rather than fired
   * on the spot — quantised to the beat when the tracker is confident,
   * blending continuously to immediate as confidence falls, per that
   * entry's own "no threshold to tune".
   *
   * `posture` is docs/todo.md entry 90 — required rather than defaulted,
   * because the one posture whose behaviour is safest for `posture.ts`
   * itself to guess (`'still'`) is also the *fastest* hold on this file's
   * own ladder, and a silent default here would retune every existing
   * caller's timing rather than only the ones that actually want it. Pass
   * `'handled'` (×1, `HOLD_SCALE`'s own neutral entry) for today's unscaled
   * COLOUR_HOLD/VIEW_HOLD.
   */
  update(
    c: Character,
    dt: number,
    current: { geoColour: GeoColour; atmosphericView: AtmosphericViewName },
    beatPhase: number,
    beatConfidence: number,
    posture: Posture,
  ): Directives | null {
    const scale = HOLD_SCALE[posture]
    this.colourHold = COLOUR_HOLD * scale
    this.viewHold = VIEW_HOLD * scale

    this.sinceColour += dt
    this.sinceView += dt

    // docs/todo.md entry 81 — the bar clock. Runs regardless of suspend, so
    // resuming does not inherit a stale count from before the pause any
    // more than `candidateHeld`'s own hysteresis does below.
    let barBoundary = false
    if (beatPhase < this.lastBeatPhase - 0.5) {
      this.beatsIntoBar = (this.beatsIntoBar + 1) % 4
      if (this.beatsIntoBar === 0) barBoundary = true
    }
    this.lastBeatPhase = beatPhase

    if (this.suspended > 0) {
      this.suspended -= dt
      // The stability timer keeps running while suspended, so resuming does not
      // start from a standing start — but nothing is emitted.
      this.track(c, dt)
      this.blocked = null
      return null
    }

    this.track(c, dt)

    // docs/todo.md entry 81 — a decision already waiting for a bar line:
    // fire it the instant the bar arrives, or once it has waited as long as
    // the current confidence allows, whichever comes first. Recomputing the
    // cap fresh every call (rather than fixing it when the wait began) is
    // what lets a tempo that drifts or drops mid-wait release the decision
    // quickly instead of stranding it — Decided's own explicit worry.
    if (this.pending) {
      this.pendingWaited += dt
      const cap = MAX_BAR_WAIT_S * beatConfidence
      this.blocked = null
      if (barBoundary || this.pendingWaited >= cap) {
        const fired = this.pending
        this.pending = null
        this.pendingWaited = 0
        return fired
      }
      return null
    }

    const out: Directives = {}
    let blocked: string | null = null

    // docs/todo.md entry 89 — per-axis warmth, not one flag gating both.
    // Colour only reads noveltyMedium, so it only needs `warmMedium`; `warm`
    // (the long window the view axis actually needs) implies it too, since
    // the long buffer cannot be full before the medium one is — hence the
    // `||`, which lets every existing "warm: true" fixture elsewhere in this
    // codebase keep meaning "the director may act" without also having to
    // name the medium flag explicitly.
    if (c.warmMedium || c.warm) {
      const overdue = this.sinceColour - this.colourHold
      if (overdue >= 0) {
        const wanted = colourFor(c)
        const step = distance(wanted, current.geoColour)
        // docs/todo.md entry 89 — a literal zero distance is not a small step
        // that time should eventually forgive; it is nothing to change at
        // all, wanted being current already rather than merely close to it.
        // Decided's own wording is "distance is ~0" for the bug this fixes,
        // not "= 0" — the decay exists for the real residual a continuous,
        // slightly-noisy flavour axis leaves behind, not to manufacture a
        // no-op re-announcement of the colour already on screen.
        if (step > 0) {
          const neededStep = requiredStep(overdue)
          const neededNovelty = requiredNovelty(overdue)
          if (step < neededStep) {
            blocked = `colour: step ${step.toFixed(2)} < ${neededStep.toFixed(2)}`
          } else if (c.noveltyMedium < neededNovelty) {
            blocked = `colour: novelty ${c.noveltyMedium.toFixed(2)} < ${neededNovelty.toFixed(2)}`
          } else {
            out.geoColour = wanted
            this.sinceColour = 0
          }
        }
      }
    }

    // The view axis keeps needing full `warm` — Decided is explicit that the
    // long axes it reads are not the ones entry 89's medium-window relief
    // applies to.
    if (c.warm && this.candidate !== null && this.candidateHeld >= VIEW_STABLE) {
      const overdue = this.sinceView - this.viewHold
      if (overdue >= 0) {
        // docs/todo.md entry 89 — once a view change has been due for a full
        // BOUNDARY_RAMP with the suggestion still matching what is already
        // showing, the suggestion itself is what is stuck, not the boundary
        // — so the target becomes the character's own runner-up instead of
        // waiting on a primary answer that can never differ from reality.
        const stuck = overdue >= BOUNDARY_RAMP && this.candidate === current.atmosphericView
        const target = stuck ? this.secondBest : this.candidate
        const neededNovelty = requiredNovelty(overdue)
        if (target === null || target === current.atmosphericView) {
          blocked = blocked ?? `view: candidate = current (${current.atmosphericView})`
        } else if (c.noveltyMedium < neededNovelty) {
          blocked = blocked ?? `view: novelty ${c.noveltyMedium.toFixed(2)} < ${neededNovelty.toFixed(2)}`
        } else {
          out.atmosphericView = target
          this.sinceView = 0
        }
      }
    }

    if (!out.geoColour && !out.atmosphericView) {
      this.blocked = blocked
      return null
    }
    this.blocked = null

    // docs/todo.md entry 81 — fire on the spot rather than holding when
    // either the tracker is not confident enough to bother waiting on
    // (cap collapses to 0 as beatConfidence falls, "blend to immediate as
    // it falls" needing no threshold of its own) or a bar line has already
    // arrived on this exact frame, in which case holding would only cost a
    // full extra bar for nothing.
    const cap = MAX_BAR_WAIT_S * beatConfidence
    if (cap <= 0 || barBoundary) return out

    this.pending = out
    this.pendingWaited = 0
    return null
  }

  /** Hysteresis on the programme suggestion: a new answer has to persist. */
  private track(c: Character, dt: number): void {
    const [suggestion, second] = viewFor(c)
    this.secondBest = second
    if (suggestion === this.candidate) {
      this.candidateHeld += dt
    } else {
      this.candidate = suggestion
      this.candidateHeld = 0
    }
  }
}
