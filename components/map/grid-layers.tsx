"use client";

import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import { formatDecimal } from "@/lib/format";
import { getRiskColor, getRiskLabel, RISK_LEVEL_ORDER } from "@/lib/risk";
import type { RiskGrid, RiskLevel } from "@/types";
import { slotId } from "./basemap";
import { hasStateLevel, HOVER, riskFillColor } from "./expressions";
import { escapeHtml, swatchHtml, tooltipHtml } from "./hover";
import { useLayerInteraction } from "./interactions";
import { useMapStyle } from "./map-view";
import { GRID_RISK_LAYER, GRID_SOURCE } from "./map-queries";
import { gridDay, gridFeatures, gridStates, type GridCellProps } from "./risk-grid";
import { useFeatureStates } from "./use-feature-state";

const PEAT_FILL = { normal: 0.26, emphasis: 0.55 };

export interface GridLayersProps {
  grid: RiskGrid;
  /** Prediction day shown (YYYY-MM-DD). Changing it only updates feature-state. */
  targetDate: string;
  /** Lowest zoom at which the grid is drawn. */
  minzoom?: number;
  /** Risk fill ("Prediksi risiko" layer) and its opacity. */
  risk: boolean;
  opacity: number;
  /** Peat cells ("Lahan gambut" layer); `peatEmphasis` = legend hover. */
  peat: boolean;
  peatEmphasis?: boolean;
  /** Legend filter: fill only cells of this level. */
  onlyLevel?: RiskLevel | null;
  /** Legend hover: outline the cells of this level. */
  highlightLevel?: RiskLevel | null;
  regionNames?: Record<string, string>;
  /** Omit for a read-only grid. */
  onSelect?: (cellId: string) => void;
}

/**
 * 5 km prediction grid colored by risk level, and the peat cells under it. The polygons are
 * built once per loaded area; the risk of the chosen day lives in feature-state.
 */
export function GridLayers({
  grid,
  targetDate,
  minzoom = 0,
  risk,
  opacity,
  peat,
  peatEmphasis = false,
  onlyLevel = null,
  highlightLevel = null,
  regionNames,
  onSelect,
}: GridLayersProps) {
  const { theme, colors } = useMapStyle();
  const data = useMemo(() => gridFeatures(grid), [grid]);
  const day = gridDay(grid, targetDate);
  const states = useMemo(() => (day >= 0 ? gridStates(grid, day) : null), [grid, day]);
  useFeatureStates(GRID_SOURCE, states);

  useLayerInteraction(
    GRID_RISK_LAYER,
    onSelect
      ? {
          hover: true,
          tooltip: (feature) => {
            const p = feature.properties as GridCellProps;
            const state = feature.state as { level?: number; skor?: number };
            const level: RiskLevel | undefined = RISK_LEVEL_ORDER[state.level ?? -1];
            if (!level || state.skor === undefined) return null;
            return tooltipHtml(
              `${swatchHtml(getRiskColor(level, theme), level === "rendah")}${escapeHtml(`Risiko ${getRiskLabel(level).toLowerCase()}`)}`,
              [
                ["Skor", formatDecimal(state.skor)],
                ["Wilayah", regionNames?.[p.kabupaten] ?? p.kabupaten],
                ["Lahan", p.is_gambut == null ? "Data gambut belum tersedia" : p.is_gambut ? "Gambut" : "Mineral"],
              ],
              "Klik untuk detail",
            );
          },
          onClick: (feature) => onSelect(String(feature.properties.cell_id)),
        }
      : null,
  );

  const highlighted = hasStateLevel(highlightLevel);
  return (
    <Source id={GRID_SOURCE} type="geojson" data={data} promoteId="cell_id">
      <Layer
        id="grid-gambut"
        type="fill"
        beforeId={slotId("gambut")}
        minzoom={minzoom}
        filter={["==", ["get", "is_gambut"], true]}
        layout={{ visibility: peat ? "visible" : "none" }}
        paint={{ "fill-color": colors.gambut, "fill-opacity": peatEmphasis ? PEAT_FILL.emphasis : PEAT_FILL.normal }}
      />
      <Layer
        id={GRID_RISK_LAYER}
        type="fill"
        beforeId={slotId("risiko")}
        minzoom={minzoom}
        layout={{ visibility: risk ? "visible" : "none" }}
        paint={{ "fill-color": riskFillColor(theme, onlyLevel), "fill-opacity": opacity, "fill-antialias": false }}
      />
      <Layer
        id="grid-garis"
        type="line"
        beforeId={slotId("risiko")}
        minzoom={minzoom}
        layout={{ visibility: risk ? "visible" : "none" }}
        paint={{
          "line-color": colors.strong,
          "line-width": ["case", HOVER, 1.5, highlighted, 1, 0],
          "line-opacity": ["case", HOVER, 0.9, highlighted, 0.85, 0],
        }}
      />
    </Source>
  );
}
