"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Live result of a CSS media query. `false` during server render and hydration. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Matches Tailwind's `lg` breakpoint, where the map page switches to its desktop layout. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
