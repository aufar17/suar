"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import { addOrderedLayer, removeOrderedLayer, type OrderedLayer } from "./layer-order";
import type { SelectionShape } from "./selection";

function shapeKey(shape: SelectionShape): string {
  if ("point" in shape) return shape.point.join(",");
  const vertices = shape.rings.reduce((n, ring) => n + ring.length, 0);
  return `${shape.rings.length}:${vertices}:${shape.rings[0]?.slice(0, 4).flat().join(",")}`;
}

/**
 * Ember outline (with a halo for contrast) around the selected cell, zone, or hotspot, or —
 * with `orderKey="fokus"` — a lighter outline around the focused province or regency.
 */
export function SelectionLayer({
  shape,
  theme,
  orderKey = "sorotan",
}: {
  shape: SelectionShape;
  theme: Theme;
  orderKey?: OrderedLayer;
}) {
  const map = useMap();
  // The shape object is recreated on every render; `key` identifies it.
  const key = shapeKey(shape);
  const shapeRef = useRef(shape);
  useEffect(() => {
    shapeRef.current = shape;
  });
  useEffect(() => {
    const shape = shapeRef.current;
    const halo = theme === "dark" ? "#09090B" : "#FFFFFF";
    const ember = theme === "dark" ? "#F97A3C" : "#E8590C";
    const focus = orderKey === "fokus";
    const style = { fill: false, interactive: false } as const;
    let layers: L.Path[];
    if ("rings" in shape) {
      const latLngs = shape.rings.map((ring) => ring.map(([lon, lat]) => L.latLng(lat, lon)));
      layers = [
        L.polygon(latLngs, { ...style, color: halo, weight: focus ? 4 : 5, opacity: focus ? 0.8 : 1 }),
        L.polygon(latLngs, { ...style, color: ember, weight: focus ? 2 : 2.5 }),
      ];
    } else {
      const [lon, lat] = shape.point;
      layers = [
        L.circleMarker([lat, lon], { ...style, radius: 14, color: halo, weight: 5 }),
        L.circleMarker([lat, lon], { ...style, radius: 14, color: ember, weight: 2.5 }),
      ];
    }
    const group = L.featureGroup(layers);
    addOrderedLayer(map, orderKey, group);
    return () => removeOrderedLayer(map, orderKey, group);
  }, [map, key, theme, orderKey]);
  return null;
}
