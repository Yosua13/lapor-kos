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

- [x] Dua perpindahan menuju kamar dan periode yang sama tidak dapat sukses bersamaan.
  - Implementasi: database exclusion constraint `room_transfers_target_no_overlap EXCLUDE USING gist (property_id WITH =, to_room_id WITH =, daterange(effective_date, target_end_date, '[]') WITH &&) WHERE (status IN ('pending', 'approved'))` dan row-level locking pada saat request & approval.
- [x] Histori kamar tenant dapat dilihat berdasarkan rentang tanggal.
  - Implementasi: endpoint `GET /api/tenants/:id/room-history` dan `GET /api/tenants/me/room-history` dengan filter `start_date` dan `end_date`, menampilkan timeline kronologis hunian kamar, harga sewa, durasi, dan catatan alasan pindah.
- [x] Perubahan biaya ditampilkan dalam preview dan disimpan sebagai adjustment yang dapat diaudit.
  - Implementasi: endpoint preview `/api/room-transfers/preview` menghitung prorata integer selisih sewa, deposit, move fee, dan kredit; saat dieksekusi otomatis menerbitkan invoice bertipe `adjustment` (`ADJ-TRF-...`) dengan audit trail lengkap pada `invoice_events`.
- [x] Proses gagal tidak meninggalkan kamar ter-reserve atau invoice setengah jadi.
  - Implementasi: fungsi `ExecuteTransfer` menjalankan seluruh alur (penutupan occupancy lama, pembukaan occupancy baru, revisi kontrak & snapshot versi, status kamar, dan invoice adjustment) dalam satu transaksi database atomik tunggal (`tx`). Rollback membatalkan seluruh operasi jika terjadi galat.
- [x] Tenant dan staf menerima status proses melalui notification outbox.
  - Implementasi: integrasi ke tabel `notification_outbox` untuk setiap perubahan status (`room_transfer_requested`, `room_transfer_approved`, `room_transfer_completed`, `room_transfer_rejected`, `room_transfer_cancelled`).

## Ketergantungan

- EPIC 03 untuk lifecycle kontrak dan occupancy.
- EPIC 04 dan EPIC 05 untuk invoice, outstanding, serta payment ledger.
- EPIC 08 untuk notification outbox.

## Detail Implementasi & Perubahan

1. **Database Migration (`023_room_transfer_workflow.sql`):**
   - Membuat tabel `room_transfers` lengkap dengan constraints dan status guards.
   - Constraint eksklusi `room_transfers_target_no_overlap` untuk kontrol konkurensi reservasi.
   - Relaksasi index unik invoice agar mendukung multi-adjustment per periode tagihan.
2. **Backend Engine & Repository:**
   - Model `model/room_transfer.go` untuk request, preview, transfer, dan histori hunian.
   - `billing/transfer_calculation.go` untuk perhitungan prorata presisi integer tanpa floating drift.
   - `repository/room_transfer_repository.go` untuk workflow lengkap pengajuan, preview, persetujuan, penolakan, eksekusi atomik, dan histori hunian.
   - `handler/room_transfer_handler.go` untuk endpoint REST API staff dan tenant self-service.
   - Registrasi rute property-scoped dan tenant role pada `httpapi/router.go`.
3. **Frontend Dashboard & Components:**
   - Fitur TypeScript `features/room-transfers/` (types, formatters, api client, unit tests).
   - Komponen modal `RoomTransferModal.tsx` dengan simulasi preview biaya live.
   - Komponen histori `TenantRoomHistory.tsx` dengan filter rentang tanggal dan visual timeline.
   - Halaman manajemen `rooms/transfers/page.tsx` dan komponen `RoomTransferList.tsx`.
   - Integrasi langsung pada profil tenant (`tenants/[id]/page.tsx`) dan navigasi kamar (`rooms/page.tsx`).
4. **Dokumen Pengujian Manual:**
   - `docs/manual_testing/epic-06-manual-test-cases.md` mencakup 10 skenario pengujian komprehensif (PKT-01 s/d PKT-10).
