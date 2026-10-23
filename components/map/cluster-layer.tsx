"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import { formatDecimal, formatInteger } from "@/lib/format";
import { CLUSTER_STATUS_LABELS } from "@/lib/labels";
import type { ClusterCollection, ClusterFeature, ClusterStatus } from "@/types";
import { fadeInPaths, fadeOutAndRemove } from "./animate";
import { attachHoverTooltip, escapeHtml, tooltipHtml } from "./hover";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";
import { ZONE_STYLES } from "./styles";

export function clusterColor(theme: Theme) {
  return theme === "dark" ? "#FAFAFA" : "#18181B";
}

type ZonePolygon = L.Polygon & { zone: ClusterFeature };

const FILL = 0.1;

/** Fire zones: dashed outline with a faint fill. */
export function ClusterLayer({
  data,
  theme,
  regionNames,
  highlight = null,
  onSelect,
}: {
  data: ClusterCollection;
  theme: Theme;
  regionNames: Record<string, string>;
  /** Legend hover: emphasize zones of this status. */
  highlight?: ClusterStatus | null;
  onSelect: (feature: ClusterFeature) => void;
}) {
  const map = useMap();
  const highlightRef = useRef(highlight);
  const groupRef = useRef<L.FeatureGroup | null>(null);
  const base = (path: L.Path) => {
    const status = (path as ZonePolygon).zone.properties.status;
    const current = highlightRef.current;
    const dimmed = current !== null && current !== status;
    return { opacity: dimmed ? 0.25 : ZONE_STYLES[status].opacity, fillOpacity: dimmed ? 0.03 : current ? 0.24 : FILL };
  };
  const baseRef = useRef(base);
  useEffect(() => {
    highlightRef.current = highlight;
    for (const layer of groupRef.current?.getLayers() ?? []) {
      const path = layer as ZonePolygon;
      const style = ZONE_STYLES[path.zone.properties.status];
      path.setStyle({ ...baseRef.current(path), weight: highlight === path.zone.properties.status ? style.weight + 1 : style.weight });
    }
  }, [highlight]);
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
    groupRef.current = group;
    const base = baseRef.current;
    for (const feature of data.features) {
      const ring = feature.geometry.coordinates[0].map(([lon, lat]) => L.latLng(lat, lon));
      const style = ZONE_STYLES[feature.properties.status];
      const polygon = L.polygon(ring, {
        color,
        weight: style.weight,
        dashArray: style.dashArray,
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
        if (hovered) hovered.setStyle({ ...base(hovered), weight: ZONE_STYLES[hovered.zone.properties.status].weight });
        hovered = polygon;
        hovered?.setStyle({ fillOpacity: 0.22, weight: ZONE_STYLES[polygon!.zone.properties.status].weight + 0.6 });
      },
    );

    addOrderedLayer(map, "zona", group);
    const cancel = fadeInPaths(group.getLayers() as L.Path[], base);
    return () => {
      cancel();
      detach();
      if (groupRef.current === group) groupRef.current = null;
      removeOrderedLayer(map, "zona", group, () => fadeOutAndRemove(group, base));
    };
  }, [map, data, theme]);

  return null;
}
