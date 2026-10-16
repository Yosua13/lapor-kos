# Manual Test Cases: [EPIC 13] Security, Audit, Observability, dan Operability

Dokumen ini menyediakan panduan pengujian manual end-to-end untuk memvalidasi seluruh kriteria penerimaan pada **Epic 13: Security, Audit, Observability, dan Operability** (GitHub Issue Epic #52).

---

## Ringkasan Skenario Pengujian

| Test ID | Skenario Pengujian | Acceptance Criteria Terkait | Aktor Penguji |
| :--- | :--- | :--- | :--- |
| **SEC-01** | Pipeline CI Secret Scanning Memblokir Kredensial & Key Bocor | **AC 1** | Security Engineer / Developer |
| **SEC-02** | Release Gate Migrasi Skema Berurutan (Sequential Schema Check) | **AC 1** | DevOps / Database Admin |
| **SEC-03** | Release Gate Authorization Test & Isolasi Properti Multi-Tenant | **AC 1, AC 2** | QA / Security Tester |
| **SEC-04** | Backup Restore Drill Otomatis & Trigger Immutability Audit Trail | **AC 2** | System Administrator / SRE |
| **SEC-05** | Pencatatan Audit Trail Finansial Kritis Dilengkapi Correlation ID | **AC 3** | Finance / Auditor / Owner |
| **SEC-06** | Filter, Pencarian, & Inspeksi State Jejak Audit pada Dashboard UI | **AC 3** | Auditor / Owner / Finance |
| **SEC-07** | Proteksi Dokumen Sensitif & Akses via Signed URL Singkat (Maks 15 Menit) | **AC 4** | Tenant / Staff / Penetrasi Tester |
| **SEC-08** | Sanitasi & Redaksi Log Terstruktur (Safe Logging Masking) | **AC 4** | DevOps / Security Engineer |
| **SEC-09** | Validasi Kebersihan Artefak Rilis (Bebas Binary, Uploads, & Kredensial) | **AC 5** | Release Manager / DevOps |
| **SEC-10** | Observability Sistem, Health Probes (Liveness/Readiness), & Metrics | Operability & SRE | SRE / DevOps / Monitoring Tools |
| **SEC-11** | Revokasi Sesi Instan Pengguna & Tenant (Session Invalidation) | Keamanan Akun | Super Admin / Owner / Security |

---

## Rincian Test Cases

### SEC-01: Pipeline CI Secret Scanning Memblokir Kredensial & Key Bocor (AC 1)
- **Tujuan:** Memastikan pipeline CI menggagalkan build dan pull request jika terdeteksi file konfigurasi sensitif (.env), private key, live database URI, atau API token berentropi tinggi.
- **Prasyarat:** Lingkungan terminal dengan script scanner `go run ./scripts/ci/scan_secrets.go`.
- **Langkah Pengujian:**
  1. Jalankan scanner keamanan standar:
     ```bash
     go run ./scripts/ci/scan_secrets.go
     ```
  2. Verifikasi status scanner pada codebase normal (harus `0 violations`).
  3. Sebagai uji negatif (drill), buat file pengujian sementara `test_secret.txt` dengan isi token tiruan: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummysecret1234567890`.
  4. Jalankan kembali script scanner:
     ```bash
     go run ./scripts/ci/scan_secrets.go
     ```
  5. Hapus file sementara `test_secret.txt`.
- **Hasil yang Diharapkan:**
  - Codebase produksi lolos scan dengan status *SUCCESS*.
  - File pengujian yang berisi secret memicu pesan peringatan merah dan exit code `1` sehingga pipeline CI otomatis membatalkan release build.

---

### SEC-02: Release Gate Migrasi Skema Berurutan (AC 1)
- **Tujuan:** Menjamin seluruh berkas migrasi database tersusun berurutan dari `001` hingga `030` tanpa ada celah angka atau nama file yang menyimpang.
- **Prasyarat:** File migrasi tersimpan di direktori `backend/migrations/`.
- **Langkah Pengujian:**
  1. Jalankan script validasi migrasi:
     ```bash
     go run ./scripts/ci/validate_migrations.go
     ```
  2. Periksa urutan nomor urut dari `001_initial_schema.sql` hingga `030_security_audit_and_observability.sql`.
  3. Pastikan tidak ada berkas yang melompati nomor urut.
- **Hasil yang Diharapkan:**
  - Script menampilkan ringkasan verifikasi 30 file migrasi dengan status `ALL MIGRATIONS VALID`.
  - Tidak ditemukan celah (*gap*) atau nomor duplikat.

---

### SEC-03: Release Gate Authorization Test & Isolasi Properti Multi-Tenant (AC 1, AC 2)
- **Tujuan:** Memverifikasi bahwa pengujian otorisasi dan isolasi tenant dijalankan secara menyeluruh sebagai kriteria kelulusan rilis.
- **Prasyarat:** Backend Go test environment.
- **Langkah Pengujian:**
  1. Jalankan pengujian unit otorisasi backend:
     ```bash
     cd backend && go test -v ./internal/authz
     ```
  2. Jalankan pengujian middleware otorisasi properti dan tenant isolation:
     ```bash
     cd backend && go test -v ./internal/middleware
     ```
  3. Verifikasi skenario peran: Owner, Manager, Staff, Tenant, Viewer.
- **Hasil yang Diharapkan:**
  - Seluruh pengujian otorisasi `internal/authz` dan `internal/middleware` lulus 100%.
  - Upaya mengakses data properti lain oleh penyewa atau staf properti non-terkait secara konsisten ditolak dengan kode `403 Forbidden` / `404 Not Found`.

---

### SEC-04: Backup Restore Drill Otomatis & Trigger Immutability Audit Trail (AC 2)
- **Tujuan:** Memvalidasi kemampuan pemulihan basis data (disaster recovery) serta membuktikan bahwa log audit finansial dilindungi trigger PostgreSQL anti-tampering (tidak dapat diubah atau dihapus).
- **Prasyarat:** Database PostgreSQL lokal aktif.
- **Langkah Pengujian:**
  1. Jalankan script simulasi backup and restore drill:
     ```bash
     go run ./scripts/ci/backup_restore_drill.go
     ```
  2. Periksa output pengujian pembuatan backup dump dan verifikasi checksum SHA256.
  3. Periksa pengujian trigger immutability:
     - Percobaan `UPDATE financial_audit_logs`
     - Percobaan `DELETE FROM financial_audit_logs`
- **Hasil yang Diharapkan:**
  - Backup restore drill berhasil dan mencatat event audit `backup_restore_drill` pada sistem.
  - Setiap query SQL `UPDATE` atau `DELETE` pada tabel `financial_audit_logs` ditolak oleh PostgreSQL trigger `protect_financial_audit_logs` dengan pesan error: `financial audit logs are strictly append-only and cannot be modified or deleted`.

---

### SEC-05: Pencatatan Audit Trail Finansial Kritis Dilengkapi Correlation ID (AC 3)
- **Tujuan:** Memastikan setiap transaksi finansial penting (penutupan periode, penyesuaian/adj, biaya operasional, verifikasi pembayaran) merekam identitas pelaku, peran, waktu, alasan, nominal, dan `X-Correlation-ID`.
- **Prasyarat:** Login ke aplikasi sebagai Owner atau Finance.
- **Langkah Pengujian:**
  1. Lakukan aksi finansial, misalnya:
     - Buat pengeluaran baru di menu **Biaya & Pengeluaran** (`/expenses`).
     - Setujui pengeluaran tersebut.
     - Lakukan penutupan buku pada modul **Laporan & Keuangan** (`/reports`).
  2. Kirim request dengan header `X-Correlation-ID: audit-trace-12345`.
  3. Buka halaman **Audit & Keamanan** (`/audit`).
  4. Amati baris audit trail yang baru saja terbuat.
- **Hasil yang Diharapkan:**
  - Entri audit mencatat aksi dengan presisi:
    - `Aksi`: `expense_created`, `expense_approved`, atau `period_closed`.
    - `Pelaku`: Nama pengguna dan role yang melakukan aksi.
    - `Correlation ID`: Nilai ID korelasi (misal `audit-trace-12345` atau UUID v4 otomatis jika tidak disediakan).
    - `Nominal & Alasan`: Tercantum jelas.
    - Waktu transaksi menggunakan zona waktu ISO/UTC akurat.

---

### SEC-06: Filter, Pencarian, & Inspeksi State Jejak Audit pada Dashboard UI (AC 3)
- **Tujuan:** Memvalidasi kemampuan penelusuran histori finansial melalui dashboard frontend `/audit`.
- **Prasyarat:** Terdapat data log pada tabel `financial_audit_logs`.
- **Langkah Pengujian:**
  1. Buka halaman **Audit & Keamanan** (`/audit`).
  2. Pada tab **"Jejak Audit Finansial"**, uji filter:
     - Cari berdasarkan teks pelaku atau alasan pada input pencarian.
     - Pilih filter aksi spesifik (contoh: *Persetujuan Biaya*).
     - Pilih filter rentang tanggal.
  3. Klik tombol **"Lihat State"** pada salah satu baris audit log.
- **Hasil yang Diharapkan:**
  - Tabel audit langsung terfilter sesuai kriteria yang dipilih.
  - Modal **"Perbandingan State (Before / After Snapshot)"** muncul menampilkan JSON state sebelum dan sesudah mutasi secara rapi dengan format terstruktur.

---

### SEC-07: Proteksi Dokumen Sensitif & Akses via Signed URL Singkat (Maks 15 Menit) (AC 4)
- **Tujuan:** Menjamin file sensitif (seperti bukti pembayaran, KTP penyewa, dan nota operasional) tidak dapat diakses tanpa otorisasi, dan URL unduhan dibatasi durasi berlakunya maksimal 15 menit.
- **Prasyarat:** Memiliki URL lampiran bukti transfer atau dokumen identitas.
- **Langkah Pengujian:**
  1. Dapatkan tautan dokumen melalui modul Pembayaran atau Biaya.
  2. Periksa parameter URL: harus terdapat parameter signature otorisasi dan parameter kedaluwarsa waktu (`expires_at` / `signature`).
  3. Buka URL dokumen pada tab browser pribadi (incognito) tanpa sesi login setelah 15 menit.
- **Hasil yang Diharapkan:**
  - Dokumen terbuka saat token dan rentang waktu valid.
  - Setelah melewati 15 menit atau jika signature dimanipulasi, server merespons dengan error otorisasi (`403 Forbidden` atau `401 Unauthorized`), mencegah pencurian data sensitif.

---

### SEC-08: Sanitasi & Redaksi Log Terstruktur (Safe Logging Masking) (AC 4)
- **Tujuan:** Memastikan safe logger backend secara otomatis menyensor kata sandi, token otentikasi, dan nomor identitas kependudukan (NIK) pada terminal log server.
- **Prasyarat:** Backend server dijalankan dengan `go run ./cmd/api`.
- **Langkah Pengujian:**
  1. Kirim permintaan POST ke `/api/auth/login` dengan payload yang memuat parameter `password`.
  2. Kirim permintaan API dengan query parameter `?token=secret123&nik=3201012345678901`.
  3. Amati output log JSON pada terminal backend.
- **Hasil yang Diharapkan:**
  - Nilai parameter `password`, `token`, `secret`, `nik`, dan `otp` secara otomatis disensor menjadi `[REDACTED]`.
  - Tidak ada data kredensial atau identitas sensitif pengguna yang tersimpan dalam log audit operasional.

---

### SEC-09: Validasi Kebersihan Artefak Rilis (AC 5)
- **Tujuan:** Menjamin bahwa branch dan arsip rilis aplikasi tidak mengandung artefak berbahaya seperti binary file lokal (`.exe`, `.dll`, `.so`), direktori upload pengguna (`uploads/`), atau file kredensial (`.env`).
- **Prasyarat:** Script validator artefak rilis `scripts/ci/check_release_artifacts.go`.
- **Langkah Pengujian:**
  1. Jalankan script validasi:
     ```bash
     go run ./scripts/ci/check_release_artifacts.go
     ```
  2. Periksa hasil pemindaian struktur berkas repository.
- **Hasil yang Diharapkan:**
  - Scanner melaporkan `0 forbidden files found in tracked repository`.
  - Status rilis hijau: `RELEASE ARTIFACT CLEANLINESS CHECK PASSED`.

---

### SEC-10: Observability Sistem, Health Probes (Liveness/Readiness), & Metrics
- **Tujuan:** Memverifikasi kesiapan pemantauan kesehatan aplikasi (liveness probe untuk restart kubernetes/container, readiness probe untuk load balancer trafik) dan statistik runtime.
- **Prasyarat:** Backend API aktif.
- **Langkah Pengujian:**
  1. Kirim HTTP GET ke endpoint `/healthz` (atau `/api/health`).
  2. Kirim HTTP GET ke endpoint `/readyz` (atau `/api/ready`).
  3. Kirim HTTP GET ke endpoint `/api/metrics`.
  4. Buka halaman **Audit & Keamanan** (`/audit`) tab **"Observability & Kesiapan Sistem"**.
- **Hasil yang Diharapkan:**
  - `/healthz` mengembalikan HTTP `200 OK` dengan payload status `alive`.
  - `/readyz` mengembalikan HTTP `200 OK` dengan status koneksi database `connected` dan latency ping dalam milidetik.
  - `/api/metrics` menampilkan ringkasan runtime: jumlah goroutine, alokasi memori (MB), garbage collection count, uptime detik, serta open connections pool database.
  - Kartu metrik di antarmuka web menampilkan indikator warna hijau (*Sehat*) secara real-time.

---

### SEC-11: Revokasi Sesi Instan Pengguna & Tenant (Session Invalidation)
- **Tujuan:** Memastikan admin dapat segera mencabut seluruh sesi aktif pengguna tertentu jika dicurigai terjadi kompromi keamanan, sehingga token JWT lama langsung ditolak saat request berikutnya.
- **Prasyarat:** Login sebagai Owner / Super Admin.
- **Langkah Pengujian:**
  1. Buka halaman **Audit & Keamanan** (`/audit`) tab **"Kontrol Sesi & Kebijakan File"**.
  2. Pada panel **"Revokasi Sesi Pengguna Instan"**, masukkan User ID target dan alasan pencabutan (misal: *Indikasi akses mencurigakan*).
  3. Klik tombol **"Cabut Sesi Sekarang"**.
  4. Lakukan request menggunakan token pengguna yang baru saja dicabut.
- **Hasil yang Diharapkan:**
  - Notifikasi konfirmasi berhasil dicabut ditampilkan.
  - Request berikutnya dari pengguna yang dicabut langsung ditolak oleh middleware otentikasi dengan respons `401 Unauthorized: session has been revoked`.
