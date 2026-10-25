"use client";

import { CloudRain, Droplets, Info, Sprout, Sun, Thermometer, Wind } from "lucide-react";
import { motion } from "motion/react";
import { CountUp } from "@/components/ui/count-up";
import { RiskBadge } from "@/components/ui/risk-badge";
import { formatDate, formatDayShort, formatDecimal, formatInteger, formatSigned } from "@/lib/format";
import { FACTOR_LABELS, regionHref } from "@/lib/labels";
import { getRiskLabel, RISK_THRESHOLDS } from "@/lib/risk";
import { cn } from "@/lib/utils";
import type { RiskCellFeature, RiskFactor, RiskLevel, WeatherSnapshot } from "@/types";
import { InfoGrid, RegionLink, SectionTitle, type InfoTile } from "./detail-panel";

const FILL_CLASSES: Record<RiskLevel, string> = {
  rendah: "bg-muted-foreground/60",
  sedang: "bg-risk-sedang",
  tinggi: "bg-risk-tinggi",
  sangat_tinggi: "bg-risk-sangat-tinggi",
};

const BANDS: { level: RiskLevel; from: number; to: number }[] = [
  { level: "rendah", from: 0, to: RISK_THRESHOLDS.sedang },
  { level: "sedang", from: RISK_THRESHOLDS.sedang, to: RISK_THRESHOLDS.tinggi },
  { level: "tinggi", from: RISK_THRESHOLDS.tinggi, to: RISK_THRESHOLDS.sangat_tinggi },
  { level: "sangat_tinggi", from: RISK_THRESHOLDS.sangat_tinggi, to: 1 },
];

/** 0–1 gauge: faint bands for the four levels and a bar that grows to the score. */
export function ScoreGauge({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <div>
      <div
        role="meter"
        aria-label="Skor risiko"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={score}
        aria-valuetext={`${formatDecimal(score)} dari 1, ${getRiskLabel(level)}`}
        className="relative h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div aria-hidden="true" className="absolute inset-0 flex">
          {BANDS.map((band) => (
            <span
              key={band.level}
              className={cn("h-full border-r border-background/80 last:border-r-0", band.level !== "rendah" && FILL_CLASSES[band.level], "opacity-20")}
              style={{ width: `${(band.to - band.from) * 100}%` }}
            />
          ))}
        </div>
        <motion.div
          aria-hidden="true"
          className={cn("absolute inset-y-0 left-0 rounded-full", FILL_CLASSES[level])}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(2, score * 100)}%` }}
          transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
        />
      </div>
      <div aria-hidden="true" className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <span key={tick}>{tick === 0 || tick === 1 ? tick : formatDecimal(tick)}</span>
        ))}
      </div>
    </div>
  );
}

/** Diverging bars of SHAP contributions (right = raises risk), revealed one after another. */
export function FactorBars({ factors }: { factors: RiskFactor[] }) {
  const maxAbs = Math.max(0.5, ...factors.map((f) => Math.abs(f.kontribusi)));
  return (
    <ol className="flex flex-col gap-4">
      {factors.map((factor, index) => {
        const positive = factor.kontribusi >= 0;
        const width = (Math.abs(factor.kontribusi) / maxAbs) * 50;
        return (
          <motion.li
            key={factor.fitur}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.08 + index * 0.08 }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">{factor.label}</p>
              <p className={cn("shrink-0 font-mono text-xs tabular-nums", positive ? "text-ember-ink" : "text-muted-foreground")}>
                {formatSigned(factor.kontribusi)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {FACTOR_LABELS[factor.fitur] ?? factor.fitur} · {positive ? "menaikkan risiko" : "menurunkan risiko"}
            </p>
            <div aria-hidden="true" className="relative mt-2 h-1.5 rounded-full bg-muted">
              <span className="absolute -inset-y-1 left-1/2 w-px bg-border" />
              <motion.span
                className={cn("absolute inset-y-0 rounded-full", positive ? "left-1/2 bg-ember" : "right-1/2 bg-foreground/60")}
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.3, delay: 0.12 + index * 0.08, ease: [0.2, 0, 0, 1] }}
              />
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

export function PredictionNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-xl border border-dashed px-3 py-2.5 text-xs text-muted-foreground", className)}>
      <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      Prediksi model, bukan kepastian.
    </p>
  );
}

export function CellDetail({
  feature,
  regionName,
  weather,
}: {
  feature: RiskCellFeature;
  regionName: string;
  weather?: WeatherSnapshot;
}) {
  const p = feature.properties;
  const level = p.level_risiko;

  const tiles: InfoTile[] = [
    {
      icon: Sprout,
      label: "Jenis lahan",
      value:
        p.is_gambut === null ? (
          // Wraps instead of being truncated: the whole sentence matters here.
          <span className="block whitespace-normal">Data gambut belum tersedia</span>
        ) : p.is_gambut ? (
          "Gambut"
        ) : (
          "Tanah mineral"
        ),
    },
  ];
  if (weather) {
    tiles.push(
      { icon: Sun, label: "Hari tanpa hujan", value: `${formatInteger(weather.hari_tanpa_hujan)} hari`, mono: true },
      { icon: Droplets, label: "Kelembapan", value: `${formatInteger(weather.kelembapan_persen)}%`, mono: true },
      { icon: Thermometer, label: "Suhu", value: `${formatDecimal(weather.suhu_c, 1)} °C`, mono: true },
      { icon: CloudRain, label: "Curah hujan", value: `${formatDecimal(weather.curah_hujan_mm, 1)} mm`, mono: true },
      { icon: Wind, label: "Angin", value: `${formatDecimal(weather.kecepatan_angin_kmh, 1)} km/j`, mono: true },
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <section aria-label="Skor risiko">
        <p className="text-xs text-muted-foreground">Skor risiko untuk {formatDayShort(p.tanggal_target)}</p>
        <div className="mt-1 mb-4 flex items-center gap-3">
          <CountUp
            value={p.skor_risiko}
            format={(v) => formatDecimal(v)}
            className="font-mono text-5xl font-semibold tracking-tighter tabular-nums"
          />
          <RiskBadge level={level} size="lg" />
        </div>
        <ScoreGauge score={p.skor_risiko} level={level} />
      </section>

      <section aria-labelledby="faktor-risiko">
        <SectionTitle id="faktor-risiko">Kenapa risikonya {getRiskLabel(level).toLowerCase()}?</SectionTitle>
        <FactorBars key={`${p.cell_id}-${p.tanggal_target}`} factors={p.faktor} />
      </section>

      <section aria-labelledby="info-lahan">
        <SectionTitle id="info-lahan">Cuaca terkini &amp; lahan</SectionTitle>
        <InfoGrid items={tiles} />
        <p className="mt-2 text-xs text-muted-foreground">
          {weather ? `Cuaca terkini ${regionName}, ${formatDayShort(weather.tanggal)}. ` : ""}
          Diprediksi pada {formatDate(p.tanggal_prediksi)}.
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <RegionLink href={regionHref({ slug: p.kabupaten, provinsi: p.provinsi })} name={regionName} />
        <PredictionNote />
      </div>
    </div>
  );
}
