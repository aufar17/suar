import "server-only";

import { z } from "zod";
import { parseBBox } from "@/lib/geo";
import { CONFIDENCE_LEVELS } from "@/types";

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

/** Response with JSON body and CDN caching suited for data that changes about once a day. */
export function jsonResponse(body: unknown) {
  return Response.json(body, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
