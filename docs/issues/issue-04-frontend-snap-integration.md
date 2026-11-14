## Deskripsi
Mengintegrasikan Snap SDK pada antarmuka frontend (Vite + React 19) dan menambahkan alur pembayaran online instan pada portal penghuni.

## Ruang Lingkup
- Integrasi library klien `snap.js` (Sandbox).
- Penyediaan pilihan metode pembayaran online vs transfer manual di UI.
- Penanganan callback Snap untuk auto-refresh halaman dan penerbitan kwitansi.

## Rincian Pekerjaan (Tasks)
- [ ] Muat skrip `snap.js` di `frontend/index.html` dengan konfigurasi `data-client-key` sandbox.
- [ ] Buat fungsi pemanggil API `getSnapToken(paymentId)` pada `frontend/src/features/payments/api.ts`.
- [ ] Perbarui modal pembayaran penghuni di `frontend/src/app/(dashboard)/payments/page.tsx`:
  - Tambahkan kartu opsi "Bayar Instan Online (Midtrans Sandbox)".
  - Tampilkan logo channel populer (QRIS, GoPay, Virtual Account BCA, Mandiri, BNI, BRI).
  - Panggil `window.snap.pay(token, { onSuccess, onPending, onError, onClose })`.
- [ ] Tangani event callback Snap:
  - `onSuccess`: Tampilkan notifikasi sukses, refresh daftar pembayaran, dan sediakan tombol cetak kwitansi.
  - `onPending`: Beritahu tenant untuk menyelesaikan transfer di simulator/channel terkait.
  - `onError`: Tampilkan pesan kegagalan transaksi yang bersahabat.
- [ ] Tetap pertahankan opsi "Transfer Manual & Upload Bukti" sebagai metode cadangan.
- [ ] Dokumentasikan langkah pengujian simulator Midtrans Sandbox (Virtual Account & QRIS Simulator) untuk keperluan review portofolio.

## Kriteria Penerimaan (Acceptance Criteria)
- [ ] Popup Midtrans Snap berhasil muncul di layar saat tenant mengklik tombol bayar.
- [ ] Setelah pembayaran disimulasikan di sandbox, status tagihan langsung berubah menjadi Lunas di frontend.
- [ ] Seluruh unit test frontend tetap 100% lulus.
