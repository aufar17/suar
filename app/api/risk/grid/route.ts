import { z } from "zod";
import { areaParams, badRequest, bboxAreaDeg2, jsonResponse, parseSearchParams, validateArea } from "@/lib/api";
import { getRiskGrid } from "@/lib/data";
import { MAX_GRID_BBOX_DEG2 } from "@/lib/geo";

const querySchema = z.object(areaParams);

/**
 * Compact 5 km grid of an area with the scores of every prediction day (`RiskGrid`): the map
 * switches days without another request. Details of one cell: `/api/risk/cell`.
 */
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
  if (bbox && !provinsi && !kabupaten && bboxAreaDeg2(bbox) > MAX_GRID_BBOX_DEG2) {
    return badRequest("Parameter tidak valid", [
      { parameter: "bbox", pesan: `Luas bbox maksimal ${MAX_GRID_BBOX_DEG2} derajat persegi` },
    ]);
  }
  const invalid = await validateArea({ provinsi, kabupaten });
  if (invalid) return invalid;

  return jsonResponse(await getRiskGrid({ bbox, provinsi, kabupaten }));
}
