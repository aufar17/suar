"use client";

import { ArrowRight, CalendarClock, Flame, Gauge, MapPin, Ruler, Satellite, ShieldCheck, Timer, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { diffDaysIso, formatDate, formatDateTime, formatDecimal, formatInteger } from "@/lib/format";
import {
  CLUSTER_STATUS_DESCRIPTIONS,
  CLUSTER_STATUS_LABELS,
  CONFIDENCE_LABELS,
  regionHref,
  SATELLITE_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ClusterFeature, ClusterStatus, HotspotFeature } from "@/types";

/**
 * Feature details: a floating, non-modal sheet on desktop (the map stays usable, so
 * another feature can be picked while it is open) and a bottom drawer on mobile.
 */
export function DetailPanel({
  open,
  onClose,
  desktop,
  eyebrow,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  desktop: boolean;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  if (desktop) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()} modal={false}>
        <SheetContent
          variant="floating"
          className="gap-0 p-0"
          // Clicks on the map select another feature instead of closing the panel.
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader className="gap-0.5 border-b px-5 pt-4 pb-3.5 pr-14">
            <SheetDescription className="text-xs">{eyebrow}</SheetDescription>
            <SheetTitle className="text-lg tracking-tight">{title}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="gap-0.5 border-b px-5 pt-2 pb-3 text-left">
          <DrawerDescription className="text-xs">{eyebrow}</DrawerDescription>
          <DrawerTitle className="text-lg tracking-tight">{title}</DrawerTitle>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export interface InfoTile {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  /** Numbers use the mono face. */
  mono?: boolean;
}

/** Small grid of labelled values (weather, land, zone facts). */
export function InfoGrid({ items, className }: { items: InfoTile[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-2", className)}>
      {items.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.04 * index }}
          className="flex min-w-0 flex-col gap-1 rounded-xl bg-muted/70 px-3 py-2.5"
        >
          <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <item.icon aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </dt>
          <dd className={cn("truncate text-sm font-medium", item.mono && "font-mono tabular-nums")}>{item.value}</dd>
        </motion.div>
      ))}
    </dl>
  );
}

export function RegionLink({ href, name }: { href: string; name: string }) {
  return (
    <Button asChild size="lg" className="w-full">
      <Link href={href}>
        Buka halaman {name}
        <ArrowRight />
      </Link>
    </Button>
  );
}

export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="mb-3 text-sm font-semibold tracking-tight">
      {children}
    </h3>
  );
}

const STATUS_STYLES: Record<ClusterStatus, string> = {
  baru: "bg-ember-soft text-ember-ink ring-ember/40",
  meluas: "bg-primary text-primary-foreground ring-transparent",
  stabil: "bg-muted text-foreground ring-border",
  menyusut: "bg-transparent text-muted-foreground ring-border",
};

export function ClusterDetail({ feature, regionName }: { feature: ClusterFeature; regionName: string }) {
  const p = feature.properties;
  const days = diffDaysIso(p.tanggal, p.aktif_sejak) + 1;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className={cn("w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", STATUS_STYLES[p.status])}>
          {CLUSTER_STATUS_LABELS[p.status]}
        </span>
        <p className="text-sm text-muted-foreground">{CLUSTER_STATUS_DESCRIPTIONS[p.status]}</p>
      </div>
      <InfoGrid
        items={[
          { icon: Flame, label: "Jumlah hotspot", value: formatInteger(p.jumlah_hotspot), mono: true },
          { icon: Ruler, label: "Luas", value: `${formatDecimal(p.luas_km2, 1)} km²`, mono: true },
          { icon: Timer, label: "Aktif", value: `${formatInteger(days)} hari` },
          { icon: CalendarClock, label: "Aktif sejak", value: formatDate(p.aktif_sejak) },
          { icon: MapPin, label: "Kabupaten/kota", value: regionName },
          { icon: CalendarClock, label: "Tanggal data", value: formatDate(p.tanggal) },
        ]}
      />
      <RegionLink href={regionHref({ slug: p.kabupaten, provinsi: p.provinsi })} name={regionName} />
    </div>
  );
}

export function HotspotDetail({ feature, regionName }: { feature: HotspotFeature; regionName: string }) {
  const p = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-muted-foreground">Fire Radiative Power</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">
          <span className="font-mono tabular-nums">{formatDecimal(p.frp, 1)}</span>
          <span className="ml-1.5 text-base font-medium text-muted-foreground">MW</span>
        </p>
      </div>
      <InfoGrid
        items={[
          { icon: CalendarClock, label: "Waktu deteksi", value: formatDateTime(p.waktu_deteksi) },
          { icon: Satellite, label: "Satelit", value: SATELLITE_LABELS[p.satelit] },
          { icon: ShieldCheck, label: "Kepercayaan", value: CONFIDENCE_LABELS[p.confidence] },
          { icon: Gauge, label: "FRP", value: `${formatDecimal(p.frp, 1)} MW`, mono: true },
          { icon: MapPin, label: "Kabupaten/kota", value: regionName },
          { icon: MapPin, label: "Koordinat", value: `${formatDecimal(lat, 3)}, ${formatDecimal(lon, 3)}`, mono: true },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        Hotspot adalah titik panas dari satelit, belum tentu kebakaran yang terkonfirmasi di lapangan.
      </p>
      <RegionLink href={regionHref({ slug: p.kabupaten, provinsi: p.provinsi })} name={regionName} />
    </div>
  );
}
