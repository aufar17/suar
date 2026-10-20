"use client";

import { clsx } from "clsx";
import type { LayerKey } from "@/components/map/use-map-filters";
import type { LayerOption } from "./filter-panel";

/** Mobile: horizontally scrollable layer toggles over the map. */
export function LayerChips({
  layers,
  active,
  onToggle,
  className,
}: {
  layers: LayerOption[];
  active: LayerKey[];
  onToggle: (key: LayerKey, visible: boolean) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Lapisan peta" className={clsx("no-scrollbar flex gap-2 overflow-x-auto px-3 py-2", className)}>
      {layers.map((layer) => {
        const on = active.includes(layer.key);
        return (
          <button
            key={layer.key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(layer.key, !on)}
            className={clsx(
              "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium",
              on ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface text-fg",
            )}
          >
            <span className="flex size-4 items-center justify-center">{layer.icon}</span>
            {layer.label}
          </button>
        );
      })}
    </div>
  );
}
