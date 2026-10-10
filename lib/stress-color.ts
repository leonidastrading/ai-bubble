/**
 * One continuous scale for stress: 0 = green, 100 = red. Interpolates hue in
 * OKLCH so mid-scores read as a blend (yellow-green, amber) instead of jumping
 * between flat bands. Lightness comes from a CSS variable so the same ramp
 * stays legible in light and dark themes.
 */
// Endpoints are a true green and a true red (#ff0000 is oklch(0.63 0.26 29)).
// Lightness per theme comes from CSS variables; hue and chroma are shared.
const GREEN = { h: 145, c: 0.2 };
const RED = { h: 29, c: 0.24 };

export function stressColor(score: number, alpha = 1): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const hue = GREEN.h + (RED.h - GREEN.h) * t;
  const chroma = GREEN.c + (RED.c - GREEN.c) * t;
  const l = `calc(var(--ramp-l-green) + (var(--ramp-l-red) - var(--ramp-l-green)) * ${t.toFixed(3)})`;
  return `oklch(${l} ${chroma.toFixed(3)} ${hue.toFixed(1)}${alpha < 1 ? ` / ${alpha}` : ""})`;
}

/** Map a value onto 0–100 between a calm and a crisis level (either direction). */
export function toScore(v: number, calm: number, crisis: number): number {
  return Math.max(0, Math.min(100, ((v - calm) / (crisis - calm)) * 100));
}
