import type { Map as MaplibreMap } from "maplibre-gl";
import { CONFIDENCE_LEVELS, type BoundaryTier, type Confidence } from "@/types/constants";

// Source and layer ids shared with code outside the map bundle, and readers of the rendered
// map. Only type imports from maplibre-gl: the dashboard page imports this file, and MapLibre
// itself must stay in the dynamically loaded map chunk.

export const HOTSPOT_SOURCE = "hotspot";
export const HOTSPOT_POINT_LAYER = "hotspot-titik";
export const HOTSPOT_GROUP_LAYER = "hotspot-kelompok";
export const GRID_SOURCE = "grid";
export const GRID_RISK_LAYER = "grid-risiko";

export function regionSource(level: BoundaryTier): string {
  return `wilayah-${level}`;
}

/** Fill layer of a level: hover/click target, and used to find the region at a point. */
export function regionFillLayer(level: BoundaryTier): string {
  return `wilayah-${level}-isi`;
}

/** Slug of the regency under the center of the map (null below zoom `minZoom`). */
export function readCenterRegency(map: MaplibreMap, minZoom: number): string | null {
  const layer = regionFillLayer("kabupaten");
  if (map.getZoom() < minZoom || !map.getLayer(layer)) return null;
  const feature = map.queryRenderedFeatures(map.project(map.getCenter()), { layers: [layer] })[0];
  return feature ? String(feature.properties.slug) : null;
}

export interface HotspotViewCounts {
  /** Hotspots on screen, single or inside a group. */
  total: number;
  /** Single hotspots on screen per confidence. */
  byConfidence: Record<Confidence, number>;
  /** Numbered groups on screen. */
  groups: number;
}

/** Hotspots drawn on screen (from the clustered source), or null while the layer is hidden. */
export function readHotspotCounts(map: MaplibreMap): HotspotViewCounts | null {
  if (!map.getLayer(HOTSPOT_POINT_LAYER) || map.getLayoutProperty(HOTSPOT_POINT_LAYER, "visibility") === "none") return null;
  const byConfidence = Object.fromEntries(CONFIDENCE_LEVELS.map((c) => [c, 0])) as Record<Confidence, number>;
  let total = 0;
  // A feature near a tile edge can be returned twice.
  const points = new Set<unknown>();
  for (const feature of map.queryRenderedFeatures({ layers: [HOTSPOT_POINT_LAYER] })) {
    const id = feature.properties.id;
    if (points.has(id)) continue;
    points.add(id);
    const confidence = feature.properties.confidence as Confidence;
    if (confidence in byConfidence) byConfidence[confidence]++;
    total++;
  }
  const groups = new Set<unknown>();
  for (const feature of map.queryRenderedFeatures({ layers: [HOTSPOT_GROUP_LAYER] })) {
    const id = feature.properties.cluster_id;
    if (groups.has(id)) continue;
    groups.add(id);
    total += Number(feature.properties.point_count) || 0;
  }
  return { total, byConfidence, groups: groups.size };
}

export function sameHotspotCounts(a: HotspotViewCounts | null, b: HotspotViewCounts | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.total === b.total && a.groups === b.groups && CONFIDENCE_LEVELS.every((c) => a.byConfidence[c] === b.byConfidence[c])
  );
}
