/**
 * The QR code and share button on the start gate.
 *
 * Both point at wherever this page is actually being served — `location` rather
 * than a constant — so the QR works from the deployed site, from a phone
 * pointed at the dev server on the LAN, and from whatever host comes next,
 * without anyone remembering to update a URL in two places.
 *
 * Query and hash are dropped. A share is an invitation to the piece, not to
 * the exact settings of the tab it was sent from — and `?debug` in particular
 * has no business travelling to somebody else's phone.
 */

import { qrMatrix, qrPath } from './qr'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** How many modules of light margin a QR needs to be scannable. */
const QUIET = 3

export function shareUrl(): string {
  return `${location.origin}${location.pathname}`
}

/** Draw the QR into `svg`, sized in module units so CSS controls the pixels. */
function paintQr(svg: SVGSVGElement, text: string): boolean {
  let matrix: boolean[][]
  try {
    matrix = qrMatrix(text)
  } catch {
    // Only thrown when the URL exceeds version 4-L, which no real one does.
    // A gate with no QR is worse than a gate with a broken one only if nobody
    // notices; hiding it is the honest outcome.
    return false
  }
  const n = matrix.length
  const span = n + QUIET * 2
  svg.setAttribute('viewBox', `0 0 ${span} ${span}`)
  while (svg.firstChild) svg.removeChild(svg.firstChild)

  const bg = document.createElementNS(SVG_NS, 'rect')
  bg.setAttribute('width', String(span))
  bg.setAttribute('height', String(span))
  bg.setAttribute('rx', '1')
  bg.setAttribute('fill', '#cfd3dd')
  svg.appendChild(bg)

  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', qrPath(matrix))
  path.setAttribute('transform', `translate(${QUIET} ${QUIET})`)
  path.setAttribute('fill', '#05060a')
  // shape-rendering: without it, a QR at this size gets antialiased into grey
  // fringes between modules and scanners lose contrast at the edges.
  path.setAttribute('shape-rendering', 'crispEdges')
  svg.appendChild(path)
  return true
}

/**
 * Wire up the QR and the share button.
 *
 * Safe to call when the elements are absent — the gate markup is the only
 * caller, but this should not be what breaks a page that has been edited.
 */
export function mountShare(): void {
  const url = shareUrl()

  const svg = document.getElementById('qr') as SVGSVGElement | null
  // setAttribute, not `.hidden`: SVGElement has no hidden property, and the
  // .gate-qr[hidden] rule is what actually removes it from the layout.
  if (svg && !paintQr(svg, url)) svg.setAttribute('hidden', '')

  const button = document.getElementById('share') as HTMLButtonElement | null
  if (!button) return

  // The button is an icon now, so feedback is a state on the icon rather than
  // a word swapped into it — there is no text to swap.
  const flash = (ok: boolean): void => {
    button.classList.toggle('done', ok)
    button.title = ok ? 'Link copied' : 'Could not copy the link'
    window.setTimeout(() => {
      button.classList.remove('done')
      button.title = ''
    }, 1600)
  }

  button.addEventListener('click', (e) => {
    // The gate's own click handler is on the Start button, not here, but this
    // sits inside the gate and a stray bubble should not start the audio.
    e.stopPropagation()
    void (async () => {
      // navigator.share is the good path on a phone: it opens the OS sheet and
      // the person chooses what happens, so nothing leaves the device on our
      // say-so. Desktop mostly lacks it, hence the clipboard fallback.
      if (navigator.share) {
        try {
          await navigator.share({ title: 'suti·view', url })
          return
        } catch {
          // Dismissing the sheet rejects. That is a choice, not a failure, and
          // falling through to copy would override it.
          return
        }
      }
      try {
        await navigator.clipboard.writeText(url)
        flash(true)
      } catch {
        flash(false)
      }
    })()
  })
}
