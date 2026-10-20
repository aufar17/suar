import { getRiskLabel, RISK_BADGE_CLASSES } from "@/lib/risk";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types";

/** Risk level chip. Color is never the only cue: the level is always written out. */
export function RiskBadge({
  level,
  size = "md",
  prefix,
  className,
}: {
  level: RiskLevel;
  size?: "sm" | "md" | "lg";
  prefix?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        level === "rendah" && "ring-1 ring-border ring-inset",
        RISK_BADGE_CLASSES[level],
        size === "sm" && "px-2 py-0.5 text-[11px]",
        size === "md" && "px-2.5 py-0.5 text-xs",
        size === "lg" && "px-3 py-1 text-sm",
        className,
      )}
    >
      {prefix ? <span className="opacity-80">{prefix}</span> : null}
      {getRiskLabel(level)}
    </span>
  );
}

/** Small color swatch for legends. "rendah" is drawn as an outlined box (transparent on the map). */
export function RiskSwatch({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-3.5 shrink-0 rounded-[4px] border",
        level === "rendah" ? "border-muted-foreground/70 bg-transparent" : "border-transparent",
        level === "sedang" && "bg-risk-sedang",
        level === "tinggi" && "bg-risk-tinggi",
        level === "sangat_tinggi" && "bg-risk-sangat-tinggi",
        className,
      )}
    />
  );
}
