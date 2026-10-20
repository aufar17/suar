"use client";

import { useTheme } from "@/components/ui/theme";
import type { ClusterCollection, ClusterFeature, HotspotCollection } from "@/types";
import { ClusterLayer } from "./cluster-layer";
import { HotspotLayer } from "./hotspot-layer";
import { MapView } from "./map-view";
import { selectionRing, type MapSelection } from "./selection";
import { SelectionLayer } from "./selection-layer";
import type { LayerKey } from "./use-map-filters";

export interface DashboardMapProps {
  label: string;
  layers: LayerKey[];
  hotspots?: HotspotCollection;
  clusters?: ClusterCollection;
  regionNames: Record<string, string>;
  selection: MapSelection | null;
  onSelectCluster: (feature: ClusterFeature) => void;
}

/** Map of the main dashboard. Loaded only in the browser (see map-dashboard.tsx). */
export default function DashboardMap({
  label,
  layers,
  hotspots,
  clusters,
  regionNames,
  selection,
  onSelectCluster,
}: DashboardMapProps) {
  const theme = useTheme();
  return (
    <MapView label={label}>
      {layers.includes("zona") && clusters ? (
        <ClusterLayer data={clusters} theme={theme} onSelect={onSelectCluster} />
      ) : null}
      {selection ? <SelectionLayer ring={selectionRing(selection)} theme={theme} /> : null}
      {layers.includes("hotspot") && hotspots ? (
        <HotspotLayer data={hotspots} regionNames={regionNames} theme={theme} />
      ) : null}
    </MapView>
  );
}
