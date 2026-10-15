# Manual Test Cases - Epic 06: Pindah Kamar Terintegrasi

Dokumen ini memuat skenario pengujian manual end-to-end untuk memvalidasi seluruh acceptance criteria pada **Epic #45: [EPIC 06] Pindah Kamar Terintegrasi**.

---

## Ringkasan Skenario Pengujian

| Test ID | Skenario Pengujian | Aktor | Kriteria Penerimaan Terkait |
|---|---|---|---|
| **PKT-01** | Kontrol Konkurensi: Dua Pengajuan Pindah Menuju Kamar & Periode Bertabrakan | Tenant / Staf | AC 1: Dua perpindahan menuju kamar dan periode yang sama tidak dapat sukses bersamaan |
| **PKT-02** | Penelusuran Histori Kamar Tenant Berdasarkan Rentang Tanggal | Staf & Tenant | AC 2: Histori kamar tenant dapat dilihat berdasarkan rentang tanggal |
| **PKT-03** | Preview Perhitungan Prorata Sewa, Deposit, Move Fee, & Kredit | Tenant & Staf | AC 3: Perubahan biaya ditampilkan dalam preview |
| **PKT-04** | Penerbitan Invoice Adjustment yang Dapat Diaudit Pasca Eksekusi | Sistem & Finance | AC 3: Perubahan biaya disimpan sebagai adjustment yang dapat diaudit |
| **PKT-05** | Atomisitas Transaksi & Rollback Penuh Saat Eksekusi Gagal | Sistem / Database | AC 4: Proses gagal tidak meninggalkan kamar ter-reserve atau invoice setengah jadi |
| **PKT-06** | Pengiriman Event Siklus Hidup ke Notification Outbox | Sistem | AC 5: Tenant dan staf menerima status proses melalui notification outbox |
| **PKT-07** | Penolakan dan Pembatalan Pengajuan Serta Pelepasan Reservasi Kamar | Staf & Tenant | AC 1 & 4: Reservasi kamar dilepaskan saat pengajuan ditolak atau dibatalkan |
| **PKT-08** | Otorisasi RBAC dan Property Scoping pada Workflow Pindah Kamar | Owner, Manager, Viewer | Ketentuan Scoping: Akses wajib terisolasi per properti dan per role |
| **PKT-09** | Eksekusi Langsung oleh Staf dari Profil Tenant | Staf / Manager | Workflow Operasional: Staf memindahkan kamar secara terintegrasi dalam 1 klik |
| **PKT-10** | Tenant Self-Service: Pengajuan dan Monitoring Status Pindah Kamar | Tenant | Workflow Tenant: Pengajuan mandiri dengan preview biaya real-time |

---

## Rincian Test Cases

### PKT-01: Kontrol Konkurensi: Dua Pengajuan Pindah Menuju Kamar & Periode Bertabrakan
- **Tujuan:** Memvalidasi bahwa dua perpindahan atau reservasi menuju kamar dan rentang tanggal yang sama tidak dapat sukses secara bersamaan (AC 1).
- **Langkah Pengujian:**
  1. Siapkan kamar target kosong (misal: Kamar 202) pada rentang tanggal 1 November 2026 s/d 31 Desember 2026.
  2. Buka dua sesi browser terpisah atau dua terminal API.
  3. Sesi 1: Ajukan pindah kamar untuk Tenant A ke Kamar 202 dengan tanggal efektif 1 November 2026 (`POST /api/room-transfers`).
  4. Amati bahwa Sesi 1 berhasil dibuat dengan status `pending` (Kamar 202 ter-reserve).
  5. Sesi 2: Secara bersamaan atau sesudahnya, ajukan pindah kamar untuk Tenant B ke Kamar 202 dengan tanggal efektif yang bertabrakan (misal: 10 November 2026).
- **Hasil yang Diharapkan:**
  - Permintaan kedua ditolak oleh backend dengan HTTP 409 Conflict atau pesan error `ErrRoomTransferUnavailable` / `ErrRoomTransferConflict`.
  - Database constraint `room_transfers_target_no_overlap` secara ketat mencegah terjadinya double-booking kamar.
  - Kamar 202 hanya dialokasikan untuk Tenant A.

---

### PKT-02: Penelusuran Histori Kamar Tenant Berdasarkan Rentang Tanggal
- **Tujuan:** Memastikan riwayat hunian kamar tenant tercatat kronologis dan dapat difilter berdasarkan rentang tanggal (AC 2).
- **Langkah Pengujian:**
  1. Pilih tenant yang pernah menempati lebih dari satu kamar (misal: pernah menempati Kamar 101, lalu pindah ke Kamar 105).
  2. Masuk ke halaman detail tenant: `/tenants/:id`.
  3. Buka tab **Riwayat Kamar**.
  4. Periksa tampilan daftar timeline:
     - Kamar 101: Periode awal s/d tanggal penutupan (status Selesai).
     - Kamar 105: Tanggal efektif pindah s/d akhir kontrak (status Hunian Saat Ini).
     - Catatan alasan kepindahan tertera pada timeline.
  5. Masukkan filter tanggal:
     - Masukkan tanggal Mulai dan tanggal Sampai yang hanya mencakup masa tinggal di Kamar 101.
     - Klik tombol **Filter**.
  6. Klik tombol **Reset Filter**.
- **Hasil yang Diharapkan:**
  - Halaman menampilkan seluruh kamar yang pernah ditempati dengan rentang tanggal sewa, harga sewa bulanan, dan tipe kamar.
  - Saat filter tanggal diterapkan, daftar kamar menyaring data dengan tepat sesuai rentang tanggal occupancy.
  - Tombol reset mengembalikan tampilan seluruh histori hunian.

---

### PKT-03: Preview Perhitungan Prorata Sewa, Deposit, Move Fee, & Kredit
- **Tujuan:** Memastikan kalkulasi selisih biaya perpindahan kamar dihitung secara presisi integer sebelum pengajuan dikonfirmasi (AC 3).
- **Langkah Pengujian:**
  1. Login sebagai staf/manager dan buka detail tenant di Kamar 101 (harga sewa Rp 1.500.000/bulan).
  2. Klik tombol **Pindah Kamar**.
  3. Pilih kamar baru Kamar 202 (harga sewa Rp 2.000.000/bulan).
  4. Tentukan tanggal efektif pindah di pertengahan bulan (misal tanggal 16 Oktober).
  5. Masukkan biaya administrasi opsional: Rp 50.000.
  6. Periksa kartu **Preview Perhitungan Biaya**:
     - Sisa hari aktif di periode berjalan: 16 hari (dari 31 hari).
     - Prorata sewa kamar baru: `ProrateMinor(2000000, 16, 31)`.
     - Kredit prorata kamar lama: `ProrateMinor(1500000, 16, 31)`.
     - Selisih prorata sewa dihitung otomatis.
     - Selisih deposit dihitung otomatis jika deposit berbeda.
     - Biaya administrasi ditambahkan ke total.
     - Saldo kredit penyewa (jika ada) otomatis mengurangi total tagihan.
- **Hasil yang Diharapkan:**
  - Preview menampilkan rincian angka secara transparan, akurat, dan tidak ada angka desimal mengambang (floating-point drift).
  - Total penyesuaian biaya (net adjustment) tampil jelas sebelum tombol ajukan ditekan.

---

### PKT-04: Penerbitan Invoice Adjustment yang Dapat Diaudit Pasca Eksekusi
- **Tujuan:** Memvalidasi bahwa saat perpindahan kamar dieksekusi, invoice penyesuaian (adjustment) resmi otomatis diterbitkan dan tercatat dalam audit log (AC 3).
- **Langkah Pengujian:**
  1. Lanjutkan dari pengajuan yang memiliki selisih biaya pada **PKT-03**.
  2. Klik **Eksekusi Pindah Kamar** (atau klik **Setujui & Pindahkan Sekarang**).
  3. Setelah proses berhasil, buka menu **Invoices** (`/invoices`).
  4. Cari invoice dengan tipe `adjustment` yang nomornya berawalan `ADJ-TRF-...`.
  5. Buka detail invoice tersebut.
- **Hasil yang Diharapkan:**
  - Invoice bertipe `adjustment` diterbitkan dengan total sesuai hasil preview.
  - `invoice_items` merinci selisih prorata sewa, biaya administrasi, dan selisih deposit dengan alasan yang jelas.
  - Event `issued` tercatat pada `invoice_events` dengan snapshot metadata perpindahan kamar.
  - Pengajuan di tabel `room_transfers` menyimpan referensi `adjustment_invoice_id`.

---

### PKT-05: Atomisitas Transaksi & Rollback Penuh Saat Eksekusi Gagal
- **Tujuan:** Memastikan bahwa jika terjadi error atau kegagalan saat eksekusi perpindahan, seluruh proses di-rollback secara utuh tanpa meninggalkan reservasi kamar yatim atau invoice setengah jadi (AC 4).
- **Langkah Pengujian:**
  1. Siapkan pengajuan pindah kamar dengan target kamar yang valid.
  2. Simulasikan kegagalan transaksi di tengah proses (misalnya menutup koneksi DB saat insert invoice atau mencoba mengeksekusi kamar yang tiba-tiba diisi oleh transaksi eksternal).
  3. Periksa kondisi database setelah kegagalan:
     - Cek tabel `invoices`: pastikan tidak ada invoice baru yang tertinggal.
     - Cek tabel `occupancy_periods`: pastikan periode hunian lama tidak terpotong dan periode hunian baru tidak tersimpan.
     - Cek tabel `contracts`: pastikan `room_id` dan `monthly_rent` pada kontrak tetap merujuk kamar lama.
     - Cek tabel `rooms`: pastikan status kamar target tidak berubah menjadi `occupied`.
- **Hasil yang Diharapkan:**
  - Transaksi database dibatalkan secara atomik (`ROLLBACK`).
  - Tidak ada data parsial, kamar ter-reserve tanpa pemilik, atau invoice setengah jadi yang tersisa di database.

---

### PKT-06: Pengiriman Event Siklus Hidup ke Notification Outbox
- **Tujuan:** Memverifikasi bahwa setiap perubahan status pengajuan pindah kamar dicatat ke `notification_outbox` untuk integrasi notifikasi (AC 5).
- **Langkah Pengujian:**
  1. Jalankan alur siklus hidup pindah kamar dari awal hingga akhir:
     - Pembuatan permintaan (`CreateTransferRequest`).
     - Persetujuan pengajuan (`ApproveTransfer`).
     - Eksekusi perpindahan (`ExecuteTransfer`).
  2. Buka database atau periksa tabel `notification_outbox` untuk `aggregate_type = 'room_transfer'`.
- **Hasil yang Diharapkan:**
  - Tercatat baris outbox dengan `event_type = 'room_transfer_requested'`.
  - Tercatat baris outbox dengan `event_type = 'room_transfer_approved'`.
  - Tercatat baris outbox dengan `event_type = 'room_transfer_completed'`.
  - Payload outbox memuat data penting: `transfer_id`, `property_id`, `tenant_id`, `from_room_id`, `to_room_id`, `effective_date`, dan status terkini.

---

### PKT-07: Penolakan dan Pembatalan Pengajuan Serta Pelepasan Reservasi Kamar
- **Tujuan:** Memastikan bahwa ketika pengajuan pindah kamar ditolak oleh staf atau dibatalkan oleh tenant, reservasi kamar target segera dilepaskan (AC 1 & AC 4).
- **Langkah Pengujian:**
  1. Buat pengajuan pindah kamar untuk Tenant A ke Kamar 303 (status `pending`).
  2. Login sebagai staf/manager, buka daftar pengajuan di `/rooms/transfers`.
  3. Klik tombol **Tolak**, masukkan alasan: "Kamar 303 sedang dalam perbaikan pipa AC".
  4. Konfirmasi penolakan.
  5. Coba buat pengajuan baru untuk Tenant B menuju Kamar 303 untuk periode yang sama.
- **Hasil yang Diharapkan:**
  - Status pengajuan Tenant A berubah menjadi `rejected` dengan alasan penolakan tersimpan.
  - Reservasi Kamar 303 otomatis terbebas karena status tidak lagi `pending` atau `approved`.
  - Pengajuan Tenant B ke Kamar 303 berhasil diterima tanpa error konfik.

---

### PKT-08: Otorisasi RBAC dan Property Scoping pada Workflow Pindah Kamar
- **Tujuan:** Memvalidasi bahwa staf dari properti lain atau pengguna tanpa izin tidak dapat mengakses atau memodifikasi pengajuan pindah kamar.
- **Langkah Pengujian:**
  1. Login dengan akun ber-role `viewer` pada Properti A.
     - Coba lakukan approval: `PUT /api/room-transfers/:id/approve`.
  2. Login dengan akun staf dari Properti B.
     - Coba lihat atau ubah pengajuan milik Properti A menggunakan header `X-Property-ID: <PROPERTI_A>`.
  3. Login dengan akun `owner` atau `manager` pada Properti A.
     - Buka menu `/rooms/transfers` dan lakukan manajemen pengajuan.
- **Hasil yang Diharapkan:**
  - Langkah 1 ditolak dengan HTTP 403 Forbidden (izin write diperlukan).
  - Langkah 2 ditolak dengan HTTP 403 / 404 (Property boundary enforced).
  - Langkah 3 berhasil dengan HTTP 200 OK.

---

### PKT-09: Eksekusi Langsung oleh Staf dari Profil Tenant
- **Tujuan:** Memastikan staf kos dapat langsung memindahkan kamar tenant dalam satu klik praktis melalui tombol "Setujui & Pindahkan Sekarang".
- **Langkah Pengujian:**
  1. Masuk ke halaman profil tenant di `/tenants/:id`.
  2. Klik tombol **Pindah Kamar**.
  3. Pilih kamar baru, tanggal efektif, isi alasan, lalu klik tombol **Setujui & Pindahkan Sekarang**.
  4. Amati modal tertutup dan notifikasi toast hijau "Proses pindah kamar berhasil dijalankan!" muncul.
  5. Periksa informasi kamar saat ini pada profil tenant.
- **Hasil yang Diharapkan:**
  - Kamar saat ini pada profil tenant otomatis ter-update ke kamar baru.
  - Riwayat kamar mencatat kamar lama sebagai selesai dan kamar baru sebagai hunian aktif.
  - Kontrak tenant merujuk kamar baru dengan versi kontrak ter-increment.

---

### PKT-10: Tenant Self-Service: Pengajuan dan Monitoring Status Pindah Kamar
- **Tujuan:** Memvalidasi pengalaman penyewa dalam mengajukan pindah kamar mandiri dan melihat riwayat hunian miliknya.
- **Langkah Pengujian:**
  1. Login sebagai tenant aktif.
  2. Buka menu riwayat kamar tenant atau panggil endpoint `GET /api/tenants/me/room-history`.
  3. Lakukan preview simulasi pindah kamar melalui `POST /api/room-transfers/my/preview`.
  4. Kirim pengajuan pindah kamar mandiri via `POST /api/room-transfers/my`.
  5. Periksa status pengajuan melalui `GET /api/room-transfers/my`.
  6. Batalkan pengajuan mandiri melalui `POST /api/room-transfers/my/:id/cancel`.
- **Hasil yang Diharapkan:**
  - Tenant dapat melihat simulasi selisih biaya sewa sebelum mengajukan.
  - Pengajuan masuk ke sistem dengan status `pending` dan dapat dibatalkan selama belum disetujui staf.
  - Tenant tidak dapat memanipulasi pengajuan milik tenant lain.
