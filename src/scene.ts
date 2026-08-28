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
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderer,
} from 'three'

import type { VisualParams } from './mapping'
import fragmentShader from './shaders/visualiser.frag.glsl?raw'
import vertexShader from './shaders/visualiser.vert.glsl?raw'

/** Texels in the spectrum texture. 128 is plenty — the shader reads it smoothly. */
const SPECTRUM_SIZE = 128

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
  /** Smoothed frame time in ms, and the pixel ratio currently in use. */
  stats(): { frameMs: number; pixelRatio: number }
}

export function createVisualiser(canvas: HTMLCanvasElement): Visualiser {
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
    uSpectrum: { value: spectrumTexture },
  }

  const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms })
  const geometry = new PlaneGeometry(2, 2)
  scene.add(new Mesh(geometry, material))

  // Motion clock. Integrated from the audio level rather than read from the
  // wall clock, so the field accumulates movement while there is sound and
  // coasts to a near-stop in silence. A break nearly freezes it, which is a
  // large part of why a break is legible at all.
  let flow = 0
  let elapsed = 0
  let frameMs = 16.7
  let sinceChange = 0
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

      renderer.render(scene, camera)
    },

    resize: applySize,

    stats: () => ({ frameMs, pixelRatio: RATIO_LADDER[rung] }),

    dispose() {
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      geometry.dispose()
      material.dispose()
      spectrumTexture.dispose()
      renderer.dispose()
    },
  }
}
