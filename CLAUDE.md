# SiAPI Frontend – Konteks Proyek

## Tentang Proyek

SiAPI (Sistem Analisis & Prediksi Karhutla) adalah dashboard web untuk memantau dan memprediksi kebakaran hutan dan lahan (karhutla) di **seluruh Indonesia** (34 provinsi, 514 kabupaten/kota; batas dari geoBoundaries, lihat `pnpm geo:build`). Repo ini hanya berisi **frontend**. Data dihasilkan oleh pipeline Python terpisah (repo `siapi-pipeline`) yang menyimpan hasilnya ke Supabase (PostgreSQL + PostGIS).

Selama pipeline belum siap, frontend memakai **data mock**. Semua akses data harus lewat satu lapisan data (`lib/data/`) supaya nanti cukup mengganti implementasinya ke Supabase tanpa mengubah komponen.

Rencana kerja lengkap ada di `PLAN.md`. Kerjakan **satu fase per sesi**, kecuali diminta lain.

## Tech Stack

- Next.js 16 (App Router, `cacheComponents`) + React 19 + TypeScript (strict mode)
- Tailwind CSS v4 (konfigurasi berbasis CSS di `app/globals.css`, tanpa `tailwind.config`) + `tw-animate-css`
- shadcn/ui gaya `new-york` di atas Radix (`radix-ui`), komponen di `components/ui/` (lihat `components.json`). Tambah komponen dengan `pnpm dlx shadcn@latest add <nama>`, lalu cek impor `cn` mengarah ke `@/lib/utils` dan sesuaikan ukuran/fokus seperti komponen lain.
- react-leaflet v5 + Leaflet, basemap tile standar OpenStreetMap yang diredam dengan filter CSS pada pane tile (terang: saturasi turun, gelap: invert); supercluster (kelompok hotspot, di server); mapshaper (dev, `pnpm geo:build`)
- Recharts lewat komponen Chart shadcn untuk grafik
- motion (`motion/react`) untuk animasi, sonner untuk toast, next-themes untuk tema, lucide-react untuk ikon, cmdk (command palette), vaul (drawer)
- Font Geist Sans & Geist Mono (`next/font/google`)
- zod untuk validasi data dan query params
- date-fns untuk tanggal (locale `id`)
- @supabase/supabase-js (sumber data `DATA_SOURCE=supabase`)
- Package manager: pnpm

## Aturan Penting

- **Leaflet hanya boleh jalan di client.** Komponen peta wajib `"use client"` dan di-load dengan `dynamic(() => import(...), { ssr: false })`. Import `leaflet/dist/leaflet.css` di komponen peta. Perbaiki masalah ikon marker default Leaflet yang hilang di bundler.
- **Komponen tidak boleh mengambil data langsung dari mock atau Supabase.** Client component memanggil route handler di `app/api/*`; server component memanggil fungsi dari `lib/data/`.
- **Kredensial tidak boleh sampai ke browser.** Variabel Supabase tanpa prefix `NEXT_PUBLIC_`, dan file di `lib/data/` diberi `import "server-only"`.
- Semua data peta memakai **GeoJSON FeatureCollection** dengan koordinat EPSG:4326 (`[longitude, latitude]`).
- Untuk titik dalam jumlah banyak, pakai `circleMarker` dan `preferCanvas`, bukan marker ikon.
- **Peta nasional bertingkat:** zoom < 7 choropleth provinsi + kelompok hotspot berangka, 7–8 choropleth kabupaten/kota, ≥ 9 grid risiko 5 km + semua hotspot. Jangan memuat grid risiko atau hotspot mentah seluruh Indonesia sekaligus: selalu persempit dengan `bbox`/`provinsi`/`kabupaten`, atau pakai ringkasan `/api/stats/regions` dan `/api/hotspots/groups`.
- Setiap hotspot, zona, dan kotak grid membawa `provinsi` dan `kabupaten` (slug). Slug unik secara nasional (kota berawalan `kota-`). Tautan halaman wilayah selalu lewat `regionHref()` (`/wilayah/[provinsi]` atau `/wilayah/[provinsi]/[kabupaten]`).
- File yang ikut dirender di server (mis. legenda) tidak boleh mengimpor modul yang mengimpor `leaflet`; konstanta gaya peta bersama ada di `components/map/styles.ts`.
- Teks antarmuka dalam **Bahasa Indonesia**. Nama variabel, fungsi, dan komentar kode dalam bahasa Inggris. Nama field data mengikuti skema database (snake_case Bahasa Indonesia, lihat `types/`).
- Warna level risiko jangan jadi satu-satunya penanda; selalu sertakan label teks.
- Dukung light dan dark mode.
- Format tanggal untuk pengguna: `19 Okt 2026`. Format tanggal di API dan data: ISO `YYYY-MM-DD`.

## Desain

- **Gaya:** minimalis, map-first, ruang kosong lega, terasa seperti dashboard SaaS modern. Halaman peta memenuhi area di bawah header; semua kontrol melayang di atas peta sebagai `glass-panel` (latar semi-transparan + `backdrop-blur`).
- **Token:** semua warna adalah CSS variables di `app/globals.css` (`:root` dan `.dark`) dengan nama shadcn (`background`, `card`, `muted-foreground`, `primary`, `border`, `ring`, …). Jangan menulis hex langsung di komponen; pakai kelas token (`bg-card`, `text-muted-foreground`). Pengecualian: lapisan Leaflet yang butuh string warna (lihat `lib/risk.ts` dan file layer peta), yang harus disamakan dengan token.
- **Warna:** netral skala zinc. Satu aksen **ember #E8590C**: `bg-ember`/`text-ember` untuk isian dan ikon, `text-ember-ink` untuk teks (lolos 4,5:1), `bg-ember-soft` untuk latar sorotan. `accent` shadcn tetap berarti latar hover netral. Aksi utama: `primary` (hampir hitam di terang, hampir putih di gelap).
- **Skala risiko:** rendah (transparan di peta, chip netral), sedang #FACC15, tinggi #F97316, sangat tinggi #B91C1C (#DC2626 di mode gelap). Selalu dengan label teks (`RiskBadge`, `RiskSwatch`). Di zoom jauh warna adalah rata-rata skor per provinsi/kabupaten. Lapisan data dibuat transparan (choropleth 42%, grid 55%) agar label basemap tetap terbaca.
- **Legenda:** satu `LegendContent` (panel melayang di desktop, Drawer di mobile) mengikuti lapisan aktif dan zoom, menampilkan jumlah objek di layar, dan hover item menyorot objek terkait di peta. Zona kebakaran dibedakan dengan gaya garis per status (`ZONE_STYLES`), bukan warna.
- **Grafik:** seri tunggal = ember; perbandingan tahun = ember / teal / biru (dua tahun lalu bergaris putus). Palet baru wajib divalidasi (skill dataviz) untuk terang dan gelap. Setiap grafik punya tabel data (`ChartTable`).
- **Tipografi:** Geist Sans untuk teks; Geist Mono (`font-mono`) untuk angka, skor, kode grid, dan sumbu grafik.
- **Bentuk:** radius kartu/panel 12–16 px (`rounded-xl`/`rounded-2xl`), border tipis, bayangan halus (`shadow-xs`, `shadow-[var(--shadow-panel)]`).
- **Tema:** next-themes (`attribute="class"`, default `system`, kunci `siapi-theme`). Komponen client yang butuh nama tema memakai `useResolvedTheme()` dari `components/ui/theme.tsx`. Mode gelap punya nilai token sendiri, bukan inversi.
- **Animasi:** hanya untuk memperjelas perubahan, 150–300 ms (`motion`; tween peta di `components/map/animate.ts`). `MotionConfig reducedMotion="user"` dan aturan CSS `prefers-reduced-motion` mematikan gerakan; tween peta langsung ke akhir.
- **Aksesibilitas:** kontras teks ≥ 4,5:1 (elemen UI ≥ 3:1), fokus keyboard selalu terlihat (`ring`), tombol ikon wajib `aria-label`, target sentuh ≥ 44 px di perangkat sentuh (`pointer-coarse:`). Cek dengan axe sebelum menyatakan perubahan UI selesai.
- **Responsif:** uji di 360, 768, 1024, 1440 px tanpa scroll horizontal. Peta: tata letak desktop mulai `lg` (1024 px); di bawahnya kontrol pindah ke Drawer dan detail ke Drawer bawah.
- **State:** loading = `Skeleton` berbentuk konten asli; kosong = `EmptyState`; error = `ErrorState` atau pil `MapStatus` dengan tombol "Coba lagi" (`components/ui/state.tsx`).
- **Komponen berat** (peta, grafik Recharts) di-load dengan `next/dynamic` + skeleton seukuran (lihat `components/charts/lazy.tsx`).
- `/dev/ui` menampilkan semua token dan komponen; hanya tersedia saat `pnpm dev` (404 di produksi).

## Perintah

- `pnpm dev` – server pengembangan
- `pnpm lint` – ESLint
- `pnpm typecheck` – `tsc --noEmit`
- `pnpm build` – build produksi
- `pnpm geo:build` – unduh batas wilayah geoBoundaries ke `data-raw/` (tidak di-commit) dan sederhanakan ke `mock/provinsi.geojson`, `mock/kabupaten.geojson`, `mock/provinsi-garis.geojson`
- `pnpm mock:generate` – generate ulang data mock nasional (butuh hasil `geo:build`)

Sebelum menyatakan satu fase selesai, jalankan `pnpm lint`, `pnpm typecheck`, dan `pnpm build` sampai lolos semua, lalu cek kriteria selesai fase tersebut di `PLAN.md`.

## Struktur Folder

```
app/
  page.tsx                 # peta utama
  statistik/page.tsx
  wilayah/page.tsx         # indeks provinsi + kabupaten/kota paling rawan
  wilayah/[provinsi]/page.tsx
  wilayah/[provinsi]/[kabupaten]/page.tsx
  tentang/page.tsx
  dev/ui/                  # katalog token & komponen (hanya dev)
  api/                     # route handlers
components/
  map/  charts/  filters/  panels/
  ui/                      # shadcn/ui + komponen dasar proyek
  providers.tsx            # tema, tooltip, toast, motion
lib/
  data/                    # lapisan data (mock & supabase) + kelompok hotspot (supercluster)
  mock-model.ts            # model risiko mock (dipakai generator & lib/data/mock.ts)
  risk.ts                  # util level & warna risiko
  format.ts                # util format tanggal & angka
  utils.ts                 # cn()
types/
mock/                      # file JSON/GeoJSON data mock + batas wilayah hasil geo:build
scripts/generate-mock.ts
scripts/build-geo.ts       # batas wilayah (mapshaper)
docs/supabase-rpc.md       # kontrak RPC/tabel Supabase
```
    