/**
 * The RGB filter on the geometric layer.
 *
 * The geometric views draw in white only. All of their colour comes from
 * here, applied to the finished layer in the composite pass rather than
 * chosen per-pixel inside each shader.
 *
 * Separating shape from colour this way has three payoffs: a filter change is
 * instant and total rather than a shader recompile; every geometric view gets
 * colour for free without repeating a palette in each one; and the geometry
 * can be kept deliberately out of the atmospheric layer's hue range, so the
 * two layers never fight for the same colour.
 *
 * `spectrum` is the exception that earns the interface: rather than a fixed
 * triple it is recomputed each frame from the spectral tilt, so the geometry
 * tracks the room's brightness the way the atmospheric layer already does.
 */

export interface GeoFilter {
  readonly label: string
  /** Linear RGB gains applied to the white layer. Null means audio-driven. */
  readonly rgb: readonly [number, number, number] | null
}

export const GEO_FILTERS = {
  white: { label: 'White', rgb: [1, 1, 1] },
  // Slightly warm rather than pure R/G/B: a saturated primary on a near-black
  // ground clips to a flat silhouette and loses the line weight that carries
  // loudness. Pulling the other two channels up a little keeps the edges
  // readable while the hue still reads as unambiguously red, green or blue.
  red: { label: 'Red', rgb: [1, 0.22, 0.26] },
  green: { label: 'Green', rgb: [0.32, 1, 0.48] },
  blue: { label: 'Blue', rgb: [0.34, 0.52, 1] },
  amber: { label: 'Amber', rgb: [1, 0.72, 0.28] },
  cyan: { label: 'Cyan', rgb: [0.36, 0.94, 1] },
  magenta: { label: 'Magenta', rgb: [1, 0.38, 0.86] },
  spectrum: { label: 'Spectrum', rgb: null },
} satisfies Record<string, GeoFilter>

export type GeoFilterName = keyof typeof GEO_FILTERS

export const DEFAULT_GEO_FILTER: GeoFilterName = 'white'

export function isGeoFilterName(v: string | null): v is GeoFilterName {
  return v !== null && v in GEO_FILTERS
}

/** HSV to RGB, for the audio-driven filter. Value is pinned at 1 — this is a
 *  gain on white, so darkening belongs to the layer, not to the filter. */
function hsv(h: number, s: number): [number, number, number] {
  const f = (n: number): number => {
    const k = (n + h * 6) % 6
    return 1 - s * Math.max(0, Math.min(Math.min(k, 4 - k), 1))
  }
  return [f(5), f(3), f(1)]
}

/**
 * The gains to apply this frame. `tilt` is the spectral balance, 0-1.
 *
 * The hue window is deliberately narrow and offset: a full 0-1 sweep spends
 * most of a track somewhere muddy, whereas two thirds of a turn starting in
 * the cyans keeps it inside the cold end this project's palette lives in.
 */
export function filterRgb(
  name: GeoFilterName,
  tilt: number,
): readonly [number, number, number] {
  const fixed = GEO_FILTERS[name].rgb
  if (fixed) return fixed
  return hsv((0.52 + tilt * 0.66) % 1, 0.72)
}
