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

import circlesFrag from './shaders/circles.frag.glsl?raw'
import fieldFrag from './shaders/field.frag.glsl?raw'
import latticeFrag from './shaders/lattice.frag.glsl?raw'

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
