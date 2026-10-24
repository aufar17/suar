import type { BBox } from "@/types";

/** [minLon, minLat, maxLon, maxLat] → MapLibre bounds. Safe to import outside the map bundle. */
export function bboxToBounds([minLon, minLat, maxLon, maxLat]: BBox): [[number, number], [number, number]] {
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}
