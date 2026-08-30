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
 *  wins early — the decay only matters once none arrives. */
const BOUNDARY_RAMP = 30

/** Minimum seconds between changes of each kind. Colour is cheap to accept and
 *  can move with the sections; a programme swap replaces the whole picture and
 *  should feel like it belongs to a movement, not a verse. Both used to be
 *  larger (45 and 120) before entry 45 capped every timer here at 30 — the
 *  distinction between them survives only in how quickly BOUNDARY_RAMP can
 *  still matter once each one clears. */
const COLOUR_HOLD = 30
const VIEW_HOLD = 30

/** A suggested programme must be the suggestion for this long before it is
 *  acted on — the dead band that stops two near-tied options alternating.
 *  Already at entry 45's cap; unchanged by it. */
const VIEW_STABLE = 30

/** Colour only moves if it would move far enough to notice. Below this the
 *  change is invisible and only costs a boundary that could have carried
 *  something worth seeing. */
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
 */
export function viewFor(c: Character): AtmosphericViewName {
  if (c.rhythmic > 0.5) {
    if (c.dense > 0.4) return 'lattice'
    return c.noisy > 0.5 ? 'cells' : 'spectrogram'
  }
  if (c.bright > 0.55) return c.noisy > 0.45 ? 'caustics' : 'aurora'
  return c.dense > 0.45 && c.noisy < 0.4 ? 'fringe' : 'field'
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

export class Director {
  private suspended = 0
  private sinceColour = COLOUR_HOLD
  private sinceView = 0
  private candidate: AtmosphericViewName | null = null
  private candidateHeld = 0

  /** Call whenever the user changes anything by hand. */
  suspend(): void {
    this.suspended = SUSPEND
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
   * VIEW_HOLD (30s) since the last one, the same suggestion held for
   * VIEW_STABLE (30s), and a boundary that is either over BOUNDARY or has
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
  } {
    return {
      suspended: Math.max(0, this.suspended),
      tillColour: Math.max(0, COLOUR_HOLD - this.sinceColour),
      tillView: Math.max(0, VIEW_HOLD - this.sinceView),
      candidate: this.candidate,
      candidateHeld: this.candidateHeld,
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
   */
  update(
    c: Character,
    dt: number,
    current: { geoColour: GeoColour; atmosphericView: AtmosphericViewName },
  ): Directives | null {
    this.sinceColour += dt
    this.sinceView += dt

    if (this.suspended > 0) {
      this.suspended -= dt
      // The stability timer keeps running while suspended, so resuming does not
      // start from a standing start — but nothing is emitted.
      this.track(c, dt)
      return null
    }

    this.track(c, dt)

    // Long-scale history has to exist before any of this means anything. Before
    // the buffer is warm the flavour axes are still converging from their
    // initial values, and acting on them is acting on the initial values.
    if (!c.warm) return null

    const out: Directives = {}

    const wanted = colourFor(c)
    if (
      this.sinceColour >= COLOUR_HOLD &&
      distance(wanted, current.geoColour) >= COLOUR_MIN_STEP &&
      c.noveltyMedium >= requiredNovelty(this.sinceColour - COLOUR_HOLD)
    ) {
      out.geoColour = wanted
      this.sinceColour = 0
    }

    if (
      this.sinceView >= VIEW_HOLD &&
      this.candidate !== null &&
      this.candidate !== current.atmosphericView &&
      this.candidateHeld >= VIEW_STABLE &&
      c.noveltyMedium >= requiredNovelty(this.sinceView - VIEW_HOLD)
    ) {
      out.atmosphericView = this.candidate
      this.sinceView = 0
    }

    return out.geoColour || out.atmosphericView ? out : null
  }

  /** Hysteresis on the programme suggestion: a new answer has to persist. */
  private track(c: Character, dt: number): void {
    const suggestion = viewFor(c)
    if (suggestion === this.candidate) {
      this.candidateHeld += dt
    } else {
      this.candidate = suggestion
      this.candidateHeld = 0
    }
  }
}
