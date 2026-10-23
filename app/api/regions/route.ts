import { z } from "zod";
import { jsonResponse, levelParam, parseSearchParams, slugParam, validateArea } from "@/lib/api";
import { getRegionBoundaries } from "@/lib/data";

const querySchema = z.object({
  level: levelParam.default("provinsi"),
  provinsi: slugParam.optional(),
});

/** Region boundaries: provinces (default) or regencies/cities, optionally of one province. */
export async function GET(request: Request) {
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { level, provinsi } = parsed.data;
  const invalid = await validateArea({ provinsi });
  if (invalid) return invalid;
  return jsonResponse(await getRegionBoundaries({ level, provinsi }));
}
