"use client";

import type { Map as MaplibreMap } from "maplibre-gl";
import { useResolvedTheme } from "@/components/ui/theme";
import type { BBox, RegionStat, RiskGrid } from "@/types";
import { GEO_FILES } from "./geo-files";
import { GridLayers } from "./grid-layers";
import { HotspotLayers } from "./hotspot-layers";
import { MapInteractions } from "./interactions";
import { MapView } from "./map-view";
import { RegionLabelLayer, RegionLayers } from "./region-layers";
import { DEFAULT_RISK_OPACITY } from "./styles";

export interface RegionMapProps {
  slug: string;
  name: string;
  /** Province pages show their regencies by mean risk; regency pages show the 5 km grid. */
  kind: "provinsi" | "kabupaten";
  /** Province of the region (its own slug for a province): only its regencies are drawn. */
  provinsi: string;
  bbox: BBox;
  /** URL of the region's hotspots (loaded by the map's worker). */
  hotspots: string;
  grid?: RiskGrid;
  targetDate: string;
  stats?: Record<string, RegionStat>;
  regionNames: Record<string, string>;
  onReady?: (map: MaplibreMap) => void;
}

/** Region page map: hotspots over the regencies' mean risk (province) or the risk grid (regency). */
export default function RegionMap({
  slug,
  name,
  kind,
  provinsi,
  bbox,
  hotspots,
  grid,
  targetDate,
  stats,
  regionNames,
  onReady,
}: RegionMapProps) {
  const theme = useResolvedTheme();
  return (
    <MapView label={`Peta risiko dan hotspot ${name}`} bbox={bbox} theme={theme} onReady={onReady}>
      <MapInteractions>
        <RegionLayers
          level="kabupaten"
          data={GEO_FILES.kabupaten}
          provinsi={provinsi}
          choropleth={kind === "provinsi"}
          stats={stats}
          interactive={kind === "provinsi"}
          parentNames={regionNames}
          boundary={kind === "kabupaten" ? { weight: 1.2 } : null}
          emphasize={kind === "kabupaten" ? slug : null}
        />
        <RegionLabelLayer level="kabupaten" data={GEO_FILES.labelKabupaten} provinsi={provinsi} />
        {kind === "kabupaten" && grid ? (
          <GridLayers grid={grid} targetDate={targetDate} risk opacity={DEFAULT_RISK_OPACITY} peat={false} />
        ) : null}
        <HotspotLayers data={hotspots} />
      </MapInteractions>
    </MapView>
  );
}
