import { clsx } from "clsx";
import { getRiskLabel, RISK_BADGE_CLASSES } from "@/lib/risk";
import type { RiskLevel } from "@/types";

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
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        level === "rendah" && "ring-1 ring-line ring-inset",
        RISK_BADGE_CLASSES[level],
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3.5 py-1.5 text-sm",
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
      className={clsx(
        "inline-block size-3.5 shrink-0 rounded-[3px] border",
        level === "rendah" ? "border-fg-muted bg-transparent" : "border-transparent",
        level === "sedang" && "bg-risk-sedang",
        level === "tinggi" && "bg-risk-tinggi",
        level === "sangat_tinggi" && "bg-risk-sangat-tinggi",
        className,
      )}
    />
  );
}
