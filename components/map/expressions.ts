import type { ExpressionSpecification } from "maplibre-gl";
import type { Theme } from "@/components/ui/theme";
import { getRiskColor, RISK_LEVEL_ORDER } from "@/lib/risk";
import type { RiskLevel } from "@/types";

// Small builders for style expressions whose length is only known at runtime.

export const TRANSPARENT = "rgba(0,0,0,0)";

export const HOVER: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];

/** `value` inside the zoom range [min, max), 0 outside (for opacity paint properties). */
export function zoomRange(value: number, [min, max]: [number, number]): number | ExpressionSpecification {
  if (min <= 0 && max >= 24) return value;
  if (min <= 0) return ["step", ["zoom"], value, max, 0];
  if (max >= 24) return ["step", ["zoom"], 0, min, value];
  return ["step", ["zoom"], 0, min, value, max, 0];
}

/** "#RRGGBB" with an alpha channel, as rgba(). */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Risk level as a number (0 = rendah … 3 = sangat tinggi), as stored in feature-state. */
export function levelIndex(level: RiskLevel): number {
  return RISK_LEVEL_ORDER.indexOf(level);
}

/** The feature's risk level from feature-state, or -1 while it has none. */
export const STATE_LEVEL: ExpressionSpecification = ["coalesce", ["feature-state", "level"], -1];

/**
 * Fill color from the feature-state level. "Rendah" stays unfilled so most of the land keeps
 * the basemap visible; with `onlyLevel` every other level is unfilled too.
 */
export function riskFillColor(theme: Theme, onlyLevel: RiskLevel | null): ExpressionSpecification {
  const color: ExpressionSpecification = [
    "match",
    STATE_LEVEL,
    levelIndex("sedang"),
    getRiskColor("sedang", theme),
    levelIndex("tinggi"),
    getRiskColor("tinggi", theme),
    levelIndex("sangat_tinggi"),
    getRiskColor("sangat_tinggi", theme),
    TRANSPARENT,
  ];
  return onlyLevel ? ["case", ["==", STATE_LEVEL, levelIndex(onlyLevel)], color, TRANSPARENT] : color;
}

/** True for features whose feature-state level is `level` (false for every feature when null). */
export function hasStateLevel(level: RiskLevel | null): ExpressionSpecification {
  return ["==", STATE_LEVEL, level ? levelIndex(level) : -2];
}
