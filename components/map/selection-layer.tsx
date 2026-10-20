"use client";

import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import type { Position } from "@/types";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";

/** Outline around the selected grid cell or fire zone. */
export function SelectionLayer({ ring, theme }: { ring: Position[]; theme: Theme }) {
  const map = useMap();
  useEffect(() => {
    const latLngs = ring.map(([lon, lat]) => L.latLng(lat, lon));
    const group = L.featureGroup([
      L.polygon(latLngs, { color: theme === "dark" ? "#1C2321" : "#FFFFFF", weight: 5, fill: false, interactive: false }),
      L.polygon(latLngs, { color: theme === "dark" ? "#E57F4A" : "#C2521F", weight: 2.5, fill: false, interactive: false }),
    ]);
    addOrderedLayer(map, "sorotan", group);
    return () => removeOrderedLayer(map, "sorotan", group);
  }, [map, ring, theme]);
  return null;
}
