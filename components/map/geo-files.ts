// Static boundary files written by `pnpm geo:build` into public/geo/. The map's worker loads
// them directly (no route handler, no parsing on the main thread) and the browser caches them
// (Cache-Control in next.config.ts). Bump the version after rebuilding the boundaries.
const VERSION = "1";

const file = (name: string) => `/geo/${name}.json?v=${VERSION}`;

export const GEO_FILES = {
  /** Provinces, coarsest (drawn below zoom 6). */
  provinsi: file("provinsi"),
  /** Regencies and cities (zoom ≥ 6, region pages). */
  kabupaten: file("kabupaten"),
  /** Province borders that line up with the regency outlines. */
  provinsiGaris: file("provinsi-garis"),
  labelProvinsi: file("label-provinsi"),
  labelKabupaten: file("label-kabupaten"),
} as const;
