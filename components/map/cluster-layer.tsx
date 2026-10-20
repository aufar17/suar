"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import { formatDecimal, formatInteger } from "@/lib/format";
import { CLUSTER_STATUS_LABELS } from "@/lib/labels";
import type { ClusterCollection, ClusterFeature } from "@/types";
import { fadeInPaths, fadeOutAndRemove } from "./animate";
import { attachHoverTooltip, escapeHtml, tooltipHtml } from "./hover";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";

export function clusterColor(theme: Theme) {
  return theme === "dark" ? "#FAFAFA" : "#18181B";
}

type ZonePolygon = L.Polygon & { zone: ClusterFeature };

const BASE = { opacity: 1, fillOpacity: 0.1 };

/** Fire zones: dashed outline with a faint fill. */
export function ClusterLayer({
  data,
  theme,
  regionNames,
  onSelect,
}: {
  data: ClusterCollection;
  theme: Theme;
  regionNames: Record<string, string>;
  onSelect: (feature: ClusterFeature) => void;
}) {
  const map = useMap();
  // Keep the latest callbacks without rebuilding the layer on every render.
  const onSelectRef = useRef(onSelect);
  const namesRef = useRef(regionNames);
  useEffect(() => {
    onSelectRef.current = onSelect;
    namesRef.current = regionNames;
  });

  useEffect(() => {
    const color = clusterColor(theme);
    const group = L.featureGroup();
    for (const feature of data.features) {
      const ring = feature.geometry.coordinates[0].map(([lon, lat]) => L.latLng(lat, lon));
      const polygon = L.polygon(ring, {
        color,
        weight: 1.8,
        dashArray: "6 4",
        fillColor: color,
        opacity: 0,
        fillOpacity: 0,
        bubblingMouseEvents: false,
      }) as ZonePolygon;
      polygon.zone = feature;
      polygon.on("click", () => onSelectRef.current(feature));
      polygon.addTo(group);
    }

    let hovered: ZonePolygon | null = null;
    const detach = attachHoverTooltip<ZonePolygon>(
      map,
      group,
      (polygon) => {
        const p = polygon.zone.properties;
        return tooltipHtml(
          escapeHtml(`Zona kebakaran · ${CLUSTER_STATUS_LABELS[p.status]}`),
          [
            ["Hotspot", formatInteger(p.jumlah_hotspot)],
            ["Luas", `${formatDecimal(p.luas_km2, 1)} km²`],
            ["Wilayah", namesRef.current[p.kabupaten] ?? p.kabupaten],
          ],
          "Klik untuk detail",
        );
      },
      (polygon) => {
        hovered?.setStyle({ fillOpacity: BASE.fillOpacity, weight: 1.8 });
        hovered = polygon;
        hovered?.setStyle({ fillOpacity: 0.22, weight: 2.4 });
      },
    );

    addOrderedLayer(map, "zona", group);
    const cancel = fadeInPaths(group.getLayers() as L.Path[], () => BASE);
    return () => {
      cancel();
      detach();
      removeOrderedLayer(map, "zona", group, () => fadeOutAndRemove(group, () => BASE));
    };
  }, [map, data, theme]);

  return null;
}
