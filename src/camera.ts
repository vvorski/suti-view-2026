/**
 * The room, as a layer.
 *
 * Passthrough AR: the rear camera becomes a ground the two rendered layers sit
 * over, so the piece plays on the room rather than on black. Deliberately not
 * world-tracked — the visuals live on the glass, not anchored in space. That
 * choice buys every phone, including iPhone, where WebXR does not exist at
 * all; a tracked version would be a second render path beside this one, not a
 * change to it.
 *
 * This sits next to `shake.ts` rather than in `engine/`, whose own docstring
 * draws the line: everything in there is about *listening*, and nothing in
 * there knows a screen exists. A camera is neither. Both files here are the
 * same kind of thing — a device input that is not audio, optional, and
 * degrading to nothing when refused.
 */

/** A live camera feed, or nothing. */
export interface CameraSource {
  /** Playing, muted, inline. Ready to hand to a VideoTexture. */
  readonly video: HTMLVideoElement
  close(): void
}

/**
 * Ask for the rear camera.
 *
 * MUST be called from inside a user-gesture handler, exactly like
 * `startMicrophone()` — but from the HUD's own camera control rather than from
 * the start gate. Putting it in the start gesture would show a camera prompt
 * to every visitor, including the great majority who never turn passthrough
 * on, and a permission asked for before it is wanted is the thing this
 * project's Hard Stop on capture exists to prevent. A tap on the control is a
 * live gesture and arrives exactly when the answer matters.
 *
 * Rejects rather than resolving null, so the caller can tell "declined" from
 * "not asked yet" and leave the control where it was.
 */
export async function startCamera(): Promise<CameraSource> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      // The rear camera is the one pointed at the room. `facingMode` is a
      // preference, not a guarantee — a laptop or a phone with one camera
      // gives whatever it has, which is fine and still worth showing.
      facingMode: 'environment',
      // Capped on purpose. A VideoTexture re-uploads the whole frame to the
      // GPU every rendered frame, so this is a per-frame cost paid forever,
      // not once. At 1080p on a mid-range phone that upload costs more than
      // the shaders it is a background for — and it is then scaled down to a
      // canvas that is usually under 500 CSS px wide anyway.
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  })

  const video = document.createElement('video')
  video.srcObject = stream
  // All three are required, not decorative. `muted` and `playsInline` are what
  // let iOS Safari play it at all without going fullscreen and without a
  // second gesture; `autoplay` covers browsers that will not start a stream
  // from play() alone.
  video.muted = true
  video.playsInline = true
  video.autoplay = true

  // Wait for real dimensions before returning. A VideoTexture built from a
  // video with videoWidth 0 uploads nothing and stays black, and the aspect
  // correction downstream would divide by zero — both of which look like a
  // broken shader rather than a race.
  await new Promise<void>((resolve) => {
    if (video.readyState >= 2 && video.videoWidth > 0) return resolve()
    video.addEventListener('loadeddata', () => resolve(), { once: true })
  })

  await video.play().catch(() => {
    // Some browsers resolve the stream but refuse the play() without their own
    // gesture. The texture will simply hold the first frame; that is a poor
    // passthrough rather than a failed one, and not worth refusing over.
  })

  return {
    video,
    close() {
      // Stop the tracks, or the camera indicator stays lit and the sensor
      // stays powered after passthrough is turned off — the most visible
      // possible way to break the promise the start gate makes.
      for (const track of stream.getTracks()) track.stop()
      video.srcObject = null
    },
  }
}
