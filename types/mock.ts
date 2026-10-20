// On-disk formats of the files in `mock/`. Large datasets are stored compactly and
// expanded to GeoJSON by `lib/data/mock.ts`, which keeps the mock folder small.

import type { DataStatus, RegionBoundaryCollection, ClusterCollection, WeatherSnapshot } from "./index";

export interface MockGrid {
  cell_size: number;
  /** South-west corner of cell (row 0, col 0): [lon, lat]. */
  origin: [number, number];
  kabupaten: string[];
  /** [row, col, kabupatenIndex, isGambut (0|1)] */
  cells: [number, number, number, 0 | 1][];
}

export interface MockHotspots {
  kabupaten: string[];
  satelit: string[];
  confidence: string[];
  /** [lon, lat, "YYYY-MM-DDTHH:mm" (WIB), satelitIndex, confidenceIndex, frp, kabupatenIndex] */
  rows: [number, number, string, number, number, number, number][];
}

export interface MockRisk {
  tanggal_prediksi: string;
  targets: string[];
  fitur: string[];
  /** scores[targetIndex][cellIndex] */
  scores: number[][];
  /** factors[targetIndex][cellIndex] = [[fiturIndex, kontribusi, label], ...] (top 3) */
  factors: [number, number, string][][][];
}

export interface MockWeather {
  tanggal: string;
  data: Record<string, WeatherSnapshot>;
}

export type MockRegions = RegionBoundaryCollection;
export type MockClusters = ClusterCollection;
export type MockStatus = DataStatus;
