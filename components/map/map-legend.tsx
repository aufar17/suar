"use client";

import { ChevronDown, ListTree } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { RiskSwatch } from "@/components/ui/risk-badge";
import { formatDecimal } from "@/lib/format";
import { getRiskLabel, RISK_LEVEL_ORDER } from "@/lib/risk";
import { cn } from "@/lib/utils";
import { BoundaryGlyph, HotspotGlyph, PeatGlyph, ZoneGlyph } from "./legend-icons";
import type { LayerKey } from "./use-map-filters";

const RISK_RANGES: Record<string, string> = {
  rendah: `< ${formatDecimal(0.25)}`,
  sedang: `${formatDecimal(0.25)}–${formatDecimal(0.5)}`,
  tinggi: `${formatDecimal(0.5)}–${formatDecimal(0.75)}`,
  sangat_tinggi: `≥ ${formatDecimal(0.75)}`,
};

/** Collapsible legend for the visible layers. */
export function MapLegend({
  layers,
  defaultOpen,
  className,
}: {
  layers: LayerKey[];
  defaultOpen: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  if (layers.length === 0) return null;
  return (
    <section aria-label="Legenda peta" className={cn("glass-panel w-60 overflow-hidden rounded-xl text-xs", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 w-full items-center gap-2 px-3 font-medium transition-colors duration-150 hover:bg-muted/60 pointer-coarse:min-h-11"
      >
        <ListTree aria-hidden="true" className="size-3.5 text-muted-foreground" />
        Legenda
        <ChevronDown
          aria-hidden="true"
          className={cn("ml-auto size-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={contentId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          >
            <div className="flex flex-col gap-3 border-t px-3 py-3">
              {layers.includes("risiko") ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Tingkat risiko (skor 0–1)</p>
                  <ul className="flex flex-col gap-1">
                    {RISK_LEVEL_ORDER.map((level) => (
                      <li key={level} className="flex items-center gap-2">
                        <RiskSwatch level={level} />
                        <span className="flex-1">{getRiskLabel(level)}</span>
                        <span className="font-mono text-muted-foreground tabular-nums">{RISK_RANGES[level]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <ul className="flex flex-col gap-1.5">
                {layers.includes("hotspot") ? (
                  <li className="flex items-center gap-2">
                    <span className="flex w-5 items-center justify-center gap-px">
                      <HotspotGlyph size={5} />
                      <HotspotGlyph size={9} />
                    </span>
                    <span>Hotspot · ukuran = FRP, pekat = yakin</span>
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
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
