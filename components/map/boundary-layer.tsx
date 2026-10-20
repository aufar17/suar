"use client";

import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import { pointInRing } from "@/lib/geo";
import type { Position, RegionBoundaryCollection } from "@/types";
import { escapeHtml } from "./html";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";

export function boundaryColor(theme: Theme) {
  return theme === "dark" ? "#8FC2B5" : "#1F3B36";
}

function outerRings(geometry: RegionBoundaryCollection["features"][number]["geometry"]): Position[][] {
  return geometry.type === "Polygon" ? [geometry.coordinates[0]] : geometry.coordinates.map((polygon) => polygon[0]);
}

/**
 * Region outlines. The outlines are not interactive (so clicks reach the risk grid);
 * the hovered region is found from the cursor position and labelled with a tooltip.
 */
export function BoundaryLayer({
  data,
  theme,
  emphasize,
}: {
  data: RegionBoundaryCollection;
  theme: Theme;
  /** Slug drawn with a heavier outline (region pages). */
  emphasize?: string;
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
        {
          color,
          weight: strong ? 3.5 : 1.4,
          opacity: strong ? 1 : 0.75,
          fill: false,
          interactive: false,
        },
      ).addTo(group);
      return { feature, rings, polygon, strong };
    });

    const tooltip = L.tooltip({ direction: "top", offset: [0, -8], className: "region-tooltip" });
    let hovered: (typeof regions)[number] | null = null;

    const setHovered = (next: (typeof regions)[number] | null) => {
      if (hovered === next) return;
      if (hovered) hovered.polygon.setStyle({ weight: hovered.strong ? 3.5 : 1.4, opacity: hovered.strong ? 1 : 0.75 });
      hovered = next;
      if (hovered) hovered.polygon.setStyle({ weight: 3, opacity: 1 });
    };

    const onMove = (event: L.LeafletMouseEvent) => {
      const point: Position = [event.latlng.lng, event.latlng.lat];
      const match = regions.find((r) => r.rings.some((ring) => pointInRing(point, ring))) ?? null;
      setHovered(match);
      if (match) {
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
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
      tooltip.remove();
      removeOrderedLayer(map, "batas", group);
    };
  }, [map, data, theme, emphasize]);

  return null;
}
