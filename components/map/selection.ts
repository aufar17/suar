import type { ClusterFeature, Position, RiskCellFeature } from "@/types";

/** What the user clicked. Cells are kept by id so the detail follows the prediction day. */
export type MapSelection = { kind: "cluster"; id: string } | { kind: "cell"; id: string };

export type SelectedFeature =
  | { kind: "cluster"; feature: ClusterFeature }
  | { kind: "cell"; feature: RiskCellFeature };

export function selectionRing(selected: SelectedFeature): Position[] {
  return selected.feature.geometry.coordinates[0];
}
