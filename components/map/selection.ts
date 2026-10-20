import type { ClusterFeature, Position, RiskCellFeature } from "@/types";

export type MapSelection =
  | { kind: "cluster"; feature: ClusterFeature }
  | { kind: "cell"; feature: RiskCellFeature };

export function selectionRing(selection: MapSelection): Position[] {
  return selection.feature.geometry.coordinates[0];
}
