import { z } from "zod";
import {
  featureCollectionSchema,
  featureSchema,
  multiPolygonSchema,
  pointSchema,
  polygonSchema,
} from "./geojson";

export * from "./geojson";

// Shared primitives

export const isoDateSchema = z.iso.date(); // YYYY-MM-DD
export const isoMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format bulan harus YYYY-MM");
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

// Hotspot

export const CONFIDENCE_LEVELS = ["low", "nominal", "high"] as const;
export const confidenceSchema = z.enum(CONFIDENCE_LEVELS);
export type Confidence = z.infer<typeof confidenceSchema>;

export const SATELLITES = ["VIIRS_SNPP", "VIIRS_NOAA20", "MODIS"] as const;
export const satelliteSchema = z.enum(SATELLITES);
export type Satellite = z.infer<typeof satelliteSchema>;

export const hotspotPropsSchema = z.object({
  id: z.string(),
  waktu_deteksi: isoDateTimeSchema,
  satelit: satelliteSchema,
  confidence: confidenceSchema,
  frp: z.number().nonnegative(), // Fire Radiative Power, MW
  kabupaten: z.string(), // slug
});
export type HotspotProps = z.infer<typeof hotspotPropsSchema>;

export const hotspotFeatureSchema = featureSchema(pointSchema, hotspotPropsSchema);
export type HotspotFeature = z.infer<typeof hotspotFeatureSchema>;
export const hotspotCollectionSchema = featureCollectionSchema(hotspotFeatureSchema);
export type HotspotCollection = z.infer<typeof hotspotCollectionSchema>;

// Cluster (fire zone)

export const CLUSTER_STATUSES = ["baru", "meluas", "stabil", "menyusut"] as const;
export const clusterStatusSchema = z.enum(CLUSTER_STATUSES);
export type ClusterStatus = z.infer<typeof clusterStatusSchema>;

export const clusterPropsSchema = z.object({
  id: z.string(),
  tanggal: isoDateSchema,
  jumlah_hotspot: z.number().int().nonnegative(),
  luas_km2: z.number().nonnegative(),
  status: clusterStatusSchema,
  aktif_sejak: isoDateSchema,
  kabupaten: z.string(),
});
export type ClusterProps = z.infer<typeof clusterPropsSchema>;

export const clusterFeatureSchema = featureSchema(polygonSchema, clusterPropsSchema);
export type ClusterFeature = z.infer<typeof clusterFeatureSchema>;
export const clusterCollectionSchema = featureCollectionSchema(clusterFeatureSchema);
export type ClusterCollection = z.infer<typeof clusterCollectionSchema>;

// Risk prediction

export const RISK_LEVELS = ["rendah", "sedang", "tinggi", "sangat_tinggi"] as const;
export const riskLevelSchema = z.enum(RISK_LEVELS);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

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
  kabupaten: z.string(),
});
export type RiskCellProps = z.infer<typeof riskCellPropsSchema>;

export const riskCellFeatureSchema = featureSchema(polygonSchema, riskCellPropsSchema);
export type RiskCellFeature = z.infer<typeof riskCellFeatureSchema>;
export const riskCellCollectionSchema = featureCollectionSchema(riskCellFeatureSchema);
export type RiskCellCollection = z.infer<typeof riskCellCollectionSchema>;

// Regions

export const REGION_LEVELS = ["provinsi", "kabupaten", "kota"] as const;

export const regionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  nama: z.string(),
  level: z.enum(REGION_LEVELS),
});
export type Region = z.infer<typeof regionSchema>;

export const regionBoundaryFeatureSchema = featureSchema(
  z.union([polygonSchema, multiPolygonSchema]),
  regionSchema,
);
export type RegionBoundaryFeature = z.infer<typeof regionBoundaryFeatureSchema>;
export const regionBoundaryCollectionSchema = featureCollectionSchema(
  regionBoundaryFeatureSchema,
);
export type RegionBoundaryCollection = z.infer<typeof regionBoundaryCollectionSchema>;

export const regionDetailSchema = regionSchema.extend({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  pusat: z.tuple([z.number(), z.number()]), // [lon, lat]
  luas_km2: z.number().nonnegative(),
  persen_gambut: z.number().min(0).max(100),
  jumlah_sel: z.number().int().nonnegative(),
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
  cuaca: weatherSnapshotSchema,
});
export type RegionWeather = z.infer<typeof regionWeatherSchema>;

// Statistics

export const monthlyTrendSchema = z.object({
  bulan: isoMonthSchema, // YYYY-MM
  jumlah_hotspot: z.number().int().nonnegative(),
});
export type MonthlyTrend = z.infer<typeof monthlyTrendSchema>;

export const regionStatSchema = z.object({
  slug: z.string(),
  nama: z.string(),
  jumlah_hotspot: z.number().int().nonnegative(),
  rata_skor_risiko: z.number().min(0).max(1),
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

export const CONFIDENCE_RANK: Record<Confidence, number> = {
  low: 0,
  nominal: 1,
  high: 2,
};
