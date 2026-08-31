/**
 * How a layer composites over what is beneath it — the geometric layer over
 * the atmosphere, or the atmosphere over the camera.
 *
 * One shared table for both, because it is the same seven-way rule wherever
 * it is applied — see `blendWith` in composite.frag.glsl. `index` is what
 * actually reaches the shader as `uMode` or `uAtmMode` — a plain int uniform
 * is far cheaper to branch on than a string, and the name here is purely for
 * the control panel.
 */
export const MERGE_MODES = {
  normal: { label: 'Normal', index: 0 },
  add: { label: 'Add', index: 1 },
  screen: { label: 'Screen', index: 2 },
  multiply: { label: 'Multiply', index: 3 },
  overlay: { label: 'Overlay', index: 4 },
  difference: { label: 'Difference', index: 5 },
  // docs/todo.md entry 105 — Porter-Duff's own name for this operator (fuzzy
  // XOR, a + b - 2ab) is Photoshop's "Exclusion"; labelled XOR anyway
  // because that is the word that was asked for, is shorter on a wedge, and
  // MERGE_MODES has no description field for the synonym to live in
  // instead. Mine.
  xor: { label: 'XOR', index: 6 },
} as const

export type MergeModeName = keyof typeof MERGE_MODES

/**
 * Screen at less-than-full mix: the rings glow through the field rather than
 * either fighting it for the same pixels (Normal) or wiping past it (Add).
 */
export const DEFAULT_MERGE_MODE: MergeModeName = 'screen'

/**
 * The atmosphere's own default blend, over the camera.
 *
 * Screen, not a fork: that is what composite.frag.glsl hardcoded before this
 * layer got a selectable mode of its own, so any other default would change
 * every picture already made with the passthrough camera the moment this
 * control shipped.
 */
export const DEFAULT_ATM_MERGE_MODE: MergeModeName = 'screen'

export const DEFAULT_MIX = 0.4

export function isMergeModeName(v: string | null): v is MergeModeName {
  return v !== null && v in MERGE_MODES
}
