// On-disk formats of the files in `mock/`. Large datasets are stored compactly and
// expanded to GeoJSON by `lib/data/mock.ts`, which keeps the mock folder small.

import type {
  ClusterCollection,
  DataStatus,
  RegionBoundaryCollection,
  WeatherSnapshot,
} from "./index";

export interface MockGrid {
  cell_size: number;
  /** South-west corner of cell (row 0, col 0): [lon, lat]. */
  origin: [number, number];
  /** Regency/city slugs, indexed by the cells. */
  kabupaten: string[];
  /** Province slug of each entry in `kabupaten`. */
  provinsi: string[];
  /** [row, col, kabupatenIndex, isGambut (0|1), NDVI × 100, hotspots within 10 km in the last 7 days] */
  cells: [number, number, number, 0 | 1, number, number][];
}

export interface MockHotspots {
  /** Date of `days[0]` (YYYY-MM-DD, WIB). */
  start: string;
  kabupaten: string[];
  provinsi: string[];
  satelit: string[];
  confidence: string[];
  /** days[i] = hotspots on `start` + i: [lon, lat, HHmm (WIB), satelitIndex, confidenceIndex, frp, kabupatenIndex] */
  days: [number, number, number, number, number, number, number][][];
}

export interface MockRisk {
  tanggal_prediksi: string;
  targets: string[];
  /** scores[targetIndex][cellIndex] = round(skor_risiko × 1000) */
  scores: number[][];
  /** cuaca[targetIndex][kabupatenIndex] = forecast [hari_tanpa_hujan, kelembapan_persen] used by the model */
  cuaca: [number, number][][];
}

export interface MockWeather {
  tanggal: string;
  /** Latest snapshot per regency/city slug. */
  data: Record<string, WeatherSnapshot>;
}

export type MockRegions = RegionBoundaryCollection;
export type MockClusters = ClusterCollection;
export type MockStatus = DataStatus;
