"use client";

import type { Map as MaplibreMap, PaddingOptions } from "maplibre-gl";
import { useResolvedTheme } from "@/components/ui/theme";
import { INDONESIA_MAX_BBOX } from "@/lib/geo";
import type {
  ClusterCollection,
  GroupedHotspotCollection,
  ProvinceLineCollection,
  RegionBoundaryCollection,
  RegionStat,
  RiskCellCollection,
  RiskLevel,
} from "@/types";
import { GridLayers } from "./grid-layers";
import { HotspotLayers } from "./hotspot-layers";
import { MapInteractions } from "./interactions";
import type { LegendHighlight } from "./map-legend";
import { MapView } from "./map-view";
import { ProvinceLineLayer } from "./province-line-layer";
import { RegionLabelLayer, RegionLayers } from "./region-layers";
import type { SelectionShape } from "./selection";
import { SelectionLayer } from "./selection-layer";
import { DEFAULT_RISK_OPACITY, type MapTier } from "./styles";
import type { LayerKey } from "./use-map-filters";
import { ZoneLayers } from "./zone-layers";

export interface DashboardMapProps {
  label: string;
  tier: MapTier;
  layers: LayerKey[];
  provinces?: RegionBoundaryCollection;
  regencies?: RegionBoundaryCollection;
  provinceLines?: ProvinceLineCollection;
  provinceStats?: Record<string, RegionStat>;
  regencyStats?: Record<string, RegionStat>;
  /** Hotspots to draw (all of them up close, groups and isolated ones further out). */
  hotspots?: GroupedHotspotCollection;
  clusters?: ClusterCollection;
  risk?: RiskCellCollection;
  riskOpacity: number;
  regionNames: Record<string, string>;
  /** Outline of the selected cell, zone, or hotspot. */
  selected: SelectionShape | null;
  /** Focused province or regency. */
  focusSlug: string | null;
  focusLevel: "provinsi" | "kabupaten" | null;
  /** Legend: fill only regions/cells of this level. */
  onlyLevel?: RiskLevel | null;
  /** Legend item under the pointer: the matching objects are emphasized. */
  highlight?: LegendHighlight | null;
  fitPadding?: PaddingOptions;
  onReady?: (map: MaplibreMap) => void;
  onSelectCluster: (id: string) => void;
  onSelectCell: (cellId: string) => void;
  onSelectHotspot: (id: string) => void;
  onSelectRegion: (slug: string) => void;
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
  clusters,
  risk,
  riskOpacity,
  regionNames,
  selected,
  focusSlug,
  focusLevel,
  onlyLevel = null,
  highlight = null,
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
  const highlightLevel = riskOn && highlight?.kind === "risiko" ? highlight.level : null;
  const boundaryEmphasis = (level: "provinsi" | "kabupaten") => highlight?.kind === "batas" && highlight.tier === level;
  // The choropleth follows the risk opacity slider (its default is the grid's default opacity).
  const choroplethOpacity = riskOpacity / DEFAULT_RISK_OPACITY;

  // Regions stay hoverable and clickable whenever the risk or boundary layer is on.
  const regionLayer = (level: "provinsi" | "kabupaten") => {
    const active = tier === level;
    return {
      choropleth: active && riskOn,
      stats: level === "provinsi" ? provinceStats : regencyStats,
      opacity: choroplethOpacity,
      onlyLevel: riskOn ? onlyLevel : null,
      highlightLevel: active ? highlightLevel : null,
      interactive: active && (riskOn || boundsOn),
      outlined: !boundsOn,
      parentNames: regionNames,
      hint: "Klik untuk memperbesar",
      onSelect: onSelectRegion,
      focus: focusLevel === level ? focusSlug : null,
    };
  };

  return (
    <MapView label={label} theme={theme} onReady={onReady} fitPadding={fitPadding} maxBounds={INDONESIA_MAX_BBOX}>
      <MapInteractions>
        {provinces ? (
          <>
            <RegionLayers
              level="provinsi"
              data={provinces}
              {...regionLayer("provinsi")}
              boundary={boundsOn && tier === "provinsi" ? { weight: 1.3, emphasis: boundaryEmphasis("provinsi") } : null}
            />
            <RegionLabelLayer level="provinsi" data={provinces} />
          </>
        ) : null}
        {regencies ? (
          <>
            <RegionLayers
              level="kabupaten"
              data={regencies}
              {...regionLayer("kabupaten")}
              boundary={boundsOn && tier !== "provinsi" ? { weight: 0.7, emphasis: boundaryEmphasis("kabupaten") } : null}
              nameOnHover={near && boundsOn && !riskOn}
            />
            <RegionLabelLayer level="kabupaten" data={regencies} />
          </>
        ) : null}
        {boundsOn && tier !== "provinsi" && provinceLines ? (
          <ProvinceLineLayer data={provinceLines} emphasis={boundaryEmphasis("provinsi")} />
        ) : null}
        {near && risk ? (
          <GridLayers
            data={risk}
            risk={riskOn}
            opacity={riskOpacity}
            peat={layers.includes("gambut")}
            peatEmphasis={highlight?.kind === "gambut"}
            onlyLevel={riskOn ? onlyLevel : null}
            highlightLevel={highlightLevel}
            regionNames={regionNames}
            onSelect={onSelectCell}
          />
        ) : null}
        {layers.includes("zona") && clusters ? (
          <ZoneLayers
            data={clusters}
            regionNames={regionNames}
            highlight={highlight?.kind === "zona" ? highlight.status : null}
            onSelect={onSelectCluster}
          />
        ) : null}
        {selected ? <SelectionLayer shape={selected} /> : null}
        {layers.includes("hotspot") && hotspots ? (
          <HotspotLayers
            data={hotspots}
            regionNames={regionNames}
            highlight={highlight?.kind === "kepercayaan" ? highlight.level : null}
            groupEmphasis={highlight?.kind === "kelompok"}
            onSelect={onSelectHotspot}
          />
        ) : null}
      </MapInteractions>
    </MapView>
  );
}
