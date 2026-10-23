import "server-only";

import { cacheLife } from "next/cache";
import Supercluster from "supercluster";
import type { BBox, GroupedHotspotCollection, HotspotFeature, HotspotProps } from "@/types";
import { mockDataSource } from "./mock";
import { supabaseDataSource } from "./supabase";
import type {
  BoundaryQuery,
  ClusterQuery,
  DataSource,
  HotspotQuery,
  RegionStatsQuery,
  RiskQuery,
  TrendQuery,
} from "./types";

export type * from "./types";

function source(): DataSource {
  const kind = process.env.DATA_SOURCE ?? "mock";
  if (kind === "supabase") return supabaseDataSource;
  if (kind !== "mock") throw new Error(`DATA_SOURCE tidak dikenal: ${kind}`);
  return mockDataSource;
}

// Data is refreshed by the pipeline about once a day, so every read is cached for an hour.

export async function getHotspots(query: HotspotQuery) {
  "use cache";
  cacheLife("hours");
  return source().getHotspots(query);
}

export async function getClusters(query: ClusterQuery) {
  "use cache";
  cacheLife("hours");
  return source().getClusters(query);
}

export async function getRiskCells(query: RiskQuery) {
  "use cache";
  cacheLife("hours");
  return source().getRiskCells(query);
}

export async function getRegions() {
  "use cache";
  cacheLife("hours");
  return source().getRegions();
}

export async function getRegionBoundaries(query: BoundaryQuery) {
  "use cache";
  cacheLife("hours");
  return source().getRegionBoundaries(query);
}

export async function getProvinceLines() {
  "use cache";
  cacheLife("hours");
  return source().getProvinceLines();
}

export async function getRegionDetail(slug: string) {
  "use cache";
  cacheLife("hours");
  return source().getRegionDetail(slug);
}

export async function getWeather(slug: string) {
  "use cache";
  cacheLife("hours");
  return source().getWeather(slug);
}

export async function getWeatherList(provinsi?: string) {
  "use cache";
  cacheLife("hours");
  return source().getWeatherList(provinsi);
}

export async function getMonthlyTrend(query: TrendQuery) {
  "use cache";
  cacheLife("hours");
  return source().getMonthlyTrend(query);
}

export async function getRegionStats(query: RegionStatsQuery) {
  "use cache";
  cacheLife("hours");
  return source().getRegionStats(query);
}

export async function getDataStatus() {
  "use cache";
  cacheLife("hours");
  return source().getDataStatus();
}

// ---------------------------------------------------------------------------
// Hotspot groups for small map scales, computed here (same for every data source).

/** Above this zoom every hotspot stands alone. */
export const MAX_GROUP_ZOOM = 8;

export interface HotspotGroupQuery extends Omit<HotspotQuery, "bbox"> {
  zoom: number;
  bbox?: BBox;
}

type GroupIndex = Supercluster<HotspotProps, { frp_maks: number }>;
const groupIndexes = new Map<string, Promise<GroupIndex>>();
const MAX_GROUP_INDEXES = 8;

function groupIndex({ start, end, minConfidence, provinsi, kabupaten }: Omit<HotspotGroupQuery, "zoom" | "bbox">) {
  const key = [start, end, minConfidence, provinsi ?? "", kabupaten ?? ""].join("|");
  let index = groupIndexes.get(key);
  if (!index) {
    index = getHotspots({ start, end, minConfidence, provinsi, kabupaten }).then((collection) =>
      new Supercluster<HotspotProps, { frp_maks: number }>({
        radius: 56,
        maxZoom: MAX_GROUP_ZOOM,
        minPoints: 3,
        map: (props) => ({ frp_maks: props.frp }),
        reduce: (acc, props) => {
          acc.frp_maks = Math.max(acc.frp_maks, props.frp_maks);
        },
      }).load(collection.features),
    );
    index.catch(() => groupIndexes.delete(key));
    groupIndexes.set(key, index);
    // Oldest first: keep only the most recent indexes in memory.
    while (groupIndexes.size > MAX_GROUP_INDEXES) groupIndexes.delete(groupIndexes.keys().next().value!);
  }
  return index;
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

/**
 * Hotspots grouped for a zoom level: nearby hotspots become one numbered group, isolated
 * ones are returned as regular hotspot features.
 */
export async function getHotspotGroups({ zoom, bbox, ...query }: HotspotGroupQuery): Promise<GroupedHotspotCollection> {
  "use cache";
  cacheLife("hours");
  const index = await groupIndex(query);
  const features = index.getClusters(bbox ?? [-180, -85, 180, 85], Math.floor(zoom)).map((feature) => {
    if (!("cluster" in feature.properties)) return feature as unknown as HotspotFeature;
    const [lon, lat] = feature.geometry.coordinates;
    return {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [round4(lon), round4(lat)] as [number, number] },
      properties: {
        kelompok: true as const,
        id: `G${Math.floor(zoom)}-${feature.properties.cluster_id}`,
        jumlah: feature.properties.point_count,
        frp_maks: Math.round(feature.properties.frp_maks * 10) / 10,
      },
    };
  });
  return { type: "FeatureCollection", features };
}
