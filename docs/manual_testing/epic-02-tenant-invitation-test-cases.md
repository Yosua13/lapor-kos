# Epic 02 — Tenant Profile, Invitation, dan Aktivasi Akun

Jalankan migrasi `backend/migrations/016_tenant_profiles_invitations.sql`, lalu
masuk sebagai owner atau manager yang memiliki akses **Penghuni & Kontrak** di
properti aktif.

| ID | Skenario | Langkah ringkas | Hasil yang diharapkan |
| --- | --- | --- | --- |
| TI-01 | Buat invitation | Buka `/tenants/invitations`, isi nama, email, telepon, lalu buat invitation. | Baris invitation berstatus `pending`; tautan aktivasi hanya muncul sesaat setelah dibuat; kata sandi tidak pernah ditampilkan. |
| TI-02 | Aktivasi akun baru | Buka tautan di browser incognito, isi password minimal 8 karakter, centang persetujuan, lalu aktifkan. | Profile menjadi `active`, invitation `accepted`, satu consent record tersimpan; aplikasi meminta verifikasi email sebelum login. |
| TI-03 | Token sekali pakai | Kirim ulang request aktivasi dari TI-02 atau buka tautannya kembali. | Ditolak dengan pesan bahwa invitation tidak lagi dapat diaktifkan. |
| TI-04 | Kedaluwarsa dan cabut | Buat invitation dengan masa berlaku 1 jam (API), atau cabut invitation dari daftar, kemudian buka tautannya. | Tautan yang dicabut ditolak; invitation lewat masa berlaku ditampilkan `expired` dan ditolak. |
| TI-05 | Tautkan akun yang ada | Buat invitation memakai email akun tenant yang telah aktif dan verified. Pada aktivasi isi password akun tersebut pada kolom verifikasi akun yang ada. | Invitation diterima dan profile terhubung ke user lama. Nama, email, dan telepon pada halaman Pengaturan Akun user lama tidak berubah. |
| TI-06 | Proteksi akun yang ada | Ulangi TI-05 tetapi pakai password akun lama yang salah. | Aktivasi ditolak dan invitation tetap `pending`. |
| TI-07 | Dokumen privat owner | Gunakan `POST /api/tenant-profiles/{profile_id}/documents` sebagai staff berizin, dengan multipart `file` dan `document_type=ktp`. Kemudian panggil endpoint sign. | Respons upload tidak berisi URL publik; URL signed berlaku 300 detik dan record akses dibuat. |
| TI-08 | Isolasi dokumen | Gunakan ID dokumen Profile A dari properti lain atau gunakan akun tenant lain pada `/api/tenants/me/documents/{id}/sign`. | Respons `404 Document not found`; URL signed tidak diterbitkan. |
| TI-09 | Pencabutan sesi checkout | Login sebagai tenant yang memiliki kontrak aktif, simpan token. Owner melakukan checkout tenant itu, kemudian panggil `GET /api/auth/me` dengan token lama. | Token lama mendapat `401 Session has been revoked`; tenant harus autentikasi kembali dan tidak memiliki akses setelah checkout. |

## Pemeriksaan database opsional

Gunakan query berikut saat pengujian lokal. Jangan tampilkan atau simpan token
mentah pada issue, log, atau screenshot.

```sql
SELECT status, expires_at, used_at, revoked_at
FROM tenant_invitations
ORDER BY created_at DESC;

SELECT p.email, p.status, p.user_id, c.policy_version, c.accepted_at
FROM tenant_profiles p
LEFT JOIN tenant_consent_records c ON c.tenant_profile_id = p.id
ORDER BY p.created_at DESC;

SELECT d.document_type, f.object_key, f.visibility, l.action, l.created_at
FROM tenant_documents d
JOIN files f ON f.id = d.file_id
LEFT JOIN tenant_document_access_logs l ON l.tenant_document_id = d.id
ORDER BY d.created_at DESC;
```
