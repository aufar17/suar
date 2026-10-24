"use client";

import { Layer, Source } from "react-map-gl/maplibre";
import type { ProvinceLineCollection } from "@/types";
import { slotId } from "./basemap";
import { useMapStyle } from "./map-view";

/** Province borders at regency zoom levels; they follow the regency outlines exactly. */
export function ProvinceLineLayer({
  data,
  weight = 1.8,
  emphasis = false,
}: {
  data: ProvinceLineCollection;
  weight?: number;
  /** Legend hover: draw the lines heavier. */
  emphasis?: boolean;
}) {
  const { colors } = useMapStyle();
  return (
    <Source id="provinsi-garis" type="geojson" data={data}>
      <Layer
        id="provinsi-garis"
        type="line"
        beforeId={slotId("batas")}
        layout={{ "line-join": "round" }}
        paint={{ "line-color": colors.boundary, "line-width": emphasis ? weight * 2 : weight, "line-opacity": emphasis ? 1 : 0.9 }}
      />
    </Source>
  );
}
