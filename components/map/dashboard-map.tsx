"use client";

import { useResolvedTheme } from "@/components/ui/theme";
import type {
  ClusterCollection,
  ClusterFeature,
  HotspotCollection,
  RegionBoundaryCollection,
  RiskCellCollection,
  RiskCellFeature,
} from "@/types";
import { BoundaryLayer } from "./boundary-layer";
import { ClusterLayer } from "./cluster-layer";
import { HotspotLayer } from "./hotspot-layer";
import { MapView } from "./map-view";
import { PeatLayer } from "./peat-layer";
import { RiskLayer } from "./risk-layer";
import { selectionRing, type SelectedFeature } from "./selection";
import { SelectionLayer } from "./selection-layer";
import type { LayerKey } from "./use-map-filters";

export interface DashboardMapProps {
  label: string;
  layers: LayerKey[];
  hotspots?: HotspotCollection;
  clusters?: ClusterCollection;
  risk?: RiskCellCollection;
  boundaries?: RegionBoundaryCollection;
  riskOpacity: number;
  regionNames: Record<string, string>;
  selected: SelectedFeature | null;
  onSelectCluster: (feature: ClusterFeature) => void;
  onSelectCell: (feature: RiskCellFeature) => void;
}

/** Map of the main dashboard. Loaded only in the browser (see map-dashboard.tsx). */
export default function DashboardMap({
  label,
  layers,
  hotspots,
  clusters,
  risk,
  boundaries,
  riskOpacity,
  regionNames,
  selected,
  onSelectCluster,
  onSelectCell,
}: DashboardMapProps) {
  const theme = useResolvedTheme();
  return (
    <MapView label={label}>
      {layers.includes("gambut") && risk ? <PeatLayer cells={risk} theme={theme} /> : null}
      {layers.includes("risiko") && risk ? <RiskLayer data={risk} opacity={riskOpacity} onSelect={onSelectCell} /> : null}
      {layers.includes("batas") && boundaries ? <BoundaryLayer data={boundaries} theme={theme} /> : null}
      {layers.includes("zona") && clusters ? (
        <ClusterLayer data={clusters} theme={theme} onSelect={onSelectCluster} />
      ) : null}
      {selected ? <SelectionLayer ring={selectionRing(selected)} theme={theme} /> : null}
      {layers.includes("hotspot") && hotspots ? (
        <HotspotLayer data={hotspots} regionNames={regionNames} theme={theme} />
      ) : null}
    </MapView>
  );
}
