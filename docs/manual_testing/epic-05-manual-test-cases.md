# Manual Test Cases - Epic 05: Payment, Verification, dan Reconciliation

Dokumen ini memuat skenario pengujian manual end-to-end untuk memvalidasi seluruh acceptance criteria pada **Epic #44: [EPIC 05] Payment, Verification, dan Reconciliation**.

---

## Ringkasan Skenario Pengujian

| Test ID | Skenario Pengujian | Aktor | Kriteria Penerimaan Terkait |
|---|---|---|---|
| **PVR-01** | Dua Pembayaran Parsial Tanpa Menimpa Bukti Sebelumnya | Tenant & Finance/Owner | AC 1: Dua pembayaran parsial memperbarui outstanding tanpa menimpa bukti sebelumnya |
| **PVR-02** | Idempotensi Webhook Provider dengan Provider Reference Sama | System / Provider Webhook | AC 2: Webhook atau retry dengan provider reference yang sama tidak membuat transaksi ganda |
| **PVR-03** | Otorisasi RBAC dan Property Scoping pada Verifikasi Pembayaran | Finance vs Manager vs Viewer | AC 3: Verifikasi hanya dapat dilakukan oleh role berizin pada property terkait |
| **PVR-04** | Immutabilitas Kwitansi (Receipt) & Integritas Checksum Kriptografis | Tenant & Staf | AC 4: Receipt yang sudah diterbitkan tidak dapat diubah secara diam-diam |
| **PVR-05** | Laporan Rekonsiliasi Pembayaran, Alokasi, Refund, Credit, & Settlement | Finance & Owner | AC 5: Laporan rekonsiliasi dapat menjelaskan payment, allocation, refund, credit, dan settlement |
| **PVR-06** | Penanganan Overpayment sebagai Saldo Kredit Penyewa | Finance & Tenant | AC 1 & 5: Penanganan kelebihan bayar otomatis dicatat ke saldo kredit penyewa |
| **PVR-07** | Pengajuan dan Pemrosesan Refund Pembayaran | Finance & Owner | AC 5: Workflow refund tercatat dan direkonsiliasi |
| **PVR-08** | Pencatatan Outbox Event untuk Integrasi Notifikasi | Sistem | Dependensi EPIC 08: Outbox pattern untuk integrasi event pembayaran |
| **PVR-09** | Sinkronisasi Status Invoice Berbasis Alokasi Pembayaran | Sistem & Database | AC 1: Status invoice otomatis berubah ke `partially_paid` dan `paid` |
| **PVR-10** | Cetak Kwitansi Resmi Elektronik dengan Format Cetak Bersih | Tenant & Finance | AC 4: Kwitansi resmi elektronik dapat diunduh/dicetak dengan tampilan rapi |

---

## Rincian Test Cases

### PVR-01: Dua Pembayaran Parsial Tanpa Menimpa Bukti Sebelumnya
- **Tujuan:** Memastikan tenant dapat melakukan cicilan pembayaran parsial, setiap bukti transfer tersimpan permanen di histori tanpa menimpa bukti terdahulu, dan sisa tagihan ter-update akurat.
- **Langkah Pengujian:**
  1. Login sebagai Tenant yang memiliki tagihan aktif Rp 2.000.000.
  2. Buka menu **Tagihan & Pembayaran Saya**.
  3. Klik tombol **Bayar** pada tagihan tersebut.
  4. Masukkan nominal cicilan pertama: Rp 1.000.000, unggah foto bukti transfer #1 (`bukti_cicilan_1.jpg`), lalu klik **Kirim Bukti Pembayaran**.
  5. Login sebagai Owner / Finance, buka menu **Manajemen Pembayaran**, lalu buka modal **Verifikasi**.
  6. Pastikan bukti #1 terlihat. Verifikasi pembayaran sebagai `partial` dengan nominal Rp 1.000.000.
  7. Buka kembali halaman Tenant. Periksa bahwa sisa tagihan sekarang menjadi Rp 1.000.000 (status `partial`).
  8. Tenant mengklik tombol **Bayar** kedua kalinya untuk melunasi sisa Rp 1.000.000, mengunggah foto bukti transfer #2 (`bukti_cicilan_2.jpg`), lalu kirim.
  9. Login kembali sebagai Owner / Finance dan buka modal **Verifikasi**.
- **Hasil yang Diharapkan:**
  - Modal verifikasi menampilkan galeri histori bukti pembayaran dengan **kedua bukti transfer** (Bukti #1 dan Bukti #2) secara utuh.
  - Bukti #1 tidak terhapus atau tertimpa oleh Bukti #2.
  - Sisa tagihan terpotong secara akurat hingga Rp 0 saat cicilan kedua diverifikasi lunas (`paid`).

---

### PVR-02: Idempotensi Webhook Provider dengan Provider Reference Sama
- **Tujuan:** Memastikan pengiriman ulang (retry) webhook pembayaran dari payment gateway tidak menghasilkan transaksi ganda maupun alokasi ganda.
- **Langkah Pengujian:**
  1. Kirim request HTTP POST ke `/api/payments/webhook` dengan payload:
     ```json
     {
       "provider": "xendit",
       "provider_ref": "trx-ref-abc-001",
       "amount_minor": 1500000,
       "property_id": "<PROPERTY_UUID>",
       "contract_id": "<CONTRACT_UUID>",
       "status": "PAID"
     }
     ```
  2. Amati response: HTTP 201 Created dengan `status: "processed"` dan `is_duplicate: false`.
  3. Kirim ulang request HTTP POST yang sama persis dengan `provider_ref: "trx-ref-abc-001"`.
- **Hasil yang Diharapkan:**
  - Request kedua menghasilkan HTTP 200 OK dengan `status: "already_processed"` dan `is_duplicate: true`.
  - Database tidak membuat baris pembayaran baru pada tabel `payments`.
  - Tidak terjadi duplikasi alokasi saldo invoice.

---

### PVR-03: Otorisasi RBAC dan Property Scoping pada Verifikasi Pembayaran
- **Tujuan:** Memvalidasi bahwa verifikasi pembayaran hanya dapat dilakukan oleh role berwenang pada properti terkait.
- **Langkah Pengujian:**
  1. Coba verifikasi pembayaran tanpa menyertakan context/header `X-Property-ID`.
  2. Login dengan akun ber-role `viewer` dan coba lakukan verifikasi via PUT `/api/payments/:id/verify`.
  3. Login dengan akun `manager` dari Properti B, lalu coba verifikasi pembayaran milik Properti A.
  4. Login dengan akun `owner` atau `finance` dari Properti A, lalu lakukan verifikasi pembayaran milik Properti A.
- **Hasil yang Diharapkan:**
  - Langkah 1 ditolak dengan HTTP 400 (Property context is required).
  - Langkah 2 ditolak dengan HTTP 403 (Insufficient permission).
  - Langkah 3 menghasilkan HTTP 404/403 (Cross-property access blocked).
  - Langkah 4 berhasil dengan HTTP 200 OK.

---

### PVR-04: Immutabilitas Kwitansi (Receipt) & Integritas Checksum Kriptografis
- **Tujuan:** Memastikan data kwitansi yang diterbitkan dilindungi trigger database anti-mutasi dan memiliki checksum SHA-256 yang valid.
- **Langkah Pengujian:**
  1. Lakukan verifikasi pembayaran hingga record `payment_receipts` diterbitkan.
  2. Buka modal kwitansi dan periksa nilai `checksum` (SHA-256 string 64 karakter).
  3. Lakukan pengujian langsung pada database: coba jalankan query `UPDATE payment_receipts SET total_minor = 9999999 WHERE id = '...';` atau `DELETE FROM payment_receipts WHERE id = '...';`.
  4. Panggil endpoint `GET /api/payments/:id/receipt-data`.
- **Hasil yang Diharapkan:**
  - Eksekusi UPDATE atau DELETE pada tabel `payment_receipts` digagalkan oleh trigger database `reject_receipt_mutation` dengan pesan pengecualian `payment_receipts is immutable`.
  - Endpoint `receipt-data` memvalidasi checksum terhadap snapshot JSON dan mengonfirmasi integritas data tanpa rekayasa.

---

### PVR-05: Laporan Rekonsiliasi Pembayaran, Alokasi, Refund, Credit, & Settlement
- **Tujuan:** Memastikan dashboard rekonsiliasi keuangan menampilkan ringkasan arus kas yang seimbang.
- **Langkah Pengujian:**
  1. Login sebagai Finance atau Owner.
  2. Buka tab **Laporan Rekonsiliasi Keuangan**.
  3. Atur rentang tanggal awal bulan hingga hari ini, lalu klik **Muat Ulang**.
  4. Amati kartu KPI: Total Diterima, Total Teralokasi ke Tagihan, Kredit Penyewa, Net Settlement Kas, dan Status Banner Keseimbangan.
- **Hasil yang Diharapkan:**
  - Sistem menampilkan status **Laporan Rekonsiliasi Seimbang (Reconciled)**.
  - Persamaan rekonsiliasi terpenuhi: `Total Diterima == Total Teralokasi + Belum Teralokasi + Kredit Penyewa`.
  - Tabel rincian transaksi menampilkan baris transaksi yang sesuai dengan filter tanggal.

---

### PVR-06: Penanganan Overpayment sebagai Saldo Kredit Penyewa
- **Tujuan:** Memastikan pembayaran dengan nominal melebihi tagihan otomatis mencatat kelebihan ke buku besar kredit penyewa (`tenant_credits`).
- **Langkah Pengujian:**
  1. Tagihan invoice bernilai Rp 1.500.000.
  2. Penyewa mentransfer Rp 1.600.000 (kelebihan Rp 100.000).
  3. Staf memverifikasi pembayaran dengan mencentang opsi *Simpan kelebihan pembayaran sebagai saldo kredit penyewa*.
- **Hasil yang Diharapkan:**
  - Invoice terbayar penuh Rp 1.500.000.
  - Tabel `tenant_credits` mencatat kredit baru sebesar Rp 100.000 dengan alasan overpayment.
  - Nilai kredit penyewa tercermin pada laporan rekonsiliasi.

---

### PVR-07: Pengajuan dan Pemrosesan Refund Pembayaran
- **Tujuan:** Memvalidasi siklus hidup pengembalian dana (refund) dari status pengajuan hingga pencairan.
- **Langkah Pengujian:**
  1. Panggil endpoint `POST /api/payments/refunds` dengan data rekening bank dan alasan refund.
  2. Status awal refund adalah `requested`.
  3. Staf berwenang memperbarui status menjadi `disbursed` disertai referensi pencairan bank.
- **Hasil yang Diharapkan:**
  - Data refund tersimpan pada tabel `refund_requests`.
  - Nilai refund yang dicairkan otomatis mengurangi angka Net Settlement pada laporan rekonsiliasi.

---

### PVR-08: Pencatatan Outbox Event untuk Integrasi Notifikasi
- **Tujuan:** Memverifikasi bahwa setiap aksi pembayaran menulis event terstruktur ke tabel `notification_outbox`.
- **Langkah Pengujian:**
  1. Lakukan submit bukti pembayaran -> amati tabel `notification_outbox`.
  2. Lakukan verifikasi pembayaran -> amati tabel `notification_outbox`.
- **Hasil yang Diharapkan:**
  - Tercatat baris event `payment_proof_submitted` dan `payment_verified` dengan payload JSON lengkap dan status `pending` untuk diproses worker pengirim notifikasi.

---

### PVR-09: Sinkronisasi Status Invoice Berbasis Alokasi Pembayaran
- **Tujuan:** Memastikan trigger database `sync_invoice_status_on_allocation` otomatis mengubah status invoice saat alokasi disimpan.
- **Langkah Pengujian:**
  1. Invoice berstatus `issued` dengan total tagihan Rp 2.000.000.
  2. Masukkan alokasi pembayaran sebesar Rp 1.000.000 ke `invoice_allocations`.
  3. Periksa status invoice.
  4. Masukkan alokasi pembayaran kedua sebesar Rp 1.000.000.
  5. Periksa kembali status invoice.
- **Hasil yang Diharapkan:**
  - Setelah alokasi pertama: status invoice berubah menjadi `partially_paid`.
  - Setelah alokasi kedua: status invoice berubah menjadi `paid`.

---

### PVR-10: Cetak Kwitansi Resmi Elektronik dengan Format Cetak Bersih
- **Tujuan:** Memverifikasi dokumen kwitansi HTML/PDF dapat dibuka dan dicetak dengan tampilan bersih tanpa elemen UI yang tidak diinginkan.
- **Langkah Pengujian:**
  1. Buka kwitansi via tombol **Cetak / Unduh Kwitansi PDF**.
  2. Lakukan simulasi print (`Ctrl + P`).
- **Hasil yang Diharapkan:**
  - Tombol aksi tidak muncul pada hasil cetak (`@media print` terkonfigurasi).
  - Informasi rincian sewa, nama penyewa, nomor kamar, tanggal bayar, no. kwitansi resmi, dan status lunas tercetak dengan format kartu yang rapi.
