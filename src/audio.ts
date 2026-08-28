/**
 * Microphone capture and per-frame spectral extraction.
 *
 * This module deliberately knows nothing about what the visuals do with the
 * numbers. It hands out a raw `AudioFrame`; turning that into something a
 * shader can use is `mapping.ts`'s job, because that mapping is the part we
 * expect to rewrite several times.
 */

export interface AudioFrame {
  /** Frequency magnitudes, 0-255, one per bin, low frequency first. */
  freq: Uint8Array
  /** Time-domain waveform, 0-255 centred on 128. */
  time: Uint8Array
  /** Number of frequency bins (= fftSize / 2). */
  binCount: number
  /** Hardware sample rate, needed to convert a bin index to Hz. */
  sampleRate: number
  /** Seconds since the previous frame, clamped to something sane. */
  dt: number
}

export interface AudioSource {
  frame(): AudioFrame
  /** Hz covered by one bin — bin `i` is centred at `i * binHz`. */
  readonly binHz: number
  close(): void
}

const FFT_SIZE = 2048

/**
 * Ask for the microphone and wire up an AnalyserNode.
 *
 * MUST be called from inside a user-gesture handler: iOS Safari will hand back
 * an AudioContext stuck in "suspended" otherwise, and the visuals sit frozen
 * with no error to explain why.
 */
export async function startMicrophone(): Promise<AudioSource> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // All three of these fight us. They are tuned to make speech intelligible
      // on a call, which means ducking exactly the ambient texture and dynamic
      // range the visuals feed on. AGC in particular would flatten the slow
      // swell-and-decay shape we are trying to render.
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  })

  const ctx = new AudioContext()
  // Safari can still hand back a suspended context even inside a gesture.
  if (ctx.state === 'suspended') await ctx.resume()

  const analyser = ctx.createAnalyser()
  analyser.fftSize = FFT_SIZE
  // Kept low deliberately. This smoother is free (it runs in the browser's own
  // code) but it stacks with the envelopes in mapping.ts, and two smoothers in
  // series read as lag rather than smoothness. Onset detection in particular
  // wants the raw frame-to-frame difference — that is the signal.
  analyser.smoothingTimeConstant = 0.3
  analyser.minDecibels = -95
  analyser.maxDecibels = -10

  ctx.createMediaStreamSource(stream).connect(analyser)
  // Deliberately not connected to ctx.destination: routing the mic to the
  // speakers is a feedback loop.

  const binCount = analyser.frequencyBinCount
  const freq = new Uint8Array(binCount)
  const time = new Uint8Array(binCount)
  let last = performance.now()

  return {
    binHz: ctx.sampleRate / FFT_SIZE,

    frame(): AudioFrame {
      analyser.getByteFrequencyData(freq)
      analyser.getByteTimeDomainData(time)

      const now = performance.now()
      // Clamp: a backgrounded tab returns for its first frame with a dt of
      // several seconds, which would slam every envelope to its target at once.
      const dt = Math.min((now - last) / 1000, 1 / 15)
      last = now

      return { freq, time, binCount, sampleRate: ctx.sampleRate, dt }
    },

    close() {
      for (const track of stream.getTracks()) track.stop()
      void ctx.close()
    },
  }
}
