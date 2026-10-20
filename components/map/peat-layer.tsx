"use client";

import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import type { RiskCellCollection } from "@/types";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";

/** Peatland, drawn from the grid cells flagged `is_gambut` as one soft, borderless layer. */
export function PeatLayer({ cells, theme }: { cells: RiskCellCollection; theme: Theme }) {
  const map = useMap();
  useEffect(() => {
    const color = theme === "dark" ? "#C9B67A" : "#7A6A3A";
    const group = L.featureGroup();
    for (const feature of cells.features) {
      if (!feature.properties.is_gambut) continue;
      const ring = feature.geometry.coordinates[0].map(([lon, lat]) => L.latLng(lat, lon));
      L.polygon(ring, { stroke: false, fillColor: color, fillOpacity: 0.32, interactive: false }).addTo(group);
    }
    addOrderedLayer(map, "gambut", group);
    return () => removeOrderedLayer(map, "gambut", group);
  }, [map, cells, theme]);
  return null;
}
