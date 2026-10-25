import type { RiskLevel } from "@/types";

/** Lower bound (inclusive) of each risk level. */
export const RISK_THRESHOLDS: Record<RiskLevel, number> = {
  rendah: 0,
  sedang: 0.25,
  tinggi: 0.5,
  sangat_tinggi: 0.75,
};

export const RISK_LEVEL_ORDER: RiskLevel[] = ["rendah", "sedang", "tinggi", "sangat_tinggi"];

/**
 * The pipeline only predicts some provinces; every other region comes with 0 grid cells and a
 * score of 0, which means "not computed", not low risk. Use this before reading a region's score.
 */
export function hasPrediction(region: { jumlah_sel: number } | null | undefined): boolean {
  return region != null && region.jumlah_sel > 0;
}

export const NO_PREDICTION_LABEL = "Tidak diprediksi";
/** Shown on the map (tooltip) for a region without a prediction. */
export const NO_PREDICTION_TOOLTIP = "Tidak ada prediksi untuk wilayah ini";
/** Shown on region pages and summaries in place of the risk score. */
export const NO_PREDICTION_MESSAGE = "Prediksi risiko belum tersedia untuk wilayah ini";

export function getRiskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.sangat_tinggi) return "sangat_tinggi";
  if (score >= RISK_THRESHOLDS.tinggi) return "tinggi";
  if (score >= RISK_THRESHOLDS.sedang) return "sedang";
  return "rendah";
}

// Mirrors the --risk-* tokens in app/globals.css. In dark mode "sangat tinggi" is lighter
// (#B91C1C is only 3.07:1 against the dark background).
const RISK_COLORS: Record<"light" | "dark", Record<RiskLevel, string>> = {
  light: { rendah: "transparent", sedang: "#FACC15", tinggi: "#F97316", sangat_tinggi: "#B91C1C" },
  dark: { rendah: "transparent", sedang: "#FACC15", tinggi: "#F97316", sangat_tinggi: "#DC2626" },
};

/** Fill color for map layers. "rendah" is transparent on purpose. */
export function getRiskColor(level: RiskLevel, theme: "light" | "dark" = "light"): string {
  return RISK_COLORS[theme][level];
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
