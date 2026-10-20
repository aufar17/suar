"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import { CLUSTER_STATUS_LABELS } from "@/lib/labels";
import type { ClusterCollection, ClusterFeature } from "@/types";
import { escapeHtml } from "./html";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";

export function clusterColor(theme: Theme) {
  return theme === "dark" ? "#F3F4F0" : "#1C2321";
}

/** Fire zones: dashed outline with a faint fill. */
export function ClusterLayer({
  data,
  theme,
  onSelect,
}: {
  data: ClusterCollection;
  theme: Theme;
  onSelect: (feature: ClusterFeature) => void;
}) {
  const map = useMap();
  // Keep the latest callback without rebuilding the layer on every render.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const color = clusterColor(theme);
    const group = L.featureGroup();
    for (const feature of data.features) {
      const ring = feature.geometry.coordinates[0].map(([lon, lat]) => L.latLng(lat, lon));
      L.polygon(ring, {
        color,
        weight: 1.8,
        dashArray: "6 4",
        fillColor: color,
        fillOpacity: 0.1,
        bubblingMouseEvents: false,
      })
        .bindTooltip(
          `Zona kebakaran · ${escapeHtml(CLUSTER_STATUS_LABELS[feature.properties.status])}`,
          { sticky: true, direction: "top" },
        )
        .on("click", () => onSelectRef.current(feature))
        .addTo(group);
    }
    addOrderedLayer(map, "zona", group);
    return () => removeOrderedLayer(map, "zona", group);
  }, [map, data, theme]);

  return null;
}
