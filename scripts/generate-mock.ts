/**
 * Generates deterministic mock data for SiAPI into `mock/`.
 *
 *   pnpm mock:generate                     # latest data date = DEFAULT_END_DATE
 *   MOCK_END_DATE=2026-11-01 pnpm mock:generate
 *
 * Region boundaries are placeholders (a rough province outline split with a weighted
 * Voronoi / power diagram). Replace them with GADM/BIG boundaries later.
 */
import fs from "node:fs";
import path from "node:path";
import { faker } from "@faker-js/faker";
import { addDaysIso } from "../lib/format";
import {
  closeRing,
  convexHull,
  pointInRing,
  ringAreaKm2,
  round4,
} from "../lib/geo";
import { getRiskLevel } from "../lib/risk";
import type {
  ClusterFeature,
  ClusterStatus,
  Position,
  RegionBoundaryFeature,
  WeatherSnapshot,
} from "../types";
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
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

// ---------------------------------------------------------------------------
// Regions (placeholder geometry)

interface RegionSeed {
  id: string;
  slug: string;
  nama: string;
  level: "kabupaten" | "kota";
  center: Position;
  /** Power-diagram weight in deg²; negative shrinks the region (used for cities). */
  weight: number;
  /** 0..1, how wet the area is (more rain, fewer dry days). */
  wetness: number;
}

const REGION_SEEDS: RegionSeed[] = [
  { id: "1401", slug: "kuantan-singingi", nama: "Kuantan Singingi", level: "kabupaten", center: [101.45, -0.5], weight: 0, wetness: 0.7 },
  { id: "1402", slug: "indragiri-hulu", nama: "Indragiri Hulu", level: "kabupaten", center: [102.3, -0.5], weight: 0, wetness: 0.55 },
  { id: "1403", slug: "indragiri-hilir", nama: "Indragiri Hilir", level: "kabupaten", center: [103.2, -0.3], weight: 0.05, wetness: 0.3 },
  { id: "1404", slug: "pelalawan", nama: "Pelalawan", level: "kabupaten", center: [102.25, 0.25], weight: 0.05, wetness: 0.25 },
  { id: "1405", slug: "siak", nama: "Siak", level: "kabupaten", center: [101.95, 0.9], weight: 0, wetness: 0.3 },
  { id: "1406", slug: "kampar", nama: "Kampar", level: "kabupaten", center: [100.95, 0.3], weight: 0.03, wetness: 0.65 },
  { id: "1407", slug: "rokan-hulu", nama: "Rokan Hulu", level: "kabupaten", center: [100.45, 0.95], weight: 0, wetness: 0.75 },
  { id: "1408", slug: "bengkalis", nama: "Bengkalis", level: "kabupaten", center: [101.55, 1.25], weight: 0, wetness: 0.25 },
  { id: "1409", slug: "rokan-hilir", nama: "Rokan Hilir", level: "kabupaten", center: [100.85, 1.85], weight: 0.04, wetness: 0.35 },
  { id: "1410", slug: "kepulauan-meranti", nama: "Kepulauan Meranti", level: "kabupaten", center: [102.75, 1.05], weight: -0.02, wetness: 0.2 },
  { id: "1471", slug: "pekanbaru", nama: "Pekanbaru", level: "kota", center: [101.45, 0.52], weight: -0.2, wetness: 0.5 },
  { id: "1473", slug: "dumai", nama: "Dumai", level: "kota", center: [101.45, 1.65], weight: -0.16, wetness: 0.35 },
];

/** Rough counter-clockwise outline of Riau province. */
const PROVINCE_OUTLINE: Position[] = [
  [100.05, 1.05],
  [100.15, 0.55],
  [100.45, 0.2],
  [100.8, -0.25],
  [101.1, -0.7],
  [101.6, -1.05],
  [102.1, -0.95],
  [102.8, -1.05],
  [103.45, -1.0],
  [103.72, -0.5],
  [103.8, 0.05],
  [103.55, 0.55],
  [103.1, 0.9],
  [102.95, 1.25],
  [102.4, 1.45],
  [101.85, 1.75],
  [101.45, 1.8],
  [101.1, 2.3],
  [100.85, 2.7],
  [100.55, 2.25],
  [100.3, 1.6],
];

function clipHalfPlane(poly: Position[], a: Position, b: number): Position[] {
  // Keeps points x where a·x <= b (Sutherland–Hodgman against one half-plane).
  const out: Position[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const fc = a[0] * cur[0] + a[1] * cur[1] - b;
    const fp = a[0] * prev[0] + a[1] * prev[1] - b;
    const intersect = (): Position => {
      const t = fp / (fp - fc);
      return [prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])];
    };
    if (fc <= 0) {
      if (fp > 0) out.push(intersect());
      out.push(cur);
    } else if (fp <= 0) {
      out.push(intersect());
    }
  }
  return out;
}

function powerCell(index: number): Position[] {
  const ci = REGION_SEEDS[index];
  let poly = PROVINCE_OUTLINE;
  REGION_SEEDS.forEach((cj, j) => {
    if (j === index) return;
    const [xi, yi] = ci.center;
    const [xj, yj] = cj.center;
    const a: Position = [2 * (xj - xi), 2 * (yj - yi)];
    const b = xj * xj + yj * yj - (xi * xi + yi * yi) - cj.weight + ci.weight;
    poly = clipHalfPlane(poly, a, b);
  });
  return poly;
}

function regionIndexAt([x, y]: Position): number {
  let best = 0;
  let bestDist = Infinity;
  REGION_SEEDS.forEach((seed, i) => {
    const d = (x - seed.center[0]) ** 2 + (y - seed.center[1]) ** 2 - seed.weight;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

const inProvince = (p: Position) => pointInRing(p, PROVINCE_OUTLINE);

const regionRings = REGION_SEEDS.map((_, i) =>
  closeRing(powerCell(i).map(([x, y]) => [round4(x), round4(y)] as Position)),
);
const regionFeatures: RegionBoundaryFeature[] = REGION_SEEDS.map((seed, i) => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [regionRings[i]] },
  properties: { id: seed.id, slug: seed.slug, nama: seed.nama, level: seed.level },
}));

// ---------------------------------------------------------------------------
// Grid (~5 km cells) and peatland

const CELL = 0.045;
const ORIGIN: Position = [100.0, -1.1];
const COLS = Math.ceil(3.8 / CELL);
const ROWS = Math.ceil(4.0 / CELL);

interface Cell {
  row: number;
  col: number;
  center: Position;
  region: number;
  gambut: boolean;
  ndvi: number;
}

const cells: Cell[] = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const center: Position = [ORIGIN[0] + (col + 0.5) * CELL, ORIGIN[1] + (row + 0.5) * CELL];
    if (!inProvince(center)) continue;
    cells.push({ row, col, center, region: regionIndexAt(center), gambut: false, ndvi: 0 });
  }
}

// Peat: clustered blobs biased towards the east/coast, then take the top 40%.
const blobs = Array.from({ length: 30 }, () => ({
  center: [100.3 + 3.4 * Math.sqrt(rand()), uniform(-1.0, 2.5)] as Position,
  amp: uniform(0.6, 1.2),
  radius: uniform(0.15, 0.45),
}));
const peatField = cells.map((cell) => {
  const [x, y] = cell.center;
  let value = 1.1 * ((x - 100) / 3.8) ** 2 + gaussian(0, 0.08);
  for (const blob of blobs) {
    const d2 = (x - blob.center[0]) ** 2 + (y - blob.center[1]) ** 2;
    value += blob.amp * Math.exp(-d2 / (2 * blob.radius ** 2));
  }
  return value;
});
const peatThreshold = [...peatField].sort((a, b) => b - a)[Math.floor(cells.length * 0.4)];
cells.forEach((cell, i) => {
  cell.gambut = peatField[i] > peatThreshold;
  cell.ndvi = round(clamp(gaussian(cell.gambut ? 0.46 : 0.55, 0.12), 0.12, 0.88), 2);
});
const peatCells = cells.filter((c) => c.gambut);

// ---------------------------------------------------------------------------
// Hotspots (24 months)

const SATELLITES = ["VIIRS_SNPP", "VIIRS_NOAA20", "MODIS"] as const;
const CONFIDENCES = ["low", "nominal", "high"] as const;

/** Mean daily hotspots per month (index 0 = January). Peak season Jul–Oct. */
const MONTH_BASE = [12, 30, 40, 14, 10, 28, 85, 135, 125, 100, 14, 7];
const YEAR_FACTOR: Record<number, number> = { 2024: 1.0, 2025: 0.8, 2026: 1.25 };

const [endYear, endMonth] = END_DATE.split("-").map(Number);
const startMonthIndex = endYear * 12 + (endMonth - 1) - 23;
const START_DATE = `${Math.floor(startMonthIndex / 12)}-${String((startMonthIndex % 12) + 1).padStart(2, "0")}-01`;

interface FireCenter {
  pos: Position;
  intensity: number;
  daysLeft: number;
  sigma: number;
}

interface RawHotspot {
  pos: Position;
  date: string;
  time: string;
  sat: number;
  conf: number;
  frp: number;
  region: number;
}

function jitterCellCenter(cell: Cell): Position {
  return [cell.center[0] + uniform(-CELL / 2, CELL / 2), cell.center[1] + uniform(-CELL / 2, CELL / 2)];
}

function spawnCenter(): FireCenter {
  const cell = rand() < 0.85 ? pick(peatCells) : pick(cells);
  return {
    pos: jitterCellCenter(cell),
    intensity: Math.exp(gaussian(Math.log(6), 0.6)),
    daysLeft: 2 + Math.floor(Math.log(Math.max(rand(), 1e-9)) / Math.log(0.72)),
    sigma: uniform(0.01, 0.03),
  };
}

function detectionTime(sat: number): string {
  const day = rand() < 0.75;
  let minutes: number;
  if (sat === 2) minutes = day ? (rand() < 0.5 ? 10 * 60 + 20 : 13 * 60 + 20) + randInt(0, 40) : 22 * 60 + 20 + randInt(0, 40);
  else minutes = (day ? 13 * 60 : 60) + randInt(0, 80);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const hotspots: RawHotspot[] = [];
const dailyCounts = new Map<string, number>();
let activeCenters: FireCenter[] = [];
let noise = 0;
const totalDays = 1 + Math.round((Date.parse(END_DATE) - Date.parse(START_DATE)) / 86_400_000);

for (let d = 0; d < totalDays; d++) {
  const date = addDaysIso(START_DATE, d);
  const [year, month] = date.split("-").map(Number);
  const daysToEnd = totalDays - 1 - d;
  noise = 0.7 * noise + gaussian(0, 0.4);
  let lambda = MONTH_BASE[month - 1] * (YEAR_FACTOR[year] ?? 1) * Math.exp(noise);
  if (daysToEnd < 7) lambda = Math.max(lambda, 135 + 8 * (7 - daysToEnd));
  let count = poisson(lambda);
  if (daysToEnd === 0) count = Math.max(count, 185);

  // Keep enough active fire centers for today's activity.
  activeCenters = activeCenters
    .filter((c) => c.daysLeft-- > 0)
    .map((c) => ({ ...c, intensity: c.intensity * Math.exp(gaussian(0, 0.35)) }));
  const targetCenters = Math.max(1, Math.round(count / 9));
  while (activeCenters.length < targetCenters) activeCenters.push(spawnCenter());
  const totalIntensity = activeCenters.reduce((sum, c) => sum + c.intensity, 0);

  const todays: RawHotspot[] = [];
  for (let k = 0; k < count; k++) {
    let pos: Position;
    if (rand() < 0.85) {
      // Weighted pick of a fire center.
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
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate: Position = [gaussian(center.pos[0], center.sigma), gaussian(center.pos[1], center.sigma)];
        if (inProvince(candidate)) {
          pos = candidate;
          break;
        }
      }
    } else {
      pos = jitterCellCenter(pick(cells));
    }
    const sat = rand() < 0.4 ? 0 : rand() < 0.67 ? 1 : 2;
    const frp = round(clamp(Math.exp(gaussian(Math.log(6), 0.9)), 0.3, 250), 1);
    let conf: number;
    const r = rand();
    if (frp > 15) conf = r < 0.6 ? 2 : 1;
    else conf = r < 0.18 ? 0 : r < 0.9 ? 1 : 2;
    todays.push({
      pos: [round4(pos[0]), round4(pos[1])],
      date,
      time: detectionTime(sat),
      sat,
      conf,
      frp,
      region: regionIndexAt(pos),
    });
  }
  todays.sort((a, b) => a.time.localeCompare(b.time));
  hotspots.push(...todays);
  dailyCounts.set(date, count);
}

// ---------------------------------------------------------------------------
// Clusters for the latest day (DBSCAN + convex hull)

function dbscan(points: Position[], eps: number, minPts: number): number[] {
  const labels = new Array<number>(points.length).fill(-2); // -2 unvisited, -1 noise
  const neighbors = (i: number) =>
    points.flatMap((p, j) => (Math.hypot(p[0] - points[i][0], p[1] - points[i][1]) <= eps ? [j] : []));
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

const latestHotspots = hotspots.filter((h) => h.date === END_DATE);
const latestPoints = latestHotspots.map((h) => h.pos);
const labels = dbscan(latestPoints, 0.04, 3);
const groups = new Map<number, number[]>();
labels.forEach((label, i) => {
  if (label < 0) return;
  groups.set(label, [...(groups.get(label) ?? []), i]);
});

const hotspotsByDate = new Map<string, Position[]>();
for (const h of hotspots) {
  const list = hotspotsByDate.get(h.date) ?? [];
  list.push(h.pos);
  hotspotsByDate.set(h.date, list);
}

function countNear(date: string, members: Position[], radius = 0.04): number {
  const points = hotspotsByDate.get(date) ?? [];
  return points.filter((p) => members.some((m) => Math.hypot(p[0] - m[0], p[1] - m[1]) <= radius)).length;
}

const BUFFER = 0.008;
const sortedGroups = [...groups.values()].sort((a, b) => b.length - a.length).slice(0, 15);
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
  const regionVotes = new Map<number, number>();
  indices.forEach((i) => regionVotes.set(latestHotspots[i].region, (regionVotes.get(latestHotspots[i].region) ?? 0) + 1));
  const region = [...regionVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];
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
      kabupaten: REGION_SEEDS[region].slug,
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

const forecast: DayWeather[][] = REGION_SEEDS.map((seed) => {
  let dry = Math.round(clamp(gaussian(20 - 14 * seed.wetness, 3), 0, 26));
  let humidity = Math.round(clamp(gaussian(80 - dry * 1.1, 3), 45, 92));
  const days: DayWeather[] = [{ dry, humidity, rain: dry === 0 ? round(uniform(3, 22), 1) : 0 }];
  for (let t = 1; t <= 7; t++) {
    const rains = rand() < 0.06 + 0.2 * seed.wetness;
    if (rains) {
      dry = 0;
      humidity = Math.round(clamp(humidity + uniform(8, 15), 45, 95));
    } else {
      dry += 1;
      humidity = Math.round(clamp(humidity - uniform(0, 2.5), 42, 95));
    }
    days.push({ dry, humidity, rain: rains ? round(uniform(4, 30), 1) : 0 });
  }
  return days;
});

const weather: MockWeather = {
  tanggal: END_DATE,
  data: Object.fromEntries(
    REGION_SEEDS.map((seed, i): [string, WeatherSnapshot] => {
      const today = forecast[i][0];
      return [
        seed.slug,
        {
          tanggal: END_DATE,
          suhu_c: round(uniform(31, 34.5), 1),
          kelembapan_persen: today.humidity,
          curah_hujan_mm: today.rain,
          kecepatan_angin_kmh: round(uniform(6, 18), 1),
          hari_tanpa_hujan: today.dry,
        },
      ];
    }),
  ),
};

// ---------------------------------------------------------------------------
// Risk prediction for the next 7 days

const FEATURES = ["hari_tanpa_hujan", "kelembapan", "lahan_gambut", "hotspot_sekitar", "ndvi"] as const;
const decimal = (v: number, digits = 2) => v.toFixed(digits).replace(".", ",");

// Hotspots in the last 7 days, bucketed for neighbour lookups within ~10 km.
const BUCKET = 0.09;
const recentBuckets = new Map<string, Position[]>();
const recentStart = addDaysIso(END_DATE, -6);
for (const h of hotspots) {
  if (h.date < recentStart) continue;
  const key = `${Math.floor(h.pos[0] / BUCKET)}:${Math.floor(h.pos[1] / BUCKET)}`;
  recentBuckets.set(key, [...(recentBuckets.get(key) ?? []), h.pos]);
}
const nearbyCounts = cells.map(({ center: [x, y] }) => {
  const bx = Math.floor(x / BUCKET);
  const by = Math.floor(y / BUCKET);
  let total = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const p of recentBuckets.get(`${bx + dx}:${by + dy}`) ?? []) {
        if (Math.hypot(p[0] - x, p[1] - y) <= BUCKET) total++;
      }
    }
  }
  return total;
});

const targets = Array.from({ length: 7 }, (_, t) => addDaysIso(END_DATE, t + 1));
const risk: MockRisk = { tanggal_prediksi: END_DATE, targets, fitur: [...FEATURES], scores: [], factors: [] };
const cellNoise = cells.map(() => gaussian(0, 0.25));

targets.forEach((_, t) => {
  const scores: number[] = [];
  const factors: [number, number, string][][] = [];
  cells.forEach((cell, i) => {
    const day = forecast[cell.region][t + 1];
    const hs = nearbyCounts[i];
    const hsWeight = 1 - 0.06 * t; // older hotspots matter less further ahead
    const contributions: [number, number, string][] = [
      [0, 0.09 * (day.dry - 10), day.dry === 0 ? "Hujan turun sehari sebelumnya" : `${day.dry} hari tanpa hujan`],
      [
        1,
        -0.05 * (day.humidity - 65),
        day.humidity < 65 ? `Kelembapan rendah (${day.humidity}%)` : `Kelembapan tinggi (${day.humidity}%)`,
      ],
      [2, cell.gambut ? 1.1 : -0.35, cell.gambut ? "Lahan gambut" : "Tanah mineral, bukan gambut"],
      [
        3,
        (hs > 0 ? 0.55 * Math.log(1 + hs) - 0.2 : -0.3) * hsWeight,
        hs > 0 ? `${hs} hotspot dalam radius 10 km (7 hari terakhir)` : "Tidak ada hotspot dalam radius 10 km",
      ],
      [
        4,
        -2.5 * (cell.ndvi - 0.5),
        cell.ndvi < 0.5 ? `Vegetasi kering (NDVI ${decimal(cell.ndvi)})` : `Vegetasi rapat (NDVI ${decimal(cell.ndvi)})`,
      ],
    ];
    const logit = -2.2 + contributions.reduce((sum, c) => sum + c[1], 0) + cellNoise[i] + gaussian(0, 0.08);
    scores.push(round(1 / (1 + Math.exp(-logit)), 3));
    factors.push(
      contributions
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 3)
        .map(([f, k, label]) => [f, round(k, 3), label]),
    );
  });
  risk.scores.push(scores);
  risk.factors.push(factors);
});

// ---------------------------------------------------------------------------
// Write files

const grid: MockGrid = {
  cell_size: CELL,
  origin: ORIGIN,
  kabupaten: REGION_SEEDS.map((s) => s.slug),
  cells: cells.map((c) => [c.row, c.col, c.region, c.gambut ? 1 : 0]),
};

const hotspotFile: MockHotspots = {
  kabupaten: REGION_SEEDS.map((s) => s.slug),
  satelit: [...SATELLITES],
  confidence: [...CONFIDENCES],
  rows: hotspots.map((h) => [h.pos[0], h.pos[1], `${h.date}T${h.time}`, h.sat, h.conf, h.frp, h.region]),
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
  "regions.geojson": write("regions.geojson", { type: "FeatureCollection", features: regionFeatures }),
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
  const level = getRiskLevel(s);
  acc[level] = (acc[level] ?? 0) + 1;
  return acc;
}, {});

console.log(`Rentang data   : ${START_DATE} s.d. ${END_DATE}`);
console.log(`Kotak grid     : ${cells.length} (gambut ${peatCells.length})`);
console.log(`Hotspot        : ${hotspots.length} (hari terakhir ${latestHotspots.length})`);
console.log(`Cluster        : ${clusterFeatures.length} – ${clusterFeatures.map((c) => c.properties.status).join(", ")}`);
console.log(`Level risiko H+1: ${JSON.stringify(levelCounts)}`);
console.log(
  "Luas wilayah   :",
  REGION_SEEDS.map((seed, i) => `${seed.slug} ${Math.round(ringAreaKm2(regionRings[i]))} km²`).join(", "),
);
let totalSize = 0;
for (const [name, size] of Object.entries(sizes)) {
  totalSize += size;
  console.log(`  mock/${name.padEnd(17)} ${(size / 1024).toFixed(0).padStart(6)} KB`);
}
console.log(`  total                   ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`Hari terakhir: ${[...dailyCounts.entries()].slice(-7).map(([d, n]) => `${d.slice(5)}=${n}`).join(" ")}`);
