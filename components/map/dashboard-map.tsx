"use client";

import type L from "leaflet";
import { useMemo } from "react";
import { useResolvedTheme } from "@/components/ui/theme";
import { INDONESIA_MAX_BBOX } from "@/lib/geo";
import type {
  ClusterCollection,
  ClusterFeature,
  HotspotCollection,
  HotspotFeature,
  HotspotGroupFeature,
  ProvinceLineCollection,
  RegionBoundaryCollection,
  RegionBoundaryFeature,
  RegionStat,
  RiskCellCollection,
  RiskCellFeature,
  RiskLevel,
} from "@/types";
import { BoundaryLayer } from "./boundary-layer";
import { ChoroplethLayer } from "./choropleth-layer";
import { ClusterLayer } from "./cluster-layer";
import { HotspotGroupLayer } from "./hotspot-group-layer";
import { HotspotLayer } from "./hotspot-layer";
import { MapView } from "./map-view";
import { PeatLayer } from "./peat-layer";
import { ProvinceLineLayer } from "./province-line-layer";
import { RiskLayer } from "./risk-layer";
import { selectionShape, type SelectedFeature, type SelectionShape } from "./selection";
import { SelectionLayer } from "./selection-layer";
import type { LayerKey } from "./use-map-filters";

/** What the map draws at the current zoom: provinces (≤ 6), regencies (7–8), or the 5 km grid (≥ 9). */
export type MapTier = "provinsi" | "kabupaten" | "dekat";

export interface DashboardMapProps {
  label: string;
  tier: MapTier;
  layers: LayerKey[];
  provinces?: RegionBoundaryCollection;
  regencies?: RegionBoundaryCollection;
  provinceLines?: ProvinceLineCollection;
  provinceStats?: Record<string, RegionStat>;
  regencyStats?: Record<string, RegionStat>;
  /** Individual hotspots to draw (all of them up close, the isolated ones further out). */
  hotspots?: HotspotCollection;
  groups: HotspotGroupFeature[];
  clusters?: ClusterCollection;
  risk?: RiskCellCollection;
  riskOpacity: number;
  regionNames: Record<string, string>;
  selected: SelectedFeature | null;
  /** Outline of the focused province or regency. */
  focus: SelectionShape | null;
  focusSlug: string | null;
  /** Legend: fill only regions/cells of this level, and outline the hovered level. */
  onlyLevel?: RiskLevel | null;
  highlightLevel?: RiskLevel | null;
  fitPadding?: L.FitBoundsOptions;
  onReady?: (map: L.Map) => void;
  onSelectCluster: (feature: ClusterFeature) => void;
  onSelectCell: (feature: RiskCellFeature) => void;
  onSelectHotspot: (feature: HotspotFeature) => void;
  onSelectRegion: (feature: RegionBoundaryFeature) => void;
}

/** Map of the main dashboard. Loaded only in the browser (see map-dashboard.tsx). */
export default function DashboardMap({
  label,
  tier,
  layers,
  provinces,
  regencies,
  provinceLines,
  provinceStats,
  regencyStats,
  hotspots,
  groups,
  clusters,
  risk,
  riskOpacity,
  regionNames,
  selected,
  focus,
  focusSlug,
  onlyLevel,
  highlightLevel,
  fitPadding,
  onReady,
  onSelectCluster,
  onSelectCell,
  onSelectHotspot,
  onSelectRegion,
}: DashboardMapProps) {
  const theme = useResolvedTheme();
  const riskOn = layers.includes("risiko");
  const boundsOn = layers.includes("batas");
  const near = tier === "dekat";

  // Regions stay hoverable and clickable whenever the risk or boundary layer is on.
  const regions = tier === "provinsi" ? provinces : tier === "kabupaten" ? regencies : undefined;
  const regionStats = tier === "provinsi" ? provinceStats : regencyStats;

  const riskCells = useMemo(() => {
    if (!risk || !onlyLevel) return risk;
    return { ...risk, features: risk.features.filter((f) => f.properties.level_risiko === onlyLevel) };
  }, [risk, onlyLevel]);

  return (
    <MapView
      label={label}
      theme={theme}
      onReady={onReady}
      fitPadding={fitPadding}
      maxBounds={INDONESIA_MAX_BBOX}
    >
      {regions && (riskOn || boundsOn) ? (
        <ChoroplethLayer
          data={regions}
          stats={regionStats}
          theme={theme}
          opacity={riskOn ? riskOpacity / 0.55 : 0}
          parentNames={regionNames}
          emphasize={focusSlug ?? undefined}
          onlyLevel={onlyLevel}
          highlightLevel={riskOn ? highlightLevel : null}
          outlined={!boundsOn}
          hint="Klik untuk memperbesar"
          onSelect={onSelectRegion}
        />
      ) : null}
      {near && layers.includes("gambut") && risk ? <PeatLayer cells={risk} theme={theme} /> : null}
      {near && riskOn && riskCells ? (
        <RiskLayer data={riskCells} opacity={riskOpacity} theme={theme} regionNames={regionNames} onSelect={onSelectCell} />
      ) : null}
      {boundsOn && tier === "provinsi" && provinces ? (
        <BoundaryLayer data={provinces} theme={theme} weight={1.3} orderKey="batas-provinsi" showLabel={false} />
      ) : null}
      {boundsOn && tier !== "provinsi" && regencies ? (
        <BoundaryLayer data={regencies} theme={theme} weight={0.7} showLabel={near && !riskOn} />
      ) : null}
      {boundsOn && tier !== "provinsi" && provinceLines ? <ProvinceLineLayer data={provinceLines} theme={theme} /> : null}
      {focus ? <SelectionLayer shape={focus} theme={theme} orderKey="fokus" /> : null}
      {layers.includes("zona") && clusters ? (
        <ClusterLayer data={clusters} theme={theme} regionNames={regionNames} onSelect={onSelectCluster} />
      ) : null}
      {selected ? <SelectionLayer shape={selectionShape(selected)} theme={theme} /> : null}
      {layers.includes("hotspot") && hotspots ? (
        <HotspotLayer data={hotspots} regionNames={regionNames} theme={theme} onSelect={onSelectHotspot} />
      ) : null}
      {layers.includes("hotspot") && !near && groups.length > 0 ? <HotspotGroupLayer groups={groups} /> : null}
    </MapView>
  );
}
