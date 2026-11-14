## Deskripsi
Menyediakan REST API endpoint agar penghuni kos (tenant) dapat meminta Snap token untuk pembayaran tagihan aktif atau tertunggak.

## Ruang Lingkup
- Endpoint terotentikasi khusus peran tenant.
- Validasi status tagihan dan pembentukan order ID yang unik.

## Rincian Pekerjaan (Tasks)
- [x] Buat handler method `GenerateSnapToken` pada `backend/internal/handler/payment_handler.go`.
- [x] Validasi bahwa tagihan (`payment_id`) dimiliki oleh tenant yang sedang login dan berstatus `unpaid` atau `overdue`.
- [x] Format `order_id` yang unik dan informatif, misalnya: `LK-{payment_id[:8]}-{unix_timestamp}`.
- [x] Siapkan detail tagihan (biaya sewa, listrik, air, denda) sebagai `item_details` untuk transparansi rincian di popup Midtrans.
- [x] Daftarkan rute pada `backend/internal/httpapi/router.go`:
  - `POST /api/payments/:id/snap-token` dengan middleware autentikasi dan otorisasi tenant (`tenantRole`).
- [x] Tambahkan unit test dan integration test untuk verifikasi aksesibilitas endpoint dan penolakan tagihan milik user lain (isolasi multi-tenant).

## Kriteria Penerimaan (Acceptance Criteria)
- [x] Tenant hanya dapat membuat Snap token untuk tagihannya sendiri.
- [x] Jika tagihan sudah berstatus `paid`, API mengembalikan error `400 Bad Request`.
- [x] Endpoint mengembalikan JSON `{ "token": "...", "redirect_url": "..." }`.
