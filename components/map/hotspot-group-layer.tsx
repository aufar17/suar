"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { formatDecimal, formatInteger } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/use-media-query";
import type { HotspotGroupFeature } from "@/types";
import { escapeHtml, tooltipHtml } from "./hover";

/** Diameter in px, growing with the number of hotspots in the group. */
export function groupSize(count: number): number {
  return Math.round(Math.min(48, 24 + 9 * Math.log10(count)));
}

/** Short count for the badge: 1.234 → "1,2rb". */
export function groupLabel(count: number): string {
  return count >= 1000 ? `${formatDecimal(count / 1000, 1)}rb` : formatInteger(count);
}

/**
 * Numbered circles for groups of nearby hotspots (small scales). They are HTML markers so the
 * count stays crisp and each group is a focusable button; clicking zooms in on the group.
 */
export function HotspotGroupLayer({
  groups,
  emphasis = false,
  dimmed = false,
}: {
  groups: HotspotGroupFeature[];
  /** Legend hover: outline every group. */
  emphasis?: boolean;
  dimmed?: boolean;
}) {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    const layer = L.layerGroup();
    const tooltip = L.tooltip({ className: "map-tooltip", direction: "top", offset: [0, -14], opacity: 1 });
    markersRef.current = groups.map((group) => {
      const [lon, lat] = group.geometry.coordinates;
      const { jumlah, frp_maks } = group.properties;
      const size = groupSize(jumlah);
      const label = `${formatInteger(jumlah)} hotspot, klik untuk memperbesar`;
      const marker = L.marker([lat, lon], {
        icon: L.divIcon({
          className: "hotspot-group-icon",
          html: `<span class="hotspot-group" aria-hidden="true">${escapeHtml(groupLabel(jumlah))}</span>`,
          iconSize: [size, size],
        }),
        keyboard: true,
        title: label,
        riseOnHover: true,
      });
      marker.on("add", () => marker.getElement()?.setAttribute("aria-label", label));
      // Leaflet also fires "click" when a focused marker receives Enter.
      marker.on("click", () => {
        tooltip.remove();
        map.flyTo([lat, lon], Math.min(map.getZoom() + 2, 9), { duration: 0.3, animate: !prefersReducedMotion() });
      });
      marker.on("mouseover", () => {
        tooltip
          .setLatLng([lat, lon])
          .setContent(
            tooltipHtml(
              escapeHtml(`${formatInteger(jumlah)} hotspot`),
              [["FRP tertinggi", `${formatDecimal(frp_maks, 1)} MW`]],
              "Klik untuk memperbesar",
            ),
          );
        tooltip.addTo(map);
      });
      marker.on("mouseout", () => tooltip.remove());
      marker.addTo(layer);
      return marker;
    });
    layer.addTo(map);
    return () => {
      tooltip.remove();
      layer.remove();
      markersRef.current = [];
    };
  }, [map, groups]);

  // Legend hover/filter only restyles the badges.
  useEffect(() => {
    for (const marker of markersRef.current) {
      const badge = marker.getElement()?.firstElementChild as HTMLElement | null | undefined;
      if (!badge) continue;
      badge.dataset.emphasis = String(emphasis);
      badge.dataset.dimmed = String(dimmed);
    }
  }, [emphasis, dimmed, groups]);

  return null;
}
