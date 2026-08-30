/**
 * The repo's own definition of "a song" — docs/todo.md entry 37.
 *
 * Originally inline in probe-mapping.ts's "a real breakdown" section, moved
 * out here so `views-probe.html`'s driven mode and the node probe drive the
 * exact same signal rather than two copies that will quietly diverge. 15
 * seconds: 6s of music, 3s of breakdown, 6s back in, a steady 120bpm
 * four-on-the-floor hit throughout the music — see probe-mapping.ts's own
 * comments on why a beat pattern and a real breakdown are both worth
 * exercising.
 *
 * `.ts` extensions on the one value import: Node's ESM resolver requires
 * them (see engine/index.ts's own comment) and the bundler does not mind.
 */

import { type AudioFrame } from '../src/engine/capture.ts'

const SAMPLE_RATE = 48000
const BINS = 1024
const BIN_HZ = SAMPLE_RATE / (BINS * 2)

export const TRACK_LENGTH = 15 // seconds
export const TRACK_BREAKDOWN_START = 6
export const TRACK_BREAKDOWN_END = 9

/** A frame with flat energy in each named band, given as 0-255 byte levels.
 *  `dt` defaults to a steady 60fps; callers driving a real frame loop pass
 *  their own. */
export function frame(low: number, mid: number, high: number, dt = 1 / 60): AudioFrame {
  const freq = new Uint8Array(BINS)
  for (let i = 0; i < BINS; i++) {
    const hz = i * BIN_HZ
    if (hz >= 40 && hz < 250) freq[i] = low
    else if (hz >= 250 && hz < 1600) freq[i] = mid
    else if (hz >= 1600 && hz < 8000) freq[i] = high
  }
  return { freq, time: new Uint8Array(BINS), binCount: BINS, sampleRate: SAMPLE_RATE, dt }
}

/** Whether the track is playing (not in its breakdown) at time `t` seconds. */
export function trackPlaying(t: number): boolean {
  return t < TRACK_BREAKDOWN_START || t >= TRACK_BREAKDOWN_END
}

/** The frame the track produces at time `t` seconds, looping past
 *  `TRACK_LENGTH` rather than running out. */
export function trackFrame(t: number, dt: number): AudioFrame {
  const loop = t % TRACK_LENGTH
  const playing = trackPlaying(loop)
  const hit = playing && loop % 0.5 < 0.06
  return playing ? frame(hit ? 170 : 20, hit ? 120 : 45, hit ? 90 : 40, dt) : frame(2, 3, 2, dt)
}
