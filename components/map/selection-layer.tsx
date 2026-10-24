"use client";

import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import { slotId } from "./basemap";
import { useMapStyle } from "./map-view";
import type { SelectionShape } from "./selection";

const EMPTY = { type: "FeatureCollection" as const, features: [] };

/**
 * Ember outline (with a halo for contrast) around the selected cell or zone, or a ring around
 * a hotspot. Always mounted; an empty source when nothing is selected.
 */
export function SelectionLayer({ shape }: { shape: SelectionShape | null }) {
  const { colors } = useMapStyle();
  const data = useMemo(() => {
    if (!shape) return EMPTY;
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry:
            "point" in shape
              ? { type: "Point" as const, coordinates: shape.point }
              : { type: "Polygon" as const, coordinates: shape.rings },
        },
      ],
    };
  }, [shape]);
  const ring = { "circle-radius": 14, "circle-color": "rgba(0,0,0,0)" } as const;
  return (
    <Source id="sorotan" type="geojson" data={data}>
      <Layer
        id="sorotan-garis-halo"
        type="line"
        beforeId={slotId("sorotan")}
        filter={["==", ["geometry-type"], "Polygon"]}
        layout={{ "line-join": "round" }}
        paint={{ "line-color": colors.halo, "line-width": 5 }}
      />
      <Layer
        id="sorotan-garis"
        type="line"
        beforeId={slotId("sorotan")}
        filter={["==", ["geometry-type"], "Polygon"]}
        layout={{ "line-join": "round" }}
        paint={{ "line-color": colors.selection, "line-width": 2.5 }}
      />
      <Layer
        id="sorotan-titik-halo"
        type="circle"
        beforeId={slotId("sorotan-titik")}
        filter={["==", ["geometry-type"], "Point"]}
        paint={{ ...ring, "circle-stroke-color": colors.halo, "circle-stroke-width": 5 }}
      />
      <Layer
        id="sorotan-titik"
        type="circle"
        beforeId={slotId("sorotan-titik")}
        filter={["==", ["geometry-type"], "Point"]}
        paint={{ ...ring, "circle-stroke-color": colors.selection, "circle-stroke-width": 2.5 }}
      />
    </Source>
  );
}
