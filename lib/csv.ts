type Cell = string | number | boolean | null | undefined;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** RFC 4180 CSV. Numbers keep a dot decimal so spreadsheets and scripts parse them. */
export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

/** Triggers a client-side download. Adds a BOM so Excel reads UTF-8 correctly. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
