import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { RiskBadge } from "@/components/ui/risk-badge";
import { getDataStatus } from "@/lib/data";
import { formatDate, formatDecimal } from "@/lib/format";
import { RISK_LEVEL_ORDER, RISK_THRESHOLDS } from "@/lib/risk";

export const metadata: Metadata = {
  title: "Tentang",
  description: "Tujuan, sumber data, metode, dan keterbatasan SiAPI, sistem pemantauan dan prediksi karhutla Riau.",
};

const SOURCES: { name: string; use: string; href: string }[] = [
  {
    name: "NASA FIRMS",
    use: "Titik panas (hotspot) dari satelit VIIRS S-NPP, VIIRS NOAA-20, dan MODIS, termasuk tingkat kepercayaan dan FRP.",
    href: "https://firms.modaps.eosdis.nasa.gov/",
  },
  {
    name: "Open-Meteo",
    use: "Cuaca harian dan prakiraan: suhu, kelembapan, curah hujan, angin, serta jumlah hari tanpa hujan.",
    href: "https://open-meteo.com/",
  },
  {
    name: "ESA WorldCover",
    use: "Tutupan lahan 10 m untuk membedakan hutan, perkebunan, semak, dan lahan terbuka.",
    href: "https://esa-worldcover.org/",
  },
  {
    name: "Peta lahan gambut",
    use: "Sebaran lahan gambut nasional (Kementerian Pertanian / KLHK) untuk menandai kotak grid bergambut.",
    href: "https://sigap.menlhk.go.id/",
  },
  {
    name: "Batas wilayah",
    use: "Batas kabupaten/kota dari GADM atau Badan Informasi Geospasial (BIG).",
    href: "https://gadm.org/",
  },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold text-fg">
        {title}
      </h2>
      {children}
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 text-[15px] leading-relaxed text-fg lg:px-6">
      <header>
        <h1 className="text-2xl font-semibold">Tentang SiAPI</h1>
        <p className="mt-2 text-fg-muted">
          SiAPI (Sistem Analisis &amp; Prediksi Karhutla) memantau titik panas dan memperkirakan risiko kebakaran hutan
          dan lahan di Provinsi Riau untuk tujuh hari ke depan.
        </p>
      </header>

      {status.sumber === "mock" ? (
        <Card className="border-accent/60 p-4">
          <p className="text-sm">
            <strong className="font-semibold">Data contoh.</strong> Selama pengembangan, semua angka di dashboard ini
            berasal dari data tiruan (mock) yang dibuat otomatis, termasuk batas wilayah yang masih berupa poligon
            perkiraan. Data terakhir: {formatDate(status.tanggal_data)}.
          </p>
        </Card>
      ) : null}

      <Section id="tujuan" title="Tujuan">
        <p>
          Kebakaran di lahan gambut sulit dipadamkan begitu membesar. SiAPI membantu petugas, pemerintah daerah, dan
          masyarakat melihat <em>di mana</em> api sedang terdeteksi dan <em>di mana</em> kondisi paling mendukung
          terjadinya kebakaran, sehingga patroli dan pencegahan bisa diarahkan lebih awal.
        </p>
      </Section>

      <Section id="sumber-data" title="Sumber data">
        <ul className="flex flex-col gap-3">
          {SOURCES.map((source) => (
            <li key={source.name}>
              <a
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline underline-offset-2"
              >
                {source.name}
              </a>
              <span className="text-fg-muted"> – {source.use}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-fg-muted">
          Data diolah sekali sehari oleh pipeline terpisah lalu disimpan di basis data spasial (PostgreSQL/PostGIS).
        </p>
      </Section>

      <Section id="metode" title="Metode singkat">
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>
            <strong className="font-semibold">Grid 5 km.</strong> Provinsi Riau dibagi menjadi kotak berukuran sekitar
            5×5 km. Setiap kotak punya atribut cuaca, tutupan lahan, status gambut, dan riwayat hotspot.
          </li>
          <li>
            <strong className="font-semibold">Model klasifikasi.</strong> Model pembelajaran mesin dilatih dengan data
            historis untuk memperkirakan peluang munculnya hotspot di setiap kotak untuk hari +1 sampai +7. Hasilnya
            adalah skor risiko 0–1.
          </li>
          <li>
            <strong className="font-semibold">SHAP.</strong> Untuk setiap kotak, nilai SHAP menunjukkan faktor mana yang
            paling menaikkan atau menurunkan skor, misalnya jumlah hari tanpa hujan atau keberadaan lahan gambut. Tiga
            faktor teratas ditampilkan di bagian “Kenapa risikonya tinggi?”.
          </li>
          <li>
            <strong className="font-semibold">DBSCAN.</strong> Hotspot yang berdekatan pada hari yang sama dikelompokkan
            menjadi zona kebakaran. Statusnya (baru, meluas, stabil, menyusut) dibandingkan dengan hari sebelumnya.
          </li>
        </ol>
      </Section>

      <Section id="level-risiko" title="Cara membaca tingkat risiko">
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Ambang skor untuk setiap tingkat risiko</caption>
            <thead className="bg-surface-2 text-xs text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Tingkat
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Skor
                </th>
              </tr>
            </thead>
            <tbody>
              {RISK_LEVEL_ORDER.map((level) => (
                <tr key={level} className="border-t border-line">
                  <td className="px-4 py-2">
                    <RiskBadge level={level} size="sm" />
                  </td>
                  <td className="px-4 py-2 font-mono">{ranges[level]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-fg-muted">
          Di peta, kotak berisiko rendah dibiarkan transparan agar peta dasar tetap terbaca.
        </p>
      </Section>

      <Section id="keterbatasan" title="Keterbatasan">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong className="font-semibold">Hotspot bukan kebakaran terkonfirmasi.</strong> Satelit mendeteksi titik
            yang lebih panas dari sekitarnya; bisa berupa pembakaran terkendali, suar industri, atau pantulan. Hotspot
            perlu dicek di lapangan.
          </li>
          <li>
            <strong className="font-semibold">Prediksi tidak pasti.</strong> Skor risiko adalah perkiraan model, bukan
            kepastian. Ketidakpastian makin besar untuk hari yang lebih jauh dan saat prakiraan cuaca meleset.
          </li>
          <li>
            <strong className="font-semibold">Keterbatasan satelit.</strong> Awan tebal dan asap dapat menutupi api,
            sehingga sebagian kebakaran tidak terdeteksi.
          </li>
          <li>
            <strong className="font-semibold">Data mock selama pengembangan.</strong> Sampai pipeline data tersambung,
            seluruh angka dan batas wilayah adalah data contoh dan tidak boleh dipakai untuk keputusan.
          </li>
        </ul>
      </Section>
    </main>
  );
}
