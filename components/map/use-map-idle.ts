"use client";

import type { Map as MaplibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

/**
 * A value read from the rendered map (e.g. with `queryRenderedFeatures`) whenever it has
 * finished rendering. React only re-renders when the value changes, so use primitives.
 */
export function useMapIdleValue<T extends string | number | null>(map: MaplibreMap | null, read: (map: MaplibreMap) => T): T | null {
  const [value, setValue] = useState<T | null>(null);
  const readRef = useRef(read);
  useEffect(() => {
    readRef.current = read;
  });
  useEffect(() => {
    if (!map) return;
    const update = () => setValue(readRef.current(map));
    map.on("idle", update);
    // The map may already be idle: one more frame fires "idle" again.
    map.triggerRepaint();
    return () => {
      map.off("idle", update);
    };
  }, [map]);
  return value;
}
