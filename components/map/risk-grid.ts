import { getRiskLevel } from "@/lib/risk";
import type { Position, RiskGrid, RiskGridCell } from "@/types";
import { levelIndex } from "./expressions";

// The compact grid (`/api/risk/grid`) as map data: polygons once per area, scores per day.

export interface GridCellProps {
  cell_id: string;
  is_gambut: boolean;
  kabupaten: string;
}

export interface GridFeatureCollection {
  type: "FeatureCollection";
  features: { type: "Feature"; geometry: { type: "Polygon"; coordinates: Position[][] }; properties: GridCellProps }[];
}

const SCORE_OFFSET = 5;

export function cellRing(cell: RiskGridCell, size: number): Position[] {
  const [, minLon, minLat] = cell;
  const r = (v: number) => Math.round(v * 1e5) / 1e5;
  const maxLon = r(minLon + size);
  const maxLat = r(minLat + size);
  return [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
    [minLon, minLat],
  ];
}

/** Square polygons of the grid (built once per loaded area). */
export function gridFeatures(grid: RiskGrid): GridFeatureCollection {
  return {
    type: "FeatureCollection",
    features: grid.sel.map((cell) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [cellRing(cell, grid.ukuran_sel)] },
      properties: { cell_id: cell[0], is_gambut: cell[3] === 1, kabupaten: grid.kabupaten[cell[4]] ?? "" },
    })),
  };
}

/** Index of a target date in the grid's scores, or -1 when it has no prediction for that day. */
export function gridDay(grid: RiskGrid, targetDate: string): number {
  return grid.tanggal_target.indexOf(targetDate);
}

/** Score (0–1) of a cell on a day. */
export function cellScore(cell: RiskGridCell, day: number): number {
  return Number(cell[SCORE_OFFSET + day] ?? 0) / 1000;
}

/** Feature-state of every cell for one day: `{ level, skor }`. */
export function gridStates(grid: RiskGrid, day: number): Map<string, { level: number; skor: number }> {
  return new Map(
    grid.sel.map((cell) => {
      const skor = cellScore(cell, day);
      return [cell[0], { level: levelIndex(getRiskLevel(skor)), skor }];
    }),
  );
}
