import type { Theme } from "@/components/ui/theme";

// Map layer colors per theme. WebGL layers need color strings, so these mirror the
// --map-* and zinc tokens in app/globals.css (keep both in sync).

export interface MapColors {
  boundary: string;
  /** Outline of regions in the choropleth (thin, translucent). */
  regionOutline: string;
  /** Strong outline: hover, legend highlight. */
  strong: string;
  hotspot: string;
  hotspotStroke: string;
  cluster: string;
  gambut: string;
  selection: string;
  halo: string;
  /** Basemap and region labels. */
  label: string;
  labelMuted: string;
  labelHalo: string;
}

export const MAP_COLORS: Record<Theme, MapColors> = {
  light: {
    boundary: "#3F3F46",
    regionOutline: "#52525B",
    strong: "#18181B",
    hotspot: "#18181B",
    hotspotStroke: "#FFFFFF",
    cluster: "#18181B",
    gambut: "#8A6A2F",
    selection: "#E8590C",
    halo: "#FFFFFF",
    label: "#27272A",
    labelMuted: "#52525B",
    labelHalo: "#FFFFFF",
  },
  dark: {
    boundary: "#A1A1AA",
    regionOutline: "#A1A1AA",
    strong: "#FAFAFA",
    hotspot: "#FAFAFA",
    hotspotStroke: "#09090B",
    cluster: "#FAFAFA",
    gambut: "#C9B67A",
    selection: "#F97A3C",
    halo: "#09090B",
    label: "#E4E4E7",
    labelMuted: "#A1A1AA",
    labelHalo: "#09090B",
  },
};
