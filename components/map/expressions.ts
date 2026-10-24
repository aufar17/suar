import type { ExpressionSpecification } from "maplibre-gl";

// Small builders for style expressions whose length is only known at runtime.

export const TRANSPARENT = "rgba(0,0,0,0)";

export const HOVER: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];

/** `["match", input, label1, output1, …, fallback]`; returns the fallback when there are no pairs. */
export function matchExpression<T extends string | number>(
  input: ExpressionSpecification,
  pairs: [string, T][],
  fallback: T,
): ExpressionSpecification | T {
  if (pairs.length === 0) return fallback;
  return ["match", input, ...pairs.flat(), fallback] as unknown as ExpressionSpecification;
}

/** True when `["get", key]` is one of `values`. */
export function inList(key: string, values: string[]): ExpressionSpecification {
  return ["in", ["get", key], ["literal", values]];
}

/** `value` inside the zoom range [min, max), 0 outside (for opacity paint properties). */
export function zoomRange(value: number, [min, max]: [number, number]): number | ExpressionSpecification {
  if (min <= 0 && max >= 24) return value;
  if (min <= 0) return ["step", ["zoom"], value, max, 0];
  if (max >= 24) return ["step", ["zoom"], 0, min, value];
  return ["step", ["zoom"], 0, min, value, max, 0];
}

/** "#RRGGBB" with an alpha channel, as rgba(). */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
