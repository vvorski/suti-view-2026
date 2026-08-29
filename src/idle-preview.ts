/**
 * The gate's idle preview: thinned to a fixed rate, and stopped outright once
 * nobody has touched the screen for a while.
 *
 * Pulled out of `main.ts`'s DOM/`requestAnimationFrame` wiring specifically so
 * the 60-second timeout and the frame-rate thinning are checkable the way
 * `probe-shake.ts` checks a springy sensor: by feeding synthetic timestamps,
 * not by waiting a real minute in a browser tab. In a non-frontmost automation
 * window `requestAnimationFrame` never fires at all, and `setTimeout` is
 * throttled to roughly 1Hz — both already documented in CLAUDE.md's harness
 * traps — so neither primitive can be trusted to demonstrate this behaviour
 * live here. The decision logic itself has no such dependency.
 *
 * `isStopped` genuinely means "stop scheduling frames", not "render nothing
 * but keep ticking at the display's own rate" — the caller is expected to stop
 * calling `requestAnimationFrame` once it goes true, which is what actually
 * saves the battery this exists to protect, rather than just skipping the
 * (comparatively cheap) render call every 16ms forever.
 */
export class IdlePreview {
  private readonly frameMs: number
  private readonly timeoutMs: number
  private lastFrame = -Infinity
  private lastActivity: number
  private stopped = false

  // Fields assigned in the body rather than via constructor parameter
  // properties: the latter is TypeScript syntax that generates real
  // assignment code, not pure type annotation, so it does not survive
  // `node --experimental-strip-types` — which only erases types — and this
  // file is imported directly by scripts/probe-idle.ts under that flag.
  constructor(now: number, frameMs: number, timeoutMs: number) {
    this.frameMs = frameMs
    this.timeoutMs = timeoutMs
    this.lastActivity = now
  }

  /** Call on any pointerdown/pointermove. Un-stops if stopped, so the caller
   *  knows to restart the frame chain — see `isStopped`. */
  touch(now: number): void {
    this.lastActivity = now
    this.stopped = false
  }

  /**
   * Call once per `requestAnimationFrame` tick, with its own timestamp.
   * Returns true on exactly the ticks that should actually render.
   */
  tick(now: number): boolean {
    if (this.stopped) return false
    if (now - this.lastActivity >= this.timeoutMs) {
      this.stopped = true
      return false
    }
    if (now - this.lastFrame < this.frameMs) return false
    this.lastFrame = now
    return true
  }

  get isStopped(): boolean {
    return this.stopped
  }
}
