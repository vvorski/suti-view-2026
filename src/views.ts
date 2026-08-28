/**
 * The visualiser registry.
 *
 * Every view shares the same uniforms and the same fullscreen vertex shader, so
 * a view is nothing but a fragment shader plus a label. That constraint is
 * deliberate: it means `scene.ts` never learns anything about what a particular
 * view does, and adding one is a file plus a line here.
 *
 * Switching recompiles a shader (tens of milliseconds). That is fine for a
 * deliberate choice from the control panel and would not be fine per frame.
 */

import fieldFrag from './shaders/field.frag.glsl?raw'
import latticeFrag from './shaders/lattice.frag.glsl?raw'

export interface View {
  readonly label: string
  readonly description: string
  readonly fragmentShader: string
}

export const VIEWS = {
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

export type ViewName = keyof typeof VIEWS

export const DEFAULT_VIEW: ViewName = 'field'

export function isViewName(v: string | null): v is ViewName {
  return v !== null && v in VIEWS
}
