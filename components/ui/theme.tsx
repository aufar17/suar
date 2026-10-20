"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark";

/** Resolved theme ("system" mapped to light/dark). Client-only components read this for map colors. */
export function useResolvedTheme(): Theme {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? "dark" : "light";
}

/**
 * Light/dark toggle. Both icons are rendered and swapped with CSS on the `dark` class,
 * so the button is correct before hydration and animates on change.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ganti tema terang atau gelap"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className={cn("relative overflow-hidden", className)}
        >
          <Sun className="size-[18px] scale-100 rotate-0 transition-transform duration-300 ease-out dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-[18px] scale-0 rotate-90 transition-transform duration-300 ease-out dark:scale-100 dark:rotate-0" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Ganti tema</TooltipContent>
    </Tooltip>
  );
}
