"use client";

import { AlertTriangle, Info, Loader2, RotateCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MapStatusItem =
  | { kind: "loading"; message: string }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string; onRetry: () => void };

/** Status pills floating over the map: loading, empty result, and errors with retry. */
export function MapStatus({ items, className }: { items: MapStatusItem[]; className?: string }) {
  return (
    <div aria-live="polite" className={cn("pointer-events-none flex flex-col items-center gap-2", className)}>
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={`${item.kind}-${item.message}`}
            layout
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            role={item.kind === "error" ? "alert" : "status"}
            className={cn(
              "glass-panel pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full py-1.5 pr-1.5 pl-3.5 text-[13px]",
              item.kind !== "error" && "pr-3.5",
            )}
          >
            {item.kind === "loading" ? (
              <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : item.kind === "error" ? (
              <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-destructive" />
            ) : (
              <Info aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0">{item.message}</span>
            {item.kind === "error" ? (
              <Button size="sm" variant="secondary" onClick={item.onRetry} className="h-7 rounded-full">
                <RotateCw /> Coba lagi
              </Button>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
