import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { addDaysIso } from "@/lib/format";
import { bboxIntersects, pointInBBox, ringAreaKm2, ringBBox, ringCentroid } from "@/lib/geo";
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
  type RegionDetail,
  type RiskCellFeature,
  type Satellite,
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
import type { DataSource } from "./types";

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
const loadRegions = memo(() => readJson<MockRegions>("regions.geojson"));
const loadClusters = memo(() => readJson<MockClusters>("clusters.geojson"));
const loadWeather = memo(() => readJson<MockWeather>("weather.json"));
const loadRisk = memo(() => readJson<MockRisk>("risk.json"));

interface GridCell {
  id: string;
  kabupaten: string;
  isGambut: boolean;
  ring: Position[];
  bbox: BBox;
}

const loadGrid = memo(async () => {
  const grid = await readJson<MockGrid>("grid.json");
  const [lon0, lat0] = grid.origin;
  const size = grid.cell_size;
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  return grid.cells.map(([row, col, kab, gambut]): GridCell => {
    const minLon = r4(lon0 + col * size);
    const minLat = r4(lat0 + row * size);
    const maxLon = r4(lon0 + (col + 1) * size);
    const maxLat = r4(lat0 + (row + 1) * size);
    return {
      id: `R${String(row).padStart(3, "0")}-C${String(col).padStart(3, "0")}`,
      kabupaten: grid.kabupaten[kab],
      isGambut: gambut === 1,
      ring: [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
      bbox: [minLon, minLat, maxLon, maxLat],
    };
  });
});

interface HotspotIndex {
  byDate: Map<string, HotspotFeature[]>;
  monthly: Map<string, number>; // "YYYY-MM" and "slug|YYYY-MM"
}

const loadHotspots = memo(async (): Promise<HotspotIndex> => {
  const file = await readJson<MockHotspots>("hotspots.json");
  const byDate = new Map<string, HotspotFeature[]>();
  const monthly = new Map<string, number>();
  for (const [lon, lat, time, sat, conf, frp, kab] of file.rows) {
    const date = time.slice(0, 10);
    const list = byDate.get(date) ?? [];
    const kabupaten = file.kabupaten[kab];
    list.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        id: `HS-${date.replaceAll("-", "")}-${String(list.length + 1).padStart(4, "0")}`,
        waktu_deteksi: `${time}:00+07:00`,
        satelit: file.satelit[sat] as Satellite,
        confidence: file.confidence[conf] as Confidence,
        frp,
        kabupaten,
      },
    });
    byDate.set(date, list);
    const month = date.slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + 1);
    monthly.set(`${kabupaten}|${month}`, (monthly.get(`${kabupaten}|${month}`) ?? 0) + 1);
  }
  return { byDate, monthly };
});

const riskFeatureCache = new Map<string, RiskCellFeature[]>();

async function riskFeatures(targetDate: string): Promise<RiskCellFeature[]> {
  const cached = riskFeatureCache.get(targetDate);
  if (cached) return cached;
  const [risk, grid] = await Promise.all([loadRisk(), loadGrid()]);
  const t = risk.targets.indexOf(targetDate);
  if (t < 0) return [];
  const features = grid.map((cell, i): RiskCellFeature => {
    const score = risk.scores[t][i];
    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [cell.ring] },
      properties: {
        cell_id: cell.id,
        tanggal_prediksi: risk.tanggal_prediksi,
        tanggal_target: targetDate,
        skor_risiko: score,
        level_risiko: getRiskLevel(score),
        is_gambut: cell.isGambut,
        faktor: risk.factors[t][i].map(([f, kontribusi, label]) => ({
          fitur: risk.fitur[f],
          label,
          kontribusi,
        })),
        kabupaten: cell.kabupaten,
      },
    };
  });
  riskFeatureCache.set(targetDate, features);
  return features;
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

function regionFromProps(props: Region): Region {
  return { id: props.id, slug: props.slug, nama: props.nama, level: props.level };
}

async function listRegions(): Promise<Region[]> {
  const regions = await loadRegions();
  return regions.features
    .map((f) => regionFromProps(f.properties))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

export const mockDataSource: DataSource = {
  async getHotspots({ start, end, minConfidence, bbox }) {
    const { byDate } = await loadHotspots();
    const minRank = CONFIDENCE_RANK[minConfidence];
    const features = eachDate(start, end).flatMap((date) =>
      (byDate.get(date) ?? []).filter(
        (f) =>
          CONFIDENCE_RANK[f.properties.confidence] >= minRank &&
          (!bbox || pointInBBox(f.geometry.coordinates, bbox)),
      ),
    );
    return { type: "FeatureCollection", features };
  },

  async getClusters({ date }) {
    const clusters = await loadClusters();
    return {
      type: "FeatureCollection",
      features: clusters.features.filter((f) => f.properties.tanggal === date),
    };
  },

  async getRiskCells({ targetDate, bbox }) {
    const features = await riskFeatures(targetDate);
    if (!bbox) return { type: "FeatureCollection", features };
    const grid = await loadGrid();
    return {
      type: "FeatureCollection",
      features: features.filter((_, i) => bboxIntersects(grid[i].bbox, bbox)),
    };
  },

  getRegions: listRegions,

  async getRegionBoundaries() {
    return loadRegions();
  },

  async getRegionDetail(slug) {
    const [regions, grid] = await Promise.all([loadRegions(), loadGrid()]);
    const feature = regions.features.find((f) => f.properties.slug === slug);
    if (!feature) return null;
    const rings =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates[0]]
        : feature.geometry.coordinates.map((polygon) => polygon[0]);
    const largest = rings.reduce((a, b) => (ringAreaKm2(b) > ringAreaKm2(a) ? b : a));
    const boxes = rings.map(ringBBox);
    const regionCells = grid.filter((c) => c.kabupaten === slug);
    const peat = regionCells.filter((c) => c.isGambut).length;
    const detail: RegionDetail = {
      ...regionFromProps(feature.properties),
      bbox: [
        Math.min(...boxes.map((b) => b[0])),
        Math.min(...boxes.map((b) => b[1])),
        Math.max(...boxes.map((b) => b[2])),
        Math.max(...boxes.map((b) => b[3])),
      ],
      pusat: ringCentroid(largest).map((v) => Math.round(v * 1e4) / 1e4) as Position,
      luas_km2: Math.round(rings.reduce((sum, ring) => sum + ringAreaKm2(ring), 0)),
      persen_gambut: regionCells.length ? Math.round((peat / regionCells.length) * 1000) / 10 : 0,
      jumlah_sel: regionCells.length,
    };
    return detail;
  },

  async getWeather(slug) {
    const weather = await loadWeather();
    return weather.data[slug] ?? null;
  },

  async getMonthlyTrend({ start, end, slug }): Promise<MonthlyTrend[]> {
    const { monthly } = await loadHotspots();
    return eachMonth(start, end).map((bulan) => ({
      bulan,
      jumlah_hotspot: monthly.get(slug ? `${slug}|${bulan}` : bulan) ?? 0,
    }));
  },

  async getRegionStats({ date, start, end }) {
    const [status, regions, hotspots, cells] = await Promise.all([
      loadStatus(),
      listRegions(),
      loadHotspots(),
      riskFeatures(date),
    ]);
    const windowEnd = end ?? status.tanggal_data;
    const windowStart = start ?? addDaysIso(windowEnd, -29);
    const counts = new Map<string, number>();
    for (const day of eachDate(windowStart, windowEnd)) {
      for (const f of hotspots.byDate.get(day) ?? []) {
        counts.set(f.properties.kabupaten, (counts.get(f.properties.kabupaten) ?? 0) + 1);
      }
    }
    const scores = new Map<string, { sum: number; n: number }>();
    for (const cell of cells) {
      const entry = scores.get(cell.properties.kabupaten) ?? { sum: 0, n: 0 };
      entry.sum += cell.properties.skor_risiko;
      entry.n += 1;
      scores.set(cell.properties.kabupaten, entry);
    }
    return regions
      .map((region) => {
        const score = scores.get(region.slug);
        return {
          slug: region.slug,
          nama: region.nama,
          jumlah_hotspot: counts.get(region.slug) ?? 0,
          rata_skor_risiko: score ? Math.round((score.sum / score.n) * 1000) / 1000 : 0,
        };
      })
      .sort((a, b) => b.rata_skor_risiko - a.rata_skor_risiko);
  },

  async getDataStatus(): Promise<DataStatus> {
    return loadStatus();
  },
};
