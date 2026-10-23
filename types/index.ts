import { z } from "zod";
import {
  bboxSchema,
  featureCollectionSchema,
  featureSchema,
  multiLineStringSchema,
  multiPolygonSchema,
  pointSchema,
  polygonSchema,
  positionSchema,
} from "./geojson";

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
  ...regionRefs,
});
export type HotspotProps = z.infer<typeof hotspotPropsSchema>;

export const hotspotFeatureSchema = featureSchema(pointSchema, hotspotPropsSchema);
export type HotspotFeature = z.infer<typeof hotspotFeatureSchema>;
export const hotspotCollectionSchema = featureCollectionSchema(hotspotFeatureSchema);
export type HotspotCollection = z.infer<typeof hotspotCollectionSchema>;

/** A group of nearby hotspots, drawn as a numbered circle at small scales. */
export const hotspotGroupPropsSchema = z.object({
  kelompok: z.literal(true),
  id: z.string(),
  jumlah: z.number().int().positive(),
  frp_maks: z.number().nonnegative(),
});
export type HotspotGroupProps = z.infer<typeof hotspotGroupPropsSchema>;
export const hotspotGroupFeatureSchema = featureSchema(pointSchema, hotspotGroupPropsSchema);
export type HotspotGroupFeature = z.infer<typeof hotspotGroupFeatureSchema>;

/** Groups plus the hotspots that stand alone at the requested zoom. */
export const groupedHotspotCollectionSchema = featureCollectionSchema(
  z.union([hotspotGroupFeatureSchema, hotspotFeatureSchema]),
);
export type GroupedHotspotCollection = z.infer<typeof groupedHotspotCollectionSchema>;

export function isHotspotGroup(feature: HotspotGroupFeature | HotspotFeature): feature is HotspotGroupFeature {
  return "kelompok" in feature.properties;
}

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
  ...regionRefs,
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
  ...regionRefs,
});
export type RiskCellProps = z.infer<typeof riskCellPropsSchema>;

export const riskCellFeatureSchema = featureSchema(polygonSchema, riskCellPropsSchema);
export type RiskCellFeature = z.infer<typeof riskCellFeatureSchema>;
export const riskCellCollectionSchema = featureCollectionSchema(riskCellFeatureSchema);
export type RiskCellCollection = z.infer<typeof riskCellCollectionSchema>;

// Regions

export const REGION_LEVELS = ["provinsi", "kabupaten", "kota"] as const;
export const regionLevelSchema = z.enum(REGION_LEVELS);
export type RegionLevel = z.infer<typeof regionLevelSchema>;

/** Map and statistics tier: provinces, or regencies and cities together. */
export const BOUNDARY_TIERS = ["provinsi", "kabupaten"] as const;
export const boundaryTierSchema = z.enum(BOUNDARY_TIERS);
export type BoundaryTier = z.infer<typeof boundaryTierSchema>;

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

/** Province borders traced from the regency topology, so they match regency outlines exactly. */
export const provinceLineCollectionSchema = featureCollectionSchema(
  featureSchema(multiLineStringSchema, z.object({})),
);
export type ProvinceLineCollection = z.infer<typeof provinceLineCollectionSchema>;

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

export const CONFIDENCE_RANK: Record<Confidence, number> = {
  low: 0,
  nominal: 1,
  high: 2,
};
