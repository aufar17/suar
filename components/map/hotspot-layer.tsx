"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import { formatDateTime, formatDecimal } from "@/lib/format";
import { CONFIDENCE_LABELS } from "@/lib/labels";
import type { Confidence, HotspotCollection, HotspotFeature } from "@/types";
import { fadeInPaths, fadeOutAndRemove } from "./animate";
import { attachHoverTooltip, tooltipHtml } from "./hover";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";
import { HOTSPOT_OPACITY, hotspotRadius } from "./styles";


export function hotspotColors(theme: Theme) {
  return theme === "dark" ? { fill: "#FAFAFA", stroke: "#09090B" } : { fill: "#18181B", stroke: "#FFFFFF" };
}

type HotspotMarker = L.CircleMarker & { hotspot: HotspotFeature };

/** Satellite hotspots. Size = FRP, opacity = confidence; hover shows a summary, click opens the detail. */
export function HotspotLayer({
  data,
  regionNames,
  theme,
  highlight = null,
  onSelect,
}: {
  data: HotspotCollection;
  regionNames: Record<string, string>;
  theme: Theme;
  /** Legend hover: emphasize hotspots of this confidence level. */
  highlight?: Confidence | null;
  onSelect?: (feature: HotspotFeature) => void;
}) {
  const map = useMap();
  const onSelectRef = useRef(onSelect);
  const namesRef = useRef(regionNames);
  const highlightRef = useRef(highlight);
  const groupRef = useRef<L.FeatureGroup | null>(null);
  useEffect(() => {
    onSelectRef.current = onSelect;
    namesRef.current = regionNames;
  });

  const base = (path: L.Path) => {
    const confidence = (path as HotspotMarker).hotspot.properties.confidence;
    const current = highlightRef.current;
    if (current && current !== confidence) return { opacity: 0.25, fillOpacity: 0.12 };
    return { opacity: current ? 1 : 0.9, fillOpacity: current ? 1 : HOTSPOT_OPACITY[confidence] };
  };
  const baseRef = useRef(base);

  useEffect(() => {
    highlightRef.current = highlight;
    for (const layer of groupRef.current?.getLayers() ?? []) {
      const path = layer as HotspotMarker;
      path.setStyle({ ...baseRef.current(path), weight: highlight && path.hotspot.properties.confidence === highlight ? 2 : 1 });
    }
  }, [highlight]);

  useEffect(() => {
    const colors = hotspotColors(theme);
    const group = L.featureGroup();
    groupRef.current = group;
    const base = baseRef.current;
    // Larger fires first so small markers stay clickable on top.
    const features = [...data.features].sort((a, b) => b.properties.frp - a.properties.frp);
    for (const feature of features) {
      const [lon, lat] = feature.geometry.coordinates;
      const marker = L.circleMarker([lat, lon], {
        radius: hotspotRadius(feature.properties.frp),
        color: colors.stroke,
        weight: 1,
        fillColor: colors.fill,
        opacity: 0,
        fillOpacity: 0,
        bubblingMouseEvents: false,
      }) as HotspotMarker;
      marker.hotspot = feature;
      marker.on("click", () => onSelectRef.current?.(feature));
      marker.addTo(group);
    }

    let hovered: HotspotMarker | null = null;
    const detach = attachHoverTooltip<HotspotMarker>(
      map,
      group,
      (marker) => {
        const p = marker.hotspot.properties;
        return tooltipHtml(
          "Hotspot",
          [
            ["Waktu", formatDateTime(p.waktu_deteksi)],
            ["FRP", `${formatDecimal(p.frp, 1)} MW`],
            ["Kepercayaan", CONFIDENCE_LABELS[p.confidence]],
            ["Wilayah", namesRef.current[p.kabupaten] ?? p.kabupaten],
          ],
          onSelectRef.current ? "Klik untuk detail" : undefined,
        );
      },
      (marker) => {
        hovered?.setStyle({ weight: 1 });
        hovered = marker;
        hovered?.setStyle({ weight: 2.5 });
      },
    );

    addOrderedLayer(map, "hotspot", group);
    const cancel = fadeInPaths(group.getLayers() as L.Path[], base);
    return () => {
      cancel();
      detach();
      if (groupRef.current === group) groupRef.current = null;
      removeOrderedLayer(map, "hotspot", group, () => fadeOutAndRemove(group, base));
    };
  }, [map, data, theme]);

  return null;
}
