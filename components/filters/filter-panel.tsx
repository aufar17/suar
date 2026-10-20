"use client";

import { useId, type ReactNode } from "react";
import type { LayerKey, MapFilters, RangeDays } from "@/components/map/use-map-filters";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Confidence } from "@/types";

export interface LayerOption {
  key: LayerKey;
  label: string;
  description: string;
  icon: ReactNode;
}

export const RANGE_LABELS: Record<RangeDays, string> = { 1: "24 jam", 3: "3 hari", 7: "7 hari" };

const CONFIDENCE_OPTIONS: { value: Confidence; label: string }[] = [
  { value: "low", label: "Semua" },
  { value: "nominal", label: "Nominal+" },
  { value: "high", label: "Tinggi" },
];

function FieldLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <p className="text-xs font-medium text-muted-foreground">{children}</p>
      {hint ? <p className="text-xs text-muted-foreground tabular-nums">{hint}</p> : null}
    </div>
  );
}

export function TimeRangeControl({
  value,
  onChange,
  hint,
}: {
  value: RangeDays;
  onChange: (value: RangeDays) => void;
  hint?: string;
}) {
  return (
    <div>
      <FieldLabel hint={hint}>Rentang waktu hotspot</FieldLabel>
      <Segmented
        label="Rentang waktu hotspot"
        value={String(value) as `${RangeDays}`}
        onChange={(v) => onChange(Number(v) as RangeDays)}
        options={(["1", "3", "7"] as const).map((v) => ({ value: v, label: RANGE_LABELS[Number(v) as RangeDays] }))}
      />
    </div>
  );
}

export function ConfidenceControl({ value, onChange }: { value: Confidence; onChange: (value: Confidence) => void }) {
  return (
    <div>
      <FieldLabel>Tingkat kepercayaan minimum</FieldLabel>
      <Segmented label="Tingkat kepercayaan minimum" value={value} onChange={onChange} options={CONFIDENCE_OPTIONS} />
      <p className="mt-1.5 text-xs text-muted-foreground">Keyakinan satelit bahwa titik panas itu nyata.</p>
    </div>
  );
}

export function OpacityControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-3 py-1 pl-12">
      <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground">
        Opasitas
      </span>
      <Slider
        min={0.2}
        max={1}
        step={0.1}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
        aria-label="Opasitas lapisan risiko"
        aria-valuetext={formatPercent(value * 100)}
        className="flex-1"
      />
      <span className="w-9 text-right font-mono text-xs tabular-nums">{formatPercent(value * 100)}</span>
    </div>
  );
}

export function LayerToggles({
  layers,
  active,
  onToggle,
  riskOpacity,
}: {
  layers: LayerOption[];
  active: LayerKey[];
  onToggle: (key: LayerKey, visible: boolean) => void;
  /** Shows the opacity slider under the risk layer while it is on. */
  riskOpacity?: { value: number; onChange: (value: number) => void };
}) {
  const baseId = useId();
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-medium text-muted-foreground">Lapisan peta</legend>
      <ul className="-mx-2 flex flex-col">
        {layers.map((layer) => {
          const on = active.includes(layer.key);
          const id = `${baseId}-${layer.key}`;
          return (
            <li key={layer.key}>
              <label
                htmlFor={id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-muted/70"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md border bg-background transition-opacity duration-200",
                    !on && "opacity-45",
                  )}
                >
                  {layer.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-tight">{layer.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{layer.description}</span>
                </span>
                <Switch id={id} checked={on} onCheckedChange={(visible) => onToggle(layer.key, visible)} />
              </label>
              {layer.key === "risiko" && on && riskOpacity ? (
                <OpacityControl value={riskOpacity.value} onChange={riskOpacity.onChange} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** Controls shared by the desktop floating panel and the mobile drawer. */
export function FilterControls({
  filters,
  setFilters,
  toggleLayer,
  layers,
  rangeHint,
  riskOpacity,
  onRiskOpacityChange,
}: {
  filters: MapFilters;
  setFilters: (patch: Partial<MapFilters>) => void;
  toggleLayer: (key: LayerKey, visible: boolean) => void;
  layers: LayerOption[];
  rangeHint?: string;
  riskOpacity: number;
  onRiskOpacityChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <TimeRangeControl value={filters.rentang} onChange={(rentang) => setFilters({ rentang })} hint={rangeHint} />
      <ConfidenceControl value={filters.conf} onChange={(conf) => setFilters({ conf })} />
      <LayerToggles
        layers={layers}
        active={filters.lapisan}
        onToggle={toggleLayer}
        riskOpacity={{ value: riskOpacity, onChange: onRiskOpacityChange }}
      />
    </div>
  );
}
