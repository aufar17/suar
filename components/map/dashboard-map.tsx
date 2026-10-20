"use client";

import { useTheme } from "@/components/ui/theme";
import type { HotspotCollection } from "@/types";
import { HotspotLayer } from "./hotspot-layer";
import { MapView } from "./map-view";
import type { LayerKey } from "./use-map-filters";

export interface DashboardMapProps {
  label: string;
  layers: LayerKey[];
  hotspots?: HotspotCollection;
  regionNames: Record<string, string>;
}

/** Map of the main dashboard. Loaded only in the browser (see map-dashboard.tsx). */
export default function DashboardMap({ label, layers, hotspots, regionNames }: DashboardMapProps) {
  const theme = useTheme();
  return (
    <MapView label={label}>
      {layers.includes("hotspot") && hotspots ? (
        <HotspotLayer data={hotspots} regionNames={regionNames} theme={theme} />
      ) : null}
    </MapView>
  );
}
