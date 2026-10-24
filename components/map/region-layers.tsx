"use client";

import type { ExpressionSpecification, FilterSpecification } from "maplibre-gl";
import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import { formatDecimal, formatInteger } from "@/lib/format";
import { regionDisplayName } from "@/lib/labels";
import { getRiskColor, getRiskLabel, getRiskLevel, RISK_LEVEL_ORDER } from "@/lib/risk";
import type { BoundaryTier, RegionBoundaryCollection, RegionLevel, RegionStat, RiskLevel } from "@/types";
import { slotId } from "./basemap";
import { HOVER, TRANSPARENT, zoomRange } from "./expressions";
import { escapeHtml, swatchHtml, tooltipHtml } from "./hover";
import { useLayerInteraction } from "./interactions";
import { useMapStyle } from "./map-view";
import { CHOROPLETH_FILL } from "./styles";
import { useFeatureStates, type FeatureStates } from "./use-feature-state";

/** Risk level as a number in feature-state (0 = rendah … 3 = sangat tinggi). */
const LEVEL: ExpressionSpecification = ["coalesce", ["feature-state", "level"], -1];
const levelIndex = (level: RiskLevel) => RISK_LEVEL_ORDER.indexOf(level);

export interface RegionLayersProps {
  level: BoundaryTier;
  /** Boundaries, or the URL of a static GeoJSON file (loaded by the map's worker). */
  data: RegionBoundaryCollection | string;
  /** Only the regions of this province (region pages). */
  provinsi?: string;
  /** Zoom range of the fill and its outline, [min, max). */
  zoom?: [number, number];
  /** Fill regions by their mean risk (`stats`). */
  choropleth?: boolean;
  /** Aggregates by slug; regions without one stay unfilled. */
  stats?: Record<string, RegionStat>;
  /** Multiplier for the fill (the risk opacity slider). */
  opacity?: number;
  /** Legend filter: fill only regions of this level. */
  onlyLevel?: RiskLevel | null;
  /** Legend hover: outline regions of this level. */
  highlightLevel?: RiskLevel | null;
  /** Thin outlines with the fill (off when the boundary line is drawn). */
  outlined?: boolean;
  /** Boundary lines ("Batas wilayah" layer) in a zoom range; `emphasis` = legend hover. */
  boundary?: { weight: number; zoom?: [number, number]; emphasis?: boolean } | null;
  /** Slug drawn with a heavier outline. */
  emphasize?: string | null;
  /** Focused region (slug): ember outline with a halo. */
  focus?: string | null;
  /** Hover tooltip with the region's risk and a click action. */
  interactive?: boolean;
  /** Hover shows only the region name (no click), e.g. under the risk grid. */
  nameOnHover?: boolean;
  /** Province names by slug, for the tooltip. */
  parentNames?: Record<string, string>;
  /** Last tooltip line, e.g. "Klik untuk memperbesar". */
  hint?: string;
  onSelect?: (slug: string) => void;
}

interface RegionFeatureProps {
  slug: string;
  nama: string;
  level: RegionLevel;
  provinsi?: string | null;
}

/** Fill layer id of a level: hover/click target, and used to find the region at a point. */
export function regionFillLayer(level: BoundaryTier) {
  return `wilayah-${level}-isi`;
}

/**
 * Provinces or regencies from one GeoJSON source (`promoteId: slug`): risk fill, its outline,
 * boundary lines, and the focus outline. The risk level of each region lives in feature-state,
 * so a new prediction day only updates values on the GPU. The fill is always rendered (fully
 * transparent outside its zoom range or with the risk layer off) so regions stay queryable.
 */
export function RegionLayers({
  level,
  data,
  provinsi,
  zoom = [0, 24],
  choropleth = false,
  stats,
  opacity = 1,
  onlyLevel = null,
  highlightLevel = null,
  outlined = true,
  boundary = null,
  emphasize = null,
  focus = null,
  interactive = false,
  nameOnHover = false,
  parentNames,
  hint,
  onSelect,
}: RegionLayersProps) {
  const { theme, colors } = useMapStyle();
  const source = `wilayah-${level}`;
  const fillLayer = regionFillLayer(level);
  const filter: FilterSpecification | undefined = provinsi ? ["==", ["get", "provinsi"], provinsi] : undefined;

  const states = useMemo((): FeatureStates | null => {
    if (!stats) return null;
    return new Map(Object.values(stats).map((stat) => [stat.slug, { level: levelIndex(getRiskLevel(stat.rata_skor_risiko)) }]));
  }, [stats]);
  useFeatureStates(source, states);

  // "Rendah" stays unfilled so most of the land keeps the basemap visible.
  const levelColor: ExpressionSpecification = [
    "match",
    LEVEL,
    levelIndex("sedang"),
    getRiskColor("sedang", theme),
    levelIndex("tinggi"),
    getRiskColor("tinggi", theme),
    levelIndex("sangat_tinggi"),
    getRiskColor("sangat_tinggi", theme),
    TRANSPARENT,
  ];
  const fillColor: ExpressionSpecification = onlyLevel
    ? ["case", ["==", LEVEL, levelIndex(onlyLevel)], levelColor, TRANSPARENT]
    : levelColor;
  const isHighlighted: ExpressionSpecification = ["==", LEVEL, highlightLevel ? levelIndex(highlightLevel) : -2];
  const isStrong: ExpressionSpecification = ["==", ["get", "slug"], emphasize ?? ""];
  const focusFilter: FilterSpecification = ["==", ["get", "slug"], focus ?? ""];

  useLayerInteraction(
    fillLayer,
    interactive || nameOnHover
      ? {
          hover: true,
          compact: nameOnHover,
          tooltip: (feature) => {
            const p = feature.properties as RegionFeatureProps;
            if (nameOnHover) return escapeHtml(p.nama);
            const stat = stats?.[p.slug];
            const risk = stat ? getRiskLevel(stat.rata_skor_risiko) : null;
            const rows: [string, string][] = [];
            if (p.provinsi) rows.push(["Provinsi", parentNames?.[p.provinsi] ?? p.provinsi]);
            if (stat && risk) {
              rows.push(
                ["Hotspot", formatInteger(stat.jumlah_hotspot)],
                ["Rata-rata skor", `${formatDecimal(stat.rata_skor_risiko)} · ${getRiskLabel(risk)}`],
                ["Skor tertinggi", formatDecimal(stat.maks_skor_risiko)],
              );
            }
            const title = `${risk ? swatchHtml(getRiskColor(risk, theme), risk === "rendah") : ""}${escapeHtml(regionDisplayName(p))}`;
            return tooltipHtml(title, rows, hint);
          },
          onClick:
            onSelect && !nameOnHover ? (feature) => onSelect((feature.properties as RegionFeatureProps).slug) : undefined,
        }
      : null,
  );

  const withFilter = filter ? { filter } : {};
  return (
    <Source id={source} type="geojson" data={data} promoteId="slug">
      <Layer
        id={fillLayer}
        type="fill"
        beforeId={slotId("wilayah")}
        {...withFilter}
        paint={{ "fill-color": fillColor, "fill-opacity": choropleth ? zoomRange(CHOROPLETH_FILL * opacity, zoom) : 0 }}
      />
      <Layer
        id={`${source}-garis-isi`}
        type="line"
        beforeId={slotId("wilayah")}
        minzoom={zoom[0]}
        maxzoom={zoom[1]}
        {...withFilter}
        layout={{ visibility: choropleth || interactive || nameOnHover ? "visible" : "none", "line-join": "round" }}
        paint={{
          "line-color": ["case", isHighlighted, colors.strong, colors.regionOutline],
          "line-width": ["case", HOVER, 2.6, isHighlighted, 2.2, isStrong, 2.6, 0.8],
          "line-opacity": ["case", ["any", HOVER, isHighlighted, isStrong], 1, choropleth && outlined ? 0.55 : 0],
        }}
      />
      <Layer
        id={`${source}-fokus-halo`}
        type="line"
        beforeId={slotId("fokus")}
        filter={focusFilter}
        layout={{ visibility: focus ? "visible" : "none", "line-join": "round" }}
        paint={{ "line-color": colors.halo, "line-width": 4, "line-opacity": 0.8 }}
      />
      <Layer
        id={`${source}-fokus`}
        type="line"
        beforeId={slotId("fokus")}
        filter={focusFilter}
        layout={{ visibility: focus ? "visible" : "none", "line-join": "round" }}
        paint={{ "line-color": colors.selection, "line-width": 2 }}
      />
      <Layer
        id={`${source}-batas`}
        type="line"
        beforeId={slotId("batas")}
        minzoom={boundary?.zoom?.[0] ?? 0}
        maxzoom={boundary?.zoom?.[1] ?? 24}
        {...withFilter}
        layout={{ visibility: boundary ? "visible" : "none", "line-join": "round" }}
        paint={{
          "line-color": colors.boundary,
          "line-width": [
            "case",
            HOVER,
            2.6,
            isStrong,
            3,
            boundary?.emphasis ? (boundary.weight ?? 1) * 2.2 : (boundary?.weight ?? 1),
          ],
          "line-opacity": ["case", ["any", HOVER, isStrong], 1, boundary?.emphasis ? 1 : 0.7],
        }}
      />
    </Source>
  );
}

export interface RegionLabelPoints {
  type: "FeatureCollection";
  features: { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: { slug: string; nama: string; level: RegionLevel; provinsi: string | null } }[];
}

/** Label points of a boundary collection (each region's `label` position). */
export function labelPoints(data: RegionBoundaryCollection): RegionLabelPoints {
  return {
    type: "FeatureCollection",
    features: data.features.map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: f.properties.label },
      properties: { slug: f.properties.slug, nama: f.properties.nama, level: f.properties.level, provinsi: f.properties.provinsi },
    })),
  };
}

/** Region names at their label points: provinces at every zoom, regencies from zoom 6.5. */
export function RegionLabelLayer({
  level,
  data,
  provinsi,
}: {
  level: BoundaryTier;
  /** Label points, or the URL of a static GeoJSON file of them. */
  data: RegionLabelPoints | string;
  provinsi?: string;
}) {
  const { colors, fonts } = useMapStyle();
  const province = level === "provinsi";
  return (
    <Source id={`label-${level}`} type="geojson" data={data}>
      <Layer
        id={`label-${level}`}
        type="symbol"
        beforeId={slotId("label")}
        minzoom={province ? 0 : 6.5}
        {...(provinsi ? { filter: ["==", ["get", "provinsi"], provinsi] } : {})}
        layout={{
          "text-field": ["case", ["==", ["get", "level"], "kota"], ["concat", "Kota ", ["get", "nama"]], ["get", "nama"]],
          "text-font": province ? fonts.bold : fonts.regular,
          "text-size": province
            ? ["interpolate", ["linear"], ["zoom"], 4, 10, 7, 13, 10, 15]
            : ["interpolate", ["linear"], ["zoom"], 6.5, 11, 10, 13],
          "text-max-width": 8,
          "text-padding": 4,
          ...(province ? { "text-transform": "uppercase", "text-letter-spacing": 0.06 } : {}),
        }}
        paint={{
          "text-color": province ? colors.label : colors.labelMuted,
          "text-halo-color": colors.labelHalo,
          "text-halo-width": 1.6,
          "text-halo-blur": 0.4,
        }}
      />
    </Source>
  );
}
