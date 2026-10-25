# Kontrak Data Supabase untuk Frontend Suar

Dokumen ini menjelaskan objek database yang dibaca `lib/data/supabase.ts` saat `DATA_SOURCE=supabase`. Pipeline
(`suar-pipeline`) bertanggung jawab membuat tabel, view, dan fungsi di bawah ini. Frontend hanya **membaca** data
dengan anon key, jadi semua objek harus bisa dibaca role `anon` (aktifkan RLS dengan policy `select` saja).

Cakupan data adalah **seluruh Indonesia**: 34 provinsi dan 514 kabupaten/kota (batas dari geoBoundaries, lihat
`pnpm geo:build` dan `README.md`). Data hotspot NASA FIRMS diambil untuk semua wilayah.

Semua respons divalidasi dengan skema zod di `types/index.ts`, skema yang sama dengan data mock. Kalau bentuknya
berbeda, frontend melempar error `Respons … tidak sesuai skema` dan route handler membalas HTTP 500.

## Aturan umum

| Hal | Aturan |
| --- | --- |
| Koordinat | EPSG:4326, urutan `[longitude, latitude]`, dibulatkan 4–5 desimal (`ST_AsGeoJSON(geom, 5)`). |
| GeoJSON | Fungsi spasial mengembalikan **satu** nilai `jsonb` berupa `FeatureCollection`. Koleksi kosong tetap `{"type":"FeatureCollection","features":[]}`, bukan `null`. |
| Tanggal | `date` dikirim sebagai string `YYYY-MM-DD`. Bulan sebagai `YYYY-MM`. |
| Waktu | Datetime dikirim sebagai string ISO dengan offset WIB, contoh `2026-10-20T13:24:00+07:00`, **untuk seluruh Indonesia** (termasuk wilayah WITA/WIT). UI menampilkan jam apa adanya dengan label "WIB", jadi **jangan** kirim UTC (`Z`/`+00:00`). Gunakan `to_char(ts AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"')`. Tanggal hotspot = tanggal WIB. |
| Angka | Pakai `double precision`/`integer`, bukan `numeric`, supaya PostgREST mengirim angka JSON. |
| Nama field | Sama persis dengan `types/index.ts` (snake_case Bahasa Indonesia). |
| Wilayah | `provinsi` dan `kabupaten` selalu berisi **slug**, misalnya `riau` dan `indragiri-hilir`. Slug unik secara nasional: kota diberi awalan `kota-` (`kota-pekanbaru`), kabupaten yang namanya sama dengan provinsi diberi awalan `kabupaten-` (`kabupaten-gorontalo`). Gunakan slug dari `mock/provinsi.geojson` dan `mock/kabupaten.geojson`. |
| Filter area | Fungsi spasial menerima `min_lon, min_lat, max_lon, max_lat` (boleh `null` semua = tanpa filter bbox, filter `geom && ST_MakeEnvelope(…, 4326)`), `provinsi_slug` dan `kabupaten_slug` (boleh `null`). Semua filter yang terisi digabung dengan AND. |

Setiap hotspot, zona, dan kotak grid **wajib** membawa `provinsi` dan `kabupaten` (slug), diisi pipeline dengan
`ST_Intersects`/`ST_Contains` terhadap batas kabupaten/kota.

## Fungsi RPC

Dipanggil lewat `supabase.rpc(nama, argumen)`. Nama argumen harus sama persis.

### `get_hotspots`

```sql
get_hotspots(
  start_date date,          -- inklusif (tanggal WIB)
  end_date date,            -- inklusif, rentang maksimal 31 hari (divalidasi di frontend)
  min_confidence text,      -- 'low' | 'nominal' | 'high'; urutan low < nominal < high
  min_lon double precision, min_lat double precision,
  max_lon double precision, max_lat double precision,
  provinsi_slug text,
  kabupaten_slug text
) returns jsonb             -- FeatureCollection<Point, HotspotProps>
```

`properties`: `id`, `waktu_deteksi`, `satelit` (`VIIRS_SNPP` | `VIIRS_NOAA20` | `MODIS`), `confidence`
(`low` | `nominal` | `high`), `frp` (MW), `provinsi`, `kabupaten`.

Contoh implementasi:

```sql
create or replace function get_hotspots(
  start_date date, end_date date, min_confidence text,
  min_lon double precision default null, min_lat double precision default null,
  max_lon double precision default null, max_lat double precision default null,
  provinsi_slug text default null, kabupaten_slug text default null
) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(h.geom, 4)::jsonb,
      'properties', jsonb_build_object(
        'id', h.id,
        'waktu_deteksi', to_char(h.waktu_deteksi at time zone 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"'),
        'satelit', h.satelit,
        'confidence', h.confidence,
        'frp', h.frp,
        'provinsi', h.provinsi,
        'kabupaten', h.kabupaten
      )
    ) order by h.waktu_deteksi), '[]'::jsonb)
  )
  from hotspots h
  where (h.waktu_deteksi at time zone 'Asia/Jakarta')::date between start_date and end_date
    and array_position(array['low','nominal','high'], h.confidence)
        >= array_position(array['low','nominal','high'], min_confidence)
    and (min_lon is null or h.geom && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326))
    and (provinsi_slug is null or h.provinsi = provinsi_slug)
    and (kabupaten_slug is null or h.kabupaten = kabupaten_slug);
$$;
```

Satu hari puncak musim kebakaran bisa berisi beberapa ribu hotspot nasional, jadi buat indeks pada
`(waktu_deteksi)`, `geom` (GiST), `provinsi`, dan `kabupaten`.

`GET /api/hotspots` hanya meneruskan `id`, `confidence`, `frp`, dan koordinat (4 desimal) ke browser; field lain
diambil lewat `get_hotspot` saat titik diklik.

**Kelompok hotspot** (angka cluster di zoom jauh) dihitung di browser oleh MapLibre (source GeoJSON dengan
`cluster: true`) dari hasil `get_hotspots` **tanpa** bbox untuk rentang dan tingkat kepercayaan terpilih, jadi tidak
butuh fungsi database tersendiri. Endpoint `/api/hotspots/groups` sudah dihapus.

### `get_hotspot`

```sql
get_hotspot(hotspot_id text) returns jsonb  -- Feature<Point, HotspotProps> atau null
```

Satu hotspot lengkap (properti sama dengan `get_hotspots`) untuk panel detail, atau `null` jika id tidak ada.

### `get_clusters`

```sql
get_clusters(
  target_date date,
  min_lon double precision, min_lat double precision,
  max_lon double precision, max_lat double precision,
  provinsi_slug text,
  kabupaten_slug text
) returns jsonb  -- FeatureCollection<Polygon, ClusterProps>
```

`properties`: `id`, `tanggal`, `jumlah_hotspot`, `luas_km2`, `status` (`baru` | `meluas` | `stabil` | `menyusut`),
`aktif_sejak`, `provinsi`, `kabupaten` (wilayah dengan hotspot terbanyak di zona itu). Hanya zona hasil DBSCAN untuk
`target_date`. Dengan bbox, zona yang **bersinggungan** dengan bbox ikut dikembalikan.

### `get_risk_grid`

```sql
get_risk_grid(
  min_lon double precision, min_lat double precision,
  max_lon double precision, max_lat double precision,
  provinsi_slug text,
  kabupaten_slug text
) returns jsonb  -- RiskGrid (tabel ringkas, bukan GeoJSON)
```

Grid 5 km suatu area dengan skor **semua hari prediksi** dari prediksi terbaru, dalam bentuk tabel ringkas. Peta
membangun poligon kotak di browser (kotak cukup ditentukan sudut barat daya dan ukurannya) dan berganti hari tanpa
permintaan baru — hanya nilai feature-state yang berubah.

```json
{
  "tanggal_prediksi": "2026-10-20",
  "tanggal_target": ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"],
  "ukuran_sel": 0.045,
  "kabupaten": ["siak", "pelalawan"],
  "sel": [
    ["R123-C0456", 101.52, 0.435, 1, 0, 523, 540, 561, 580, 602, 610, 630]
  ]
}
```

- `ukuran_sel` = panjang sisi kotak dalam derajat.
- `kabupaten` = slug kabupaten/kota yang dirujuk kotak (indeks berbasis 0).
- Setiap elemen `sel`: `[cell_id, min_lon, min_lat, is_gambut (0|1), indeks kabupaten, skor×1000 untuk setiap
  tanggal di tanggal_target]` — skor dibulatkan ke bilangan bulat 0–1000, koordinat 4–5 desimal.
- Dengan bbox, kotak yang **bersinggungan** dengan bbox ikut dikembalikan.

Grid nasional berisi ±76.000 kotak, jadi frontend **selalu** mengirim salah satu filter: bbox (maksimal 40 derajat
persegi, dipakai peta saat zoom ≥ 8), `provinsi_slug`, atau `kabupaten_slug` (peta halaman kabupaten). Pada zoom
lebih jauh peta memakai rata-rata per wilayah dari `get_region_stats`.

### `get_risk_cell`

```sql
get_risk_cell(cell_id text, target_date date) returns jsonb  -- Feature<Polygon, RiskCellProps> atau null
```

Satu kotak lengkap untuk panel detail (dipanggil saat kotak diklik). `properties`: `cell_id`, `tanggal_prediksi`,
`tanggal_target`, `skor_risiko` (0–1), `level_risiko` (`rendah` < 0,25 ≤ `sedang` < 0,5 ≤ `tinggi` < 0,75 ≤
`sangat_tinggi`), `is_gambut`, `faktor` (array 3 objek `{ fitur, label, kontribusi }`, diurutkan dari nilai SHAP
absolut terbesar), `provinsi`, `kabupaten`. Kembalikan `null` jika kotak tidak ada atau belum punya prediksi untuk
`target_date`.

### `get_region_boundaries`

```sql
get_region_boundaries(boundary_level text, provinsi_slug text) returns jsonb
-- FeatureCollection<Polygon | MultiPolygon, RegionBoundaryProps>
```

- `boundary_level = 'provinsi'`: 34 provinsi. `provinsi_slug` diabaikan.
- `boundary_level = 'kabupaten'`: kabupaten **dan** kota; dengan `provinsi_slug`, hanya yang berada di provinsi itu.

`properties`: `id` (kode BPS provinsi, atau kode kabupaten/kota), `slug`, `nama` (tanpa awalan "Kota"/"Kabupaten"),
`level` (`provinsi` | `kabupaten` | `kota`), `provinsi` (slug provinsi induk; `null` untuk provinsi), `label`
(`[lon, lat]` titik di dalam poligon untuk label, `ST_PointOnSurface`), `bbox` (`[minLon, minLat, maxLon, maxLat]`).

Saat ini frontend hanya memakai `properties` fungsi ini (daftar wilayah dan bbox untuk pencarian, `/api/regions/list`).
**Peta di browser menggambar batas wilayah dari file statis** `public/geo/*.json` hasil `pnpm geo:build` (geoBoundaries,
disederhanakan: provinsi < 250 KB, kabupaten/kota < 1,5 MB), bukan dari Supabase, supaya file itu di-cache browser dan
dimuat langsung oleh worker MapLibre. Karena itu slug wilayah di database **wajib** sama dengan slug di file tersebut.

### `get_region_detail`

```sql
get_region_detail(region_slug text) returns jsonb  -- RegionDetail atau null
```

```json
{
  "id": "14", "slug": "riau", "nama": "Riau", "level": "provinsi", "provinsi": null, "nama_provinsi": null,
  "bbox": [100.03, -1.12, 103.82, 2.92],
  "pusat": [101.8, 0.5],
  "luas_km2": 89150,
  "persen_gambut": 41.2,
  "jumlah_sel": 3550,
  "jumlah_kabupaten": 12
}
```

Berlaku untuk provinsi maupun kabupaten/kota. `bbox` = `[minLon, minLat, maxLon, maxLat]`, `pusat` = titik di dalam
wilayah (`ST_PointOnSurface`), `persen_gambut` 0–100 dari kotak grid bergambut, `jumlah_sel` = kotak grid di wilayah
itu, `jumlah_kabupaten` = jumlah kabupaten/kota di provinsi (0 untuk kabupaten/kota), `nama_provinsi` = nama provinsi
induk (`null` untuk provinsi). Kembalikan `null` jika slug tidak ada (frontend lalu menampilkan 404).

### `get_monthly_trend`

```sql
get_monthly_trend(start_month text, end_month text, region_slug text) returns jsonb
-- [{ "bulan": "2026-01", "jumlah_hotspot": 97 }, ...]
```

Satu elemen untuk **setiap** bulan dari `start_month` sampai `end_month` (inklusif, urut naik), termasuk bulan tanpa
hotspot (`0`). `region_slug` boleh slug provinsi atau kabupaten/kota; `null` berarti seluruh Indonesia. Gunakan
`generate_series` lalu `left join`.

### `get_region_stats`

```sql
get_region_stats(
  target_date date,
  start_date date,
  end_date date,
  boundary_level text,      -- 'provinsi' | 'kabupaten'
  provinsi_slug text,       -- hanya untuk boundary_level = 'kabupaten'; null = semua
  min_confidence text       -- 'low' | 'nominal' | 'high', hotspot yang dihitung
) returns jsonb
-- [{ "slug": "pelalawan", "nama": "Pelalawan", "level": "kabupaten", "provinsi": "riau",
--    "jumlah_hotspot": 537, "rata_skor_risiko": 0.41, "maks_skor_risiko": 0.93, "jumlah_sel": 520 }, ...]
```

Ringkasan agregat untuk choropleth, peringkat, dan kartu ringkasan. Satu elemen per provinsi (34) atau per
kabupaten/kota (514, atau yang ada di `provinsi_slug`), **termasuk** wilayah tanpa hotspot atau tanpa prediksi.

- `jumlah_hotspot` = hotspot dari `start_date` sampai `end_date` dengan kepercayaan ≥ `min_confidence`; jika
  tanggalnya `null`, pakai 30 hari terakhir sampai tanggal data terbaru.
- `rata_skor_risiko` dan `maks_skor_risiko` = rata-rata dan maksimum `skor_risiko` semua kotak wilayah itu untuk
  `target_date` (0 jika belum ada prediksi). `jumlah_sel` = jumlah kotak yang punya prediksi (dipakai sebagai bobot
  rata-rata nasional).
- Urutkan menurun berdasarkan `rata_skor_risiko`.

Karena dipanggil untuk setiap hari prediksi dan setiap perubahan filter, sebaiknya dihitung dari tabel ringkasan
harian per kabupaten (materialized view) dan dijumlahkan ke provinsi.

## Tabel dan view

Dibaca langsung dengan `supabase.from(...)`.

| Objek | Kolom yang dibaca | Catatan |
| --- | --- | --- |
| `regions` (tabel) | `id`, `slug`, `nama`, `level`, `provinsi` | Semua provinsi, kabupaten, dan kota. `provinsi` = slug induk (`null` untuk provinsi). Frontend mengurutkan berdasarkan `nama`. |
| `weather_latest` (view) | `slug`, `nama`, `level`, `provinsi`, `tanggal`, `suhu_c`, `kelembapan_persen`, `curah_hujan_mm`, `kecepatan_angin_kmh`, `hari_tanpa_hujan` | Satu baris per kabupaten/kota (snapshot cuaca terbaru) **ditambah** satu baris per provinsi berisi rata-rata kabupaten/kotanya (`hari_tanpa_hujan` dibulatkan ke bilangan bulat). Daftar cuaca memfilter `level <> 'provinsi'`. |
| `data_status` (view) | `terakhir_diperbarui`, `tanggal_data`, `prediksi_mulai`, `prediksi_sampai` | Tepat satu baris. `terakhir_diperbarui` = waktu pipeline terakhir selesai (format WIB seperti di atas); `tanggal_data` = tanggal hotspot/cuaca terbaru; `prediksi_mulai`/`prediksi_sampai` = rentang `tanggal_target` prediksi terbaru. Frontend menambahkan `sumber: "supabase"`. |

## Hak akses

```sql
grant usage on schema public to anon;
grant select on regions, weather_latest, data_status to anon;
grant execute on function get_hotspots, get_hotspot, get_clusters, get_risk_grid, get_risk_cell,
  get_region_boundaries, get_region_detail, get_monthly_trend, get_region_stats to anon;
```

Fungsi sebaiknya `stable` dan `security invoker`, supaya RLS pada tabel sumber tetap berlaku.
