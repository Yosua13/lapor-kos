# Manual Test Cases - Epic 07: Checkout, Inspeksi, dan Settlement

Dokumen ini memuat skenario pengujian manual end-to-end untuk memvalidasi seluruh acceptance criteria pada **Epic #46: [EPIC 07] Checkout, Inspeksi, dan Settlement**.

---

## Ringkasan Skenario Pengujian

| Test ID | Skenario Pengujian | Aktor | Kriteria Penerimaan Terkait |
|---|---|---|---|
| **CKO-01** | Kamar Tidak Menjadi Available Sebelum Inspeksi & Serah Terima Kunci Selesai | Staf & Sistem | AC 1: Kamar tidak menjadi available sebelum inspeksi dan handover selesai |
| **CKO-02** | Otorisasi Override Status Kamar dengan Alasan Audit Terdokumentasi | Manager / Owner | AC 1: Kamar dapat menjadi available hanya jika terdapat override beralasan |
| **CKO-03** | Penyelesaian Deposit Surplus: Penerbitan Open Refund Request Terpadu | Staf & Finance | AC 2: Deposit berakhir dengan open refund case yang jelas |
| **CKO-04** | Penyelesaian Deposit Defisit: Penerbitan Invoice Final Settlement Kurang Bayar | Staf & Finance | AC 2: Deposit berakhir dengan saldo nol dan invoice tertagih |
| **CKO-05** | Preservasi Data Historis Kontrak, Invoice, Payment, dan Kuitansi | Tenant & Staf | AC 3: Kontrak, invoice, payment, dan bukti historis tetap tersedia |
| **CKO-06** | Pembatalan Invoice Mendatang (Upcoming Invoices) Tanpa Menghapus Data | Sistem / Billing | AC 3: Invoice mendatang dibatalkan dengan aman |
| **CKO-07** | Tenant Nonaktif Dibatasi Transaksi Baru tetapi Tetap Bisa Akses Histori | Tenant Nonaktif | AC 4: Tenant nonaktif tidak dapat membuat transaksi baru, tetapi akses historis terjaga |
| **CKO-08** | Atomisitas Transaksi & Rollback Bersih Saat Eksekusi Checkout Gagal | Sistem / Database | AC 5: Kegagalan proses tidak meninggalkan settlement atau status kamar tidak konsisten |
| **CKO-09** | Pengiriman Event Siklus Hidup ke Notification Outbox | Sistem | AC 5: Tenant dan staf menerima status proses melalui notification outbox |
| **CKO-10** | Tenant Self-Service: Pengajuan Notice Checkout dan Monitoring Statement | Tenant | Workflow Operasional: Pengajuan mandiri dari tenant dengan rekening refund |

---

## Rincian Test Cases

### CKO-01: Kamar Tidak Menjadi Available Sebelum Inspeksi & Serah Terima Kunci Selesai
- **Tujuan:** Memvalidasi bahwa kamar kos tidak dapat bertransisi menjadi `available` sebelum proses inspeksi checklist fisik dan penyerahan kunci selesai (AC 1).
- **Langkah Pengujian:**
  1. Login sebagai staf/manager dan buka menu **Checkout & Settlement** (`/checkouts`).
  2. Buka salah satu checkout case yang kuncinya belum diserahkan (`key_returned = false`).
  3. Klik tombol **Settlement** untuk membuka modal review settlement.
  4. Periksa indikator status serah kunci: tertera *"Kunci Belum Diserahkan"*.
  5. Coba klik **Eksekusi Checkout Selesai** tanpa mencentang opsi override.
- **Hasil yang Diharapkan:**
  - Sistem menolak eksekusi dan menampilkan pesan peringatan: *"Kunci kamar belum diserahterimakan! Harap aktifkan centang override dan isi alasannya untuk melanjutkan."*
  - Status kamar di tabel `rooms` tetap `occupied`.
  - Tidak ada mutasi status kamar menjadi `available`.

---

### CKO-02: Otorisasi Override Status Kamar dengan Alasan Audit Terdokumentasi
- **Tujuan:** Memastikan manager/owner dapat melakukan override status kamar menjadi `available` dengan syarat wajib mencantumkan alasan audit (AC 1 Override).
- **Langkah Pengujian:**
  1. Pada kasus checkout di mana kunci ditinggalkan di meja atau tenant checkout darurat tanpa tatap muka:
  2. Buka modal review settlement checkout.
  3. Pada bagian *Opsi Penutupan & Kamar*, centang opsi *"Konfirmasi Override Otorisasi Status Kamar"*.
  4. Kosongkan input *Alasan override*, lalu klik eksekusi -> amati error validasi muncul.
  5. Isi *Alasan override* dengan teks valid: *"Kunci ditinggal di meja kamar, kebersihan sudah diverifikasi via CCTV"*.
  6. Pilih status kamar tujuan: `Available`.
  7. Klik **Eksekusi Checkout Selesai**.
- **Hasil yang Diharapkan:**
  - Eksekusi berhasil diproses.
  - Tabel `checkout_cases` mencatat `room_override = true` dan `room_override_reason` tersimpan permanen di database.
  - Status kamar di tabel `rooms` bertransisi menjadi `available`.

---

### CKO-03: Penyelesaian Deposit Surplus: Penerbitan Open Refund Request Terpadu
- **Tujuan:** Memastikan kelebihan dana deposit setelah dipotong tagihan dan kerusakan dialokasikan secara transparan ke tabel `refund_requests` (AC 2 Surplus).
- **Langkah Pengujian:**
  1. Siapkan tenant dengan Deposit: Rp 1.500.000, tanpa tagihan tertunggak.
  2. Buka modal **Inspeksi Kamar**, catat kerusakan kasur: Rp 200.000, lalu simpan hasil inspeksi.
  3. Buka modal **Review Final Settlement**:
     - Periksa breakdown: Deposit Rp 1.500.000, Potongan Kerusakan -Rp 200.000.
     - Kartu hasil menampilkan: *Refund: Rp 1.300.000*.
     - Rekening tujuan menampilkan nomor rekening tenant yang diinput saat notice.
  4. Klik **Setujui Statement**, lalu klik **Eksekusi Checkout Selesai**.
  5. Periksa database atau dashboard pembayaran:
     - Query tabel `refund_requests` berdasarkan `checkout_id`.
- **Hasil yang Diharapkan:**
  - Kasus refund baru terdaftar di tabel `refund_requests` dengan `amount_minor = 130000000` (Rp 1.300.000) dan status `requested`.
  - Data bank, nomor rekening, dan nama pemilik rekening terisi sesuai detail tenant.
  - `checkout_settlements.deposit_status` tercatat `refund_requested`.
  - Deposit terselesaikan secara bersih tanpa ada dana mengambang.

---

### CKO-04: Penyelesaian Deposit Defisit: Penerbitan Invoice Final Settlement Kurang Bayar
- **Tujuan:** Memvalidasi bahwa jika biaya kerusakan dan tagihan melebihi deposit yang dipegang, seluruh deposit terpakai habis dan kekurangannya diterbitkan sebagai invoice tagihan akhir (AC 2 Defisit).
- **Langkah Pengujian:**
  1. Siapkan tenant dengan Deposit: Rp 500.000.
  2. Masukkan hasil inspeksi dengan kerusakan AC & lemari senilai total Rp 1.200.000.
  3. Buka modal **Review Final Settlement**:
     - Deposit: +Rp 500.000.
     - Kerusakan: -Rp 1.200.000.
     - Net Settlement: -Rp 700.000.
     - Kartu hasil menampilkan: *Kekurangan Bayar (Diterbitkan Invoice): Rp 700.000*.
  4. Lakukan eksekusi checkout.
  5. Buka daftar invoice di menu `/invoices`.
- **Hasil yang Diharapkan:**
  - Sebuah invoice baru tipe `final_settlement` terbit dengan nomor `INV-SETTLE-...` senilai Rp 700.000 dengan status `issued`.
  - Seluruh deposit Rp 500.000 teralokasikan (`deposit_applied_to_deductions_minor = 50000000`, `deposit_status = applied_to_deductions`).
  - Saldo deposit berakhir 0.

---

### CKO-05: Preservasi Data Historis Kontrak, Invoice, Payment, dan Kuitansi
- **Tujuan:** Menjamin proses checkout tidak menghapus atau menimpa rekaman kontrak, riwayat invoice, transaksi pembayaran, maupun kuitansi yang telah terbit (AC 3).
- **Langkah Pengujian:**
  1. Catat nomor kontrak, invoice-invoice terdahulu, dan nomor kuitansi pembayaran milik tenant sebelum checkout.
  2. Selesaikan proses checkout.
  3. Buka halaman detail kontrak di `/contracts/:id`.
  4. Buka halaman detail invoice dan kuitansi pembayaran tenant di `/payments`.
- **Hasil yang Diharapkan:**
  - Kontrak lama tetap ada di database dengan status `ended` atau `terminated`.
  - Tabel `contract_events` memiliki event baru `checkout_completed`.
  - Seluruh invoice lama dan payment receipts tetap utuh dan dapat diunduh/dilihat.
  - Tidak ada data historis yang hilang (*immutable historical records*).

---

### CKO-06: Pembatalan Invoice Mendatang (Upcoming Invoices) Tanpa Menghapus Data
- **Tujuan:** Memastikan invoice sewa berulang (*recurring*) yang jatuh tempo setelah tanggal checkout otomatis dibatalkan tanpa dihapus dari database (AC 3).
- **Langkah Pengujian:**
  1. Buat kontrak yang memiliki tagihan recurring untuk bulan depan (misal: periode Desember 2026).
  2. Lakukan checkout lebih awal pada tanggal 15 November 2026.
  3. Eksekusi checkout hingga selesai.
  4. Buka halaman `/invoices` dan cari tagihan bulan Desember 2026 untuk kontrak tersebut.
- **Hasil yang Diharapkan:**
  - Status invoice periode Desember 2026 berubah dari `issued` menjadi `cancelled`.
  - Invoice tidak dihapus dari tabel `invoices`, sehingga histori penagihan tetap dapat diaudit.

---

### CKO-07: Tenant Nonaktif Dibatasi Transaksi Baru tetapi Tetap Bisa Akses Histori
- **Tujuan:** Memvalidasi bahwa sesi tenant yang telah checkout dicabut, profil di properti menjadi nonaktif, tidak dapat membuat transaksi operasional baru, namun tetap dapat melihat arsip historisnya (AC 4).
- **Langkah Pengujian:**
  1. Eksekusi checkout untuk Akun Tenant A.
  2. Gunakan token lama Tenant A untuk memanggil endpoint pembuatan komplain (`POST /api/complaints`) atau pindah kamar (`POST /api/room-transfers/my`).
  3. Login kembali sebagai Tenant A.
  4. Akses endpoint baca histori: `/api/invoices/my`, `/api/contracts/:id`, `/api/checkouts/my`.
  5. Coba ajukan kontrak baru atau komplain baru.
- **Hasil yang Diharapkan:**
  - Token lama ditolak dengan error `Session has been revoked` karena dicatat di `tenant_session_revocations`.
  - Profil tenant di tabel `tenant_profiles` berstatus `inactive`.
  - Tenant tetap dapat login untuk melihat arsip kuitansi dan status settlement.
  - Tindakan pembuatan transaksi baru diblokir oleh otorisasi sistem.

---

### CKO-08: Atomisitas Transaksi & Rollback Bersih Saat Eksekusi Checkout Gagal
- **Tujuan:** Memverifikasi bahwa jika terjadi interupsi atau error pada salah satu tahapan penutupan hunian, seluruh transaksi dibatalkan tanpa meninggalkan data parsial (AC 5).
- **Langkah Pengujian:**
  1. Simulasikan kegagalan database (misal: memberikan data status kamar tidak valid atau constraint violation).
  2. Panggil eksekusi checkout.
  3. Periksa status kamar, status kontrak, occupancy period, dan invoice.
- **Hasil yang Diharapkan:**
  - Backend mengembalikan respon error dan melakukan rollback (`tx.Rollback()`).
  - Status kontrak tetap `active`.
  - Occupancy period tetap terbuka (`closed_at IS NULL`).
  - Tidak ada invoice setengah jadi atau record refund yatim (*orphaned record*).
  - Status kamar tidak berubah.

---

### CKO-09: Pengiriman Event Siklus Hidup ke Notification Outbox
- **Tujuan:** Memastikan event checkout selesai terdaftar di `notification_outbox` untuk integrasi notifikasi WhatsApp/Email ke penghuni dan staf (AC 5).
- **Langkah Pengujian:**
  1. Selesaikan proses checkout untuk sebuah kamar.
  2. Buka PostgreSQL dan query tabel `notification_outbox`:
     ```sql
     SELECT event_type, aggregate_type, payload, status 
     FROM notification_outbox 
     WHERE aggregate_type = 'checkout' 
     ORDER BY created_at DESC LIMIT 2;
     ```
- **Hasil yang Diharapkan:**
  - Terdapat baris event `checkout_completed` dengan status `pending`.
  - Payload JSON memuat rincian: `checkout_id`, `property_id`, `tenant_id`, `room_number`, `net_settlement_minor`, dan `settlement_type`.

---

### CKO-10: Tenant Self-Service: Pengajuan Notice Checkout dan Monitoring Statement
- **Tujuan:** Menguji alur mandiri penghuni kos dalam mengajukan rencana checkout serta memantau progres inspeksi dan rincian refund deposit.
- **Langkah Pengujian:**
  1. Login sebagai penghuni aktif kos pada aplikasi web.
  2. Masuk ke halaman menu **Checkout** atau profil hunian saya.
  3. Klik tombol **Ajukan Notice Checkout**:
     - Pilih tanggal rencana keluar (misal: akhir bulan berjalan).
     - Masukkan alasan: *"Pindah domisili tugas kantor"*.
     - Masukkan rekening bank: BCA, 1234567890, a.n. Nama Tenant.
  4. Klik **Kirim Notice Checkout**.
  5. Buka kembali dashboard untuk memantau status transisi (Notice Diajukan -> Inspeksi Selesai -> Disetujui -> Selesai).
- **Hasil yang Diharapkan:**
  - Form notice tersimpan dengan status `submitted`.
  - Staf menerima notifikasi notice baru pada dashboard pengelola `/checkouts`.
  - Tenant dapat melihat live preview rincian pengembalian deposit mereka secara transparan.
