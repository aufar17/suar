"use client";

import { clsx } from "clsx";
import { RiskSwatch } from "@/components/ui/risk-badge";
import { getRiskLabel, RISK_LEVEL_ORDER } from "@/lib/risk";
import { formatDecimal } from "@/lib/format";
import { BoundaryGlyph, HotspotGlyph, PeatGlyph, ZoneGlyph } from "./legend-icons";
import type { LayerKey } from "./use-map-filters";

const RISK_RANGES: Record<string, string> = {
  rendah: `< ${formatDecimal(0.25)}`,
  sedang: `${formatDecimal(0.25)}–${formatDecimal(0.5)}`,
  tinggi: `${formatDecimal(0.5)}–${formatDecimal(0.75)}`,
  sangat_tinggi: `≥ ${formatDecimal(0.75)}`,
};

/** Map legend. Uses <details> so it can be collapsed on small screens. */
export function MapLegend({
  layers,
  defaultOpen,
  className,
}: {
  layers: LayerKey[];
  defaultOpen: boolean;
  className?: string;
}) {
  if (layers.length === 0) return null;
  return (
    <details
      open={defaultOpen}
      className={clsx(
        "group w-56 rounded-xl border border-border bg-card/95 text-xs text-foreground backdrop-blur-sm",
        className,
      )}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 font-semibold [&::-webkit-details-marker]:hidden">
        Legenda
        <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3">
        {layers.includes("risiko") ? (
          <div>
            <p className="mb-1.5 font-medium text-muted-foreground">Tingkat risiko (skor)</p>
            <ul className="flex flex-col gap-1">
              {RISK_LEVEL_ORDER.map((level) => (
                <li key={level} className="flex items-center gap-2">
                  <RiskSwatch level={level} />
                  <span className="flex-1">{getRiskLabel(level)}</span>
                  <span className="font-mono text-muted-foreground">{RISK_RANGES[level]}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <ul className="flex flex-col gap-1.5">
          {layers.includes("hotspot") ? (
            <li className="flex items-center gap-2">
              <span className="flex w-5 items-center justify-center gap-px">
                <HotspotGlyph size={6} />
                <HotspotGlyph size={10} />
              </span>
              <span>Hotspot · ukuran = FRP, pekat = kepercayaan tinggi</span>
            </li>
          ) : null}
          {layers.includes("zona") ? (
            <li className="flex items-center gap-2">
              <span className="flex w-5 justify-center">
                <ZoneGlyph />
              </span>
              Zona kebakaran aktif
            </li>
          ) : null}
          {layers.includes("batas") ? (
            <li className="flex items-center gap-2">
              <span className="flex w-5 justify-center">
                <BoundaryGlyph />
              </span>
              Batas kabupaten/kota
            </li>
          ) : null}
          {layers.includes("gambut") ? (
            <li className="flex items-center gap-2">
              <span className="flex w-5 justify-center">
                <PeatGlyph />
              </span>
              Lahan gambut
            </li>
          ) : null}
        </ul>
      </div>
    </details>
  );
}
