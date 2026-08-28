/**
 * The audio analysis engine.
 *
 * One microphone in, two timescales out. Everything in here is about
 * *listening*; nothing in here knows that a screen exists.
 *
 *   capture.ts   getUserMedia → AnalyserNode → AudioFrame
 *   fast.ts      AudioFrame → Motion       10 ms – 4 s   (swappable strategies)
 *   slow.ts      AudioFrame → Character    30 s – 5 min
 *   features.ts  descriptors both tiers share
 *   ripples.ts   the transient → event-buffer edge detector
 *
 * This became a directory when the slow tier arrived. Before that there was one
 * interpretation of the captured audio living behind an interface, which is a
 * guess about the future; two is a fact about the present, and the moment the
 * second one existed the boundary was worth naming. `ripples.ts` came along
 * because it never belonged where it was: it is a pure edge-triggered state
 * machine over `(transient, breakdown)` with no imports, and it sat on the
 * rendering side only because `MAX_RIPPLES` has to match a GLSL constant.
 *
 * The two tiers are deliberately not symmetrical. `Motion` is consumed every
 * frame and drives movement. `Character` is consumed as *decisions* — see
 * director.ts, which is outside this directory because it is policy, and policy
 * fails differently from measurement.
 *
 * Nothing here touches the DOM, uses a global, or reads a clock; time arrives
 * as `dt` on the frame. That is what lets the whole chain run under
 * `node --experimental-strip-types` against synthetic input, which is the only
 * practical way to tune anything with a timescale longer than a few seconds.
 * Value imports between these files therefore carry the `.ts` extension, which
 * Node requires and the bundler does not mind.
 */

export { startMicrophone, MAX_DB, MIN_DB } from './capture.ts'
export type { AudioFrame, AudioSource } from './capture.ts'

export { MAPPINGS } from './fast.ts'
export type { Mapping, MappingName, VisualParams } from './fast.ts'

export { StructureAnalysis, bandVector, BAND_EDGES, N_BANDS } from './features.ts'
export type { Features } from './features.ts'

export { SlowAnalysis, BLANK } from './slow.ts'
export type { Character } from './slow.ts'

export { createRippleState, updateRipples, MAX_RIPPLES } from './ripples.ts'
export type { RippleState } from './ripples.ts'
