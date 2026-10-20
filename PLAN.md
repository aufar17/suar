# Rencana Pengerjaan Frontend SiAPI

Dokumen ini adalah rencana eksekusi untuk Claude Code. Baca `CLAUDE.md` dulu untuk konteks dan aturan proyek.

Cara kerja:

- Kerjakan **satu fase per sesi**, berurutan.
- Di akhir setiap fase: jalankan `pnpm lint`, `pnpm typecheck`, `pnpm build`, pastikan semua kriteria selesai terpenuhi, lalu buat commit dengan pesan `fase-N: <ringkasan>`.
- Kalau ada keputusan yang tidak tercakup di dokumen ini, pilih opsi paling sederhana, lalu catat di bagian **Catatan Keputusan** di akhir file ini.

---

## Fase 0 – Setup Proyek

**Tugas**

- Inisialisasi Next.js (App Router, TypeScript, Tailwind, ESLint, folder `app/`, alias `@/*`) dengan pnpm.
- Pasang dependensi: `leaflet`, `react-leaflet` (versi sesuai React, lihat `CLAUDE.md`), `@types/leaflet`, `recharts`, `zod`, `date-fns`, `server-only`, `clsx`. Dev: `tsx`, `@faker-js/faker`.
- Tambahkan script `typecheck` dan `mock:generate` di `package.json`.
- Buat struktur folder sesuai `CLAUDE.md`.
- Siapkan design token warna di Tailwind/CSS variables untuk light dan dark mode.
- Buat `.env.example` berisi `DATA_SOURCE=mock`, `SUPABASE_URL=`, `SUPABASE_ANON_KEY=`.

**Kriteria selesai**

- `pnpm dev` menampilkan halaman kosong tanpa error.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` lolos.

---

## Fase 1 – Tipe Data, Data Mock, dan Lapisan Data

### 1a. Tipe data (`types/`)

Buat tipe TypeScript sekaligus skema zod-nya.

```ts
type Confidence = "low" | "nominal" | "high";

// Feature<Point>
interface HotspotProps {
  id: string;
  waktu_deteksi: string; // ISO datetime
  satelit: "VIIRS_SNPP" | "VIIRS_NOAA20" | "MODIS";
  confidence: Confidence;
  frp: number; // Fire Radiative Power, MW
  kabupaten: string; // slug
}

// Feature<Polygon>
interface ClusterProps {
  id: string;
  tanggal: string; // YYYY-MM-DD
  jumlah_hotspot: number;
  luas_km2: number;
  status: "baru" | "meluas" | "stabil" | "menyusut";
  aktif_sejak: string; // YYYY-MM-DD
  kabupaten: string;
}

type RiskLevel = "rendah" | "sedang" | "tinggi" | "sangat_tinggi";

interface RiskFactor {
  fitur: string; // contoh: "hari_tanpa_hujan"
  label: string; // contoh: "18 hari tanpa hujan"
  kontribusi: number; // nilai SHAP, positif = menaikkan risiko
}

// Feature<Polygon>, satu kotak grid 5x5 km
interface RiskCellProps {
  cell_id: string;
  tanggal_prediksi: string;
  tanggal_target: string;
  skor_risiko: number; // 0–1
  level_risiko: RiskLevel;
  is_gambut: boolean;
  faktor: RiskFactor[]; // 3 faktor teratas
  kabupaten: string;
}

interface Region {
  id: string;
  slug: string;
  nama: string;
  level: "provinsi" | "kabupaten" | "kota";
}

interface WeatherSnapshot {
  tanggal: string;
  suhu_c: number;
  kelembapan_persen: number;
  curah_hujan_mm: number;
  kecepatan_angin_kmh: number;
  hari_tanpa_hujan: number;
}

interface MonthlyTrend {
  bulan: string;
  jumlah_hotspot: number;
} // bulan: YYYY-MM
interface RegionStat {
  slug: string;
  nama: string;
  jumlah_hotspot: number;
  rata_skor_risiko: number;
}
interface DataStatus {
  terakhir_diperbarui: string;
  sumber: "mock" | "supabase";
}
```

Ambang level risiko di `lib/risk.ts`: rendah < 0,25 ≤ sedang < 0,5 ≤ tinggi < 0,75 ≤ sangat_tinggi. Sediakan fungsi `getRiskLevel(score)`, `getRiskColor(level)`, dan `getRiskLabel(level)`.

### 1b. Data mock (`scripts/generate-mock.ts` → `mock/`)

Gunakan seed tetap supaya hasilnya konsisten.

- **Wilayah**: 12 kabupaten/kota Riau: Bengkalis, Dumai, Indragiri Hilir, Indragiri Hulu, Kampar, Kepulauan Meranti, Kuantan Singingi, Pekanbaru, Pelalawan, Rokan Hilir, Rokan Hulu, Siak. Karena batas resmi belum ada, buat **poligon placeholder sederhana** di dalam bounding box Riau (kira-kira lon 100,0–103,8, lat −1,1–2,9). Nanti akan diganti GeoJSON asli dari GADM/BIG.
- **Grid**: kotak sekitar 0,045° (≈5 km) yang menutupi bounding box, masing-masing diberi kabupaten terdekat dan flag `is_gambut` (sekitar 40% kotak, berkelompok, lebih banyak di wilayah timur/pesisir).
- **Hotspot**: data 24 bulan terakhir. Jumlah per hari mengikuti pola musim: tinggi di Juli–Oktober, rendah di musim hujan. Titik berkelompok di sekitar area gambut. Hotspot hari terbaru minimal ±150 titik.
- **Cluster**: 5–15 cluster untuk hari terbaru, poligon convex hull dari hotspot yang berdekatan, dengan status bervariasi.
- **Prediksi risiko**: 7 hari ke depan untuk setiap kotak grid. Skor lebih tinggi di area gambut dan dekat hotspot terbaru, dengan 3 faktor teratas yang masuk akal (hari tanpa hujan, kelembapan rendah, lahan gambut, hotspot di sekitar, NDVI rendah).
- **Cuaca**: snapshot terbaru per kabupaten.
- **Status data**: tanggal terakhir diperbarui.

Pastikan total ukuran file mock tetap wajar (di bawah ±15 MB). Kalau terlalu besar, kurangi resolusi grid atau bulatkan koordinat ke 4 desimal.

### 1c. Lapisan data (`lib/data/`)

- `types.ts`: interface `DataSource` dengan fungsi:
  - `getHotspots({ start, end, minConfidence, bbox? })`
  - `getClusters({ date })`
  - `getRiskCells({ targetDate, bbox? })`
  - `getRegions()` dan `getRegionBoundaries()`
  - `getRegionDetail(slug)`
  - `getWeather(slug)`
  - `getMonthlyTrend({ start, end, slug? })`
  - `getRegionStats({ date })`
  - `getDataStatus()`
- `mock.ts`: implementasi yang membaca file di `mock/` dan memfilter di memori.
- `supabase.ts`: stub yang melempar error `Not implemented` (diisi di Fase 10).
- `index.ts`: memilih implementasi berdasarkan env `DATA_SOURCE` (default `mock`). Semua file di folder ini memakai `import "server-only"`.

### 1d. Route handler (`app/api/`)

| Route                    | Query params                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `GET /api/hotspots`      | `start`, `end`, `min_confidence`, `bbox` (opsional, format `minLon,minLat,maxLon,maxLat`) |
| `GET /api/clusters`      | `date`                                                                                    |
| `GET /api/risk`          | `target_date`, `bbox` (opsional)                                                          |
| `GET /api/regions`       | – (mengembalikan GeoJSON batas wilayah)                                                   |
| `GET /api/stats/trend`   | `start`, `end`, `slug` (opsional)                                                         |
| `GET /api/stats/regions` | `date`                                                                                    |
| `GET /api/status`        | –                                                                                         |

Validasi query params pakai zod. Kalau tidak valid, kembalikan HTTP 400 dengan pesan error yang jelas. Rentang tanggal hotspot maksimal 31 hari per request.

**Kriteria selesai**

- `pnpm mock:generate` menghasilkan file mock.
- Setiap endpoint mengembalikan data valid saat diakses lewat browser.
- Parameter yang salah menghasilkan 400.

---

## Fase 2 – Layout dan Peta Dasar

**Tugas**

- Layout global: header berisi nama aplikasi, navigasi (Peta, Statistik, Tentang), indikator "Data terakhir diperbarui: ..." dari `/api/status`, dan toggle tema.
- Halaman `/`: peta Leaflet layar penuh (di bawah header), berpusat di Riau, tile OpenStreetMap dengan atribusi.
- Komponen `MapView` di-load dengan `dynamic` + `ssr: false`, dengan skeleton saat loading.
- Tata letak desktop: panel samping kiri (filter dan layer) dan panel detail kanan yang bisa ditutup. Mobile: panel menjadi bottom sheet yang bisa dibuka-tutup.

**Kriteria selesai**

- Peta tampil dan bisa di-zoom/geser di desktop dan mobile.
- Tidak ada error `window is not defined` saat build.
- Halaman tidak scroll horizontal di layar 360 px.

---

## Fase 3 – Layer Hotspot dan Filter

**Tugas**

- Layer hotspot dengan `circleMarker`. Warna berdasarkan confidence, ukuran berdasarkan FRP.
- Popup saat diklik: waktu deteksi, satelit, confidence, FRP, kabupaten.
- Panel filter: rentang tanggal (default 1 hari terakhir, pilihan cepat 1/3/7 hari), minimal confidence.
- Simpan state filter di URL search params supaya tampilan peta bisa dibagikan lewat link.
- Kartu ringkasan di atas peta: jumlah hotspot pada filter aktif, jumlah zona aktif, kabupaten dengan hotspot terbanyak.
- Tangani loading, data kosong ("Tidak ada hotspot pada rentang ini"), dan error.

**Kriteria selesai**

- Mengubah filter memperbarui peta dan URL.
- Membuka URL dengan filter langsung menampilkan hasil yang sama.
- Peta tetap lancar dengan ±2.000 titik.

---

## Fase 4 – Layer Zona Kebakaran (Cluster)

**Tugas**

- Tampilkan poligon cluster dengan warna berdasarkan status (baru, meluas, stabil, menyusut).
- Klik cluster membuka panel detail: jumlah hotspot, luas, status, aktif sejak, kabupaten.
- Toggle layer hotspot dan cluster di panel layer.

**Kriteria selesai**

- Cluster dan hotspot bisa ditampilkan bersamaan atau terpisah.
- Panel detail menampilkan data cluster yang diklik.

---

## Fase 5 – Layer Prediksi Risiko (fitur utama)

**Tugas**

- Tampilkan kotak grid berwarna sesuai level risiko, dengan opacity yang bisa diatur.
- Slider "Prediksi untuk": hari +1 sampai +7, dengan tanggal yang ditampilkan.
- Klik kotak membuka panel detail berisi:
  - Skor dan level risiko (dengan label teks, bukan hanya warna).
  - Bagian **"Kenapa risikonya tinggi?"**: 3 faktor teratas berupa bar horizontal kontribusi beserta label penjelasannya.
  - Info lahan gambut dan kabupaten.
  - Tautan ke halaman detail kabupaten.
- Legenda level risiko di pojok peta.
- Daftar "5 kabupaten paling rawan" berdasarkan rata-rata skor untuk tanggal yang dipilih.
- Catatan kecil: "Prediksi model, bukan kepastian."

**Kriteria selesai**

- Menggeser slider mengganti layer risiko sesuai tanggal.
- Panel detail dan daftar kabupaten rawan konsisten dengan data.
- Peta tetap responsif dengan seluruh kotak grid tampil.

---

## Fase 6 – Lapisan Tambahan

**Tugas**

- Layer batas kabupaten (garis tepi saja, dengan label nama saat hover).
- Layer lahan gambut (dari kotak grid dengan `is_gambut = true`, digabung jadi satu layer bertekstur atau berwarna lembut).
- Panel layer berisi toggle untuk semua layer: hotspot, cluster, risiko, batas wilayah, gambut.
- Simpan layer yang aktif di URL.

**Kriteria selesai**

- Semua layer bisa dinyalakan/dimatikan tanpa error dan urutan tumpukan layer masuk akal (hotspot paling atas).

---

## Fase 7 – Halaman Statistik (`/statistik`)

**Tugas**

- Grafik garis jumlah hotspot per bulan (24 bulan).
- Grafik perbandingan antar tahun per bulan (satu garis per tahun).
- Grafik batang jumlah hotspot per kabupaten, bisa diurutkan.
- Filter kabupaten (semua atau satu kabupaten).
- Tombol unduh CSV untuk data grafik yang sedang tampil (dibuat di client dari data yang sudah dimuat).

**Kriteria selesai**

- Semua grafik tampil benar di light dan dark mode, dan tetap terbaca di mobile.

---

## Fase 8 – Halaman Detail Kabupaten (`/wilayah/[slug]`)

**Tugas**

- Peta kecil wilayah tersebut dengan hotspot terbaru dan layer risiko.
- Kartu ringkasan: hotspot hari ini, hotspot 30 hari, rata-rata skor risiko besok, persentase area gambut.
- Kartu cuaca terbaru (termasuk jumlah hari tanpa hujan).
- Grafik tren hotspot bulanan untuk kabupaten tersebut.
- `generateStaticParams` untuk 12 kabupaten/kota, dan halaman 404 untuk slug yang tidak dikenal.
- Metadata halaman (judul dan deskripsi) per kabupaten.

**Kriteria selesai**

- Semua 12 halaman bisa dibuka, slug salah menampilkan 404.

---

## Fase 9 – Halaman Tentang dan Penyempurnaan

**Tugas**

- Halaman `/tentang`: tujuan sistem, sumber data (NASA FIRMS, Open-Meteo, ESA WorldCover, peta gambut, batas wilayah), penjelasan singkat metode (grid 5 km, model klasifikasi, SHAP, DBSCAN), dan keterbatasan (hotspot ≠ kebakaran terkonfirmasi, prediksi tidak pasti, data mock selama pengembangan).
- Halaman error dan not-found yang rapi.
- Audit aksesibilitas dasar: kontras warna, label tombol, navigasi keyboard di panel.
- Metadata situs, favicon, dan Open Graph.
- Cek tampilan di lebar 360 px, 768 px, dan 1440 px.

**Kriteria selesai**

- Tidak ada error di console browser di semua halaman.
- Lighthouse (mobile) skor Accessibility dan Best Practices ≥ 90.

---

## Fase 10 – Persiapan Integrasi Supabase

Pipeline belum tentu siap saat fase ini dikerjakan. Tujuannya menyiapkan supaya perpindahan dari mock ke Supabase nanti cukup mengganti env.

**Tugas**

- Implementasikan `lib/data/supabase.ts` memakai `@supabase/supabase-js` di sisi server, dengan fungsi yang sama seperti `mock.ts`.
- Query spasial (filter bbox, ambil GeoJSON) dipanggil lewat fungsi RPC Postgres. Tulis kontrak fungsinya di `docs/supabase-rpc.md`: nama fungsi, parameter, dan bentuk keluaran yang diharapkan, contohnya `get_hotspots(start_date, end_date, min_confidence, min_lon, min_lat, max_lon, max_lat)` yang mengembalikan GeoJSON FeatureCollection via `ST_AsGeoJSON`.
- Validasi respons Supabase pakai skema zod yang sama dengan mock.
- Tambahkan caching route handler yang sesuai (data berubah sekitar sekali sehari, misalnya revalidate 1 jam).
- Tulis `README.md`: cara menjalankan, variabel env, cara beralih `DATA_SOURCE`, dan cara deploy ke Vercel.

**Kriteria selesai**

- Dengan `DATA_SOURCE=mock`, semua tetap berjalan seperti sebelumnya.
- `supabase.ts` lolos typecheck dan kontrak RPC terdokumentasi.

---

## Di Luar Cakupan Repo Ini

- Pengambilan data FIRMS/Open-Meteo, clustering, training dan prediksi model (dikerjakan di repo `siapi-pipeline`).
- Notifikasi Telegram.
- Autentikasi pengguna.

## Catatan Keputusan

_(Diisi oleh Claude Code selama pengerjaan.)_
