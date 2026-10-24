import "server-only";

import type {
  BBox,
  BoundaryTier,
  ClusterCollection,
  Confidence,
  DataStatus,
  HotspotCollection,
  HotspotFeature,
  MonthlyTrend,
  Region,
  RegionBoundaryCollection,
  RegionDetail,
  RegionStat,
  RegionWeather,
  RiskCellFeature,
  RiskGrid,
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
  /** One hotspot with all its properties, or null when the id is unknown. */
  getHotspot(id: string): Promise<HotspotFeature | null>;
  getClusters(query: ClusterQuery): Promise<ClusterCollection>;
  /** Compact 5 km grid of an area with the scores of every prediction day (see `RiskGrid`). */
  getRiskGrid(query: AreaFilter): Promise<RiskGrid>;
  /** One grid cell and its prediction (with factors) for a target date, or null. */
  getRiskCell(cellId: string, targetDate: string): Promise<RiskCellFeature | null>;
  /** Every province, regency, and city, sorted by name. */
  getRegions(): Promise<Region[]>;
  /** Boundaries with properties (the browser map draws the static files in `public/geo/`). */
  getRegionBoundaries(query: BoundaryQuery): Promise<RegionBoundaryCollection>;
  getRegionDetail(slug: string): Promise<RegionDetail | null>;
  /** Latest weather of a regency/city, or the mean of its regencies for a province. */
  getWeather(slug: string): Promise<WeatherSnapshot | null>;
  /** Latest weather of every regency/city, optionally of one province. */
  getWeatherList(provinsi?: string): Promise<RegionWeather[]>;
  getMonthlyTrend(query: TrendQuery): Promise<MonthlyTrend[]>;
  getRegionStats(query: RegionStatsQuery): Promise<RegionStat[]>;
  getDataStatus(): Promise<DataStatus>;
}
