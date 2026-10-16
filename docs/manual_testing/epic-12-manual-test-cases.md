# Manual Test Cases: [EPIC 12] Keuangan Properti, Expense, dan Laporan

Dokumen ini menyediakan panduan pengujian manual end-to-end untuk memvalidasi seluruh kriteria penerimaan pada **Epic 12: Keuangan Properti, Expense, dan Laporan**.

---

## Ringkasan Skenario Pengujian

| Test ID | Skenario Pengujian | Acceptance Criteria Terkait | Aktor Penguji |
| :--- | :--- | :--- | :--- |
| **FIN-01** | Rekonsiliasi Angka Dashboard ke Transaksi Riil (Invoice, Payment, Allocation, Deposit, Expense) | **AC 1** | Owner / Finance |
| **FIN-02** | Pembayaran Berstatus Pending Tidak Dihitung Sebagai Cash Received | **AC 2** | Owner / Finance |
| **FIN-03** | Titipan Jaminan / Deposit Tidak Diakui Sebagai Revenue (Pendapatan Operasional) | **AC 3** | Owner / Finance / Auditor |
| **FIN-04** | Pencatatan & Persetujuan Biaya Operasional (Expenses) dengan Kategori & Vendor | Lingkup Utama | Owner / Manager / Maintenance |
| **FIN-05** | Penutupan Buku Periode (Period Close) Membekukan Mutasi Regular Backdated | **AC 4** | Owner / Finance |
| **FIN-06** | Pengajuan Penyesuaian Pasca Tutup Buku (Adjustments) dengan Alasan Audit | **AC 4** | Staff / Manager |
| **FIN-07** | Otorisasi Penyesuaian Pasca Tutup Buku, Audit Trail Events, & Trigger Immutability | **AC 4** | Owner / Finance Manager |
| **FIN-08** | Analisis Umur Piutang (Receivables Aging) Berdasarkan 4 Bucket Jatuh Tempo | Lingkup Utama | Finance / Owner |
| **FIN-09** | Pagination Server-Side pada Daftar Pengeluaran Tanpa Beban Halaman Utama | **AC 5** | Penguji / Owner |
| **FIN-10** | Ekspor Laporan Volume Besar (CSV) Dilengkapi Checksum SHA256 & Metadata Audit | **AC 5** | Owner / Auditor |
| **FIN-11** | Pembatasan Akses Berdasarkan Properti (Property-Scoped) dan RBAC Role | Keamanan Sistem | Multi-Role / Multi-Property |

---

## Rincian Test Cases

### FIN-01: Rekonsiliasi Angka Dashboard ke Transaksi Riil (AC 1)
- **Tujuan:** Memastikan setiap angka pada Dashboard Keuangan (`/reports`) dapat ditelusuri dan direkonsiliasi secara matematis ke baris transaksi invoice, payment, allocation, deposit, dan expense.
- **Prasyarat:** Login sebagai Owner atau Finance pada properti yang telah memiliki data tagihan sewa dan pembayaran.
- **Langkah Pengujian:**
  1. Masuk ke halaman **Laporan & Keuangan** (`/reports`).
  2. Pilih periode bulan dan tahun tertentu (contoh: Oktober 2026).
  3. Buka tab **"Ringkasan & Rekonsiliasi"**.
  4. Periksa kartu metrik:
     - Kas Masuk Riil (Verified)
     - Titipan Deposit (Liabilitas)
     - Pendapatan Terbiling (Akrual)
     - Pengeluaran Operasional
     - Net Operating Income (NOI Basis Kas = Kas Masuk - Pengeluaran)
     - Sisa Piutang Berjalan
  5. Bandingkan angka pada tabel **"Tabel Rekonsiliasi Usaha (Basis Kas vs Akrual)"** dengan rincian tab Invoice, Pembayaran, dan Pengeluaran.
- **Hasil yang Diharapkan:**
  - Angka Kas Masuk Riil sama persis dengan total pembayaran verified/completed pada bulan tersebut.
  - NOI Kas = Kas Masuk Riil dikurangi Pengeluaran Operasional.
  - NOI Akrual = Pendapatan Terbiling dikurangi Pengeluaran Operasional.
  - Tidak ada angka selisih fiktif atau data yang tercampur.

---

### FIN-02: Pembayaran Berstatus Pending Tidak Dihitung Sebagai Cash Received (AC 2)
- **Tujuan:** Menjamin pembayaran yang masih berstatus `pending` (belum diverifikasi/ditransfer) tidak tercatat sebagai uang kas masuk riil pada laporan keuangan.
- **Prasyarat:** Terdapat transaksi pembayaran berstatus `pending` di modul Pembayaran.
- **Langkah Pengujian:**
  1. Buka halaman `/payments`, pastikan ada pembayaran Rp 1.500.000 dengan status `pending`.
  2. Buka halaman `/reports` pada tab **"Ringkasan & Rekonsiliasi"**.
  3. Periksa kartu **Kas Masuk Riil (Verified)**.
  4. Periksa sub-label pendukung di bawah kartu.
- **Hasil yang Diharapkan:**
  - Nominal Rp 1.500.000 berstatus pending **TIDAK** ditambahkan ke dalam angka **Kas Masuk Riil**.
  - Dashboard menampilkan keterangan transparan: *"Pending Rp 1.500.000 diisolasi"* sehingga pemilik kos mengetahui adanya dana yang masih dalam proses verifikasi tanpa menganggapnya sebagai kas tersedia.

---

### FIN-03: Titipan Jaminan / Deposit Tidak Diakui Sebagai Revenue (AC 3)
- **Tujuan:** Memastikan uang titipan deposit penyewa dicatat secara ketat sebagai liabilitas (kewajiban neraca) dan tidak digabungkan ke pendapatan sewa maupun laba operasional (NOI).
- **Prasyarat:** Terdapat kontrak aktif dengan jaminan deposit (contoh: Deposit Rp 1.000.000).
- **Langkah Pengujian:**
  1. Buka halaman `/reports` pada tab **"Ringkasan & Rekonsiliasi"**.
  2. Periksa kartu **"Titipan Deposit (Liabilitas)"**.
  3. Periksa baris penerimaan pada **"Tabel Rekonsiliasi Usaha"**.
  4. Hitung NOI: periksa apakah deposit dimasukkan ke dalam perhitungan laba bersih operasional.
- **Hasil yang Diharapkan:**
  - Titipan deposit muncul di kartu liabilitas tersendiri dengan keterangan: *"Kewajiban titipan penyewa aktif (Bukan pendapatan)"*.
  - Deposit **TIDAK** dihitung sebagai komponen Billed Revenue maupun Cash Operating Income.
  - Nilai Net Operating Income (NOI) murni berasal dari selisih sewa/utilitas dan pengeluaran operasional.

---

### FIN-04: Pencatatan & Persetujuan Biaya Operasional (Expenses)
- **Tujuan:** Memvalidasi alur input biaya pengeluaran operasional dengan kategori, vendor, metode bayar, dan status otorisasi.
- **Prasyarat:** Login sebagai Owner, Manager, atau Finance.
- **Langkah Pengujian:**
  1. Buka halaman **Biaya & Pengeluaran** (`/expenses`).
  2. Klik tombol **"Catat Pengeluaran"**.
  3. Isi formulir:
     - Judul: *Servis Pompa Air Jetpump*
     - Kategori: *Perawatan & Servis*
     - Nominal: *Rp 450.000*
     - Tanggal: Tanggal hari ini
     - Vendor: *Bengkel Tehnik Maju*
     - Metode Bayar: *Transfer Bank*
     - Status Awal: *Menunggu Persetujuan*
  4. Klik **"Simpan Pengeluaran"**.
  5. Pada daftar pengeluaran, klik tombol **"Setujui"**.
  6. Setelah disetujui, klik tombol **"Bayar"**.
- **Hasil yang Diharapkan:**
  - Pengeluaran tersimpan dengan nomor registrasi unik `EXP-YYYYMM-XXXX`.
  - Status bertransisi secara tepat: `pending_approval` -> `approved` -> `paid`.
  - Nominal otomatis diperhitungkan pada metrik pengeluaran operasional di dashboard.

---

### FIN-05: Penutupan Buku Periode (Period Close) Membekukan Mutasi Regular (AC 4)
- **Tujuan:** Memastikan pengelola dapat menutup buku periode bulanan dan sistem mengunci mutasi tanggal mundur (backdated) tanpa prosedur penyesuaian.
- **Prasyarat:** Login sebagai Owner atau Finance Manager.
- **Langkah Pengujian:**
  1. Masuk ke halaman `/reports` dan pilih bulan yang ingin ditutup (contoh: Oktober 2026).
  2. Klik tombol **"Tutup Periode Ini"**.
  3. Masukkan catatan opini pemeriksa (contoh: *Opname kas selesai dan saldo bank klop*).
  4. Klik **"Konfirmasi Tutup Periode"**.
  5. Setelah periode berstatus *Periode Ditutup Buku (Closed)*, buka tab `/expenses`.
  6. Coba catat pengeluaran baru dengan tanggal pada periode yang telah ditutup tersebut.
- **Hasil yang Diharapkan:**
  - Status periode berubah menjadi `closed` dengan snapshot ringkasan tersimpan immutable di database.
  - Banner peringatan kuning terkunci muncul di atas halaman.
  - Upaya pembuatan pengeluaran regular baru pada tanggal periode tersebut ditolak dengan pesan error: *"Periode telah ditutup buku (closed). Penambahan pengeluaran baru pada periode ini wajib melalui menu Adjustment."* (HTTP 409 Conflict).

---

### FIN-06: Pengajuan Penyesuaian Pasca Tutup Buku (Adjustments) (AC 4)
- **Tujuan:** Menyediakan mekanisme audit terkontrol untuk merevisi atau menambahkan mutasi pada periode yang telah ditutup.
- **Prasyarat:** Periode target berstatus closed.
- **Langkah Pengujian:**
  1. Buka halaman `/reports` pada periode yang ditutup.
  2. Buka tab **"Tutup Periode & Adjustment"**.
  3. Klik tombol **"Ajukan Penyesuaian Audit"**.
  4. Pilih tipe: *Penyesuaian Biaya (Expense Adjustment)*.
  5. Masukkan nominal: *Rp 150.000*.
  6. Masukkan alasan audit: *Kwitansi pembelian lampu cadangan tertinggal saat tutup buku*.
  7. Klik **"Kirim Pengajuan"**.
- **Hasil yang Diharapkan:**
  - Penyesuaian berhasil didaftarkan dengan status `pending` dan nomor registrasi `ADJ-YYYYMM-XXXX`.
  - Entri audit trail `finance_period_adjustment_events` tercatat otomatis dengan event `requested` dan identitas pemohon.

---

### FIN-07: Otorisasi Penyesuaian, Audit Trail Events, & Trigger Immutability (AC 4)
- **Tujuan:** Memvalidasi hak persetujuan penyesuaian oleh Owner/Finance serta memastikan data adjustment yang telah disetujui tidak dapat dimanipulasi.
- **Prasyarat:** Terdapat adjustment berstatus pending.
- **Langkah Pengujian:**
  1. Login sebagai Owner pada properti tersebut.
  2. Buka tab **"Tutup Periode & Adjustment"**.
  3. Pada tabel penyesuaian, klik tombol **"Setujui"** pada item adjustment.
  4. Masukkan konfirmasi catatan.
  5. Periksa status adjustment yang berubah menjadi *Disetujui (Approved)*.
  6. Periksa database: coba lakukan update langsung via SQL `UPDATE finance_period_adjustments SET status = 'pending' WHERE id = ...`.
- **Hasil yang Diharapkan:**
  - Adjustment berubah menjadi status `approved` lengkap dengan `approved_by` dan `approved_at`.
  - Log audit event bertambah dengan entri `approved`.
  - Database trigger PostgreSQL `protect_approved_finance_adjustment` menolak manipulasi status adjustment yang sudah final dengan exception error.

---

### FIN-08: Analisis Umur Piutang (Receivables Aging) Berdasarkan 4 Bucket
- **Tujuan:** Memantau keterlambatan pembayaran tagihan sewa kos berdasarkan kategori umur piutang.
- **Prasyarat:** Terdapat invoice terbit yang belum lunas.
- **Langkah Pengujian:**
  1. Buka halaman `/reports` dan pilih tab **"Aging Piutang"**.
  2. Periksa 4 kartu ringkasan bucket:
     - Lancar (0 - 30 hari jatuh tempo)
     - 31 - 60 hari
     - 61 - 90 hari
     - &gt; 90 hari (Macet)
  3. Periksa tabel rincian invoice: pastikan kolom nomor kamar, nama penyewa, hari keterlambatan, dan sisa piutang tertampil akurat.
- **Hasil yang Diharapkan:**
  - Setiap tagihan tertunggak masuk ke dalam bucket umur yang sesuai dengan selisih hari tanggal jatuh tempo terhadap tanggal saat ini.
  - Jumlah total sisa piutang sesuai dengan penjumlahan tagihan tertunggak.

---

### FIN-09: Pagination Server-Side pada Daftar Pengeluaran (AC 5)
- **Tujuan:** Memastikan daftar transaksi pengeluaran dalam jumlah besar menggunakan server-side pagination sehingga performa browser tetap ringan dan responsif.
- **Prasyarat:** Properti memiliki lebih dari 15 transaksi pengeluaran.
- **Langkah Pengujian:**
  1. Buka halaman `/expenses`.
  2. Periksa bagian bawah tabel: terdapat teks indikator *"Menampilkan 1 - 15 dari X data"*.
  3. Klik tombol navigasi halaman berikutnya (`>`).
  4. Periksa parameter permintaan jaringan (`page=2&page_size=15`).
- **Hasil yang Diharapkan:**
  - Halaman memuat data batch kedua dengan cepat tanpa lag.
  - DOM browser hanya me-render 15 baris per halaman, mencegah konsumsi memori berlebih pada laporan besar.

---

### FIN-10: Ekspor Laporan Volume Besar (CSV) Dilengkapi Checksum SHA256 (AC 5)
- **Tujuan:** Memfasilitasi ekspor laporan transaksi (Arus Kas, Umur Piutang, Ringkasan Biaya, Laba Rugi, Buku Besar) ke format CSV dengan checksum integritas data.
- **Prasyarat:** Login sebagai Owner atau pengguna dengan kemampuan ekspor.
- **Langkah Pengujian:**
  1. Masuk ke halaman `/reports`.
  2. Klik tombol **"Ekspor CSV/PDF"**.
  3. Pilih jenis laporan: *Laporan Arus Kas (Cash Flow)*.
  4. Klik **"Download & Generate CSV"**.
  5. Buka tab **"Ekspor & Unduhan Laporan"**.
  6. Periksa baris riwayat ekspor yang baru digenerate: pastikan jumlah baris dan kode Checksum SHA256 tertampil.
  7. Klik tombol **"Unduh CSV"** dan buka file yang terunduh di aplikasi spreadsheet.
- **Hasil yang Diharapkan:**
  - File CSV terunduh secara instan dengan penamaan format `laporan-<tipe>-<start>_<end>.csv`.
  - Header kolom terformat rapi sesuai jenis laporan.
  - Checksum SHA256 tersimpan untuk membuktikan integritas file bagi kebutuhan audit akuntan eksternal.

---

### FIN-11: Property Scoping & RBAC Security
- **Tujuan:** Menjamin isolasi data keuangan antar properti dan pembatasan wewenang antar role (Owner, Finance, Manager, Maintenance, Viewer).
- **Prasyarat:** Memiliki akun dengan role berbeda pada properti uji.
- **Langkah Pengujian:**
  1. Login sebagai role **Maintenance**: pastikan menu `/expenses` dapat diakses untuk mencatat biaya perbaikan, namun tombol **"Tutup Periode Ini"** tidak muncul / tidak memiliki izin.
  2. Login sebagai role **Viewer**: pastikan data keuangan hanya dapat dibaca (read-only), tidak ada tombol aksi mutasi.
  3. Ganti `X-Property-ID` ke ID properti lain yang tidak berhak: lakukan request API ke `/api/v1/properties/:id/finance/dashboard`.
- **Hasil yang Diharapkan:**
  - Sistem menolak akses properti yang tidak sah dengan status `403 Forbidden` atau `404 Not Found`.
  - Setiap query SQL di backend terkunci ketat oleh klausa `property_id = $1`.

---

## Kesimpulan Evaluasi Pengujian

Seluruh Acceptance Criteria (AC 1 s/d AC 5) pada Epic 12 telah dipetakan ke dalam skenario pengujian manual yang komprehensif, mencakup akurasi kalkulasi rekonsiliasi kas, pemisahan deposit liability, penguncian period close, otorisasi adjustment, dan efisiensi ekspor dataset besar.
