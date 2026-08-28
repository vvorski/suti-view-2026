/**
 * What the device remembers between visits.
 *
 * Split out from the control surface itself because the two change for
 * different reasons: the HUD is a design that will be reworked, the shape of
 * what persists is a contract with everyone's localStorage. Reads and writes
 * are wrapped because private-mode browsers throw on access rather than
 * returning null.
 */

import { clampGeoColour, isGeoColour, type GeoColour } from './geo-colour'
import { MAPPINGS, type MappingName } from './mapping'
import { isMergeModeName, type MergeModeName } from './merge-modes'
import {
  isAtmosphericViewName,
  isGeometricViewName,
  type AtmosphericViewName,
  type GeometricViewName,
} from './views'

const STORE_KEY = 'suti-view:prefs'

export interface Prefs {
  geometricView: GeometricViewName
  geoColour: GeoColour
  atmosphericView: AtmosphericViewName
  mergeMode: MergeModeName
  /** 0-1. Universal opacity: 0 is pure atmosphere, 1 is the full blend. */
  mix: number
  mapping: MappingName
  showStats: boolean
}

/** `valid` narrows `raw ?? null` rather than `raw` itself, so the ternary needs
 *  to return that same narrowed value — returning `raw` directly does not
 *  type-check even though it holds the same value. */
function pick<K extends string>(
  raw: string | undefined,
  valid: (v: string | null) => v is K,
  fallback: K,
): K {
  const v = raw ?? null
  return valid(v) ? v : fallback
}

export function loadPrefs(fallback: Prefs): Prefs {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      geometricView: pick(parsed.geometricView, isGeometricViewName, fallback.geometricView),
      // Was a named-palette string until the colour became three channel
      // gains. An old string simply fails isGeoColour and falls back to white,
      // which is the right answer for a stored value that no longer means
      // anything — no migration table for a preference nobody will miss.
      geoColour: isGeoColour(parsed.geoColour)
        ? clampGeoColour(parsed.geoColour)
        : fallback.geoColour,
      atmosphericView: pick(
        parsed.atmosphericView,
        isAtmosphericViewName,
        fallback.atmosphericView,
      ),
      mergeMode: pick(parsed.mergeMode, isMergeModeName, fallback.mergeMode),
      mix:
        typeof parsed.mix === 'number' && parsed.mix >= 0 && parsed.mix <= 1
          ? parsed.mix
          : fallback.mix,
      mapping:
        parsed.mapping && parsed.mapping in MAPPINGS ? parsed.mapping : fallback.mapping,
      showStats:
        typeof parsed.showStats === 'boolean' ? parsed.showStats : fallback.showStats,
    }
  } catch {
    // Private mode, blocked site data, corrupt JSON — all the same to us.
    return fallback
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(prefs))
  } catch {
    // Not being able to remember the choice is not a reason to reject it.
  }
}
