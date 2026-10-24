"use client";

import type { Map as MaplibreMap } from "maplibre-gl";
import { useMemo } from "react";
import { useResolvedTheme } from "@/components/ui/theme";
import type { BBox, HotspotCollection, RegionBoundaryCollection, RegionStat, RiskCellCollection } from "@/types";
import { GridLayers } from "./grid-layers";
import { HotspotLayers } from "./hotspot-layers";
import { MapInteractions } from "./interactions";
import { MapView } from "./map-view";
import { labelPoints, RegionLabelLayer, RegionLayers } from "./region-layers";
import { DEFAULT_RISK_OPACITY } from "./styles";

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
  onReady?: (map: MaplibreMap) => void;
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
  const labels = useMemo(() => boundaries && labelPoints(boundaries), [boundaries]);
  return (
    <MapView label={`Peta risiko dan hotspot ${name}`} bbox={bbox} theme={theme} onReady={onReady}>
      <MapInteractions>
        {boundaries ? (
          <>
            <RegionLayers
              level="kabupaten"
              data={boundaries}
              choropleth={kind === "provinsi"}
              stats={stats}
              interactive={kind === "provinsi"}
              parentNames={regionNames}
              boundary={kind === "kabupaten" ? { weight: 1.2 } : null}
              emphasize={kind === "kabupaten" ? slug : null}
            />
            {labels ? <RegionLabelLayer level="kabupaten" data={labels} /> : null}
          </>
        ) : null}
        {kind === "kabupaten" && risk ? <GridLayers data={risk} risk opacity={DEFAULT_RISK_OPACITY} peat={false} /> : null}
        {hotspots ? <HotspotLayers data={hotspots} regionNames={regionNames} /> : null}
      </MapInteractions>
    </MapView>
  );
}
