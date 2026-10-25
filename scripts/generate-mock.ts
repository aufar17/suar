/**
 * Generates deterministic mock data for Suar (all of Indonesia) into `mock/`.
 *
 *   pnpm geo:build                         # once: boundaries in mock/kabupaten.geojson, provinsi.geojson
 *   pnpm mock:generate                     # latest data date = DEFAULT_END_DATE
 *   MOCK_END_DATE=2026-11-01 pnpm mock:generate
 *
 * Everything is placed on the real regency boundaries: grid cells are kept only where their
 * centre lies inside a regency, and every hotspot lies on land. Fire activity follows the
 * known pattern: peatlands of Riau, Jambi, South Sumatra and Kalimantan, savanna burning in
 * East Nusa Tenggara, and the southern Papua lowlands, peaking July–October.
 *
 * Like the real pipeline, hotspots and weather cover the whole country, but only the provinces
 * in PREDICTED_PROVINCES get grid cells and a risk prediction, and some of those have no peat
 * data yet (is_gambut null).
 */
import fs from "node:fs";
import path from "node:path";
import { faker } from "@faker-js/faker";
import { addDaysIso } from "../lib/format";
import { closeRing, convexHull, ringAreaKm2, round4 } from "../lib/geo";
import { contributionValues, RISK_INTERCEPT } from "../lib/mock-model";
import { getRiskLevel } from "../lib/risk";
import type { ClusterFeature, ClusterStatus, Position, RegionBoundaryCollection, WeatherSnapshot } from "../types";
import type { MockGrid, MockHotspots, MockRisk, MockWeather } from "../types/mock";

const DEFAULT_END_DATE = "2026-10-20";
const SEED = 20261020;
const OUT_DIR = path.join(process.cwd(), "mock");

const END_DATE = process.env.MOCK_END_DATE ?? DEFAULT_END_DATE;
if (!/^\d{4}-\d{2}-\d{2}$/.test(END_DATE)) {
  throw new Error(`MOCK_END_DATE tidak valid: ${END_DATE}`);
}

faker.seed(SEED);

// ---------------------------------------------------------------------------
// Random helpers (all derived from the seeded faker instance)

const rand = () => faker.number.float({ min: 0, max: 1 });
const uniform = (min: number, max: number) => min + (max - min) * rand();
const randInt = (min: number, max: number) => Math.floor(uniform(min, max + 1));
function gaussian(mean = 0, sd = 1): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function poisson(lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 40) return Math.max(0, Math.round(gaussian(lambda, Math.sqrt(lambda))));
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > limit);
  return k - 1;
}
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

// ---------------------------------------------------------------------------
// Regions (real boundaries from `pnpm geo:build`)

const kabupatenFile = path.join(OUT_DIR, "kabupaten.geojson");
if (!fs.existsSync(kabupatenFile)) throw new Error("mock/kabupaten.geojson belum ada. Jalankan `pnpm geo:build` dulu.");
const boundaries = JSON.parse(fs.readFileSync(kabupatenFile, "utf8")) as RegionBoundaryCollection;

interface Kab {
  slug: string;
  provinsi: string;
  /** Polygons as [outer, ...holes]. */
  polygons: Position[][][];
  bbox: [number, number, number, number];
}

const kabs: Kab[] = boundaries.features.map((f) => ({
  slug: f.properties.slug,
  provinsi: f.properties.provinsi ?? "",
  polygons: f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates,
  bbox: f.properties.bbox,
}));

function pointInRing([x, y]: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Bucketed lookup: which regency (if any) contains a point.
const BUCKET_DEG = 0.5;
const bucketKey = (bx: number, by: number) => `${bx}:${by}`;
const kabBuckets = new Map<string, number[]>();
kabs.forEach((kab, i) => {
  const [x0, y0, x1, y1] = kab.bbox;
  for (let bx = Math.floor(x0 / BUCKET_DEG); bx <= Math.floor(x1 / BUCKET_DEG); bx++) {
    for (let by = Math.floor(y0 / BUCKET_DEG); by <= Math.floor(y1 / BUCKET_DEG); by++) {
      const key = bucketKey(bx, by);
      kabBuckets.set(key, [...(kabBuckets.get(key) ?? []), i]);
    }
  }
});

/** Index of the regency containing the point, or -1 at sea. */
function kabAt(point: Position): number {
  const [x, y] = point;
  for (const i of kabBuckets.get(bucketKey(Math.floor(x / BUCKET_DEG), Math.floor(y / BUCKET_DEG))) ?? []) {
    const [x0, y0, x1, y1] = kabs[i].bbox;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    for (const [outer, ...holes] of kabs[i].polygons) {
      if (pointInRing(point, outer) && !holes.some((hole) => pointInRing(point, hole))) return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Fire climate per province

const SEASONS = {
  // Sumatra and Kalimantan peatlands: long dry season Jul–Oct, small peak Feb–Mar (Riau).
  gambut: [0.15, 0.3, 0.35, 0.12, 0.12, 0.3, 0.8, 1.3, 1.6, 1.1, 0.25, 0.08],
  // Nusa Tenggara savanna: dry May–Nov.
  sabana: [0.05, 0.05, 0.05, 0.15, 0.4, 0.7, 0.9, 1.3, 1.5, 1.4, 0.6, 0.1],
  // Southern Papua lowlands: later peak, Sep–Nov.
  papua: [0.05, 0.05, 0.05, 0.05, 0.1, 0.2, 0.4, 0.8, 1.3, 1.6, 1.4, 0.5],
  // Wetter regions: little seasonality.
  basah: [0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 1.0, 0.8, 0.4, 0.3],
} as const;

interface FireClimate {
  /** Relative fire activity per km² of land. */
  weight: number;
  season: readonly number[];
  /** 0..1, how wet the area is (rain, humidity). */
  wetness: number;
}

const FIRE: Record<string, FireClimate> = {
  riau: { weight: 1.0, season: SEASONS.gambut, wetness: 0.2 },
  jambi: { weight: 0.75, season: SEASONS.gambut, wetness: 0.25 },
  "sumatera-selatan": { weight: 1.25, season: SEASONS.gambut, wetness: 0.2 },
  "kalimantan-barat": { weight: 1.1, season: SEASONS.gambut, wetness: 0.3 },
  "kalimantan-tengah": { weight: 1.4, season: SEASONS.gambut, wetness: 0.15 },
  "kalimantan-selatan": { weight: 0.65, season: SEASONS.gambut, wetness: 0.3 },
  "kalimantan-timur": { weight: 0.6, season: SEASONS.gambut, wetness: 0.4 },
  "nusa-tenggara-timur": { weight: 1.1, season: SEASONS.sabana, wetness: 0.12 },
  papua: { weight: 0.35, season: SEASONS.papua, wetness: 0.6 },
  lampung: { weight: 0.3, season: SEASONS.gambut, wetness: 0.45 },
  "kepulauan-bangka-belitung": { weight: 0.2, season: SEASONS.gambut, wetness: 0.45 },
  "sumatera-utara": { weight: 0.15, season: SEASONS.gambut, wetness: 0.6 },
  aceh: { weight: 0.1, season: SEASONS.gambut, wetness: 0.65 },
  "kalimantan-utara": { weight: 0.15, season: SEASONS.gambut, wetness: 0.6 },
  "nusa-tenggara-barat": { weight: 0.3, season: SEASONS.sabana, wetness: 0.3 },
  "sulawesi-selatan": { weight: 0.12, season: SEASONS.sabana, wetness: 0.5 },
  "sulawesi-tenggara": { weight: 0.15, season: SEASONS.sabana, wetness: 0.5 },
  "sulawesi-tengah": { weight: 0.1, season: SEASONS.basah, wetness: 0.6 },
  "sulawesi-barat": { weight: 0.06, season: SEASONS.basah, wetness: 0.6 },
  gorontalo: { weight: 0.07, season: SEASONS.sabana, wetness: 0.5 },
  "jawa-timur": { weight: 0.12, season: SEASONS.sabana, wetness: 0.45 },
  "jawa-tengah": { weight: 0.06, season: SEASONS.sabana, wetness: 0.55 },
  "papua-barat": { weight: 0.08, season: SEASONS.papua, wetness: 0.7 },
  maluku: { weight: 0.06, season: SEASONS.papua, wetness: 0.7 },
  "dki-jakarta": { weight: 0.005, season: SEASONS.basah, wetness: 0.6 },
};
const DEFAULT_FIRE: FireClimate = { weight: 0.05, season: SEASONS.basah, wetness: 0.6 };
const fireOf = (provinsi: string) => FIRE[provinsi] ?? DEFAULT_FIRE;

/** Provinces with grid cells and a risk prediction; every other region has 0 cells ("not computed"). */
const PREDICTED_PROVINCES = new Set([
  "riau",
  "jambi",
  "sumatera-selatan",
  "kalimantan-barat",
  "kalimantan-tengah",
  "kalimantan-selatan",
  "kalimantan-timur",
]);
/** Predicted provinces whose cells have no peat data yet (is_gambut null). */
const NO_PEAT_DATA = new Set(["kalimantan-selatan", "kalimantan-timur"]);

/** Only the southern lowlands of Papua burn regularly; the highlands and the north are wet. */
function localFactor(provinsi: string, [, lat]: Position): number {
  if (provinsi === "papua") return lat < -6.3 ? 1.8 : 0.08;
  return 1;
}

// ---------------------------------------------------------------------------
// Grid (~5 km cells) and peatland

const CELL = 0.045;
const ORIGIN: Position = [95.0, -11.1];
const COLS = Math.ceil((141.1 - ORIGIN[0]) / CELL);
const ROWS = Math.ceil((6.1 - ORIGIN[1]) / CELL);

interface Cell {
  row: number;
  col: number;
  center: Position;
  kab: number;
  gambut: boolean;
  ndvi: number;
}

const cells: Cell[] = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const center: Position = [ORIGIN[0] + (col + 0.5) * CELL, ORIGIN[1] + (row + 0.5) * CELL];
    const kab = kabAt(center);
    if (kab >= 0) cells.push({ row, col, center, kab, gambut: false, ndvi: 0 });
  }
}

/** Large peat domes: [lon, lat, amplitude, radius in degrees]. */
const PEAT_BLOBS: [number, number, number, number][] = [
  // Riau
  [102.5, 0.45, 1.1, 0.45], [101.8, 1.4, 1.0, 0.35], [103.0, -0.3, 1.0, 0.4], [102.75, 1.0, 1.0, 0.3], [101.2, 1.8, 0.8, 0.3],
  // Jambi
  [103.8, -1.2, 1.0, 0.35], [104.0, -1.65, 0.8, 0.25],
  // South Sumatra (OKI, Banyuasin, Musi Banyuasin)
  [105.3, -3.2, 1.1, 0.45], [104.7, -2.55, 1.0, 0.35], [105.6, -2.75, 0.9, 0.3],
  // West Kalimantan
  [109.5, -0.3, 1.0, 0.4], [110.0, -1.7, 1.0, 0.4], [112.2, 0.8, 0.8, 0.35], [109.2, 0.9, 0.7, 0.25],
  // Central Kalimantan
  [114.0, -2.6, 1.2, 0.5], [113.3, -2.9, 1.1, 0.45], [114.5, -2.1, 1.0, 0.4], [112.6, -2.9, 1.0, 0.4], [111.8, -2.9, 0.9, 0.35],
  // South Kalimantan
  [114.75, -2.6, 0.9, 0.3], [115.0, -3.0, 0.7, 0.25],
  // East Kalimantan (Mahakam)
  [116.5, -0.3, 0.8, 0.35], [116.9, 0.5, 0.6, 0.25],
  // Southern Papua
  [139.5, -7.5, 1.0, 0.6], [138.8, -6.8, 0.9, 0.5], [139.9, -8.1, 0.8, 0.4],
  // Smaller ones: Bintuni, Aceh west coast, North Sumatra east coast
  [133.5, -2.1, 0.7, 0.3], [96.5, 3.95, 0.7, 0.25], [100.1, 2.4, 0.7, 0.3],
];
cells.forEach((cell) => {
  const [x, y] = cell.center;
  let value = gaussian(0, 0.08);
  for (const [bx, by, amp, radius] of PEAT_BLOBS) {
    if (Math.abs(x - bx) > radius * 4 || Math.abs(y - by) > radius * 4) continue;
    const d2 = (x - bx) ** 2 + (y - by) ** 2;
    value += amp * Math.exp(-d2 / (2 * radius ** 2));
  }
  cell.gambut = value > 0.55;
  const provinsi = kabs[cell.kab].provinsi;
  const base = cell.gambut ? 0.46 : provinsi === "nusa-tenggara-timur" ? 0.38 : provinsi === "papua" && y > -6 ? 0.68 : 0.56;
  cell.ndvi = round(clamp(gaussian(base, 0.11), 0.1, 0.9), 2);
});
const peatCount = cells.filter((c) => c.gambut).length;

// Fire weight per cell and month, with lognormal local variation.
const cellHeat = cells.map(() => Math.exp(gaussian(0, 0.7)));
const cellWeight = (i: number, month: number) => {
  const cell = cells[i];
  const provinsi = kabs[cell.kab].provinsi;
  const fire = fireOf(provinsi);
  return fire.weight * fire.season[month] * (cell.gambut ? 4 : 1) * localFactor(provinsi, cell.center) * cellHeat[i];
};
const cumulative = Array.from({ length: 12 }, (_, month) => {
  const sums = new Float64Array(cells.length);
  let total = 0;
  for (let i = 0; i < cells.length; i++) {
    total += cellWeight(i, month);
    sums[i] = total;
  }
  return sums;
});
function pickCell(month: number): Cell {
  const sums = cumulative[month];
  const r = rand() * sums[sums.length - 1];
  let lo = 0;
  let hi = sums.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sums[mid] < r) lo = mid + 1;
    else hi = mid;
  }
  return cells[lo];
}

// ---------------------------------------------------------------------------
// Hotspots (24 months)

const SATELLITES = ["VIIRS_SNPP", "VIIRS_NOAA20", "VIIRS_NOAA21", "MODIS"] as const;
const MODIS = SATELLITES.indexOf("MODIS");
const CONFIDENCES = ["low", "nominal", "high"] as const;

/** National mean daily hotspots per unit of monthly fire intensity. */
const MONTHLY_INTENSITY = cumulative.map((sums) => sums[sums.length - 1]);
const MEAN_INTENSITY = MONTHLY_INTENSITY.reduce((a, b) => a + b, 0) / 12;
const MEAN_DAILY = 260;
const YEAR_FACTOR: Record<number, number> = { 2024: 1.0, 2025: 0.7, 2026: 1.3 };

const [endYear, endMonth] = END_DATE.split("-").map(Number);
const startMonthIndex = endYear * 12 + (endMonth - 1) - 23;
const START_DATE = `${Math.floor(startMonthIndex / 12)}-${String((startMonthIndex % 12) + 1).padStart(2, "0")}-01`;

interface FireCenter {
  pos: Position;
  kab: number;
  intensity: number;
  daysLeft: number;
  sigma: number;
}

interface RawHotspot {
  pos: Position;
  hhmm: number;
  sat: number;
  conf: number;
  frp: number;
  kab: number;
}

function jitterInCell(cell: Cell): { pos: Position; kab: number } {
  for (let attempt = 0; attempt < 4; attempt++) {
    const pos: Position = [cell.center[0] + uniform(-CELL / 2, CELL / 2), cell.center[1] + uniform(-CELL / 2, CELL / 2)];
    const kab = kabAt(pos);
    if (kab >= 0) return { pos, kab };
  }
  return { pos: cell.center, kab: cell.kab };
}

function spawnCenter(month: number): FireCenter {
  const cell = pickCell(month);
  const { pos, kab } = jitterInCell(cell);
  return {
    pos,
    kab,
    intensity: Math.exp(gaussian(Math.log(6), 0.6)),
    daysLeft: 2 + Math.floor(Math.log(Math.max(rand(), 1e-9)) / Math.log(0.72)),
    sigma: uniform(0.01, 0.03),
  };
}

/** Overpass time in WIB as HHmm. */
function detectionTime(sat: number): number {
  const day = rand() < 0.75;
  let minutes: number;
  if (sat === MODIS) minutes = day ? (rand() < 0.5 ? 10 * 60 + 20 : 13 * 60 + 20) + randInt(0, 40) : 22 * 60 + 20 + randInt(0, 40);
  else minutes = (day ? 13 * 60 : 60) + randInt(0, 80);
  return Math.floor(minutes / 60) * 100 + (minutes % 60);
}

const totalDays = 1 + Math.round((Date.parse(END_DATE) - Date.parse(START_DATE)) / 86_400_000);
const days: RawHotspot[][] = [];
let activeCenters: FireCenter[] = [];
let noise = 0;

for (let d = 0; d < totalDays; d++) {
  const date = addDaysIso(START_DATE, d);
  const [year, month] = date.split("-").map(Number);
  const daysToEnd = totalDays - 1 - d;
  noise = 0.7 * noise + gaussian(0, 0.35);
  let lambda = (MEAN_DAILY * MONTHLY_INTENSITY[month - 1]) / MEAN_INTENSITY * (YEAR_FACTOR[year] ?? 1) * Math.exp(noise);
  if (daysToEnd < 7) lambda = Math.max(lambda, 950 + 40 * (7 - daysToEnd));
  let count = poisson(lambda);
  if (daysToEnd === 0) count = Math.max(count, 1150);

  // Keep enough active fire centers for today's activity.
  activeCenters = activeCenters
    .filter((c) => c.daysLeft-- > 0)
    .map((c) => ({ ...c, intensity: c.intensity * Math.exp(gaussian(0, 0.35)) }));
  const targetCenters = Math.max(1, Math.round(count / 9));
  while (activeCenters.length < targetCenters) activeCenters.push(spawnCenter(month - 1));
  const totalIntensity = activeCenters.reduce((sum, c) => sum + c.intensity, 0);

  const todays: RawHotspot[] = [];
  for (let k = 0; k < count; k++) {
    let pos: Position;
    let kab: number;
    if (rand() < 0.85) {
      // Weighted pick of a fire center, then a point around it that is still on land.
      let r = rand() * totalIntensity;
      let center = activeCenters[0];
      for (const c of activeCenters) {
        r -= c.intensity;
        if (r <= 0) {
          center = c;
          break;
        }
      }
      pos = center.pos;
      kab = center.kab;
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate: Position = [gaussian(center.pos[0], center.sigma), gaussian(center.pos[1], center.sigma)];
        const at = kabAt(candidate);
        if (at >= 0) {
          pos = candidate;
          kab = at;
          break;
        }
      }
    } else {
      ({ pos, kab } = jitterInCell(pickCell(month - 1)));
    }
    // VIIRS on NOAA-20 and NOAA-21 share one orbit, half an orbit apart: they split one share.
    const pick = rand() < 0.4 ? 0 : rand() < 0.67 ? 1 : 2;
    const sat = pick === 0 ? 0 : pick === 1 ? 1 + (k % 2) : MODIS;
    const frp = round(clamp(Math.exp(gaussian(Math.log(6), 0.9)), 0.3, 250), 1);
    let conf: number;
    const r = rand();
    if (frp > 15) conf = r < 0.6 ? 2 : 1;
    else conf = r < 0.18 ? 0 : r < 0.9 ? 1 : 2;
    todays.push({ pos: [round4(pos[0]), round4(pos[1])], hhmm: detectionTime(sat), sat, conf, frp, kab });
  }
  todays.sort((a, b) => a.hhmm - b.hhmm);
  days.push(todays);
}
const totalHotspots = days.reduce((sum, list) => sum + list.length, 0);

// ---------------------------------------------------------------------------
// Fire zones for the latest day (DBSCAN + convex hull)

const latest = days[days.length - 1];
const latestPoints = latest.map((h) => h.pos);

function bucketIndex(points: Position[], size: number) {
  const index = new Map<string, number[]>();
  points.forEach(([x, y], i) => {
    const key = bucketKey(Math.floor(x / size), Math.floor(y / size));
    index.set(key, [...(index.get(key) ?? []), i]);
  });
  return index;
}

function dbscan(points: Position[], eps: number, minPts: number): number[] {
  const labels = new Array<number>(points.length).fill(-2); // -2 unvisited, -1 noise
  const index = bucketIndex(points, eps);
  const neighbors = (i: number) => {
    const [x, y] = points[i];
    const bx = Math.floor(x / eps);
    const by = Math.floor(y / eps);
    const found: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of index.get(bucketKey(bx + dx, by + dy)) ?? []) {
          if (Math.hypot(points[j][0] - x, points[j][1] - y) <= eps) found.push(j);
        }
      }
    }
    return found;
  };
  let cluster = 0;
  for (let i = 0; i < points.length; i++) {
    if (labels[i] !== -2) continue;
    const seeds = neighbors(i);
    if (seeds.length < minPts) {
      labels[i] = -1;
      continue;
    }
    labels[i] = cluster;
    const queue = seeds.filter((j) => j !== i);
    while (queue.length > 0) {
      const j = queue.shift()!;
      if (labels[j] === -1) labels[j] = cluster;
      if (labels[j] !== -2) continue;
      labels[j] = cluster;
      const more = neighbors(j);
      if (more.length >= minPts) queue.push(...more);
    }
    cluster++;
  }
  return labels;
}

const labels = dbscan(latestPoints, 0.04, 3);
const groups = new Map<number, number[]>();
labels.forEach((label, i) => {
  if (label < 0) return;
  groups.set(label, [...(groups.get(label) ?? []), i]);
});

const dayIndexOf = (date: string) => Math.round((Date.parse(date) - Date.parse(START_DATE)) / 86_400_000);
const dayBuckets = new Map<number, Map<string, number[]>>();
function countNear(date: string, members: Position[], radius = 0.04): number {
  const d = dayIndexOf(date);
  const points = (days[d] ?? []).map((h) => h.pos);
  let index = dayBuckets.get(d);
  if (!index) {
    index = bucketIndex(points, radius);
    dayBuckets.set(d, index);
  }
  const seen = new Set<number>();
  for (const [x, y] of members) {
    const bx = Math.floor(x / radius);
    const by = Math.floor(y / radius);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of index.get(bucketKey(bx + dx, by + dy)) ?? []) {
          if (!seen.has(j) && Math.hypot(points[j][0] - x, points[j][1] - y) <= radius) seen.add(j);
        }
      }
    }
  }
  return seen.size;
}

const BUFFER = 0.008;
const sortedGroups = [...groups.values()].sort((a, b) => b.length - a.length).slice(0, 45);
const clusterFeatures: ClusterFeature[] = sortedGroups.map((indices, n) => {
  const members = indices.map((i) => latestPoints[i]);
  const expanded = members.flatMap(([x, y]) =>
    Array.from({ length: 8 }, (_, k) => {
      const angle = (k / 8) * 2 * Math.PI;
      return [x + BUFFER * Math.cos(angle), y + BUFFER * Math.sin(angle)] as Position;
    }),
  );
  const hull = convexHull(expanded).map(([x, y]) => [round4(x), round4(y)] as Position);
  const yesterday = countNear(addDaysIso(END_DATE, -1), members);
  const twoDaysAgo = countNear(addDaysIso(END_DATE, -2), members);
  let status: ClusterStatus;
  if (yesterday === 0 && twoDaysAgo === 0) status = "baru";
  else if (members.length > yesterday * 1.25) status = "meluas";
  else if (members.length < yesterday * 0.8) status = "menyusut";
  else status = "stabil";
  let since = 0;
  if (status !== "baru") {
    while (since < 30 && countNear(addDaysIso(END_DATE, -(since + 1)), members) > 0) since++;
  }
  const votes = new Map<number, number>();
  for (const i of indices) votes.set(latest[i].kab, (votes.get(latest[i].kab) ?? 0) + 1);
  const kab = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [closeRing(hull)] },
    properties: {
      id: `CL-${END_DATE.replaceAll("-", "")}-${String(n + 1).padStart(2, "0")}`,
      tanggal: END_DATE,
      jumlah_hotspot: members.length,
      luas_km2: round(ringAreaKm2(hull), 1),
      status,
      aktif_sejak: addDaysIso(END_DATE, -since),
      provinsi: kabs[kab].provinsi,
      kabupaten: kabs[kab].slug,
    },
  };
});

// ---------------------------------------------------------------------------
// Weather: snapshot for END_DATE plus a 7-day forecast used by the risk model

interface DayWeather {
  dry: number;
  humidity: number;
  rain: number;
}

const forecast: DayWeather[][] = kabs.map((kab, i) => {
  const label = boundaries.features[i].properties.label;
  // Southern Papua is as dry as the savanna in the late dry season.
  const climate = kab.provinsi === "papua" && label[1] < -6.3 ? 0.25 : fireOf(kab.provinsi).wetness;
  const wetness = clamp(climate + gaussian(0, 0.1), 0.05, 0.95);
  let dry = Math.round(clamp(gaussian(30 - 26 * wetness, 3), 0, 35));
  let humidity = Math.round(clamp(gaussian(80 - dry * 1.1, 3), 42, 94));
  const list: DayWeather[] = [{ dry, humidity, rain: dry === 0 ? round(uniform(3, 22), 1) : 0 }];
  for (let t = 1; t <= 7; t++) {
    const rains = rand() < 0.06 + 0.25 * wetness;
    if (rains) {
      dry = 0;
      humidity = Math.round(clamp(humidity + uniform(8, 15), 42, 96));
    } else {
      dry += 1;
      humidity = Math.round(clamp(humidity - uniform(0, 2.5), 40, 96));
    }
    list.push({ dry, humidity, rain: rains ? round(uniform(4, 30), 1) : 0 });
  }
  return list;
});

const weather: MockWeather = {
  tanggal: END_DATE,
  data: Object.fromEntries(
    kabs.map((kab, i): [string, WeatherSnapshot] => {
      const today = forecast[i][0];
      return [
        kab.slug,
        {
          tanggal: END_DATE,
          suhu_c: round(uniform(29.5, 34.5), 1),
          kelembapan_persen: today.humidity,
          curah_hujan_mm: today.rain,
          kecepatan_angin_kmh: round(uniform(5, 19), 1),
          hari_tanpa_hujan: today.dry,
        },
      ];
    }),
  ),
};

// ---------------------------------------------------------------------------
// Risk prediction for the next 7 days

// Hotspots in the last 7 days, bucketed for neighbour lookups within ~10 km.
const NEAR = 0.09;
const recentPoints = days.slice(-7).flat().map((h) => h.pos);
const recentIndex = bucketIndex(recentPoints, NEAR);
const nearbyCounts = cells.map(({ center: [x, y] }) => {
  const bx = Math.floor(x / NEAR);
  const by = Math.floor(y / NEAR);
  let total = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const j of recentIndex.get(bucketKey(bx + dx, by + dy)) ?? []) {
        if (Math.hypot(recentPoints[j][0] - x, recentPoints[j][1] - y) <= NEAR) total++;
      }
    }
  }
  return total;
});

const targets = Array.from({ length: 7 }, (_, t) => addDaysIso(END_DATE, t + 1));
const peatOf = (cell: Cell): boolean | null => (NO_PEAT_DATA.has(kabs[cell.kab].provinsi) ? null : cell.gambut);
/** Indices of the cells that are written out (predicted provinces only). */
const predicted = cells.flatMap((cell, i) => (PREDICTED_PROVINCES.has(kabs[cell.kab].provinsi) ? [i] : []));
const cellNoise = cells.map(() => gaussian(0, 0.25));
const risk: MockRisk = { tanggal_prediksi: END_DATE, targets, scores: [], cuaca: [] };

targets.forEach((_, t) => {
  risk.cuaca.push(forecast.map((list) => [list[t + 1].dry, list[t + 1].humidity]));
  // Every cell is scored (keeps the random sequence stable), only the predicted ones are kept.
  const scores = cells.map((cell, i) => {
    const day = forecast[cell.kab][t + 1];
    const values = contributionValues({
      dry: day.dry,
      humidity: day.humidity,
      gambut: peatOf(cell),
      hotspots: nearbyCounts[i],
      ndvi: cell.ndvi,
      dayOffset: t,
    });
    const logit = RISK_INTERCEPT + values.reduce((sum, v) => sum + v, 0) + cellNoise[i] + gaussian(0, 0.08);
    return Math.round(1000 / (1 + Math.exp(-logit)));
  });
  risk.scores.push(predicted.map((i) => scores[i]));
});

// ---------------------------------------------------------------------------
// Write files

const kabSlugs = kabs.map((k) => k.slug);
const kabProvinces = kabs.map((k) => k.provinsi);

const grid: MockGrid = {
  cell_size: CELL,
  origin: ORIGIN,
  kabupaten: kabSlugs,
  provinsi: kabProvinces,
  cells: predicted.map((i) => {
    const c = cells[i];
    const peat = peatOf(c);
    return [c.row, c.col, c.kab, peat === null ? null : peat ? 1 : 0, Math.round(c.ndvi * 100), nearbyCounts[i]];
  }),
};

const hotspotFile: MockHotspots = {
  start: START_DATE,
  kabupaten: kabSlugs,
  provinsi: kabProvinces,
  satelit: [...SATELLITES],
  confidence: [...CONFIDENCES],
  days: days.map((list) => list.map((h) => [h.pos[0], h.pos[1], h.hhmm, h.sat, h.conf, h.frp, h.kab])),
};

const status = {
  terakhir_diperbarui: `${END_DATE}T15:10:00+07:00`,
  tanggal_data: END_DATE,
  prediksi_mulai: targets[0],
  prediksi_sampai: targets[targets.length - 1],
  sumber: "mock" as const,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const write = (name: string, data: unknown) => {
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, JSON.stringify(data));
  return fs.statSync(file).size;
};

const sizes = {
  "grid.json": write("grid.json", grid),
  "hotspots.json": write("hotspots.json", hotspotFile),
  "clusters.geojson": write("clusters.geojson", { type: "FeatureCollection", features: clusterFeatures }),
  "risk.json": write("risk.json", risk),
  "weather.json": write("weather.json", weather),
  "status.json": write("status.json", status),
};

// ---------------------------------------------------------------------------
// Summary

const levelCounts = risk.scores[0].reduce<Record<string, number>>((acc, s) => {
  const level = getRiskLevel(s / 1000);
  acc[level] = (acc[level] ?? 0) + 1;
  return acc;
}, {});
const latestByProvince = new Map<string, number>();
for (const h of latest) latestByProvince.set(kabs[h.kab].provinsi, (latestByProvince.get(kabs[h.kab].provinsi) ?? 0) + 1);

console.log(`Rentang data    : ${START_DATE} s.d. ${END_DATE}`);
const predictedPeat = predicted.filter((i) => peatOf(cells[i]) === true).length;
const predictedNoPeatData = predicted.filter((i) => peatOf(cells[i]) === null).length;
console.log(`Kotak daratan   : ${cells.length} (gambut ${peatCount})`);
console.log(
  `Kotak grid      : ${predicted.length} di ${PREDICTED_PROVINCES.size} provinsi (gambut ${predictedPeat}, tanpa data gambut ${predictedNoPeatData})`,
);
console.log(`Hotspot         : ${totalHotspots} (hari terakhir ${latest.length})`);
console.log(
  `Hari terakhir   : ${[...latestByProvince.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([p, n]) => `${p} ${n}`)
    .join(", ")}`,
);
console.log(`Zona            : ${clusterFeatures.length}`);
console.log(`Level risiko H+1: ${JSON.stringify(levelCounts)}`);
const monthly = new Map<string, number>();
days.forEach((list, d) => {
  const key = addDaysIso(START_DATE, d).slice(0, 7);
  monthly.set(key, (monthly.get(key) ?? 0) + list.length);
});
console.log(`Per bulan       : ${[...monthly.entries()].map(([m, n]) => `${m}=${n}`).join(" ")}`);
let totalSize = 0;
for (const [name, size] of Object.entries(sizes)) {
  totalSize += size;
  console.log(`  mock/${name.padEnd(17)} ${(size / 1024).toFixed(0).padStart(6)} KB`);
}
console.log(`  total (tanpa batas wilayah) ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
