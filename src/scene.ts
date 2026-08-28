/**
 * Three.js setup for two composited fullscreen fragment shaders.
 *
 * There is no scene graph worth the name here — one quad, reused for three
 * passes. Three is carrying the WebGL state management, resize handling and
 * context-loss plumbing, not a 3D scene.
 *
 * The two layers — geometric and atmospheric — are picked independently and
 * composited, not switched between. Each renders to its own off-screen
 * target; a third pass samples both and blends them per the chosen merge
 * mode and mix, straight to the canvas. Reusing a single mesh across all
 * three passes (swap the material, swap the render target, render again)
 * avoids maintaining three parallel scenes for what is structurally the same
 * fullscreen-quad draw each time.
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
  WebGLRenderTarget,
} from 'three'

import { MERGE_MODES, type MergeModeName } from './merge-modes'
import type { VisualParams } from './mapping'
import { createRippleState, MAX_RIPPLES, updateRipples } from './ripples'
import compositeFrag from './shaders/composite.frag.glsl?raw'
import vertexShader from './shaders/fullscreen.vert.glsl?raw'
import {
  ATMOSPHERIC_VIEWS,
  GEOMETRIC_VIEWS,
  type AtmosphericViewName,
  type GeometricViewName,
} from './views'

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
 * The atmospheric shader is fill-rate bound on its own — three fbm lookups
 * per pixel, four octaves each — and compositing now costs two more full
 * passes on top of it (the geometric layer, then the blend). Resolution is
 * therefore the dominant performance lever by an even wider margin than
 * before, and the right value is still not knowable in advance. Measuring and
 * settling wherever the device can hold frame rate remains cheaper than
 * guessing a lower constant and giving up sharpness that some hardware never
 * needed to.
 */
const RATIO_LADDER = [1.0, 1.25, 1.5, 1.75, 2.0]

/** Step down above this frame time (~53fps), up below that one (~72fps). */
const SLOW_MS = 18.5
const FAST_MS = 13.8
/** Seconds to hold a new rung before considering another change. */
const SETTLE = 1.5

/** Novelty level a structural boundary must cross, rising, to auto-reroll the seed. */
const STRUCTURE_THRESHOLD = 0.5
/** Minimum seconds between automatic reshapes, so a boundary's own decay tail can't retrigger it. */
const STRUCTURE_COOLDOWN = 8

export interface VisualiserOptions {
  geometricView: GeometricViewName
  atmosphericView: AtmosphericViewName
  mergeMode: MergeModeName
  /** 0-1. Universal opacity: 0 is pure atmosphere, 1 is the full blend. */
  mix: number
}

export interface Visualiser {
  render(params: VisualParams, spectrum: Uint8Array): void
  resize(): void
  dispose(): void
  /** Swap the geometric layer's programme. Recompiles a shader; not a per-frame call. */
  setGeometricView(name: GeometricViewName): void
  /** Swap the atmospheric layer's programme. Recompiles a shader; not a per-frame call. */
  setAtmosphericView(name: AtmosphericViewName): void
  setMergeMode(mode: MergeModeName): void
  /** 0-1. */
  setMix(mix: number): void
  /** Re-roll the seed each view spends on whatever it doesn't get from audio. */
  randomise(): void
  /** Smoothed frame time in ms, and the pixel ratio currently in use. */
  stats(): { frameMs: number; pixelRatio: number }
}

export function createVisualiser(
  canvas: HTMLCanvasElement,
  options: VisualiserOptions,
): Visualiser {
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

  // Shared by both layers: audio state neither cares where it came from, and
  // sharing the object (rather than duplicating it per layer) is what lets a
  // layer swap pick up the current frame's state immediately instead of a
  // frame of zeros.
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
    // (birthTime, birthLevel) per active ring. Only the geometric layer's
    // event-driven views read this; see ripples.ts.
    uRipples: {
      value: Array.from({ length: MAX_RIPPLES }, () => new Vector2(-1000, 0)),
    },
  }

  let geometryMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader: GEOMETRIC_VIEWS[options.geometricView].fragmentShader,
    uniforms,
  })
  let atmosphereMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader: ATMOSPHERIC_VIEWS[options.atmosphericView].fragmentShader,
    uniforms,
  })

  const geometryTarget = new WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false })
  const atmosphereTarget = new WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    stencilBuffer: false,
  })

  const compositeUniforms = {
    uAtmosphere: { value: atmosphereTarget.texture },
    uGeometry: { value: geometryTarget.texture },
    uMix: { value: options.mix },
    uMode: { value: MERGE_MODES[options.mergeMode].index },
  }
  const compositeMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader: compositeFrag,
    uniforms: compositeUniforms,
  })

  const geometry = new PlaneGeometry(2, 2)
  // One mesh, reused across all three passes below — each pass swaps its
  // material in just before rendering.
  const mesh = new Mesh(geometry, geometryMaterial)
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
  const ripples = createRippleState()
  let lastNovelty = 0
  let lastAutoReroll = -1000

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

  const drawSize = new Vector2()

  function applySize() {
    renderer.setPixelRatio(RATIO_LADDER[rung])
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    // Uniform wants the drawing-buffer size, not the CSS size — they differ by
    // the pixel ratio, and using CSS pixels here makes the shader's aspect
    // correction subtly wrong on every retina device.
    renderer.getDrawingBufferSize(drawSize)
    uniforms.uResolution.value.copy(drawSize)
    geometryTarget.setSize(drawSize.x, drawSize.y)
    atmosphereTarget.setSize(drawSize.x, drawSize.y)
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

      updateRipples(ripples, now, params.transient, params.breakdown)
      for (let i = 0; i < MAX_RIPPLES; i++) {
        uniforms.uRipples.value[i].set(ripples.slots[i * 2], ripples.slots[i * 2 + 1])
      }

      // A real structural boundary re-rolls the seed on its own — same
      // rising-edge-plus-cooldown shape as ripples.ts's transient trigger, just
      // on `novelty` instead. Lattice spends the seed on its symmetry order,
      // node density, tunnel depth and spiral twist, so this is what makes a
      // section change a genuinely different shape rather than only a
      // different colour; every other view gets a smaller version of the same
      // "something changed" for free, since they all read the same seed.
      if (
        params.novelty > STRUCTURE_THRESHOLD &&
        lastNovelty <= STRUCTURE_THRESHOLD &&
        now - lastAutoReroll > STRUCTURE_COOLDOWN
      ) {
        uniforms.uSeed.value.set(Math.random(), Math.random(), Math.random(), Math.random())
        lastAutoReroll = now
      }
      lastNovelty = params.novelty

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

      // Three passes over the same quad: geometric layer to its target,
      // atmospheric layer to its target, then the composite reads both and
      // paints the canvas. autoClear defaults to true, so each pass starts
      // from a blank target — correct here since every view is a from-scratch
      // procedural render each frame, nothing accumulates across frames.
      mesh.material = geometryMaterial
      renderer.setRenderTarget(geometryTarget)
      renderer.render(scene, camera)

      mesh.material = atmosphereMaterial
      renderer.setRenderTarget(atmosphereTarget)
      renderer.render(scene, camera)

      mesh.material = compositeMaterial
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)
    },

    resize: applySize,

    setGeometricView(name) {
      const next = new ShaderMaterial({
        vertexShader,
        fragmentShader: GEOMETRIC_VIEWS[name].fragmentShader,
        uniforms,
      })
      geometryMaterial.dispose()
      geometryMaterial = next
    },

    setAtmosphericView(name) {
      const next = new ShaderMaterial({
        vertexShader,
        fragmentShader: ATMOSPHERIC_VIEWS[name].fragmentShader,
        uniforms,
      })
      atmosphereMaterial.dispose()
      atmosphereMaterial = next
    },

    setMergeMode(mode) {
      compositeUniforms.uMode.value = MERGE_MODES[mode].index
    },

    setMix(mix) {
      compositeUniforms.uMix.value = Math.min(1, Math.max(0, mix))
    },

    randomise() {
      uniforms.uSeed.value.set(Math.random(), Math.random(), Math.random(), Math.random())
    },

    stats: () => ({ frameMs, pixelRatio: RATIO_LADDER[rung] }),

    dispose() {
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      geometry.dispose()
      geometryMaterial.dispose()
      atmosphereMaterial.dispose()
      compositeMaterial.dispose()
      geometryTarget.dispose()
      atmosphereTarget.dispose()
      spectrumTexture.dispose()
      historyTexture.dispose()
      renderer.dispose()
    },
  }
}
