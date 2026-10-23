import type { ClusterFeature, HotspotFeature, Position, RegionBoundaryFeature, RiskCellFeature } from "@/types";

/** What the user clicked. Cells are kept by id so the detail follows the prediction day. */
export type MapSelection =
  | { kind: "cluster"; id: string }
  | { kind: "cell"; id: string }
  | { kind: "hotspot"; id: string };

export type SelectedFeature =
  | { kind: "cluster"; feature: ClusterFeature }
  | { kind: "cell"; feature: RiskCellFeature }
  | { kind: "hotspot"; feature: HotspotFeature };

/** Outlines (polygons) or a point (hotspots) to highlight on the map. */
export type SelectionShape = { rings: Position[][] } | { point: Position };

export function selectionShape(selected: SelectedFeature): SelectionShape {
  if (selected.kind === "hotspot") return { point: selected.feature.geometry.coordinates };
  return { rings: [selected.feature.geometry.coordinates[0]] };
}

/** Outer rings of a province or regency, for the selection outline. */
export function regionShape(feature: RegionBoundaryFeature): SelectionShape {
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return { rings: polygons.map((polygon) => polygon[0]) };
}
