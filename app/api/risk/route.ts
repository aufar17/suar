import { z } from "zod";
import { areaParams, badRequest, bboxAreaDeg2, dateParam, jsonResponse, parseSearchParams, validateArea } from "@/lib/api";
import { getDataStatus, getRiskCells } from "@/lib/data";

/** About 12,000 cells of 5 km; larger views use the per-region averages (`/api/stats/regions`). */
const MAX_BBOX_DEG2 = 25;

const querySchema = z.object({
  target_date: dateParam.optional(),
  ...areaParams,
});

export async function GET(request: Request) {
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { bbox, provinsi, kabupaten } = parsed.data;

  // The national grid has ~76,000 cells, so the area must be narrowed down.
  if (!bbox && !provinsi && !kabupaten) {
    return badRequest("Parameter tidak valid", [
      { parameter: "bbox", pesan: "Isi salah satu dari bbox, provinsi, atau kabupaten" },
    ]);
  }
  if (bbox && !provinsi && !kabupaten && bboxAreaDeg2(bbox) > MAX_BBOX_DEG2) {
    return badRequest("Parameter tidak valid", [
      { parameter: "bbox", pesan: `Luas bbox maksimal ${MAX_BBOX_DEG2} derajat persegi` },
    ]);
  }
  const invalid = await validateArea({ provinsi, kabupaten });
  if (invalid) return invalid;

  const targetDate = parsed.data.target_date ?? (await getDataStatus()).prediksi_mulai;
  return jsonResponse(await getRiskCells({ targetDate, bbox, provinsi, kabupaten }));
}
