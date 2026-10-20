# Kontrak Data Supabase untuk Frontend SiAPI

Dokumen ini menjelaskan objek database yang dibaca `lib/data/supabase.ts` saat `DATA_SOURCE=supabase`. Pipeline
(`siapi-pipeline`) bertanggung jawab membuat tabel, view, dan fungsi di bawah ini. Frontend hanya **membaca** data
dengan anon key, jadi semua objek harus bisa dibaca role `anon` (aktifkan RLS dengan policy `select` saja).

Semua respons divalidasi dengan skema zod di `types/index.ts`, skema yang sama dengan data mock. Kalau bentuknya
berbeda, frontend melempar error `Respons … tidak sesuai skema` dan route handler membalas HTTP 500.

## Aturan umum

| Hal | Aturan |
| --- | --- |
| Koordinat | EPSG:4326, urutan `[longitude, latitude]`, dibulatkan 4 desimal (`ST_AsGeoJSON(geom, 4)`). |
| GeoJSON | Fungsi spasial mengembalikan **satu** nilai `jsonb` berupa `FeatureCollection`. Koleksi kosong tetap `{"type":"FeatureCollection","features":[]}`, bukan `null`. |
| Tanggal | `date` dikirim sebagai string `YYYY-MM-DD`. Bulan sebagai `YYYY-MM`. |
| Waktu | Datetime dikirim sebagai string ISO dengan offset WIB, contoh `2026-10-20T13:24:00+07:00`. UI menampilkan jam apa adanya dengan label "WIB", jadi **jangan** kirim UTC (`Z`/`+00:00`). Gunakan `to_char(ts AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS"+07:00"')`. |
| Angka | Pakai `double precision`/`integer`, bukan `numeric`, supaya PostgREST mengirim angka JSON. |
| Nama field | Sama persis dengan `types/index.ts` (snake_case Bahasa Indonesia). |
| Wilayah | `kabupaten` selalu berisi **slug**, misalnya `indragiri-hilir`. |
| Bbox | Parameter `min_lon, min_lat, max_lon, max_lat` boleh `null` semua (artinya tanpa filter). Filter memakai `geom && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)`. |

## Fungsi RPC

Dipanggil lewat `supabase.rpc(nama, argumen)`. Nama argumen harus sama persis.

### `get_hotspots`

```sql
get_hotspots(
  start_date date,          -- inklusif (tanggal WIB)
  end_date date,            -- inklusif, rentang maksimal 31 hari (divalidasi di frontend)
  min_confidence text,      -- 'low' | 'nominal' | 'high'; urutan low < nominal < high
  min_lon double precision, min_lat double precision,
  max_lon double precision, max_lat double precision
) returns jsonb             -- FeatureCollection<Point, HotspotProps>
```

`properties`: `id`, `waktu_deteksi`, `satelit` (`VIIRS_SNPP` | `VIIRS_NOAA20` | `MODIS`), `confidence`
(`low` | `nominal` | `high`), `frp` (MW), `kabupaten` (slug).

Contoh implementasi:

```sql
create or replace function get_hotspots(
  start_date date, end_date date, min_confidence text,
  min_lon double precision default null, min_lat double precision default null,
  max_lon double precision default null, max_lat double precision default null
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
        'kabupaten', h.kabupaten
      )
    ) order by h.waktu_deteksi), '[]'::jsonb)
  )
  from hotspots h
  where (h.waktu_deteksi at time zone 'Asia/Jakarta')::date between start_date and end_date
    and array_position(array['low','nominal','high'], h.confidence)
        >= array_position(array['low','nominal','high'], min_confidence)
    and (min_lon is null or h.geom && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326));
$$;
```

### `get_clusters`

```sql
get_clusters(target_date date) returns jsonb  -- FeatureCollection<Polygon, ClusterProps>
```

`properties`: `id`, `tanggal`, `jumlah_hotspot`, `luas_km2`, `status` (`baru` | `meluas` | `stabil` | `menyusut`),
`aktif_sejak`, `kabupaten`. Hanya zona hasil DBSCAN untuk `target_date`.

### `get_risk_cells`

```sql
get_risk_cells(
  target_date date,
  min_lon double precision, min_lat double precision,
  max_lon double precision, max_lat double precision
) returns jsonb  -- FeatureCollection<Polygon, RiskCellProps>
```

Satu feature per kotak grid 5×5 km dari prediksi **terbaru** yang menargetkan `target_date`. `properties`: `cell_id`,
`tanggal_prediksi`, `tanggal_target`, `skor_risiko` (0–1), `level_risiko` (`rendah` < 0,25 ≤ `sedang` < 0,5 ≤
`tinggi` < 0,75 ≤ `sangat_tinggi`), `is_gambut`, `faktor` (array 3 objek `{ fitur, label, kontribusi }`, diurutkan
dari nilai SHAP absolut terbesar), `kabupaten`. Dengan bbox, kotak yang **bersinggungan** dengan bbox ikut dikembalikan.

### `get_region_boundaries`

```sql
get_region_boundaries() returns jsonb  -- FeatureCollection<Polygon | MultiPolygon, Region>
```

Batas 12 kabupaten/kota. `properties`: `id` (kode BPS), `slug`, `nama`, `level` (`kabupaten` | `kota`). Sederhanakan
geometri (`ST_SimplifyPreserveTopology(geom, 0.002)`) supaya respons tetap kecil.

### `get_region_detail`

```sql
get_region_detail(region_slug text) returns jsonb  -- RegionDetail atau null
```

```json
{
  "id": "1404", "slug": "pelalawan", "nama": "Pelalawan", "level": "kabupaten",
  "bbox": [101.3, -0.4, 103.1, 0.8],
  "pusat": [102.2, 0.2],
  "luas_km2": 12758,
  "persen_gambut": 52.4,
  "jumlah_sel": 520
}
```

`bbox` = `[minLon, minLat, maxLon, maxLat]`, `pusat` = titik di dalam wilayah (`ST_PointOnSurface`), `persen_gambut`
0–100 dari kotak grid bergambut. Kembalikan `null` jika slug tidak ada (frontend lalu menampilkan 404).

### `get_monthly_trend`

```sql
get_monthly_trend(start_month text, end_month text, region_slug text) returns jsonb
-- [{ "bulan": "2026-01", "jumlah_hotspot": 97 }, ...]
```

Satu elemen untuk **setiap** bulan dari `start_month` sampai `end_month` (inklusif, urut naik), termasuk bulan tanpa
hotspot (`0`). `region_slug = null` berarti seluruh provinsi. Gunakan `generate_series` lalu `left join`.

### `get_region_stats`

```sql
get_region_stats(target_date date, start_date date, end_date date) returns jsonb
-- [{ "slug": "pelalawan", "nama": "Pelalawan", "jumlah_hotspot": 537, "rata_skor_risiko": 0.41 }, ...]
```

Satu elemen per kabupaten/kota. `rata_skor_risiko` = rata-rata `skor_risiko` semua kotak wilayah itu untuk
`target_date` (0 jika belum ada prediksi). `jumlah_hotspot` = jumlah hotspot dari `start_date` sampai `end_date`;
jika keduanya `null`, pakai 30 hari terakhir sampai tanggal data terbaru. Urutkan menurun berdasarkan
`rata_skor_risiko`.

## Tabel dan view

Dibaca langsung dengan `supabase.from(...)`.

| Objek | Kolom yang dibaca | Catatan |
| --- | --- | --- |
| `regions` (tabel) | `id`, `slug`, `nama`, `level` | Frontend memfilter `level in ('kabupaten','kota')` dan mengurutkan berdasarkan `nama`. |
| `weather_latest` (view) | `slug`, `tanggal`, `suhu_c`, `kelembapan_persen`, `curah_hujan_mm`, `kecepatan_angin_kmh`, `hari_tanpa_hujan` | Satu baris per kabupaten: snapshot cuaca terbaru. |
| `data_status` (view) | `terakhir_diperbarui`, `tanggal_data`, `prediksi_mulai`, `prediksi_sampai` | Tepat satu baris. `terakhir_diperbarui` = waktu pipeline terakhir selesai (format WIB seperti di atas); `tanggal_data` = tanggal hotspot/cuaca terbaru; `prediksi_mulai`/`prediksi_sampai` = rentang `tanggal_target` prediksi terbaru. Frontend menambahkan `sumber: "supabase"`. |

## Hak akses

```sql
grant usage on schema public to anon;
grant select on regions, weather_latest, data_status to anon;
grant execute on function get_hotspots, get_clusters, get_risk_cells, get_region_boundaries,
  get_region_detail, get_monthly_trend, get_region_stats to anon;
```

Fungsi sebaiknya `stable` dan `security invoker`, supaya RLS pada tabel sumber tetap berlaku.
