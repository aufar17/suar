import { Loader2 } from "lucide-react";

/** Placeholder with the map's footprint while the map loads (no layout shift). */
export function MapSkeleton({ label = "Memuat peta…" }: { label?: string }) {
  return (
    <div role="status" className="relative flex h-full w-full items-center justify-center overflow-hidden bg-muted">
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-pulse opacity-60 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:48px_48px]"
      />
      <span className="glass-panel relative flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        {label}
      </span>
    </div>
  );
}
