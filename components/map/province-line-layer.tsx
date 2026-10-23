"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import type { ProvinceLineCollection } from "@/types";
import { fadeInPaths, fadeOutAndRemove } from "./animate";
import { boundaryColor } from "./boundary-layer";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";

const BASE = { opacity: 0.9, fillOpacity: 0 };

/** Province borders at regency zoom levels; they follow the regency outlines exactly. */
export function ProvinceLineLayer({
  data,
  theme,
  weight = 1.8,
  emphasis = false,
}: {
  data: ProvinceLineCollection;
  theme: Theme;
  weight?: number;
  /** Legend hover: draw the lines heavier. */
  emphasis?: boolean;
}) {
  const map = useMap();
  const groupRef = useRef<L.FeatureGroup | null>(null);
  useEffect(() => {
    groupRef.current?.setStyle({ weight: emphasis ? weight * 2 : weight, opacity: emphasis ? 1 : BASE.opacity });
  }, [emphasis, weight]);
  useEffect(() => {
    const group = L.featureGroup();
    groupRef.current = group;
    for (const feature of data.features) {
      const lines = feature.geometry.coordinates.map((line) => line.map(([lon, lat]) => L.latLng(lat, lon)));
      L.polyline(lines, { color: boundaryColor(theme), weight, opacity: 0, interactive: false }).addTo(group);
    }
    addOrderedLayer(map, "batas-provinsi", group);
    const cancel = fadeInPaths(group.getLayers() as L.Path[], () => BASE);
    return () => {
      cancel();
      if (groupRef.current === group) groupRef.current = null;
      removeOrderedLayer(map, "batas-provinsi", group, () => fadeOutAndRemove(group, () => BASE));
    };
  }, [map, data, theme, weight]);
  return null;
}
