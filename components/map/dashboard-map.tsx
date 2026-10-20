"use client";

import type L from "leaflet";
import { useResolvedTheme } from "@/components/ui/theme";
import type {
  ClusterCollection,
  ClusterFeature,
  HotspotCollection,
  HotspotFeature,
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
import { selectionShape, type SelectedFeature } from "./selection";
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
  fitPadding?: L.FitBoundsOptions;
  onReady?: (map: L.Map) => void;
  onSelectCluster: (feature: ClusterFeature) => void;
  onSelectCell: (feature: RiskCellFeature) => void;
  onSelectHotspot: (feature: HotspotFeature) => void;
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
  fitPadding,
  onReady,
  onSelectCluster,
  onSelectCell,
  onSelectHotspot,
}: DashboardMapProps) {
  const theme = useResolvedTheme();
  const riskOn = layers.includes("risiko");
  return (
    <MapView label={label} theme={theme} onReady={onReady} fitPadding={fitPadding}>
      {layers.includes("gambut") && risk ? <PeatLayer cells={risk} theme={theme} /> : null}
      {riskOn && risk ? (
        <RiskLayer data={risk} opacity={riskOpacity} theme={theme} regionNames={regionNames} onSelect={onSelectCell} />
      ) : null}
      {layers.includes("batas") && boundaries ? (
        <BoundaryLayer data={boundaries} theme={theme} showLabel={!riskOn} />
      ) : null}
      {layers.includes("zona") && clusters ? (
        <ClusterLayer data={clusters} theme={theme} regionNames={regionNames} onSelect={onSelectCluster} />
      ) : null}
      {selected ? <SelectionLayer shape={selectionShape(selected)} theme={theme} /> : null}
      {layers.includes("hotspot") && hotspots ? (
        <HotspotLayer data={hotspots} regionNames={regionNames} theme={theme} onSelect={onSelectHotspot} />
      ) : null}
    </MapView>
  );
}
