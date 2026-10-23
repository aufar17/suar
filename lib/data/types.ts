import "server-only";

import type {
  BBox,
  BoundaryTier,
  ClusterCollection,
  Confidence,
  DataStatus,
  HotspotCollection,
  MonthlyTrend,
  ProvinceLineCollection,
  Region,
  RegionBoundaryCollection,
  RegionDetail,
  RegionStat,
  RegionWeather,
  RiskCellCollection,
  WeatherSnapshot,
} from "@/types";

/** Optional spatial and administrative filters (combined with AND). */
export interface AreaFilter {
  bbox?: BBox;
  /** Province slug. */
  provinsi?: string;
  /** Regency/city slug. */
  kabupaten?: string;
}

export interface HotspotQuery extends AreaFilter {
  /** YYYY-MM-DD, inclusive */
  start: string;
  /** YYYY-MM-DD, inclusive */
  end: string;
  minConfidence: Confidence;
}

export interface ClusterQuery extends AreaFilter {
  date: string;
}

export interface RiskQuery extends AreaFilter {
  targetDate: string;
}

export interface TrendQuery {
  /** YYYY-MM, inclusive */
  start: string;
  /** YYYY-MM, inclusive */
  end: string;
  /** Province or regency/city slug; omitted = all of Indonesia. */
  slug?: string;
}

export interface BoundaryQuery {
  level: BoundaryTier;
  /** Only the regencies/cities of this province (with `level: "kabupaten"`). */
  provinsi?: string;
}

export interface RegionStatsQuery {
  /** Target date used for the mean and maximum risk score. */
  date: string;
  /** Hotspot counting window (YYYY-MM-DD, inclusive). Defaults to the 30 days up to the latest data date. */
  start?: string;
  end?: string;
  /** One row per province, or per regency/city. */
  level: BoundaryTier;
  /** Only the regencies/cities of this province (with `level: "kabupaten"`). */
  provinsi?: string;
  /** Minimum hotspot confidence counted (default `low` = all). */
  minConfidence?: Confidence;
}

export interface DataSource {
  getHotspots(query: HotspotQuery): Promise<HotspotCollection>;
  getClusters(query: ClusterQuery): Promise<ClusterCollection>;
  getRiskCells(query: RiskQuery): Promise<RiskCellCollection>;
  /** Every province, regency, and city, sorted by name. */
  getRegions(): Promise<Region[]>;
  getRegionBoundaries(query: BoundaryQuery): Promise<RegionBoundaryCollection>;
  getProvinceLines(): Promise<ProvinceLineCollection>;
  getRegionDetail(slug: string): Promise<RegionDetail | null>;
  /** Latest weather of a regency/city, or the mean of its regencies for a province. */
  getWeather(slug: string): Promise<WeatherSnapshot | null>;
  /** Latest weather of every regency/city, optionally of one province. */
  getWeatherList(provinsi?: string): Promise<RegionWeather[]>;
  getMonthlyTrend(query: TrendQuery): Promise<MonthlyTrend[]>;
  getRegionStats(query: RegionStatsQuery): Promise<RegionStat[]>;
  getDataStatus(): Promise<DataStatus>;
}
