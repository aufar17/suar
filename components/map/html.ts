const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for Leaflet popup/tooltip HTML strings. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

/** Builds a definition-list popup body from label/value pairs. */
export function popupHtml(title: string, rows: [string, string][]): string {
  const items = rows
    .map(
      ([label, value]) =>
        `<div style="display:flex;justify-content:space-between;gap:16px"><dt style="color:var(--fg-muted)">${escapeHtml(label)}</dt><dd style="margin:0;font-family:var(--font-mono);text-align:right">${escapeHtml(value)}</dd></div>`,
    )
    .join("");
  return `<p style="margin:0 0 6px;font-weight:600">${escapeHtml(title)}</p><dl style="margin:0;display:grid;gap:2px;min-width:200px">${items}</dl>`;
}
