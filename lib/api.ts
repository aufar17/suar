import "server-only";

import { z } from "zod";
import { getRegions } from "@/lib/data";
import { parseBBox } from "@/lib/geo";
import { BOUNDARY_TIERS, CONFIDENCE_LEVELS, type BBox } from "@/types";

export const dateParam = z.iso.date({ error: "Format tanggal harus YYYY-MM-DD" });
export const monthParam = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Format bulan harus YYYY-MM" });
export const confidenceParam = z.enum(CONFIDENCE_LEVELS, {
  error: `Nilai harus salah satu dari: ${CONFIDENCE_LEVELS.join(", ")}`,
});
export const bboxParam = z.string().transform((value, ctx) => {
  const bbox = parseBBox(value);
  if (!bbox) {
    ctx.addIssue({
      code: "custom",
      message: "Format bbox harus minLon,minLat,maxLon,maxLat dengan min < max",
    });
    return z.NEVER;
  }
  return bbox;
});
export const slugParam = z.string().regex(/^[a-z0-9-]+$/, { error: "Slug tidak valid" });
export const levelParam = z.enum(BOUNDARY_TIERS, { error: `Nilai harus salah satu dari: ${BOUNDARY_TIERS.join(", ")}` });

/** `bbox`, `provinsi`, and `kabupaten` filters shared by the spatial endpoints. */
export const areaParams = {
  bbox: bboxParam.optional(),
  provinsi: slugParam.optional(),
  kabupaten: slugParam.optional(),
};

/**
 * Checks that `provinsi`/`kabupaten` name existing regions (and that the regency lies in the
 * province). Returns an HTTP 400 response, or `null` when the filter is valid.
 */
export async function validateArea({ provinsi, kabupaten }: { provinsi?: string; kabupaten?: string }) {
  if (!provinsi && !kabupaten) return null;
  const regions = await getRegions();
  const detail: { parameter: string; pesan: string }[] = [];
  if (provinsi && !regions.some((r) => r.slug === provinsi && r.level === "provinsi")) {
    detail.push({ parameter: "provinsi", pesan: `Provinsi "${provinsi}" tidak dikenal` });
  }
  const regency = kabupaten ? regions.find((r) => r.slug === kabupaten && r.level !== "provinsi") : undefined;
  if (kabupaten && !regency) {
    detail.push({ parameter: "kabupaten", pesan: `Kabupaten/kota "${kabupaten}" tidak dikenal` });
  } else if (regency && provinsi && regency.provinsi !== provinsi) {
    detail.push({ parameter: "kabupaten", pesan: `"${kabupaten}" tidak berada di provinsi "${provinsi}"` });
  }
  return detail.length ? badRequest("Parameter tidak valid", detail) : null;
}

/** Area of a bbox in square degrees. */
export function bboxAreaDeg2([minLon, minLat, maxLon, maxLat]: BBox) {
  return (maxLon - minLon) * (maxLat - minLat);
}

export function badRequest(message: string, detail?: { parameter: string; pesan: string }[]) {
  return Response.json({ error: message, detail }, { status: 400 });
}

export function notFound(message: string) {
  return Response.json({ error: message }, { status: 404 });
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Validates URL search params with a zod schema. Invalid input becomes an HTTP 400 response. */
export function parseSearchParams<S extends z.ZodType>(request: Request, schema: S): ParseResult<z.output<S>> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = schema.safeParse(params);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    response: badRequest(
      "Parameter tidak valid",
      result.error.issues.map((issue) => ({
        parameter: issue.path.join(".") || "(query)",
        pesan: issue.message,
      })),
    ),
  };
}

/**
 * JSON response cached for data that changes about once a day: 10 minutes in the browser,
 * an hour on the CDN, then served stale for up to a day while it revalidates.
 */
export function jsonResponse(body: unknown) {
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
