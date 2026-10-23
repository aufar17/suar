import { ArrowUpRight, Flame } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RiskBadge } from "@/components/ui/risk-badge";
import { getDataStatus, getRegionStats } from "@/lib/data";
import { addDaysIso, formatDayShort, formatDecimal, formatInteger } from "@/lib/format";
import { regionHref } from "@/lib/labels";
import { getRiskLevel } from "@/lib/risk";
import { cn } from "@/lib/utils";
import type { RegionStat, RiskLevel } from "@/types";

export const metadata: Metadata = {
  title: "Wilayah",
  description:
    "Daftar provinsi di Indonesia dengan prediksi risiko kebakaran besok dan jumlah hotspot 30 hari, serta kabupaten/kota paling rawan.",
};

const BAR: Record<RiskLevel, string> = {
  rendah: "bg-muted-foreground/45",
  sedang: "bg-risk-sedang",
  tinggi: "bg-risk-tinggi",
  sangat_tinggi: "bg-risk-sangat-tinggi",
};

/** Regencies listed under "paling rawan". */
const TOP_REGENCIES = 12;

function RegionCard({ stat, eyebrow }: { stat: RegionStat; eyebrow: string }) {
  const level = getRiskLevel(stat.rata_skor_risiko);
  return (
    <Link
      href={regionHref(stat)}
      className="group flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[var(--shadow-panel)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{eyebrow}</p>
          <p className="truncate text-lg font-semibold tracking-tight">{stat.nama}</p>
        </div>
        <ArrowUpRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
        />
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Flame aria-hidden="true" className="size-3.5" />
            <span className="font-mono text-foreground">{formatInteger(stat.jumlah_hotspot)}</span> hotspot
          </span>
          <span className="flex items-center gap-2">
            <span className="font-mono">{formatDecimal(stat.rata_skor_risiko)}</span>
            <RiskBadge level={level} size="sm" />
          </span>
        </div>
        <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className={cn("block h-full rounded-full", BAR[level])}
            style={{ width: `${Math.max(2, stat.rata_skor_risiko * 100)}%` }}
          />
        </span>
      </div>
    </Link>
  );
}

export default async function WilayahIndexPage() {
  const status = await getDataStatus();
  const window30 = { date: status.prediksi_mulai, start: addDaysIso(status.tanggal_data, -29), end: status.tanggal_data };
  const [provinces, regencies] = await Promise.all([
    getRegionStats({ ...window30, level: "provinsi" }),
    getRegionStats({ ...window30, level: "kabupaten" }),
  ]);
  const provinceNames = new Map(provinces.map((p) => [p.slug, p.nama]));
  // Both lists come sorted by mean risk, so they answer "where should I look?".
  const riskiest = regencies.slice(0, TOP_REGENCIES);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-6 sm:py-8 lg:px-8 lg:py-10">
      <header>
        <p className="text-sm font-medium text-ember-ink">Wilayah</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {formatInteger(provinces.length)} provinsi, {formatInteger(regencies.length)} kabupaten/kota
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Diurutkan dari rata-rata risiko tertinggi untuk {formatDayShort(status.prediksi_mulai)}. Jumlah hotspot dihitung
          30 hari terakhir. Gunakan pencarian (Ctrl/⌘ K) untuk membuka kabupaten/kota mana pun.
        </p>
      </header>

      <section aria-labelledby="kabupaten-rawan" className="flex flex-col gap-4">
        <h2 id="kabupaten-rawan" className="text-base font-semibold tracking-tight">
          {TOP_REGENCIES} kabupaten/kota paling rawan
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {riskiest.map((stat) => (
            <li key={stat.slug}>
              <RegionCard
                stat={stat}
                eyebrow={`${stat.level === "kota" ? "Kota" : "Kabupaten"} · ${provinceNames.get(stat.provinsi ?? "") ?? ""}`}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="provinsi" className="flex flex-col gap-4">
        <h2 id="provinsi" className="text-base font-semibold tracking-tight">
          Semua provinsi
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {provinces.map((stat) => (
            <li key={stat.slug}>
              <RegionCard stat={stat} eyebrow="Provinsi" />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
