"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";
import type { SelectionShape } from "./selection";

/** Ember outline (with a halo for contrast) around the selected cell, zone, or hotspot. */
export function SelectionLayer({ shape, theme }: { shape: SelectionShape; theme: Theme }) {
  const map = useMap();
  // The shape object is recreated on every render; `key` identifies it.
  const key = "ring" in shape ? shape.ring.flat().join(",") : shape.point.join(",");
  const shapeRef = useRef(shape);
  useEffect(() => {
    shapeRef.current = shape;
  });
  useEffect(() => {
    const shape = shapeRef.current;
    const halo = theme === "dark" ? "#09090B" : "#FFFFFF";
    const ember = theme === "dark" ? "#F97A3C" : "#E8590C";
    const style = { fill: false, interactive: false } as const;
    let layers: L.Path[];
    if ("ring" in shape) {
      const latLngs = shape.ring.map(([lon, lat]) => L.latLng(lat, lon));
      layers = [
        L.polygon(latLngs, { ...style, color: halo, weight: 5 }),
        L.polygon(latLngs, { ...style, color: ember, weight: 2.5 }),
      ];
    } else {
      const [lon, lat] = shape.point;
      layers = [
        L.circleMarker([lat, lon], { ...style, radius: 14, color: halo, weight: 5 }),
        L.circleMarker([lat, lon], { ...style, radius: 14, color: ember, weight: 2.5 }),
      ];
    }
    const group = L.featureGroup(layers);
    addOrderedLayer(map, "sorotan", group);
    return () => removeOrderedLayer(map, "sorotan", group);
  }, [map, key, theme]);
  return null;
}
