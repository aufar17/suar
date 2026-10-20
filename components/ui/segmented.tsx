"use client";

import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible label when `label` is not plain text. */
  ariaLabel?: string;
}

/**
 * Single-choice segmented control (Radix ToggleGroup: arrow keys move, one item is
 * always selected). The selected pill slides between items.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  size = "default",
}: {
  /** Accessible name of the group. */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "default";
}) {
  const layoutId = useId();
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
      aria-label={label}
      className={cn("flex w-full gap-0.5 rounded-lg bg-muted p-1", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={option.ariaLabel}
            className={cn(
              "relative flex-1 rounded-md! border-0 bg-transparent! text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-[state=on]:text-foreground",
              size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-[13px]",
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                aria-hidden="true"
                className="absolute inset-0 rounded-md bg-background shadow-sm ring-1 ring-border/60 dark:bg-card"
                transition={{ type: "spring", bounce: 0.15, duration: 0.25 }}
              />
            ) : null}
            <span className="relative z-10">{option.label}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
