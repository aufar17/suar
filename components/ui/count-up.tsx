"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * Number that counts from its previous value to the new one when it changes.
 * The first render (and every render for reduced-motion users) shows the final value.
 */
export function CountUp({
  value,
  format,
  duration = 0.6,
  className,
}: {
  value: number;
  format: (value: number) => string;
  /** Seconds. */
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  const formatRef = useRef(format);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    const node = ref.current;
    const from = previous.current;
    previous.current = value;
    if (!node || from === value || reduceMotion) {
      if (node) node.textContent = formatRef.current(value);
      return;
    }
    const controls = animate(from, value, {
      duration,
      ease: [0.2, 0, 0, 1],
      onUpdate: (latest) => {
        node.textContent = formatRef.current(latest);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduceMotion]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
