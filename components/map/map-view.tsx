"use client";

import "leaflet/dist/leaflet.css";
import "./leaflet-icons";

import type { LatLngBoundsExpression } from "leaflet";
import type { ReactNode } from "react";
import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";
import { RIAU_BBOX } from "@/lib/geo";
import type { BBox } from "@/types";

export function bboxToBounds([minLon, minLat, maxLon, maxLat]: BBox): LatLngBoundsExpression {
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}

export interface MapViewProps {
  children?: ReactNode;
  /** Initial extent; defaults to the whole province. */
  bbox?: BBox;
  /** Accessible description of the map. */
  label: string;
}

/** Base map: OSM tiles, canvas renderer for many vector features, zoom buttons top-right. */
export function MapView({ children, bbox = RIAU_BBOX, label }: MapViewProps) {
  return (
    <div role="region" aria-label={label} className="h-full w-full">
      <MapContainer
        bounds={bboxToBounds(bbox)}
        boundsOptions={{ padding: [8, 8] }}
        zoomSnap={0.25}
        zoomDelta={0.5}
        minZoom={6}
        maxZoom={15}
        preferCanvas
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ZoomControl position="topright" zoomInTitle="Perbesar" zoomOutTitle="Perkecil" />
        {children}
      </MapContainer>
    </div>
  );
}
