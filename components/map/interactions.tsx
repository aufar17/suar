"use client";

import type { MapGeoJSONFeature, MapMouseEvent, Point } from "maplibre-gl";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useMap } from "react-map-gl/maplibre";

export interface LayerInteraction {
  /** Tooltip HTML for the feature under the pointer (see hover.ts), or null for none. */
  tooltip?: (feature: MapGeoJSONFeature) => string | null;
  /** Small one-line label (region names) instead of the detail card. */
  compact?: boolean;
  onClick?: (feature: MapGeoJSONFeature) => void;
  /** Sets feature-state `hover` on the feature under the pointer (the source needs feature ids). */
  hover?: boolean;
}

type Registry = Map<string, () => LayerInteraction | null>;

const InteractionContext = createContext<Registry | null>(null);

/**
 * Registers hover and click behavior for one map layer. Only the top-most interactive
 * feature under the pointer reacts, like a click that does not fall through.
 */
export function useLayerInteraction(layerId: string, interaction: LayerInteraction | null) {
  const registry = useContext(InteractionContext);
  const ref = useRef(interaction);
  useEffect(() => {
    ref.current = interaction;
  });
  useEffect(() => {
    if (!registry) return;
    registry.set(layerId, () => ref.current);
    return () => {
      registry.delete(layerId);
    };
  }, [registry, layerId]);
}

function featureKey(feature: MapGeoJSONFeature): string {
  const id = feature.id ?? (feature.properties?.id as string | undefined) ?? JSON.stringify(feature.properties);
  return `${feature.layer.id}:${id}`;
}

/**
 * One pointer pipeline for all data layers of a map: `queryRenderedFeatures` once per
 * animation frame, hover feature-state, the cursor, a single tooltip, and clicks.
 */
export function MapInteractions({ children }: { children?: ReactNode }) {
  const { current: mapRef } = useMap();
  const [registry] = useState<Registry>(() => new Map());

  useEffect(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    const container = map.getContainer();
    const tooltip = document.createElement("div");
    tooltip.className = "map-tooltip";
    tooltip.setAttribute("aria-hidden", "true");
    tooltip.hidden = true;
    container.appendChild(tooltip);

    let frame = 0;
    let point: Point | null = null;
    let hovered: { source: string; id: string | number } | null = null;
    let shownKey: string | null = null;

    const active = (id: string) => registry.get(id)?.() ?? null;
    const topFeature = (at: Point) => {
      const layers = [...registry.keys()].filter((id) => active(id) && map.getLayer(id));
      if (layers.length === 0) return null;
      return map.queryRenderedFeatures(at, { layers })[0] ?? null;
    };

    const setHovered = (next: { source: string; id: string | number } | null) => {
      if (hovered && next && hovered.source === next.source && hovered.id === next.id) return;
      if (hovered && map.getSource(hovered.source)) map.setFeatureState(hovered, { hover: false });
      hovered = next;
      if (hovered && map.getSource(hovered.source)) map.setFeatureState(hovered, { hover: true });
    };

    const hideTooltip = () => {
      tooltip.hidden = true;
      shownKey = null;
    };

    const placeTooltip = (at: Point) => {
      const width = tooltip.offsetWidth;
      const height = tooltip.offsetHeight;
      const x = Math.min(Math.max(at.x, width / 2 + 6), container.clientWidth - width / 2 - 6);
      const below = at.y - height - 14 < 6;
      tooltip.style.transform = `translate(${x}px, ${at.y}px) translate(-50%, ${below ? "16px" : "calc(-100% - 12px)"})`;
    };

    const update = () => {
      frame = 0;
      if (!point) return;
      const feature = topFeature(point);
      const interaction = feature ? active(feature.layer.id) : null;
      setHovered(feature && interaction?.hover && feature.id !== undefined ? { source: feature.source, id: feature.id } : null);
      map.getCanvas().style.cursor = interaction?.onClick ? "pointer" : "";

      const key = feature && interaction?.tooltip ? featureKey(feature) : null;
      if (!key) {
        hideTooltip();
        return;
      }
      if (key !== shownKey) {
        const html = interaction!.tooltip!(feature!);
        if (!html) {
          hideTooltip();
          return;
        }
        tooltip.innerHTML = html;
        tooltip.dataset.compact = String(Boolean(interaction!.compact));
        tooltip.hidden = false;
        shownKey = key;
      }
      placeTooltip(point);
    };

    const onMove = (event: MapMouseEvent) => {
      point = event.point;
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onOut = () => {
      point = null;
      cancelAnimationFrame(frame);
      frame = 0;
      setHovered(null);
      hideTooltip();
      map.getCanvas().style.cursor = "";
    };
    const onClick = (event: MapMouseEvent) => {
      hideTooltip();
      const feature = topFeature(event.point);
      if (feature) active(feature.layer.id)?.onClick?.(feature);
    };
    // A new style drops every source, and with it the hover state.
    const onStyle = () => {
      hovered = null;
    };

    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    map.on("click", onClick);
    map.on("style.load", onStyle);
    return () => {
      cancelAnimationFrame(frame);
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
      map.off("click", onClick);
      map.off("style.load", onStyle);
      tooltip.remove();
      map.getCanvas().style.cursor = "";
    };
  }, [mapRef, registry]);

  return <InteractionContext.Provider value={registry}>{children}</InteractionContext.Provider>;
}
