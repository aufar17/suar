"use client";

import type { Map as MaplibreMap, Source } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";

export type FeatureStates = Map<string | number, Record<string, unknown>>;

/**
 * Keeps the feature-state of a source in sync with `states` (by feature id, see `promoteId`).
 * Only values change on the GPU; geometry is not reloaded. States are applied again when the
 * source is re-created (style swap on theme change) or its data is replaced.
 */
export function useFeatureStates(sourceId: string, states: FeatureStates | null) {
  const { current: mapRef } = useMap();
  const statesRef = useRef(states);
  const appliedRef = useRef<{ source: Source | undefined; states: FeatureStates | null }>({ source: undefined, states: null });

  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    statesRef.current = states;
    const apply = () => {
      // `map.style` is gone after `map.remove()` (unmount, Fast Refresh) and after a WebGL context loss.
      if (!map.style) return;
      const source = map.getSource(sourceId);
      if (!source) return;
      const applied = appliedRef.current;
      if (applied.source === source && applied.states === statesRef.current) return;
      write(map, sourceId, applied.source === source ? applied.states : null, statesRef.current);
      appliedRef.current = { source, states: statesRef.current };
    };
    apply();
    // Sources are added asynchronously (after a style swap) and their data loads in a worker.
    const onData = (event: { sourceId?: string }) => {
      if (event.sourceId === sourceId || event.sourceId === undefined) apply();
    };
    map.on("styledata", onData);
    map.on("sourcedata", onData);
    return () => {
      map.off("styledata", onData);
      map.off("sourcedata", onData);
    };
  }, [mapRef, sourceId, states]);
}

/** Writes only the changed keys; ids missing from `next` get their previous keys cleared. */
function write(map: MaplibreMap, source: string, previous: FeatureStates | null, next: FeatureStates | null) {
  if (previous) {
    for (const [id, state] of previous) {
      if (next?.has(id)) continue;
      for (const key of Object.keys(state)) map.removeFeatureState({ source, id }, key);
    }
  }
  if (!next) return;
  for (const [id, state] of next) {
    const before = previous?.get(id);
    if (before && Object.keys(state).every((key) => before[key] === state[key])) continue;
    map.setFeatureState({ source, id }, state);
  }
}
