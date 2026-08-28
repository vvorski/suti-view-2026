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
 * Cap the device pixel ratio.
 *
 * A modern phone reports 3, which on a full-screen fragment shader means
 * rendering ~9x the pixels of a DPR-1 pass. This shader is fill-rate bound, so
 * that is the single biggest performance lever in the project. 2 is the point
 * where the noise still looks smooth but the frame budget holds.
 */
const MAX_PIXEL_RATIO = 2

export interface Visualiser {
  render(params: VisualParams, spectrum: Uint8Array): void
  resize(): void
  dispose(): void
}

export function createVisualiser(canvas: HTMLCanvasElement): Visualiser {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false, // pointless for a full-screen noise field, and not cheap
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))

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
    uSpectrum: { value: spectrumTexture },
  }

  const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms })
  const geometry = new PlaneGeometry(2, 2)
  scene.add(new Mesh(geometry, material))

  // Motion clock. Integrated from the audio level rather than read from the
  // wall clock, so the field accumulates movement while there is sound and
  // coasts to a near-stop in silence — the swell-and-decay behaviour the
  // reference recording is all about. The floor keeps it barely alive.
  let flow = 0
  let elapsed = 0
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

  function resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
    renderer.setSize(w, h, false)
    // Uniform wants the drawing-buffer size, not the CSS size — they differ by
    // the pixel ratio, and using CSS pixels here makes the shader's aspect
    // correction subtly wrong on every retina device.
    renderer.getDrawingBufferSize(uniforms.uResolution.value)
  }
  resize()

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

      flow += (0.06 + params.level * 0.85 + params.transient * 0.5) * dt

      uniforms.uTime.value = now
      uniforms.uFlow.value = flow
      uniforms.uLevel.value = params.level
      uniforms.uLow.value = params.low
      uniforms.uMid.value = params.mid
      uniforms.uHigh.value = params.high
      uniforms.uTransient.value = params.transient

      renderer.render(scene, camera)
    },

    resize,

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
