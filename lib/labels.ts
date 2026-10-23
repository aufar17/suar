import type { ClusterStatus, Confidence, Region, Satellite } from "@/types";

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  low: "Rendah",
  nominal: "Nominal",
  high: "Tinggi",
};

export const SATELLITE_LABELS: Record<Satellite, string> = {
  VIIRS_SNPP: "VIIRS S-NPP",
  VIIRS_NOAA20: "VIIRS NOAA-20",
  MODIS: "MODIS",
};

export const CLUSTER_STATUS_LABELS: Record<ClusterStatus, string> = {
  baru: "Baru",
  meluas: "Meluas",
  stabil: "Stabil",
  menyusut: "Menyusut",
};

export const CLUSTER_STATUS_DESCRIPTIONS: Record<ClusterStatus, string> = {
  baru: "Muncul hari ini, belum ada hotspot di area ini dua hari sebelumnya.",
  meluas: "Jumlah hotspot bertambah dibanding kemarin.",
  stabil: "Jumlah hotspot relatif sama dengan kemarin.",
  menyusut: "Jumlah hotspot berkurang dibanding kemarin.",
};

export const FACTOR_LABELS: Record<string, string> = {
  hari_tanpa_hujan: "Hari tanpa hujan",
  kelembapan: "Kelembapan udara",
  lahan_gambut: "Jenis lahan",
  hotspot_sekitar: "Hotspot di sekitar",
  ndvi: "Kondisi vegetasi",
};

/** "Kab. Siak" / "Kota Dumai" / "Provinsi Riau" */
export function regionDisplayName(region: Pick<Region, "nama" | "level">): string {
  if (region.level === "kota") return `Kota ${region.nama}`;
  if (region.level === "kabupaten") return `Kab. ${region.nama}`;
  return `Provinsi ${region.nama}`;
}

export const REGION_LEVEL_LABELS: Record<Region["level"], string> = {
  provinsi: "Provinsi",
  kabupaten: "Kabupaten",
  kota: "Kota",
};

/** Region page: `/wilayah/riau` for a province, `/wilayah/riau/siak` for a regency or city. */
export function regionHref(region: Pick<Region, "slug" | "provinsi">): string {
  return region.provinsi ? `/wilayah/${region.provinsi}/${region.slug}` : `/wilayah/${region.slug}`;
}
