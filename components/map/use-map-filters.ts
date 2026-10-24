"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { CONFIDENCE_LEVELS, type Confidence } from "@/types/constants";

export const LAYER_KEYS = ["hotspot", "zona", "risiko", "batas", "gambut"] as const;
export type LayerKey = (typeof LAYER_KEYS)[number];

export const RANGE_OPTIONS = [1, 3, 7] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export const PREDICTION_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export interface MapFilters {
  /** Hotspot window in days, ending at the latest data date. */
  rentang: RangeDays;
  /** Minimum hotspot confidence. */
  conf: Confidence;
  /** Visible layers. */
  lapisan: LayerKey[];
  /** Prediction day offset (+1 … +7). */
  prediksi: number;
  /** Focused province or regency (slug): the summary describes it. */
  wilayah: string | null;
}

export const DEFAULT_FILTERS: MapFilters = {
  rentang: 1,
  conf: "low",
  lapisan: ["hotspot", "zona", "risiko", "batas"],
  prediksi: 1,
  wilayah: null,
};

export function parseFilters(params: URLSearchParams): MapFilters {
  const rentang = Number(params.get("rentang"));
  const conf = params.get("conf");
  const prediksi = Number(params.get("prediksi"));
  const lapisan = params.get("lapisan");
  const wilayah = params.get("wilayah");
  return {
    rentang: (RANGE_OPTIONS as readonly number[]).includes(rentang) ? (rentang as RangeDays) : DEFAULT_FILTERS.rentang,
    conf: (CONFIDENCE_LEVELS as readonly string[]).includes(conf ?? "") ? (conf as Confidence) : DEFAULT_FILTERS.conf,
    lapisan:
      lapisan === null
        ? DEFAULT_FILTERS.lapisan
        : LAYER_KEYS.filter((key) => lapisan.split(",").includes(key)),
    prediksi: Number.isInteger(prediksi) && prediksi >= 1 && prediksi <= 7 ? prediksi : DEFAULT_FILTERS.prediksi,
    wilayah: wilayah && /^[a-z0-9-]+$/.test(wilayah) ? wilayah : null,
  };
}

export function serializeFilters(filters: MapFilters): string {
  const params = new URLSearchParams();
  if (filters.rentang !== DEFAULT_FILTERS.rentang) params.set("rentang", String(filters.rentang));
  if (filters.conf !== DEFAULT_FILTERS.conf) params.set("conf", filters.conf);
  const layers = LAYER_KEYS.filter((key) => filters.lapisan.includes(key));
  if (layers.join(",") !== DEFAULT_FILTERS.lapisan.join(",")) params.set("lapisan", layers.join(","));
  if (filters.prediksi !== DEFAULT_FILTERS.prediksi) params.set("prediksi", String(filters.prediksi));
  if (filters.wilayah) params.set("wilayah", filters.wilayah);
  return params.toString();
}

/** Map position in the URL: `peta=zoom/lat/lon` (like OpenStreetMap's `map=`). */
export interface MapViewParam {
  zoom: number;
  center: [number, number];
}

const VIEW_PARAM = "peta";

export function parseMapView(value: string | null): MapViewParam | null {
  const parts = value?.split("/").map(Number);
  if (!parts || parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [zoom, lat, lon] = parts;
  if (zoom < 0 || zoom > 22 || Math.abs(lat) > 85 || Math.abs(lon) > 180) return null;
  return { zoom, center: [lon, lat] };
}

function replaceQuery(params: URLSearchParams) {
  const query = params.toString();
  // Native history updates are synced with useSearchParams without a server round trip.
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
}

/**
 * Writes the map position to the URL (call once the map has settled, not while it moves),
 * so a shared link opens the same view.
 */
export function writeMapView({ zoom, center: [lon, lat] }: MapViewParam) {
  const params = new URLSearchParams(window.location.search);
  params.set(VIEW_PARAM, `${zoom.toFixed(2)}/${lat.toFixed(4)}/${lon.toFixed(4)}`);
  replaceQuery(params);
}

/**
 * Filter state stored in the URL so a map view can be shared as a link. The filters only
 * change identity when a filter changes (not when the map position in the URL does).
 */
export function useMapFilters() {
  const searchParams = useSearchParams();
  const filterQuery = serializeFilters(parseFilters(new URLSearchParams(searchParams.toString())));
  const filters = useMemo(() => parseFilters(new URLSearchParams(filterQuery)), [filterQuery]);
  const view = searchParams.get(VIEW_PARAM);

  const setFilters = useCallback(
    (patch: Partial<MapFilters>) => {
      const params = new URLSearchParams(serializeFilters({ ...filters, ...patch }));
      const current = new URLSearchParams(window.location.search).get(VIEW_PARAM);
      if (current) params.set(VIEW_PARAM, current);
      replaceQuery(params);
    },
    [filters],
  );

  const toggleLayer = useCallback(
    (key: LayerKey, visible: boolean) => {
      const next = visible ? [...filters.lapisan, key] : filters.lapisan.filter((k) => k !== key);
      setFilters({ lapisan: next });
    },
    [filters.lapisan, setFilters],
  );

  return { filters, setFilters, toggleLayer, view };
}
