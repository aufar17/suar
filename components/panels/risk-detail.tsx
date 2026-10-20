"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import { RiskBadge } from "@/components/ui/risk-badge";
import { InfoIcon } from "@/components/ui/icons";
import { formatDate, formatDayShort, formatDecimal, formatInteger, formatSigned } from "@/lib/format";
import { FACTOR_LABELS } from "@/lib/labels";
import { getRiskLabel, RISK_THRESHOLDS } from "@/lib/risk";
import type { RiskCellFeature, RiskFactor, WeatherSnapshot } from "@/types";
import { DetailHeader, DetailRows, RegionLink } from "./detail-panel";

/** 0–1 track split into the four risk bands, with a marker at the score. */
export function ScoreBar({ score }: { score: number }) {
  const bands = [
    { from: 0, to: RISK_THRESHOLDS.sedang, className: "bg-surface-2" },
    { from: RISK_THRESHOLDS.sedang, to: RISK_THRESHOLDS.tinggi, className: "bg-risk-sedang" },
    { from: RISK_THRESHOLDS.tinggi, to: RISK_THRESHOLDS.sangat_tinggi, className: "bg-risk-tinggi" },
    { from: RISK_THRESHOLDS.sangat_tinggi, to: 1, className: "bg-risk-sangat-tinggi" },
  ];
  return (
    <div>
      <div
        role="meter"
        aria-label="Skor risiko"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={score}
        aria-valuetext={`${formatDecimal(score)} dari 1`}
        className="relative h-2.5 overflow-visible"
      >
        <div className="flex h-full overflow-hidden rounded-full ring-1 ring-line ring-inset">
          {bands.map((band) => (
            <div key={band.from} className={clsx("h-full", band.className)} style={{ width: `${(band.to - band.from) * 100}%` }} />
          ))}
        </div>
        <div
          aria-hidden="true"
          className="absolute -top-1 h-[18px] w-1 -translate-x-1/2 rounded-full bg-fg ring-2 ring-surface"
          style={{ left: `${Math.min(99, Math.max(1, score * 100))}%` }}
        />
      </div>
      <div aria-hidden="true" className="mt-1 flex justify-between font-mono text-[11px] text-fg-muted">
        <span>0</span>
        <span>{formatDecimal(0.25)}</span>
        <span>{formatDecimal(0.5)}</span>
        <span>{formatDecimal(0.75)}</span>
        <span>1</span>
      </div>
    </div>
  );
}

/** Diverging bars: SHAP contribution, right = raises risk, left = lowers risk. */
export function FactorBars({ factors }: { factors: RiskFactor[] }) {
  const maxAbs = Math.max(0.5, ...factors.map((f) => Math.abs(f.kontribusi)));
  return (
    <ol className="flex flex-col gap-3">
      {factors.map((factor) => {
        const positive = factor.kontribusi >= 0;
        const width = (Math.abs(factor.kontribusi) / maxAbs) * 50;
        return (
          <li key={factor.fitur}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-fg">{factor.label}</p>
              <p className={clsx("shrink-0 font-mono text-xs", positive ? "text-accent" : "text-fg-muted")}>
                {formatSigned(factor.kontribusi)}
              </p>
            </div>
            <p className="text-xs text-fg-muted">
              {FACTOR_LABELS[factor.fitur] ?? factor.fitur} · {positive ? "menaikkan risiko" : "menurunkan risiko"}
            </p>
            <div aria-hidden="true" className="relative mt-1.5 h-2 rounded-full bg-surface-2">
              <div className="absolute inset-y-[-3px] left-1/2 w-px bg-line" />
              <div
                className={clsx("absolute inset-y-0 rounded-full", positive ? "left-1/2 bg-accent" : "right-1/2 bg-primary")}
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PredictionNote() {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-fg-muted">
      <InfoIcon className="mt-px size-4 shrink-0" />
      Prediksi model, bukan kepastian.
    </p>
  );
}

export function CellDetail({
  feature,
  regionName,
  weather,
  onClose,
}: {
  feature: RiskCellFeature;
  regionName: string;
  weather?: WeatherSnapshot;
  onClose: () => void;
}) {
  const p = feature.properties;
  const levelLabel = getRiskLabel(p.level_risiko).toLowerCase();
  return (
    <div className="flex flex-col gap-4">
      <DetailHeader eyebrow={`Kotak grid ${p.cell_id} · 5×5 km`} title={regionName} onClose={onClose} />

      <div>
        <p className="text-xs text-fg-muted">Skor risiko untuk {formatDayShort(p.tanggal_target)}</p>
        <div className="mt-1 flex items-center gap-3">
          <span className="font-mono text-4xl font-semibold tracking-tight text-fg">{formatDecimal(p.skor_risiko)}</span>
          <RiskBadge level={p.level_risiko} size="lg" />
        </div>
        <div className="mt-3">
          <ScoreBar score={p.skor_risiko} />
        </div>
      </div>

      <section aria-labelledby="faktor-risiko">
        <h3 id="faktor-risiko" className="mb-2 text-sm font-semibold text-fg">
          Kenapa risikonya {levelLabel}?
        </h3>
        <FactorBars factors={p.faktor} />
      </section>

      <section aria-labelledby="info-lahan">
        <h3 id="info-lahan" className="text-sm font-semibold text-fg">
          Cuaca terkini &amp; lahan
        </h3>
        <DetailRows
          rows={[
            ["Jenis lahan", p.is_gambut ? "Gambut" : "Tanah mineral"],
            ...(weather
              ? ([
                  ["Hari tanpa hujan", <span key="d" className="font-mono">{formatInteger(weather.hari_tanpa_hujan)} hari</span>],
                  ["Kelembapan", <span key="h" className="font-mono">{formatInteger(weather.kelembapan_persen)}%</span>],
                  ["Suhu", <span key="t" className="font-mono">{formatDecimal(weather.suhu_c, 1)} °C</span>],
                  ["Curah hujan", <span key="r" className="font-mono">{formatDecimal(weather.curah_hujan_mm, 1)} mm</span>],
                ] as [string, ReactNode][])
              : []),
            ["Diprediksi pada", formatDate(p.tanggal_prediksi)],
          ]}
        />
        {weather ? (
          <p className="mt-1 text-xs text-fg-muted">Cuaca terkini {regionName}, {formatDayShort(weather.tanggal)}.</p>
        ) : null}
      </section>

      <RegionLink slug={p.kabupaten} name={regionName} />
      <PredictionNote />
    </div>
  );
}
