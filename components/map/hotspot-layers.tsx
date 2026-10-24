"use client";

import type { ExpressionSpecification } from "maplibre-gl";
import { Layer, Source, useMap } from "react-map-gl/maplibre";
import { formatDateTime, formatDecimal, formatInteger } from "@/lib/format";
import { CONFIDENCE_LABELS } from "@/lib/labels";
import { prefersReducedMotion } from "@/lib/use-media-query";
import { CONFIDENCE_LEVELS, type Confidence, type GroupedHotspotCollection, type HotspotProps } from "@/types";
import { slotId } from "./basemap";
import { HOVER } from "./expressions";
import { escapeHtml, tooltipHtml } from "./hover";
import { useLayerInteraction } from "./interactions";
import { useMapStyle } from "./map-view";
import { HOTSPOT_OPACITY } from "./styles";

/** Marker radius in px from Fire Radiative Power (same formula as `hotspotRadius`). */
const RADIUS: ExpressionSpecification = ["min", 12, ["max", 3.5, ["+", 3, ["*", ["sqrt", ["get", "frp"]], 0.9]]]];

/** Group circle radius in px, growing with the number of hotspots (same as `groupSize` / 2). */
const GROUP_RADIUS: ExpressionSpecification = ["min", 24, ["+", 12, ["*", 4.5, ["log10", ["get", "jumlah"]]]]];

/** Group count: 1.234 → "1,2rb". */
const GROUP_LABEL: ExpressionSpecification = [
  "case",
  [">=", ["get", "jumlah"], 1000],
  ["concat", ["number-format", ["/", ["get", "jumlah"], 1000], { locale: "id", "max-fraction-digits": 1 }], "rb"],
  ["number-format", ["get", "jumlah"], { locale: "id" }],
];

const IS_GROUP: ExpressionSpecification = ["has", "kelompok"];

export interface HotspotLayersProps {
  /** Hotspots, and at small scales numbered groups of nearby hotspots. */
  data: GroupedHotspotCollection;
  regionNames: Record<string, string>;
  /** Legend hover: emphasize hotspots of this confidence level. */
  highlight?: Confidence | null;
  /** Legend hover: outline every group. */
  groupEmphasis?: boolean;
  onSelect?: (id: string) => void;
}

/** Satellite hotspots. Size = FRP, opacity = confidence; groups show their count and zoom in on click. */
export function HotspotLayers({ data, regionNames, highlight = null, groupEmphasis = false, onSelect }: HotspotLayersProps) {
  const { colors, fonts } = useMapStyle();
  const { current: map } = useMap();

  useLayerInteraction("hotspot-titik", {
    hover: true,
    tooltip: (feature) => {
      const p = feature.properties as HotspotProps;
      return tooltipHtml(
        "Hotspot",
        [
          ["Waktu", formatDateTime(p.waktu_deteksi)],
          ["FRP", `${formatDecimal(p.frp, 1)} MW`],
          ["Kepercayaan", CONFIDENCE_LABELS[p.confidence]],
          ["Wilayah", regionNames[p.kabupaten] ?? p.kabupaten],
        ],
        onSelect ? "Klik untuk detail" : undefined,
      );
    },
    onClick: onSelect ? (feature) => onSelect(String(feature.properties.id)) : undefined,
  });

  useLayerInteraction("hotspot-kelompok", {
    hover: true,
    tooltip: (feature) =>
      tooltipHtml(
        escapeHtml(`${formatInteger(Number(feature.properties.jumlah))} hotspot`),
        [["FRP tertinggi", `${formatDecimal(Number(feature.properties.frp_maks), 1)} MW`]],
        "Klik untuk memperbesar",
      ),
    onClick: (feature) => {
      if (!map || feature.geometry.type !== "Point") return;
      const [lon, lat] = feature.geometry.coordinates;
      map.flyTo({ center: [lon, lat], zoom: Math.min(map.getZoom() + 2, 8), duration: prefersReducedMotion() ? 0 : 300 });
    },
  });

  const confidenceOpacity = [
    "match",
    ["get", "confidence"],
    ...CONFIDENCE_LEVELS.flatMap((level) => [level, highlight ? (level === highlight ? 1 : 0.12) : HOTSPOT_OPACITY[level]]),
    1,
  ] as unknown as ExpressionSpecification;
  const isHighlighted: ExpressionSpecification = ["==", ["get", "confidence"], highlight ?? ""];

  return (
    <Source id="hotspot" type="geojson" data={data} promoteId="id">
      <Layer
        id="hotspot-titik"
        type="circle"
        beforeId={slotId("hotspot")}
        filter={["!", IS_GROUP]}
        // Larger fires first, so small markers stay visible and clickable on top.
        layout={{ "circle-sort-key": ["-", ["get", "frp"]] }}
        paint={{
          "circle-radius": RADIUS,
          "circle-color": colors.hotspot,
          "circle-opacity": confidenceOpacity,
          "circle-stroke-color": colors.hotspotStroke,
          "circle-stroke-width": ["case", HOVER, 2.5, isHighlighted, 2, 1],
          "circle-stroke-opacity": highlight ? ["case", isHighlighted, 1, 0.25] : 0.9,
        }}
      />
      <Layer
        id="hotspot-kelompok-halo"
        type="circle"
        beforeId={slotId("kelompok")}
        filter={IS_GROUP}
        paint={{
          "circle-radius": ["+", GROUP_RADIUS, ["case", HOVER, 5, groupEmphasis ? 5 : 4]],
          "circle-color": groupEmphasis ? colors.selection : colors.hotspot,
          "circle-opacity": ["case", HOVER, 0.45, groupEmphasis ? 0.45 : highlight ? 0.08 : 0.22],
        }}
      />
      <Layer
        id="hotspot-kelompok"
        type="circle"
        beforeId={slotId("kelompok")}
        filter={IS_GROUP}
        paint={{
          "circle-radius": GROUP_RADIUS,
          "circle-color": colors.hotspot,
          "circle-opacity": highlight ? 0.35 : 1,
          "circle-stroke-color": colors.hotspotStroke,
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": highlight ? 0.35 : 1,
        }}
      />
      <Layer
        id="hotspot-kelompok-angka"
        type="symbol"
        beforeId={slotId("kelompok")}
        filter={IS_GROUP}
        layout={{
          "text-field": GROUP_LABEL,
          "text-font": fonts.bold,
          "text-size": 11,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        }}
        paint={{ "text-color": colors.hotspotStroke, "text-opacity": highlight ? 0.5 : 1 }}
      />
    </Source>
  );
}
