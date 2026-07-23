# [EPIC 06] Pindah Kamar Terintegrasi

- **Prioritas:** P1
- **Tahap roadmap:** Stage 4 - Operational workflows
- **Aktor utama:** Tenant, owner, staf, finance, sistem

## Ringkasan

Mengubah proses pindah kamar menjadi workflow terintegrasi yang mempertahankan histori hunian serta menyesuaikan kontrak, tagihan, utility, dan deposit secara aman. Proses tidak lagi hanya mengganti referensi kamar pada kontrak.

## Tujuan

- Mencegah dua tenant memperoleh kamar yang sama pada periode yang bertabrakan.
- Menjaga perubahan biaya dan histori kamar tetap dapat ditelusuri.

## Ruang Lingkup

- Transfer request dengan target kamar, alasan, tanggal efektif, pengaju, dan approval.
- Preview perhitungan prorata sewa, utility, move fee, credit, outstanding, dan deposit.
- Reservasi target room secara aman untuk tanggal efektif.
- Penutupan occupancy lama dan pembukaan occupancy baru dalam satu proses transaksi.
- Invoice adjustment, notification, dan histori perpindahan.

## Rencana Implementasi

- **Backend:** membuat transfer case, validasi availability, reservation/locking, eksekusi atomic, dan event outbox.
- **Frontend:** menyediakan form permintaan, preview biaya, approval, status proses, serta histori kamar tenant.
- **Data:** menyimpan lease room period, adjustment invoice, dan perubahan deposit tanpa menimpa data lama.

## Di Luar Cakupan

- Penjadwalan jasa pindahan atau inventaris barang pribadi tenant.
- Perubahan harga tanpa amendment atau pricing snapshot.

## Kriteria Penerimaan

- [ ] Dua perpindahan menuju kamar dan periode yang sama tidak dapat sukses bersamaan.
- [ ] Histori kamar tenant dapat dilihat berdasarkan rentang tanggal.
- [ ] Perubahan biaya ditampilkan dalam preview dan disimpan sebagai adjustment yang dapat diaudit.
- [ ] Proses gagal tidak meninggalkan kamar ter-reserve atau invoice setengah jadi.
- [ ] Tenant dan staf menerima status proses melalui notification outbox.

## Ketergantungan

- EPIC 03 untuk lifecycle kontrak dan occupancy.
- EPIC 04 dan EPIC 05 untuk invoice, outstanding, serta payment ledger.
- EPIC 08 untuk notification outbox.
