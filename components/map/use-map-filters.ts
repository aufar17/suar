"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { CONFIDENCE_LEVELS, type Confidence } from "@/types";

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

/** Filter state stored in the URL so a map view can be shared as a link. */
export function useMapFilters() {
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFilters(new URLSearchParams(searchParams.toString())), [searchParams]);

  const setFilters = useCallback(
    (patch: Partial<MapFilters>) => {
      const query = serializeFilters({ ...filters, ...patch });
      // Native history updates are synced with useSearchParams without a server round trip.
      window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
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

  return { filters, setFilters, toggleLayer };
}
