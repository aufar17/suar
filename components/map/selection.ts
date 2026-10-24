import type { Position } from "@/types";

/** What the user clicked. Cells are kept by id so the detail follows the prediction day. */
export type MapSelection =
  | { kind: "cluster"; id: string }
  | { kind: "cell"; id: string }
  | { kind: "hotspot"; id: string; point: Position };

/** Outlines (polygons) or a point (hotspots) to highlight on the map. */
export type SelectionShape = { rings: Position[][] } | { point: Position };
