import { z } from "zod";
import {
  bboxSchema,
  featureCollectionSchema,
  featureSchema,
  multiPolygonSchema,
  pointSchema,
  polygonSchema,
  positionSchema,
} from "./geojson";

import {
  BOUNDARY_TIERS,
  CLUSTER_STATUSES,
  CONFIDENCE_LEVELS,
  REGION_LEVELS,
  RISK_LEVELS,
  SATELLITES,
} from "./constants";

export * from "./constants";
export * from "./geojson";

// Shared primitives

export const isoDateSchema = z.iso.date(); // YYYY-MM-DD
export const isoMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format bulan harus YYYY-MM");
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/** Every hotspot, zone, and grid cell names the regency/city and the province it falls in (slugs). */
const regionRefs = {
  provinsi: z.string(), // province slug
  kabupaten: z.string(), // regency/city slug
};

// Hotspot

export const confidenceSchema = z.enum(CONFIDENCE_LEVELS);
export const satelliteSchema = z.enum(SATELLITES);

export const hotspotPropsSchema = z.object({
  id: z.string(),
  waktu_deteksi: isoDateTimeSchema,
  satelit: satelliteSchema,
  confidence: confidenceSchema,
  frp: z.number().nonnegative(), // Fire Radiative Power, MW
  ...regionRefs,
});
export type HotspotProps = z.infer<typeof hotspotPropsSchema>;

export const hotspotFeatureSchema = featureSchema(pointSchema, hotspotPropsSchema);
export type HotspotFeature = z.infer<typeof hotspotFeatureSchema>;
export const hotspotCollectionSchema = featureCollectionSchema(hotspotFeatureSchema);
export type HotspotCollection = z.infer<typeof hotspotCollectionSchema>;

/** Hotspot as sent to the map: only what the map draws. Details come from `/api/hotspots/[id]`. */
export const hotspotMapPropsSchema = hotspotPropsSchema.pick({ id: true, confidence: true, frp: true });
export type HotspotMapProps = z.infer<typeof hotspotMapPropsSchema>;
export const hotspotMapCollectionSchema = featureCollectionSchema(featureSchema(pointSchema, hotspotMapPropsSchema));
export type HotspotMapCollection = z.infer<typeof hotspotMapCollectionSchema>;

// Cluster (fire zone)

export const clusterStatusSchema = z.enum(CLUSTER_STATUSES);

export const clusterPropsSchema = z.object({
  id: z.string(),
  tanggal: isoDateSchema,
  jumlah_hotspot: z.number().int().nonnegative(),
  luas_km2: z.number().nonnegative(),
  status: clusterStatusSchema,
  aktif_sejak: isoDateSchema,
  ...regionRefs,
});
export type ClusterProps = z.infer<typeof clusterPropsSchema>;

export const clusterFeatureSchema = featureSchema(polygonSchema, clusterPropsSchema);
export type ClusterFeature = z.infer<typeof clusterFeatureSchema>;
export const clusterCollectionSchema = featureCollectionSchema(clusterFeatureSchema);
export type ClusterCollection = z.infer<typeof clusterCollectionSchema>;

// Risk prediction

export const riskLevelSchema = z.enum(RISK_LEVELS);

export const riskFactorSchema = z.object({
  fitur: z.string(), // e.g. "hari_tanpa_hujan"
  label: z.string(), // e.g. "18 hari tanpa hujan"
  kontribusi: z.number(), // SHAP value, positive = raises risk
});
export type RiskFactor = z.infer<typeof riskFactorSchema>;

export const riskCellPropsSchema = z.object({
  cell_id: z.string(),
  tanggal_prediksi: isoDateSchema,
  tanggal_target: isoDateSchema,
  skor_risiko: z.number().min(0).max(1),
  level_risiko: riskLevelSchema,
  is_gambut: z.boolean(),
  faktor: z.array(riskFactorSchema), // top 3 factors
  ...regionRefs,
});
export type RiskCellProps = z.infer<typeof riskCellPropsSchema>;

export const riskCellFeatureSchema = featureSchema(polygonSchema, riskCellPropsSchema);
export type RiskCellFeature = z.infer<typeof riskCellFeatureSchema>;

/**
 * One cell of the compact grid: [cell_id, min_lon, min_lat, is_gambut (0|1), index into
 * `kabupaten`, then skor_risiko × 1000 for each date in `tanggal_target`].
 */
export const riskGridCellSchema = z.tuple(
  [z.string(), z.number(), z.number(), z.union([z.literal(0), z.literal(1)]), z.number().int().nonnegative()],
  z.number().int().min(0).max(1000),
);
export type RiskGridCell = z.infer<typeof riskGridCellSchema>;

/**
 * 5 km grid of an area with the scores of every prediction day, as a compact table: square
 * cells need only a corner and a size, so the map builds the polygons itself. Switching the
 * prediction day then only changes values (feature-state), not geometry.
 */
export const riskGridSchema = z.object({
  tanggal_prediksi: isoDateSchema,
  tanggal_target: z.array(isoDateSchema),
  /** Cell edge in degrees. */
  ukuran_sel: z.number().positive(),
  /** Regency slugs referenced by the cells. */
  kabupaten: z.array(z.string()),
  sel: z.array(riskGridCellSchema),
});
export type RiskGrid = z.infer<typeof riskGridSchema>;

// Regions

export const regionLevelSchema = z.enum(REGION_LEVELS);

export const boundaryTierSchema = z.enum(BOUNDARY_TIERS);

export const regionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  nama: z.string(),
  level: regionLevelSchema,
  /** Parent province slug; `null` for provinces. */
  provinsi: z.string().nullable(),
});
export type Region = z.infer<typeof regionSchema>;

export const regionBoundaryPropsSchema = regionSchema.extend({
  /** Point inside the polygon for labels and markers: [lon, lat]. */
  label: positionSchema,
  bbox: bboxSchema,
});
export type RegionBoundaryProps = z.infer<typeof regionBoundaryPropsSchema>;

/** Search index entry: a region and its extent, without geometry. */
export const regionIndexItemSchema = regionSchema.extend({ bbox: bboxSchema });
export type RegionIndexItem = z.infer<typeof regionIndexItemSchema>;

export const regionBoundaryFeatureSchema = featureSchema(
  z.union([polygonSchema, multiPolygonSchema]),
  regionBoundaryPropsSchema,
);
export type RegionBoundaryFeature = z.infer<typeof regionBoundaryFeatureSchema>;
export const regionBoundaryCollectionSchema = featureCollectionSchema(regionBoundaryFeatureSchema);
export type RegionBoundaryCollection = z.infer<typeof regionBoundaryCollectionSchema>;

export const regionDetailSchema = regionSchema.extend({
  /** Parent province name; `null` for provinces. */
  nama_provinsi: z.string().nullable(),
  bbox: bboxSchema,
  pusat: positionSchema, // [lon, lat], inside the region
  luas_km2: z.number().nonnegative(),
  persen_gambut: z.number().min(0).max(100),
  jumlah_sel: z.number().int().nonnegative(),
  /** Regencies and cities in a province; 0 for regencies. */
  jumlah_kabupaten: z.number().int().nonnegative(),
});
export type RegionDetail = z.infer<typeof regionDetailSchema>;

// Weather

export const weatherSnapshotSchema = z.object({
  tanggal: isoDateSchema,
  suhu_c: z.number(),
  kelembapan_persen: z.number().min(0).max(100),
  curah_hujan_mm: z.number().nonnegative(),
  kecepatan_angin_kmh: z.number().nonnegative(),
  hari_tanpa_hujan: z.number().int().nonnegative(),
});
export type WeatherSnapshot = z.infer<typeof weatherSnapshotSchema>;

export const regionWeatherSchema = z.object({
  slug: z.string(),
  nama: z.string(),
  provinsi: z.string().nullable(),
  cuaca: weatherSnapshotSchema,
});
export type RegionWeather = z.infer<typeof regionWeatherSchema>;

// Statistics

export const monthlyTrendSchema = z.object({
  bulan: isoMonthSchema, // YYYY-MM
  jumlah_hotspot: z.number().int().nonnegative(),
});
export type MonthlyTrend = z.infer<typeof monthlyTrendSchema>;

/** Aggregate per province or per regency/city (choropleth, rankings, summaries). */
export const regionStatSchema = z.object({
  slug: z.string(),
  nama: z.string(),
  level: regionLevelSchema,
  provinsi: z.string().nullable(),
  jumlah_hotspot: z.number().int().nonnegative(),
  rata_skor_risiko: z.number().min(0).max(1),
  maks_skor_risiko: z.number().min(0).max(1),
  /** Grid cells with a prediction (weight for national averages). */
  jumlah_sel: z.number().int().nonnegative(),
});
export type RegionStat = z.infer<typeof regionStatSchema>;

// Data status

export const dataStatusSchema = z.object({
  terakhir_diperbarui: isoDateTimeSchema,
  /** Latest date that has observation data (hotspots, weather). */
  tanggal_data: isoDateSchema,
  /** First and last target date that has a risk prediction. */
  prediksi_mulai: isoDateSchema,
  prediksi_sampai: isoDateSchema,
  sumber: z.enum(["mock", "supabase"]),
});
export type DataStatus = z.infer<typeof dataStatusSchema>;
