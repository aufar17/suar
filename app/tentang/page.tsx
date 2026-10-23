import {
  ArrowUpRight,
  BrainCircuit,
  CloudSun,
  Cloudy,
  Flame,
  FlaskConical,
  Grid3x3,
  Layers,
  Map as MapIcon,
  Satellite,
  ScanSearch,
  Sprout,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RiskBadge, RiskSwatch } from "@/components/ui/risk-badge";
import { TableOfContents } from "@/components/ui/table-of-contents";
import { getDataStatus } from "@/lib/data";
import { formatDate, formatDecimal } from "@/lib/format";
import { RISK_LEVEL_ORDER, RISK_THRESHOLDS } from "@/lib/risk";

export const metadata: Metadata = {
  title: "Tentang",
  description: "Tujuan, sumber data, metode, dan keterbatasan SiAPI, sistem pemantauan dan prediksi karhutla Riau.",
};

const SECTIONS = [
  { id: "tujuan", label: "Tujuan" },
  { id: "metode", label: "Cara kerja" },
  { id: "sumber-data", label: "Sumber data" },
  { id: "level-risiko", label: "Membaca tingkat risiko" },
  { id: "keterbatasan", label: "Keterbatasan" },
];

const SOURCES: { name: string; use: string; href: string; icon: LucideIcon }[] = [
  {
    name: "NASA FIRMS",
    use: "Titik panas (hotspot) dari satelit VIIRS S-NPP, VIIRS NOAA-20, dan MODIS, termasuk tingkat kepercayaan dan FRP.",
    href: "https://firms.modaps.eosdis.nasa.gov/",
    icon: Satellite,
  },
  {
    name: "Open-Meteo",
    use: "Cuaca harian dan prakiraan: suhu, kelembapan, curah hujan, angin, serta jumlah hari tanpa hujan.",
    href: "https://open-meteo.com/",
    icon: CloudSun,
  },
  {
    name: "ESA WorldCover",
    use: "Tutupan lahan 10 m untuk membedakan hutan, perkebunan, semak, dan lahan terbuka.",
    href: "https://esa-worldcover.org/",
    icon: Layers,
  },
  {
    name: "Peta lahan gambut",
    use: "Sebaran lahan gambut nasional (Kementerian Pertanian / KLHK) untuk menandai kotak grid bergambut.",
    href: "https://sigap.menlhk.go.id/",
    icon: Sprout,
  },
  {
    name: "geoBoundaries",
    use: "Batas provinsi (ADM1, bersumber OpenStreetMap, lisensi ODbL) dan kabupaten/kota (ADM2, bersumber BPS dan OCHA, lisensi CC BY 3.0 IGO) dari rilis gbOpen, disederhanakan untuk peta web.",
    href: "https://www.geoboundaries.org/",
    icon: MapIcon,
  },
];

const STEPS: { title: string; body: ReactNode; icon: LucideIcon }[] = [
  {
    title: "Grid 5 km",
    icon: Grid3x3,
    body: "Provinsi Riau dibagi menjadi kotak berukuran sekitar 5×5 km. Setiap kotak punya atribut cuaca, tutupan lahan, status gambut, dan riwayat hotspot.",
  },
  {
    title: "Model klasifikasi",
    icon: BrainCircuit,
    body: "Model pembelajaran mesin dilatih dengan data historis untuk memperkirakan peluang munculnya hotspot di setiap kotak untuk hari +1 sampai +7. Hasilnya adalah skor risiko 0–1.",
  },
  {
    title: "SHAP",
    icon: FlaskConical,
    body: (
      <>
        Untuk setiap kotak, nilai SHAP menunjukkan faktor mana yang paling menaikkan atau menurunkan skor, misalnya jumlah
        hari tanpa hujan atau keberadaan lahan gambut. Tiga faktor teratas ditampilkan di bagian “Kenapa risikonya
        tinggi?”.
      </>
    ),
  },
  {
    title: "DBSCAN",
    icon: ScanSearch,
    body: "Hotspot yang berdekatan pada hari yang sama dikelompokkan menjadi zona kebakaran. Statusnya (baru, meluas, stabil, menyusut) dibandingkan dengan hari sebelumnya.",
  },
];

const LIMITATIONS: { title: string; body: string; icon: LucideIcon }[] = [
  {
    title: "Hotspot bukan kebakaran terkonfirmasi.",
    icon: Flame,
    body: "Satelit mendeteksi titik yang lebih panas dari sekitarnya; bisa berupa pembakaran terkendali, suar industri, atau pantulan. Hotspot perlu dicek di lapangan.",
  },
  {
    title: "Prediksi tidak pasti.",
    icon: TriangleAlert,
    body: "Skor risiko adalah perkiraan model, bukan kepastian. Ketidakpastian makin besar untuk hari yang lebih jauh dan saat prakiraan cuaca meleset.",
  },
  {
    title: "Keterbatasan satelit.",
    icon: Cloudy,
    body: "Awan tebal dan asap dapat menutupi api, sehingga sebagian kebakaran tidak terdeteksi.",
  },
  {
    title: "Data mock selama pengembangan.",
    icon: FlaskConical,
    body: "Sampai pipeline data tersambung, seluruh angka (hotspot, prediksi, cuaca) adalah data contoh dan tidak boleh dipakai untuk keputusan. Batas wilayah sudah memakai data geoBoundaries, tetapi belum mengikuti pemekaran provinsi di Papua tahun 2022.",
  },
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-judul`} className="scroll-mt-24 border-t pt-10">
      <p className="font-mono text-xs text-muted-foreground">{eyebrow}</p>
      <h2 id={`${id}-judul`} className="mt-1 text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-5 flex flex-col gap-4 text-[15px] leading-7">{children}</div>
    </section>
  );
}

export default async function TentangPage() {
  const status = await getDataStatus();
  const ranges: Record<string, string> = {
    rendah: `< ${formatDecimal(RISK_THRESHOLDS.sedang)}`,
    sedang: `${formatDecimal(RISK_THRESHOLDS.sedang)} – < ${formatDecimal(RISK_THRESHOLDS.tinggi)}`,
    tinggi: `${formatDecimal(RISK_THRESHOLDS.tinggi)} – < ${formatDecimal(RISK_THRESHOLDS.sangat_tinggi)}`,
    sangat_tinggi: `≥ ${formatDecimal(RISK_THRESHOLDS.sangat_tinggi)}`,
  };
  const meanings: Record<string, string> = {
    rendah: "Kondisi kurang mendukung kebakaran. Transparan di peta.",
    sedang: "Perlu dipantau, terutama di lahan gambut.",
    tinggi: "Kondisi mendukung kebakaran; prioritas patroli.",
    sangat_tinggi: "Sangat rawan; pertimbangkan tindakan pencegahan segera.",
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14 lg:px-8">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-ember-ink">Tentang SiAPI</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Melihat api lebih awal, sebelum membesar.
        </h1>
        <p className="mt-5 text-lg leading-8 text-pretty text-muted-foreground">
          SiAPI (Sistem Analisis &amp; Prediksi Karhutla) memantau titik panas dan memperkirakan risiko kebakaran hutan dan
          lahan di Provinsi Riau untuk tujuh hari ke depan.
        </p>
        {status.sumber === "mock" ? (
          <div className="mt-6 flex gap-3 rounded-2xl border border-ember/40 bg-ember-soft p-4 text-sm leading-6">
            <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ember-ink" />
            <p>
              <strong className="font-semibold">Data contoh.</strong> Selama pengembangan, semua angka di dashboard ini
              berasal dari data tiruan (mock) yang dibuat otomatis di atas batas wilayah asli dari geoBoundaries. Data
              terakhir: {formatDate(status.tanggal_data)}.
            </p>
          </div>
        ) : null}
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-16">
        <div className="flex max-w-3xl min-w-0 flex-col gap-12">
          <Section id="tujuan" eyebrow="01" title="Tujuan">
            <p>
              Kebakaran di lahan gambut sulit dipadamkan begitu membesar. SiAPI membantu petugas, pemerintah daerah, dan
              masyarakat melihat <em>di mana</em> api sedang terdeteksi dan <em>di mana</em> kondisi paling mendukung
              terjadinya kebakaran, sehingga patroli dan pencegahan bisa diarahkan lebih awal.
            </p>
          </Section>

          <Section id="metode" eyebrow="02" title="Cara kerja">
            <ol className="grid gap-3 sm:grid-cols-2">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-muted">
                      <step.icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">Langkah {index + 1}</span>
                  </div>
                  <h3 className="font-semibold tracking-tight">{step.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="sumber-data" eyebrow="03" title="Sumber data">
            <ul className="flex flex-col divide-y rounded-2xl border bg-card">
              {SOURCES.map((source) => (
                <li key={source.name}>
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex gap-4 p-4 transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/60 sm:p-5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <source.icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        {source.name}
                        <ArrowUpRight
                          aria-hidden="true"
                          className="size-3.5 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                        <span className="sr-only">(membuka tab baru)</span>
                      </span>
                      <span className="mt-0.5 block text-sm leading-6 text-muted-foreground">{source.use}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Data diolah sekali sehari oleh pipeline terpisah lalu disimpan di basis data spasial (PostgreSQL/PostGIS).
            </p>
          </Section>

          <Section id="level-risiko" eyebrow="04" title="Cara membaca tingkat risiko">
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Ambang skor dan arti setiap tingkat risiko</caption>
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Tingkat
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Skor
                    </th>
                    <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
                      Arti
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {RISK_LEVEL_ORDER.map((level) => (
                    <tr key={level} className="border-t">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <RiskSwatch level={level} />
                          <RiskBadge level={level} size="sm" />
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">{ranges[level]}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{meanings[level]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">
              Di peta, kotak berisiko rendah dibiarkan transparan agar peta dasar tetap terbaca. Warna selalu disertai label
              teks.
            </p>
          </Section>

          <Section id="keterbatasan" eyebrow="05" title="Keterbatasan">
            <ul className="flex flex-col gap-3">
              {LIMITATIONS.map((item) => (
                <li key={item.title} className="flex gap-4 rounded-2xl border bg-card p-4 sm:p-5">
                  <item.icon aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm leading-6">
                    <strong className="font-semibold">{item.title}</strong>{" "}
                    <span className="text-muted-foreground">{item.body}</span>
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-h)+2rem)]">
            <TableOfContents items={SECTIONS} />
          </div>
        </aside>
      </div>
    </main>
  );
}
