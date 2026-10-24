"use client";

import type { ExpressionSpecification, FilterSpecification, GeoJSONSource } from "maplibre-gl";
import { Layer, Source, useMap } from "react-map-gl/maplibre";
import { formatDecimal, formatInteger } from "@/lib/format";
import { CONFIDENCE_LABELS } from "@/lib/labels";
import { prefersReducedMotion } from "@/lib/use-media-query";
import type { Confidence, HotspotMapCollection, HotspotMapProps } from "@/types";
import { CONFIDENCE_LEVELS } from "@/types/constants";
import { slotId } from "./basemap";
import { HOVER, withAlpha } from "./expressions";
import { escapeHtml, tooltipHtml } from "./hover";
import { useLayerInteraction } from "./interactions";
import { useMapStyle } from "./map-view";
import { HOTSPOT_GROUP_LAYER, HOTSPOT_POINT_LAYER, HOTSPOT_SOURCE } from "./map-queries";
import { HOTSPOT_OPACITY } from "./styles";

/** Hotspots are grouped up to this zoom; from the next zoom on every hotspot is drawn. */
export const HOTSPOT_CLUSTER_MAX_ZOOM = 7;

/** Marker radius in px from Fire Radiative Power (same formula as `hotspotRadius`). */
const RADIUS: ExpressionSpecification = ["min", 12, ["max", 3.5, ["+", 3, ["*", ["sqrt", ["get", "frp"]], 0.9]]]];

const COUNT: ExpressionSpecification = ["get", "point_count"];

/** Group circle radius in px, growing with the number of hotspots in it. */
const GROUP_RADIUS: ExpressionSpecification = ["min", 24, ["+", 12, ["*", 4.5, ["log10", COUNT]]]];

/** Group count: 1.234 → "1,2rb". */
const GROUP_LABEL: ExpressionSpecification = [
  "case",
  [">=", COUNT, 1000],
  ["concat", ["number-format", ["/", COUNT, 1000], { locale: "id", "max-fraction-digits": 1 }], "rb"],
  ["number-format", COUNT, { locale: "id" }],
];

const IS_GROUP: FilterSpecification = ["has", "point_count"];
const IS_POINT: FilterSpecification = ["!", ["has", "point_count"]];


export interface HotspotLayersProps {
  /** Hotspots (`/api/hotspots`), preferably as a URL so MapLibre's worker fetches and parses them. */
  data: HotspotMapCollection | string;
  visible?: boolean;
  /** Legend hover: emphasize hotspots of this confidence level. */
  highlight?: Confidence | null;
  /** Legend hover: outline every group. */
  groupEmphasis?: boolean;
  /** Click on a hotspot: its id and position (details are loaded separately). */
  onSelect?: (id: string, point: [number, number]) => void;
}

/**
 * Satellite hotspots in one clustered GeoJSON source: numbered groups at small scales (the
 * clustering runs in MapLibre's worker), single hotspots up close. Size = FRP, color strength
 * = confidence. Clicking a group zooms in until it splits.
 */
export function HotspotLayers({
  data,
  visible = true,
  highlight = null,
  groupEmphasis = false,
  onSelect,
}: HotspotLayersProps) {
  const { colors, fonts } = useMapStyle();
  const { current: mapRef } = useMap();

  useLayerInteraction(HOTSPOT_POINT_LAYER, {
    hover: true,
    tooltip: (feature) => {
      const p = feature.properties as HotspotMapProps;
      return tooltipHtml(
        "Hotspot",
        [
          ["FRP", `${formatDecimal(p.frp, 1)} MW`],
          ["Kepercayaan", CONFIDENCE_LABELS[p.confidence]],
        ],
        onSelect ? "Klik untuk detail" : undefined,
      );
    },
    onClick: onSelect
      ? (feature) => {
          if (feature.geometry.type !== "Point") return;
          const [lon, lat] = feature.geometry.coordinates;
          onSelect(String(feature.properties.id), [lon, lat]);
        }
      : undefined,
  });

  useLayerInteraction(HOTSPOT_GROUP_LAYER, {
    hover: true,
    tooltip: (feature) =>
      tooltipHtml(
        escapeHtml(`${formatInteger(Number(feature.properties.point_count))} hotspot`),
        [["FRP tertinggi", `${formatDecimal(Number(feature.properties.frp_maks), 1)} MW`]],
        "Klik untuk memperbesar",
      ),
    onClick: (feature) => {
      const map = mapRef?.getMap();
      const source = map?.getSource<GeoJSONSource>(HOTSPOT_SOURCE);
      if (!map || !source || feature.geometry.type !== "Point") return;
      const center = feature.geometry.coordinates as [number, number];
      source
        .getClusterExpansionZoom(Number(feature.properties.cluster_id))
        .then((zoom) => map.easeTo({ center, zoom: Math.max(zoom, map.getZoom() + 1), duration: prefersReducedMotion() ? 0 : 300 }))
        .catch(() => {});
    },
  });

  // Confidence shown by color strength: the hotspot color at 50 / 80 / 100%.
  const color = [
    "match",
    ["get", "confidence"],
    ...CONFIDENCE_LEVELS.flatMap((level) => [level, withAlpha(colors.hotspot, HOTSPOT_OPACITY[level])]),
    colors.hotspot,
  ] as unknown as ExpressionSpecification;
  const isHighlighted: ExpressionSpecification = ["==", ["get", "confidence"], highlight ?? ""];
  const visibility = visible ? "visible" : "none";

  return (
    <Source
      id={HOTSPOT_SOURCE}
      type="geojson"
      data={data}
      promoteId="id"
      cluster
      clusterMaxZoom={HOTSPOT_CLUSTER_MAX_ZOOM}
      clusterRadius={50}
      clusterMinPoints={3}
      clusterProperties={{ frp_maks: ["max", ["get", "frp"]] }}
    >
      <Layer
        id={HOTSPOT_POINT_LAYER}
        type="circle"
        beforeId={slotId("hotspot")}
        filter={IS_POINT}
        // Larger fires first, so small markers stay visible and clickable on top.
        layout={{ visibility, "circle-sort-key": ["-", ["get", "frp"]] }}
        paint={{
          "circle-radius": RADIUS,
          "circle-color": color,
          "circle-opacity": highlight ? ["case", isHighlighted, 1, 0.2] : 1,
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
        layout={{ visibility }}
        paint={{
          "circle-radius": ["+", GROUP_RADIUS, ["case", HOVER, 5, groupEmphasis ? 5 : 4]],
          "circle-color": groupEmphasis ? colors.selection : colors.hotspot,
          "circle-opacity": ["case", HOVER, 0.45, groupEmphasis ? 0.45 : highlight ? 0.08 : 0.22],
        }}
      />
      <Layer
        id={HOTSPOT_GROUP_LAYER}
        type="circle"
        beforeId={slotId("kelompok")}
        filter={IS_GROUP}
        layout={{ visibility }}
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
          visibility,
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
