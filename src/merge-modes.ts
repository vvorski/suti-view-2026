/**
 * How the geometric layer composites over the atmospheric one.
 *
 * `index` is what actually reaches the shader (composite.frag.glsl's `uMode`)
 * — a plain int uniform is far cheaper to branch on than a string, and the
 * name here is purely for the control panel's dropdown.
 */
export const MERGE_MODES = {
  normal: { label: 'Normal', index: 0 },
  add: { label: 'Add', index: 1 },
  screen: { label: 'Screen', index: 2 },
  multiply: { label: 'Multiply', index: 3 },
  overlay: { label: 'Overlay', index: 4 },
  difference: { label: 'Difference', index: 5 },
} as const

export type MergeModeName = keyof typeof MERGE_MODES

/**
 * Screen at less-than-full mix: the rings glow through the field rather than
 * either fighting it for the same pixels (Normal) or wiping past it (Add).
 */
export const DEFAULT_MERGE_MODE: MergeModeName = 'screen'
export const DEFAULT_MIX = 0.4

export function isMergeModeName(v: string | null): v is MergeModeName {
  return v !== null && v in MERGE_MODES
}
