# Catatan Implementasi Epic 01 — Property Boundary & Membership

Dokumen ini mencatat hasil implementasi teknis GitHub Issue #40. Tujuan
utamanya adalah memastikan data operasional selalu berada dalam batas properti
yang tepat dan akses pengguna ditentukan oleh membership aktif.

## Ruang Lingkup

- Properti menjadi batas utama untuk kamar, kontrak, pembayaran, komplain,
  peraturan, kalender, laporan, dan file.
- Satu pengguna dapat memiliki membership pada beberapa properti.
- Role membership mencakup `property_owner`, `manager`, `finance`,
  `maintenance`, dan `viewer`.
- Frontend menyediakan pemilih properti aktif dan mengirim konteks properti
  pada setiap permintaan operasional.
- Backend tidak mempercayai ID properti dari klien tanpa memeriksa membership
  aktif dan permission yang diperlukan.
- Object storage menggunakan namespace per properti dan file privat dibuka
  melalui signed URL berdurasi pendek.

## Struktur Aplikasi

Backend dan frontend tetap dipisahkan:

```text
backend/
  cmd/api/                 entry point API
  internal/
    authz/                 permission map
    config/                konfigurasi runtime
    database/              koneksi database
    handler/               HTTP handler
    httpapi/               susunan route
    middleware/            autentikasi dan property access
    repository/            query terikat property_id
  migrations/              migrasi SQL berurutan

frontend/
  src/
    app/                   halaman Next.js
    components/layout/     shell dan navigasi
    features/properties/   active property dan membership
    features/session/      bootstrap sesi
    lib/                   API client terpusat
```

## Kontrak API

- Endpoint kanonis: `/api/v1/properties/:property_id/...`
- Endpoint kompatibilitas: `/api/...` dengan header `X-Property-ID`
- Server mengambil user dari JWT, memuat membership aktif, lalu memeriksa
  permission sebelum handler dijalankan.
- Query baca, ubah, dan hapus menggunakan `property_id` bersama ID resource.
  Resource dari properti lain diperlakukan sebagai tidak ditemukan atau
  ditolak.

## Rollout Database

1. Ambil backup database dan hentikan proses tulis selama migrasi akhir.
2. Jalankan `013_expand_property_scope.sql` untuk menambah struktur baru yang
   masih kompatibel dengan data lama.
3. Jalankan `014_backfill_property_scope.sql`.
4. Periksa tabel `property_migration_exceptions`. Jangan lanjut jika masih ada
   exception yang belum diselesaikan.
5. Jalankan `015_enforce_property_scope.sql` untuk mengaktifkan `NOT NULL`,
   foreign key gabungan, dan unique constraint per properti.
6. Deploy backend dan frontend versi baru, kemudian lakukan smoke test dengan
   minimal dua properti dan dua owner berbeda.

Migrasi aplikasi tidak dijalankan otomatis pada startup. Hal ini membuat
deployment bertahap dapat dikendalikan dan kegagalan backfill tidak tertutup
oleh proses boot aplikasi.

## Checklist Verifikasi

- Pengguna hanya melihat properti dengan membership aktif.
- Membership yang dicabut langsung kehilangan akses.
- Nomor kamar yang sama dapat digunakan pada properti berbeda.
- ID resource milik properti lain tidak dapat dibaca, diubah, dihapus, masuk
  laporan, atau digunakan untuk mengambil file.
- Pergantian properti mereset data halaman dan permintaan berikutnya memakai
  konteks baru.
- Tenant tetap hanya dapat mengakses kontrak, pembayaran, kuitansi, dan
  komplain miliknya.
- Migrasi menolak data ambigu sebelum constraint akhir diterapkan.

## Catatan Operasional

Role akun (`owner` atau `tenant`) tetap menjadi identitas global untuk
kompatibilitas login. Wewenang operasional staf berasal dari role membership
properti. Karena itu, pengguna tenant yang juga menjadi staf properti dapat
berpindah ke workspace properti tanpa mengubah identitas akunnya.
