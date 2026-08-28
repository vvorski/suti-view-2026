/**
 * A per-release tint on the gate screen's edges — a glance-level "did this
 * actually deploy" signal that doesn't require reading the version number.
 *
 * The hue steps by the golden angle per build number, so consecutive
 * releases land on visibly distinct colours instead of drifting slowly
 * around the wheel (which would make back-to-back deploys look identical).
 */
const GOLDEN_ANGLE_DEG = 137.508

export function applyReleaseTone(buildNumber: string): void {
  const hue = (Number(buildNumber) * GOLDEN_ANGLE_DEG) % 360
  document.documentElement.style.setProperty('--tone-hue', hue.toFixed(1))
}
