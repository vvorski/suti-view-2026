/**
 * The two view registries — geometric and atmospheric — that scene.ts
 * composites together every frame.
 *
 * Every view shares the same uniforms and the same fullscreen vertex shader,
 * so a view is nothing but a fragment shader plus a label. That constraint is
 * deliberate: it means scene.ts never learns anything about what a particular
 * view does, and adding one is a file plus a line here.
 *
 * The split into two registries is deliberate too. Geometric views are
 * discrete-event things (a ring born on a hit); atmospheric views are
 * continuous fields (noise, spectrograms, envelopes). Nothing stops a future
 * view from blurring that line, but the two are picked independently in the
 * control panel and composited rather than switched between, so they need
 * separate defaults and separate URL params.
 *
 * Switching recompiles a shader (tens of milliseconds). That is fine for a
 * deliberate choice from the control panel and would not be fine per frame.
 */

import auroraFrag from './shaders/aurora.frag.glsl?raw'
import chorusFrag from './shaders/chorus.frag.glsl?raw'
import circlesFrag from './shaders/circles.frag.glsl?raw'
import driftFrag from './shaders/drift.frag.glsl?raw'
import fieldFrag from './shaders/field.frag.glsl?raw'
import gridFrag from './shaders/grid.frag.glsl?raw'
import latticeFrag from './shaders/lattice.frag.glsl?raw'
import shardsFrag from './shaders/shards.frag.glsl?raw'
import spectrogramFrag from './shaders/spectrogram.frag.glsl?raw'
import tideFrag from './shaders/tide.frag.glsl?raw'

export interface View {
  readonly label: string
  readonly description: string
  readonly fragmentShader: string
}

export const GEOMETRIC_VIEWS = {
  circles: {
    label: 'Circles',
    description: 'Rings born on a hit, fading as they reach the rim.',
    fragmentShader: circlesFrag,
  },
  shards: {
    label: 'Shards',
    description: 'Angular fragments thrown outward on a hit, spinning down.',
    fragmentShader: shardsFrag,
  },
  grid: {
    label: 'Grid',
    description: 'Square wavefronts lighting whole cells at a time.',
    fragmentShader: gridFrag,
  },
  // Three variations on Circles that keep its ring and move its emitter. They
  // sit after the three originals rather than next to Circles because the
  // registry's order is the order the HUD offers them in, and the first three
  // are the three different answers to "what does a hit look like" — the ones
  // worth meeting first. These are the same answer from somewhere else.
  drift: {
    label: 'Drift',
    description: "Circles' ring from a wandering origin, so families overlap off-centre.",
    fragmentShader: driftFrag,
  },
  chorus: {
    label: 'Chorus',
    description: 'Several fixed origins in a ring; each hit fires one and their fronts cross.',
    fragmentShader: chorusFrag,
  },
  tide: {
    label: 'Tide',
    description: 'Rings born on the frame edge, arriving as arcs that sweep inward.',
    fragmentShader: tideFrag,
  },
} satisfies Record<string, View>

export const ATMOSPHERIC_VIEWS = {
  field: {
    label: 'Field',
    description: 'Domain-warped fractal noise. Nocturnal, atmospheric, slow.',
    fragmentShader: fieldFrag,
  },
  lattice: {
    label: 'Lattice',
    description: 'Visionary mandala after Alex Grey. Endless, symmetric, emissive.',
    fragmentShader: latticeFrag,
  },
  spectrogram: {
    label: 'Spectrogram',
    description: 'The last 8 seconds, spiralling out. Radius is time, angle is pitch.',
    fragmentShader: spectrogramFrag,
  },
  aurora: {
    label: 'Aurora',
    description: 'Hanging curtains of light. The only view with a horizon.',
    fragmentShader: auroraFrag,
  },
} satisfies Record<string, View>

export type GeometricViewName = keyof typeof GEOMETRIC_VIEWS
export type AtmosphericViewName = keyof typeof ATMOSPHERIC_VIEWS

export const DEFAULT_GEOMETRIC_VIEW: GeometricViewName = 'circles'
export const DEFAULT_ATMOSPHERIC_VIEW: AtmosphericViewName = 'field'

export function isGeometricViewName(v: string | null): v is GeometricViewName {
  return v !== null && v in GEOMETRIC_VIEWS
}

export function isAtmosphericViewName(v: string | null): v is AtmosphericViewName {
  return v !== null && v in ATMOSPHERIC_VIEWS
}
