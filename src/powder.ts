/**
 * The powder easter egg — docs/todo.md entry 46.
 *
 * Three quick taps on the gate's own background (see main.ts) swap it for
 * this: a black field that throws down white grains on a tap, lays them
 * into a line on a drag — carrying the finger's own velocity, which is what
 * makes a line rather than a smudge — and lets a tilted phone slide the
 * whole picture downhill. Three taps again brings the gate back exactly as
 * it was.
 *
 * A separate 2D canvas over the hidden WebGL one, not the shader pipeline:
 * the mode is all black, so nothing the running piece draws is ever visible
 * at the same time this is, and a 2D canvas is a few dozen lines against a
 * feature that would otherwise mean teaching six geometric fragment shaders
 * about a mode none of them show.
 *
 * No permission prompt, ever — an easter egg must never be the thing that
 * asks for the accelerometer. Tilt only works where main.ts has already
 * started the sensor unconditionally (Android, where no permission gate
 * exists); on iOS `getTilt` reports the stub's `{0, 0}` and the powder
 * simply lies still under gravity's absence, which is a smaller feature
 * rather than a broken one.
 */

interface Grain {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
}

/** A frame-time question, not a design one — this is a starting point the
 *  numeric readout is meant to settle on a real phone. **Mine**. */
const CAP = 3000

/** Once over CAP, the oldest this many grains fade rather than the buffer
 *  simply refusing new ones — "the cap fades rather than refuses… a canvas
 *  that slowly forgets reads as powder." **Mine**. */
const FADE_ZONE = 200

/** Pixels/second² per unit of `tilt()` (-1..1) — docs/todo.md entry 46's own
 *  "tilting the phone makes the powder slide downhill". **Mine**, tuned by
 *  feel: fast enough to visibly slide within a second or two of leaning the
 *  phone, slow enough that a grain sprayed a moment ago has not already
 *  flown off-screen. */
const TILT_ACCEL = 900

/** Velocity lost per second, exponential — what makes a sprayed or dragged
 *  grain settle rather than sliding forever once nothing is accelerating it.
 *  **Mine**. */
const DRAG_PER_S = 3.5

/** Grains in a single tap's burst. **Mine**. */
const BURST_COUNT = 16
/** uv-independent pixel spread/speed for a tap's burst. **Mine**. */
const BURST_SPREAD_PX = 6
const BURST_SPEED_PX_S = 40

/** Grains laid per pixel of drag distance — "gives them the finger's
 *  velocity, which is what makes a line rather than a smudge". **Mine**. */
const DRAG_GRAINS_PER_PX = 0.5
/** How much of the finger's own velocity a dragged grain inherits.
 *  **Mine**: less than 1 so a fast swipe still reads as powder settling
 *  into a line rather than a spray of missiles. */
const DRAG_VELOCITY_FRACTION = 0.35

const GRAIN_RADIUS_PX = 1.1

export interface Powder {
  /** Toggle the mode on or off — main.ts's three-tap recogniser calls this
   *  for both directions, per the entry's "the same three taps" exit. */
  toggle(): void
  readonly active: boolean
}

/**
 * `getTilt` is a dependency rather than an import of a live sensor: main.ts
 * owns the one running `ShakeSensor`, reassigned once permission resolves,
 * and this module has no business holding a second reference to it or
 * caring which state it is in.
 */
export function mountPowder(getTilt: () => { x: number; y: number }): Powder {
  const layer = document.getElementById('powder')
  const canvas = document.getElementById('powder-canvas')
  if (!(layer instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
    // Markup missing is a build error, not a runtime one to recover from —
    // but an easter egg is exactly the kind of thing that should fail
    // silently rather than break the page it is hiding inside.
    return { toggle: () => {}, active: false }
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return { toggle: () => {}, active: false }

  let active = false
  let grains: Grain[] = []
  let dpr = 1
  let lastFrame = 0
  let rafId: number | undefined

  // Drag tracking — single-pointer, unlike main.ts's four-way touches.ts
  // field: the entry names one finger throwing powder, never two at once,
  // and reusing that field here would mean depending on the main app's own
  // gesture layer from a mode that exists specifically to have nothing to
  // do with it.
  let dragging = false
  let lastX = 0
  let lastY = 0
  let lastMoveAt = 0

  const resize = (): void => {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(window.innerWidth * dpr)
    canvas.height = Math.round(window.innerHeight * dpr)
  }

  const spawnBurst = (x: number, y: number): void => {
    for (let i = 0; i < BURST_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * BURST_SPEED_PX_S
      grains.push({
        x: x + (Math.random() - 0.5) * BURST_SPREAD_PX,
        y: y + (Math.random() - 0.5) * BURST_SPREAD_PX,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
      })
    }
  }

  const spawnDragSegment = (x0: number, y0: number, x1: number, y1: number, vx: number, vy: number): void => {
    const dist = Math.hypot(x1 - x0, y1 - y0)
    const n = Math.max(1, Math.round(dist * DRAG_GRAINS_PER_PX))
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 1 : i / (n - 1)
      grains.push({
        x: x0 + (x1 - x0) * t,
        y: y0 + (y1 - y0) * t,
        vx: vx * DRAG_VELOCITY_FRACTION + (Math.random() - 0.5) * 4,
        vy: vy * DRAG_VELOCITY_FRACTION + (Math.random() - 0.5) * 4,
        alpha: 1,
      })
    }
  }

  const onPointerDown = (e: PointerEvent): void => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    lastMoveAt = performance.now() / 1000
    spawnBurst(e.clientX, e.clientY)
  }
  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return
    const now = performance.now() / 1000
    const dt = Math.max(1 / 240, now - lastMoveAt)
    const vx = (e.clientX - lastX) / dt
    const vy = (e.clientY - lastY) / dt
    spawnDragSegment(lastX, lastY, e.clientX, e.clientY, vx, vy)
    lastX = e.clientX
    lastY = e.clientY
    lastMoveAt = now
  }
  const onPointerUp = (): void => {
    dragging = false
  }

  const step = (dt: number): void => {
    const tilt = getTilt()
    const ax = tilt.x * TILT_ACCEL
    const ay = tilt.y * TILT_ACCEL
    const drag = Math.exp(-DRAG_PER_S * dt)
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    for (const g of grains) {
      g.vx = (g.vx + ax * dt) * drag
      g.vy = (g.vy + ay * dt) * drag
      g.x += g.vx * dt
      g.y += g.vy * dt
      // A wall, not a wrap or a fall-through — powder piles up at the edge
      // of the field it is in rather than leaving it.
      if (g.x < 0) {
        g.x = 0
        g.vx = 0
      } else if (g.x > w) {
        g.x = w
        g.vx = 0
      }
      if (g.y < 0) {
        g.y = 0
        g.vy = 0
      } else if (g.y > h) {
        g.y = h
        g.vy = 0
      }
    }

    // The cap fades rather than refuses: the oldest FADE_ZONE grains beyond
    // it ramp to transparent, and only a fully transparent grain is ever
    // dropped — a canvas that silently stopped accepting new powder would
    // read as broken, one that slowly forgets reads as powder.
    const over = grains.length - CAP
    if (over > 0) {
      const n = grains.length
      for (let i = 0; i < Math.min(FADE_ZONE, n); i++) {
        grains[i].alpha = Math.min(grains[i].alpha, i / FADE_ZONE)
      }
    }
    while (grains.length > 0 && grains[0].alpha <= 0) grains.shift()
  }

  const draw = (): void => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#fff'
    for (const g of grains) {
      ctx.globalAlpha = g.alpha
      ctx.beginPath()
      ctx.arc(g.x * dpr, g.y * dpr, GRAIN_RADIUS_PX * dpr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  const loop = (): void => {
    if (!active) return
    const now = performance.now() / 1000
    const dt = lastFrame === 0 ? 1 / 60 : Math.min(now - lastFrame, 1 / 15)
    lastFrame = now
    step(dt)
    draw()
    rafId = requestAnimationFrame(loop)
  }

  return {
    get active() {
      return active
    },
    toggle() {
      active = !active
      layer.hidden = !active
      if (active) {
        resize()
        grains = []
        lastFrame = 0
        canvas.addEventListener('pointerdown', onPointerDown)
        canvas.addEventListener('pointermove', onPointerMove)
        canvas.addEventListener('pointerup', onPointerUp)
        canvas.addEventListener('pointercancel', onPointerUp)
        window.addEventListener('resize', resize)
        rafId = requestAnimationFrame(loop)
      } else {
        dragging = false
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerup', onPointerUp)
        canvas.removeEventListener('pointercancel', onPointerUp)
        window.removeEventListener('resize', resize)
        if (rafId !== undefined) cancelAnimationFrame(rafId)
        // Leaving must be exact — the layer is hidden, not torn down, so
        // there is nothing here to rebuild on the way back in. The grains
        // are cleared on the *next* entry (see toggle()'s `if (active)`
        // branch above) rather than here, so a mid-fade exit does not
        // flash a suddenly-empty black field before it is hidden.
      }
    },
  }
}
