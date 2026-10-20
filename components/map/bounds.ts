import type { LatLngBoundsExpression } from "leaflet";
import type { BBox } from "@/types";

/** [minLon, minLat, maxLon, maxLat] → Leaflet bounds. Safe to import outside the map bundle. */
export function bboxToBounds([minLon, minLat, maxLon, maxLat]: BBox): LatLngBoundsExpression {
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}
