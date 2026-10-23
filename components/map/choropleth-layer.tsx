"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import { formatDecimal, formatInteger } from "@/lib/format";
import { regionDisplayName } from "@/lib/labels";
import { getRiskColor, getRiskLabel, getRiskLevel } from "@/lib/risk";
import type { RegionBoundaryCollection, RegionBoundaryFeature, RegionStat, RiskLevel } from "@/types";
import { fadeOutAndRemove, mixHex, tween } from "./animate";
import { attachHoverTooltip, escapeHtml, swatchHtml, tooltipHtml } from "./hover";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";

/** Fill opacity at full strength; low enough that basemap labels stay readable underneath. */
export const CHOROPLETH_FILL = 0.5;
const TRANSITION_MS = 260;

type RegionPolygon = L.Polygon & { region: RegionBoundaryFeature };

interface RegionState {
  polygon: RegionPolygon;
  /** Current (possibly mid-transition) fill color and presence 0–1. */
  color: string;
  alpha: number;
  /** Just created: the outline fades in with the first fill. */
  fresh: boolean;
}

function outline(theme: Theme) {
  return theme === "dark" ? "#A1A1AA" : "#52525B";
}

function target(stat: RegionStat | undefined, theme: Theme, onlyLevel: RiskLevel | null | undefined) {
  if (!stat) return { color: getRiskColor("sedang", theme), alpha: 0 };
  const level = getRiskLevel(stat.rata_skor_risiko);
  const hidden = level === "rendah" || (onlyLevel != null && onlyLevel !== level);
  return { color: getRiskColor(level === "rendah" ? "sedang" : level, theme), alpha: hidden ? 0 : 1 };
}

/**
 * Provinces or regencies colored by their mean risk score. Polygons are created once per
 * boundary set; a new prediction day blends each region's fill instead of rebuilding.
 */
export function ChoroplethLayer({
  data,
  stats,
  theme,
  opacity = 1,
  parentNames,
  emphasize,
  onlyLevel,
  highlightLevel,
  hint,
  outlined = true,
  onSelect,
}: {
  data: RegionBoundaryCollection;
  /** Aggregates by slug; regions without one stay unfilled. */
  stats: Record<string, RegionStat> | undefined;
  theme: Theme;
  /** Multiplier for the fill (the risk opacity slider). */
  opacity?: number;
  /** Province names by slug, for "induk" in the tooltip. */
  parentNames?: Record<string, string>;
  /** Slug drawn with a heavier outline. */
  emphasize?: string;
  /** Legend filter: fill only regions of this level. */
  onlyLevel?: RiskLevel | null;
  /** Legend hover: outline regions of this level. */
  highlightLevel?: RiskLevel | null;
  /** Last tooltip line, e.g. "Klik untuk memperbesar". */
  hint?: string;
  /** Draw thin outlines; off when a boundary layer already draws them (hover still outlines). */
  outlined?: boolean;
  onSelect?: (feature: RegionBoundaryFeature) => void;
}) {
  const map = useMap();
  const groupRef = useRef<L.FeatureGroup | null>(null);
  const regionsRef = useRef(new Map<string, RegionState>());
  const cancelRef = useRef<() => void>(() => {});
  const statsRef = useRef(stats);
  const opacityRef = useRef(opacity);
  const themeRef = useRef(theme);
  const namesRef = useRef(parentNames);
  const onSelectRef = useRef(onSelect);
  const hintRef = useRef(hint);
  const hoveredRef = useRef<RegionPolygon | null>(null);
  const styleRef = useRef<(polygon: RegionPolygon) => L.PathOptions>(() => ({}));
  useEffect(() => {
    statsRef.current = stats;
    opacityRef.current = opacity;
    themeRef.current = theme;
    namesRef.current = parentNames;
    onSelectRef.current = onSelect;
    hintRef.current = hint;
  });

  // Outline style; depends on hover, emphasis, and the legend highlight.
  useEffect(() => {
    styleRef.current = (polygon) => {
      const slug = polygon.region.properties.slug;
      const stat = statsRef.current?.[slug];
      const highlighted = highlightLevel != null && stat !== undefined && getRiskLevel(stat.rata_skor_risiko) === highlightLevel;
      const hovered = hoveredRef.current === polygon;
      const strong = slug === emphasize;
      return {
        color: highlighted ? (theme === "dark" ? "#FAFAFA" : "#18181B") : outline(theme),
        weight: hovered ? 2.6 : highlighted ? 2.2 : strong ? 2.6 : 0.8,
        opacity: hovered || highlighted || strong ? 1 : outlined ? 0.55 : 0,
      };
    };
    for (const state of regionsRef.current.values()) state.polygon.setStyle(styleRef.current(state.polygon));
  }, [emphasize, highlightLevel, theme, outlined]);

  // Boundary set lifetime: build polygons, fade out on change/unmount.
  useEffect(() => {
    const group = L.featureGroup();
    const regions = regionsRef.current;
    groupRef.current = group;
    for (const feature of data.features) {
      const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      const latLngs = polygons.map((rings) => rings.map((ring) => ring.map(([lon, lat]) => L.latLng(lat, lon))));
      const to = target(statsRef.current?.[feature.properties.slug], themeRef.current, onlyLevel);
      const polygon = L.polygon(latLngs, {
        fillColor: to.color,
        fillOpacity: 0,
        bubblingMouseEvents: false,
      }) as RegionPolygon;
      polygon.region = feature;
      polygon.setStyle({ ...styleRef.current(polygon), opacity: 0 });
      polygon.addTo(group);
      regions.set(feature.properties.slug, { polygon, color: to.color, alpha: 0, fresh: true });
    }

    group.on("click", (event: L.LeafletMouseEvent) => {
      const polygon = event.propagatedFrom as RegionPolygon | undefined;
      if (polygon) onSelectRef.current?.(polygon.region);
    });

    const detach = attachHoverTooltip<RegionPolygon>(
      map,
      group,
      (polygon) => {
        const p = polygon.region.properties;
        const stat = statsRef.current?.[p.slug];
        const level = stat ? getRiskLevel(stat.rata_skor_risiko) : null;
        const rows: [string, string][] = [];
        if (p.provinsi) rows.push(["Provinsi", namesRef.current?.[p.provinsi] ?? p.provinsi]);
        if (stat) {
          rows.push(
            ["Hotspot", formatInteger(stat.jumlah_hotspot)],
            ["Rata-rata skor", `${formatDecimal(stat.rata_skor_risiko)} · ${getRiskLabel(level!)}`],
            ["Skor tertinggi", formatDecimal(stat.maks_skor_risiko)],
          );
        }
        const title = `${level ? swatchHtml(getRiskColor(level, themeRef.current), level === "rendah") : ""}${escapeHtml(regionDisplayName(p))}`;
        return tooltipHtml(title, rows, hintRef.current);
      },
      (polygon) => {
        const previous = hoveredRef.current;
        hoveredRef.current = polygon;
        previous?.setStyle(styleRef.current(previous));
        if (polygon) {
          polygon.setStyle(styleRef.current(polygon));
          polygon.bringToFront();
        }
      },
    );

    addOrderedLayer(map, "wilayah", group);
    return () => {
      cancelRef.current();
      detach();
      groupRef.current = null;
      hoveredRef.current = null;
      removeOrderedLayer(map, "wilayah", group, () =>
        fadeOutAndRemove(group, (path) => ({
          opacity: 0.55,
          fillOpacity: (regions.get((path as RegionPolygon).region.properties.slug)?.alpha ?? 0) * CHOROPLETH_FILL * opacityRef.current,
        })),
      );
      regions.clear();
    };
    // onlyLevel only sets the first fill; later changes blend in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, data]);

  // Stats, theme, or legend filter changed: blend every region to its new fill.
  useEffect(() => {
    if (!groupRef.current) return;
    const transitions: { state: RegionState; from: { color: string; alpha: number }; to: { color: string; alpha: number } }[] = [];
    for (const [slug, state] of regionsRef.current) {
      const to = target(stats?.[slug], theme, onlyLevel);
      transitions.push({ state, from: { color: state.color, alpha: state.alpha }, to });
    }
    cancelRef.current();
    cancelRef.current = tween(TRANSITION_MS, (p) => {
      const fill = CHOROPLETH_FILL * opacityRef.current;
      for (const { state, from, to } of transitions) {
        state.color = p === 1 ? to.color : mixHex(from.color, to.color, p);
        state.alpha = from.alpha + (to.alpha - from.alpha) * p;
        const style = styleRef.current(state.polygon);
        state.polygon.setStyle({
          ...style,
          opacity: state.fresh ? (style.opacity ?? 1) * p : style.opacity,
          fillColor: state.color,
          fillOpacity: state.alpha * fill,
        });
        if (p === 1) state.fresh = false;
      }
    });
  }, [data, stats, theme, onlyLevel]);

  // The opacity slider only restyles.
  useEffect(() => {
    for (const state of regionsRef.current.values()) {
      state.polygon.setStyle({ fillOpacity: state.alpha * CHOROPLETH_FILL * opacity });
    }
  }, [opacity]);

  return null;
}
