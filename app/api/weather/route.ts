import { z } from "zod";
import { jsonResponse, notFound, parseSearchParams, slugParam } from "@/lib/api";
import { getRegions, getWeather } from "@/lib/data";
import type { RegionWeather } from "@/types";

const querySchema = z.object({
  slug: slugParam.optional(),
});

/** Latest weather snapshot per region; `slug` narrows it to one region. */
export async function GET(request: Request) {
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { slug } = parsed.data;

  const regions = (await getRegions()).filter((r) => !slug || r.slug === slug);
  if (slug && regions.length === 0) return notFound(`Wilayah "${slug}" tidak dikenal`);

  const items: RegionWeather[] = [];
  for (const region of regions) {
    const cuaca = await getWeather(region.slug);
    if (cuaca) items.push({ slug: region.slug, nama: region.nama, cuaca });
  }
  return jsonResponse(items);
}
