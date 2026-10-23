import type { ClusterStatus, Confidence } from "@/types";

// Map styles shared by the Leaflet layers and the legend. Kept free of Leaflet imports so the
// legend can render on the server.

/** Hotspot fill opacity per confidence level. */
export const HOTSPOT_OPACITY: Record<Confidence, number> = { low: 0.5, nominal: 0.8, high: 1 };

/** Marker radius in px, growing with Fire Radiative Power (MW). */
export function hotspotRadius(frp: number): number {
  return Math.min(12, Math.max(3.5, 3 + Math.sqrt(frp) * 0.9));
}

/** Outline per zone status, so status is readable without color. */
export const ZONE_STYLES: Record<ClusterStatus, { weight: number; dashArray?: string; opacity: number }> = {
  baru: { weight: 2, dashArray: "1 4", opacity: 1 },
  meluas: { weight: 2.6, opacity: 1 },
  stabil: { weight: 1.8, dashArray: "6 4", opacity: 1 },
  menyusut: { weight: 1.3, dashArray: "10 6", opacity: 0.65 },
};
