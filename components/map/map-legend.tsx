"use client";

import { ChevronDown, Info, ListTree } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { NoPredictionSwatch, RiskSwatch } from "@/components/ui/risk-badge";
import { formatDate, formatDecimal, formatInteger } from "@/lib/format";
import { CLUSTER_STATUS_LABELS, CONFIDENCE_LABELS, SATELLITE_LABELS } from "@/lib/labels";
import { getRiskLabel, NO_PREDICTION_LABEL, RISK_LEVEL_ORDER, RISK_THRESHOLDS } from "@/lib/risk";
import { cn } from "@/lib/utils";
import {
  CLUSTER_STATUSES,
  CONFIDENCE_LEVELS,
  SATELLITES,
  type ClusterStatus,
  type Confidence,
  type RiskLevel,
} from "@/types/constants";
import { GroupGlyph, HotspotGlyph, LineGlyph, PeatGlyph, ZoneStatusGlyph } from "./legend-icons";
import { GRID_MIN_ZOOM, HOTSPOT_OPACITY, hotspotRadius, REGENCY_MIN_ZOOM, ZONE_STYLES, type MapTier } from "./styles";
import type { LayerKey } from "./use-map-filters";

/** Legend item under the pointer (or keyboard focus); the map emphasizes the matching objects. */
export type LegendHighlight =
  | { kind: "risiko"; level: RiskLevel }
  | { kind: "tanpa_prediksi" }
  | { kind: "kepercayaan"; level: Confidence }
  | { kind: "kelompok" }
  | { kind: "zona"; status: ClusterStatus }
  | { kind: "gambut" }
  | { kind: "batas"; tier: "provinsi" | "kabupaten" };

/** Objects currently shown on the map, per legend item. */
export interface LegendCounts {
  /** Regions or cells per level; regions without a prediction are counted in `unpredicted` only. */
  risk?: Record<RiskLevel, number>;
  /** Regions without a prediction (province and regency tiers). */
  unpredicted?: number;
  hotspots?: { total: number; byConfidence: Record<Confidence, number>; groups: number };
  zones?: Record<ClusterStatus, number>;
  peat?: number;
  /** Cells without peat data. */
  peatUnknown?: number;
}

export interface LegendProps {
  layers: LayerKey[];
  tier: MapTier;
  counts?: LegendCounts;
  /** Risk level filter: only this level is filled on the map. */
  onlyLevel?: RiskLevel | null;
  onOnlyLevelChange?: (level: RiskLevel | null) => void;
  onHighlight?: (highlight: LegendHighlight | null) => void;
  /** Show the "Tidak diprediksi" item (off where the map draws no region fill). */
  showUnpredicted?: boolean;
  /** Latest data date (YYYY-MM-DD) and hotspot window label, e.g. "24 jam". */
  dataDate?: string;
  rangeLabel?: string;
  mock?: boolean;
}

const RISK_RANGES: Record<RiskLevel, string> = {
  rendah: `< ${formatDecimal(RISK_THRESHOLDS.sedang)}`,
  sedang: `${formatDecimal(RISK_THRESHOLDS.sedang)}–${formatDecimal(RISK_THRESHOLDS.tinggi)}`,
  tinggi: `${formatDecimal(RISK_THRESHOLDS.tinggi)}–${formatDecimal(RISK_THRESHOLDS.sangat_tinggi)}`,
  sangat_tinggi: `≥ ${formatDecimal(RISK_THRESHOLDS.sangat_tinggi)}`,
};

const RISK_UNITS: Record<MapTier, string> = { provinsi: "provinsi", kabupaten: "kab/kota", dekat: "kotak" };

const RISK_DESCRIPTIONS: Record<MapTier, string> = {
  provinsi:
    "Warna = rata-rata skor semua kotak 5 km di setiap provinsi untuk hari terpilih. Perbesar untuk kabupaten/kota dan grid.",
  kabupaten: `Warna = rata-rata skor semua kotak 5 km di setiap kabupaten/kota. Perbesar ke zoom ${GRID_MIN_ZOOM} untuk grid 5 km.`,
  dekat: "Kotak grid 5×5 km, skor 0–1 dari model prediksi untuk hari terpilih.",
};

const SATELLITE_NAMES = SATELLITES.map((satellite) => SATELLITE_LABELS[satellite]).join(", ");

/** FRP examples for the size scale (MW). */
const FRP_EXAMPLES = [5, 50, 200];

function Count({ value, unit }: { value: number | undefined; unit?: string }) {
  if (value === undefined) return null;
  return (
    <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
      {formatInteger(value)}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

function Section({
  title,
  count,
  description,
  children,
}: {
  title: string;
  count?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold">{title}</h3>
        {count}
      </div>
      {description ? <p className="text-[11px] leading-4 text-muted-foreground">{description}</p> : null}
      {children}
    </section>
  );
}

/** Legend body, shared by the floating panel (desktop) and the drawer (mobile). */
export function LegendContent({
  layers,
  tier,
  counts,
  onlyLevel = null,
  onOnlyLevelChange,
  onHighlight,
  showUnpredicted = true,
  dataDate,
  rangeLabel,
  mock,
}: LegendProps) {
  const hover = (highlight: LegendHighlight) => ({
    onMouseEnter: () => onHighlight?.(highlight),
    onMouseLeave: () => onHighlight?.(null),
  });
  const focus = (highlight: LegendHighlight) => ({
    onFocus: () => onHighlight?.(highlight),
    onBlur: () => onHighlight?.(null),
  });
  const riskTotal = counts?.risk ? RISK_LEVEL_ORDER.reduce((n, level) => n + counts.risk![level], 0) : undefined;
  const zoneTotal = counts?.zones ? CLUSTER_STATUSES.reduce((n, s) => n + counts.zones![s], 0) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {layers.includes("risiko") ? (
        <Section
          title="Prediksi risiko"
          count={<Count value={riskTotal} unit={RISK_UNITS[tier]} />}
          description={RISK_DESCRIPTIONS[tier]}
        >
          <ul className="flex flex-col">
            {RISK_LEVEL_ORDER.map((level) => {
              const active = onlyLevel === level;
              const dimmed = onlyLevel !== null && !active;
              const content = (
                <>
                  <RiskSwatch level={level} />
                  <span className="flex-1 text-left">{getRiskLabel(level)}</span>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{RISK_RANGES[level]}</span>
                  <span className="w-12 text-right">
                    <Count value={counts?.risk?.[level]} />
                  </span>
                </>
              );
              return (
                <li key={level}>
                  {onOnlyLevelChange ? (
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onOnlyLevelChange(active ? null : level)}
                      {...hover({ kind: "risiko", level })}
                      {...focus({ kind: "risiko", level })}
                      className={cn(
                        "-mx-1.5 flex min-h-8 w-[calc(100%+0.75rem)] items-center gap-2 rounded-md px-1.5 text-xs transition-[background-color,opacity] duration-150 hover:bg-muted/70 pointer-coarse:min-h-11",
                        active && "bg-muted font-medium",
                        dimmed && "opacity-50",
                      )}
                    >
                      {content}
                    </button>
                  ) : (
                    <span className="flex min-h-7 items-center gap-2 text-xs">{content}</span>
                  )}
                </li>
              );
            })}
            {showUnpredicted ? (
              <li>
                <span
                  {...hover({ kind: "tanpa_prediksi" })}
                  className="flex min-h-8 items-center gap-2 text-xs"
                >
                  <NoPredictionSwatch />
                  <span className="flex-1">{NO_PREDICTION_LABEL}</span>
                  <span className="w-12 text-right">
                    <Count value={tier === "dekat" ? undefined : counts?.unpredicted} />
                  </span>
                </span>
              </li>
            ) : null}
          </ul>
          <p className="text-[11px] leading-4 text-muted-foreground">
            Rendah tidak diwarnai agar peta tetap terbaca.
            {showUnpredicted ? " Wilayah tanpa prediksi diberi warna abu-abu; skornya tidak dihitung." : ""}
            {onOnlyLevelChange ? (
              onlyLevel ? (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={() => onOnlyLevelChange(null)}
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    Tampilkan semua level
                  </button>
                </>
              ) : (
                " Klik satu level untuk menampilkan level itu saja."
              )
            ) : null}
          </p>
        </Section>
      ) : null}

      {layers.includes("hotspot") ? (
        <Section
          title="Hotspot"
          count={<Count value={counts?.hotspots?.total} unit="titik" />}
          description={`Titik panas satelit${rangeLabel ? `, ${rangeLabel} terakhir` : ""}. Kepekatan = tingkat kepercayaan, ukuran = FRP.`}
        >
          <ul className="flex flex-col gap-0.5">
            {CONFIDENCE_LEVELS.map((level) => (
              <li key={level} {...hover({ kind: "kepercayaan", level })} className="flex min-h-6 items-center gap-2 text-xs">
                <span className="flex w-7 justify-center">
                  <HotspotGlyph size={10} opacity={HOTSPOT_OPACITY[level]} />
                </span>
                <span className="flex-1">Kepercayaan {CONFIDENCE_LABELS[level].toLowerCase()}</span>
                {tier === "dekat" ? <Count value={counts?.hotspots?.byConfidence[level]} /> : null}
              </li>
            ))}
          </ul>
          <div className="flex items-end gap-3 pt-1" aria-label="Skala ukuran FRP">
            {FRP_EXAMPLES.map((frp) => (
              <span key={frp} className="flex flex-col items-center gap-0.5">
                <HotspotGlyph size={Math.round(hotspotRadius(frp) * 2)} />
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{formatInteger(frp)} MW</span>
              </span>
            ))}
            <span className="pb-0.5 text-[11px] text-muted-foreground">FRP</span>
          </div>
          {tier !== "dekat" ? (
            <div {...hover({ kind: "kelompok" })} className="flex items-start gap-2 pt-1 text-xs">
              <span className="flex w-7 justify-center">
                <GroupGlyph />
              </span>
              <span className="flex-1 text-[11px] leading-4 text-muted-foreground">
                <span className="font-medium text-foreground">Kelompok hotspot</span>: angka = jumlah titik yang berdekatan.
                Klik untuk memperbesar.
              </span>
              <Count value={counts?.hotspots?.groups} />
            </div>
          ) : null}
        </Section>
      ) : null}

      {layers.includes("zona") ? (
        <Section
          title="Zona kebakaran"
          count={<Count value={zoneTotal} unit="zona" />}
          description="Kelompok hotspot hari terakhir. Gaya garis menunjukkan perubahan dibanding kemarin."
        >
          <ul className="flex flex-col gap-0.5">
            {CLUSTER_STATUSES.map((status) => (
              <li key={status} {...hover({ kind: "zona", status })} className="flex min-h-6 items-center gap-2 text-xs">
                <ZoneStatusGlyph {...ZONE_STYLES[status]} />
                <span className="flex-1">{CLUSTER_STATUS_LABELS[status]}</span>
                <Count value={counts?.zones?.[status]} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {layers.includes("gambut") ? (
        <Section
          title="Lahan gambut"
          count={tier === "dekat" ? <Count value={counts?.peat} unit="kotak" /> : null}
        >
          <div {...hover({ kind: "gambut" })} className="flex items-center gap-2 text-xs">
            <span className="flex w-7 justify-center">
              <PeatGlyph />
            </span>
            <span className="text-[11px] leading-4 text-muted-foreground">
              {tier === "dekat" ? "Kotak grid yang berada di lahan gambut." : `Tampil saat peta diperbesar (zoom ${GRID_MIN_ZOOM} ke atas).`}
            </span>
          </div>
          {tier === "dekat" && counts?.peatUnknown ? (
            <p className="text-[11px] leading-4 text-muted-foreground">
              Data gambut belum tersedia untuk {formatInteger(counts.peatUnknown)} kotak di layar.
            </p>
          ) : null}
        </Section>
      ) : null}

      {layers.includes("batas") ? (
        <Section title="Batas wilayah">
          <ul className="flex flex-col gap-0.5">
            <li {...hover({ kind: "batas", tier: "provinsi" })} className="flex min-h-6 items-center gap-2 text-xs">
              <LineGlyph weight={2} />
              Provinsi
            </li>
            <li {...hover({ kind: "batas", tier: "kabupaten" })} className="flex min-h-6 items-center gap-2 text-xs">
              <LineGlyph weight={0.8} />
              <span className="flex-1">Kabupaten/kota</span>
              {tier === "provinsi" ? <span className="text-[11px] text-muted-foreground">mulai zoom {REGENCY_MIN_ZOOM}</span> : null}
            </li>
          </ul>
        </Section>
      ) : null}

      <footer className="flex flex-col gap-1 border-t pt-3 text-[11px] leading-4 text-muted-foreground">
        {dataDate ? (
          <p>
            Data {formatDate(dataDate)}
            {mock ? " · data contoh" : ""}
          </p>
        ) : null}
        <p>
          Sumber: NASA FIRMS (hotspot {SATELLITE_NAMES}), model prediksi Suar (risiko), geoBoundaries (batas wilayah).
        </p>
        <p className="flex items-start gap-1.5 text-foreground">
          <Info aria-hidden="true" className="mt-px size-3 shrink-0" />
          Hotspot belum tentu kebakaran terkonfirmasi.
        </p>
      </footer>
    </div>
  );
}

/** Collapsible floating legend (desktop and region maps). */
export const MapLegend = memo(function MapLegend({
  defaultOpen,
  className,
  ...props
}: LegendProps & { defaultOpen: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  if (props.layers.length === 0) return null;
  return (
    <section
      aria-label="Legenda peta"
      className={cn("glass-panel flex max-h-[min(62dvh,34rem)] w-60 flex-col overflow-hidden rounded-xl text-xs", className)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 w-full shrink-0 items-center gap-2 px-3 font-medium transition-colors duration-150 hover:bg-muted/60 pointer-coarse:min-h-11"
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
            className="flex min-h-0 flex-col"
          >
            <div
              // Scrollable region; focusable so keyboard users can scroll it.
              tabIndex={0}
              aria-label="Isi legenda"
              className="min-h-0 overflow-y-auto overscroll-contain border-t px-3 py-3"
              onMouseLeave={() => props.onHighlight?.(null)}
            >
              <LegendContent {...props} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
});

/** Mobile: a "Legenda" button that opens the legend in a bottom drawer. */
export const MapLegendDrawer = memo(function MapLegendDrawer({ className, ...props }: LegendProps & { className?: string }) {
  const [open, setOpen] = useState(false);
  if (props.layers.length === 0) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className={cn("glass-panel h-11 rounded-xl px-3", className)}>
        <ListTree />
        Legenda
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="px-4 pt-2 pb-2 text-left">
            <DrawerTitle>Legenda</DrawerTitle>
            <DrawerDescription className="text-xs">Lapisan yang sedang tampil di peta</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <LegendContent {...props} onHighlight={undefined} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
});
