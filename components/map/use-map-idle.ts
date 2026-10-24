"use client";

import type { Map as MaplibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

/**
 * A value read from the rendered map (e.g. with `queryRenderedFeatures`) whenever it has
 * finished rendering. React only re-renders when the value changes (`equal`).
 */
export function useMapIdleValue<T>(
  map: MaplibreMap | null,
  read: (map: MaplibreMap) => T,
  equal: (a: T, b: T) => boolean = Object.is,
): T | null {
  const [value, setValue] = useState<T | null>(null);
  const readRef = useRef(read);
  const equalRef = useRef(equal);
  useEffect(() => {
    readRef.current = read;
    equalRef.current = equal;
  });
  useEffect(() => {
    if (!map) return;
    const update = () => {
      const next = readRef.current(map);
      setValue((prev) => (prev !== null && equalRef.current(prev, next) ? prev : next));
    };
    map.on("idle", update);
    // The map may already be idle: one more frame fires "idle" again.
    map.triggerRepaint();
    return () => {
      map.off("idle", update);
    };
  }, [map]);
  return value;
}
