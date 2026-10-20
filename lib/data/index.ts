import "server-only";

import { cacheLife } from "next/cache";
import { mockDataSource } from "./mock";
import { supabaseDataSource } from "./supabase";
import type {
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

export async function getRegionBoundaries() {
  "use cache";
  cacheLife("hours");
  return source().getRegionBoundaries();
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
