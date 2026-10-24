import { z } from "zod";
import { dateParam, jsonResponse, notFound, parseSearchParams } from "@/lib/api";
import { getDataStatus, getRiskCell } from "@/lib/data";

const querySchema = z.object({
  cell_id: z.string().regex(/^[A-Za-z0-9_-]+$/, { error: "cell_id tidak valid" }),
  target_date: dateParam.optional(),
});

/** One grid cell with its prediction for a target date, including the top factors (detail panel). */
export async function GET(request: Request) {
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const targetDate = parsed.data.target_date ?? (await getDataStatus()).prediksi_mulai;
  const cell = await getRiskCell(parsed.data.cell_id, targetDate);
  if (!cell) return notFound(`Kotak "${parsed.data.cell_id}" tidak punya prediksi untuk ${targetDate}`);
  return jsonResponse(cell);
}
