import { z } from "zod";
import { jsonResponse, notFound, parseSearchParams, slugParam, validateArea } from "@/lib/api";
import { getRegions, getWeather, getWeatherList } from "@/lib/data";
import type { RegionWeather } from "@/types";

const querySchema = z.object({
  slug: slugParam.optional(),
  provinsi: slugParam.optional(),
});

/**
 * Latest weather snapshot per regency/city (optionally of one province). `slug` returns one
 * region; for a province that is the mean of its regencies.
 */
export async function GET(request: Request) {
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { slug, provinsi } = parsed.data;
  const invalid = await validateArea({ provinsi });
  if (invalid) return invalid;

  if (!slug) return jsonResponse(await getWeatherList(provinsi));

  const region = (await getRegions()).find((r) => r.slug === slug);
  if (!region) return notFound(`Wilayah "${slug}" tidak dikenal`);
  const cuaca = await getWeather(slug);
  const items: RegionWeather[] = cuaca ? [{ slug, nama: region.nama, provinsi: region.provinsi, cuaca }] : [];
  return jsonResponse(items);
}
