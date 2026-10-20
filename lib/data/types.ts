import "server-only";

import type {
  BBox,
  ClusterCollection,
  Confidence,
  DataStatus,
  HotspotCollection,
  MonthlyTrend,
  Region,
  RegionBoundaryCollection,
  RegionDetail,
  RegionStat,
  RiskCellCollection,
  WeatherSnapshot,
} from "@/types";

export interface HotspotQuery {
  /** YYYY-MM-DD, inclusive */
  start: string;
  /** YYYY-MM-DD, inclusive */
  end: string;
  minConfidence: Confidence;
  bbox?: BBox;
}

export interface ClusterQuery {
  date: string;
}

export interface RiskQuery {
  targetDate: string;
  bbox?: BBox;
}

export interface TrendQuery {
  /** YYYY-MM, inclusive */
  start: string;
  /** YYYY-MM, inclusive */
  end: string;
  slug?: string;
}

export interface RegionStatsQuery {
  /** Target date used for the average risk score. */
  date: string;
  /** Hotspot counting window (YYYY-MM-DD, inclusive). Defaults to the 30 days up to the latest data date. */
  start?: string;
  end?: string;
}

export interface DataSource {
  getHotspots(query: HotspotQuery): Promise<HotspotCollection>;
  getClusters(query: ClusterQuery): Promise<ClusterCollection>;
  getRiskCells(query: RiskQuery): Promise<RiskCellCollection>;
  getRegions(): Promise<Region[]>;
  getRegionBoundaries(): Promise<RegionBoundaryCollection>;
  getRegionDetail(slug: string): Promise<RegionDetail | null>;
  getWeather(slug: string): Promise<WeatherSnapshot | null>;
  getMonthlyTrend(query: TrendQuery): Promise<MonthlyTrend[]>;
  getRegionStats(query: RegionStatsQuery): Promise<RegionStat[]>;
  getDataStatus(): Promise<DataStatus>;
}
