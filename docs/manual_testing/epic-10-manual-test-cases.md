# Manual Test Cases: [EPIC 10] Complaint, SLA, Work Order, dan AI Advisory

Dokumen ini menyediakan panduan pengujian manual end-to-end untuk memvalidasi seluruh kriteria penerimaan pada **Epic 10: Complaint, SLA, Work Order, dan AI Advisory**.

---

## Ringkasan Skenario Pengujian

| Test ID | Skenario Pengujian | Acceptance Criteria Terkait | Aktor Penguji |
| :--- | :--- | :--- | :--- |
| **COMP-01** | Pengajuan Tiket Komplain oleh Tenant Aktif & Validasi Hunian | **AC 1, AC 5** | Tenant |
| **COMP-02** | Triage Tiket Prioritas Tinggi & Alert Terukur ke Notification Outbox | **AC 1** | Owner / Maintenance / Sistem |
| **COMP-03** | Timeline Aman untuk Tenant (Penyembunyian Catatan Internal & Biaya Vendor) | **AC 2** | Tenant vs Staff |
| **COMP-04** | Konfirmasi Penyelesaian Komplain (`confirmed`) oleh Tenant | **AC 3** | Tenant |
| **COMP-05** | Pembukaan Kembali Tiket (`reopened`) dengan Alasan Wajib | **AC 3** | Tenant |
| **COMP-06** | Dashboard Menghitung First Response Time dan Resolution Time Sesuai SLA | **AC 4** | Owner / Manager / Staff |
| **COMP-07** | Ketahanan Sistem saat AI atau Channel Eksternal Gagal (Non-blocking Fallback) | **AC 5** | Sistem / Tenant |
| **COMP-08** | Penugasan PIC dan Pembuatan Work Order Vendor | Operasional | Staff Maintenance |
| **COMP-09** | Rekomendasi AI Advisory dan Human Override oleh Staff | **AC 5** | Staff Maintenance / Owner |
| **COMP-10** | Pengendalian Akses Data Komplain Berdasarkan Property Boundary | Dependensi EP-01 | Multi-Tenant & Multi-Staff |

---

## Rincian Test Cases

### COMP-01: Pengajuan Tiket Komplain oleh Tenant Aktif & Validasi Hunian (AC 1, AC 5)
- **Tujuan:** Memastikan tenant dengan kontrak aktif dapat membuat tiket komplain, sementara tenant tanpa kontrak aktif ditolak.
- **Prasyarat:** Akun tenant dengan kontrak `active`.
- **Langkah Pengujian:**
  1. Login sebagai tenant aktif di aplikasi.
  2. Buka menu **Komplain** (`/complaints`).
  3. Isi form pelaporan:
     - Kategori: `"Kerusakan Fasilitas"` (`facility`)
     - Urgensi: `"Normal / Standar"` (`priority: medium`, `impact: minor`)
     - Judul: `"Kran Wastafel Kamar Mandi Bocor"`
     - Deskripsi: `"Air menetes terus-menerus sejak kemarin sore, mohon diperbaiki."`
     - Jam Akses Kunjungan: `"Senin - Rabu jam 09:00 - 11:00"`
  4. Klik **"Kirim Komplain"**.
- **Hasil yang Diharapkan:**
  - Tiket berhasil dibuat dengan status `pending` dan batas SLA terhitung otomatis (Respon: 6 jam, Penyelesaian: 48 jam).
  - Ditampilkan tanggapan empatik otomatis yang menenangkan penyewa.
  - Tiket muncul di daftar "Daftar Komplain Saya".

---

### COMP-02: Triage Tiket Prioritas Tinggi & Alert Terukur ke Notification Outbox (AC 1)
- **Tujuan:** Memastikan tiket prioritas tinggi/darurat menghasilkan aturan triage yang ketat dan alert terukur pada notification outbox.
- **Prasyarat:** Tenant membuat tiket darurat (misal: pipa pecah banjir atau korsleting listrik).
- **Langkah Pengujian:**
  1. Tenant memilih opsi Urgensi: `"Darurat (Urgent)"`, judul: `"Korsleting Listrik Kamar 102 Keluar Asap"`.
  2. Kirim komplain.
  3. Login sebagai Owner / Staff Maintenance, buka `/complaints`.
  4. Periksa banner peringatan di bagian atas SLA Dashboard.
  5. Buka `/notifications/outbox` (atau periksa tabel `notification_outbox`).
- **Hasil yang Diharapkan:**
  - Tiket diberi label `Darurat / Urgent` dengan target SLA ketat (Respon: 1 jam, Penyelesaian: 12 jam).
  - Muncul banner peringatan merah: `"Terdapat 1 komplain prioritas tinggi yang belum ditanggapi"`.
  - Item outbox tercatat dengan `event_type: "complaint.urgent_alert"`, `priority: "urgent"`, dan penerima `property_owner`.

---

### COMP-03: Timeline Aman untuk Tenant (Penyembunyian Catatan Internal & Biaya Vendor) (AC 2)
- **Tujuan:** Memastikan tenant hanya melihat timeline yang relevan dan aman tanpa detail internal, estimasi biaya vendor, atau catatan teknisi rahasia.
- **Prasyarat:** Tiket komplain yang telah memiliki aktivitas catatan staf dan work order vendor.
- **Langkah Pengujian:**
  1. Login sebagai Staff Pengelola kos.
  2. Buka tiket komplain di `/complaints/[id]`.
  3. Pada form timeline, pilih Visibilitas: `"Hanya Internal Staff"`, isi pesan: `"Estimasi biaya teknisi AC Rp 350.000, margin kos Rp 50.000. Catatan: pipa lama sudah rapuh."`.
  4. Tambahkan komentar kedua dengan Visibilitas: `"Dapat Dilihat Penyewa"`, isi pesan: `"Teknisi AC dijadwalkan datang besok pukul 10:00 WIB."`.
  5. Buat Work Order dengan vendor AC, cantumkan biaya aktual Rp 350.000.
  6. Logout, lalu login sebagai Tenant pelapor dan buka `/complaints/[id]`.
- **Hasil yang Diharapkan:**
  - Tenant **HANYA** melihat komentar publik (`"Teknisi AC dijadwalkan datang besok pukul 10:00 WIB"`) dan informasi jadwal umum.
  - Komentar internal dan detail nominal biaya teknisi **TIDAK MUNCUL** pada halaman tenant (terfilter aman baik di UI maupun API response `/api/complaints/my/:id/timeline`).

---

### COMP-04: Konfirmasi Penyelesaian Komplain oleh Tenant (AC 3)
- **Tujuan:** Memvalidasi alur penyelesaian di mana status `resolved` dapat dikonfirmasi selesai secara final oleh tenant.
- **Prasyarat:** Tiket komplain dengan status `resolved` oleh staff pengelola kos.
- **Langkah Pengujian:**
  1. Login sebagai Tenant pelapor.
  2. Buka detail tiket `/complaints/[id]`.
  3. Perhatikan banner hijau: `"Pengelola Menyatakan Komplain Telah Selesai"`.
  4. Klik tombol **"Konfirmasi Selesai"**.
  5. Masukkan ulasan: `"Pekerjaan rapi dan AC sudah dingin kembali. Terima kasih!"`.
  6. Klik **"Konfirmasi Selesai"**.
- **Hasil yang Diharapkan:**
  - Status tiket berubah menjadi `confirmed` (Tuntas & Dikonfirmasi).
  - Waktu `confirmed_resolved_at` tersimpan.
  - Catatan ulasan tercatat di timeline publik sebagai bukti persetujuan tenant.

---

### COMP-05: Pembukaan Kembali Tiket (Reopen) dengan Alasan Wajib (AC 3)
- **Tujuan:** Memverifikasi tenant dapat membuka kembali tiket jika masalah belum tuntas, dengan kewajiban mengisi alasan.
- **Prasyarat:** Tiket berstatus `resolved` atau `confirmed`.
- **Langkah Pengujian:**
  1. Login sebagai Tenant pelapor di `/complaints/[id]`.
  2. Klik tombol **"Buka Kembali Tiket"**.
  3. Coba kirim tanpa mengisi alasan.
  4. Sistem mencegah pengiriman dengan validasi input wajib.
  5. Masukkan alasan: `"Air wastafel masih menetes setelah ditinggal teknisi kemarin sore."`.
  6. Klik **"Buka Kembali Tiket"**.
- **Hasil yang Diharapkan:**
  - Status tiket diperbarui menjadi `reopened` (Dibuka Kembali).
  - SLA diperpanjang 24 jam dengan status SLA disesuaikan ke `warning`.
  - Riwayat timeline mencatat kejadian reopen beserta alasan tenant secara kronologis.

---

### COMP-06: Dashboard Menghitung First Response Time dan Resolution Time Sesuai SLA (AC 4)
- **Tujuan:** Menguji akurasi perhitungan rata-rata First Response Time, Resolution Time, Breached Count, dan Compliance Rate pada dashboard operasional.
- **Prasyarat:** Akun Owner / Manager properti dengan beberapa tiket yang telah ditanggapi dan diselesaikan.
- **Langkah Pengujian:**
  1. Login sebagai Owner / Manager di `/complaints`.
  2. Amati widget **SLA Dashboard**:
     - Total Tiket & Tiket Aktif.
     - Tingkat Kepatuhan SLA (`%`).
     - Avg First Response Time (`j m`).
     - Avg Resolution Time (`h j`).
     - Breached SLA Count.
     - Warning SLA Count.
  3. Lakukan filter status: `"Selesai"`, `"Menunggu"`, atau filter SLA: `"Breached"`.
- **Hasil yang Diharapkan:**
  - Nilai rata-rata waktu respon pertama terhitung dari selisih `first_response_at` - `created_at`.
  - Waktu penyelesaian terhitung dari selisih `resolved_at` - `created_at`.
  - Tiket yang melewati batas waktu ditandai secara visual dengan badge merah `"Melewati Batas SLA (Breached)"`.

---

### COMP-07: Ketahanan Sistem saat AI atau Channel Eksternal Gagal (AC 5)
- **Tujuan:** Memastikan kegagalan koneksi AI (misal kuota Gemini habis/key tidak ada) atau WhatsApp tidak menggagalkan penyimpanan tiket komplain maupun perubahan status.
- **Prasyarat:** Lingkungan pengujian dengan `GEMINI_API_KEY` tidak disetel atau API external terputus.
- **Langkah Pengujian:**
  1. Kirim komplain baru sebagai tenant dengan kategori `"noisy"`.
  2. Periksa apakah request API berhasil mengembalikan status `201 Created`.
  3. Buka detail tiket di `/complaints/[id]`.
- **Hasil yang Diharapkan:**
  - Tiket tetap tersimpan sempurna di database.
  - Tanggapan empatik fallback deterministik digunakan secara otomatis.
  - AI Advisory fallback tetap menyajikan rekomendasi triage berbasis rule engine tanpa error 500.

---

### COMP-08: Penugasan PIC dan Pembuatan Work Order Vendor (Operasional)
- **Tujuan:** Menguji pembuatan work order teknisi/vendor dengan estimasi jadwal, biaya, dan catatan instruksi.
- **Prasyarat:** Login sebagai staff maintenance / manager.
- **Langkah Pengujian:**
  1. Buka tiket komplain di `/complaints/[id]`.
  2. Pada bagian **Work Order Vendor & Teknisi**, klik **"Buat Work Order"**.
  3. Isi judul: `"Servis Kompresor dan Tambah Freon"`.
  4. Pilih vendor AC dari daftar dropdown.
  5. Tentukan jadwal kunjungan dan estimasi biaya: `Rp 250.000`.
  6. Klik **"Simpan Work Order"**.
  7. Setelah pekerjaan selesai, klik **"Tandai Selesai"**.
- **Hasil yang Diharapkan:**
  - Work order tercatat dengan status `completed` dan biaya terekam di audit trail internal.
  - Status komplain otomatis tersinkronisasi.

---

### COMP-09: Rekomendasi AI Advisory dan Human Override oleh Staff (AC 5)
- **Tujuan:** Memvalidasi bahwa AI hanya memberikan saran yang dapat ditinjau dan dikoreksi manusia sebelum diterapkan.
- **Prasyarat:** Tiket komplain yang memiliki saran AI.
- **Langkah Pengujian:**
  1. Buka tiket komplain sebagai staff pengelola di `/complaints/[id]`.
  2. Tinjau banner **AI Advisory**:
     - Analisis masalah, skor akurasi (confidence score), saran prioritas, dan draft respon.
  3. Pilih checkbox yang ingin diterapkan (misal: hanya Kategori dan Prioritas).
  4. Klik tombol **"Terapkan Saran AI"**.
- **Hasil yang Diharapkan:**
  - Data tiket terupdate sesuai opsi yang dipilih staff.
  - Status AI suggestion ditandai `is_applied = true` beserta identitas staff yang melakukan override (`applied_by`).
  - Tidak ada perubahan otomatis tanpa otorisasi manusia.

---

### COMP-10: Pengendalian Akses Data Komplain Berdasarkan Property Boundary (EP-01)
- **Tujuan:** Memastikan komplain, work order, timeline, dan data vendor diisolasi secara ketat berdasarkan properti.
- **Prasyarat:** Properti A dan Properti B dengan staff dan tenant berbeda.
- **Langkah Pengujian:**
  1. Login sebagai staff Properti A, coba akses `/api/complaints/[id-properti-B]`.
  2. Coba akses endpoint `/api/complaints/[id-properti-B]/work-orders`.
  3. Login sebagai Tenant A, coba akses `/api/complaints/my/[id-milik-tenant-B]`.
- **Hasil yang Diharapkan:**
  - Seluruh akses lintas properti atau lintas tenant ditolak dengan status HTTP `404 Not Found` atau `403 Forbidden`.
  - Tidak terjadi kebocoran data (data leak) antar-kos.
