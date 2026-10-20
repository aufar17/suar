export function MapSkeleton({ label = "Memuat peta…" }: { label?: string }) {
  return (
    <div role="status" className="flex h-full w-full animate-pulse items-center justify-center bg-surface-2">
      <span className="rounded-lg bg-surface px-3 py-2 text-sm text-fg-muted">{label}</span>
    </div>
  );
}
