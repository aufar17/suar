"use client";

import { useMemo } from "react";
import { useTheme } from "@/components/ui/theme";
import type { BBox, HotspotCollection, RegionBoundaryCollection, RiskCellCollection } from "@/types";
import { BoundaryLayer } from "./boundary-layer";
import { HotspotLayer } from "./hotspot-layer";
import { MapView } from "./map-view";
import { RiskLayer } from "./risk-layer";

export interface RegionMapProps {
  slug: string;
  name: string;
  bbox: BBox;
  hotspots?: HotspotCollection;
  risk?: RiskCellCollection;
  boundaries?: RegionBoundaryCollection;
  regionNames: Record<string, string>;
}

/** Region page map: the region's risk grid and hotspots, with its outline emphasized. */
export default function RegionMap({ slug, name, bbox, hotspots, risk, boundaries, regionNames }: RegionMapProps) {
  const theme = useTheme();
  const regionRisk = useMemo(
    () => risk && { ...risk, features: risk.features.filter((f) => f.properties.kabupaten === slug) },
    [risk, slug],
  );
  return (
    <MapView label={`Peta risiko dan hotspot ${name}`} bbox={bbox}>
      {regionRisk ? <RiskLayer data={regionRisk} opacity={0.65} /> : null}
      {boundaries ? <BoundaryLayer data={boundaries} theme={theme} emphasize={slug} /> : null}
      {hotspots ? <HotspotLayer data={hotspots} regionNames={regionNames} theme={theme} /> : null}
    </MapView>
  );
}
