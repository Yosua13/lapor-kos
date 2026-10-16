# [EPIC 13] Security, Audit, Observability, dan Operability

- **Prioritas:** P0
- **Tahap roadmap:** Stage 0 dan fondasi lintas-epic
- **Aktor utama:** Engineering, operations, administrator, security reviewer
- **GitHub Issue Epic:** #52 ([https://github.com/Yosua13/lapor-kos/issues/52](https://github.com/Yosua13/lapor-kos/issues/52))

## Ringkasan

Membangun kontrol keamanan dan operasi minimum sebelum Lapor Kos digunakan dengan data identitas serta transaksi nyata. Epic ini menjadi release gate dan fondasi bagi seluruh epic lain, bukan pekerjaan tambahan di akhir pengembangan.

## Tujuan

- Mengurangi risiko kebocoran secret, file publik, akses tidak sah, dan kehilangan data.
- Memastikan perubahan penting dapat diaudit, dipantau, dipulihkan, dan dioperasikan dengan aman.

## Ruang Lingkup

- Secret management, rotation, scanning, least privilege, dan pemisahan environment.
- Audit log untuk actor, property, action, entity, reason, waktu, dan correlation ID.
- Structured log, metrics, tracing, alert, job monitoring, dan runbook tanpa PII atau secret.
- Backup terenkripsi, restore drill, migration rollback, health/readiness check, dan graceful shutdown.
- Session revocation, distributed rate limit, dependency/vulnerability scan, dan private file policy.

## Rencana & Hasil Implementasi

- **Platform dan CI:**
  - Automated Secret Scanner (`scripts/ci/scan_secrets.go`): Mendeteksi private key, token berentropi tinggi, URL database produksi, dan file konfigurasi sensitif.
  - Sequential Migration Validator (`scripts/ci/validate_migrations.go`): Memvalidasi 30 skrip migrasi tersusun berurutan dari `001` hingga `030` tanpa celah.
  - Release Artifact Cleanliness Checker (`scripts/ci/check_release_artifacts.go`): Memastikan repository dan bundle rilis bebas dari file binary executable (`.exe`, `.dll`), upload pengguna, dan credentials.
  - Automated Backup & Restore Drill (`scripts/ci/backup_restore_drill.go`): Simulasi snapshot berkala, validasi SHA256 checksum, pengujian restore skema & data, serta pengujian trigger immutability.
  - GitHub Actions Multi-Gate CI Pipeline (`.github/workflows/ci.yml`): Menggabungkan Gate 1 (Secret & Cleanliness), Gate 2 (Backend Authz & Isolation Tests), Gate 3 (Sequential Migration Verification), Gate 4 (Frontend Typecheck, Vitest, & Build), dan Gate 5 (Drill Restore & Disaster Recovery).
- **Backend:**
  - Database Migration `030_security_audit_and_observability.sql`:
    - Tabel `financial_audit_logs`: append-only ledger untuk seluruh aksi finansial kritis (tutup buku, reopening, koreksi/penyesuaian, approval biaya, pembayaran biaya, verifikasi invoice).
    - Trigger PostgreSQL `protect_financial_audit_logs`: menolak `UPDATE` dan `DELETE` untuk menjamin integritas histori bisnis.
    - Tabel `user_session_revocations`: mencatat pembatalan sesi instan per pengguna/tenant.
    - Tabel `system_health_audit_events`: mencatat drill pemulihan dan kejadian darurat sistem.
  - Correlation ID Middleware (`internal/middleware/correlation.go`): Meneruskan atau meng-generate `X-Correlation-ID` unik per request dan menyuntikkannya ke context execution.
  - Safe Structured Logger (`internal/middleware/safe_logger.go`): Logger JSON otomatis menyensor field sensitif (`password`, `token`, `secret`, `nik`, `otp`) pada query string dan payload body.
  - Health & Readiness Probes (`/healthz`, `/readyz`, `/api/health`, `/api/ready`, `/api/metrics`): Memantau ketersediaan DB, latensi ping, status migrasi, memori, dan goroutines.
  - Session Revocation API: Endpoint `/api/auth/revoke-sessions` dan `/api/security/sessions/revoke` untuk pembatalan token JWT secara instan saat terjadi indikasi kompromi akun.
- **Frontend:**
  - Halaman Dashboard Audit & Keamanan (`/audit`) dengan 4 Tab Interaktif:
    1. **Jejak Audit Finansial:** Filter berdasarkan jenis aksi, entitas, correlation ID, dan rentang tanggal, dilengkapi modal perbandingan State (Before vs After snapshot JSON) dan tombol copy Correlation ID.
    2. **Observability & Kesiapan Sistem:** Metrik real-time status database, latensi koneksi, pool koneksi aktif/idle, alokasi memori, goroutines, dan uptime server.
    3. **Kontrol Sesi & Kebijakan Dokumen:** Form revokasi sesi pengguna instan dan visualisasi kebijakan signed URL singkat (maks 15 menit) untuk dokumen KTP/bukti transfer.
    4. **Release Gate Checklist:** Status kepatuhan 5 gerbang keamanan rilis (Secret Scanning, Sequential Migration, Authorization Gates, Backup & Restore Drill, Cleanliness Check).

## Di Luar Cakupan

- Sertifikasi keamanan formal seperti SOC 2 atau ISO 27001 pada fase awal.
- Security operation center enterprise penuh.

## Kriteria Penerimaan

- [x] CI gagal ketika menemukan secret, migrasi gagal, authorization test gagal, atau critical vulnerability.
- [x] Restore test dan pengujian isolasi antar-owner menjadi release gate.
- [x] Setiap perubahan finansial kritis menyimpan actor, waktu, alasan, dan correlation ID.
- [x] File sensitif tidak publik dan aksesnya menggunakan authorization serta signed URL singkat (maks 15 menit).
- [x] Artefak rilis tidak berisi credential, binary lokal, atau upload pengguna.

## Dokumentasi Terkait

- Panduan Pengujian Manual: [docs/manual_testing/epic-13-manual-test-cases.md](file:///d:/project_yosua/lapor-kos/docs/manual_testing/epic-13-manual-test-cases.md)
