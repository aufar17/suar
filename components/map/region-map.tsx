"use client";

import type L from "leaflet";
import { useResolvedTheme } from "@/components/ui/theme";
import type { BBox, HotspotCollection, RegionBoundaryCollection, RegionStat, RiskCellCollection } from "@/types";
import { BoundaryLayer } from "./boundary-layer";
import { ChoroplethLayer } from "./choropleth-layer";
import { HotspotLayer } from "./hotspot-layer";
import { MapView } from "./map-view";
import { RiskLayer } from "./risk-layer";

export interface RegionMapProps {
  slug: string;
  name: string;
  /** Province pages show their regencies by mean risk; regency pages show the 5 km grid. */
  kind: "provinsi" | "kabupaten";
  bbox: BBox;
  hotspots?: HotspotCollection;
  risk?: RiskCellCollection;
  /** Regencies/cities of the province. */
  boundaries?: RegionBoundaryCollection;
  stats?: Record<string, RegionStat>;
  regionNames: Record<string, string>;
  onReady?: (map: L.Map) => void;
}

/** Region page map: hotspots over the regencies' mean risk (province) or the risk grid (regency). */
export default function RegionMap({
  slug,
  name,
  kind,
  bbox,
  hotspots,
  risk,
  boundaries,
  stats,
  regionNames,
  onReady,
}: RegionMapProps) {
  const theme = useResolvedTheme();
  return (
    <MapView label={`Peta risiko dan hotspot ${name}`} bbox={bbox} theme={theme} onReady={onReady}>
      {kind === "provinsi" && boundaries ? (
        <ChoroplethLayer data={boundaries} stats={stats} theme={theme} parentNames={regionNames} />
      ) : null}
      {kind === "kabupaten" && risk ? <RiskLayer data={risk} opacity={0.55} theme={theme} /> : null}
      {kind === "kabupaten" && boundaries ? <BoundaryLayer data={boundaries} theme={theme} emphasize={slug} /> : null}
      {hotspots ? <HotspotLayer data={hotspots} regionNames={regionNames} theme={theme} /> : null}
    </MapView>
  );
}
