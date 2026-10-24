"use client";

import type { Map as MaplibreMap, PaddingOptions } from "maplibre-gl";
import { memo } from "react";
import { useResolvedTheme } from "@/components/ui/theme";
import { INDONESIA_MAX_BBOX } from "@/lib/geo";
import type { ClusterCollection, RegionStat, RiskGrid, RiskLevel } from "@/types";
import { GEO_FILES } from "./geo-files";
import { GridLayers } from "./grid-layers";
import { HotspotLayers } from "./hotspot-layers";
import { MapInteractions } from "./interactions";
import type { LegendHighlight } from "./map-legend";
import { MapView } from "./map-view";
import { ProvinceLineLayer } from "./province-line-layer";
import { RegionLabelLayer, RegionLayers } from "./region-layers";
import type { SelectionShape } from "./selection";
import { SelectionLayer } from "./selection-layer";
import { DEFAULT_RISK_OPACITY, GRID_MIN_ZOOM, REGENCY_MIN_ZOOM, type MapTier } from "./styles";
import type { LayerKey } from "./use-map-filters";
import { ZoneLayers } from "./zone-layers";

export interface DashboardMapProps {
  label: string;
  /** Initial center and zoom from the URL (`peta`); otherwise the whole country. */
  initialView?: { center: [number, number]; zoom: number } | null;
  /** Tier at the last settled view: decides which regions react to the pointer. */
  tier: MapTier;
  layers: LayerKey[];
  /** Add the regency boundaries (first time the map reaches zoom 6, or a regency is focused). */
  regencies: boolean;
  /** The regency boundaries have loaded: provinces then hand over at zoom 6. */
  regenciesLoaded: boolean;
  provinceStats?: Record<string, RegionStat>;
  regencyStats?: Record<string, RegionStat>;
  /** URL of the hotspots of the whole country for the chosen window (grouped by the map). */
  hotspots: string | null;
  clusters?: ClusterCollection;
  /** 5 km grid of the visible area (zoom ≥ 8) with every prediction day. */
  grid?: RiskGrid;
  targetDate: string;
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
  onSelectHotspot: (id: string, point: [number, number]) => void;
  onSelectRegion: (slug: string) => void;
}

/**
 * Map of the main dashboard. Loaded only in the browser (see map-dashboard.tsx).
 *
 * Every source stays mounted once its data exists; switching a layer off only hides it
 * (`visibility`), and the zoom tiers are layer zoom ranges, so zooming never waits for React:
 * provinces < 6, regencies 6 to < 8, the 5 km grid and single hotspots ≥ 8. Boundaries and
 * hotspots are URLs that MapLibre's worker fetches and parses off the main thread.
 *
 * Memoized: the page re-renders when the map settles (summary, legend counts), and the map
 * only re-renders when one of its own props changed.
 */
export default memo(function DashboardMap({
  label,
  initialView = null,
  tier,
  layers,
  regencies,
  regenciesLoaded,
  provinceStats,
  regencyStats,
  hotspots,
  clusters,
  grid,
  targetDate,
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
  const provinceZoom: [number, number] = regenciesLoaded ? [0, REGENCY_MIN_ZOOM] : [0, 24];
  const regencyZoom: [number, number] = [REGENCY_MIN_ZOOM, GRID_MIN_ZOOM];

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
    <MapView
      label={label}
      theme={theme}
      initialView={initialView}
      onReady={onReady}
      fitPadding={fitPadding}
      maxBounds={INDONESIA_MAX_BBOX}
    >
      <MapInteractions>
        <RegionLayers
          level="provinsi"
          data={GEO_FILES.provinsi}
          zoom={provinceZoom}
          stats={provinceStats}
          {...regionLayer("provinsi")}
          boundary={boundsOn ? { weight: 1.3, zoom: provinceZoom, emphasis: boundaryEmphasis("provinsi") } : null}
        />
        <RegionLabelLayer level="provinsi" data={GEO_FILES.labelProvinsi} />
        {regencies ? (
          <>
            <RegionLayers
              level="kabupaten"
              data={GEO_FILES.kabupaten}
              zoom={regencyZoom}
              stats={regencyStats}
              {...regionLayer("kabupaten")}
              boundary={boundsOn ? { weight: 0.7, zoom: [REGENCY_MIN_ZOOM, 24], emphasis: boundaryEmphasis("kabupaten") } : null}
              nameOnHover={tier === "dekat" && boundsOn && !riskOn}
            />
            <RegionLabelLayer level="kabupaten" data={GEO_FILES.labelKabupaten} />
            <ProvinceLineLayer
              data={GEO_FILES.provinsiGaris}
              visible={boundsOn}
              minzoom={REGENCY_MIN_ZOOM}
              emphasis={boundaryEmphasis("provinsi")}
            />
          </>
        ) : null}
        {grid ? (
          <GridLayers
            grid={grid}
            targetDate={targetDate}
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
            highlight={highlight?.kind === "kepercayaan" ? highlight.level : null}
            groupEmphasis={highlight?.kind === "kelompok"}
            onSelect={onSelectHotspot}
          />
        ) : null}
      </MapInteractions>
    </MapView>
  );
});
