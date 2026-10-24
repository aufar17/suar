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
