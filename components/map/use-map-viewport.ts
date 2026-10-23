"use client";

import type L from "leaflet";
import { useEffect, useState } from "react";
import type { BBox } from "@/types";

export interface MapViewport {
  zoom: number;
  /** Visible extent: [minLon, minLat, maxLon, maxLat]. */
  bbox: BBox;
  /** Map center: [lon, lat]. */
  center: [number, number];
}

function read(map: L.Map): MapViewport {
  const bounds = map.getBounds();
  const center = map.getCenter();
  return {
    zoom: map.getZoom(),
    bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
    center: [center.lng, center.lat],
  };
}

/**
 * The map's zoom and extent, updated after panning/zooming settles (debounced), so data
 * for the visible area is not requested on every animation frame.
 */
export function useMapViewport(map: L.Map | null, delay = 250): MapViewport | null {
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  useEffect(() => {
    if (!map) return;
    let timer = 0;
    let active = true;
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setViewport(read(map)), delay);
    };
    map.whenReady(() => {
      if (active) setViewport(read(map));
    });
    map.on("moveend zoomend resize", update);
    return () => {
      active = false;
      window.clearTimeout(timer);
      map.off("moveend zoomend resize", update);
    };
  }, [map, delay]);
  return viewport;
}

/**
 * Grows a bbox by `pad` (fraction of its size) and snaps it outward to a `step`° grid, so
 * small pans reuse the same request (and the client cache).
 */
export function snapBBox([minLon, minLat, maxLon, maxLat]: BBox, step: number, pad = 0.25): BBox {
  const dx = (maxLon - minLon) * pad;
  const dy = (maxLat - minLat) * pad;
  const down = (v: number) => Math.round(Math.floor(v / step) * step * 1e4) / 1e4;
  const up = (v: number) => Math.round(Math.ceil(v / step) * step * 1e4) / 1e4;
  return [
    Math.max(-180, down(minLon - dx)),
    Math.max(-85, down(minLat - dy)),
    Math.min(180, up(maxLon + dx)),
    Math.min(85, up(maxLat + dy)),
  ];
}
