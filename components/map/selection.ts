import type { ClusterFeature, HotspotFeature, Position, RiskCellFeature } from "@/types";

/** What the user clicked. Cells are kept by id so the detail follows the prediction day. */
export type MapSelection =
  | { kind: "cluster"; id: string }
  | { kind: "cell"; id: string }
  | { kind: "hotspot"; id: string };

export type SelectedFeature =
  | { kind: "cluster"; feature: ClusterFeature }
  | { kind: "cell"; feature: RiskCellFeature }
  | { kind: "hotspot"; feature: HotspotFeature };

/** Outline (polygons) or point (hotspots) to highlight on the map. */
export type SelectionShape = { ring: Position[] } | { point: Position };

export function selectionShape(selected: SelectedFeature): SelectionShape {
  if (selected.kind === "hotspot") return { point: selected.feature.geometry.coordinates };
  return { ring: selected.feature.geometry.coordinates[0] };
}
