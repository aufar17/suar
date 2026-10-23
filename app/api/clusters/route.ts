import { z } from "zod";
import { areaParams, dateParam, jsonResponse, parseSearchParams, validateArea } from "@/lib/api";
import { getClusters, getDataStatus } from "@/lib/data";

const querySchema = z.object({
  date: dateParam.optional(),
  ...areaParams,
});

export async function GET(request: Request) {
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { bbox, provinsi, kabupaten } = parsed.data;
  const invalid = await validateArea({ provinsi, kabupaten });
  if (invalid) return invalid;
  const date = parsed.data.date ?? (await getDataStatus()).tanggal_data;
  return jsonResponse(await getClusters({ date, bbox, provinsi, kabupaten }));
}
