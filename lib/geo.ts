import type { BBox, Position } from "@/types/geojson";

/** Extent of Indonesia's land area. */
export const INDONESIA_BBOX: BBox = [95.0, -11.0, 141.0, 5.9];
/** The map may be panned a little beyond Indonesia, but not further. */
export const INDONESIA_MAX_BBOX: BBox = [88.0, -16.0, 148.0, 11.0];

const KM_PER_DEG_LAT = 110.57;
const KM_PER_DEG_LON_EQUATOR = 111.32;

export function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

/** Ray casting. `ring` may be open or closed. */
export function pointInRing(point: Position, ring: Position[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function ringBBox(ring: Position[]): BBox {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

export function pointInBBox([lon, lat]: Position, [minLon, minLat, maxLon, maxLat]: BBox): boolean {
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

/** Approximate area of a ring in km² (equirectangular projection, fine at regency scale). */
export function ringAreaKm2(ring: Position[]): number {
  if (ring.length < 3) return 0;
  const meanLat = ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;
  const kx = KM_PER_DEG_LON_EQUATOR * Math.cos((meanLat * Math.PI) / 180);
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * kx * (ring[i][1] * KM_PER_DEG_LAT) - ring[i][0] * kx * (ring[j][1] * KM_PER_DEG_LAT);
  }
  return Math.abs(area / 2);
}

/** Area-weighted centroid of a ring. */
export function ringCentroid(ring: Position[]): Position {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    area += cross;
    cx += (ring[j][0] + ring[i][0]) * cross;
    cy += (ring[j][1] + ring[i][1]) * cross;
  }
  if (area === 0) return ring[0];
  return [cx / (3 * area), cy / (3 * area)];
}

/** Distance in km between two positions (equirectangular approximation). */
export function distanceKm(a: Position, b: Position): number {
  const meanLat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (a[0] - b[0]) * KM_PER_DEG_LON_EQUATOR * Math.cos(meanLat);
  const dy = (a[1] - b[1]) * KM_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/** Andrew's monotone chain. Returns an open, counter-clockwise hull. */
export function convexHull(points: Position[]): Position[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: Position, a: Position, b: Position) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Position[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Position[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export function closeRing(ring: Position[]): Position[] {
  if (ring.length === 0) return ring;
  const [first, last] = [ring[0], ring[ring.length - 1]];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

/** Parses "minLon,minLat,maxLon,maxLat". Returns null when malformed. */
export function parseBBox(value: string): BBox | null {
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (minLon >= maxLon || minLat >= maxLat) return null;
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) return null;
  return [minLon, minLat, maxLon, maxLat];
}
