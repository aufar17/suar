"use client";

import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import { slotId } from "./basemap";
import { useMapStyle } from "./map-view";
import type { SelectionShape } from "./selection";

/** Ember outline (with a halo for contrast) around the selected cell or zone, or a ring around a hotspot. */
export function SelectionLayer({ shape }: { shape: SelectionShape }) {
  const { colors } = useMapStyle();
  const data = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry:
        "point" in shape
          ? { type: "Point" as const, coordinates: shape.point }
          : { type: "Polygon" as const, coordinates: shape.rings },
    }),
    [shape],
  );
  if ("point" in shape) {
    return (
      <Source id="sorotan" type="geojson" data={data}>
        <Layer
          id="sorotan-halo"
          type="circle"
          beforeId={slotId("sorotan-titik")}
          paint={{ "circle-radius": 14, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": colors.halo, "circle-stroke-width": 5 }}
        />
        <Layer
          id="sorotan-garis"
          type="circle"
          beforeId={slotId("sorotan-titik")}
          paint={{ "circle-radius": 14, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": colors.selection, "circle-stroke-width": 2.5 }}
        />
      </Source>
    );
  }
  return (
    <Source id="sorotan" type="geojson" data={data}>
      <Layer
        id="sorotan-halo"
        type="line"
        beforeId={slotId("sorotan")}
        layout={{ "line-join": "round" }}
        paint={{ "line-color": colors.halo, "line-width": 5 }}
      />
      <Layer
        id="sorotan-garis"
        type="line"
        beforeId={slotId("sorotan")}
        layout={{ "line-join": "round" }}
        paint={{ "line-color": colors.selection, "line-width": 2.5 }}
      />
    </Source>
  );
}
