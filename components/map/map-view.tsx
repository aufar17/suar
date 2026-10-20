"use client";

import "leaflet/dist/leaflet.css";
import "./leaflet-icons";

import type L from "leaflet";
import type { ReactNode } from "react";
import { MapContainer, Pane, TileLayer } from "react-leaflet";
import type { Theme } from "@/components/ui/theme";
import { RIAU_BBOX } from "@/lib/geo";
import type { BBox } from "@/types";
import { bboxToBounds } from "./bounds";

// Esri Canvas basemaps (light/dark gray) with a separate label layer. CARTO Positron/Dark
// Matter now return "API KEY REQUIRED" tiles without a key; to switch, change these URLs
// (see PLAN.md, Catatan Keputusan, for the terms of each provider).
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const BASEMAPS: Record<Theme, { base: string; labels: string }> = {
  light: {
    base: `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  },
  dark: {
    base: `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  },
};

const ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, GIS User Community';

export interface MapViewProps {
  children?: ReactNode;
  /** Initial extent; defaults to the whole province. */
  bbox?: BBox;
  /** Accessible description of the map. */
  label: string;
  theme: Theme;
  /** Receives the Leaflet map once it exists (for custom controls outside the map). */
  onReady?: (map: L.Map) => void;
  /** Padding kept clear of floating panels when fitting `bbox`. */
  fitPadding?: L.FitBoundsOptions;
}

/** Base map: theme-matched tiles and one canvas renderer for many vector features. */
export function MapView({ children, bbox = RIAU_BBOX, label, theme, onReady, fitPadding = { padding: [8, 8] } }: MapViewProps) {
  return (
    <div role="region" aria-label={label} className="h-full w-full">
      <MapContainer
        ref={(map) => {
          if (map) onReady?.(map);
        }}
        bounds={bboxToBounds(bbox)}
        boundsOptions={fitPadding}
        zoomSnap={0.25}
        zoomDelta={0.5}
        minZoom={5}
        maxZoom={15}
        preferCanvas
        zoomControl={false}
        keyboardPanDelta={120}
        className="h-full w-full"
      >
        <TileLayer key={theme} attribution={ATTRIBUTION} url={BASEMAPS[theme].base} maxNativeZoom={16} maxZoom={20} />
        {/* Place names above the data layers; the pane ignores the pointer so clicks reach the grid. */}
        <Pane name="labels" style={{ zIndex: 450, pointerEvents: "none" }}>
          <TileLayer key={theme} url={BASEMAPS[theme].labels} maxNativeZoom={16} maxZoom={20} />
        </Pane>
        {children}
      </MapContainer>
    </div>
  );
}
