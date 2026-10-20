"use client";

import { AlertIcon, InfoIcon } from "@/components/ui/icons";

export type MapStatusItem =
  | { kind: "loading"; message: string }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string; onRetry: () => void };

/** Status pills floating over the map: loading, empty result, and errors with retry. */
export function MapStatus({ items }: { items: MapStatusItem[] }) {
  return (
    <div aria-live="polite" className="pointer-events-none flex flex-col items-center gap-2">
      {items.map((item) => (
        <div
          key={`${item.kind}-${item.message}`}
          role={item.kind === "error" ? "alert" : "status"}
          className="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm text-fg shadow-sm"
        >
          {item.kind === "loading" ? (
            <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-line border-t-primary" />
          ) : item.kind === "error" ? (
            <AlertIcon className="size-4 shrink-0 text-accent" />
          ) : (
            <InfoIcon className="size-4 shrink-0 text-fg-muted" />
          )}
          <span className="min-w-0">{item.message}</span>
          {item.kind === "error" ? (
            <button
              type="button"
              onClick={item.onRetry}
              className="-my-2 ml-1 min-h-11 rounded-full px-3 font-medium text-primary underline-offset-2 hover:underline"
            >
              Coba lagi
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
