import { z } from "zod";
import { dateParam, jsonResponse, parseSearchParams } from "@/lib/api";
import { getClusters, getDataStatus } from "@/lib/data";

const querySchema = z.object({
  date: dateParam.optional(),
});

export async function GET(request: Request) {
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const date = parsed.data.date ?? (await getDataStatus()).tanggal_data;
  return jsonResponse(await getClusters({ date }));
}
