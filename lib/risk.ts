import type { RiskLevel } from "@/types";

/** Lower bound (inclusive) of each risk level. */
export const RISK_THRESHOLDS: Record<RiskLevel, number> = {
  rendah: 0,
  sedang: 0.25,
  tinggi: 0.5,
  sangat_tinggi: 0.75,
};

export const RISK_LEVEL_ORDER: RiskLevel[] = ["rendah", "sedang", "tinggi", "sangat_tinggi"];

export function getRiskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.sangat_tinggi) return "sangat_tinggi";
  if (score >= RISK_THRESHOLDS.tinggi) return "tinggi";
  if (score >= RISK_THRESHOLDS.sedang) return "sedang";
  return "rendah";
}

const RISK_COLORS: Record<RiskLevel, string> = {
  rendah: "transparent",
  sedang: "#F3D27A",
  tinggi: "#E98A3D",
  sangat_tinggi: "#9E2F1C",
};

const RISK_TEXT_COLORS: Record<RiskLevel, string> = {
  rendah: "#1C2321",
  sedang: "#1C2321",
  tinggi: "#1C2321",
  sangat_tinggi: "#FFFFFF",
};

/** Fill color for map layers. "rendah" is transparent on purpose. */
export function getRiskColor(level: RiskLevel): string {
  return RISK_COLORS[level];
}

/** Readable text color on top of {@link getRiskColor}. */
export function getRiskTextColor(level: RiskLevel): string {
  return RISK_TEXT_COLORS[level];
}

const RISK_LABELS: Record<RiskLevel, string> = {
  rendah: "Rendah",
  sedang: "Sedang",
  tinggi: "Tinggi",
  sangat_tinggi: "Sangat tinggi",
};

export function getRiskLabel(level: RiskLevel): string {
  return RISK_LABELS[level];
}

/** Tailwind classes for badges and chips, backed by theme tokens. */
export const RISK_BADGE_CLASSES: Record<RiskLevel, string> = {
  rendah: "bg-risk-rendah text-risk-rendah-fg",
  sedang: "bg-risk-sedang text-risk-sedang-fg",
  tinggi: "bg-risk-tinggi text-risk-tinggi-fg",
  sangat_tinggi: "bg-risk-sangat-tinggi text-risk-sangat-tinggi-fg",
};
