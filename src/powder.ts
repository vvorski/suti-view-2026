/**
 * The powder easter egg — docs/todo.md entry 46, made a material by entry 61.
 *
 * Three quick taps on the gate's own background (see main.ts) swap it for
 * this, fullscreen: a black field that throws down white grains on a tap,
 * piles them where a finger holds still, pushes the grains already there
 * when it drags instead of laying new ones, and lets a tilted or shaken
 * phone slide or scatter the whole pile. Three taps again brings the gate
 * back exactly as it was — still in fullscreen, since leaving the egg is not
 * a second, unrequested change of state.
 *
 * A separate 2D canvas over the hidden WebGL one, not the shader pipeline:
 * the mode is all black, so nothing the running piece draws is ever visible
 * at the same time this is, and a 2D canvas is a few dozen lines against a
 * feature that would otherwise mean teaching six geometric fragment shaders
 * about a mode none of them show.
 *
 * No permission prompt, ever — an easter egg must never be the thing that
 * asks for the accelerometer. Tilt, disturb and shake only work where
 * main.ts has already started the sensor unconditionally (Android, where no
 * permission gate exists); on iOS `getMotion` reports the stub's stillness
 * and the powder simply lies where it is, which is a smaller feature rather
 * than a broken one.
 */

import { intensity } from './shake'

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

/** docs/todo.md entry 61: a drag no longer lays grains — it pushes the ones
 *  already there. Every grain within this many pixels of the finger gets an
 *  impulse on each real move. **Mine on the exact radius** — the entry's own
 *  number ("about 40px"). */
const PUSH_RADIUS_PX = 40
/** How much of the finger's own pixel velocity becomes impulse on a pushed
 *  grain, at the push's centre — scaled down toward the radius's edge by
 *  `step()`'s own falloff. **Mine**, tuned by feel against `DRAG_PER_S`
 *  below: enough that a fast drag visibly throws grains ahead of the finger
 *  rather than merely nudging them. */
const PUSH_VELOCITY_SCALE = 0.6
/** Below this many pixels of movement between two pointer samples, a finger
 *  counts as held still rather than dragging — real touch input jitters by a
 *  pixel or two even when a person believes they are holding still. **Mine**,
 *  the same kind of slop `TAP_SLOP_PX` already is elsewhere in this app. */
const HOLD_STILL_PX = 3
/** How long after the last real move a held-still finger waits before piling
 *  resumes — long enough that the tail of an ordinary drag's last few
 *  sub-threshold samples does not read as "held still already". **Mine**. */
const STILL_DELAY_S = 0.12
/** Grains piled per second under a finger held still — docs/todo.md entry
 *  61's own number. */
const PILE_RATE_PER_S = 60

/** Pixels/second² of jitter per unit of `disturb` (0..1) — "carrying the
 *  phone unsettles it". **Mine**, tuned well under `TILT_ACCEL` so a phone
 *  merely being carried reads as a tremor, not a slide. */
const DISTURB_JITTER_ACCEL = 220

/** Pixels/second of outward speed a `takeStrong()` peak of 1.0 (intensity's
 *  own ceiling) gives every grain — docs/todo.md entry 61's "a hard shake
 *  scatters it across the screen". **Mine**, tuned to clear a phone-sized
 *  screen from roughly its centre well within `DRAG_PER_S`'s settling time. */
const SCATTER_SPEED_PX_S = 900

const GRAIN_RADIUS_PX = 1.1

export interface Powder {
  /** Toggle the mode on or off — main.ts's three-tap recogniser calls this
   *  for both directions, per the entry's "the same three taps" exit. */
  toggle(): void
  readonly active: boolean
}

/** What one frame of motion looks like to the powder — docs/todo.md entry
 *  61 widens this from tilt alone to the three sources a phone's own sensor
 *  already produces. `strongPeak` is 0 most frames and the raw peak (m/s²)
 *  the one frame a shake was just taken, read-and-cleared by the caller —
 *  the same one-shot shape `Tumble.takeStrong()` itself already has. */
interface Motion {
  tilt: { x: number; y: number }
  disturb: number
  strongPeak: number
}

/**
 * `getMotion` is a dependency rather than an import of a live sensor: main.ts
 * owns the one running `ShakeSensor`, reassigned once permission resolves,
 * and this module has no business holding a second reference to it or
 * caring which state it is in.
 */
export function mountPowder(getMotion: () => Motion): Powder {
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
  // docs/todo.md entry 61. lastMovedAt only advances on a real (past
  // HOLD_STILL_PX) move, unlike lastMoveAt above which advances on every
  // sample including jitter — the gap between the two is exactly "how long
  // has this finger actually been still", which is what gates piling.
  let lastMovedAt = 0
  // Fractional grains owed to the pile, carried between frames so
  // PILE_RATE_PER_S is a real rate rather than rounding to whole grains a
  // frame at a time.
  let pileAccum = 0

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

  /** docs/todo.md entry 61: a drag pushes the grains that are there instead
   *  of laying new ones. Every grain within `PUSH_RADIUS_PX` of the finger
   *  gets an impulse in the direction — and scaled by the speed — of the
   *  finger's own move, falling off toward the radius's edge so the effect
   *  reads as a push near a point rather than a uniform shove of everything
   *  nearby. */
  const pushGrains = (x: number, y: number, vx: number, vy: number): void => {
    for (const g of grains) {
      const dist = Math.hypot(g.x - x, g.y - y)
      if (dist > PUSH_RADIUS_PX) continue
      const falloff = 1 - dist / PUSH_RADIUS_PX
      g.vx += vx * PUSH_VELOCITY_SCALE * falloff
      g.vy += vy * PUSH_VELOCITY_SCALE * falloff
    }
  }

  const onPointerDown = (e: PointerEvent): void => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    lastMoveAt = performance.now() / 1000
    lastMovedAt = lastMoveAt
    spawnBurst(e.clientX, e.clientY)
  }
  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return
    const now = performance.now() / 1000
    const dt = Math.max(1 / 240, now - lastMoveAt)
    const dist = Math.hypot(e.clientX - lastX, e.clientY - lastY)
    // Below HOLD_STILL_PX this is jitter under a finger that believes it is
    // holding still, not a drag — leave lastMovedAt alone so step()'s pile
    // resumes without waiting out STILL_DELAY_S for no reason.
    if (dist > HOLD_STILL_PX) {
      const vx = (e.clientX - lastX) / dt
      const vy = (e.clientY - lastY) / dt
      pushGrains(lastX, lastY, vx, vy)
      lastMovedAt = now
    }
    lastX = e.clientX
    lastY = e.clientY
    lastMoveAt = now
  }
  const onPointerUp = (): void => {
    dragging = false
    pileAccum = 0
  }

  const step = (dt: number): void => {
    const motion = getMotion()
    const ax = motion.tilt.x * TILT_ACCEL
    const ay = motion.tilt.y * TILT_ACCEL
    const drag = Math.exp(-DRAG_PER_S * dt)
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    // A stationary finger piles rather than dragging — see onPointerMove's
    // own comment on the still/drag boundary this reads.
    if (dragging && performance.now() / 1000 - lastMovedAt >= STILL_DELAY_S) {
      pileAccum += PILE_RATE_PER_S * dt
      while (pileAccum >= 1) {
        grains.push({
          x: lastX + (Math.random() - 0.5) * BURST_SPREAD_PX,
          y: lastY + (Math.random() - 0.5) * BURST_SPREAD_PX,
          vx: 0,
          vy: 0,
          alpha: 1,
        })
        pileAccum -= 1
      }
    } else {
      pileAccum = 0
    }

    // "Carrying the phone unsettles it" — a small jitter proportional to
    // disturb, applied to every grain the same way tilt already is.
    const jitter = motion.disturb * DISTURB_JITTER_ACCEL

    // "A hard shake scatters it" — an outward impulse from the field's own
    // centre, scaled by how hard the shake was. Zero every frame but the one
    // takeStrong() actually returned something, since getMotion() clears it.
    const scatterSpeed = intensity(motion.strongPeak) * SCATTER_SPEED_PX_S
    const cx = w / 2
    const cy = h / 2

    for (const g of grains) {
      let vx = g.vx + ax * dt + (Math.random() - 0.5) * jitter * dt
      let vy = g.vy + ay * dt + (Math.random() - 0.5) * jitter * dt
      if (scatterSpeed > 0) {
        const dx = g.x - cx
        const dy = g.y - cy
        const dist = Math.hypot(dx, dy)
        const [nx, ny] = dist > 0.01 ? [dx / dist, dy / dist] : [Math.cos(g.x), Math.sin(g.y)]
        vx += nx * scatterSpeed
        vy += ny * scatterSpeed
      }
      g.vx = vx * drag
      g.vy = vy * drag
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
