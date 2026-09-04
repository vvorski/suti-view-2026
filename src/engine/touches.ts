/**
 * One owner of every finger on the picture — docs/todo.md entry 49.
 *
 * `ripples.ts` reserves four slots for touch (entry 33) and `emitter.ts`
 * models one contact's whole life, but until this file the input layer
 * above both could only ever produce one: `main.ts` tracked a single
 * `downX`/`downY`/`downZone`/`emitting` set of scalars, so a second finger
 * either did nothing or silently took the first one's state. This closes
 * that gap by putting every pointer on the picture behind one module,
 * tracked by id, up to four at once — matching the reserved band downstream
 * rather than either overflowing it or starving it.
 *
 * Sampled, not a stream of callbacks: shaders and gesture dispatch alike
 * want a value once per rendered frame, and a callback-driven design would
 * mean every consumer keeping its own copy of state that the frame then has
 * to reconcile. `sample(now)` answers "what is true right now"; `events()`
 * drains the small queue of discrete things — a contact beginning or
 * ending — that happened since the last drain.
 *
 * Pure state and pure functions, same discipline as `ripples.ts` and
 * `emitter.ts` and for the same reason this directory's own file states as
 * its rule: nothing here touches the DOM, uses a global, or reads a clock.
 * `main.ts` is the one place pointer listeners are bound (it already is,
 * per its own "one recogniser for every gesture" comment) and the one place
 * that knows what a `.hud-chip` or a screen third is; this file only ever
 * receives already-extracted numbers and strings — `down`/`move`/`up`/
 * `cancel` are the whole surface a listener needs to drive it.
 *
 * `pointercancel` and `lostpointercapture` both call `cancel()`, exactly as
 * `pointerup` calls `up()`. A phone being handed between people generates
 * both constantly, and that is the literal scenario this module exists
 * for: no pointer can hold a slot open forever.
 */

/** Matches ripples.ts's reserved touch band — see that file's own comment.
 *  A fifth contact is ignored entirely rather than displacing one already
 *  down. */
const MAX_TOUCHES = 4

/** Light exponential smoothing on velocity, so one noisy sample between two
 *  pointermove events doesn't spike drag speed for a single frame. **Mine**:
 *  the entries that read velocity (46, 48, 50) all want "how fast is this
 *  drag", not "what was the instantaneous vector of the last two events".
 *
 *  Exported since docs/todo.md entry 112: a hovering mouse cursor smooths
 *  its speed the same way a drag does, and it is the same filter for the
 *  same reason, so `hover.ts` reads this rather than carrying a second 0.3
 *  that would then be tuned apart from it. */
export const VELOCITY_SMOOTH = 0.3

export interface Touch {
  readonly id: number
  /** Shader uv — see `toShaderUv`'s own comment for the conversion. */
  readonly x: number
  readonly y: number
  readonly clientX: number
  readonly clientY: number
  /** Where this contact began, in client coordinates — for a caller's own
   *  slop-distance test against the *original* touchdown point, not the
   *  previous frame's. */
  readonly downClientX: number
  readonly downClientY: number
  /** Seconds since this contact began. */
  readonly downFor: number
  /** uv units per second. */
  readonly vx: number
  readonly vy: number
  /** Whether this contact began on a `.hud-chip` — chips own their own
   *  taps. Decided once, at contact start, and held for the life of the
   *  contact, same as `zone` below and for the same reason. */
  readonly onChip: boolean
  /**
   * Classified once, at the moment this contact began, by whatever the
   * caller passed to `down()` — main.ts's `zone()`, a screen-thirds concept
   * this module has no business knowing about itself. Kept here so nothing
   * downstream needs its own per-id map alongside this one. Constant for
   * the life of the contact: a finger that starts in the panel third and
   * drifts down over the capture band is still answering for the panel
   * third, exactly as it did before this entry.
   */
  readonly zone: string
}

export type TouchEventKind = 'down' | 'up' | 'cancel'

export interface TouchFieldEvent {
  readonly kind: TouchEventKind
  readonly id: number
  readonly x: number
  readonly y: number
  readonly clientX: number
  readonly clientY: number
  readonly downClientX: number
  readonly downClientY: number
  readonly onChip: boolean
  readonly zone: string
}

export interface TouchField {
  /** A contact began. Ignored once four are already down. */
  down(now: number, id: number, x: number, y: number, clientX: number, clientY: number, onChip: boolean, zone: string): void
  /** A contact moved. A no-op for an id `down()` was never called for, or
   *  already ignored as a fifth. */
  move(now: number, id: number, x: number, y: number, clientX: number, clientY: number): void
  /** A contact ended normally. */
  up(id: number): void
  /** A contact ended abnormally — `pointercancel` or `lostpointercapture`.
   *  Handled identically to `up()`; kept as a separate name so a caller's
   *  own listener wiring reads as a direct translation of the DOM events it
   *  is forwarding. */
  cancel(id: number): void
  /** Every pointer currently down, up to four. */
  sample(now: number): readonly Touch[]
  /** Drain and return everything that began or ended since the last call. */
  events(): readonly TouchFieldEvent[]
}

interface Slot {
  id: number
  downAt: number
  downClientX: number
  downClientY: number
  clientX: number
  clientY: number
  x: number
  y: number
  vx: number
  vy: number
  lastMoveAt: number
  onChip: boolean
  zone: string
}

/**
 * The canvas's own box, not the window's: the drawing buffer can be a
 * different aspect from the viewport under the resolution ladder, but every
 * geometric shader's own `uv` is built from `gl_FragCoord` against
 * `uResolution`, which tracks the canvas — so converting against the
 * canvas's client rect is what actually lands on the same point the shader
 * would draw at. y is flipped: gl_FragCoord's origin is the bottom of the
 * frame, DOM client coordinates the top.
 *
 * Moved here from main.ts's own `toShaderUv` — docs/todo.md entry 49's
 * "coordinates convert once" — but kept pure: `rect` is whatever the caller
 * read from `canvas.getBoundingClientRect()`, not read here, so this stays
 * a plain function over plain numbers like everything else in this file.
 */
export function toShaderUv(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): [number, number] {
  const minDim = Math.min(rect.width, rect.height)
  return [(clientX - rect.left - rect.width / 2) / minDim, (rect.height / 2 - (clientY - rect.top)) / minDim]
}

function toTouch(s: Slot, now: number): Touch {
  return {
    id: s.id,
    x: s.x,
    y: s.y,
    clientX: s.clientX,
    clientY: s.clientY,
    downClientX: s.downClientX,
    downClientY: s.downClientY,
    downFor: Math.max(0, now - s.downAt),
    vx: s.vx,
    vy: s.vy,
    onChip: s.onChip,
    zone: s.zone,
  }
}

export function createTouchField(): TouchField {
  const slots = new Map<number, Slot>()
  let queue: TouchFieldEvent[] = []

  const remove = (id: number, kind: 'up' | 'cancel'): void => {
    const s = slots.get(id)
    if (!s) return
    slots.delete(id)
    queue.push({
      kind,
      id,
      x: s.x,
      y: s.y,
      clientX: s.clientX,
      clientY: s.clientY,
      downClientX: s.downClientX,
      downClientY: s.downClientY,
      onChip: s.onChip,
      zone: s.zone,
    })
  }

  return {
    down(now, id, x, y, clientX, clientY, onChip, zone) {
      if (slots.size >= MAX_TOUCHES && !slots.has(id)) return
      const s: Slot = {
        id,
        downAt: now,
        downClientX: clientX,
        downClientY: clientY,
        clientX,
        clientY,
        x,
        y,
        vx: 0,
        vy: 0,
        lastMoveAt: now,
        onChip,
        zone,
      }
      slots.set(id, s)
      queue.push({
        kind: 'down',
        id: s.id,
        x: s.x,
        y: s.y,
        clientX: s.clientX,
        clientY: s.clientY,
        downClientX: s.downClientX,
        downClientY: s.downClientY,
        onChip: s.onChip,
        zone: s.zone,
      })
    },

    move(now, id, x, y, clientX, clientY) {
      const s = slots.get(id)
      if (!s) return
      const dt = Math.max(1 / 240, now - s.lastMoveAt)
      const ivx = (x - s.x) / dt
      const ivy = (y - s.y) / dt
      s.vx += (ivx - s.vx) * VELOCITY_SMOOTH
      s.vy += (ivy - s.vy) * VELOCITY_SMOOTH
      s.x = x
      s.y = y
      s.clientX = clientX
      s.clientY = clientY
      s.lastMoveAt = now
    },

    up: (id) => remove(id, 'up'),
    cancel: (id) => remove(id, 'cancel'),

    sample: (now) => [...slots.values()].map((s) => toTouch(s, now)),

    events: () => {
      const out = queue
      queue = []
      return out
    },
  }
}
