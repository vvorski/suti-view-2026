/**
 * How the phone is currently being held, classified into a handful of named
 * postures so the director (docs/todo.md entry 89) can pace itself
 * differently on a table than in a car than on a dancefloor — docs/todo.md
 * entry 90.
 *
 * The app already has one number for handling, `disturb`, and it cannot
 * separate a car from a dancefloor: both sit at broadly the same, modest
 * level. **The discriminator that makes this possible is periodicity, not
 * level** — a walking gait has a strong ~2 Hz component a car's broadband
 * hum does not, and dancing is a gait-band component that additionally
 * correlates with the tempo the beat tracker (entry 75) already reports.
 *
 * Pure state and a pure update function, same discipline as
 * `motion-bias.ts`: no DOM, no clock of its own. It reads `disturb`; it
 * never writes it — `disturb` feeds the frozen RGB slip (entry 76) and the
 * approved colour bias (entry 70), and this classifier changes neither.
 */

export type Posture = 'still' | 'carried' | 'driving' | 'dancing' | 'handled'

/** Slow mean of `disturb` — "sustained" rather than instantaneous, so a
 *  single frame's spike or dip cannot flip the level band. Long enough that
 *  a traffic-light stop (a few seconds near zero) does not read as the level
 *  actually having dropped. **Mine**. */
const LEVEL_TAU = 8

/** Below this slow level, the phone reads as not moving at all. **Mine**. */
const STILL_MAX = 0.03

/** At or above this level, or with a shake event this frame, the posture is
 *  `handled` outright — Decided's own "high disturb, reversals — the shake
 *  path, which already exists". A shake event is the more direct half of
 *  that (reversals are what `shake.ts` already counted to fire it); the
 *  level floor is what catches someone still handling the phone in the
 *  frames around a shake, not another shake in the window right after it
 *  runs out. **Mine**. */
const HANDLED_LEVEL = 0.5

/** The gait-band search, sampled independently of the render rate. 10 Hz is
 *  comfortably past Nyquist for anything up to ~4 Hz, which a stride's own
 *  period never approaches. */
const GAIT_HZ = 10
/** 12 seconds, 24-26 gait cycles at a normal walking cadence. Longer than a
 *  first guess of "a few strides" — the probe is what settled this: the gait
 *  band search only ever has 6-8 candidate lags (a walking cadence is a
 *  narrow range), and with that few, band-limited noise routinely produces
 *  a spurious "best" lag that reads as real periodicity at a shorter
 *  window. 12 seconds, combined with the strength smoothing below, is what
 *  the probe's own car-hum trace needed to stop being read as a gait.
 *  **Mine**. */
const GAIT_SECONDS = 12
const GAIT_N = GAIT_HZ * GAIT_SECONDS
/** 1.1-2.8 Hz — a normal walking cadence with margin either side, in lags at
 *  `GAIT_HZ`. */
const GAIT_LAG_MIN = Math.floor(GAIT_HZ / 2.8)
const GAIT_LAG_MAX = Math.ceil(GAIT_HZ / 1.1)
/** How long the raw, per-tick periodicity reading is smoothed before it is
 *  compared against `GAIT_STRENGTH_MIN` — the other half of what the window
 *  length alone could not fix. A single autocorrelation over noise still
 *  spikes occasionally; a real gait's own strength sits near 1.0 on every
 *  tick, so smoothing costs the real signal almost nothing while it
 *  averages a noise trace's spikes back down. **Mine**, and tuned with
 *  `GAIT_SECONDS` above as one pair against the same probe trace. */
const PERIODIC_TAU = 8
/** Comfortably above what the probe's own broadband-hum trace reaches once
 *  smoothed (≈0.33) and below what a real gait settles at (≈0.95-1.0) — see
 *  `GAIT_SECONDS`'s own comment for how these two numbers were arrived at
 *  together. **Mine**. */
const GAIT_STRENGTH_MIN = 0.5

/** Beat-tracker confidence above which its own `bpm` is trusted — the same
 *  figure `fast.ts`'s `BEAT_LOCK_CONFIDENCE` uses for the identical
 *  question, kept in step rather than re-derived. */
const DANCE_CONFIDENCE_MIN = 0.5
/** How close the gait band's own frequency has to sit to the beat's (or half
 *  of it, moving once every two beats) to call it dancing rather than a
 *  coincidence. **Mine**. */
const DANCE_TEMPO_TOLERANCE = 0.15

/** Minimum time a raw classification has to hold before it is reported —
 *  Decided's own "~10s", so the posture cannot chatter between two readings
 *  at a boundary. This is also the hysteresis: a transient candidate that
 *  never persists this long never displaces the one already showing.
 *  **Mine** as to the exact figure. */
const POSTURE_DWELL = 10

export interface PostureState {
  level: number
  gait: Float32Array
  gaitHead: number
  gaitFilled: number
  gaitAccum: number
  periodicHz: number
  /** The raw, per-tick autocorrelation reading — noisy, and never compared
   *  against `GAIT_STRENGTH_MIN` directly. See `PERIODIC_TAU`. */
  rawPeriodicStrength: number
  /** Smoothed over `PERIODIC_TAU` — this is what classification reads. */
  periodicStrength: number
  /** The lag the last *successful* autocorrelation actually found — kept
   *  across a tick that could not compute one (too little variance to say
   *  anything), so `periodicHz` never reports the search range's own floor
   *  as if it meant something during a brief dip. */
  lastLag: number
  candidate: Posture
  candidateHeld: number
  posture: Posture
}

export function createPostureState(): PostureState {
  return {
    level: 0,
    gait: new Float32Array(GAIT_N),
    gaitHead: 0,
    gaitFilled: 0,
    gaitAccum: 0,
    periodicHz: 0,
    rawPeriodicStrength: 0,
    periodicStrength: 0,
    lastLag: GAIT_LAG_MIN,
    candidate: 'still',
    candidateHeld: 0,
    posture: 'still',
  }
}

export interface PostureReading {
  posture: Posture
  /** For the readout — entry 88's live threshold and entry 66's want/armed
   *  are the precedent this entry cites for reporting a silent classifier. */
  candidate: Posture
  candidateHeld: number
  periodicHz: number
  periodicStrength: number
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Autocorrelation over the gait ring buffer, same construction as
 * `slow.ts`'s `computeTempo`: the winning lag's height above the search
 * range's own mean is what separates a real periodicity from the highest
 * bump on a noise floor, and its position is the frequency.
 *
 * The raw per-tick reading still isn't smooth enough to threshold directly —
 * a narrow, 6-8-lag search over a bounded window makes noise's own spurious
 * "best" lag a routine occurrence, not a rare one, so the result is smoothed
 * over `PERIODIC_TAU` before classification ever looks at it. Called once
 * per decimated gait tick, so `dt` here is always `1 / GAIT_HZ`.
 */
function updateGait(state: PostureState, dt: number): void {
  let raw = 0

  if (state.gaitFilled >= GAIT_N) {
    let mean = 0
    for (let i = 0; i < GAIT_N; i++) mean += state.gait[i]
    mean /= GAIT_N

    let variance = 0
    for (let i = 0; i < GAIT_N; i++) {
      const v = state.gait[i] - mean
      variance += v * v
    }
    variance /= GAIT_N

    // Same absolute floor as slow.ts's own tempo detector, and for the same
    // reason: a phone lying still is nearly-constant and tiny, and dividing
    // two small numbers can report a confident, invented periodicity.
    if (mean >= 0.01 && Math.sqrt(variance) >= 0.005) {
      let bestLag = GAIT_LAG_MIN
      let bestVal = -Infinity
      let acfSum = 0
      let acfN = 0
      for (let lag = GAIT_LAG_MIN; lag <= GAIT_LAG_MAX; lag++) {
        let acc = 0
        for (let i = lag; i < GAIT_N; i++) {
          const a = state.gait[(state.gaitHead + i) % GAIT_N] - mean
          const b = state.gait[(state.gaitHead + i - lag) % GAIT_N] - mean
          acc += a * b
        }
        acc /= GAIT_N - lag
        acfSum += acc
        acfN++
        if (acc > bestVal) {
          bestVal = acc
          bestLag = lag
        }
      }
      const contrast = (bestVal - acfSum / acfN) / variance
      raw = clamp01(contrast * 2.2)
      state.lastLag = bestLag
    }
  }

  state.rawPeriodicStrength = raw
  state.periodicStrength += (raw - state.periodicStrength) * (1 - Math.exp(-dt / PERIODIC_TAU))
  state.periodicHz = state.periodicStrength >= GAIT_STRENGTH_MIN ? GAIT_HZ / state.lastLag : 0
}

/** Within `DANCE_TEMPO_TOLERANCE` of the beat's own frequency, or of half
 *  of it — moving every beat and moving every two beats are both dancing;
 *  nothing here claims to know which a given track calls for. */
function matchesTempo(gaitHz: number, beatHz: number): boolean {
  const close = (a: number, b: number): boolean => Math.abs(a - b) / b < DANCE_TEMPO_TOLERANCE
  return close(gaitHz, beatHz) || close(gaitHz, beatHz / 2)
}

/**
 * Call once per rendered frame. `disturb` is `TumbleState.disturb`;
 * `shaking` is whether this frame's `ShakeFrame.events` carried a strong or
 * double event — the direct half of "handled", reversals already counted by
 * `shake.ts`. `bpm`/`beatConfidence` are `VisualParams`'s own, already fed
 * to `Director.update()` for entry 81's bar quantisation.
 */
export function updatePosture(
  state: PostureState,
  dt: number,
  disturb: number,
  shaking: boolean,
  bpm: number,
  beatConfidence: number,
): PostureReading {
  state.level += (disturb - state.level) * (1 - Math.exp(-dt / LEVEL_TAU))

  state.gaitAccum += dt
  if (state.gaitAccum >= 1 / GAIT_HZ) {
    state.gaitAccum %= 1 / GAIT_HZ
    state.gait[state.gaitHead] = disturb
    state.gaitHead = (state.gaitHead + 1) % GAIT_N
    state.gaitFilled = Math.min(state.gaitFilled + 1, GAIT_N)
    updateGait(state, 1 / GAIT_HZ)
  }

  let raw: Posture
  if (shaking || state.level >= HANDLED_LEVEL) {
    raw = 'handled'
  } else if (state.level < STILL_MAX) {
    raw = 'still'
  } else if (state.periodicHz > 0) {
    const dancing =
      bpm > 0 && beatConfidence >= DANCE_CONFIDENCE_MIN && matchesTempo(state.periodicHz, bpm / 60)
    raw = dancing ? 'dancing' : 'carried'
  } else {
    raw = 'driving'
  }

  if (raw === state.candidate) {
    state.candidateHeld += dt
  } else {
    state.candidate = raw
    state.candidateHeld = 0
  }
  if (state.candidateHeld >= POSTURE_DWELL) state.posture = state.candidate

  return {
    posture: state.posture,
    candidate: state.candidate,
    candidateHeld: state.candidateHeld,
    periodicHz: state.periodicHz,
    periodicStrength: state.periodicStrength,
  }
}
