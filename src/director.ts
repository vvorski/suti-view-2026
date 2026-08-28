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
 *   second opinion, and an autopilot that overrides a deliberate choice thirty
 *   seconds later is worse than no autopilot.
 *
 *   NEVER ARRIVE UNANNOUNCED. A change only lands on a section boundary. The
 *   novelty curve is already there, so a new palette can coincide with the
 *   music changing rather than turning up in the middle of a phrase. This is
 *   the single thing that makes the difference between reading as "it is
 *   listening" and reading as "it is drifting".
 *
 *   NEVER FLICKER. Every categorical decision goes through a dead band and has
 *   to hold its new answer for a while before it counts. A classification that
 *   oscillates between two nearly-tied options is worse than one that is
 *   slightly wrong and stable.
 */

import type { GeoColour } from './geo-colour'
import type { Character } from './engine'
import type { AtmosphericViewName } from './views'

/** Seconds of hands-off after any manual change. Long, deliberately: this is
 *  about three tracks. */
const SUSPEND = 180

/** A change rides in on a boundary at least this novel. */
const BOUNDARY = 0.45

/** Minimum seconds between changes of each kind. Colour is cheap to accept and
 *  can move with the sections; a programme swap replaces the whole picture and
 *  should feel like it belongs to a movement, not a verse. */
const COLOUR_HOLD = 45
const VIEW_HOLD = 120

/** A suggested programme must be the suggestion for this long before it is
 *  acted on — the dead band that stops two near-tied options alternating. */
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
 * Deliberately coarse — four buckets on two axes. A finer rule would need
 * confidence this measurement does not have, and every extra branch is another
 * boundary where two options can tie.
 */
export function viewFor(c: Character): AtmosphericViewName {
  if (c.rhythmic > 0.5) return c.dense > 0.4 ? 'lattice' : 'spectrogram'
  return c.bright > 0.55 ? 'aurora' : 'field'
}

const distance = (a: GeoColour, b: GeoColour): number =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b)

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
   * Advance and decide. Returns null when there is nothing to do, which is
   * almost always — a boundary that carries a change comes along every couple
   * of minutes at most.
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

    // Everything below rides in on a boundary.
    if (c.noveltyMedium < BOUNDARY) return null

    const out: Directives = {}

    const wanted = colourFor(c)
    if (this.sinceColour >= COLOUR_HOLD && distance(wanted, current.geoColour) >= COLOUR_MIN_STEP) {
      out.geoColour = wanted
      this.sinceColour = 0
    }

    if (
      this.sinceView >= VIEW_HOLD &&
      this.candidate !== null &&
      this.candidate !== current.atmosphericView &&
      this.candidateHeld >= VIEW_STABLE
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
