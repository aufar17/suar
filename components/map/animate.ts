import type L from "leaflet";
import { prefersReducedMotion } from "@/lib/use-media-query";

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Runs `onFrame(progress)` on animation frames for `duration` ms (eased 0 → 1).
 * With reduced motion it jumps straight to the end. Returns a cancel function.
 */
export function tween(duration: number, onFrame: (progress: number) => void, onDone?: () => void): () => void {
  if (prefersReducedMotion() || duration <= 0) {
    onFrame(1);
    onDone?.();
    return () => {};
  }
  let frame = 0;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    onFrame(easeOut(t));
    if (t < 1) frame = requestAnimationFrame(step);
    else onDone?.();
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

type PathStyle = Pick<L.PathOptions, "opacity" | "fillOpacity">;

/**
 * Fades every path in a group from 0 to its own style. `base` returns the resting
 * opacities of a path, so later restyles (e.g. a risk opacity slider) stay correct.
 */
export function fadeInPaths(paths: Iterable<L.Path>, base: (path: L.Path) => PathStyle, duration = 220) {
  const items = [...paths];
  return tween(duration, (p) => {
    for (const path of items) {
      const style = base(path);
      path.setStyle({ opacity: (style.opacity ?? 1) * p, fillOpacity: (style.fillOpacity ?? 0) * p });
    }
  });
}

/** Fades the group out, then removes it from the map. */
export function fadeOutAndRemove(group: L.FeatureGroup, base: (path: L.Path) => PathStyle, duration = 180) {
  const items = group.getLayers() as L.Path[];
  tween(
    duration,
    (p) => {
      for (const path of items) {
        const style = base(path);
        path.setStyle({ opacity: (style.opacity ?? 1) * (1 - p), fillOpacity: (style.fillOpacity ?? 0) * (1 - p) });
      }
    },
    () => group.remove(),
  );
}

/** Linear blend of two hex colors (#RRGGBB). */
export function mixHex(from: string, to: string, t: number): string {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const channel = (shift: number) => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, "0")}`;
}
