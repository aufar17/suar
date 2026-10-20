import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  clusterCollectionSchema,
  dataStatusSchema,
  hotspotCollectionSchema,
  monthlyTrendSchema,
  regionBoundaryCollectionSchema,
  regionDetailSchema,
  regionSchema,
  regionStatSchema,
  riskCellCollectionSchema,
  weatherSnapshotSchema,
  type BBox,
} from "@/types";
import type { DataSource } from "./types";

// Contract of every RPC, view, and table used here: docs/supabase-rpc.md

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL dan SUPABASE_ANON_KEY wajib diisi saat DATA_SOURCE=supabase");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

function bboxArgs(bbox: BBox | undefined) {
  const [min_lon, min_lat, max_lon, max_lat] = bbox ?? [null, null, null, null];
  return { min_lon, min_lat, max_lon, max_lat };
}

/** Validates a Supabase response with the same zod schema used for the mock data. */
function parse<S extends z.ZodType>(schema: S, data: unknown, source: string): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Respons ${source} tidak sesuai skema: ${issue.path.join(".")} – ${issue.message}`);
  }
  return result.data;
}

async function rpc<S extends z.ZodType>(fn: string, args: Record<string, unknown>, schema: S): Promise<z.output<S>> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw new Error(`RPC ${fn} gagal: ${error.message}`);
  return parse(schema, data, `RPC ${fn}`);
}

export const supabaseDataSource: DataSource = {
  getHotspots: ({ start, end, minConfidence, bbox }) =>
    rpc(
      "get_hotspots",
      { start_date: start, end_date: end, min_confidence: minConfidence, ...bboxArgs(bbox) },
      hotspotCollectionSchema,
    ),

  getClusters: ({ date }) => rpc("get_clusters", { target_date: date }, clusterCollectionSchema),

  getRiskCells: ({ targetDate, bbox }) =>
    rpc("get_risk_cells", { target_date: targetDate, ...bboxArgs(bbox) }, riskCellCollectionSchema),

  async getRegions() {
    const { data, error } = await supabase()
      .from("regions")
      .select("id, slug, nama, level")
      .in("level", ["kabupaten", "kota"])
      .order("nama");
    if (error) throw new Error(`Gagal membaca tabel regions: ${error.message}`);
    return parse(z.array(regionSchema), data, "tabel regions");
  },

  getRegionBoundaries: () => rpc("get_region_boundaries", {}, regionBoundaryCollectionSchema),

  getRegionDetail: (slug) => rpc("get_region_detail", { region_slug: slug }, regionDetailSchema.nullable()),

  async getWeather(slug) {
    const { data, error } = await supabase()
      .from("weather_latest")
      .select("tanggal, suhu_c, kelembapan_persen, curah_hujan_mm, kecepatan_angin_kmh, hari_tanpa_hujan")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(`Gagal membaca view weather_latest: ${error.message}`);
    return parse(weatherSnapshotSchema.nullable(), data, "view weather_latest");
  },

  getMonthlyTrend: ({ start, end, slug }) =>
    rpc(
      "get_monthly_trend",
      { start_month: start, end_month: end, region_slug: slug ?? null },
      z.array(monthlyTrendSchema),
    ),

  getRegionStats: ({ date, start, end }) =>
    rpc(
      "get_region_stats",
      { target_date: date, start_date: start ?? null, end_date: end ?? null },
      z.array(regionStatSchema),
    ),

  async getDataStatus() {
    const { data, error } = await supabase()
      .from("data_status")
      .select("terakhir_diperbarui, tanggal_data, prediksi_mulai, prediksi_sampai")
      .single();
    if (error) throw new Error(`Gagal membaca view data_status: ${error.message}`);
    return parse(dataStatusSchema, { ...data, sumber: "supabase" }, "view data_status");
  },
};
