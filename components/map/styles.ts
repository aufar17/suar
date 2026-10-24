import type { ClusterStatus, Confidence } from "@/types";

// Map styles shared by the map layers and the legend. Kept free of MapLibre imports so the
// legend can render on the server.

/** What the map draws at the current zoom: provinces (< 6), regencies (6 to < 8), or the 5 km grid (≥ 8). */
export type MapTier = "provinsi" | "kabupaten" | "dekat";

/** Zoom thresholds of the tiers (MapLibre zoom, 512 px tiles). */
export const REGENCY_MIN_ZOOM = 6;
export const GRID_MIN_ZOOM = 8;

export function tierOf(zoom: number): MapTier {
  if (zoom < REGENCY_MIN_ZOOM) return "provinsi";
  if (zoom < GRID_MIN_ZOOM) return "kabupaten";
  return "dekat";
}

/** Choropleth fill opacity at full strength; low enough that basemap labels stay readable. */
export const CHOROPLETH_FILL = 0.42;

/** Default fill of the risk grid: translucent so basemap labels stay readable. */
export const DEFAULT_RISK_OPACITY = 0.55;

/** Hotspot fill opacity per confidence level. */
export const HOTSPOT_OPACITY: Record<Confidence, number> = { low: 0.5, nominal: 0.8, high: 1 };

/** Marker radius in px, growing with Fire Radiative Power (MW). */
export function hotspotRadius(frp: number): number {
  return Math.min(12, Math.max(3.5, 3 + Math.sqrt(frp) * 0.9));
}

/** Outline per zone status, so status is readable without color. Dashes in px. */
export const ZONE_STYLES: Record<ClusterStatus, { weight: number; dashArray?: string; opacity: number }> = {
  baru: { weight: 2, dashArray: "1 4", opacity: 1 },
  meluas: { weight: 2.6, opacity: 1 },
  stabil: { weight: 1.8, dashArray: "6 4", opacity: 1 },
  menyusut: { weight: 1.3, dashArray: "10 6", opacity: 0.65 },
};
