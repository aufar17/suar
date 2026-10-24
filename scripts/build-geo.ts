/**
 * Builds the Indonesian administrative boundaries used by the map and the mock data.
 *
 *   pnpm geo:build
 *
 * Source: geoBoundaries gbOpen IDN (simplified release) – ADM1 (provinces, OSM, ODbL) and
 * ADM2 (regencies/cities, BPS/OCHA, CC BY 3.0 IGO). Raw files are downloaded to `data-raw/`
 * (git-ignored) and processed with mapshaper in two levels of detail:
 *
 *   mock/kabupaten.geojson      regencies/cities, clean topology (no gaps or overlaps), for the server
 *   mock/provinsi.geojson       provinces, dissolved from the regencies, for the server
 *
 *   public/geo/kabupaten.json        browser map (zoom ≥ 6): simplified further, < 1.5 MB
 *   public/geo/provinsi.json         browser map (zoom < 6): coarsest, < 250 KB
 *   public/geo/provinsi-garis.json   province borders from the browser regency topology, so they
 *                                    line up with the regency outlines at closer zoom levels
 *   public/geo/label-provinsi.json   label points (one per region, inside its polygon)
 *   public/geo/label-kabupaten.json
 *
 * The browser files are static (cached by the browser, loaded by the map's worker) and carry
 * only `slug`, `nama`, `level`, and `provinsi`.
 *
 * Provinces are dissolved from the regencies (each regency is assigned to the ADM1 province
 * that contains its interior point), so both levels always nest exactly.
 */
import fs from "node:fs";
import path from "node:path";
import mapshaper from "mapshaper";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "data-raw");
const OUT_DIR = path.join(ROOT, "mock");
const WEB_DIR = path.join(ROOT, "public", "geo");

const SOURCES = {
  adm1: "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IDN/ADM1/geoBoundaries-IDN-ADM1_simplified.geojson",
  adm2: "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2_simplified.geojson",
} as const;

/** ISO 3166-2 suffix → BPS province code and Indonesian name. */
const PROVINCES: Record<string, { code: string; nama: string }> = {
  AC: { code: "11", nama: "Aceh" },
  SU: { code: "12", nama: "Sumatera Utara" },
  SB: { code: "13", nama: "Sumatera Barat" },
  RI: { code: "14", nama: "Riau" },
  JA: { code: "15", nama: "Jambi" },
  SS: { code: "16", nama: "Sumatera Selatan" },
  BE: { code: "17", nama: "Bengkulu" },
  LA: { code: "18", nama: "Lampung" },
  BB: { code: "19", nama: "Kepulauan Bangka Belitung" },
  KR: { code: "21", nama: "Kepulauan Riau" },
  JK: { code: "31", nama: "DKI Jakarta" },
  JB: { code: "32", nama: "Jawa Barat" },
  JT: { code: "33", nama: "Jawa Tengah" },
  YO: { code: "34", nama: "DI Yogyakarta" },
  JI: { code: "35", nama: "Jawa Timur" },
  BT: { code: "36", nama: "Banten" },
  BA: { code: "51", nama: "Bali" },
  NB: { code: "52", nama: "Nusa Tenggara Barat" },
  NT: { code: "53", nama: "Nusa Tenggara Timur" },
  KB: { code: "61", nama: "Kalimantan Barat" },
  KT: { code: "62", nama: "Kalimantan Tengah" },
  KS: { code: "63", nama: "Kalimantan Selatan" },
  KI: { code: "64", nama: "Kalimantan Timur" },
  KU: { code: "65", nama: "Kalimantan Utara" },
  SA: { code: "71", nama: "Sulawesi Utara" },
  ST: { code: "72", nama: "Sulawesi Tengah" },
  SN: { code: "73", nama: "Sulawesi Selatan" },
  SG: { code: "74", nama: "Sulawesi Tenggara" },
  GO: { code: "75", nama: "Gorontalo" },
  SR: { code: "76", nama: "Sulawesi Barat" },
  MA: { code: "81", nama: "Maluku" },
  MU: { code: "82", nama: "Maluku Utara" },
  PB: { code: "91", nama: "Papua Barat" },
  PA: { code: "94", nama: "Papua" },
};

/** ADM2 features that are not administrative units (lakes, reservoirs, forest). */
const NON_ADMIN = new Set(["Danau", "Danau Toba", "Hutan", "Waduk Cirata", "Wadung Kedungombo"]);

/** Source names that are wrong or misleading. "Kota Baru" is the regency Kotabaru, not a city. */
const NAME_FIXES: Record<string, { nama: string; level: "kabupaten" | "kota" }> = {
  "Kota Baru": { nama: "Kotabaru", level: "kabupaten" },
  "Pangkajene Dan Kepulauan": { nama: "Pangkajene dan Kepulauan", level: "kabupaten" },
};

/** Regencies whose province cannot be derived from the ADM1 geometry (no overlap, nearest is wrong). */
const PARENT_FIXES: Record<string, string> = { "Kepulauan Seribu": "ID-JK" };

// Size targets for the browser: provinces < 400 KB, regencies < 2.5 MB.
const KABUPATEN = { simplify: "30%", minIslandKm2: 1 };
const PROVINSI = { simplify: "30%", minIsland: "12km2" };
const PRECISION = "0.00001";
// Browser files: simplified again (percent of the server vertices kept), 4 decimals (≈ 11 m).
const WEB = {
  kabupaten: { simplify: "55%", maxKb: 1500 },
  provinsi: { simplify: "35%", minIsland: "40km2", maxKb: 250 },
  precision: "0.0001",
};

type Position = [number, number];
type Ring = Position[];
interface RawFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
}
interface Collection<F = RawFeature> {
  type: "FeatureCollection";
  features: F[];
}

async function download(name: keyof typeof SOURCES): Promise<string> {
  const file = path.join(RAW_DIR, `${name}.geojson`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
    console.log(`Mengunduh ${SOURCES[name]}`);
    const response = await fetch(SOURCES[name]);
    if (!response.ok) throw new Error(`Gagal mengunduh ${name}: HTTP ${response.status}`);
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  return file;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function polygons(geometry: RawFeature["geometry"]): Ring[][] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function pointInRing([x, y]: Position, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInFeature(point: Position, feature: RawFeature): boolean {
  return polygons(feature.geometry).some(
    ([outer, ...holes]) => pointInRing(point, outer) && !holes.some((hole) => pointInRing(point, hole)),
  );
}

function nearestDistance([x, y]: Position, feature: RawFeature): number {
  let best = Infinity;
  for (const polygon of polygons(feature.geometry)) {
    for (const [px, py] of polygon[0]) best = Math.min(best, (px - x) ** 2 + (py - y) ** 2);
  }
  return best;
}

function ringAreaKm2(ring: Ring): number {
  const meanLat = ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;
  const kx = 111.32 * Math.cos((meanLat * Math.PI) / 180);
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * kx * ring[i][1] * 110.57 - ring[i][0] * kx * ring[j][1] * 110.57;
  }
  return Math.abs(area / 2);
}

function withoutTinyIslands(geometry: RawFeature["geometry"], minKm2: number): RawFeature["geometry"] {
  const parts = polygons(geometry);
  const areas = parts.map((polygon) => ringAreaKm2(polygon[0]));
  const largest = areas.indexOf(Math.max(...areas));
  const kept = parts.filter((_, i) => i === largest || areas[i] >= minKm2);
  return kept.length === 1 ? { type: "Polygon", coordinates: kept[0] } : { type: "MultiPolygon", coordinates: kept };
}

async function run(commands: string, input: Record<string, unknown>): Promise<Record<string, string>> {
  const output = (await mapshaper.applyCommands(commands, input)) as Record<string, string | Buffer>;
  return Object.fromEntries(Object.entries(output).map(([name, data]) => [name, data.toString()]));
}

const round5 = (value: number) => Math.round(value * 1e5) / 1e5;

async function main() {
  const adm1 = JSON.parse(fs.readFileSync(await download("adm1"), "utf8")) as Collection;
  const adm2 = JSON.parse(fs.readFileSync(await download("adm2"), "utf8")) as Collection;

  if (adm1.features.length !== Object.keys(PROVINCES).length) {
    console.warn(`Peringatan: ADM1 berisi ${adm1.features.length} provinsi, tabel nama berisi ${Object.keys(PROVINCES).length}.`);
  }
  const provinceOf = new Map<RawFeature, { code: string; nama: string; slug: string }>();
  for (const feature of adm1.features) {
    const iso = String(feature.properties.shapeISO).replace("ID-", "");
    const info = PROVINCES[iso];
    if (!info) throw new Error(`Kode provinsi tidak dikenal: ${feature.properties.shapeISO}`);
    provinceOf.set(feature, { ...info, slug: slugify(info.nama) });
  }
  const provinceSlugs = new Set([...provinceOf.values()].map((p) => p.slug));

  // 1. Province of every regency: the ADM1 polygon with the largest overlap (ADM1 and ADM2 come
  //    from different sources, so their borders differ slightly). Interior points are the fallback.
  const admin = adm2.features.filter((f) => !NON_ADMIN.has(String(f.properties.shapeName)));
  const joined = JSON.parse(
    (
      await run(
        "-i in.json -join adm1.json largest-overlap fields=shapeISO prefix=prov_ -each 'ix=this.innerX, iy=this.innerY' -o out.json",
        { "in.json": { type: "FeatureCollection", features: admin }, "adm1.json": adm1 },
      )
    )["out.json"],
  ) as Collection;
  const byIso = new Map(adm1.features.map((f) => [String(f.properties.shapeISO), f]));

  const usedSlugs = new Set<string>();
  let fallback = 0;
  const regencies: RawFeature[] = joined.features.map((feature) => {
    const point: Position = [Number(feature.properties.ix), Number(feature.properties.iy)];
    const fixed = PARENT_FIXES[String(feature.properties.shapeName)];
    let province = byIso.get(fixed ?? String(feature.properties.prov_shapeISO)) ?? adm1.features.find((p) => pointInFeature(point, p));
    if (!province) {
      fallback++;
      console.log(`Tanpa tumpang tindih ADM1: ${feature.properties.shapeName}`);
      province = adm1.features.reduce((a, b) => (nearestDistance(point, b) < nearestDistance(point, a) ? b : a));
    }
    const parent = provinceOf.get(province)!;
    const sourceName = String(feature.properties.shapeName);
    const fix = NAME_FIXES[sourceName];
    const level = fix?.level ?? (sourceName.startsWith("Kota ") ? "kota" : "kabupaten");
    const nama = fix?.nama ?? sourceName.replace(/^Kota /, "");
    let slug = slugify(level === "kota" ? `kota ${nama}` : nama);
    // Regency slugs must not collide with province slugs (e.g. Kabupaten Gorontalo).
    if (provinceSlugs.has(slug)) slug = `kabupaten-${slug}`;
    if (usedSlugs.has(slug)) throw new Error(`Slug ganda: ${slug}`);
    usedSlugs.add(slug);
    return {
      ...feature,
      properties: { id: String(feature.properties.shapeID), slug, nama, level, provinsi: parent.slug },
    };
  });

  // 2. Regencies: drop tiny islands (keeping each regency's largest part, so island regencies
  //    such as Kepulauan Seribu survive), fill slivers and small holes (reservoirs, the "Hutan"
  //    forest patch), simplify with shared topology, then clean again.
  for (const feature of regencies) feature.geometry = withoutTinyIslands(feature.geometry, KABUPATEN.minIslandKm2);
  const kabCommands = [
    "-i in.json",
    "-clean gap-fill-area=60km2",
    `-simplify ${KABUPATEN.simplify} weighted keep-shapes`,
    "-clean gap-fill-area=60km2",
    "-each 'lx=this.innerX, ly=this.innerY, bbox=this.bounds'",
    `-o kab.json precision=${PRECISION}`,
  ].join(" ");
  const kabOut = await run(kabCommands, { "in.json": { type: "FeatureCollection", features: regencies } });
  const kab = JSON.parse(kabOut["kab.json"]) as Collection;

  // 3. Provinces: dissolve the simplified regencies, then simplify further for small scales.
  const provCommands = [
    "-i kab.json",
    "-dissolve provinsi",
    `-filter-islands min-area=${PROVINSI.minIsland} remove-empty`,
    `-simplify ${PROVINSI.simplify} weighted keep-shapes`,
    "-clean",
    "-each 'lx=this.innerX, ly=this.innerY, bbox=this.bounds'",
    `-o prov.json precision=${PRECISION}`,
  ].join(" ");
  const prov = JSON.parse((await run(provCommands, { "kab.json": kabOut["kab.json"] }))["prov.json"]) as Collection;

  const props = (feature: RawFeature) => {
    const p = feature.properties;
    const bbox = (p.bbox as number[]).map(round5);
    return {
      label: [round5(Number(p.lx)), round5(Number(p.ly))],
      bbox,
    };
  };

  const kabupaten = {
    type: "FeatureCollection",
    features: kab.features
      .map((f) => ({
        type: "Feature",
        geometry: f.geometry,
        properties: {
          id: f.properties.id,
          slug: f.properties.slug,
          nama: f.properties.nama,
          level: f.properties.level,
          provinsi: f.properties.provinsi,
          ...props(f),
        },
      }))
      .sort((a, b) => String(a.properties.slug).localeCompare(String(b.properties.slug))),
  };

  const bySlug = new Map([...provinceOf.values()].map((p) => [p.slug, p]));
  const provinsi = {
    type: "FeatureCollection",
    features: prov.features
      .map((f) => {
        const info = bySlug.get(String(f.properties.provinsi))!;
        return {
          type: "Feature",
          geometry: f.geometry,
          properties: { id: info.code, slug: info.slug, nama: info.nama, level: "provinsi", provinsi: null, ...props(f) },
        };
      })
      .sort((a, b) => a.properties.slug.localeCompare(b.properties.slug)),
  };

  // 4. Browser files: the regency topology simplified again; provinces dissolved from it and
  //    simplified the most (they are only drawn below zoom 6).
  const webProps = "slug,nama,level,provinsi";
  const webKabOut = await run(
    [
      "-i kab.json",
      `-simplify ${WEB.kabupaten.simplify} weighted keep-shapes`,
      "-clean",
      `-filter-fields ${webProps}`,
      `-o web-kab.json precision=${WEB.precision}`,
      // Province borders from the same topology (lines between regencies of different provinces).
      "-innerlines where='A.provinsi != B.provinsi'",
      `-o web-garis.json precision=${WEB.precision}`,
    ].join(" "),
    { "kab.json": kabOut["kab.json"] },
  );
  const webProvOut = await run(
    [
      "-i web-kab.json",
      "-dissolve provinsi copy-fields=provinsi",
      `-filter-islands min-area=${WEB.provinsi.minIsland} remove-empty`,
      `-simplify ${WEB.provinsi.simplify} weighted keep-shapes`,
      "-clean",
      `-o web-prov.json precision=${WEB.precision}`,
    ].join(" "),
    { "web-kab.json": webKabOut["web-kab.json"] },
  );
  const webKab = JSON.parse(webKabOut["web-kab.json"]) as Collection;
  const webProv = JSON.parse(webProvOut["web-prov.json"]) as Collection;
  const sortBySlug = (features: RawFeature[]) =>
    features.sort((a, b) => String(a.properties.slug).localeCompare(String(b.properties.slug)));
  const webKabupaten = {
    type: "FeatureCollection",
    features: sortBySlug(
      webKab.features.map((f) => ({
        type: "Feature",
        geometry: f.geometry,
        properties: { slug: f.properties.slug, nama: f.properties.nama, level: f.properties.level, provinsi: f.properties.provinsi },
      })),
    ),
  };
  const webProvinsi = {
    type: "FeatureCollection",
    features: sortBySlug(
      webProv.features.map((f) => {
        const info = bySlug.get(String(f.properties.provinsi))!;
        return { type: "Feature", geometry: f.geometry, properties: { slug: info.slug, nama: info.nama, level: "provinsi" } };
      }),
    ),
  };
  // One MultiLineString keeps the file small; the lines are only drawn, never queried.
  const lines = JSON.parse(webKabOut["web-garis.json"]) as { geometries: { type: "LineString"; coordinates: Position[] }[] };
  const garis = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "MultiLineString", coordinates: lines.geometries.map((g) => g.coordinates) },
        properties: {},
      },
    ],
  };
  // Label points from the server geometry (always inside the region).
  const labels = (collection: typeof kabupaten | typeof provinsi) => ({
    type: "FeatureCollection",
    features: collection.features.map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: f.properties.label },
      properties: { slug: f.properties.slug, nama: f.properties.nama, level: f.properties.level, provinsi: f.properties.provinsi },
    })),
  });

  const write = (dir: string, name: string, data: unknown) => {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    fs.writeFileSync(file, JSON.stringify(data));
    return fs.statSync(file).size;
  };
  const sizes = {
    "mock/provinsi.geojson": write(OUT_DIR, "provinsi.geojson", provinsi),
    "mock/kabupaten.geojson": write(OUT_DIR, "kabupaten.geojson", kabupaten),
    "public/geo/provinsi.json": write(WEB_DIR, "provinsi.json", webProvinsi),
    "public/geo/kabupaten.json": write(WEB_DIR, "kabupaten.json", webKabupaten),
    "public/geo/provinsi-garis.json": write(WEB_DIR, "provinsi-garis.json", garis),
    "public/geo/label-provinsi.json": write(WEB_DIR, "label-provinsi.json", labels(provinsi)),
    "public/geo/label-kabupaten.json": write(WEB_DIR, "label-kabupaten.json", labels(kabupaten)),
  };
  const tooLarge = [
    ["public/geo/kabupaten.json", WEB.kabupaten.maxKb],
    ["public/geo/provinsi.json", WEB.provinsi.maxKb],
  ] as const;
  for (const [name, maxKb] of tooLarge) {
    if (sizes[name] > maxKb * 1024) console.warn(`Peringatan: ${name} lebih dari ${maxKb} KB`);
  }

  const perProvince = new Map<string, number>();
  for (const f of kabupaten.features) {
    const key = String(f.properties.provinsi);
    perProvince.set(key, (perProvince.get(key) ?? 0) + 1);
  }
  console.log(`Provinsi        : ${provinsi.features.length}`);
  console.log(
    `Kabupaten/kota  : ${kabupaten.features.length} (kota ${kabupaten.features.filter((f) => f.properties.level === "kota").length}; ${fallback} tanpa tumpang tindih ADM1, memakai titik dalam/terdekat)`,
  );
  console.log(`Per provinsi    : ${[...perProvince.entries()].map(([k, n]) => `${k} ${n}`).join(", ")}`);
  for (const [name, size] of Object.entries(sizes)) console.log(`  ${name.padEnd(32)} ${(size / 1024).toFixed(0).padStart(6)} KB`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
