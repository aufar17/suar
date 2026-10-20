import { z } from "zod";
import { bboxParam, dateParam, jsonResponse, parseSearchParams } from "@/lib/api";
import { getDataStatus, getRiskCells } from "@/lib/data";

const querySchema = z.object({
  target_date: dateParam.optional(),
  bbox: bboxParam.optional(),
});

export async function GET(request: Request) {
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const targetDate = parsed.data.target_date ?? (await getDataStatus()).prediksi_mulai;
  return jsonResponse(await getRiskCells({ targetDate, bbox: parsed.data.bbox }));
}
