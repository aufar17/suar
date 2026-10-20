"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon, CloseIcon } from "@/components/ui/icons";
import { diffDaysIso, formatDate, formatDecimal, formatInteger } from "@/lib/format";
import { CLUSTER_STATUS_DESCRIPTIONS, CLUSTER_STATUS_LABELS } from "@/lib/labels";
import type { ClusterFeature, ClusterStatus } from "@/types";

export function DetailHeader({ eyebrow, title, onClose }: { eyebrow: string; title: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup detail"
        className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

export function DetailRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="flex flex-col divide-y divide-border text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RegionLink({ slug, name }: { slug: string; name: string }) {
  return (
    <Link
      href={`/wilayah/${slug}`}
      className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
    >
      Lihat halaman {name}
      <ArrowRightIcon className="size-4" />
    </Link>
  );
}

const STATUS_STYLES: Record<ClusterStatus, string> = {
  baru: "bg-ember text-ember-foreground",
  meluas: "bg-primary text-primary-foreground",
  stabil: "bg-muted text-foreground ring-1 ring-border ring-inset",
  menyusut: "bg-muted text-muted-foreground ring-1 ring-border ring-inset",
};

export function ClusterDetail({
  feature,
  regionName,
  onClose,
}: {
  feature: ClusterFeature;
  regionName: string;
  onClose: () => void;
}) {
  const p = feature.properties;
  const days = diffDaysIso(p.tanggal, p.aktif_sejak) + 1;
  return (
    <div className="flex flex-col gap-4">
      <DetailHeader eyebrow="Zona kebakaran" title={`${regionName} · ${p.id}`} onClose={onClose} />
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[p.status]}`}>
          {CLUSTER_STATUS_LABELS[p.status]}
        </span>
        <p className="text-xs text-muted-foreground">{CLUSTER_STATUS_DESCRIPTIONS[p.status]}</p>
      </div>
      <DetailRows
        rows={[
          ["Jumlah hotspot", <span key="n" className="font-mono">{formatInteger(p.jumlah_hotspot)}</span>],
          ["Luas", <span key="l" className="font-mono">{formatDecimal(p.luas_km2, 1)} km²</span>],
          ["Aktif sejak", `${formatDate(p.aktif_sejak)} (${formatInteger(days)} hari)`],
          ["Kabupaten/kota", regionName],
          ["Tanggal data", formatDate(p.tanggal)],
        ]}
      />
      <RegionLink slug={p.kabupaten} name={regionName} />
    </div>
  );
}
