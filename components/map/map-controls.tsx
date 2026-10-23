"use client";

import type L from "leaflet";
import { Locate, Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { INDONESIA_BBOX } from "@/lib/geo";
import { prefersReducedMotion } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import type { BBox } from "@/types";
import { bboxToBounds } from "./bounds";

function ControlButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className="rounded-none first:rounded-t-[11px] last:rounded-b-[11px]"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Zoom and "back to the whole country" buttons. Rendered outside the Leaflet container so they are
 * regular, keyboard-focusable buttons; the map itself also pans with arrow keys and
 * zooms with +/− once focused.
 */
export function MapControls({
  map,
  home = INDONESIA_BBOX,
  homeLabel = "Kembali ke seluruh Indonesia",
  padding = { padding: [8, 8] },
  className,
}: {
  map: L.Map | null;
  home?: BBox;
  homeLabel?: string;
  padding?: L.FitBoundsOptions;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Kontrol peta"
      className={cn("glass-panel flex flex-col divide-y overflow-hidden rounded-xl", className)}
    >
      <ControlButton label="Perbesar" disabled={!map} onClick={() => map?.zoomIn()}>
        <Plus />
      </ControlButton>
      <ControlButton label="Perkecil" disabled={!map} onClick={() => map?.zoomOut()}>
        <Minus />
      </ControlButton>
      <ControlButton
        label={homeLabel}
        disabled={!map}
        onClick={() => map?.flyToBounds(bboxToBounds(home), { ...padding, duration: 0.3, animate: !prefersReducedMotion() })}
      >
        <Locate />
      </ControlButton>
    </div>
  );
}
