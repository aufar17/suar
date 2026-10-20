"use client";

import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import { pointInRing } from "@/lib/geo";
import type { Position, RegionBoundaryCollection } from "@/types";
import { fadeInPaths, fadeOutAndRemove } from "./animate";
import { escapeHtml } from "./hover";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";

export function boundaryColor(theme: Theme) {
  return theme === "dark" ? "#A1A1AA" : "#3F3F46";
}

function outerRings(geometry: RegionBoundaryCollection["features"][number]["geometry"]): Position[][] {
  return geometry.type === "Polygon" ? [geometry.coordinates[0]] : geometry.coordinates.map((polygon) => polygon[0]);
}

const WEIGHT = { normal: 1.2, strong: 3, hover: 2.6 };
const OPACITY = { normal: 0.7, strong: 1 };

/**
 * Region outlines. The outlines are not interactive (so clicks reach the risk grid);
 * the hovered region is found from the cursor position and, when `showLabel` is set,
 * named in a small label. With the risk grid on, the cell tooltip names the region instead.
 */
export function BoundaryLayer({
  data,
  theme,
  emphasize,
  showLabel = true,
}: {
  data: RegionBoundaryCollection;
  theme: Theme;
  /** Slug drawn with a heavier outline (region pages). */
  emphasize?: string;
  showLabel?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    const color = boundaryColor(theme);
    const group = L.featureGroup();
    const regions = data.features.map((feature) => {
      const rings = outerRings(feature.geometry);
      const strong = feature.properties.slug === emphasize;
      const polygon = L.polygon(
        rings.map((ring) => ring.map(([lon, lat]) => L.latLng(lat, lon))),
        { color, weight: strong ? WEIGHT.strong : WEIGHT.normal, opacity: 0, fill: false, interactive: false },
      ).addTo(group);
      return { feature, rings, polygon, strong };
    });
    const strongPolygons = new Set(regions.filter((r) => r.strong).map((r) => r.polygon as L.Path));
    const base = (path: L.Path) => ({ opacity: strongPolygons.has(path) ? OPACITY.strong : OPACITY.normal, fillOpacity: 0 });

    const tooltip = L.tooltip({ direction: "top", offset: [0, -8], className: "region-tooltip" });
    let hovered: (typeof regions)[number] | null = null;

    const setHovered = (next: (typeof regions)[number] | null) => {
      if (hovered === next) return;
      if (hovered) {
        hovered.polygon.setStyle({
          weight: hovered.strong ? WEIGHT.strong : WEIGHT.normal,
          opacity: hovered.strong ? OPACITY.strong : OPACITY.normal,
        });
      }
      hovered = next;
      if (hovered) hovered.polygon.setStyle({ weight: Math.max(WEIGHT.hover, hovered.strong ? WEIGHT.strong : 0), opacity: 1 });
    };

    const onMove = (event: L.LeafletMouseEvent) => {
      const point: Position = [event.latlng.lng, event.latlng.lat];
      const match = regions.find((r) => r.rings.some((ring) => pointInRing(point, ring))) ?? null;
      setHovered(match);
      if (match && showLabel) {
        tooltip.setLatLng(event.latlng).setContent(escapeHtml(match.feature.properties.nama));
        if (!map.hasLayer(tooltip)) tooltip.addTo(map);
      } else {
        tooltip.remove();
      }
    };
    const onOut = () => {
      setHovered(null);
      tooltip.remove();
    };

    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    addOrderedLayer(map, "batas", group);
    const cancel = fadeInPaths(group.getLayers() as L.Path[], base);
    return () => {
      cancel();
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
      tooltip.remove();
      removeOrderedLayer(map, "batas", group, () => fadeOutAndRemove(group, base));
    };
  }, [map, data, theme, emphasize, showLabel]);

  return null;
}
