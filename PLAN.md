# Rencana Pengerjaan Frontend SiAPI

Dokumen ini adalah rencana eksekusi untuk Claude Code. Baca `CLAUDE.md` dulu untuk konteks dan aturan proyek.

Cara kerja:

- Kerjakan **satu fase per sesi**, berurutan.
- Di akhir setiap fase: jalankan `pnpm lint`, `pnpm typecheck`, `pnpm build`, pastikan semua kriteria selesai terpenuhi, lalu buat commit dengan pesan `fase-N: <ringkasan>`.
- Kalau ada keputusan yang tidak tercakup di dokumen ini, pilih opsi paling sederhana, lalu catat di bagian **Catatan Keputusan** di akhir file ini.

> **Revisi cakupan nasional (N1–N6).** Cakupan sistem diubah dari Provinsi Riau menjadi **seluruh Indonesia**
> (34 provinsi, 514 kabupaten/kota). Fase 0–10 di bawah ditulis untuk versi Riau dan dibiarkan sebagai riwayat;
> perilaku yang berlaku sekarang dicatat di **Catatan Keputusan → Cakupan nasional**.
>
> - N1 – Batas wilayah Indonesia (geoBoundaries, `pnpm geo:build`).
> - N2 – Tipe, data mock, dan API nasional; halaman `/wilayah/[provinsi]` dan `/wilayah/[provinsi]/[kabupaten]`; statistik dua tingkat.
> - N3 – Peta nasional bertingkat (provinsi → kabupaten/kota → grid 5 km), fokus wilayah, ringkasan kontekstual.
> - N4 – Basemap berlabel lengkap (OSM standar dengan filter CSS).
> - N5 – Legenda detail.
> - N6 – Bersih-bersih teks, kode tak terpakai, dan dokumentasi.

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

**Umum**

- **Next.js 16.4 + React 19.3 + react-leaflet 5**, sesuai `create-next-app` terbaru. Opsi bawaan `cacheComponents` dan `partialPrefetching` dipertahankan. Akibatnya: data dinamis di halaman dibaca di dalam `<Suspense>` atau lewat fungsi `"use cache"`, dan `usePathname`/`useSearchParams` juga dibungkus `Suspense`.
- Script `typecheck` menjalankan `next typegen && tsc --noEmit`, karena tipe global `PageProps`/`LayoutProps` dibuat oleh Next.
- Semua tombol dan target sentuh minimal 44 px (`min-h-11`), termasuk tombol zoom Leaflet (di-override via CSS).
- Tata letak desktop 3 kolom dipakai mulai lebar ≥ 1280 px (`xl`). Di bawah itu (termasuk tablet 768 px) dipakai tata letak mobile (peta penuh, chip lapisan, bottom sheet), supaya peta tidak terlalu sempit.

**Data mock (Fase 1)**

- Tanggal data terakhir mock ditetapkan `2026-10-20` (bisa diubah dengan env `MOCK_END_DATE`) supaya hasilnya deterministik bersama seed tetap. Semua rentang waktu di UI ("24 jam", "3 hari", "besok") dihitung dari `tanggal_data`, bukan jam sistem.
- Batas kabupaten placeholder dibuat dari garis besar provinsi yang dibagi dengan *power diagram* (Voronoi berbobot) dari titik pusat tiap kabupaten; kota (Pekanbaru, Dumai) diberi bobot negatif agar lebih kecil. Kotak grid diberi kabupaten dengan aturan jarak yang sama, sehingga konsisten dengan batasnya.
- File besar (hotspot, grid, prediksi) disimpan dalam format ringkas (`types/mock.ts`) lalu diubah ke GeoJSON di `lib/data/mock.ts`. Total mock ±5 MB (GeoJSON penuh akan >15 MB).
- `waktu_deteksi` memakai offset WIB (`+07:00`), dan tanggal hotspot = tanggal WIB.
- Status cluster ditentukan dengan membandingkan jumlah hotspot di sekitar zona dengan hari sebelumnya, bukan acak.
- `DataStatus` ditambah field `tanggal_data`, `prediksi_mulai`, `prediksi_sampai` supaya client tahu tanggal acuan.
- `getRegionStats` menerima `start`/`end` opsional untuk jendela penghitungan hotspot (default 30 hari terakhir); `date` adalah tanggal target untuk rata-rata skor risiko.
- Ditambahkan endpoint `GET /api/weather` (opsional `slug`) untuk kartu "rata-rata hari tanpa hujan" dan info cuaca di panel detail.
- Default parameter API: tanpa `start`/`end` → tanggal data terakhir; tanpa `target_date` → besok. Jadi setiap endpoint tetap mengembalikan data saat dibuka langsung di browser.

**Peta (Fase 2–6)**

- Semua layer vektor memakai **satu renderer canvas** (`preferCanvas`) dan urutannya dijaga dengan `bringToFront()` (`components/map/layer-order.ts`). Pane terpisah membuat beberapa canvas bertumpuk, dan canvas teratas menghalangi klik ke kotak risiko di bawahnya.
- Layer dibuat imperatif (`useMap` + `useEffect`), bukan ribuan komponen `<CircleMarker>`, agar tetap lancar dengan ±2.000 titik dan ±4.000 kotak. Perubahan opasitas hanya mengubah style, tidak membangun ulang layer.
- Mengikuti panduan desain, hotspot berwarna #1C2321 bergaris putih (di mode gelap dibalik); *confidence* ditandai dengan kepekatan (rendah 50%, nominal 80%, tinggi 100%), bukan warna berbeda. Zona kebakaran semua bergaris putus-putus #1C2321; status ditampilkan sebagai teks di tooltip dan panel detail, bukan dengan warna.
- Label nama wilayah muncul dari posisi kursor (point-in-polygon), sehingga garis batas tidak perlu interaktif dan tidak menghalangi klik ke kotak risiko.
- Peta dasar di mode gelap memakai filter CSS pada tile OSM (tanpa penyedia tile kedua).
- State filter disimpan di URL lewat `window.history.replaceState` (tersinkron dengan `useSearchParams`, tanpa request ke server). Parameter: `rentang`, `conf`, `lapisan`, `prediksi`. Opasitas risiko tidak disimpan di URL.
- Seleksi kotak grid disimpan sebagai `cell_id`, sehingga panel detail mengikuti kotak yang sama saat hari prediksi diganti.
- Info cuaca di panel detail kotak adalah cuaca **terkini** kabupaten (judulnya "Cuaca terkini & lahan"), bukan prakiraan untuk tanggal target.
- Filter rentang waktu hanya pilihan cepat 24 jam / 3 hari / 7 hari (tanpa pemilih tanggal bebas), karena zona kebakaran hanya tersedia untuk hari terakhir.

**Statistik & wilayah (Fase 7–8)**

- Palet grafik perbandingan tahun divalidasi dengan skrip dataviz (lightness, chroma, CVD, kontras) untuk mode terang dan gelap: tahun berjalan = aksen, tahun sebelumnya = hijau-teal, dua tahun lalu = biru. Abu-abu tidak dipakai karena gagal cek chroma.
- Grafik garis memakai interpolasi `linear` (kurva `monotone` membuat lonjakan semu pada data bulanan). Label langsung hanya untuk tahun berjalan; tahun lain lewat legenda, karena label ujung garis sempat bertumpuk.
- Setiap grafik punya tabel data yang bisa dibuka ("Lihat tabel data") sebagai alternatif aksesibel.
- Peringkat kabupaten dan grafik prediksi 7 hari dibuat dengan HTML/CSS (bukan Recharts) agar label teks level risiko, warna, dan tata letak mobile lebih mudah dikontrol.
- Peringkat kabupaten di Statistik menghitung hotspot 12 bulan terakhir; skor risiko memakai prediksi untuk besok.
- Ditambahkan halaman indeks `/wilayah` (tujuan menu "Wilayah").
- `/wilayah/[slug]`: `dynamicParams` tidak didukung bersama Cache Components. Slug dicek **sebelum** `<Suspense>` lalu `notFound()` agar slug salah mendapat HTTP 404 sungguhan (bukan soft-404 dalam stream). Karena itu segmen ini memakai `export const instant = false` (validasi navigasi instan dimatikan); semua 12 slug valid tetap diprerender lewat `generateStaticParams`.

**Penyempurnaan & Supabase (Fase 9–10)**

- Lighthouse mobile (build produksi): Accessibility 100 di `/`, `/statistik`, `/wilayah/siak`, `/tentang`; Best Practices 96–100. Satu temuan tersisa: tile OSM beresolusi rendah pada layar DPR tinggi (bisa diatasi dengan `detectRetina`, tapi menambah beban tile OSM).
- `supabase.ts` memakai RPC untuk semua data spasial dan statistik, serta tabel/view (`regions`, `weather_latest`, `data_status`) untuk data sederhana. Kontraknya di `docs/supabase-rpc.md`, termasuk syarat waktu dikirim dengan offset `+07:00`.
- Caching: fungsi di `lib/data/index.ts` memakai `"use cache"` + `cacheLife("hours")`, dan route handler mengirim `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`. Di client, respons API disimpan di memori selama tab terbuka.
- Dengan `DATA_SOURCE=supabase`, `next build` memanggil Supabase saat prerender (header, halaman statis), jadi build butuh kredensial dan database yang sudah siap.

**Redesign (R1–R7, branch `refactor-design`)**

- *R1 – Fondasi.* shadcn/ui gaya `new-york` (Radix lewat paket `radix-ui`), dipasang dengan `components.json` manual karena proyek memakai loader `@tailwindcss/turbopack`, bukan PostCSS. Komponen hasil CLI sedikit diubah: cincin fokus memakai warna `ring` penuh (bukan 50%), tombol 40 px dan minimal 44 px di perangkat sentuh (`pointer-coarse:`), varian tombol `ember`, switch lebih besar dengan track "off" `--control-off` (kontras ≥ 3:1), thumb slider dengan area sentuh diperluas, teks bawaan ("Close", judul command palette) diterjemahkan, dan `DialogTitle` command palette dipindah ke dalam `DialogContent` (peringatan aksesibilitas Radix).
- Tema memakai **next-themes** (`attribute="class"`, default `system`) dengan kunci penyimpanan lama `siapi-theme`, sehingga pilihan tema pengguna sebelumnya tetap terbaca. Skrip tema buatan sendiri dihapus.
- Token warna ditulis sebagai CSS variables (hex, bukan oklch, supaya mudah dicek kontrasnya) di `app/globals.css`, dengan nama shadcn (`background`, `muted-foreground`, …) ditambah `ember`, `ember-ink` (teks aksen yang lolos 4,5:1), `glass`, `risk-*`, `map-*`, `chart-*`. Kontras dicek dengan skrip: teks muted 6,0–7,8:1, `ember-ink` ≥ 4,7:1, teks di atas badge risiko ≥ 4,8:1.
- **Sangat tinggi di mode gelap memakai #DC2626**, bukan #B91C1C: #B91C1C hanya 3,07:1 terhadap latar gelap sehingga sulit dibedakan dari basemap gelap; #DC2626 4,12:1 dan teks putih di atasnya tetap 4,83:1. `getRiskColor(level, theme)` di `lib/risk.ts` mengikuti token ini.
- `Aksen` shadcn (`--accent`) tetap berarti latar hover netral; warna aksen merek bernama `ember` agar tidak bentrok.
- Font Geist Sans dan Geist Mono lewat `next/font/google`.
- Halaman `/dev/ui` (noindex, tidak ada di navigasi) menampilkan token dan komponen.
- *R2 – Layout & navigasi.* Header satu baris 56 px (`--header-h`) di semua lebar layar, sticky dengan `backdrop-blur`. Navigasi desktop mulai `md` (768 px) dengan indikator aktif `motion` (`layoutId`); di bawah `md` navigasi pindah ke Sheet dari kanan. Badge status data: lengkap mulai `lg`, ringkas ("Data contoh") di `md`, versi statis dengan jam lengkap di footer menu mobile (versi tooltip di dalam Sheet ikut terbuka karena fokus otomatis).
- Command palette (cmdk dalam `CommandDialog`) berisi halaman, 12 kabupaten/kota, dan pilihan tema (terang/gelap/sistem). Bisa dibuka dengan Ctrl/⌘+K, tombol cari di header, atau `openCommandMenu()` (custom event) dari halaman mana pun. Label tombol pintasan menampilkan ⌘ di perangkat Apple dan Ctrl di lainnya (dibaca setelah hidrasi).
- *R3 – Peta.* **Basemap: Esri Canvas World Light/Dark Gray** (+ lapisan label "Reference" di pane sendiri di atas grid, `pointer-events: none`), bukan CARTO. Saat dicek (20 Okt 2026), tile CARTO Positron/Dark Matter tanpa kunci mengembalikan gambar watermark "API KEY REQUIRED" (ETag `wm-…`), jadi tidak bisa dipakai tanpa akun. Syarat Esri: atribusi wajib ("Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors, GIS User Community"); layanan tile ArcGIS Online ini ditujukan untuk penggunaan non-komersial/pengembangan — untuk produksi skala besar atau komersial perlu akun ArcGIS Location Platform (cek ulang syaratnya sebelum rilis). Kalau nanti ada API key CARTO (syarat CARTO: gratis untuk non-komersial ≤ 75 ribu map view/bulan, selebihnya lisensi enterprise), cukup ganti `BASEMAPS` di `components/map/map-view.tsx`. Filter CSS invert pada tile OSM untuk mode gelap dihapus.
- Peta memenuhi area di bawah header; semua panel melayang (`glass-panel`: latar semi-transparan + `backdrop-blur`). Desktop (≥ 1024 px): panel filter kiri dan Ringkasan kanan, keduanya bisa diciutkan; Ringkasan otomatis terciut di 1024–1279 px agar tidak menutupi pesisir timur. Mobile: tombol filter membuka Drawer (tab "Filter & lapisan" / "Ringkasan"), angka utama tampil sebagai strip pil yang bisa digeser.
- Detail fitur: Sheet melayang **non-modal** di desktop (klik peta memilih fitur lain tanpa menutup panel; Esc/tombol tutup menutup), Drawer di mobile. Hotspot kini juga membuka panel detail (sebelumnya popup).
- Hover: satu tooltip bersama per lapisan (bukan ribuan `bindTooltip`), dengan sorotan fitur yang di-hover. Label nama wilayah dari lapisan batas hanya tampil saat lapisan risiko mati, karena tooltip kotak risiko sudah menyebut wilayahnya.
- Transisi: lapisan fade in/out ±200 ms (dihapus setelah fade selesai, listener dilepas lebih dulu agar tidak bisa diklik). Lapisan risiko membuat poligon sekali per `cell_id`; ganti hari/tema mencampur warna tiap kotak (260 ms) alih-alih membangun ulang. Lapisan gambut hanya dibangun ulang bila himpunan kotak gambutnya berubah. Semua tween langsung ke akhir bila `prefers-reduced-motion`.
- Play timeline: semua 7 hari di-prefetch saat play ditekan; hari berikutnya ditampilkan 1,1 detik setelah data hari berjalan siap; berhenti di +7 (play lagi mulai dari +1). Setiap langkah tetap memperbarui `prediksi` di URL.
- Kontrol zoom/"kembali ke Riau" adalah tombol biasa di luar kontainer Leaflet (bisa difokus keyboard, punya aria-label & tooltip); peta sendiri tetap bisa digeser dengan panah dan di-zoom dengan +/− saat difokus. Tombol bergeser ke kiri saat Sheet detail terbuka.
- `aria-label`/`aria-valuetext` slider Radix diteruskan ke thumb (elemen yang menerima fokus), bukan root.
- Durasi animasi Sheet dipangkas ke 200–300 ms dan animasi buka/tutup Drawer vaul ke 280 ms (bawaan 500 ms).
- *R4 – Statistik.* Palet grafik divalidasi ulang dengan skrip dataviz: tahun berjalan = ember #E8590C di **kedua** mode (varian gelap lama #F07040 gagal lightness band), tahun lalu teal, dua tahun lalu biru. Pasangan teal↔biru di mode gelap hanya ΔE 6,5 (tritan), jadi diberi encoding sekunder: dua tahun lalu bergaris putus-putus, plus legenda dan tabel data. Seri tunggal "hotspot per bulan" memakai ember (abu-abu gagal chroma floor).
- Grid bento: tile besar "Total 24 bulan" dengan sparkline area; sparkline lain abu-abu dengan satu titik aksen (bulan terakhir, atau bulan puncak). Sparkline berupa SVG biasa (dirender server, tanpa layout shift); titiknya elemen HTML agar tetap bulat saat garis direntang. Tile skor risiko memakai gauge yang sama dengan panel detail peta.
- Grafik memakai `ChartContainer` shadcn + tooltip kustom (format angka Indonesia, swatch garis), dimuat dengan `next/dynamic` (`ssr: false`) dan skeleton seukuran grafik. Animasi Recharts 300 ms dan mati untuk `prefers-reduced-motion`. Legenda grafik antar tahun berupa tombol `aria-pressed` untuk menyembunyikan/menampilkan seri; warna mengikuti selisih tahun, bukan urutan, jadi menyembunyikan seri tidak mengubah warna seri lain.
- Tick Januari pada sumbu bulanan ditulis sebagai tahun ("2025") karena "Jan 2025" terlalu lebar dan disembunyikan oleh Recharts.
- Tombol "Unduh CSV" (tren bulanan) dan "CSV" (peringkat) menampilkan toast sonner (sukses/gagal). Filter kabupaten memakai shadcn Select dengan nilai `semua` untuk "Semua (Provinsi Riau)" (Radix tidak mengizinkan nilai kosong); parameter URL tetap `kabupaten`.
- Peringkat: baris bergeser dengan `motion` `layout` saat urutan diganti; urut skor memakai warna level risiko + badge teks, urut hotspot memakai satu warna netral (kabupaten terpilih = ember).
- *R5 – Wilayah.* Hero: jenis wilayah (ember), nama, badge "Risiko besok", dan navigasi cepat (Select kabupaten + tombol yang membuka command palette). Kartu bento: hotspot 30 hari dengan sparkline harian (dihitung di server dari hotspot 30 hari), skor risiko besok + gauge + puncak 7 hari, persentase gambut dengan meter, dan kartu cuaca. Peta mini memakai kontrol peta yang sama (tombol "kembali" ke batas kabupaten).
- Grafik prediksi 7 hari tetap HTML/CSS (label level di bawah setiap batang), kini dengan batang yang tumbuh bertahap dan tooltip tanggal lengkap. Grafik hotspot per bulan menyorot bulan terakhir dengan ember, bulan lain abu-abu.
- Halaman indeks `/wilayah` diurutkan dari skor risiko tertinggi (sebelumnya urutan data), agar langsung menjawab "wilayah mana yang perlu diperhatikan".
- Ikon lucide adalah fungsi, jadi tidak bisa dikirim sebagai prop dari server component ke client component (`InfoGrid`); grid cuaca di halaman wilayah dirender sebagai markup server.
- Catatan: `/wilayah/<slug-salah>` mengembalikan **HTTP 200** dengan isi halaman "tidak ditemukan" pada `next start` (halaman lain yang tidak ada → 404). Perilaku ini sudah ada sebelum redesign (dicek dengan membangun commit `9a22808`), jadi tidak diubah di sini.
- *R6 – Tentang & state.* Halaman Tentang bertata letak editorial: hero dengan judul besar, catatan data contoh, bagian bernomor (01–05), langkah metode sebagai kartu, sumber data sebagai daftar tautan (ikon + "membuka tab baru" untuk pembaca layar), tabel tingkat risiko dengan kolom "Arti", dan daftar isi lengket dengan penanda bagian aktif (IntersectionObserver) mulai `lg`. Isi teks dari Fase 9 dipertahankan.
- State bersama di `components/ui/state.tsx`: `EmptyState` (ikon, judul, saran langkah berikutnya) dan `ErrorState` (pesan jelas + tombol coba lagi). Dipakai di halaman error, grafik tanpa hotspot (Statistik & Wilayah), daftar paling rawan, dan peringkat. Error pengambilan data di peta tetap berupa pil status dengan tombol "Coba lagi". Skeleton setiap halaman meniru bentuk kontennya (kartu bento, grafik dengan sumbu, peta dengan grid).
- `global-error.tsx` tetap mandiri (tanpa CSS aplikasi) tetapi kini memakai warna token dan mengikuti `prefers-color-scheme`.
- Komponen lama yang sudah tergantikan dihapus: `legacy-card`, `controls` (SegmentedControl/Switch/Skeleton buatan sendiri), `icons` (diganti lucide-react), `summary-cards`, `bottom-sheet`, `layer-chips`, `html.ts`.
- *R7 – Penyempurnaan.* Durasi animasi diseragamkan 150–300 ms (count-up dan "kembali ke Riau" diturunkan dari 600 ms); animasi "ping" terus-menerus pada titik status data dihapus karena tidak menandai perubahan apa pun. Animasi lebar (bar, gauge) tetap berjalan untuk `prefers-reduced-motion` karena `MotionConfig reducedMotion="user"` hanya mematikan transform/layout; gerak yang memindahkan elemen (geser, skala, reorder, tween peta, Recharts) mati.
- Audit axe-core (WCAG 2.1 A/AA + best practice) pada semua halaman, terang & gelap, 360 & 1440 px, termasuk command palette, Sheet detail, dan Drawer mobile: 0 pelanggaran setelah dua perbaikan — strip ringkasan mobile yang bisa digulir kini fokusabel, dan `CommandSeparator` dihapus dari command palette (role `separator` tidak boleh di dalam listbox). Saat Select Radix terbuka, axe melaporkan `aria-hidden-focus`/`region` karena Radix sengaja menyembunyikan halaman dan menjebak fokus; ini perilaku bawaan dan dibiarkan.
- Target sentuh 44 px di perangkat sentuh juga untuk tautan navigasi dan badge status (tablet menampilkan navigasi desktop mulai 768 px).
- Tidak ada scroll horizontal di 360, 768, 1024, dan 1440 px untuk `/`, `/statistik`, `/wilayah`, `/wilayah/[slug]`, `/tentang` (dicek otomatis).
- `/dev/ui` memanggil `notFound()` bila `NODE_ENV=production`, jadi hanya tersedia saat `pnpm dev`.
- `CLAUDE.md` (tech stack, bagian Desain, struktur folder) dan catatan basemap di `README.md` diperbarui.

**Cakupan nasional (N1–N6, branch `refactor-design`)**

- *N1 – Batas wilayah.* Sumber: geoBoundaries gbOpen IDN versi *simplified* (ADM1 34 provinsi, OSM 2017, ODbL; ADM2 519 fitur, BPS/OCHA 2020, CC BY 3.0 IGO), diunduh ke `data-raw/` (di-`.gitignore`) dan diproses `pnpm geo:build` (`scripts/build-geo.ts`, mapshaper lewat API Node).
- **Jumlah provinsi 34, bukan 38.** Data geoBoundaries masih memakai pembagian sebelum pemekaran Papua 2022 (Papua Selatan, Papua Tengah, Papua Pegunungan, Papua Barat Daya). Dipakai apa adanya; kabupaten di wilayah pemekaran tetap berinduk Papua/Papua Barat. Nama provinsi diganti ke Bahasa Indonesia dari kode ISO 3166-2, `id` provinsi = kode BPS (mis. `14` Riau); `id` kabupaten/kota = `shapeID` geoBoundaries (kode BPS tidak tersedia di sumber).
- Provinsi **di-dissolve dari kabupaten/kota**, bukan dipakai langsung dari ADM1, karena ADM1 (OSM) dan ADM2 (BPS) berbeda sumber dan batasnya tidak berimpit. Induk setiap kabupaten ditentukan dari tumpang tindih terbesar dengan ADM1 (`-join largest-overlap`); Kepulauan Seribu tidak bertumpang tindih sama sekali sehingga induknya (DKI Jakarta) ditetapkan manual.
- Lima fitur ADM2 bukan wilayah administrasi dibuang: `Danau`, `Danau Toba`, `Waduk Cirata`, `Wadung Kedungombo`, `Hutan`. Lubang kecil (< 60 km², waduk dan petak "Hutan") diisi ke tetangganya oleh `-clean gap-fill-area`; Danau Toba tetap berupa lubang. Jadi ada 514 kabupaten/kota (416 kabupaten, 98 kota), sesuai data BPS 2020.
- Perbaikan nama: "Kota Baru" di sumber adalah Kabupaten Kotabaru (Kalimantan Selatan), bukan kota. Nama lama yang sudah berganti (mis. Mamuju Utara → Pasangkayu, Toba Samosir → Toba) dibiarkan mengikuti sumber.
- Slug: kabupaten = nama (`siak`), kota diberi awalan (`kota-pekanbaru`) karena banyak nama kabupaten dan kota yang sama (Bogor, Bandung, …). Slug kabupaten yang sama dengan slug provinsi diberi awalan `kabupaten-` (`kabupaten-gorontalo`). Semua slug unik secara nasional.
- Penyederhanaan: pulau < 1 km² dibuang (kecuali bagian terbesar setiap kabupaten, supaya kabupaten kepulauan seperti Kepulauan Seribu tetap ada), Visvalingam berbobot 30% dengan topologi bersama, `-clean` sebelum dan sesudah; provinsi: pulau < 12 km² dibuang, 30%. Koordinat 5 desimal. Hasil: kabupaten ±2,3 MB, provinsi ±360 KB. Pemeriksaan ulang `-clean` tidak menemukan celah/tumpang tindih.
- Ditambahkan `mock/provinsi-garis.geojson`: garis antarprovinsi yang diambil dari topologi kabupaten (`-innerlines`), sehingga saat zoom dekat garis provinsi berimpit tepat dengan garis kabupaten (poligon provinsi lebih disederhanakan dan tidak berimpit).
- *N2 – Tipe, mock, API.* `Region` kini punya `provinsi` (slug induk, `null` untuk provinsi); batas wilayah membawa `label` dan `bbox`. Setiap hotspot, zona, dan kotak grid membawa `provinsi` dan `kabupaten`. `RegionStat` ditambah `level`, `provinsi`, `maks_skor_risiko`, `jumlah_sel` (bobot rata-rata nasional). `RegionDetail` ditambah `nama_provinsi` dan `jumlah_kabupaten`.
- **Grid risiko mencakup seluruh daratan Indonesia** (±76.000 kotak 5 km), bukan hanya provinsi rawan, supaya choropleth dan peringkat nasional konsisten. Agar mock tetap kecil, skor disimpan sebagai bilangan bulat ×1000 dan faktor SHAP tidak disimpan: `lib/data/mock.ts` menghitung ulang tiga faktor teratas dari input model mock (`lib/mock-model.ts`, dipakai juga oleh generator), jadi skor dan penjelasannya tetap konsisten. Total mock ±13 MB (batas wilayah ±2,8 MB, hotspot ±7,5 MB, grid ±1,5 MB, prediksi ±1,6 MB).
- Pola mock: bobot kebakaran per provinsi × musim (gambut Sumatra/Kalimantan puncak Agu–Sep dengan puncak kecil Feb–Mar; sabana Nusa Tenggara Mei–Nov; Papua selatan Sep–Nov; wilayah basah hampir datar) × gambut (4×). Papua hanya aktif di dataran rendah selatan (lintang < −6,3°). Provinsi rawan juga dibuat lebih kering (lebih banyak hari tanpa hujan), sehingga rata-rata risiko provinsi berkisar rendah–sedang dan kabupaten sampai sangat tinggi; tanpa itu hampir semua rata-rata provinsi "rendah" dan choropleth kosong. Semua titik hotspot dicek jatuh di dalam poligon kabupaten (daratan).
- `GET /api/risk` **wajib** dipersempit dengan `bbox` (maks. 25 derajat persegi), `provinsi`, atau `kabupaten`; tanpa itu 400. Grid nasional utuh (±30 MB GeoJSON) tidak pernah dikirim; zoom jauh memakai rata-rata per wilayah.
- Ringkasan agregat per provinsi/kabupaten memakai endpoint yang sudah ada, `GET /api/stats/regions`, ditambah `level`, `provinsi`, dan `min_confidence` (supaya jumlah hotspot di choropleth sama dengan filter peta). Endpoint baru: `/api/hotspots/groups` (kelompok hotspot berangka, supercluster di server frontend dari hasil `getHotspots`, indeks disimpan di memori untuk 8 kombinasi filter terakhir), `/api/regions/lines`, `/api/regions/list`.
- Slug `provinsi`/`kabupaten` yang tidak dikenal, atau kabupaten yang bukan bagian dari provinsi yang diminta, menghasilkan 400 (`validateArea` di `lib/api.ts`).
- Cuaca provinsi = rata-rata kabupaten/kotanya. `GET /api/weather` tanpa `slug` kini mengembalikan daftar kabupaten/kota lewat satu query (`getWeatherList`), bukan satu query per wilayah.
- Halaman wilayah: `/wilayah/[provinsi]` dan `/wilayah/[provinsi]/[kabupaten]` memakai satu komponen server `RegionOverview`. Halaman provinsi menampilkan peta choropleth kabupaten/kotanya dan peringkat kabupaten/kota; halaman kabupaten menampilkan grid 5 km. Alamat lama `/wilayah/<kabupaten>` dialihkan permanen ke alamat baru, begitu juga kabupaten di bawah provinsi yang salah. Semua 548 halaman diprerender (±45 detik di build).
- Daftar 548 wilayah untuk command palette tidak lagi dikirim sebagai props di header setiap halaman (menambah ±100 KB per halaman dan membuat build >3 menit dengan timeout), tetapi dimuat dari `/api/regions/list` saat palette pertama kali dibuka.
- Statistik: filter dua langkah (provinsi → kabupaten/kota, parameter URL `provinsi` dan `kabupaten`), peringkat dalam tab Provinsi / Kabupaten/kota. Tanpa provinsi terpilih, peringkat kabupaten menampilkan 25 teratas dengan tombol "Tampilkan semua". Rata-rata skor nasional dibobot jumlah kotak grid tiap provinsi.
- Indeks `/wilayah`: 12 kabupaten/kota paling rawan secara nasional + semua provinsi, keduanya diurutkan dari rata-rata risiko.
- Waktu deteksi tetap memakai offset WIB (`+07:00`) untuk seluruh Indonesia, termasuk wilayah WITA/WIT, agar satu tanggal data berlaku nasional; label "WIB" ditampilkan di UI.
- *N3 – Peta bertingkat.* Tingkat ditentukan zoom: < 7 provinsi, 7–8 kabupaten/kota, ≥ 9 dekat (grid 5 km). Zoom pecahan (zoomSnap 0,25) dibulatkan ke bawah untuk kelompok hotspot. Choropleth memakai rata-rata skor hari terpilih dari `/api/stats/regions` (dengan rentang dan kepercayaan hotspot yang sama dengan filter, supaya angka tooltip cocok). Choropleth tetap bisa di-hover/klik saat lapisan risiko mati selama lapisan batas menyala (isian transparan, hit-test canvas tetap jalan); bila keduanya mati, wilayah tidak interaktif.
- Batas kabupaten/kota (±2,3 MB) dan garis provinsi baru dimuat ketika peta pertama kali mendekati zoom 7 (mulai zoom 6), lalu disimpan selama tab terbuka. Batas provinsi (±360 KB) dan daftar wilayah dimuat sejak awal.
- Hotspot: zoom < 9 memakai `/api/hotspots/groups` (supercluster, radius 56 px, minimal 3 titik per kelompok, `maxZoom` 8) — di zoom < 7 untuk seluruh Indonesia, di zoom 7–8 untuk bbox layar yang diperlebar dan dibulatkan ke grid 2°. Hotspot yang berdiri sendiri tetap digambar sebagai titik (dan bisa diklik untuk detail). Kelompok berupa marker HTML (`divIcon`) agar angka tajam dan bisa difokus keyboard; klik/Enter memperbesar 2 tingkat. Zoom ≥ 9 memakai `/api/hotspots?bbox=` (grid 0,5°) dan grid risiko `/api/risk?bbox=` (grid 0,5°, dibatasi 24 derajat persegi di sekitar pusat layar). Permintaan berbasis bbox menunggu peta berhenti bergerak (debounce 250 ms); pembulatan bbox membuat geser kecil memakai cache yang sama.
- Lahan gambut berasal dari kotak grid, jadi hanya tampil di zoom ≥ 9; di zoom lebih jauh muncul pil "Perbesar peta untuk melihat lahan gambut".
- Klik wilayah atau pilih di command palette → peta terbang ke bbox wilayah dan wilayah menjadi **fokus** (parameter URL `wilayah`, bisa dibagikan). Fokus ditandai garis ember dan pil di atas peta berisi nama, tautan "Halaman wilayah", dan tombol hapus fokus. Dari halaman lain, command palette membuka `/?wilayah=<slug>`.
- Kartu ringkasan mengikuti konteks: wilayah fokus; jika tidak ada, wilayah di tengah peta (provinsi di zoom 7–8, kabupaten/kota di zoom ≥ 9); di zoom < 7 seluruh Indonesia. Untuk kabupaten/kota, kartu "Paling rawan" diganti "Rata-rata risiko" wilayah itu; daftar 5 paling rawan memakai kabupaten/kota di provinsi konteks.
- Peta dibatasi `maxBounds` 88–148° BT, 16° LS–11° LU dengan `maxBoundsViscosity` 0,8; zoom minimum 4.
- *N4 – Basemap.* Riwayat git: fase-2 sampai fase-6 memakai tile **OpenStreetMap standar** (mode gelap dengan filter `invert` pada pane tile); redesign R3 menggantinya dengan Esri Canvas yang labelnya hanya kota besar. CARTO Voyager dicek lagi (23 Okt 2026): `rastertiles/voyager`, `voyager_labels_under`, dan `dark_all` tanpa kunci tetap mengembalikan tile watermark (ETag `wm-…`). Jadi dipakai OSM standar untuk kedua tema: terang `saturate(0.3) brightness(1.04) contrast(0.92)`, gelap `invert(1) hue-rotate(180deg) saturate(0.3) brightness(0.88) contrast(0.9)` — filter hanya pada `.leaflet-tile-pane` (dipilih lewat atribut `data-map-theme` pada pembungkus peta), lapisan data tidak terpengaruh. Label di tile gelap menjadi teks terang di latar gelap dan tetap terbaca.
- Zoom maksimum 18 (tile OSM sampai 19). Atribusi: OpenStreetMap contributors + geoBoundaries (OSM/ODbL, BPS/OCHA CC BY 3.0 IGO).
- **Tanpa pane label terpisah.** OSM tidak punya lapisan label saja, dan lapisan label penyedia lain (Esri Boundaries & Places) akan menumpuk dua set label berbeda. Sebagai gantinya lapisan data dibuat lebih transparan: isian choropleth 42%, opasitas default grid risiko 55% (sebelumnya 70%), gambut 26%. Tingkat "rendah" tetap transparan, jadi sebagian besar daratan tidak tertutup warna.
- *N5 – Legenda.* Satu komponen `LegendContent` dipakai panel melayang yang bisa diciutkan (desktop, juga peta halaman wilayah) dan Drawer dari tombol "Legenda" (mobile). Isi mengikuti lapisan aktif dan tingkat zoom; setiap bagian punya judul, keterangan, dan jumlah objek **di dalam layar** (wilayah yang bbox-nya bersinggungan dengan layar, kotak, titik, kelompok, zona).
- Hotspot: kepercayaan tetap ditandai **kepekatan** (rendah 50%, nominal 80%, tinggi 100%) sesuai keputusan desain sebelumnya, bukan warna berbeda; legenda menampilkan tiga contohnya. Skala FRP: 5, 50, 200 MW dengan rumus radius yang sama dengan peta (`components/map/styles.ts`, tanpa impor Leaflet supaya legenda bisa dirender di server).
- Zona kebakaran kini punya **gaya garis per status**: baru = titik-titik, meluas = garis penuh tebal, stabil = putus-putus (seperti sebelumnya), menyusut = putus panjang tipis dan lebih pudar. Warna tetap satu.
- Prediksi risiko: klik satu level → hanya level itu yang diwarnai (choropleth dan grid; state lokal, tidak disimpan di URL); klik lagi atau "Tampilkan semua level" untuk mengembalikan. Keterangan menjelaskan bahwa di zoom jauh warna adalah rata-rata per provinsi/kabupaten.
- Hover item legenda menyorot objek terkait: level risiko → garis tepi wilayah/kotak level itu; kepercayaan → hotspot level itu ditebalkan, lainnya diredupkan (kelompok ikut diredupkan); kelompok → cincin ember pada kelompok; status zona → zona itu ditebalkan; gambut → gambut lebih pekat; batas → garis provinsi/kabupaten ditebalkan. Untuk keyboard, tombol level risiko juga memicu sorotan saat difokus.
- *N6 – Bersih-bersih.* Judul situs, metadata, Open Graph, header, menu mobile, navigasi, halaman Tentang, dan README kini menyebut cakupan nasional; "Riau" hanya tersisa sebagai contoh wilayah (komentar, catatan riwayat). Helper yang tidak lagi dipakai dihapus (`ringCentroid`, `distanceKm`, `getRiskTextColor`, `isJsonCached`, `RISK_FEATURES`); berkas mock lama `regions.geojson` dan rute `/wilayah/[slug]` sudah dihapus di N2. Halaman Tentang menambahkan OpenStreetMap sebagai sumber peta dasar.

**Performa peta – MapLibre (P1–P5, branch `refactor-design`)**

- *P1 – Mesin peta.* Leaflet diganti **MapLibre GL JS 5** lewat `react-map-gl/maplibre` (WebGL: semua lapisan digambar GPU, bukan canvas 2D per objek). Versi 6 sengaja belum dipakai: v6 hanya ESM dan memuat worker dari file terpisah lewat `import.meta.url`, yang tidak ikut terbawa saat dibundel Next/Turbopack; v5 membawa worker sebagai blob dan berjalan tanpa konfigurasi.
- **Skala zoom bergeser satu tingkat.** MapLibre memakai tile 512 px, jadi zoom MapLibre *z* = zoom Leaflet *z + 1* untuk skala yang sama. Ambang lama (Leaflet) 7 dan 9 menjadi 6 dan 8; zoom minimum 3, maksimum 17. Fokus wilayah: maks. zoom 8 (provinsi) / 10 (kabupaten).
- **Basemap: OpenFreeMap** (`positron` untuk terang, `dark` untuk gelap; vektor, tanpa API key, data OpenStreetMap/OpenMapTiles). URL style bisa diganti lewat `NEXT_PUBLIC_MAP_STYLE_LIGHT` / `NEXT_PUBLIC_MAP_STYLE_DARK`; bila style gagal dimuat dipakai style kosong agar lapisan data tetap tampil. Filter CSS pada peta dihapus; ganti tema = `setStyle` penuh (`styleDiffing={false}`), lalu `<Source>`/`<Layer>` react-map-gl menambahkan dirinya lagi saat `styledata`.
- **Label diatur lewat style**, bukan bawaan basemap: semua layer simbol basemap dipindah ke atas lapisan non-label, dan label tempat (`place` OpenMapTiles) diganti layer sendiri dengan nama Indonesia (`name:id`) dan halo: kota mulai zoom 6, kota kecil 9, kecamatan (`suburb`) 10, desa 11, dusun 13, negara sampai zoom 8. Nama provinsi (semua zoom) dan kabupaten/kota (mulai 6,5) diambil dari titik label batas wilayah kita sendiri, jadi `state` dari basemap tidak dipakai (menghindari dua nama untuk satu provinsi).
- **Urutan lapisan lewat slot.** Style yang disiapkan (`components/map/basemap.ts`) berisi layer kosong `siapi-slot-*` (background, `visibility: none`); setiap layer data dipasang `beforeId` slot-nya sehingga urutan tetap sama setelah ganti style: wilayah → gambut → risiko → batas → fokus → zona → sorotan → hotspot → *label basemap* → label wilayah → kelompok hotspot → sorotan hotspot. Isian dan garis berada di bawah label; kelompok hotspot berangka di atas label agar angkanya terbaca.
- Interaksi: satu pipeline per peta (`components/map/interactions.tsx`) — `queryRenderedFeatures` sekali per frame animasi, hanya objek teratas yang bereaksi (seperti `bubblingMouseEvents: false` di Leaflet), hover lewat feature-state, satu elemen tooltip yang isinya dibuat ulang hanya saat objek berganti. Isi tooltip tetap dari `tooltipHtml`.
- Gaya garis zona: `line-dasharray` MapLibre dalam satuan lebar garis, jadi pola piksel di `ZONE_STYLES` (dipakai juga oleh glyph legenda) dibagi lebar garisnya.
- *P2 – Lapisan data di GPU.* **Hotspot**: satu source GeoJSON `cluster: true` (radius 50 px, minimal 3 titik, `clusterMaxZoom` 7, properti `frp_maks`), berisi hotspot seluruh Indonesia untuk rentang dan kepercayaan terpilih; pengelompokan berjalan di worker MapLibre. Endpoint `/api/hotspots/groups` dan dependensi `supercluster` dihapus. Kepercayaan memakai warna lewat ekspresi (`circle-color` = warna hotspot dengan alfa 50/80/100%, jadi tampilan "kepekatan" tetap), ukuran dari FRP. Klik kelompok → `getClusterExpansionZoom`.
- Konsekuensi: kelompok hotspot kini digambar di WebGL dan tidak lagi bisa difokus dengan Tab seperti marker HTML Leaflet. Peta tetap bisa digeser/zoom dengan keyboard, dan angka ringkasan tersedia di panel.
- **Choropleth lewat feature-state**: source batas memakai `promoteId: "slug"`, level risiko tiap wilayah disimpan di feature-state (`level` 0–3) dan warna dihitung ekspresi `match`. Ganti hari prediksi (termasuk saat play) hanya menulis feature-state yang berubah (`useFeatureStates`), tanpa memuat ulang geometri. Hover juga feature-state. Animasi warna antarhari (tween) dihapus.
- **Tingkat zoom di GPU**: isian provinsi `< 6`, kabupaten `6–<8`, grid `≥ 8` lewat `minzoom`/`maxzoom` dan ekspresi `step` pada `fill-opacity`, sehingga peralihan terjadi saat zoom berjalan tanpa menunggu React. Isian provinsi tetap tampil sampai batas kabupaten selesai dimuat.
- Batas provinsi dimuat sejak awal; batas kabupaten dan garis provinsi baru dimuat saat zoom pertama kali ≥ 6 (atau ada kabupaten yang difokus).
- Grid risiko hanya di zoom ≥ 8, untuk bbox layar setelah peta berhenti bergerak (`moveend` + debounce 300 ms). Permintaan lama dibatalkan (`AbortController` di `useJson`); area yang diminta disimpan selama layar masih berada di dalamnya, jadi geser kecil tidak memuat ulang.
- Lapisan yang dimatikan disembunyikan dengan `visibility: none`; source tetap terpasang dengan data terakhir. Garis fokus wilayah memakai filter slug pada source batas (tanpa geometri di JavaScript).
- Wilayah di tengah peta (konteks ringkasan) dan jumlah kelompok hotspot di legenda dibaca dari peta yang sudah dirender (`queryRenderedFeatures` saat `idle`), bukan dengan uji titik-dalam-poligon di JavaScript.
- *P3 – Data lebih ringan.* **Batas wilayah dua tingkat penyederhanaan** (`pnpm geo:build`): `mock/*.geojson` tetap untuk server (luas, bbox, titik label), sedangkan peta browser memakai `public/geo/*.json` yang disederhanakan lagi dari topologi yang sama (kabupaten: 55% titik versi server; provinsi di-dissolve dari situ, pulau < 40 km² dibuang, 35%), 4 desimal, properti hanya `slug`, `nama`, `level`, `provinsi`. Hasil: provinsi 206 KB (target < 250 KB), kabupaten/kota 1,25 MB (< 1,5 MB), garis provinsi 59 KB, titik label 6 KB + 91 KB.
- File batas statis diberikan sebagai URL ke source GeoJSON, jadi diunduh dan di-parse oleh worker MapLibre (tidak lewat main thread) dan di-cache browser (`Cache-Control: max-age=86400, stale-while-revalidate=604800` di `next.config.ts`; versi di `components/map/geo-files.ts`, naikkan setelah `geo:build`). Route `/api/regions` dan `/api/regions/lines`, `getProvinceLines`, RPC `get_province_lines`, dan `mock/provinsi-garis.geojson` dihapus. `get_region_boundaries` kini hanya dipakai untuk daftar wilayah; slug di database wajib sama dengan file statis.
- **Hotspot untuk peta** (`GET /api/hotspots`): hanya `id`, `confidence`, `frp`, koordinat 4 desimal. Tujuh hari nasional (±7.900 titik mock): 2,1 MB → 1,17 MB mentah (174 → 113 KB gzip). URL-nya langsung menjadi data source cluster (di-parse worker). Tooltip hotspot kini berisi FRP dan kepercayaan; waktu, satelit, dan wilayah ada di panel detail yang memuat `GET /api/hotspots/[id]` (RPC baru `get_hotspot`) saat titik diklik.
- **Grid risiko ringkas** (`GET /api/risk/grid`, RPC baru `get_risk_grid`): tabel `[cell_id, min_lon, min_lat, is_gambut, indeks kabupaten, skor×1000 per hari]` untuk **semua** hari prediksi, bukan GeoJSON per hari; poligon kotak dibangun di browser sekali per area. Ganti hari/play = feature-state saja, tanpa request. Ukuran: 15.151 kotak × 7 hari = 864 KB (231 KB gzip), dibanding ±5,3 MB per hari untuk ±9.000 kotak dengan format lama. Batas bbox dinaikkan ke 40 derajat persegi (layar 1440 × 900 di zoom 8). Detail satu kotak (faktor, dsb.) dari `GET /api/risk/cell` (RPC baru `get_risk_cell`). `GET /api/risk` dan RPC `get_risk_cells` dihapus. Ini pengecualian dari aturan "data peta = GeoJSON".
- Mock: semua file tetap dibaca sekali per proses (`memo`); hotspot kini juga diindeks per hari per provinsi/kabupaten (dibuat saat pertama dipakai), grid diindeks per id (selain per provinsi, kabupaten, dan ember 1°).
- Header cache API: `public, max-age=600, s-maxage=3600, stale-while-revalidate=86400` (sebelumnya tanpa `max-age`, jadi browser selalu bertanya ulang). Cache respons di `useJson` dibatasi 60 URL (grid per area bisa menumpuk).
- **Bundle client**: MapLibre + react-map-gl berada di satu chunk dinamis (1,03 MB, 273 KB gzip) yang hanya dimuat bersama peta. JS awal halaman `/` 387 → 355 KB gzip: konstanta enum dipindah ke `types/constants.ts` (tanpa zod) sehingga zod tidak lagi ikut ke client, dan id layer/pembaca `queryRenderedFeatures` dipindah ke `components/map/map-queries.ts` (tanpa impor runtime MapLibre) supaya halaman tidak menarik react-map-gl. Chunk client diperiksa tidak memuat data mock (slug, id kotak, isi file JSON).
- *P4 – UI yang tidak membebani peta.* `glass-panel` tidak lagi memakai `backdrop-filter` (blur memaksa browser mengomposit ulang panel di setiap frame saat peta WebGL di bawahnya bergerak); latar dibuat hampir pekat (`--glass` 94% terang, 93% gelap) agar teks tetap kontras. Header situs tetap memakai blur karena tidak berada di atas peta.
- Posisi peta tidak disimpan di state React selama bergerak; satu-satunya state viewport diperbarui saat peta berhenti (`moveend` + 300 ms) dan dipakai untuk kartu ringkasan, jumlah di legenda, area grid, dan **URL**: posisi ditulis sebagai `?peta=zoom/lat/lon` (seperti `map=` OpenStreetMap) setelah pengguna menggeser, dan dibaca sekali saat halaman dibuka (mengalahkan terbang ke `?wilayah=`). Filter di `useMapFilters` hanya berganti identitas bila filternya berubah, bukan bila `peta` di URL berubah.
- `DashboardMap`, legenda (panel & drawer), kartu ringkasan, peringkat, panel filter, timeline, kontrol peta, panel detail, dan pil status di-`memo`; props-nya distabilkan (`useCallback`/`useMemo`, ringkasan dan isi detail dihitung dalam satu `useMemo`, pil status dibandingkan per isi). Saat peta berhenti, hanya komponen yang datanya berubah yang dirender ulang.
- Motion hanya untuk panel dan elemen UI. Lapisan peta tidak dianimasikan: ganti hari (termasuk play) = feature-state langsung. `prefers-reduced-motion`: `MotionConfig reducedMotion="user"` dan aturan CSS tetap, kamera peta (`fitBounds`/`easeTo`/zoom tombol) berdurasi 0, dan `fadeDuration` label MapLibre 0.
