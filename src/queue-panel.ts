/**
 * Renders the queue ladder baked into `__QUEUE__` by vite.config.ts —
 * docs/todo.md entry 93. The build number already says which build this
 * is; this says what it contains and what's coming, on a piece that
 * redeploys several times an hour.
 *
 * Purely decorative: every row is `pointer-events: none` (set in
 * index.html's CSS on `#queue-panel`), so a tap anywhere over it reaches
 * whatever the gate would otherwise have handed it — Start, a chip,
 * entry 80's fullscreen precedence, all still win.
 */

interface QueueRow {
  n: number
  title: string
  build?: number
}

interface QueueData {
  shipped: QueueRow[]
  waiting: QueueRow[]
  remaining: number
}

function row(entry: QueueRow, kind: 'shipped' | 'waiting'): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `queue-row queue-row-${kind}`
  const dot = document.createElement('span')
  dot.className = 'queue-dot'
  const text = document.createElement('span')
  text.className = 'queue-text'
  text.textContent = kind === 'shipped' ? `${entry.build} · ${entry.title}` : `${entry.n} · ${entry.title}`
  el.append(dot, text)
  return el
}

/**
 * Mount the queue ladder into `#queue-panel` — a static, empty container
 * already in index.html, inside `#gate` so it fades and hides with it.
 * Runs alongside `mountReleaseName()`/`mountVersionHud()` in main.ts's boot
 * sequence and, like both of those, never delays or gates Start.
 *
 * Rows fade in staggered, oldest first, so the ladder prints rather than
 * appears — unless `prefers-reduced-motion` asks for less motion, in which
 * case every row is present and fully visible immediately. Entry 65's own
 * lesson, applied again: the preference asks for less motion, never less
 * information.
 */
export function mountQueuePanel(): void {
  const panel = document.getElementById('queue-panel')
  if (!panel) return

  const queue: QueueData = JSON.parse(__QUEUE__)
  if (queue.shipped.length === 0 && queue.waiting.length === 0) return

  const rows: HTMLElement[] = []
  for (const entry of queue.shipped) rows.push(row(entry, 'shipped'))
  if (queue.shipped.length > 0 && queue.waiting.length > 0) {
    const rule = document.createElement('div')
    rule.className = 'queue-rule'
    rows.push(rule)
  }
  for (const entry of queue.waiting) rows.push(row(entry, 'waiting'))
  if (queue.remaining > 0) {
    const more = document.createElement('div')
    more.className = 'queue-row queue-more'
    more.textContent = `… +${queue.remaining} more`
    rows.push(more)
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  rows.forEach((el, i) => {
    panel.appendChild(el)
    if (reduced) {
      el.classList.add('queue-shown')
      return
    }
    // 40ms apart, oldest first — Decided's own figure for the stagger.
    el.style.transitionDelay = `${i * 40}ms`
    // Two rAFs, not one: a single callback can still land before the
    // browser has committed the opacity: 0 starting frame, which would
    // make the very first row's own fade invisible — it would just appear.
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('queue-shown')))
  })
}
