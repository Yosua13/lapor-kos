# Manual Test Cases — Epic #43 Billing dan Invoice Engine

## Prasyarat

- Migration `001` sampai `021` sudah diterapkan berurutan.
- Tersedia minimal satu properti aktif (Properti A) dan properti kedua (Properti B) untuk verifikasi isolasi multi-tenant.
- Tersedia akun pengelola dengan role `property_owner` atau `property_finance`, dan akun `property_viewer` atau `property_maintenance`.
- Tersedia minimal dua akun penyewa (Tenant 1 dan Tenant 2):
  - Tenant 1 memiliki kontrak berstatus `active` pada kamar yang dihuni di Properti A;
  - Tenant 2 memiliki kontrak berstatus `ended` atau `terminated` untuk pengujian final settlement.
- Seluruh endpoint keuangan dan invoice menggunakan header `X-Property-ID` untuk operasional staf properti, atau turunan sesi otomatis untuk portal tenant (`/api/invoices/my`).

---

## Alur Utama

### BI-01 — Idempotensi Job Penagihan (Worker / Schedule / Manual)

1. Login sebagai Owner atau Finance pada Properti A.
2. Buka menu **Invoice & Tagihan** (`/invoices`).
3. Klik tombol **Generate Tagihan**.
4. Pilih periode bulan berjalan (misal: `2026-10`) lalu klik **Jalankan Generate**.
5. Catat jumlah invoice yang baru dibuat pada modal notifikasi hasil eksekusi.
6. Buka tab **Riwayat Job Billing** dan periksa log job yang baru selesai (status `succeeded`, jumlah `contracts_seen`, `invoices_created`).
7. Klik kembali tombol **Generate Tagihan** dengan periode yang sama (`2026-10`), lalu jalankan ulang.

**Hasil yang Diharapkan:**
- Pada eksekusi pertama, invoice dibuat untuk setiap kontrak aktif (`invoices_created >= 1`).
- Pada eksekusi kedua, job mendeteksi idempotency key `(property_id, contract_id, billing_period, invoice_type)` dan melewati kontrak yang sudah memiliki invoice (`invoices_created = 0`, `invoices_skipped >= 1`).
- Tidak ada invoice ganda yang terbit untuk periode yang sama.

---

### BI-02 — Kebijakan Tanggal Akhir Bulan (28-31) dan Februari

1. Pada menu **Invoice & Tagihan**, buka tab **Kebijakan Billing**.
2. Ubah **Hari Jatuh Tempo** menjadi `31`, lalu klik **Simpan Kebijakan**.
3. Buka modal **Generate Tagihan**, pilih periode bulan Februari (misal: `2026-02`).
4. Jalankan generate tagihan.
5. Periksa detail invoice yang terbentuk untuk bulan Februari:
   - Pada tahun biasa (bukan kabisat seperti 2025/2026), tanggal jatuh tempo tepat jatuh pada `28 Februari 23:59:59`.
   - Pada tahun kabisat (seperti 2024/2028), tanggal jatuh tempo tepat jatuh pada `29 Februari 23:59:59`.
   - Untuk bulan dengan 30 hari (April, Juni, September, November), jatuh tempo jatuh pada tanggal `30`.

**Hasil yang Diharapkan:**
- Tanggal jatuh tempo tidak pernah bergulir ("roll-over") ke tanggal 1, 2, atau 3 Maret.
- Perhitungan konsisten mengikuti kebijakan `last_day` dan timezone properti yang ditentukan.

---

### BI-03 — Kontrak Berakhir / Terminasi Tidak Dibuatkan Invoice Rutin

1. Pastikan Properti A memiliki satu kontrak yang sudah berstatus `ended` atau `terminated` sebelum periode penagihan (misal: berakhir pada 30 September 2026).
2. Jalankan job generate penagihan untuk periode Oktober 2026 (`2026-10`).
3. Periksa daftar invoice yang terbit pada tabel.

**Hasil yang Diharapkan:**
- Kontrak yang sudah berakhir tidak dimasukkan ke dalam kandidat pembuatan invoice rutin.
- Query kandidat secara ketat memfilter `status = 'active'` dan `end_date >= period`.

---

### BI-04 — Integritas Nominal Line Items dan Tanpa Float Drift

1. Buka salah satu invoice yang baru diterbitkan.
2. Klik tombol **Detail** untuk membuka rincian invoice.
3. Periksa daftar line item:
   - Komponen sewa kamar (`rent`);
   - Komponen listrik flat (`electricity`) jika ada di kontrak;
   - Komponen air flat (`water`) jika ada di kontrak;
   - Komponen utilitas lain atau deposit awal.
4. Periksa pembagian hari aktif (prorate):
   - Jika kontrak mulai di pertengahan bulan (misal tanggal 17), nominal sewa dihitung dengan pembulatan integer half-up tanpa angka desimal floating point yang melayang.
5. Bandingkan jumlah total penjumlahan line item dengan nilai **Total Tagihan**.

**Hasil yang Diharapkan:**
- Nilai `total_minor` pada invoice selalu sama persis dengan `SUM(amount_minor)` seluruh line item.
- Tidak terjadi galat pecahan sen (seperti Rp 1.500.000,0000001).

---

### BI-05 — Pencatatan Meter Utilitas (Listrik / Air)

1. Buka menu **Invoice & Tagihan**, klik tombol **Catat Meter**.
2. Masukkan Contract ID penyewa aktif, tipe `electricity` atau `water`.
3. Masukkan angka meter lalu: `120.0`, angka meter kini: `165.5`, tarif per unit: `Rp 1.500`.
4. Periksa kotak estimasi: pemakaian `45.50 unit`, total biaya `Rp 68.250`.
5. Klik **Simpan Meteran**.
6. Generate tagihan untuk periode tersebut.
7. Buka detail invoice yang terbentuk.

**Hasil yang Diharapkan:**
- Pencatatan meteran tersimpan di database `meter_readings`.
- Invoice periode tersebut secara otomatis menyertakan line item `utility_meter` ("Pemakaian electricity") dengan nominal `Rp 68.250` dan metadata angka meter awal/akhir.

---

### BI-06 — Preview dan Penerbitan Penyesuaian (Adjustment)

1. Buka invoice yang berstatus `issued` dengan sisa tagihan (misal: `Rp 1.500.000`).
2. Pada bagian bawah detail invoice, klik **Buat Penyesuaian (Adjustment)**.
3. Masukkan deskripsi: `Kompensasi AC Mati 2 Hari`, nominal: `-100000`, alasan: `Kesepakatan pengelola dan penyewa`.
4. Klik tombol **Preview Dampak**.
5. Periksa kotak preview:
   - Outstanding saat ini: `Rp 1.500.000`
   - Penyesuaian: `-Rp 100.000`
   - Outstanding setelah penyesuaian: `Rp 1.400.000`
6. Klik **Terapkan Penyesuaian**.

**Hasil yang Diharapkan:**
- Request preview menghitung dampak penyesuaian secara live tanpa mengubah data.
- Setelah konfirmasi, terbentuk invoice penyesuaian baru bertipe `adjustment` yang terikat pada invoice asal (`source_invoice_id`).
- Audit event `adjustment_issued` tercatat pada invoice penyesuaian dan `adjustment_applied` tercatat pada invoice asal.
- Data invoice lama tidak dimutasi secara langsung (mempertahankan immutability).

---

### BI-07 — Penerbitan Final Settlement untuk Kontrak Selesai

1. Buka kontrak yang sudah berstatus `ended` atau `terminated`.
2. Kirim request final settlement melalui API atau form penyesuaian akhir:
   - Endpoint: `POST /api/invoices/final-settlements/{contract_id}`
   - Body: `{"description":"Pengembalian deposit dikurangi perbaikan kunci","amount_minor":-350000,"reason":"Inspeksi checkout kamar"}`.
3. Coba kirim request yang sama pada kontrak yang masih berstatus `active`.

**Hasil yang Diharapkan:**
- Pada kontrak yang masih `active`, request ditolak dengan kode `422 Unprocessable Entity` ("final settlement requires a finished contract").
- Pada kontrak `ended`/`terminated`, invoice `final_settlement` berhasil terbit satu kali dengan nomor `FIN-...`.
- Retry request kedua ditolak dengan idempotensi ("final settlement already exists").

---

### BI-08 — Pengaturan Kebijakan Billing per Properti

1. Login sebagai Owner pada Properti A.
2. Buka tab **Kebijakan Billing**.
3. Ubah hari jatuh tempo menjadi `10`, hari generate sebelum due date menjadi `5`, dan aktifkan denda keterlambatan Rp 50.000 dengan grace days 3 hari.
4. Klik **Simpan Kebijakan**.
5. Refresh halaman dan pastikan konfigurasi tetap tersimpan.
6. Login sebagai Viewer atau Maintenance dan buka halaman `/invoices`.

**Hasil yang Diharapkan:**
- Nilai kebijakan berhasil disimpan ke tabel `billing_policies` dan event `policy_updated` tercatat pada `billing_policy_events`.
- Role Viewer hanya dapat membaca kebijakan tanpa tombol simpan / mutasi.

---

### BI-09 — Isolasi Properti dan Kontrol Akses Role (Security Scope)

1. Dengan token user Properti A, kirim request `GET /api/invoices/{id_invoice_properti_b}` dengan header `X-Property-ID: {properti_a}`.
2. Coba akses endpoint `POST /api/invoices/generate` menggunakan user role `maintenance` atau `viewer`.
3. Login sebagai Tenant 1 dan coba akses `GET /api/invoices/{id_invoice_tenant_2}/my`.

**Hasil yang Diharapkan:**
- Akses lintas properti mengembalikan `404 Not Found` (mencegah information leakage).
- Role tanpa izin `invoice.generate` atau `invoice.write` menerima `403 Forbidden`.
- Tenant yang mencoba membaca invoice milik tenant lain menerima `404 Not Found`.

---

### BI-10 — Portal Tagihan Tenant (Invoice Saya)

1. Login sebagai Tenant 1.
2. Klik menu navigasi **Invoice Saya** (`/invoices`).
3. Periksa tampilan daftar invoice pribadi:
   - Menampilkan nomor invoice, periode, tanggal jatuh tempo, dan nominal;
   - Tidak menampilkan tombol manajemen staf (seperti *Generate Tagihan*, *Catat Meter*, atau form kebijakan billing).
4. Klik tombol **Detail** pada salah satu invoice.
5. Periksa rincian line item (sewa kamar, listrik, air), ringkasan pembayaran, dan histori event.

**Hasil yang Diharapkan:**
- Penyewa mendapatkan portal penagihan yang bersih, transparan, dan responsif baik di desktop maupun mobile.
- Data yang ditampilkan murni terisolasi pada kontrak milik penyewa tersebut.

---

## Regression Checklist

- Modul Kontrak (`/contracts` dan `/contracts/[id]`): aktivasi kontrak terjadwal tetap berjalan normal dan menerbitkan invoice aktivasi awal.
- Modul Pembayaran (`/payments`): pembayaran histori lama tetap terbaca dan terhubung ke `payments.invoice_id`.
- Modul Kamar (`/rooms`): status kamar dan occupancy period tidak mengalami anomali.
- Modul Laporan (`/reports`): laporan keuangan PDF tetap dapat digenerate.
- Responsive design: halaman `/invoices` dan `/invoices/[id]` tampil rapi pada viewport ponsel (375px), tablet (768px), dan desktop (1280px+).
