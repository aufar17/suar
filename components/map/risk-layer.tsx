"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import { formatDecimal } from "@/lib/format";
import { getRiskColor, getRiskLabel } from "@/lib/risk";
import type { RiskCellCollection, RiskCellFeature, RiskLevel } from "@/types";
import { fadeOutAndRemove, mixHex, tween } from "./animate";
import { attachHoverTooltip, escapeHtml, swatchHtml, tooltipHtml } from "./hover";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";

type CellPolygon = L.Polygon & { cellId: string };

interface CellState {
  polygon: CellPolygon;
  feature: RiskCellFeature;
  /** Current (possibly mid-transition) fill color and presence 0–1. */
  color: string;
  alpha: number;
}

const TRANSITION_MS = 260;

/** Fill for a level. "rendah" keeps a color for blending but is fully transparent. */
function target(feature: RiskCellFeature, theme: Theme) {
  const level = feature.properties.level_risiko;
  return level === "rendah"
    ? { color: getRiskColor("sedang", theme), alpha: 0 }
    : { color: getRiskColor(level, theme), alpha: 1 };
}

/**
 * 5 km prediction grid colored by risk level. Polygons are created once per cell; a new
 * prediction day (or theme) blends each cell's color instead of rebuilding the layer.
 */
export function RiskLayer({
  data,
  opacity,
  theme,
  regionNames,
  highlightLevel = null,
  onSelect,
}: {
  data: RiskCellCollection;
  opacity: number;
  theme: Theme;
  /** Legend hover: outline the cells of this level. */
  highlightLevel?: RiskLevel | null;
  regionNames?: Record<string, string>;
  /** Omit to draw a read-only grid. */
  onSelect?: (feature: RiskCellFeature) => void;
}) {
  const map = useMap();
  const groupRef = useRef<L.FeatureGroup | null>(null);
  const cellsRef = useRef(new Map<string, CellState>());
  const cancelRef = useRef<() => void>(() => {});
  const onSelectRef = useRef(onSelect);
  const opacityRef = useRef(opacity);
  const namesRef = useRef(regionNames);
  const themeRef = useRef(theme);
  useEffect(() => {
    onSelectRef.current = onSelect;
    opacityRef.current = opacity;
    namesRef.current = regionNames;
    themeRef.current = theme;
  });

  const interactive = onSelect !== undefined;

  // Group lifetime: created on mount, faded out on unmount.
  useEffect(() => {
    const group = L.featureGroup();
    const cells = cellsRef.current;
    groupRef.current = group;

    group.on("click", (event: L.LeafletMouseEvent) => {
      const cell = cells.get((event.propagatedFrom as CellPolygon).cellId);
      if (cell) onSelectRef.current?.(cell.feature);
    });

    let hovered: CellPolygon | null = null;
    const detach = interactive
      ? attachHoverTooltip<CellPolygon>(
          map,
          group,
          (polygon) => {
            const p = cells.get(polygon.cellId)?.feature.properties;
            if (!p) return "";
            const level = p.level_risiko;
            return tooltipHtml(
              `${swatchHtml(getRiskColor(level, themeRef.current), level === "rendah")}${escapeHtml(`Risiko ${getRiskLabel(level).toLowerCase()}`)}`,
              [
                ["Skor", formatDecimal(p.skor_risiko)],
                ["Wilayah", namesRef.current?.[p.kabupaten] ?? p.kabupaten],
                ["Lahan", p.is_gambut ? "Gambut" : "Mineral"],
              ],
              "Klik untuk detail",
            );
          },
          (polygon) => {
            hovered?.setStyle({ stroke: false });
            hovered = polygon;
            hovered?.setStyle({
              stroke: true,
              color: themeRef.current === "dark" ? "#FAFAFA" : "#18181B",
              weight: 1.5,
              opacity: 0.9,
            });
          },
        )
      : () => {};

    addOrderedLayer(map, "risiko", group);
    return () => {
      cancelRef.current();
      detach();
      groupRef.current = null;
      removeOrderedLayer(map, "risiko", group, () =>
        fadeOutAndRemove(group, (path) => ({
          opacity: 0,
          fillOpacity: (cells.get((path as CellPolygon).cellId)?.alpha ?? 0) * opacityRef.current,
        })),
      );
      cells.clear();
    };
  }, [map, interactive]);

  // Data or theme change: add/remove cells, then blend every cell to its new fill.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const cells = cellsRef.current;
    const seen = new Set<string>();
    const transitions: { cell: CellState; from: { color: string; alpha: number }; to: { color: string; alpha: number } }[] = [];

    for (const feature of data.features) {
      const id = feature.properties.cell_id;
      seen.add(id);
      const to = target(feature, theme);
      let cell = cells.get(id);
      if (!cell) {
        const ring = feature.geometry.coordinates[0].map(([lon, lat]) => L.latLng(lat, lon));
        const polygon = L.polygon(ring, {
          stroke: false,
          fillColor: to.color,
          fillOpacity: 0,
          interactive,
        }) as CellPolygon;
        polygon.cellId = id;
        polygon.addTo(group);
        cell = { polygon, feature, color: to.color, alpha: 0 };
        cells.set(id, cell);
      }
      cell.feature = feature;
      if (cell.color !== to.color || cell.alpha !== to.alpha) {
        transitions.push({ cell, from: { color: cell.color, alpha: cell.alpha }, to });
      }
    }
    for (const [id, cell] of cells) {
      if (!seen.has(id)) {
        cell.polygon.remove();
        cells.delete(id);
      }
    }

    cancelRef.current();
    cancelRef.current = tween(TRANSITION_MS, (p) => {
      const opacityNow = opacityRef.current;
      for (const { cell, from, to } of transitions) {
        cell.color = p === 1 ? to.color : mixHex(from.color, to.color, p);
        cell.alpha = from.alpha + (to.alpha - from.alpha) * p;
        cell.polygon.setStyle({ fillColor: cell.color, fillOpacity: cell.alpha * opacityNow });
      }
    });
  }, [data, theme, interactive]);

  // Legend hover outlines one level (and is restored when the hover ends).
  useEffect(() => {
    const color = theme === "dark" ? "#FAFAFA" : "#18181B";
    for (const cell of cellsRef.current.values()) {
      const match = highlightLevel !== null && cell.feature.properties.level_risiko === highlightLevel;
      cell.polygon.setStyle(match ? { stroke: true, color, weight: 1, opacity: 0.85 } : { stroke: false });
    }
  }, [highlightLevel, theme, data]);

  // The opacity slider only restyles.
  useEffect(() => {
    for (const cell of cellsRef.current.values()) cell.polygon.setStyle({ fillOpacity: cell.alpha * opacity });
  }, [opacity]);

  return null;
}
