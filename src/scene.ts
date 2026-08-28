/**
 * Three.js setup for a single fullscreen fragment shader.
 *
 * There is no scene graph worth the name here — one quad, one material. Three
 * is carrying the WebGL state management, resize handling and context-loss
 * plumbing, not a 3D scene.
 */

import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector4,
  WebGLRenderer,
} from 'three'

import type { VisualParams } from './mapping'
import vertexShader from './shaders/fullscreen.vert.glsl?raw'
import { VIEWS, type ViewName } from './views'

/** Texels in the instantaneous spectrum texture. 128 reads smoothly. */
const SPECTRUM_SIZE = 128

/**
 * Rolling spectrogram uploaded to the GPU: one column per time slot, one row
 * per log-spaced frequency band.
 *
 * This is the answer to "can the GPU process the sound". It cannot usefully do
 * the FFT — the browser's AnalyserNode already does that in native code, and
 * moving it to a fragment shader would be slower and far more complex. What the
 * GPU can do that the CPU cannot is hold the *history* and read all of it, for
 * every pixel, every frame. 256x64 texels is 16 KB; sampling it costs one
 * texture fetch. Reconstructing the same thing on the CPU per pixel is not
 * remotely possible.
 *
 * 256 columns at HISTORY_HZ gives ~8.5 seconds — long enough to see a phrase.
 */
const HISTORY_W = 256
const HISTORY_H = 64
const HISTORY_HZ = 30

/**
 * Pixel-ratio ladder for the adaptive resolution scaler.
 *
 * This shader is fill-rate bound: three fbm lookups per pixel, four octaves
 * each. Resolution is therefore the dominant performance lever by a wide
 * margin, and the right value is not knowable in advance — a phone reporting
 * devicePixelRatio 3 might comfortably run 2.0 or might not manage 1.25.
 *
 * Measured 52fps on a real device at a fixed 2.0, which is close enough to the
 * edge that any added shader work would have pushed it under. Rather than
 * guessing a lower constant and giving up sharpness on hardware that never
 * needed to, the renderer now measures itself and settles wherever it can hold
 * frame rate.
 */
const RATIO_LADDER = [1.0, 1.25, 1.5, 1.75, 2.0]

/** Step down above this frame time (~53fps), up below that one (~72fps). */
const SLOW_MS = 18.5
const FAST_MS = 13.8
/** Seconds to hold a new rung before considering another change. */
const SETTLE = 1.5

export interface Visualiser {
  render(params: VisualParams, spectrum: Uint8Array): void
  resize(): void
  dispose(): void
  /** Swap the active visualiser. Recompiles a shader; not a per-frame call. */
  setView(name: ViewName): void
  /** Re-roll the seed the current view uses for whatever it doesn't get from audio. */
  randomise(): void
  /** Smoothed frame time in ms, and the pixel ratio currently in use. */
  stats(): { frameMs: number; pixelRatio: number }
}

export function createVisualiser(canvas: HTMLCanvasElement, view: ViewName): Visualiser {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false, // pointless for a full-screen noise field, and not cheap
    alpha: false,
    powerPreference: 'high-performance',
  })

  // Start at the top of the ladder the device actually supports and let the
  // scaler walk down if it cannot hold the frame rate.
  let rung = RATIO_LADDER.length - 1
  while (rung > 0 && RATIO_LADDER[rung] > window.devicePixelRatio) rung--

  const scene = new Scene()
  // Geometry is authored directly in clip space; the camera exists only because
  // WebGLRenderer.render() demands one.
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const spectrumData = new Uint8Array(SPECTRUM_SIZE)
  const spectrumTexture = new DataTexture(
    spectrumData,
    SPECTRUM_SIZE,
    1,
    RedFormat,
    UnsignedByteType,
  )
  spectrumTexture.minFilter = LinearFilter
  spectrumTexture.magFilter = LinearFilter
  spectrumTexture.wrapS = ClampToEdgeWrapping
  spectrumTexture.wrapT = ClampToEdgeWrapping
  spectrumTexture.needsUpdate = true

  // Log-spaced bin ranges for the history rows, precomputed once. Linear rows
  // would spend most of the texture on the top two octaves, where music has
  // least going on.
  const historyBins: Array<[number, number]> = []
  {
    const maxBin = SPECTRUM_SIZE
    for (let r = 0; r < HISTORY_H; r++) {
      const f0 = Math.pow(maxBin, r / HISTORY_H)
      const f1 = Math.pow(maxBin, (r + 1) / HISTORY_H)
      historyBins.push([Math.floor(f0), Math.max(Math.floor(f0) + 1, Math.ceil(f1))])
    }
  }

  const historyData = new Uint8Array(HISTORY_W * HISTORY_H)
  const historyTexture = new DataTexture(
    historyData,
    HISTORY_W,
    HISTORY_H,
    RedFormat,
    UnsignedByteType,
  )
  historyTexture.minFilter = LinearFilter
  historyTexture.magFilter = LinearFilter
  historyTexture.wrapS = RepeatWrapping // time wraps: it is a ring buffer
  historyTexture.wrapT = ClampToEdgeWrapping
  historyTexture.needsUpdate = true

  const uniforms = {
    uResolution: { value: new Vector2(1, 1) },
    uTime: { value: 0 },
    uFlow: { value: 0 },
    uLevel: { value: 0 },
    uLow: { value: 0 },
    uMid: { value: 0 },
    uHigh: { value: 0 },
    uTransient: { value: 0 },
    uTilt: { value: 0.5 },
    uBreak: { value: 0 },
    uSurge: { value: 0 },
    uNovelty: { value: 0 },
    uRoughness: { value: 0.5 },
    uSpectrum: { value: spectrumTexture },
    uHistory: { value: historyTexture },
    // Where "now" sits in the ring buffer, 0-1. The shader walks backwards from
    // here to read into the past.
    uHistoryHead: { value: 0 },
    // Four free numbers, re-rolled on demand (space bar, double-tap, double
    // click). Audio drives everything else here; this is the one thing a
    // person gets to reach in and change directly. Each view is free to spend
    // its four components however suits its own look — scene.ts hands them
    // out and stays agnostic, same as with the fragment shader itself.
    uSeed: { value: new Vector4(Math.random(), Math.random(), Math.random(), Math.random()) },
  }

  let material = new ShaderMaterial({
    vertexShader,
    fragmentShader: VIEWS[view].fragmentShader,
    uniforms,
  })
  const geometry = new PlaneGeometry(2, 2)
  const mesh = new Mesh(geometry, material)
  scene.add(mesh)

  // Motion clock. Integrated from the audio level rather than read from the
  // wall clock, so the field accumulates movement while there is sound and
  // coasts to a near-stop in silence. A break nearly freezes it, which is a
  // large part of why a break is legible at all.
  let flow = 0
  let elapsed = 0
  let frameMs = 16.7
  let sinceChange = 0
  let historyHead = 0
  let historyAccum = 0
  let contextLost = false

  const onContextLost = (event: Event) => {
    // Without preventDefault, Three never gets the restore event. Mobile
    // browsers drop the context whenever the tab is backgrounded for a while,
    // so this is a normal occurrence, not an error path.
    event.preventDefault()
    contextLost = true
  }
  const onContextRestored = () => {
    contextLost = false
    spectrumTexture.needsUpdate = true
  }
  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('webglcontextrestored', onContextRestored)

  function applySize() {
    renderer.setPixelRatio(RATIO_LADDER[rung])
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    // Uniform wants the drawing-buffer size, not the CSS size — they differ by
    // the pixel ratio, and using CSS pixels here makes the shader's aspect
    // correction subtly wrong on every retina device.
    renderer.getDrawingBufferSize(uniforms.uResolution.value)
  }
  applySize()

  /** Walk the ladder towards whatever rung holds the frame rate. */
  function adapt(dt: number) {
    sinceChange += dt
    if (sinceChange < SETTLE) return

    if (frameMs > SLOW_MS && rung > 0) {
      rung--
      sinceChange = 0
      applySize()
    } else if (
      frameMs < FAST_MS &&
      rung < RATIO_LADDER.length - 1 &&
      RATIO_LADDER[rung + 1] <= window.devicePixelRatio
    ) {
      rung++
      sinceChange = 0
      applySize()
    }
  }

  return {
    render(params, spectrum) {
      if (contextLost) return

      // Downsample the analyser's bins into the texture by taking the max of
      // each group. Averaging washes out narrow peaks, which are exactly the
      // detail the rings are there to show.
      const stride = spectrum.length / SPECTRUM_SIZE
      for (let i = 0; i < SPECTRUM_SIZE; i++) {
        const start = Math.floor(i * stride)
        const end = Math.min(spectrum.length, Math.floor((i + 1) * stride))
        let peak = 0
        for (let j = start; j < end; j++) if (spectrum[j] > peak) peak = spectrum[j]
        spectrumData[i] = peak
      }
      spectrumTexture.needsUpdate = true

      // dt is recomputed here from the renderer's own clock rather than passed
      // in, so flow stays correct even if a mapping is swapped mid-run.
      const now = performance.now() / 1000
      const dt = elapsed === 0 ? 1 / 60 : Math.min(now - elapsed, 1 / 15)
      elapsed = now
      frameMs += (dt * 1000 - frameMs) * 0.05
      adapt(dt)

      // Advance the rolling spectrogram at a fixed rate rather than once per
      // rendered frame, so the time axis means the same thing regardless of
      // frame rate — and so the visible history length does not change when the
      // resolution scaler moves.
      historyAccum += dt
      if (historyAccum >= 1 / HISTORY_HZ) {
        historyAccum %= 1 / HISTORY_HZ
        for (let r = 0; r < HISTORY_H; r++) {
          const [b0, b1] = historyBins[r]
          let peak = 0
          for (let b = b0; b < b1 && b < SPECTRUM_SIZE; b++) {
            if (spectrumData[b] > peak) peak = spectrumData[b]
          }
          historyData[r * HISTORY_W + historyHead] = peak
        }
        historyHead = (historyHead + 1) % HISTORY_W
        historyTexture.needsUpdate = true
      }

      // A break stalls the motion rather than merely dimming it.
      const churn =
        0.06 + params.level * 0.95 + params.transient * 0.6 + params.surge * 1.5
      flow += churn * (1 - 0.85 * params.breakdown) * dt

      uniforms.uTime.value = now
      uniforms.uFlow.value = flow
      uniforms.uLevel.value = params.level
      uniforms.uLow.value = params.low
      uniforms.uMid.value = params.mid
      uniforms.uHigh.value = params.high
      uniforms.uTransient.value = params.transient
      uniforms.uTilt.value = params.tilt
      uniforms.uBreak.value = params.breakdown
      uniforms.uSurge.value = params.surge
      uniforms.uNovelty.value = params.novelty
      uniforms.uRoughness.value = params.roughness
      uniforms.uHistoryHead.value = historyHead / HISTORY_W

      renderer.render(scene, camera)
    },

    resize: applySize,

    setView(name) {
      // The uniforms object is shared by reference, so the new material picks up
      // the current audio state immediately and the switch does not flicker
      // through a frame of zeros.
      const next = new ShaderMaterial({
        vertexShader,
        fragmentShader: VIEWS[name].fragmentShader,
        uniforms,
      })
      mesh.material = next
      material.dispose()
      material = next
    },

    randomise() {
      uniforms.uSeed.value.set(Math.random(), Math.random(), Math.random(), Math.random())
    },

    stats: () => ({ frameMs, pixelRatio: RATIO_LADDER[rung] }),

    dispose() {
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      geometry.dispose()
      material.dispose()
      spectrumTexture.dispose()
      historyTexture.dispose()
      renderer.dispose()
    },
  }
}
