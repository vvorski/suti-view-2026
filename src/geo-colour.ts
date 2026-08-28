/**
 * The RGB channel gains on the geometric layer.
 *
 * The geometric views draw in white only. All of their colour comes from
 * here, applied to the finished layer in the composite pass rather than
 * chosen per-pixel inside each shader.
 *
 * Separating shape from colour this way has three payoffs: a colour change is
 * instant and total rather than a shader recompile; every geometric view gets
 * colour for free without repeating a palette in each one; and the geometry
 * can be kept deliberately out of the atmospheric layer's hue range, so the
 * two layers never fight for the same colour.
 *
 * This is three continuous gains, not a list of named colours. The palette
 * version that came first was the wrong shape twice over: it put a colour
 * chooser on a dial band, where the thing that belongs is the composition mode
 * between the two layers, and it fixed in advance which colours exist. Three
 * intensities are what a filter actually is — the whole space is reachable,
 * including the desaturated and near-black settings a preset list never
 * offers, and a channel at zero is a genuine channel kill rather than a
 * missing entry.
 */

/** Per-channel gains applied to the white geometric layer. 0-1 each. */
export interface GeoColour {
  r: number
  g: number
  b: number
}

/** White: every channel at full. The geometry's own drawn brightness is what
 *  carries loudness, so full-scale is the neutral, not a mid-grey. */
export const DEFAULT_GEO_COLOUR: GeoColour = { r: 1, g: 1, b: 1 }

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export function clampGeoColour(c: GeoColour): GeoColour {
  return { r: clamp01(c.r), g: clamp01(c.g), b: clamp01(c.b) }
}

export function isGeoColour(v: unknown): v is GeoColour {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Partial<GeoColour>
  return (
    typeof c.r === 'number' &&
    typeof c.g === 'number' &&
    typeof c.b === 'number' &&
    Number.isFinite(c.r) &&
    Number.isFinite(c.g) &&
    Number.isFinite(c.b)
  )
}

/**
 * Parse a `rgb=` URL parameter: three 0-100 integers, e.g. `rgb=100,30,40`.
 * Percentages rather than 0-1 floats so a shared link stays readable and
 * survives being retyped.
 */
export function parseGeoColour(raw: string | null): GeoColour | null {
  if (!raw) return null
  const parts = raw.split(',')
  if (parts.length !== 3) return null
  const n = parts.map((p) => Number(p.trim()))
  if (n.some((v) => Number.isNaN(v))) return null
  return clampGeoColour({ r: n[0] / 100, g: n[1] / 100, b: n[2] / 100 })
}
