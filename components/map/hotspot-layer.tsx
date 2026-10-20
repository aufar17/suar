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

export const HOTSPOT_OPACITY: Record<Confidence, number> = { low: 0.5, nominal: 0.8, high: 1 };

/** Marker radius in px, growing with Fire Radiative Power (MW). */
export function hotspotRadius(frp: number): number {
  return Math.min(12, Math.max(3.5, 3 + Math.sqrt(frp) * 0.9));
}

export function hotspotColors(theme: Theme) {
  return theme === "dark" ? { fill: "#FAFAFA", stroke: "#09090B" } : { fill: "#18181B", stroke: "#FFFFFF" };
}

type HotspotMarker = L.CircleMarker & { hotspot: HotspotFeature };

/** Satellite hotspots. Size = FRP, opacity = confidence; hover shows a summary, click opens the detail. */
export function HotspotLayer({
  data,
  regionNames,
  theme,
  onSelect,
}: {
  data: HotspotCollection;
  regionNames: Record<string, string>;
  theme: Theme;
  onSelect?: (feature: HotspotFeature) => void;
}) {
  const map = useMap();
  const onSelectRef = useRef(onSelect);
  const namesRef = useRef(regionNames);
  useEffect(() => {
    onSelectRef.current = onSelect;
    namesRef.current = regionNames;
  });

  useEffect(() => {
    const colors = hotspotColors(theme);
    const group = L.featureGroup();
    const base = (path: L.Path) => ({
      opacity: 0.9,
      fillOpacity: HOTSPOT_OPACITY[(path as HotspotMarker).hotspot.properties.confidence],
    });
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
      removeOrderedLayer(map, "hotspot", group, () => fadeOutAndRemove(group, base));
    };
  }, [map, data, theme]);

  return null;
}
