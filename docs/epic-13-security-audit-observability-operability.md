# [EPIC 13] Security, Audit, Observability, dan Operability

- **Prioritas:** P0
- **Tahap roadmap:** Stage 0 dan fondasi lintas-epic
- **Aktor utama:** Engineering, operations, administrator, security reviewer

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

## Rencana Implementasi

- **Platform dan CI:** menambahkan secret/dependency scan, quality gate, backup schedule, restore test, serta pemeriksaan artefak rilis.
- **Backend:** menerapkan audit event, correlation ID, safe logging, session policy, rate limit, dan endpoint health/readiness.
- **Operasi:** menyiapkan dashboard minimum, alert, incident runbook, retention, dan bukti restore berkala.

## Di Luar Cakupan

- Sertifikasi keamanan formal seperti SOC 2 atau ISO 27001 pada fase awal.
- Security operation center enterprise penuh.

## Kriteria Penerimaan

- [ ] CI gagal ketika menemukan secret, migrasi gagal, authorization test gagal, atau critical vulnerability.
- [ ] Restore test dan pengujian isolasi antar-owner menjadi release gate.
- [ ] Setiap perubahan finansial kritis menyimpan actor, waktu, alasan, dan correlation ID.
- [ ] File sensitif tidak publik dan aksesnya menggunakan authorization serta signed URL singkat.
- [ ] Artefak rilis tidak berisi credential, binary lokal, atau upload pengguna.

## Ketergantungan

- Tidak memiliki ketergantungan epic fungsional dan harus dimulai lebih dahulu.
- Membutuhkan keputusan environment, akses infrastruktur, kebijakan backup, retention, serta penanggung jawab insiden.
