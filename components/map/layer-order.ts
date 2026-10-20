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

/**
 * Unregisters the layer and removes it, either at once or through `remove`
 * (e.g. a fade-out that removes the group when it finishes).
 */
export function removeOrderedLayer(map: L.Map, key: OrderedLayer, layer: L.FeatureGroup, remove?: () => void) {
  const registry = registries.get(map);
  if (registry?.get(key) === layer) registry.delete(key);
  // Fading layers stop listening at once so they cannot be clicked on their way out.
  layer.off();
  for (const child of layer.getLayers()) child.off();
  if (remove) remove();
  else layer.remove();
}
