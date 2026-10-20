import Link from "next/link";
import { CardHeader } from "@/components/ui/legacy-card";
import { Skeleton } from "@/components/ui/controls";
import { ChevronRightIcon } from "@/components/ui/icons";
import { RiskBadge } from "@/components/ui/risk-badge";
import { formatDayShort, formatDecimal } from "@/lib/format";
import { getRiskLevel } from "@/lib/risk";
import type { RegionStat } from "@/types";

/** "5 kabupaten paling rawan" by mean risk score for the selected target date. */
export function TopRegions({
  stats,
  targetDate,
  error,
}: {
  stats: RegionStat[] | undefined;
  targetDate: string;
  error?: string;
}) {
  const top = (stats ?? []).slice(0, 5);
  return (
    <div className="flex flex-col gap-3">
      <CardHeader
        title="5 kabupaten paling rawan"
        description={`Rata-rata skor risiko, ${formatDayShort(targetDate)}`}
      />
      {error ? (
        <p role="alert" className="text-sm text-muted-foreground">
          Gagal memuat peringkat. {error}
        </p>
      ) : !stats ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : (
        <ol className="flex flex-col">
          {top.map((region, index) => {
            const level = getRiskLevel(region.rata_skor_risiko);
            return (
              <li key={region.slug}>
                <Link
                  href={`/wilayah/${region.slug}`}
                  className="-mx-2 flex min-h-11 items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted"
                >
                  <span className="w-4 font-mono text-xs text-muted-foreground">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{region.nama}</span>
                    <span className="mt-1 block h-1.5 rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${region.rata_skor_risiko * 100}%` }}
                      />
                    </span>
                  </span>
                  <span className="font-mono text-sm text-foreground">{formatDecimal(region.rata_skor_risiko)}</span>
                  <RiskBadge level={level} size="sm" />
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
