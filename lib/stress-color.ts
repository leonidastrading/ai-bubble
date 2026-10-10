/**
 * One continuous scale for stress: 0 = green, 100 = red. Interpolates hue in
 * OKLCH so mid-scores read as a blend (yellow-green, amber) instead of jumping
 * between flat bands. Lightness comes from a CSS variable so the same ramp
 * stays legible in light and dark themes.
 */
const GREEN_HUE = 150;
const RED_HUE = 27;

export function stressColor(score: number, alpha = 1): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const hue = GREEN_HUE - (GREEN_HUE - RED_HUE) * t;
  return `oklch(var(--ramp-l) 0.19 ${hue.toFixed(1)}${alpha < 1 ? ` / ${alpha}` : ""})`;
}

/** Map a value onto 0–100 between a calm and a crisis level (either direction). */
export function toScore(v: number, calm: number, crisis: number): number {
  return Math.max(0, Math.min(100, ((v - calm) / (crisis - calm)) * 100));
}
