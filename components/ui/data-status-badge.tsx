import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DataStatus } from "@/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** "Data contoh · diperbarui 20 Okt 2026" with the exact time and source in a tooltip. */
export function DataStatusBadge({
  status,
  className,
  detailed = false,
}: {
  status: DataStatus;
  className?: string;
  /** Static variant with the full time written out (no tooltip), e.g. inside the mobile menu. */
  detailed?: boolean;
}) {
  const mock = status.sumber === "mock";
  if (detailed) {
    return (
      <div className={cn("flex items-start gap-2.5 text-xs text-muted-foreground", className)}>
        <span className={cn("mt-1 size-2 shrink-0 rounded-full", mock ? "bg-ember" : "bg-emerald-500")} aria-hidden="true" />
        <p>
          <span className="font-medium text-foreground">{mock ? "Data contoh" : "Data pipeline"}</span>
          <br />
          Diperbarui <time dateTime={status.terakhir_diperbarui}>{formatDateTime(status.terakhir_diperbarui)}</time>
        </p>
      </div>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-full border bg-card px-3 text-xs pointer-coarse:h-11 text-muted-foreground transition-colors hover:text-foreground",
            className,
          )}
        >
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", mock ? "bg-ember" : "bg-emerald-500")} />
          <span className="font-medium text-foreground">{mock ? "Data contoh" : "Data pipeline"}</span>
          <span aria-hidden="true" className="hidden lg:inline">
            ·
          </span>
          <span className="hidden lg:inline">
            diperbarui <time dateTime={status.terakhir_diperbarui}>{formatDate(status.terakhir_diperbarui.slice(0, 10))}</time>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-pretty">
        Terakhir diperbarui {formatDateTime(status.terakhir_diperbarui)}.{" "}
        {mock ? "Angka di dashboard ini masih data tiruan selama pengembangan." : "Data dari pipeline Suar."}
      </TooltipContent>
    </Tooltip>
  );
}
