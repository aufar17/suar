import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ChevronRightIcon } from "@/components/ui/icons";
import { RiskBadge } from "@/components/ui/risk-badge";
import { getDataStatus, getRegions, getRegionStats } from "@/lib/data";
import { addDaysIso, formatDayShort, formatDecimal, formatInteger } from "@/lib/format";
import { getRiskLevel } from "@/lib/risk";

export const metadata: Metadata = {
  title: "Wilayah",
  description: "Daftar 12 kabupaten/kota di Provinsi Riau dengan prediksi risiko kebakaran besok dan jumlah hotspot 30 hari.",
};

export default async function WilayahIndexPage() {
  const [status, regions] = await Promise.all([getDataStatus(), getRegions()]);
  const stats = await getRegionStats({
    date: status.prediksi_mulai,
    start: addDaysIso(status.tanggal_data, -29),
    end: status.tanggal_data,
  });
  const bySlug = new Map(stats.map((s) => [s.slug, s]));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Wilayah</h1>
        <p className="mt-1 text-sm text-fg-muted">
          12 kabupaten/kota di Provinsi Riau. Risiko untuk {formatDayShort(status.prediksi_mulai)}, hotspot 30 hari
          terakhir.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {regions.map((region) => {
          const stat = bySlug.get(region.slug);
          const score = stat?.rata_skor_risiko ?? 0;
          return (
            <li key={region.slug}>
              <Card className="h-full transition-colors hover:border-primary">
                <Link href={`/wilayah/${region.slug}`} className="flex min-h-11 items-center gap-3 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-fg-muted">{region.level === "kota" ? "Kota" : "Kabupaten"}</span>
                    <span className="block truncate text-base font-semibold text-fg">{region.nama}</span>
                    <span className="mt-1 block text-xs text-fg-muted">
                      <span className="font-mono text-fg">{formatInteger(stat?.jumlah_hotspot ?? 0)}</span> hotspot ·
                      skor <span className="font-mono text-fg">{formatDecimal(score)}</span>
                    </span>
                  </span>
                  <RiskBadge level={getRiskLevel(score)} size="sm" />
                  <ChevronRightIcon className="size-4 shrink-0 text-fg-muted" />
                </Link>
              </Card>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
