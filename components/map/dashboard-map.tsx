"use client";

import type { Map as MaplibreMap, PaddingOptions } from "maplibre-gl";
import { useMemo } from "react";
import { useResolvedTheme } from "@/components/ui/theme";
import { INDONESIA_MAX_BBOX } from "@/lib/geo";
import type {
  ClusterCollection,
  HotspotCollection,
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
import { labelPoints, RegionLabelLayer, RegionLayers } from "./region-layers";
import type { SelectionShape } from "./selection";
import { SelectionLayer } from "./selection-layer";
import { DEFAULT_RISK_OPACITY, GRID_MIN_ZOOM, REGENCY_MIN_ZOOM, type MapTier } from "./styles";
import type { LayerKey } from "./use-map-filters";
import { ZoneLayers } from "./zone-layers";

export interface DashboardMapProps {
  label: string;
  /** Tier at the last settled view: decides which regions react to the pointer. */
  tier: MapTier;
  layers: LayerKey[];
  provinces?: RegionBoundaryCollection;
  regencies?: RegionBoundaryCollection;
  provinceLines?: ProvinceLineCollection;
  provinceStats?: Record<string, RegionStat>;
  regencyStats?: Record<string, RegionStat>;
  /** Hotspots of the whole country for the chosen window (grouped by the map). */
  hotspots?: HotspotCollection;
  clusters?: ClusterCollection;
  /** 5 km grid of the visible area (zoom ≥ 8). */
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

/**
 * Map of the main dashboard. Loaded only in the browser (see map-dashboard.tsx).
 *
 * Every source stays mounted once its data exists; switching a layer off only hides it
 * (`visibility`), and the zoom tiers are layer zoom ranges, so zooming never waits for React:
 * provinces < 6, regencies 6 to < 8, the 5 km grid and single hotspots ≥ 8.
 */
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
  const highlightLevel = riskOn && highlight?.kind === "risiko" ? highlight.level : null;
  const boundaryEmphasis = (level: "provinsi" | "kabupaten") => highlight?.kind === "batas" && highlight.tier === level;
  // Provinces keep their fill until the regencies have loaded.
  const provinceZoom: [number, number] = regencies ? [0, REGENCY_MIN_ZOOM] : [0, 24];
  const regencyZoom: [number, number] = [REGENCY_MIN_ZOOM, GRID_MIN_ZOOM];
  const provinceLabels = useMemo(() => provinces && labelPoints(provinces), [provinces]);
  const regencyLabels = useMemo(() => regencies && labelPoints(regencies), [regencies]);

  // The choropleth follows the risk opacity slider (its default is the grid's default opacity).
  const regionLayer = (level: "provinsi" | "kabupaten") => ({
    choropleth: riskOn,
    opacity: riskOpacity / DEFAULT_RISK_OPACITY,
    onlyLevel: riskOn ? onlyLevel : null,
    highlightLevel: tier === level ? highlightLevel : null,
    // Regions stay hoverable and clickable whenever the risk or boundary layer is on.
    interactive: tier === level && (riskOn || boundsOn),
    outlined: !boundsOn,
    parentNames: regionNames,
    hint: "Klik untuk memperbesar",
    onSelect: onSelectRegion,
    focus: focusLevel === level ? focusSlug : null,
  });

  return (
    <MapView label={label} theme={theme} onReady={onReady} fitPadding={fitPadding} maxBounds={INDONESIA_MAX_BBOX}>
      <MapInteractions>
        {provinces ? (
          <>
            <RegionLayers
              level="provinsi"
              data={provinces}
              zoom={provinceZoom}
              stats={provinceStats}
              {...regionLayer("provinsi")}
              boundary={boundsOn ? { weight: 1.3, zoom: provinceZoom, emphasis: boundaryEmphasis("provinsi") } : null}
            />
            {provinceLabels ? <RegionLabelLayer level="provinsi" data={provinceLabels} /> : null}
          </>
        ) : null}
        {regencies ? (
          <>
            <RegionLayers
              level="kabupaten"
              data={regencies}
              zoom={regencyZoom}
              stats={regencyStats}
              {...regionLayer("kabupaten")}
              boundary={boundsOn ? { weight: 0.7, zoom: [REGENCY_MIN_ZOOM, 24], emphasis: boundaryEmphasis("kabupaten") } : null}
              nameOnHover={tier === "dekat" && boundsOn && !riskOn}
            />
            {regencyLabels ? <RegionLabelLayer level="kabupaten" data={regencyLabels} /> : null}
          </>
        ) : null}
        {provinceLines ? (
          <ProvinceLineLayer
            data={provinceLines}
            visible={boundsOn}
            minzoom={REGENCY_MIN_ZOOM}
            emphasis={boundaryEmphasis("provinsi")}
          />
        ) : null}
        {risk ? (
          <GridLayers
            data={risk}
            minzoom={GRID_MIN_ZOOM}
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
        {clusters ? (
          <ZoneLayers
            data={clusters}
            visible={layers.includes("zona")}
            regionNames={regionNames}
            highlight={highlight?.kind === "zona" ? highlight.status : null}
            onSelect={onSelectCluster}
          />
        ) : null}
        <SelectionLayer shape={selected} />
        {hotspots ? (
          <HotspotLayers
            data={hotspots}
            visible={layers.includes("hotspot")}
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
