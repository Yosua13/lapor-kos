## Deskripsi
Menyediakan REST API endpoint agar penghuni kos (tenant) dapat meminta Snap token untuk pembayaran tagihan aktif atau tertunggak.

## Ruang Lingkup
- Endpoint terotentikasi khusus peran tenant.
- Validasi status tagihan dan pembentukan order ID yang unik.

## Rincian Pekerjaan (Tasks)
- [ ] Buat handler method `GenerateSnapToken` pada `backend/internal/handler/payment_handler.go`.
- [ ] Validasi bahwa tagihan (`payment_id`) dimiliki oleh tenant yang sedang login dan berstatus `unpaid` atau `overdue`.
- [ ] Format `order_id` yang unik dan informatif, misalnya: `LK-{payment_id[:8]}-{unix_timestamp}`.
- [ ] Siapkan detail tagihan (biaya sewa, listrik, air, denda) sebagai `item_details` untuk transparansi rincian di popup Midtrans.
- [ ] Daftarkan rute pada `backend/internal/httpapi/router.go`:
  - `POST /api/payments/:id/snap-token` dengan middleware autentikasi dan otorisasi tenant (`tenantRole`).
- [ ] Tambahkan unit test dan integration test untuk verifikasi aksesibilitas endpoint dan penolakan tagihan milik user lain (isolasi multi-tenant).

## Kriteria Penerimaan (Acceptance Criteria)
- [ ] Tenant hanya dapat membuat Snap token untuk tagihannya sendiri.
- [ ] Jika tagihan sudah berstatus `paid`, API mengembalikan error `400 Bad Request`.
- [ ] Endpoint mengembalikan JSON `{ "token": "...", "redirect_url": "..." }`.
