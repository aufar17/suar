"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";

type Cell = string | number | boolean | null | undefined;

/** Builds a CSV from data already loaded in the page, downloads it, and confirms with a toast. */
export function DownloadCsvButton({
  filename,
  header,
  rows,
  label = "Unduh CSV",
  variant = "default",
  className,
}: {
  filename: string;
  header: string[];
  rows: Cell[][];
  label?: string;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}) {
  const download = () => {
    try {
      downloadCsv(filename, toCsv(header, rows));
      toast.success("CSV berhasil diunduh", { description: `${filename} · ${rows.length} baris` });
    } catch {
      toast.error("CSV gagal dibuat", { description: "Coba lagi beberapa saat lagi." });
    }
  };
  return (
    <Button variant={variant} onClick={download} className={className}>
      <Download />
      {label}
    </Button>
  );
}
