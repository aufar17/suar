import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { Theme } from "@/components/ui/theme";
import { MAP_COLORS } from "./colors";

// Vector basemap. OpenFreeMap needs no API key; a provider that does can be configured with
// NEXT_PUBLIC_MAP_STYLE_LIGHT / NEXT_PUBLIC_MAP_STYLE_DARK (full style URLs).
export const BASEMAP_STYLE_URLS: Record<Theme, string> = {
  light: process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT || "https://tiles.openfreemap.org/styles/positron",
  dark: process.env.NEXT_PUBLIC_MAP_STYLE_DARK || "https://tiles.openfreemap.org/styles/dark",
};

/** Used when the style cannot be loaded (offline, provider down): data layers still draw. */
const FALLBACK_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

/**
 * Empty marker layers that fix the stacking order of the data layers, whatever the basemap.
 * Data layers are inserted `beforeId` their slot, so they keep their order after a style
 * swap (theme change). Bottom to top; basemap labels sit between "hotspot" and "label".
 */
const DATA_SLOTS = ["wilayah", "gambut", "risiko", "batas", "fokus", "zona", "sorotan", "hotspot"] as const;
const TOP_SLOTS = ["label", "kelompok", "sorotan-titik"] as const;
export type MapSlot = (typeof DATA_SLOTS)[number] | (typeof TOP_SLOTS)[number];

export function slotId(slot: MapSlot): string {
  return `siapi-slot-${slot}`;
}

function slotLayer(slot: MapSlot): LayerSpecification {
  return { id: slotId(slot), type: "background", layout: { visibility: "none" } };
}

export interface MapFonts {
  regular: string[];
  bold: string[];
  italic: string[];
}

const DEFAULT_FONTS: MapFonts = {
  regular: ["Noto Sans Regular"],
  bold: ["Noto Sans Bold"],
  italic: ["Noto Sans Italic"],
};

/** Font stacks offered by the style's glyph server (taken from its own symbol layers). */
function styleFonts(layers: LayerSpecification[]): MapFonts {
  const names = new Set<string>();
  for (const layer of layers) {
    if (layer.type !== "symbol") continue;
    const font = layer.layout?.["text-font"];
    if (Array.isArray(font) && font.every((f) => typeof f === "string")) for (const f of font as string[]) names.add(f);
  }
  if (names.size === 0) return DEFAULT_FONTS;
  const all = [...names];
  const pick = (word: string) => all.find((f) => f.includes(word));
  const regular = pick("Regular") ?? all[0];
  return { regular: [regular], bold: [pick("Bold") ?? regular], italic: [pick("Italic") ?? regular] };
}

/** Place name in Indonesian where OpenStreetMap has one. */
const PLACE_NAME: ExpressionSpecification = ["coalesce", ["get", "name:id"], ["get", "name:latin"], ["get", "name"]];

/**
 * Place labels (OpenMapTiles `place` layer) with our own zoom thresholds, replacing the
 * basemap's: cities from zoom 6, towns 9, suburbs 10, villages 11, hamlets 13. Provinces
 * and regencies are labelled from our boundaries (see region layers), so `state` is left out.
 * Listed bottom to top: upper layers win label collisions.
 */
function placeLabelLayers(source: string, theme: Theme, fonts: MapFonts): LayerSpecification[] {
  const colors = MAP_COLORS[theme];
  const halo = { "text-halo-color": colors.labelHalo, "text-halo-width": 1.4, "text-halo-blur": 0.4 };
  const place = (
    id: string,
    classes: string[],
    minzoom: number,
    size: ExpressionSpecification | number,
    options: { font?: string[]; color?: string; maxzoom?: number; uppercase?: boolean } = {},
  ): LayerSpecification => ({
    id: `siapi-place-${id}`,
    type: "symbol",
    source,
    "source-layer": "place",
    minzoom,
    ...(options.maxzoom ? { maxzoom: options.maxzoom } : {}),
    filter: ["match", ["get", "class"], classes, true, false],
    layout: {
      "text-field": PLACE_NAME,
      "text-font": options.font ?? fonts.regular,
      "text-size": size,
      "text-max-width": 8,
      "text-padding": 3,
      "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
      ...(options.uppercase ? { "text-transform": "uppercase", "text-letter-spacing": 0.08 } : {}),
    },
    paint: { "text-color": options.color ?? colors.label, ...halo },
  });
  return [
    place("dusun", ["hamlet", "neighbourhood", "quarter", "isolated_dwelling", "locality"], 13, 10.5, { color: colors.labelMuted }),
    place("desa", ["village"], 11, ["interpolate", ["linear"], ["zoom"], 11, 10.5, 15, 13], { color: colors.labelMuted }),
    place("kecamatan", ["suburb"], 10, ["interpolate", ["linear"], ["zoom"], 10, 11, 15, 13], { color: colors.labelMuted }),
    place("kota-kecil", ["town"], 9, ["interpolate", ["linear"], ["zoom"], 9, 11, 14, 14]),
    place("pulau", ["island", "islet"], 8, 11, { font: fonts.italic, color: colors.labelMuted }),
    place("kota", ["city"], 6, ["interpolate", ["linear"], ["zoom"], 6, 11, 10, 14, 14, 17]),
    place("negara", ["country"], 0, ["interpolate", ["linear"], ["zoom"], 3, 11, 6, 14], {
      font: fonts.bold,
      color: colors.labelMuted,
      maxzoom: 8,
      uppercase: true,
    }),
  ];
}

export interface Basemap {
  theme: Theme;
  style: StyleSpecification;
  fonts: MapFonts;
}

/**
 * Basemap style for a theme: every symbol layer moves above the non-label layers, the data
 * slots sit in between (so all labels draw over the data), and place labels are replaced.
 */
function prepare(source: StyleSpecification, theme: Theme): Basemap {
  const layers = source.layers;
  const isPlace = (layer: LayerSpecification) =>
    layer.type === "symbol" && "source-layer" in layer && layer["source-layer"] === "place";
  const placeSource = layers.find(isPlace);
  const fonts = styleFonts(layers);
  const shapes = layers.filter((layer) => layer.type !== "symbol");
  const labels = layers.filter((layer) => layer.type === "symbol" && !(placeSource && isPlace(layer)));
  const places = placeSource && "source" in placeSource ? placeLabelLayers(placeSource.source, theme, fonts) : [];
  // OpenFreeMap's shaded relief (small scales) comes without attribution.
  const sources = Object.fromEntries(
    Object.entries(source.sources).map(([id, spec]) =>
      spec.type === "raster" && !spec.attribution && spec.tiles?.some((url) => url.includes("natural_earth"))
        ? [id, { ...spec, attribution: '<a href="https://www.naturalearthdata.com/" target="_blank">Natural Earth</a>' }]
        : [id, spec],
    ),
  );
  return {
    theme,
    fonts,
    style: {
      ...source,
      sources,
      glyphs: source.glyphs ?? FALLBACK_GLYPHS,
      layers: [...shapes, ...DATA_SLOTS.map(slotLayer), ...labels, ...places, ...TOP_SLOTS.map(slotLayer)],
    },
  };
}

function fallbackStyle(theme: Theme): StyleSpecification {
  return {
    version: 8,
    glyphs: FALLBACK_GLYPHS,
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": theme === "dark" ? "#0E0E10" : "#F4F4F5" } }],
  };
}

const styleRequests = new Map<string, Promise<StyleSpecification | null>>();

/** Loads (once per URL) and prepares the basemap for a theme. Never rejects. */
export function loadBasemap(theme: Theme): Promise<Basemap> {
  const url = BASEMAP_STYLE_URLS[theme];
  let request = styleRequests.get(url);
  if (!request) {
    request = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<StyleSpecification>;
      })
      .catch((error: unknown) => {
        console.warn(`Basemap ${url} gagal dimuat`, error);
        styleRequests.delete(url);
        return null;
      });
    styleRequests.set(url, request);
  }
  return request.then((style) => prepare(style ?? fallbackStyle(theme), theme));
}
