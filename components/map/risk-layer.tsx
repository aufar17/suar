"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { getRiskColor } from "@/lib/risk";
import type { RiskCellCollection, RiskCellFeature, RiskLevel } from "@/types";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";

function cellStyle(level: RiskLevel, opacity: number): L.PathOptions {
  return {
    stroke: false,
    fillColor: getRiskColor(level),
    // "rendah" stays transparent but clickable.
    fillOpacity: level === "rendah" ? 0 : opacity,
  };
}

/** 5 km prediction grid colored by risk level. */
export function RiskLayer({
  data,
  opacity,
  onSelect,
}: {
  data: RiskCellCollection;
  opacity: number;
  onSelect: (feature: RiskCellFeature) => void;
}) {
  const map = useMap();
  const polygonsRef = useRef<Map<L.Polygon, RiskLevel>>(new Map());
  const onSelectRef = useRef(onSelect);
  const opacityRef = useRef(opacity);
  useEffect(() => {
    onSelectRef.current = onSelect;
    opacityRef.current = opacity;
  });

  useEffect(() => {
    const group = L.featureGroup();
    const polygons = new Map<L.Polygon, RiskLevel>();
    for (const feature of data.features) {
      const ring = feature.geometry.coordinates[0].map(([lon, lat]) => L.latLng(lat, lon));
      const polygon = L.polygon(ring, cellStyle(feature.properties.level_risiko, opacityRef.current));
      polygon.on("click", () => onSelectRef.current(feature));
      polygon.addTo(group);
      polygons.set(polygon, feature.properties.level_risiko);
    }
    polygonsRef.current = polygons;
    addOrderedLayer(map, "risiko", group);
    return () => {
      removeOrderedLayer(map, "risiko", group);
    };
  }, [map, data]);

  // Opacity changes only restyle; rebuilding thousands of polygons is not needed.
  useEffect(() => {
    for (const [polygon, level] of polygonsRef.current) polygon.setStyle(cellStyle(level, opacity));
  }, [opacity]);

  return null;
}
