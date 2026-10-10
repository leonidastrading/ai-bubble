import type { DealType } from "./network";

export const DEAL_TYPES: { type: DealType; label: string; color: string }[] = [
  { type: "hardware", label: "Hardware or software", color: "var(--s7)" },
  { type: "investment", label: "Investment", color: "var(--s6)" },
  { type: "services", label: "Cloud / services", color: "var(--s1)" },
  { type: "vc", label: "Venture capital", color: "var(--s3)" },
  { type: "credit", label: "Credit / guarantee", color: "var(--s2)" },
];
