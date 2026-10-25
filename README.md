# Suar – Frontend

Dashboard web untuk memantau hotspot dan memprediksi risiko kebakaran hutan dan lahan (karhutla) di seluruh Indonesia
(34 provinsi, 514 kabupaten/kota).
Repo ini hanya berisi frontend. Data dihasilkan pipeline Python terpisah (`suar-pipeline`) dan disimpan di Supabase
(PostgreSQL + PostGIS). Selama pipeline belum siap, aplikasi memakai data mock dari folder `mock/`.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript strict · Tailwind CSS 4 ·
MapLibre GL JS 5 + react-map-gl 8 · Recharts 3 · zod 4 · date-fns · @supabase/supabase-js.

## Menjalankan

Butuh Node.js 20.9+ dan pnpm.

```bash
pnpm install
cp .env.example .env.local   # opsional; default sudah DATA_SOURCE=mock
pnpm dev                     # http://localhost:3000
```

| Perintah | Fungsi |
| --- | --- |
| `pnpm dev` | Server pengembangan |
| `pnpm build` / `pnpm start` | Build dan jalankan versi produksi |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate tipe route lalu `tsc --noEmit` |
| `pnpm mock:generate` | Membuat ulang data mock di `mock/` |
| `pnpm geo:build` | Mengunduh dan menyederhanakan batas wilayah Indonesia ke `mock/` |

### Batas wilayah

`pnpm geo:build` mengunduh batas administrasi Indonesia dari [geoBoundaries](https://www.geoboundaries.org/)
(rilis gbOpen IDN, versi *simplified*) ke `data-raw/` (tidak di-commit), lalu memprosesnya dengan mapshaper:

- `mock/kabupaten.geojson` – 514 kabupaten/kota (< 2,5 MB), topologi bersih tanpa celah/tumpang tindih.
- `mock/provinsi.geojson` – 34 provinsi (< 400 KB), hasil *dissolve* kabupaten/kota sehingga kedua level selalu pas.
- `mock/provinsi-garis.geojson` – garis batas antarprovinsi dari topologi kabupaten (dipakai saat zoom dekat).

Setiap fitur punya `id`, `slug`, `nama`, `level`, `provinsi` (slug induk), `label` (titik di dalam poligon), dan `bbox`.

Atribusi: geoBoundaries (Runfola dkk., 2020, *PLoS ONE* 15(4): e0231866). Batas provinsi (ADM1) bersumber dari
OpenStreetMap / Wambacher – © kontributor OpenStreetMap, lisensi ODbL 1.0. Batas kabupaten/kota (ADM2) bersumber dari
BPS, World Food Programme, dan OCHA ROAP – lisensi CC BY 3.0 IGO.

### Data mock

`pnpm mock:generate` membuat data yang deterministik (seed tetap) dengan tanggal data terakhir `2026-10-20`.
Untuk menggeser tanggalnya:

```bash
MOCK_END_DATE=2026-11-05 pnpm mock:generate
```

Generator memakai batas wilayah asli dari `pnpm geo:build` (jalankan sekali dulu). Isinya untuk seluruh Indonesia:
±76.000 kotak grid 5 km di daratan (±9% gambut, terkonsentrasi di Riau, Jambi, Sumatera Selatan, Kalimantan, dan Papua
bagian selatan), ±190.000 hotspot 24 bulan yang semuanya jatuh di daratan (terbanyak di provinsi rawan, puncak
Juli–Oktober), zona kebakaran hari terakhir, prediksi risiko 7 hari untuk setiap kotak, dan cuaca terbaru per
kabupaten/kota. Total ±13 MB. Data besar disimpan ringkas (lihat `types/mock.ts`) dan diubah ke GeoJSON oleh
`lib/data/mock.ts`; faktor SHAP setiap kotak dihitung ulang dari input model mock (`lib/mock-model.ts`).

## Variabel lingkungan

| Nama | Wajib | Keterangan |
| --- | --- | --- |
| `DATA_SOURCE` | tidak | `mock` (default) atau `supabase`. |
| `SUPABASE_URL` | jika `supabase` | URL proyek Supabase. |
| `SUPABASE_ANON_KEY` | jika `supabase` | Anon key. Hanya dibaca di server. |
| `SITE_URL` | tidak | URL publik untuk metadata Open Graph. Di Vercel otomatis memakai domain produksi. |
| `NEXT_PUBLIC_MAP_STYLE_LIGHT`, `NEXT_PUBLIC_MAP_STYLE_DARK` | tidak | URL style MapLibre untuk peta dasar mode terang/gelap. Default OpenFreeMap `positron`/`dark` (tanpa API key). Dibaca di browser, jadi hanya untuk key publik penyedia peta. |

Variabel Supabase sengaja **tanpa** prefix `NEXT_PUBLIC_`, dan semua file di `lib/data/` memakai
`import "server-only"`, sehingga kredensial tidak pernah sampai ke browser.

## Beralih ke Supabase

1. Pastikan pipeline sudah membuat tabel, view, dan fungsi RPC sesuai [`docs/supabase-rpc.md`](docs/supabase-rpc.md).
2. Isi `.env.local` (atau Environment Variables di Vercel):

   ```bash
   DATA_SOURCE=supabase
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   ```

3. Jalankan ulang `pnpm dev` atau deploy ulang. Tidak ada komponen yang perlu diubah.

Respons Supabase divalidasi dengan skema zod yang sama dengan data mock. Jika bentuk data dari pipeline tidak cocok,
error menyebutkan field yang bermasalah.

## Arsitektur singkat

```
app/                 halaman (/, /statistik, /wilayah, /wilayah/[provinsi], /wilayah/[provinsi]/[kabupaten], /tentang)
                     dan route handler app/api/*
components/          map/ (MapLibre, hanya client), charts/, filters/, panels/, ui/
lib/data/            lapisan data: types.ts (interface DataSource), mock.ts, supabase.ts, index.ts (pemilih + cache)
lib/                 risk.ts (level & warna risiko), format.ts (angka & tanggal Indonesia), geo.ts, api.ts
types/               tipe TypeScript + skema zod untuk semua data
mock/                file data mock (server)
public/geo/          batas wilayah untuk peta di browser (hasil build-geo.ts)
scripts/             generate-mock.ts, build-geo.ts (batas wilayah)
docs/                kontrak RPC Supabase
```

- **Server component** memanggil fungsi dari `lib/data`. **Client component** memanggil route handler di `app/api/*`.
- Semua fungsi di `lib/data/index.ts` di-cache dengan `"use cache"` + `cacheLife("hours")`; respons API juga
  mengirim `Cache-Control: max-age=600, s-maxage=3600, stale-while-revalidate=86400`. Data pipeline berubah sekitar
  sekali sehari.
- Peta (MapLibre GL JS, WebGL) di-load dengan `dynamic(..., { ssr: false })`. Batas wilayah dan hotspot diberikan
  sebagai URL ke source GeoJSON sehingga diunduh dan di-parse oleh worker MapLibre; hotspot dikelompokkan oleh MapLibre
  (`cluster: true`); skor risiko per wilayah/kotak disimpan di feature-state sehingga ganti hari tidak memuat ulang
  geometri. Urutan lapisan dijaga slot di style (`components/map/basemap.ts`): wilayah → gambut → risiko → batas →
  fokus → zona → sorotan → hotspot → label → kelompok hotspot.
- Filter peta (rentang waktu, kepercayaan, lapisan, hari prediksi) dan posisi peta (`peta=zoom/lat/lon`, ditulis
  setelah peta berhenti bergerak) disimpan di URL agar tampilan bisa dibagikan.

### API

| Route | Parameter |
| --- | --- |
| `GET /api/hotspots` | `start`, `end` (`YYYY-MM-DD`, maks. 31 hari), `min_confidence`, `bbox`, `provinsi`, `kabupaten` – GeoJSON ringan untuk peta (`id`, `confidence`, `frp`, koordinat 4 desimal) |
| `GET /api/hotspots/[id]` | – satu hotspot lengkap (panel detail) |
| `GET /api/clusters` | `date`, `bbox`, `provinsi`, `kabupaten` |
| `GET /api/risk/grid` | salah satu dari `bbox` (maks. 40 derajat persegi), `provinsi`, `kabupaten` – grid 5 km ringkas berisi skor semua hari prediksi |
| `GET /api/risk/cell` | `cell_id`, `target_date` – satu kotak lengkap dengan faktor (panel detail) |
| `GET /api/regions/list` | – daftar semua wilayah + bbox (pencarian) |
| `GET /api/stats/trend` | `start`, `end` (`YYYY-MM`), `slug` (provinsi atau kabupaten/kota; kosong = Indonesia) |
| `GET /api/stats/regions` | `level` (`kabupaten` default, atau `provinsi`), `provinsi`, `date`, `start`, `end`, `min_confidence` – ringkasan per wilayah: jumlah hotspot, rata-rata dan maksimum skor risiko |
| `GET /api/weather` | `slug` atau `provinsi` (opsional) |
| `GET /api/status` | – |

`bbox` berformat `minLon,minLat,maxLon,maxLat`; `provinsi` dan `kabupaten` berisi slug. Parameter tidak valid
(termasuk slug yang tidak dikenal) menghasilkan HTTP 400 dengan pesan per parameter.

## Deploy ke Vercel

1. Push repo ke GitHub, lalu **Add New → Project** di Vercel dan impor repo. Framework terdeteksi otomatis
   sebagai Next.js; Vercel memakai pnpm karena ada `pnpm-lock.yaml`.
2. Di **Settings → Environment Variables**, isi `DATA_SOURCE` dan (bila memakai Supabase) `SUPABASE_URL`,
   `SUPABASE_ANON_KEY` untuk Production dan Preview.
3. Deploy. Folder `mock/` ikut ter-bundle ke fungsi server lewat `outputFileTracingIncludes` di `next.config.ts`,
   jadi mode mock juga berjalan di Vercel.
4. Setelah pipeline memperbarui data, cache kedaluwarsa paling lama ±1 jam. Untuk memaksa data baru segera tampil,
   lakukan redeploy.

## Catatan

- Peta dasar: tile vektor [OpenFreeMap](https://openfreemap.org) (style `positron` untuk mode terang, `dark` untuk
  mode gelap; data OpenStreetMap/OpenMapTiles), tanpa API key. Label nama tempat diatur ulang di
  `components/map/basemap.ts` (nama Indonesia, ambang zoom per jenis tempat, halo). Atribusi OpenFreeMap, OpenMapTiles,
  OpenStreetMap, Natural Earth, dan geoBoundaries tampil di pojok peta. Untuk penyedia lain (atau server tile sendiri),
  isi `NEXT_PUBLIC_MAP_STYLE_LIGHT` dan `NEXT_PUBLIC_MAP_STYLE_DARK` dengan URL style MapLibre lengkap (termasuk API
  key bila perlu).
- Setelah `pnpm geo:build`, naikkan `VERSION` di `components/map/geo-files.ts` agar browser tidak memakai file batas
  lama dari cache.
- Hotspot bukan kebakaran terkonfirmasi, dan prediksi risiko adalah keluaran model, bukan kepastian.
