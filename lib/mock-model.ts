import type { RiskFactor } from "@/types";

// The toy risk model behind the mock data. scripts/generate-mock.ts uses it to score every grid
// cell, and lib/data/mock.ts uses it again to explain a cell (top factors), so the stored mock
// only needs the scores and the inputs. Not used with DATA_SOURCE=supabase.

export const RISK_INTERCEPT = -2.2;

export interface RiskInputs {
  /** Forecast days without rain on the target date. */
  dry: number;
  /** Forecast relative humidity (%). */
  humidity: number;
  gambut: boolean;
  /** Hotspots within 10 km during the 7 days before the prediction. */
  hotspots: number;
  ndvi: number;
  /** 0 for +1 day, 6 for +7 days; older hotspots matter less further ahead. */
  dayOffset: number;
}

const decimal = (v: number, digits = 2) => v.toFixed(digits).replace(".", ",");
const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Contribution of every feature in the order hari_tanpa_hujan, kelembapan, lahan_gambut, hotspot_sekitar, ndvi (positive = raises risk). */
export function contributionValues(x: RiskInputs): number[] {
  const hsWeight = 1 - 0.06 * x.dayOffset;
  return [
    0.09 * (x.dry - 10),
    -0.05 * (x.humidity - 65),
    x.gambut ? 1.1 : -0.35,
    (x.hotspots > 0 ? 0.55 * Math.log(1 + x.hotspots) - 0.2 : -0.3) * hsWeight,
    -2.5 * (x.ndvi - 0.5),
  ];
}

/** SHAP-like contribution of every feature with its explanation, in the same order. */
export function riskContributions(x: RiskInputs): RiskFactor[] {
  const [dry, humidity, peat, hotspots, ndvi] = contributionValues(x);
  return [
    {
      fitur: "hari_tanpa_hujan",
      kontribusi: dry,
      label: x.dry === 0 ? "Hujan turun sehari sebelumnya" : `${x.dry} hari tanpa hujan`,
    },
    {
      fitur: "kelembapan",
      kontribusi: humidity,
      label: x.humidity < 65 ? `Kelembapan rendah (${x.humidity}%)` : `Kelembapan tinggi (${x.humidity}%)`,
    },
    {
      fitur: "lahan_gambut",
      kontribusi: peat,
      label: x.gambut ? "Lahan gambut" : "Tanah mineral, bukan gambut",
    },
    {
      fitur: "hotspot_sekitar",
      kontribusi: hotspots,
      label:
        x.hotspots > 0
          ? `${x.hotspots} hotspot dalam radius 10 km (7 hari terakhir)`
          : "Tidak ada hotspot dalam radius 10 km",
    },
    {
      fitur: "ndvi",
      kontribusi: ndvi,
      label: x.ndvi < 0.5 ? `Vegetasi kering (NDVI ${decimal(x.ndvi)})` : `Vegetasi rapat (NDVI ${decimal(x.ndvi)})`,
    },
  ];
}

/** The three contributions with the largest absolute value. */
export function topRiskFactors(x: RiskInputs): RiskFactor[] {
  return riskContributions(x)
    .sort((a, b) => Math.abs(b.kontribusi) - Math.abs(a.kontribusi))
    .slice(0, 3)
    .map((f) => ({ ...f, kontribusi: round3(f.kontribusi) }));
}
