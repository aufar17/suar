"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import type { RiskCellCollection } from "@/types";
import { fadeInPaths, fadeOutAndRemove } from "./animate";
import { addOrderedLayer, removeOrderedLayer } from "./layer-order";

const FILL = { normal: 0.26, emphasis: 0.55 };

/**
 * Peatland, drawn from the grid cells flagged `is_gambut` as one soft, borderless layer.
 * The cells come with each prediction day, but the peat set itself does not change, so
 * the layer is only rebuilt when that set (or the theme) does.
 */
export function PeatLayer({
  cells,
  theme,
  emphasis = false,
}: {
  cells: RiskCellCollection;
  theme: Theme;
  /** Legend hover: draw the peat stronger. */
  emphasis?: boolean;
}) {
  const map = useMap();
  const peat = useMemo(() => cells.features.filter((f) => f.properties.is_gambut), [cells]);
  const key = useMemo(() => peat.map((f) => f.properties.cell_id).join(","), [peat]);
  const peatRef = useRef(peat);
  const emphasisRef = useRef(emphasis);
  const groupRef = useRef<L.FeatureGroup | null>(null);
  useEffect(() => {
    peatRef.current = peat;
  });

  useEffect(() => {
    const color = theme === "dark" ? "#C9B67A" : "#8A6A2F";
    const group = L.featureGroup();
    groupRef.current = group;
    for (const feature of peatRef.current) {
      const ring = feature.geometry.coordinates[0].map(([lon, lat]) => L.latLng(lat, lon));
      L.polygon(ring, { stroke: false, fillColor: color, fillOpacity: 0, interactive: false }).addTo(group);
    }
    const base = () => ({ opacity: 0, fillOpacity: emphasisRef.current ? FILL.emphasis : FILL.normal });
    addOrderedLayer(map, "gambut", group);
    const cancel = fadeInPaths(group.getLayers() as L.Path[], base);
    return () => {
      cancel();
      if (groupRef.current === group) groupRef.current = null;
      removeOrderedLayer(map, "gambut", group, () => fadeOutAndRemove(group, base));
    };
  }, [map, key, theme]);

  useEffect(() => {
    emphasisRef.current = emphasis;
    groupRef.current?.setStyle({ fillOpacity: emphasis ? FILL.emphasis : FILL.normal });
  }, [emphasis]);

  return null;
}
