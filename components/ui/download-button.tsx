"use client";

import { clsx } from "clsx";
import { downloadCsv, toCsv } from "@/lib/csv";
import { DownloadIcon } from "./icons";

type Cell = string | number | boolean | null | undefined;

/** Builds a CSV from data already loaded in the page and downloads it. */
export function DownloadCsvButton({
  filename,
  header,
  rows,
  label = "Unduh CSV",
  variant = "primary",
}: {
  filename: string;
  header: string[];
  rows: Cell[][];
  label?: string;
  variant?: "primary" | "ghost";
}) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv(filename, toCsv(header, rows))}
      className={clsx(
        "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium",
        variant === "primary"
          ? "bg-primary text-primary-fg hover:opacity-90"
          : "border border-line text-fg hover:bg-surface-2",
      )}
    >
      <DownloadIcon className="size-4" />
      {label}
    </button>
  );
}
