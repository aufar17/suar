# SiAPI Frontend – Konteks Proyek

## Tentang Proyek

SiAPI (Sistem Analisis & Prediksi Karhutla) adalah dashboard web untuk memantau dan memprediksi kebakaran hutan dan lahan (karhutla) di **Provinsi Riau**. Repo ini hanya berisi **frontend**. Data dihasilkan oleh pipeline Python terpisah (repo `siapi-pipeline`) yang menyimpan hasilnya ke Supabase (PostgreSQL + PostGIS).

Selama pipeline belum siap, frontend memakai **data mock**. Semua akses data harus lewat satu lapisan data (`lib/data/`) supaya nanti cukup mengganti implementasinya ke Supabase tanpa mengubah komponen.

Rencana kerja lengkap ada di `PLAN.md`. Kerjakan **satu fase per sesi**, kecuali diminta lain.

## Tech Stack

- Next.js (App Router) + TypeScript (strict mode)
- Tailwind CSS
- react-leaflet + Leaflet, tile OpenStreetMap
  - Next.js 15 / React 19 → react-leaflet v5
  - Next.js 14 / React 18 → react-leaflet v4
- Recharts untuk grafik
- zod untuk validasi data dan query params
- date-fns untuk tanggal (locale `id`)
- @supabase/supabase-js (baru dipakai di Fase 10)
- Package manager: pnpm

## Aturan Penting

- **Leaflet hanya boleh jalan di client.** Komponen peta wajib `"use client"` dan di-load dengan `dynamic(() => import(...), { ssr: false })`. Import `leaflet/dist/leaflet.css` di komponen peta. Perbaiki masalah ikon marker default Leaflet yang hilang di bundler.
- **Komponen tidak boleh mengambil data langsung dari mock atau Supabase.** Client component memanggil route handler di `app/api/*`; server component memanggil fungsi dari `lib/data/`.
- **Kredensial tidak boleh sampai ke browser.** Variabel Supabase tanpa prefix `NEXT_PUBLIC_`, dan file di `lib/data/` diberi `import "server-only"`.
- Semua data peta memakai **GeoJSON FeatureCollection** dengan koordinat EPSG:4326 (`[longitude, latitude]`).
- Untuk titik dalam jumlah banyak, pakai `circleMarker` dan `preferCanvas`, bukan marker ikon.
- Teks antarmuka dalam **Bahasa Indonesia**. Nama variabel, fungsi, dan komentar kode dalam bahasa Inggris. Nama field data mengikuti skema database (snake_case Bahasa Indonesia, lihat `types/`).
- Warna level risiko jangan jadi satu-satunya penanda; selalu sertakan label teks.
- Dukung light dan dark mode.
- Format tanggal untuk pengguna: `19 Okt 2026`. Format tanggal di API dan data: ISO `YYYY-MM-DD`.

## Perintah

- `pnpm dev` – server pengembangan
- `pnpm lint` – ESLint
- `pnpm typecheck` – `tsc --noEmit`
- `pnpm build` – build produksi
- `pnpm mock:generate` – generate ulang data mock

Sebelum menyatakan satu fase selesai, jalankan `pnpm lint`, `pnpm typecheck`, dan `pnpm build` sampai lolos semua, lalu cek kriteria selesai fase tersebut di `PLAN.md`.

## Struktur Folder

```
app/
  page.tsx                 # peta utama
  statistik/page.tsx
  wilayah/[slug]/page.tsx
  tentang/page.tsx
  api/                     # route handlers
components/
  map/  charts/  filters/  panels/  ui/
lib/
  data/                    # lapisan data (mock & supabase)
  risk.ts                  # util level & warna risiko
  format.ts                # util format tanggal & angka
types/
mock/                      # file JSON/GeoJSON data mock
scripts/generate-mock.ts
```
    