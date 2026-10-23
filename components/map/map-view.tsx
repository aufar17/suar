"use client";

import "leaflet/dist/leaflet.css";
import "./leaflet-icons";

import type L from "leaflet";
import type { ReactNode } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import { INDONESIA_BBOX } from "@/lib/geo";
import type { BBox } from "@/types";
import { bboxToBounds } from "./bounds";

// OpenStreetMap standard tiles: the most detailed place names for Indonesia among the
// key-free providers (CARTO Voyager/Positron/Dark Matter return watermarked "API key
// required" tiles, and the Esri Canvas reference layer only names large cities). The tiles
// are toned down with a CSS filter on the tile pane (app/globals.css): desaturated in light
// mode, inverted in dark mode. The data layers sit on top, translucent enough to read labels.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &middot; Batas wilayah: <a href="https://www.geoboundaries.org/">geoBoundaries</a> (OSM, ODbL; BPS/OCHA, CC BY 3.0 IGO)';

/** Deepest zoom; OSM tiles exist up to 19. */
export const MAP_MAX_ZOOM = 18;

export interface MapViewProps {
  children?: ReactNode;
  /** Initial extent; defaults to the whole country. */
  bbox?: BBox;
  /** Accessible description of the map. */
  label: string;
  theme: Theme;
  /** Receives the Leaflet map once it exists (for custom controls outside the map). */
  onReady?: (map: L.Map) => void;
  /** Padding kept clear of floating panels when fitting `bbox`. */
  fitPadding?: L.FitBoundsOptions;
  /** Panning stops at this extent (with a little elastic give). */
  maxBounds?: BBox;
}

/** Base map: theme-matched tiles and one canvas renderer for many vector features. */
export function MapView({
  children,
  bbox = INDONESIA_BBOX,
  label,
  theme,
  onReady,
  fitPadding = { padding: [8, 8] },
  maxBounds,
}: MapViewProps) {
  return (
    <div role="region" aria-label={label} data-map-theme={theme} className="h-full w-full">
      <MapContainer
        ref={(map) => {
          if (map) onReady?.(map);
        }}
        bounds={bboxToBounds(bbox)}
        boundsOptions={fitPadding}
        zoomSnap={0.25}
        zoomDelta={0.5}
        minZoom={4}
        maxBounds={maxBounds ? bboxToBounds(maxBounds) : undefined}
        maxBoundsViscosity={0.8}
        maxZoom={MAP_MAX_ZOOM}
        preferCanvas
        zoomControl={false}
        keyboardPanDelta={120}
        className="h-full w-full"
      >
        <TileLayer attribution={ATTRIBUTION} url={TILE_URL} maxZoom={MAP_MAX_ZOOM} maxNativeZoom={19} />
        {children}
      </MapContainer>
    </div>
  );
}
