## Deskripsi
Menerapkan webhook notification handler publik yang aman untuk menerima callback status transaksi dari Midtrans Sandbox secara asinkron, aman, dan idempoten.

## Ruang Lingkup
- Endpoint webhook publik tanpa autentikasi JWT token (karena dipanggil oleh server Midtrans).
- Validasi keamanan menggunakan SHA512 signature key.
- Pembaruan status transaksi dan penerbitan kwitansi digital secara otomatis.

## Rincian Pekerjaan (Tasks)
- [x] Implementasikan endpoint publik `POST /api/payments/webhook/midtrans` pada router backend.
- [x] Buat fungsi verifikasi signature key:
  `SHA512(order_id + status_code + gross_amount + server_key)`
  Tolak dengan status HTTP `401 Unauthorized` jika signature tidak valid.
- [x] Parsing status notifikasi Midtrans:
  - `settlement` atau `capture` (fraud_status == 'accept') -> Ubah status pembayaran menjadi `paid`.
  - `pending` -> Set status menjadi `pending`.
  - `expire` / `cancel` / `deny` -> Set status menjadi `unpaid` / `rejected`.
- [x] Eksekusi pembaruan dalam database transaction (`tx`):
  - Catat `paid_at = now()`, `provider = 'midtrans'`, dan `provider_ref = transaction_id`.
  - Terbitkan `payment_receipt` secara otomatis.
- [x] Pastikan idempotensi: jika `provider_ref` sudah pernah diproses, kembalikan HTTP `200 OK` tanpa membuat mutasi ganda.
- [x] Integrasikan pengiriman notifikasi instan (WhatsApp & In-App Notification) kepada tenant saat pembayaran lunas.

## Kriteria Penerimaan (Acceptance Criteria)
- [x] Webhook dengan signature tidak valid ditolak dengan HTTP 401.
- [x] Webhook yang valid berhasil mengubah status tagihan menjadi `paid` tanpa memerlukan verifikasi staf manual.
- [x] Webhook selalu merespons HTTP 200 OK dengan cepat.
