"use client";

import type { GeoJSONSource, Map as MaplibreMap, MapSourceDataEvent } from "maplibre-gl";
import { useCallback, useEffect, useState } from "react";

export interface SourceStatus {
  loading: boolean;
  error: string | undefined;
  retry: () => void;
}

/**
 * Load state of a GeoJSON source whose data is a URL (fetched and parsed by MapLibre's
 * worker). `url` = the data currently set on the source, or null when there is none.
 */
export function useSourceStatus(map: MaplibreMap | null, sourceId: string, url: string | null): SourceStatus {
  const [state, setState] = useState<{ url: string | null; loaded: boolean; error?: string }>({ url: null, loaded: false });

  useEffect(() => {
    if (!map || !url) return;
    const loaded = () => setState((prev) => (prev.url === url && prev.loaded && !prev.error ? prev : { url, loaded: true }));
    const onData = (event: MapSourceDataEvent) => {
      if (event.sourceId === sourceId && event.isSourceLoaded) loaded();
    };
    // Also checked once the map is idle, in case the data loaded before this subscription.
    const onIdle = () => {
      if (map.getSource(sourceId) && map.isSourceLoaded(sourceId)) loaded();
    };
    const onError = (event: { sourceId?: string; error?: Error }) => {
      if (event.sourceId !== sourceId) return;
      setState({ url, loaded: false, error: event.error?.message ?? "Gagal memuat data" });
    };
    map.on("sourcedata", onData);
    map.on("idle", onIdle);
    map.on("error", onError);
    map.triggerRepaint();
    return () => {
      map.off("sourcedata", onData);
      map.off("idle", onIdle);
      map.off("error", onError);
    };
  }, [map, sourceId, url]);

  const retry = useCallback(() => {
    if (!map || !url) return;
    setState({ url: null, loaded: false });
    map.getSource<GeoJSONSource>(sourceId)?.setData(url);
  }, [map, sourceId, url]);

  const current = url !== null && state.url === url;
  return {
    loading: url !== null && !(current && (state.loaded || state.error)),
    error: current ? state.error : undefined,
    retry,
  };
}
