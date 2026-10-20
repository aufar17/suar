import type L from "leaflet";

/**
 * All vector layers share the map's single canvas renderer (`preferCanvas`), so their
 * stacking is the draw order. Separate canvas panes would block clicks to the layers below.
 * Bottom to top:
 */
export const LAYER_ORDER = ["gambut", "risiko", "batas", "zona", "sorotan", "hotspot"] as const;
export type OrderedLayer = (typeof LAYER_ORDER)[number];

const registries = new WeakMap<L.Map, Map<OrderedLayer, L.FeatureGroup>>();

function restack(map: L.Map) {
  const registry = registries.get(map);
  if (!registry) return;
  for (const key of LAYER_ORDER) registry.get(key)?.bringToFront();
}

export function addOrderedLayer(map: L.Map, key: OrderedLayer, layer: L.FeatureGroup) {
  let registry = registries.get(map);
  if (!registry) {
    registry = new Map();
    registries.set(map, registry);
  }
  registry.set(key, layer);
  layer.addTo(map);
  restack(map);
}

export function removeOrderedLayer(map: L.Map, key: OrderedLayer, layer: L.FeatureGroup) {
  const registry = registries.get(map);
  if (registry?.get(key) === layer) registry.delete(key);
  layer.remove();
}
