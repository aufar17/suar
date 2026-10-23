import { z } from "zod";
import {
  areaParams,
  badRequest,
  confidenceParam,
  dateParam,
  jsonResponse,
  parseSearchParams,
  validateArea,
  zoomParam,
} from "@/lib/api";
import { getDataStatus, getHotspotGroups } from "@/lib/data";
import { diffDaysIso } from "@/lib/format";

const MAX_RANGE_DAYS = 31;

const querySchema = z.object({
  start: dateParam.optional(),
  end: dateParam.optional(),
  min_confidence: confidenceParam.default("low"),
  zoom: zoomParam,
  ...areaParams,
});

/**
 * Hotspots grouped for one map zoom level: nearby hotspots become a numbered group
 * (`properties.kelompok = true`), isolated ones are regular hotspot features.
 */
export async function GET(request: Request) {
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { min_confidence, zoom, bbox, provinsi, kabupaten } = parsed.data;

  const status = await getDataStatus();
  const end = parsed.data.end ?? parsed.data.start ?? status.tanggal_data;
  const start = parsed.data.start ?? end;
  if (start > end) {
    return badRequest("Parameter tidak valid", [{ parameter: "start", pesan: "start harus sebelum atau sama dengan end" }]);
  }
  if (diffDaysIso(end, start) + 1 > MAX_RANGE_DAYS) {
    return badRequest("Parameter tidak valid", [
      { parameter: "end", pesan: `Rentang tanggal maksimal ${MAX_RANGE_DAYS} hari per permintaan` },
    ]);
  }
  const invalid = await validateArea({ provinsi, kabupaten });
  if (invalid) return invalid;

  return jsonResponse(
    await getHotspotGroups({ start, end, minConfidence: min_confidence, zoom, bbox, provinsi, kabupaten }),
  );
}
