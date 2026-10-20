"use client";

import { clsx } from "clsx";
import { useId, type ReactNode } from "react";
import { ChevronUpIcon } from "@/components/ui/icons";

/** Mobile bottom sheet: a peek area that is always visible, and content that expands. */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  peek,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  peek?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const contentId = useId();
  return (
    <section
      aria-label="Panel informasi"
      className={clsx(
        "absolute inset-x-0 bottom-0 z-[700] flex max-h-[75%] flex-col rounded-t-2xl border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.08)]",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => onOpenChange(!open)}
        className="flex min-h-12 w-full shrink-0 flex-col items-stretch px-4 pt-2 text-left"
      >
        <span aria-hidden="true" className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-border" />
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</span>
          <span className="sr-only">{open ? "Tutup panel" : "Buka panel"}</span>
          <ChevronUpIcon className={clsx("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {peek ? <div className="shrink-0 px-4 pb-3">{peek}</div> : null}
      <div id={contentId} hidden={!open} className="min-h-0 overflow-y-auto overscroll-contain border-t border-border px-4 py-4">
        {children}
      </div>
    </section>
  );
}
