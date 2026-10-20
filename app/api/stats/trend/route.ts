import { z } from "zod";
import { badRequest, jsonResponse, monthParam, parseSearchParams, slugParam } from "@/lib/api";
import { getDataStatus, getMonthlyTrend, getRegions } from "@/lib/data";

const MAX_MONTHS = 60;

const querySchema = z.object({
  start: monthParam.optional(),
  end: monthParam.optional(),
  slug: slugParam.optional(),
});

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function monthsBetween(start: string, end: string): number {
  const [y1, m1] = start.split("-").map(Number);
  const [y2, m2] = end.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1) + 1;
}

export async function GET(request: Request) {
  const parsed = parseSearchParams(request, querySchema);
  if (!parsed.ok) return parsed.response;
  const { slug } = parsed.data;

  const status = await getDataStatus();
  const end = parsed.data.end ?? status.tanggal_data.slice(0, 7);
  const start = parsed.data.start ?? shiftMonth(end, -23);

  if (start > end) {
    return badRequest("Parameter tidak valid", [{ parameter: "start", pesan: "start harus sebelum atau sama dengan end" }]);
  }
  if (monthsBetween(start, end) > MAX_MONTHS) {
    return badRequest("Parameter tidak valid", [{ parameter: "end", pesan: `Rentang maksimal ${MAX_MONTHS} bulan` }]);
  }
  if (slug && !(await getRegions()).some((r) => r.slug === slug)) {
    return badRequest("Parameter tidak valid", [{ parameter: "slug", pesan: `Wilayah "${slug}" tidak dikenal` }]);
  }

  return jsonResponse(await getMonthlyTrend({ start, end, slug }));
}
