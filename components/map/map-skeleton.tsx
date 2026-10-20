export function MapSkeleton({ label = "Memuat peta…" }: { label?: string }) {
  return (
    <div role="status" className="flex h-full w-full animate-pulse items-center justify-center bg-muted">
      <span className="rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
