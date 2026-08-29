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
import { MAPPINGS, type MappingName } from './engine'
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
  /** The geometric layer's own blend, over the atmosphere. */
  mergeMode: MergeModeName
  /** The atmospheric layer's own blend, over the camera. Added rather than
   *  folded into `mergeMode` under a shared name, for the same reason
   *  `geoColour`/`atmColour`/`camColour` are three fields and not one: each
   *  layer's setting is its own stored fact, and `mergeMode` already has a
   *  name and a meaning on every device that has ever run this. */
  atmMergeMode: MergeModeName
  /**
   * 0-1. The old crossfade, kept and still honoured.
   *
   * Superseded by `geoAlpha`/`atmAlpha`, and deliberately *not* repurposed:
   * this field is a contract with every visitor's localStorage, and quietly
   * changing what a stored number means would reset or corrupt the picture of
   * everyone who has ever loaded the page, with no way for them to tell. It is
   * still written, still read, and is what seeds `geoAlpha` for anyone whose
   * storage predates the split. See loadPrefs.
   */
  mix: number
  /**
   * 0-1. The geometric layer's own opacity — what `mix` used to control.
   *
   * Absent from older storage, in which case it is seeded from `mix` so the
   * picture someone left behind is the picture they come back to.
   */
  geoAlpha: number
  /**
   * 0-1. The atmospheric layer's own opacity.
   *
   * New capability rather than a renamed one: nothing before this could turn
   * the atmosphere down, which is why the camera underneath was unreadable at
   * every setting. Defaults to 1, which is exactly how the old crossfade
   * behaved.
   */
  atmAlpha: number
  /**
   * Per-layer colour gains, the same shape as `geoColour`.
   *
   * Added rather than folded into one structure, because `geoColour` is
   * already stored under that name on every device that has ever run this and
   * moving it would be a change of meaning, not an addition. White is
   * identity, so an older visitor who has never touched these gets exactly the
   * picture they had.
   */
  atmColour: GeoColour
  camColour: GeoColour
  /**
   * 0-1. How much of the passthrough camera shows beneath everything.
   *
   * Stored so the value survives a session, but **never restored above 0** —
   * see `loadPrefs`. Restoring it would mean a page load reaching for the
   * camera with no gesture behind it, which `getUserMedia` would refuse
   * anyway, and which is the wrong thing to attempt regardless: a stored
   * number must not be able to switch a sensor on.
   */
  passthrough: number
  mapping: MappingName
  /** Let the slow tier choose colour and programme. See director.ts. */
  autopilot: boolean
  showStats: boolean
  /**
   * Whether tilt gives the generated layers a steady offset toward the low
   * side, on top of the tumble — docs/todo.md entry 30. Defaults off: it
   * changes what a held-still, unshaken phone looks like, which the tumble
   * alone never did.
   */
  gravity: boolean
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

/** A stored 0-1, or the given fallback when it is absent or out of range. */
function unit(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && raw >= 0 && raw <= 1 ? raw : fallback
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
      atmMergeMode: pick(parsed.atmMergeMode, isMergeModeName, fallback.atmMergeMode),
      mix:
        typeof parsed.mix === 'number' && parsed.mix >= 0 && parsed.mix <= 1
          ? parsed.mix
          : fallback.mix,
      // Seeded from the stored crossfade when absent, which is what makes the
      // split invisible to anyone upgrading: geoAlpha was mix, and atmAlpha at
      // 1 is what the crossfade always implied about the atmosphere.
      geoAlpha: unit(parsed.geoAlpha, unit(parsed.mix, fallback.geoAlpha)),
      atmColour: isGeoColour(parsed.atmColour)
        ? clampGeoColour(parsed.atmColour)
        : fallback.atmColour,
      camColour: isGeoColour(parsed.camColour)
        ? clampGeoColour(parsed.camColour)
        : fallback.camColour,
      atmAlpha: unit(parsed.atmAlpha, fallback.atmAlpha),
      // Always 0 on load, whatever was stored. Every other field here restores
      // what the user last chose; this one deliberately does not, because
      // restoring it would have the page reach for the camera on arrival with
      // no gesture behind it. The promise on the start gate is that the camera
      // is off until asked for, and a value in localStorage is not an asking.
      passthrough: 0,
      mapping:
        parsed.mapping && parsed.mapping in MAPPINGS ? parsed.mapping : fallback.mapping,
      autopilot:
        typeof parsed.autopilot === 'boolean' ? parsed.autopilot : fallback.autopilot,
      showStats:
        typeof parsed.showStats === 'boolean' ? parsed.showStats : fallback.showStats,
      gravity:
        typeof parsed.gravity === 'boolean' ? parsed.gravity : fallback.gravity,
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
