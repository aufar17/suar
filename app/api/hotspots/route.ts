import { z } from "zod";
import { areaParams, badRequest, confidenceParam, dateParam, jsonResponse, parseSearchParams, validateArea } from "@/lib/api";
import { getDataStatus, getHotspots } from "@/lib/data";
import { diffDaysIso } from "@/lib/format";
import { round4 } from "@/lib/geo";
import type { HotspotMapCollection } from "@/types";

const MAX_RANGE_DAYS = 31;

const querySchema = z.object({
  start: dateParam.optional(),
  end: dateParam.optional(),
  min_confidence: confidenceParam.default("low"),
  ...areaParams,
});

/**
 * Hotspots for the map: only `id`, `confidence`, and `frp`, coordinates rounded to 4 decimals
 * (≈ 11 m). Every other property comes from `/api/hotspots/[id]` when a hotspot is clicked.
 */
export async function GET(request: Request) {
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { min_confidence, bbox, provinsi, kabupaten } = parsed.data;

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

  const hotspots = await getHotspots({ start, end, minConfidence: min_confidence, bbox, provinsi, kabupaten });
  const body: HotspotMapCollection = {
    type: "FeatureCollection",
    features: hotspots.features.map(({ geometry, properties: { id, confidence, frp } }) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [round4(geometry.coordinates[0]), round4(geometry.coordinates[1])] },
      properties: { id, confidence, frp },
    })),
  };
  return jsonResponse(body);
}
