import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { addDaysIso, diffDaysIso } from "@/lib/format";
import { bboxIntersects, pointInBBox, ringAreaKm2 } from "@/lib/geo";
import { topRiskFactors } from "@/lib/mock-model";
import { getRiskLevel } from "@/lib/risk";
import {
  CONFIDENCE_RANK,
  type BBox,
  type Confidence,
  type DataStatus,
  type HotspotFeature,
  type MonthlyTrend,
  type Position,
  type Region,
  type RegionBoundaryFeature,
  type RegionDetail,
  type RegionStat,
  type RegionWeather,
  type RiskCellFeature,
  type RiskGrid,
  type RiskGridCell,
  type Satellite,
  type WeatherSnapshot,
} from "@/types";
import type {
  MockClusters,
  MockGrid,
  MockHotspots,
  MockRegions,
  MockRisk,
  MockStatus,
  MockWeather,
} from "@/types/mock";
import type { AreaFilter, DataSource } from "./types";

const MOCK_DIR = path.join(process.cwd(), "mock");

async function readJson<T>(name: string): Promise<T> {
  const raw = await readFile(path.join(MOCK_DIR, name), "utf8");
  return JSON.parse(raw) as T;
}

/** Memoizes an async loader for the lifetime of the server process. */
function memo<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => {
    promise ??= load().catch((error: unknown) => {
      promise = null;
      throw error;
    });
    return promise;
  };
}

const loadStatus = memo(() => readJson<MockStatus>("status.json"));
const loadClusters = memo(() => readJson<MockClusters>("clusters.geojson"));
const loadWeather = memo(() => readJson<MockWeather>("weather.json"));
const loadRisk = memo(() => readJson<MockRisk>("risk.json"));

// ---------------------------------------------------------------------------
// Regions

interface RegionIndex {
  provinces: MockRegions;
  regencies: MockRegions;
  list: Region[];
  bySlug: Map<string, RegionBoundaryFeature>;
  /** Regency slugs per province slug. */
  children: Map<string, string[]>;
}

// Every mock file is read and indexed once per server process (memo); requests only filter
// the in-memory indexes (per province, per regency, per 1° bucket).

const loadRegions = memo(async (): Promise<RegionIndex> => {
  const [provinces, regencies] = await Promise.all([
    readJson<MockRegions>("provinsi.geojson"),
    readJson<MockRegions>("kabupaten.geojson"),
  ]);
  const features = [...provinces.features, ...regencies.features];
  const children = new Map<string, string[]>();
  for (const f of regencies.features) {
    const parent = f.properties.provinsi ?? "";
    children.set(parent, [...(children.get(parent) ?? []), f.properties.slug]);
  }
  return {
    provinces,
    regencies,
    list: features
      .map(({ properties: p }): Region => ({ id: p.id, slug: p.slug, nama: p.nama, level: p.level, provinsi: p.provinsi }))
      .sort((a, b) => a.nama.localeCompare(b.nama, "id")),
    bySlug: new Map(features.map((f) => [f.properties.slug, f])),
    children,
  };
});

function inArea(filter: AreaFilter, provinsi: string, kabupaten: string): boolean {
  return (!filter.provinsi || filter.provinsi === provinsi) && (!filter.kabupaten || filter.kabupaten === kabupaten);
}

// ---------------------------------------------------------------------------
// Grid

const GRID_BUCKET = 1; // degrees

/** `gambut` of a cell without peat data. */
const NO_PEAT = -1;

/**
 * MOCK_TANPA_GAMBUT=1 drops the peat data of every cell (as before the pipeline has a peat map),
 * to check the disabled "Lahan gambut" layer. Read once per server process.
 */
const noPeatData = () => process.env.MOCK_TANPA_GAMBUT === "1";

interface GridIndex {
  cellSize: number;
  ids: string[];
  /** Cell index by id. */
  byId: Map<string, number>;
  /** South-west corner of each cell. */
  lon: Float64Array;
  lat: Float64Array;
  kab: Int32Array;
  /** 1 = peat, 0 = mineral soil, NO_PEAT = no peat data. */
  gambut: Int8Array;
  ndvi: Float64Array;
  hotspots: Int32Array;
  kabSlugs: string[];
  kabProvinces: string[];
  /** Cell indices per regency slug and per province slug. */
  byKab: Map<string, number[]>;
  byProv: Map<string, number[]>;
  /** Cell indices per 1° bucket, for bbox queries. */
  buckets: Map<string, number[]>;
}

const loadGrid = memo(async (): Promise<GridIndex> => {
  const grid = await readJson<MockGrid>("grid.json");
  const n = grid.cells.length;
  const [lon0, lat0] = grid.origin;
  const size = grid.cell_size;
  const index: GridIndex = {
    cellSize: size,
    ids: new Array<string>(n),
    byId: new Map(),
    lon: new Float64Array(n),
    lat: new Float64Array(n),
    kab: new Int32Array(n),
    gambut: new Int8Array(n),
    ndvi: new Float64Array(n),
    hotspots: new Int32Array(n),
    kabSlugs: grid.kabupaten,
    kabProvinces: grid.provinsi,
    byKab: new Map(),
    byProv: new Map(),
    buckets: new Map(),
  };
  grid.cells.forEach(([row, col, kab, gambut, ndvi, hotspots], i) => {
    const lon = Math.round((lon0 + col * size) * 1e4) / 1e4;
    const lat = Math.round((lat0 + row * size) * 1e4) / 1e4;
    index.ids[i] = `R${String(row).padStart(3, "0")}-C${String(col).padStart(4, "0")}`;
    index.byId.set(index.ids[i], i);
    index.lon[i] = lon;
    index.lat[i] = lat;
    index.kab[i] = kab;
    index.gambut[i] = gambut === null || noPeatData() ? NO_PEAT : gambut;
    index.ndvi[i] = ndvi / 100;
    index.hotspots[i] = hotspots;
    const push = (map: Map<string, number[]>, key: string) => {
      const list = map.get(key);
      if (list) list.push(i);
      else map.set(key, [i]);
    };
    push(index.byKab, grid.kabupaten[kab]);
    push(index.byProv, grid.provinsi[kab]);
    push(index.buckets, `${Math.floor(lon / GRID_BUCKET)}:${Math.floor(lat / GRID_BUCKET)}`);
  });
  return index;
});

function cellPeat(grid: GridIndex, i: number): boolean | null {
  return grid.gambut[i] === NO_PEAT ? null : grid.gambut[i] === 1;
}

function cellBBox(grid: GridIndex, i: number): BBox {
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  return [grid.lon[i], grid.lat[i], r4(grid.lon[i] + grid.cellSize), r4(grid.lat[i] + grid.cellSize)];
}

function cellsInArea(grid: GridIndex, filter: AreaFilter): number[] {
  let candidates: number[];
  if (filter.kabupaten) candidates = grid.byKab.get(filter.kabupaten) ?? [];
  else if (filter.provinsi) candidates = grid.byProv.get(filter.provinsi) ?? [];
  else if (filter.bbox) {
    const [x0, y0, x1, y1] = filter.bbox;
    candidates = [];
    for (let bx = Math.floor((x0 - grid.cellSize) / GRID_BUCKET); bx <= Math.floor(x1 / GRID_BUCKET); bx++) {
      for (let by = Math.floor((y0 - grid.cellSize) / GRID_BUCKET); by <= Math.floor(y1 / GRID_BUCKET); by++) {
        candidates.push(...(grid.buckets.get(`${bx}:${by}`) ?? []));
      }
    }
  } else candidates = grid.ids.map((_, i) => i);
  return candidates.filter(
    (i) =>
      inArea(filter, grid.kabProvinces[grid.kab[i]], grid.kabSlugs[grid.kab[i]]) &&
      (!filter.bbox || bboxIntersects(cellBBox(grid, i), filter.bbox)),
  );
}

// ---------------------------------------------------------------------------
// Risk

interface RiskAggregate {
  sum: Float64Array;
  count: Int32Array;
  max: Float64Array;
}

interface RiskDay {
  target: number;
  /** Per regency index (grid order) and per province slug. */
  kab: RiskAggregate;
  prov: Map<string, { sum: number; count: number; max: number }>;
}

const riskDayCache = new Map<string, RiskDay | null>();

async function riskDay(targetDate: string): Promise<RiskDay | null> {
  if (riskDayCache.has(targetDate)) return riskDayCache.get(targetDate)!;
  const [risk, grid] = await Promise.all([loadRisk(), loadGrid()]);
  const t = risk.targets.indexOf(targetDate);
  if (t < 0) {
    riskDayCache.set(targetDate, null);
    return null;
  }
  const nKab = grid.kabSlugs.length;
  const kab: RiskAggregate = { sum: new Float64Array(nKab), count: new Int32Array(nKab), max: new Float64Array(nKab) };
  const scores = risk.scores[t];
  for (let i = 0; i < scores.length; i++) {
    const k = grid.kab[i];
    const score = scores[i] / 1000;
    kab.sum[k] += score;
    kab.count[k] += 1;
    if (score > kab.max[k]) kab.max[k] = score;
  }
  const prov = new Map<string, { sum: number; count: number; max: number }>();
  for (let k = 0; k < nKab; k++) {
    const key = grid.kabProvinces[k];
    const entry = prov.get(key) ?? { sum: 0, count: 0, max: 0 };
    entry.sum += kab.sum[k];
    entry.count += kab.count[k];
    entry.max = Math.max(entry.max, kab.max[k]);
    prov.set(key, entry);
  }
  const day = { target: t, kab, prov };
  riskDayCache.set(targetDate, day);
  return day;
}

async function riskFeatures(targetDate: string, indices: number[]): Promise<RiskCellFeature[]> {
  const [risk, grid] = await Promise.all([loadRisk(), loadGrid()]);
  const t = risk.targets.indexOf(targetDate);
  if (t < 0) return [];
  return indices.map((i): RiskCellFeature => {
    const score = risk.scores[t][i] / 1000;
    const k = grid.kab[i];
    const [dry, humidity] = risk.cuaca[t][k];
    const [minLon, minLat, maxLon, maxLat] = cellBBox(grid, i);
    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [minLon, minLat],
            [maxLon, minLat],
            [maxLon, maxLat],
            [minLon, maxLat],
            [minLon, minLat],
          ],
        ],
      },
      properties: {
        cell_id: grid.ids[i],
        tanggal_prediksi: risk.tanggal_prediksi,
        tanggal_target: targetDate,
        skor_risiko: score,
        level_risiko: getRiskLevel(score),
        is_gambut: cellPeat(grid, i),
        faktor: topRiskFactors({
          dry,
          humidity,
          gambut: cellPeat(grid, i),
          hotspots: grid.hotspots[i],
          ndvi: grid.ndvi[i],
          dayOffset: t,
        }),
        provinsi: grid.kabProvinces[k],
        kabupaten: grid.kabSlugs[k],
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Hotspots

type HotspotRow = MockHotspots["days"][number][number];

interface HotspotIndex {
  file: MockHotspots;
  /** Day index → hotspot count per regency index and confidence (kab * 3 + conf). */
  counts: Int32Array[];
  /** "YYYY-MM" and "slug|YYYY-MM" (regency or province) → hotspot count. */
  monthly: Map<string, number>;
}

const loadHotspots = memo(async (): Promise<HotspotIndex> => {
  const file = await readJson<MockHotspots>("hotspots.json");
  const nKab = file.kabupaten.length;
  const monthly = new Map<string, number>();
  const add = (key: string, n: number) => monthly.set(key, (monthly.get(key) ?? 0) + n);
  const counts = file.days.map((rows, d) => {
    const perKab = new Int32Array(nKab * 3);
    for (const row of rows) perKab[row[6] * 3 + row[4]]++;
    const month = addDaysIso(file.start, d).slice(0, 7);
    add(month, rows.length);
    for (let k = 0; k < nKab; k++) {
      const n = perKab[k * 3] + perKab[k * 3 + 1] + perKab[k * 3 + 2];
      if (n === 0) continue;
      add(`${file.kabupaten[k]}|${month}`, n);
      add(`${file.provinsi[k]}|${month}`, n);
    }
    return perKab;
  });
  return { file, counts, monthly };
});

interface HotspotDayIndex {
  /** Row indices of the day per province slug and per regency slug. */
  byProv: Map<string, number[]>;
  byKab: Map<string, number[]>;
}

const hotspotDayIndexes = new Map<number, HotspotDayIndex>();

/** Rows of one day grouped by province and regency (built on first use). */
function hotspotDayIndex(file: MockHotspots, day: number): HotspotDayIndex {
  let index = hotspotDayIndexes.get(day);
  if (!index) {
    index = { byProv: new Map(), byKab: new Map() };
    const push = (map: Map<string, number[]>, key: string, i: number) => {
      const list = map.get(key);
      if (list) list.push(i);
      else map.set(key, [i]);
    };
    (file.days[day] ?? []).forEach((row, i) => {
      push(index!.byProv, file.provinsi[row[6]], i);
      push(index!.byKab, file.kabupaten[row[6]], i);
    });
    hotspotDayIndexes.set(day, index);
  }
  return index;
}

function hotspotId(date: string, index: number): string {
  return `HS-${date.replaceAll("-", "")}-${String(index + 1).padStart(4, "0")}`;
}

function hotspotFeature(file: MockHotspots, date: string, index: number, row: HotspotRow): HotspotFeature {
  const [lon, lat, hhmm, sat, conf, frp, kab] = row;
  const time = String(hhmm).padStart(4, "0");
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: {
      id: hotspotId(date, index),
      waktu_deteksi: `${date}T${time.slice(0, 2)}:${time.slice(2)}:00+07:00`,
      satelit: file.satelit[sat] as Satellite,
      confidence: file.confidence[conf] as Confidence,
      frp,
      provinsi: file.provinsi[kab],
      kabupaten: file.kabupaten[kab],
    },
  };
}

function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let d = start; d <= end; d = addDaysIso(d, 1)) dates.push(d);
  return dates;
}

function eachMonth(start: string, end: string): string[] {
  const months: string[] = [];
  let [year, month] = start.split("-").map(Number);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key > end) break;
    months.push(key);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}

// ---------------------------------------------------------------------------
// Weather

function meanWeather(snapshots: WeatherSnapshot[]): WeatherSnapshot | null {
  if (snapshots.length === 0) return null;
  const mean = (pick: (w: WeatherSnapshot) => number, digits: number) =>
    Math.round((snapshots.reduce((sum, w) => sum + pick(w), 0) / snapshots.length) * 10 ** digits) / 10 ** digits;
  return {
    tanggal: snapshots[0].tanggal,
    suhu_c: mean((w) => w.suhu_c, 1),
    kelembapan_persen: mean((w) => w.kelembapan_persen, 0),
    curah_hujan_mm: mean((w) => w.curah_hujan_mm, 1),
    kecepatan_angin_kmh: mean((w) => w.kecepatan_angin_kmh, 1),
    hari_tanpa_hujan: mean((w) => w.hari_tanpa_hujan, 0),
  };
}

// ---------------------------------------------------------------------------

const round3 = (v: number) => Math.round(v * 1000) / 1000;

export const mockDataSource: DataSource = {
  async getHotspots({ start, end, minConfidence, ...area }) {
    const { file } = await loadHotspots();
    const minRank = CONFIDENCE_RANK[minConfidence];
    const features: HotspotFeature[] = [];
    for (const date of eachDate(start, end)) {
      const day = diffDaysIso(date, file.start);
      const rows = file.days[day] ?? [];
      // A province or regency filter only walks that region's rows of the day.
      const indices = area.kabupaten
        ? (hotspotDayIndex(file, day).byKab.get(area.kabupaten) ?? [])
        : area.provinsi
          ? (hotspotDayIndex(file, day).byProv.get(area.provinsi) ?? [])
          : null;
      const add = (index: number) => {
        const row = rows[index];
        if (row[4] < minRank) return;
        if (!inArea(area, file.provinsi[row[6]], file.kabupaten[row[6]])) return;
        if (area.bbox && !pointInBBox([row[0], row[1]], area.bbox)) return;
        features.push(hotspotFeature(file, date, index, row));
      };
      if (indices) for (const index of indices) add(index);
      else for (let index = 0; index < rows.length; index++) add(index);
    }
    return { type: "FeatureCollection", features };
  },

  async getHotspot(id) {
    const match = /^HS-(\d{4})(\d{2})(\d{2})-(\d{4})$/.exec(id);
    if (!match) return null;
    const { file } = await loadHotspots();
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    const index = Number(match[4]) - 1;
    const row = file.days[diffDaysIso(date, file.start)]?.[index];
    return row ? hotspotFeature(file, date, index, row) : null;
  },

  async getClusters({ date, ...area }) {
    const clusters = await loadClusters();
    return {
      type: "FeatureCollection",
      features: clusters.features.filter(
        (f) =>
          f.properties.tanggal === date &&
          inArea(area, f.properties.provinsi, f.properties.kabupaten) &&
          (!area.bbox || f.geometry.coordinates[0].some((p) => pointInBBox(p, area.bbox!))),
      ),
    };
  },

  async getRiskGrid(area) {
    const [risk, grid] = await Promise.all([loadRisk(), loadGrid()]);
    const kabupaten: string[] = [];
    const kabIndex = new Map<number, number>();
    const sel = cellsInArea(grid, area).map((i): RiskGridCell => {
      const k = grid.kab[i];
      let ki = kabIndex.get(k);
      if (ki === undefined) {
        ki = kabupaten.length;
        kabIndex.set(k, ki);
        kabupaten.push(grid.kabSlugs[k]);
      }
      const peat = cellPeat(grid, i);
      return [grid.ids[i], grid.lon[i], grid.lat[i], peat === null ? null : peat ? 1 : 0, ki, ...risk.scores.map((day) => day[i])];
    });
    const result: RiskGrid = {
      tanggal_prediksi: risk.tanggal_prediksi,
      tanggal_target: risk.targets,
      ukuran_sel: grid.cellSize,
      kabupaten,
      sel,
    };
    return result;
  },

  async getRiskCell(cellId, targetDate) {
    const grid = await loadGrid();
    const index = grid.byId.get(cellId);
    if (index === undefined) return null;
    return (await riskFeatures(targetDate, [index]))[0] ?? null;
  },

  async getRegions() {
    return (await loadRegions()).list;
  },

  async getRegionBoundaries({ level, provinsi }) {
    const regions = await loadRegions();
    if (level === "provinsi") return regions.provinces;
    if (!provinsi) return regions.regencies;
    return {
      type: "FeatureCollection",
      features: regions.regencies.features.filter((f) => f.properties.provinsi === provinsi),
    };
  },

  async getRegionDetail(slug) {
    const [regions, grid] = await Promise.all([loadRegions(), loadGrid()]);
    const feature = regions.bySlug.get(slug);
    if (!feature) return null;
    const p = feature.properties;
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const area = polygons.reduce(
      (sum, [outer, ...holes]) => sum + ringAreaKm2(outer) - holes.reduce((s, hole) => s + ringAreaKm2(hole), 0),
      0,
    );
    const cells = (p.level === "provinsi" ? grid.byProv : grid.byKab).get(slug) ?? [];
    // Share of the cells with peat data; null when none of them has any.
    const known = cells.filter((i) => grid.gambut[i] !== NO_PEAT);
    const peat = known.filter((i) => grid.gambut[i] === 1).length;
    const parent = p.provinsi ? regions.bySlug.get(p.provinsi) : undefined;
    const detail: RegionDetail = {
      id: p.id,
      slug: p.slug,
      nama: p.nama,
      level: p.level,
      provinsi: p.provinsi,
      nama_provinsi: parent?.properties.nama ?? null,
      bbox: p.bbox,
      pusat: p.label as Position,
      luas_km2: Math.round(area),
      persen_gambut: known.length ? Math.round((peat / known.length) * 1000) / 10 : null,
      jumlah_sel: cells.length,
      jumlah_kabupaten: p.level === "provinsi" ? (regions.children.get(slug)?.length ?? 0) : 0,
    };
    return detail;
  },

  async getWeather(slug) {
    const [weather, regions] = await Promise.all([loadWeather(), loadRegions()]);
    const children = regions.children.get(slug);
    if (children) return meanWeather(children.flatMap((child) => weather.data[child] ?? []));
    return weather.data[slug] ?? null;
  },

  async getWeatherList(provinsi) {
    const [weather, regions] = await Promise.all([loadWeather(), loadRegions()]);
    return regions.regencies.features
      .filter((f) => !provinsi || f.properties.provinsi === provinsi)
      .flatMap(({ properties: p }): RegionWeather[] => {
        const cuaca = weather.data[p.slug];
        return cuaca ? [{ slug: p.slug, nama: p.nama, provinsi: p.provinsi, cuaca }] : [];
      });
  },

  async getMonthlyTrend({ start, end, slug }): Promise<MonthlyTrend[]> {
    const { monthly } = await loadHotspots();
    return eachMonth(start, end).map((bulan) => ({
      bulan,
      jumlah_hotspot: monthly.get(slug ? `${slug}|${bulan}` : bulan) ?? 0,
    }));
  },

  async getRegionStats({ date, start, end, level, provinsi, minConfidence = "low" }) {
    const [status, regions, hotspots, grid, risk] = await Promise.all([
      loadStatus(),
      loadRegions(),
      loadHotspots(),
      loadGrid(),
      riskDay(date),
    ]);
    const windowEnd = end ?? status.tanggal_data;
    const windowStart = start ?? addDaysIso(windowEnd, -29);
    const minRank = CONFIDENCE_RANK[minConfidence];
    const { file, counts } = hotspots;

    // Hotspots per regency index (hotspot file order).
    const perKab = new Int32Array(file.kabupaten.length);
    for (const day of eachDate(windowStart, windowEnd)) {
      const dayCounts = counts[diffDaysIso(day, file.start)];
      if (!dayCounts) continue;
      for (let k = 0; k < perKab.length; k++) {
        for (let c = minRank; c < 3; c++) perKab[k] += dayCounts[k * 3 + c];
      }
    }
    const hotspotsBySlug = new Map<string, number>();
    file.kabupaten.forEach((slug, k) => {
      hotspotsBySlug.set(slug, perKab[k]);
      hotspotsBySlug.set(file.provinsi[k], (hotspotsBySlug.get(file.provinsi[k]) ?? 0) + perKab[k]);
    });

    const riskBySlug = new Map<string, { sum: number; count: number; max: number }>(risk?.prov ?? []);
    if (risk) {
      grid.kabSlugs.forEach((slug, k) =>
        riskBySlug.set(slug, { sum: risk.kab.sum[k], count: risk.kab.count[k], max: risk.kab.max[k] }),
      );
    }

    const source = level === "provinsi" ? regions.provinces : regions.regencies;
    return source.features
      .filter((f) => level === "provinsi" || !provinsi || f.properties.provinsi === provinsi)
      .map(({ properties: p }): RegionStat => {
        const score = riskBySlug.get(p.slug);
        return {
          slug: p.slug,
          nama: p.nama,
          level: p.level,
          provinsi: p.provinsi,
          jumlah_hotspot: hotspotsBySlug.get(p.slug) ?? 0,
          rata_skor_risiko: score?.count ? round3(score.sum / score.count) : 0,
          maks_skor_risiko: score ? round3(score.max) : 0,
          jumlah_sel: score?.count ?? 0,
        };
      })
      .sort((a, b) => b.rata_skor_risiko - a.rata_skor_risiko);
  },

  async getDataStatus(): Promise<DataStatus> {
    const [status, grid] = await Promise.all([loadStatus(), loadGrid()]);
    return { ...status, gambut_tersedia: grid.gambut.some((value) => value !== NO_PEAT) };
  },
};
