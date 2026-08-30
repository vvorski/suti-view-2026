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
  Vector3,
  Vector4,
  VideoTexture,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'

import type { CameraSource } from './camera'
import { type GeoColour } from './geo-colour'
import { MERGE_MODES, type MergeModeName } from './merge-modes'
import type { VisualParams } from './engine'
import {
  createEmitterState,
  createRippleState,
  Envelope,
  MAX_RIPPLES,
  updateEmitter,
  updateRipples,
  type EmitterState,
} from './engine'
import { MAX_OFFSET, overscanFor, type TumbleState } from './shake'
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
  geoColour: GeoColour
  atmColour: GeoColour
  camColour: GeoColour
  atmosphericView: AtmosphericViewName
  /** The geometric layer's own blend, over the atmosphere. */
  mergeMode: MergeModeName
  /** The atmospheric layer's own blend, over the camera. */
  atmMergeMode: MergeModeName
  /** 0-1. The geometric layer's opacity: 0 is pure atmosphere, 1 the full
   *  blend. This is what `mix` used to be, under a name that says what it
   *  actually does now that the atmosphere has one of its own. */
  geoAlpha: number
  /** 0-1. The atmospheric layer's opacity, applied before the merge mode. */
  atmAlpha: number
}

export interface Visualiser {
  render(params: VisualParams, spectrum: Uint8Array): void
  resize(): void
  dispose(): void
  /** Swap the geometric layer's programme. Recompiles a shader; not a per-frame call. */
  setGeometricView(name: GeometricViewName): void
  /** Swap the atmospheric layer's programme. Recompiles a shader; not a per-frame call. */
  setAtmosphericView(name: AtmosphericViewName): void
  /** Set a layer's own blend, over what's beneath it: geo over atmosphere,
   *  atm over the camera. Mirrors `setLayerColour`'s per-layer shape. */
  setMergeMode(layer: 'geo' | 'atm', mode: MergeModeName): void
  /** Recolour a layer. Cheap: a uniform, not a recompile. */
  setLayerColour(layer: 'geo' | 'atm' | 'cam', colour: GeoColour): void
  /**
   * How far the device has been knocked about. See shake.ts.
   *
   * `gravity`, when given, is a steady offset from how the phone is being
   * held rather than from its motion — docs/todo.md entry 30 — in the same
   * uv units as `t.offsetX`/`t.offsetY`. Summed with the spring's own offset
   * and clamped to the same MAX_OFFSET the spring already respects, here
   * rather than in the caller, so there is exactly one place that cap is
   * enforced against the combined value.
   */
  setTumble(t: TumbleState, gravity?: { x: number; y: number }): void
  /**
   * Every touch main.ts's pointer recogniser currently believes should be
   * emitting — docs/todo.md entries 33 and 49. `x`/`y` are in the same
   * normalised space every geometric shader's own `uv` already lives in:
   * `(gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x,
   * uResolution.y)`, centred on the frame. Only recorded here; `render()`
   * is what ticks each one into its own emitter slot once per frame, up to
   * four at once, matching `engine/touches.ts`'s own cap. A touch absent
   * from one call that was present in the last is simply not emitting any
   * more — its slot's emitter keeps its own last position through its
   * afterlife regardless.
   */
  setTouches(touches: ReadonlyArray<{ id: number; x: number; y: number }>): void
  /** 0-1, the geometric layer's opacity. Formerly setMix. */
  setGeoAlpha(a: number): void
  /** 0-1, the atmospheric layer's opacity. */
  setAtmAlpha(a: number): void
  /**
   * Attach or detach the passthrough camera, and set how much of it shows.
   *
   * `source` null detaches and frees the texture. Passing a source with mix 0
   * is legal and means "attached but invisible" — which is what the HUD does
   * while dragging back to zero, so that letting go at 0 and then dragging up
   * again does not re-prompt for the camera.
   */
  setPassthrough(source: CameraSource | null, mix: number): void
  /** Re-roll the seed each view spends on whatever it doesn't get from audio. */
  randomise(): void
  /** Smoothed frame time in ms, and the pixel ratio currently in use. */
  stats(): { frameMs: number; pixelRatio: number }
  /**
   * Save the next composited frame as a PNG blob, once. `onReady` runs after
   * the frame after this call renders — capture happens inside the render
   * loop, right after the canvas is painted, not synchronously here: this
   * renderer is built without `preserveDrawingBuffer` (a cost paid on every
   * frame forever to serve a tap that happens twice a session), so the
   * buffer is undefined the instant `render()` returns and a `toBlob()` from
   * outside the loop reads back nothing. `onReady(null)` if the blob could
   * not be produced.
   */
  requestCapture(onReady: (blob: Blob | null) => void): void
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
    // (birthTime, birthLevel, x, y) per active ring — widened from vec2 for
    // docs/todo.md entry 33's touch emitter, which needs somewhere to carry
    // *where* it was born. Only the geometric layer's event-driven views
    // read this; see ripples.ts. x/y are unused (and unwritten) for the
    // audio-born slots; every view's own origin logic reaches for them only
    // in the reserved touch range.
    uRipples: {
      value: Array.from({ length: MAX_RIPPLES }, () => new Vector4(-1000, 0, 0, 0)),
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
    uGeoAlpha: { value: options.geoAlpha },
    uAtmAlpha: { value: options.atmAlpha },
    uMode: { value: MERGE_MODES[options.mergeMode].index },
    uAtmMode: { value: MERGE_MODES[options.atmMergeMode].index },
    // Seeded from options, not left at white for setLayerColour to correct
    // later: nothing calls that until the HUD is touched, so a stored or
    // URL-supplied colour would be ignored for the whole session.
    uGeoColour: {
      value: new Vector3(options.geoColour.r, options.geoColour.g, options.geoColour.b),
    },
    uAtmColour: {
      value: new Vector3(options.atmColour.r, options.atmColour.g, options.atmColour.b),
    },
    uCamColour: {
      value: new Vector3(options.camColour.r, options.camColour.g, options.camColour.b),
    },
    // (angle, offsetX, offsetY, overscan) — at rest this is the identity, so
    // a device with no accelerometer costs one unused uniform and nothing else.
    uTumble: { value: new Vector4(0, 0, 0, 0) },
    // Passthrough AR. Null until a camera is actually attached: Three binds a
    // default 1x1 white texture for a null sampler, which is never sampled
    // because the shader guards on uCameraMix > 0.
    uCamera: { value: null as VideoTexture | null },
    uCameraMix: { value: 0 },
    uCameraFit: { value: new Vector2(1, 1) },
    // The picture answers the light in the room — docs/todo.md entry 23.
    // 1 is identity and is also everything this ever is while the camera is
    // down, so a session that never raises it pays nothing for this uniform
    // existing.
    uExposure: { value: 1 },
  }
  const compositeMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader: compositeFrag,
    uniforms: compositeUniforms,
  })

  const geometry = new PlaneGeometry(2, 2)
  // One mesh, reused across all passes below — each pass swaps its material
  // in just before rendering.
  const mesh = new Mesh(geometry, geometryMaterial)
  scene.add(mesh)

  // Ambient light sampling — docs/todo.md entry 23, licensed by Victor
  // 2026-08-29, narrowly: camera pixels may be measured as well as
  // displayed, but only while the camera is already up (never what turns it
  // on — entry 22 is the only thing licensed to do that). A tiny render
  // target rather than reading the full camera frame back: GL's own linear
  // filtering does the downsampling for free as it rasterises to 8x8, and
  // reading 64 pixels back costs far less than reading the whole frame.
  const LIGHT_SAMPLE_SIZE = 8
  const lightTarget = new WebGLRenderTarget(LIGHT_SAMPLE_SIZE, LIGHT_SAMPLE_SIZE, {
    depthBuffer: false,
    stencilBuffer: false,
  })
  const lightMaterial = new ShaderMaterial({
    vertexShader,
    // Deliberately not composite.frag.glsl: this measures the room the
    // camera sees, not the picture the app is drawing over it — sampling
    // the composite's own output would make the exposure gain chase itself.
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D uCamera;
      void main() { gl_FragColor = texture2D(uCamera, vUv); }
    `,
    uniforms: { uCamera: compositeUniforms.uCamera },
  })
  const lightPixels = new Uint8Array(LIGHT_SAMPLE_SIZE * LIGHT_SAMPLE_SIZE * 4)
  // Slow attack, slower release, seconds not frames: without this, someone
  // walking past a lamp strobes the whole picture, and the failure would
  // look like a rendering bug rather than a feature.
  const exposureEnvelope = new Envelope(2.0, 5.0, 0.5)
  let lightSampleFrames = 0

  // Motion clock. Integrated from the audio level rather than read from the
  // wall clock, so the field accumulates movement while there is sound and
  // coasts to a near-stop in silence. A break nearly freezes it, which is a
  // large part of why a break is legible at all.
  let flow = 0
  // Which RGB filter the geometric layer is wearing. Held here rather than as
  // a plain uniform because `spectrum` recomputes its gains every frame.
  let elapsed = 0
  let frameMs = 16.7
  let sinceChange = 0
  let historyHead = 0
  let historyAccum = 0
  let contextLost = false
  const ripples = createRippleState()
  // docs/todo.md entries 33 and 49. What main.ts's pointer recogniser last
  // reported — ticked into each slot's emitter once per rendered frame, in
  // render() below, rather than acted on directly in setTouches(), so spawn
  // cadence and charge stay tied to wall-clock time rather than to how often
  // pointer events arrive.
  //
  // Four fixed slots, matching ripples.ts's four reserved touch slots — a
  // slot's `id` is `null` while free. A slot is claimed by whichever
  // incoming touch id matches it, or the first free slot for a new id; one
  // that drops out of the incoming set keeps ticking through its own
  // afterlife (see emitter.ts) rather than being freed immediately, exactly
  // as the single emitter this replaces did. A touch with no free slot is
  // simply not emitted this frame — the same "a fifth is ignored" rule
  // entry 49's touch field already applies one level up.
  const emitterSlots: { id: number | null; state: EmitterState }[] = Array.from({ length: 4 }, () => ({
    id: null,
    state: createEmitterState(),
  }))
  let touches: ReadonlyArray<{ id: number; x: number; y: number }> = []
  let lastNovelty = 0
  let lastAutoReroll = -1000
  // The canvas's own client box, as of the last applySize() — see
  // sizeCheckFrames below. Compared in CSS pixels, not the drawing buffer's,
  // because that is the number CSS is actually stretching the buffer to.
  let lastClientWidth = 0
  let lastClientHeight = 0
  /** Frames since the client box was last checked against what the buffer
   *  was sized for. Not a per-frame check: reading clientWidth/clientHeight
   *  can force layout, and this changes at most twice a session (fullscreen,
   *  rotation) — paying that cost 60 times a second to catch something that
   *  rare is the wrong trade. 30 frames is twice a second, which bounds any
   *  visible distortion to about half that without adding a real cost. */
  let sizeCheckFrames = 0
  /** Set by requestCapture(), read and cleared inside the render loop once
   *  the composited frame is actually on the canvas. See requestCapture's
   *  own comment for why this cannot just call toBlob() synchronously. */
  let pendingCapture: ((blob: Blob | null) => void) | null = null

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
    // The canvas's own client box, not window.innerWidth/innerHeight: CSS
    // (`#canvas { inset: 0; width: 100%; height: 100% }`) paints the canvas
    // across whatever that box is, and window.inner* was always only a proxy
    // for it — one that fullscreen can silently stop agreeing with, which is
    // exactly what stretched every circle in the app into an ellipse. Sizing
    // from the same box CSS is stretching the buffer across makes the two
    // numbers one number, so they cannot disagree by construction.
    lastClientWidth = canvas.clientWidth
    lastClientHeight = canvas.clientHeight
    renderer.setSize(lastClientWidth, lastClientHeight, false)
    // Uniform wants the drawing-buffer size, not the CSS size — they differ by
    // the pixel ratio, and using CSS pixels here makes the shader's aspect
    // correction subtly wrong on every retina device.
    renderer.getDrawingBufferSize(drawSize)
    uniforms.uResolution.value.copy(drawSize)
    geometryTarget.setSize(drawSize.x, drawSize.y)
    atmosphereTarget.setSize(drawSize.x, drawSize.y)
    applyCameraFit()
  }

  /**
   * Cover-fit the camera frame to the canvas.
   *
   * The sensor is landscape (1280x720) and a phone held upright is portrait,
   * so the two aspects are not merely different, they are inverted. Stretching
   * one to the other is instantly legible as wrong — faces get wide, the room
   * leans.
   *
   * The shader samples `(vUv - 0.5) * uCameraFit + 0.5`, so this is the factor
   * the *texture coordinates* are scaled by, which is the reciprocal of the
   * scale applied to the image: to show less of the source along an axis
   * (cropping it) the uv range must shrink, hence the < 1 values here. Getting
   * that backwards produces a frame that is letterboxed rather than cropped,
   * with the clamp smearing the edge pixels outward.
   */
  function applyCameraFit(): void {
    const tex = compositeUniforms.uCamera.value
    const video = tex?.image as HTMLVideoElement | undefined
    if (!video || !video.videoWidth || !video.videoHeight || !drawSize.y) {
      compositeUniforms.uCameraFit.value.set(1, 1)
      return
    }
    const canvasAspect = drawSize.x / drawSize.y
    const videoAspect = video.videoWidth / video.videoHeight
    if (videoAspect > canvasAspect) {
      // Source is wider than the frame: keep full height, crop the sides.
      compositeUniforms.uCameraFit.value.set(canvasAspect / videoAspect, 1)
    } else {
      compositeUniforms.uCameraFit.value.set(1, videoAspect / canvasAspect)
    }
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

  /**
   * Catch a viewport that changed shape without firing the `resize` this
   * app listens for — fullscreen is the one already known to do that; there
   * may be others nobody has thought of yet, which is the actual reason this
   * exists rather than one more listener for one more event name. The
   * existing `resize` handler stays as the immediate path, so an ordinary
   * rotation does not wait up to 30 frames for this to notice.
   */
  function checkSize(): void {
    sizeCheckFrames++
    if (sizeCheckFrames < 30) return
    sizeCheckFrames = 0
    if (canvas.clientWidth !== lastClientWidth || canvas.clientHeight !== lastClientHeight) {
      applySize()
    }
  }

  /**
   * Measure the room's mean brightness from the camera texture and ease the
   * composite's output gain toward it — see this file's own comment on
   * `lightTarget` for the licence and the reasoning.
   *
   * A no-op the instant the camera is down: `dt`'s costs before the guard
   * are one comparison, and the whole point of the licence's shape is that
   * this never runs for most people. Ticks on the same 30-frame cadence
   * `checkSize` uses, for the same reason — a per-frame readback stalls the
   * pipeline waiting for the GPU, and light in a room does not change
   * faster than twice a second.
   */
  function sampleAmbientLight(dt: number): void {
    if (!compositeUniforms.uCamera.value) {
      compositeUniforms.uExposure.value = 1
      return
    }

    lightSampleFrames++
    if (lightSampleFrames >= 30) {
      lightSampleFrames = 0
      mesh.material = lightMaterial
      renderer.setRenderTarget(lightTarget)
      renderer.render(scene, camera)
      renderer.readRenderTargetPixels(
        lightTarget,
        0,
        0,
        LIGHT_SAMPLE_SIZE,
        LIGHT_SAMPLE_SIZE,
        lightPixels,
      )

      let sum = 0
      const n = LIGHT_SAMPLE_SIZE * LIGHT_SAMPLE_SIZE
      for (let i = 0; i < n; i++) {
        const r = lightPixels[i * 4] / 255
        const g = lightPixels[i * 4 + 1] / 255
        const b = lightPixels[i * 4 + 2] / 255
        // Standard luminance weights — green dominates perceived brightness,
        // blue barely registers.
        sum += 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      exposureEnvelope.push(sum / n, dt * 30)
    } else {
      // The envelope still needs to advance every frame, or its own
      // attack/release times would mean nothing — only the *sample* it is
      // chasing updates once every 30.
      exposureEnvelope.push(exposureEnvelope.current, dt)
    }

    // 0.85 at luminance 0 (a covered lens, or a dark room) to 1.15 at
    // luminance 1 (bright daylight); 0.5 — an ordinary lit room — lands
    // exactly on 1, unchanged. Narrower than it looks: the picture's
    // brightness is already the music's job, and a wider range would fight
    // it rather than merely answer the room.
    compositeUniforms.uExposure.value = 0.85 + exposureEnvelope.current * 0.3
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
      checkSize()
      sampleAmbientLight(dt)

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
      // docs/todo.md entries 33 and 49 — ticked here, not in setTouches(),
      // for the same reason updateRipples runs here rather than on each
      // audio frame: one wall-clock tick per rendered frame is what makes
      // charge and spawn cadence mean seconds rather than pointer-event
      // rate. Slots whose id is no longer in `touches` still get ticked,
      // inactive, so their afterlife keeps running down; a slot only frees
      // once its own life reaches 0.
      for (const slot of emitterSlots) {
        const live = slot.id === null ? undefined : touches.find((t) => t.id === slot.id)
        if (live) {
          updateEmitter(slot.state, ripples, now, true, live.x, live.y)
        } else if (slot.id !== null) {
          updateEmitter(slot.state, ripples, now, false, 0, 0)
          if (slot.state.life <= 0) slot.id = null
        }
      }
      for (const t of touches) {
        if (emitterSlots.some((s) => s.id === t.id)) continue
        const free = emitterSlots.find((s) => s.id === null)
        if (!free) continue // all four slots busy with other still-decaying emitters
        free.id = t.id
        updateEmitter(free.state, ripples, now, true, t.x, t.y)
      }
      for (let i = 0; i < MAX_RIPPLES; i++) {
        const o = i * 4 // stride must match ripples.ts's own STRIDE
        uniforms.uRipples.value[i].set(
          ripples.slots[o],
          ripples.slots[o + 1],
          ripples.slots[o + 2],
          ripples.slots[o + 3],
        )
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

      // Right after the canvas is painted and before anything else can clear
      // it — see requestCapture's own comment on why this cannot happen
      // synchronously at the call site instead.
      if (pendingCapture) {
        const onReady = pendingCapture
        pendingCapture = null
        canvas.toBlob((blob) => onReady(blob), 'image/png')
      }
    },

    resize: applySize,

    requestCapture(onReady) {
      pendingCapture = onReady
    },

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

    setMergeMode(layer, mode) {
      const u = layer === 'geo' ? compositeUniforms.uMode : compositeUniforms.uAtmMode
      u.value = MERGE_MODES[mode].index
    },

    setTumble(t, gravity) {
      const gx = gravity?.x ?? 0
      const gy = gravity?.y ?? 0
      const offsetX = Math.min(MAX_OFFSET, Math.max(-MAX_OFFSET, t.offsetX + gx))
      const offsetY = Math.min(MAX_OFFSET, Math.max(-MAX_OFFSET, t.offsetY + gy))
      // Recomputed from the combined offset, not just t.zoom: a held tilt can
      // push the applied offset further than the spring's own displacement
      // did, and the overscan has to cover whatever is actually on screen.
      const zoom = Math.max(t.zoom, overscanFor(t.angle, offsetX, offsetY))
      compositeUniforms.uTumble.value.set(t.angle, offsetX, offsetY, zoom)
    },

    setTouches(next) {
      touches = next
    },

    setLayerColour(layer, colour) {
      // Three fixed gains, so this is a uniform write on input rather than
      // anything the render loop has to recompute.
      const u =
        layer === 'geo'
          ? compositeUniforms.uGeoColour
          : layer === 'atm'
            ? compositeUniforms.uAtmColour
            : compositeUniforms.uCamColour
      u.value.set(colour.r, colour.g, colour.b)
    },

    setGeoAlpha(a) {
      compositeUniforms.uGeoAlpha.value = Math.min(1, Math.max(0, a))
    },

    setAtmAlpha(a) {
      compositeUniforms.uAtmAlpha.value = Math.min(1, Math.max(0, a))
    },

    setPassthrough(source, mix) {
      const current = compositeUniforms.uCamera.value
      const wantVideo = source?.video ?? null

      if ((current?.image ?? null) !== wantVideo) {
        // Dispose the old one before replacing it. A VideoTexture holds a GPU
        // texture that is re-uploaded every frame; leaking one per attach
        // would leak the upload too, not just the memory.
        current?.dispose()
        if (wantVideo) {
          const tex = new VideoTexture(wantVideo)
          tex.minFilter = LinearFilter
          tex.magFilter = LinearFilter
          tex.wrapS = ClampToEdgeWrapping
          tex.wrapT = ClampToEdgeWrapping
          compositeUniforms.uCamera.value = tex
        } else {
          compositeUniforms.uCamera.value = null
        }
        // The fit depends on the source's own dimensions, so it can only be
        // computed once there is a source.
        applyCameraFit()
      }

      compositeUniforms.uCameraMix.value = wantVideo
        ? Math.min(1, Math.max(0, mix))
        : 0
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
      compositeUniforms.uCamera.value?.dispose()
      renderer.dispose()
    },
  }
}
