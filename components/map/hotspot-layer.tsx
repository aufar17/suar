"use client";

import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import { formatDecimal, formatDateTime } from "@/lib/format";
import { CONFIDENCE_LABELS, SATELLITE_LABELS } from "@/lib/labels";
import type { Confidence, HotspotCollection } from "@/types";
import { popupHtml } from "./html";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";

export const HOTSPOT_OPACITY: Record<Confidence, number> = { low: 0.5, nominal: 0.8, high: 1 };

/** Marker radius in px, growing with Fire Radiative Power (MW). */
export function hotspotRadius(frp: number): number {
  return Math.min(12, Math.max(3.5, 3 + Math.sqrt(frp) * 0.9));
}

export function hotspotColors(theme: Theme) {
  return theme === "dark" ? { fill: "#F3F4F0", stroke: "#1C2321" } : { fill: "#1C2321", stroke: "#FFFFFF" };
}

export function HotspotLayer({
  data,
  regionNames,
  theme,
}: {
  data: HotspotCollection;
  regionNames: Record<string, string>;
  theme: Theme;
}) {
  const map = useMap();

  useEffect(() => {
    const colors = hotspotColors(theme);
    const group = L.featureGroup();
    // Larger fires first so small markers stay clickable on top.
    const features = [...data.features].sort((a, b) => b.properties.frp - a.properties.frp);
    for (const feature of features) {
      const [lon, lat] = feature.geometry.coordinates;
      const p = feature.properties;
      L.circleMarker([lat, lon], {
        radius: hotspotRadius(p.frp),
        color: colors.stroke,
        weight: 1,
        fillColor: colors.fill,
        fillOpacity: HOTSPOT_OPACITY[p.confidence],
        opacity: 0.9,
        bubblingMouseEvents: false,
      })
        .bindPopup(
          () =>
            popupHtml("Hotspot", [
              ["Waktu deteksi", formatDateTime(p.waktu_deteksi)],
              ["Satelit", SATELLITE_LABELS[p.satelit]],
              ["Kepercayaan", CONFIDENCE_LABELS[p.confidence]],
              ["FRP", `${formatDecimal(p.frp, 1)} MW`],
              ["Wilayah", regionNames[p.kabupaten] ?? p.kabupaten],
            ]),
          { maxWidth: 280 },
        )
        .addTo(group);
    }
    addOrderedLayer(map, "hotspot", group);
    return () => removeOrderedLayer(map, "hotspot", group);
  }, [map, data, regionNames, theme]);

  return null;
}
