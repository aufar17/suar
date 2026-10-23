import { jsonResponse } from "@/lib/api";
import { getRegionBoundaries } from "@/lib/data";
import type { RegionIndexItem } from "@/types";

/** Every province, regency, and city with its extent (search and "zoom to region"), without geometry. */
export async function GET() {
  const [provinces, regencies] = await Promise.all([
    getRegionBoundaries({ level: "provinsi" }),
    getRegionBoundaries({ level: "kabupaten" }),
  ]);
  const items: RegionIndexItem[] = [...provinces.features, ...regencies.features]
    .map(({ properties: { id, slug, nama, level, provinsi, bbox } }) => ({ id, slug, nama, level, provinsi, bbox }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  return jsonResponse(items);
}
