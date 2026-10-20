"use client";

import type { ReactNode } from "react";
import { SegmentedControl, Switch } from "@/components/ui/controls";
import type { LayerKey, MapFilters, RangeDays } from "@/components/map/use-map-filters";
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
  { value: "nominal", label: "Nominal" },
  { value: "high", label: "Tinggi" },
];

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
      <SegmentedControl
        label="Rentang waktu hotspot"
        value={String(value) as `${RangeDays}`}
        onChange={(v) => onChange(Number(v) as RangeDays)}
        options={(["1", "3", "7"] as const).map((v) => ({ value: v, label: RANGE_LABELS[Number(v) as RangeDays] }))}
      />
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ConfidenceControl({ value, onChange }: { value: Confidence; onChange: (value: Confidence) => void }) {
  return (
    <div>
      <SegmentedControl
        label="Tingkat kepercayaan minimum"
        value={value}
        onChange={onChange}
        options={CONFIDENCE_OPTIONS}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">Tingkat kepercayaan deteksi satelit terhadap titik panas.</p>
    </div>
  );
}

export function LayerToggles({
  layers,
  active,
  onToggle,
}: {
  layers: LayerOption[];
  active: LayerKey[];
  onToggle: (key: LayerKey, visible: boolean) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-medium text-muted-foreground">Lapisan peta</legend>
      <div className="-mx-2 flex flex-col">
        {layers.map((layer) => (
          <Switch
            key={layer.key}
            checked={active.includes(layer.key)}
            onChange={(visible) => onToggle(layer.key, visible)}
            label={layer.label}
            description={layer.description}
            icon={layer.icon}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Desktop left column. */
export function FilterPanel({
  filters,
  setFilters,
  toggleLayer,
  layers,
  rangeHint,
  children,
}: {
  filters: MapFilters;
  setFilters: (patch: Partial<MapFilters>) => void;
  toggleLayer: (key: LayerKey, visible: boolean) => void;
  layers: LayerOption[];
  rangeHint?: string;
  /** Extra sections, e.g. the prediction day picker. */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 p-4">
      <h2 className="text-sm font-semibold text-foreground">Filter &amp; lapisan</h2>
      <TimeRangeControl value={filters.rentang} onChange={(rentang) => setFilters({ rentang })} hint={rangeHint} />
      <ConfidenceControl value={filters.conf} onChange={(conf) => setFilters({ conf })} />
      {children}
      <LayerToggles layers={layers} active={filters.lapisan} onToggle={toggleLayer} />
    </div>
  );
}
