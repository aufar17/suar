// HTML for the map tooltip (see interactions.tsx).

/** Tooltip body: bold title, an optional note under it, optional detail rows, and a hint line. */
export function tooltipHtml(title: string, rows: [string, string][] = [], hint?: string, note?: string): string {
  const notice = note ? `<div style="margin-bottom:${rows.length ? 4 : 0}px">${escapeHtml(note)}</div>` : "";
  const body = rows
    .map(
      ([label, value]) =>
        `<div style="display:flex;justify-content:space-between;gap:14px"><span style="color:var(--muted-foreground)">${escapeHtml(label)}</span><span style="font-family:var(--font-mono);font-variant-numeric:tabular-nums">${escapeHtml(value)}</span></div>`,
    )
    .join("");
  const footer = hint ? `<div style="margin-top:4px;color:var(--muted-foreground);font-size:11px">${escapeHtml(hint)}</div>` : "";
  return `<div style="font-weight:600;margin-bottom:${rows.length || note ? 4 : 0}px">${title}</div>${notice}${body}${footer}`;
}

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for map tooltip HTML strings. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

/** Small colored chip used inside tooltip titles (always paired with a text label). */
export function swatchHtml(color: string, outlined = false): string {
  return `<span style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;vertical-align:0;background:${color};${outlined ? "border:1px solid var(--muted-foreground)" : ""}"></span>`;
}
