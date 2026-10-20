import "server-only";

import type { DataSource } from "./types";

function notImplemented(): never {
  throw new Error("Not implemented: sumber data Supabase belum tersedia");
}

export const supabaseDataSource: DataSource = {
  getHotspots: async () => notImplemented(),
  getClusters: async () => notImplemented(),
  getRiskCells: async () => notImplemented(),
  getRegions: async () => notImplemented(),
  getRegionBoundaries: async () => notImplemented(),
  getRegionDetail: async () => notImplemented(),
  getWeather: async () => notImplemented(),
  getMonthlyTrend: async () => notImplemented(),
  getRegionStats: async () => notImplemented(),
  getDataStatus: async () => notImplemented(),
};
