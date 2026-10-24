"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MaplibreMap, PaddingOptions } from "maplibre-gl";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import MapGL from "react-map-gl/maplibre";
import type { Theme } from "@/components/ui/theme";
import { INDONESIA_BBOX } from "@/lib/geo";
import type { BBox } from "@/types";
import { loadBasemap, type Basemap, type MapFonts } from "./basemap";
import { bboxToBounds } from "./bounds";
import { MAP_COLORS, type MapColors } from "./colors";
import { MapSkeleton } from "./map-skeleton";

const ATTRIBUTION =
  'Batas wilayah: <a href="https://www.geoboundaries.org/" target="_blank" rel="noopener">geoBoundaries</a> (OSM, ODbL; BPS/OCHA, CC BY 3.0 IGO)';

/** Zoom range. MapLibre zoom is one step below Leaflet's for the same scale (512 px tiles). */
export const MAP_MIN_ZOOM = 3;
export const MAP_MAX_ZOOM = 17;

interface MapStyleContextValue {
  theme: Theme;
  colors: MapColors;
  fonts: MapFonts;
}

const MapStyleContext = createContext<MapStyleContextValue | null>(null);

/** Theme, layer colors, and label fonts of the basemap currently shown. */
export function useMapStyle(): MapStyleContextValue {
  const value = useContext(MapStyleContext);
  if (!value) throw new Error("useMapStyle dipakai di luar MapView");
  return value;
}

function useBasemap(theme: Theme): Basemap | null {
  const [basemap, setBasemap] = useState<Basemap | null>(null);
  useEffect(() => {
    let active = true;
    loadBasemap(theme).then((next) => {
      if (active) setBasemap(next);
    });
    return () => {
      active = false;
    };
  }, [theme]);
  return basemap;
}

export interface MapViewProps {
  children?: ReactNode;
  /** Initial extent; defaults to the whole country. */
  bbox?: BBox;
  /** Accessible description of the map. */
  label: string;
  theme: Theme;
  /** Receives the MapLibre map once it has loaded (for controls outside the map). */
  onReady?: (map: MaplibreMap) => void;
  /** Padding kept clear of floating panels when fitting `bbox`. */
  fitPadding?: PaddingOptions;
  /** Panning stops at this extent. */
  maxBounds?: BBox;
}

/**
 * Base map: a vector basemap per theme (a theme change swaps the whole style; the data
 * sources and layers re-add themselves) and the slots that order the data layers.
 */
export function MapView({
  children,
  bbox = INDONESIA_BBOX,
  label,
  theme,
  onReady,
  fitPadding = { top: 8, right: 8, bottom: 8, left: 8 },
  maxBounds,
}: MapViewProps) {
  const basemap = useBasemap(theme);
  // Layer colors follow the style that is actually shown, not the requested theme.
  const context = useMemo(
    () => basemap && { theme: basemap.theme, colors: MAP_COLORS[basemap.theme], fonts: basemap.fonts },
    [basemap],
  );

  if (!basemap || !context) return <MapSkeleton />;
  return (
    <div role="region" aria-label={label} className="h-full w-full">
      <MapStyleContext.Provider value={context}>
        <MapGL
          mapStyle={basemap.style}
          // Swap the whole style on theme change; diffing would also strip the data layers.
          styleDiffing={false}
          initialViewState={{ bounds: bboxToBounds(bbox), fitBoundsOptions: { padding: fitPadding } }}
          minZoom={MAP_MIN_ZOOM}
          maxZoom={MAP_MAX_ZOOM}
          maxBounds={maxBounds}
          dragRotate={false}
          pitchWithRotate={false}
          touchPitch={false}
          attributionControl={{ customAttribution: ATTRIBUTION }}
          onLoad={(event) => {
            const map = event.target;
            map.touchZoomRotate.disableRotation();
            map.keyboard.disableRotation();
            onReady?.(map);
          }}
          style={{ width: "100%", height: "100%" }}
        >
          {children}
        </MapGL>
      </MapStyleContext.Provider>
    </div>
  );
}
