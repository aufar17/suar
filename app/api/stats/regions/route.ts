import { z } from "zod";
import { badRequest, dateParam, jsonResponse, parseSearchParams } from "@/lib/api";
import { getDataStatus, getRegionStats } from "@/lib/data";

const querySchema = z.object({
  date: dateParam.optional(),
  start: dateParam.optional(),
  end: dateParam.optional(),
});

export async function GET(request: Request) {
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { start, end } = parsed.data;
  if (start && end && start > end) {
    return badRequest("Parameter tidak valid", [{ parameter: "start", pesan: "start harus sebelum atau sama dengan end" }]);
  }
  const date = parsed.data.date ?? (await getDataStatus()).prediksi_mulai;
  return jsonResponse(await getRegionStats({ date, start, end }));
}
