"use client";

import type { ExpressionSpecification, FilterSpecification } from "maplibre-gl";
import { Layer, Source } from "react-map-gl/maplibre";
import { formatDecimal } from "@/lib/format";
import { getRiskColor, getRiskLabel } from "@/lib/risk";
import type { RiskCellCollection, RiskCellProps, RiskLevel } from "@/types";
import { slotId } from "./basemap";
import { HOVER, TRANSPARENT } from "./expressions";
import { escapeHtml, swatchHtml, tooltipHtml } from "./hover";
import { useLayerInteraction } from "./interactions";
import { useMapStyle } from "./map-view";

const PEAT_FILL = { normal: 0.26, emphasis: 0.55 };

export interface GridLayersProps {
  data: RiskCellCollection;
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

/** 5 km prediction grid colored by risk level, and the peat cells under it. */
export function GridLayers({
  data,
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

  useLayerInteraction("grid-risiko", onSelect ? {
    hover: true,
    tooltip: (feature) => {
      const p = feature.properties as RiskCellProps;
      const level = p.level_risiko;
      return tooltipHtml(
        `${swatchHtml(getRiskColor(level, theme), level === "rendah")}${escapeHtml(`Risiko ${getRiskLabel(level).toLowerCase()}`)}`,
        [
          ["Skor", formatDecimal(p.skor_risiko)],
          ["Wilayah", regionNames?.[p.kabupaten] ?? p.kabupaten],
          ["Lahan", p.is_gambut ? "Gambut" : "Mineral"],
        ],
        "Klik untuk detail",
      );
    },
    onClick: (feature) => onSelect(String(feature.properties.cell_id)),
  } : null);

  const color: ExpressionSpecification = [
    "match",
    ["get", "level_risiko"],
    "sedang",
    getRiskColor("sedang", theme),
    "tinggi",
    getRiskColor("tinggi", theme),
    "sangat_tinggi",
    getRiskColor("sangat_tinggi", theme),
    TRANSPARENT,
  ];
  const levelFilter: FilterSpecification | undefined = onlyLevel ? ["==", ["get", "level_risiko"], onlyLevel] : undefined;
  const highlighted: ExpressionSpecification = ["==", ["get", "level_risiko"], highlightLevel ?? ""];

  return (
    <Source id="grid" type="geojson" data={data} promoteId="cell_id">
      <Layer
        id="grid-gambut"
        type="fill"
        beforeId={slotId("gambut")}
        filter={["==", ["get", "is_gambut"], true]}
        layout={{ visibility: peat ? "visible" : "none" }}
        paint={{ "fill-color": colors.gambut, "fill-opacity": peatEmphasis ? PEAT_FILL.emphasis : PEAT_FILL.normal }}
      />
      <Layer
        id="grid-risiko"
        type="fill"
        beforeId={slotId("risiko")}
        {...(levelFilter ? { filter: levelFilter } : {})}
        layout={{ visibility: risk ? "visible" : "none" }}
        paint={{ "fill-color": color, "fill-opacity": opacity, "fill-antialias": false }}
      />
      <Layer
        id="grid-garis"
        type="line"
        beforeId={slotId("risiko")}
        {...(levelFilter ? { filter: levelFilter } : {})}
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
