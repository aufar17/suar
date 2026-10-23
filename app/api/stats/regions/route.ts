import { z } from "zod";
import {
  badRequest,
  confidenceParam,
  dateParam,
  jsonResponse,
  levelParam,
  parseSearchParams,
  slugParam,
  validateArea,
} from "@/lib/api";
import { getDataStatus, getRegionStats } from "@/lib/data";

const querySchema = z.object({
  date: dateParam.optional(),
  start: dateParam.optional(),
  end: dateParam.optional(),
  level: levelParam.default("kabupaten"),
  provinsi: slugParam.optional(),
  min_confidence: confidenceParam.default("low"),
});

/**
 * Aggregates per province or per regency/city: hotspot count in the window, and the mean
 * and maximum risk score for `date`. Used for the choropleth, rankings, and summaries.
 */
export async function GET(request: Request) {
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { start, end, level, provinsi, min_confidence } = parsed.data;
  if (start && end && start > end) {
    return badRequest("Parameter tidak valid", [{ parameter: "start", pesan: "start harus sebelum atau sama dengan end" }]);
  }
  const invalid = await validateArea({ provinsi });
  if (invalid) return invalid;
  const date = parsed.data.date ?? (await getDataStatus()).prediksi_mulai;
  return jsonResponse(await getRegionStats({ date, start, end, level, provinsi, minConfidence: min_confidence }));
}
