// Enumerations shared by the zod schemas (types/index.ts) and the UI. Kept free of zod so
// client components can import them without bundling the schemas.

export const CONFIDENCE_LEVELS = ["low", "nominal", "high"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const CONFIDENCE_RANK: Record<Confidence, number> = {
  low: 0,
  nominal: 1,
  high: 2,
};

export const SATELLITES = ["VIIRS_SNPP", "VIIRS_NOAA20", "VIIRS_NOAA21", "MODIS"] as const;
export type Satellite = (typeof SATELLITES)[number];

export const CLUSTER_STATUSES = ["baru", "meluas", "stabil", "menyusut"] as const;
export type ClusterStatus = (typeof CLUSTER_STATUSES)[number];

export const RISK_LEVELS = ["rendah", "sedang", "tinggi", "sangat_tinggi"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const REGION_LEVELS = ["provinsi", "kabupaten", "kota"] as const;
export type RegionLevel = (typeof REGION_LEVELS)[number];

/** Map and statistics tier: provinces, or regencies and cities together. */
export const BOUNDARY_TIERS = ["provinsi", "kabupaten"] as const;
export type BoundaryTier = (typeof BOUNDARY_TIERS)[number];
