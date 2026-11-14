## Deskripsi
Menyiapkan konfigurasi environment, struct data transaksi, dan service client di backend Golang untuk berkomunikasi dengan Midtrans Snap API (Sandbox mode).

## Ruang Lingkup
- Memungkinkan backend melakukan request pembuatan transaksi pembayaran ke server Midtrans Sandbox secara aman.
- Mendukung mode sandbox untuk portofolio tanpa memicu transaksi perbankan riil.

## Rincian Pekerjaan (Tasks)
- [ ] Tambahkan variabel lingkungan pada `backend/.env.example` dan `backend/.env`:
  - `MIDTRANS_SERVER_KEY`
  - `MIDTRANS_CLIENT_KEY`
  - `MIDTRANS_IS_PRODUCTION` (default: `false`)
  - `MIDTRANS_SNAP_URL` (`https://app.sandbox.midtrans.com/snap/v1/transactions`)
- [ ] Buat file service `backend/internal/service/midtrans_service.go` yang mengimplementasikan:
  - Header HTTP Basic Auth (`base64(ServerKey + ":")`).
  - Payload struct `SnapRequest` (`transaction_details`, `customer_details`, `item_details`).
  - Fungsi `CreateSnapTransaction(ctx, req) (*SnapResponse, error)`.
- [ ] Buat unit test `midtrans_service_test.go` untuk menguji serialisasi payload dan penanganan error respons API.

## Kriteria Penerimaan (Acceptance Criteria)
- [ ] Request ke Midtrans Snap API Sandbox mengembalikan `token` dan `redirect_url` yang valid.
- [ ] Secret key tidak terekspos dan tersimpan aman di `.env`.
