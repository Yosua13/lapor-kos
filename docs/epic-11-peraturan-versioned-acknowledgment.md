# [EPIC 11] Peraturan Kos Versioned dan Acknowledgment

- **Prioritas:** P1
- **Tahap roadmap:** Stage 3 - Contract lifecycle
- **Aktor utama:** Owner, staf, tenant, sistem

## Ringkasan

Mengelola peraturan kos sebagai dokumen versioned dengan tanggal berlaku dan bukti acknowledgment. Perubahan aturan tidak menimpa histori serta tidak berlaku otomatis sebelum owner meninjau dan menerbitkannya.

## Tujuan

- Memberikan aturan yang jelas dan dapat dibuktikan untuk setiap tenant serta kontrak.
- Mencegah perubahan atau pembuatan aturan secara diam-diam ketika data hanya dibaca.

## Ruang Lingkup

- Draft rule set per property dengan item, kategori, urutan, tingkat kepentingan, dan effective date.
- Proses publish yang menghasilkan versi immutable.
- Notification dan acknowledgment tenant terhadap versi yang berlaku.
- Referensi rule version pada kontrak atau lease.
- Template awal sebagai bahan review, bukan aturan aktif otomatis.

## Rencana Implementasi

- **Backend:** membuat rule set, version, item, publish flow, acknowledgment, dan validasi effective date.
- **Frontend:** menyediakan editor draft, review perubahan, publish, histori versi, dan halaman acknowledgment tenant.
- **Integrasi:** menghubungkan versi aturan dengan aktivasi kontrak, notifikasi, serta proses izin tamu.

## Di Luar Cakupan

- Pembebanan penalti otomatis tanpa bukti dan approval.
- Penyusunan aturan legal otomatis oleh AI.

## Kriteria Penerimaan

- [ ] Membaca peraturan tidak membuat atau mengubah data di database.
- [ ] Versi yang sudah diterbitkan tidak dapat diubah dan tetap tersedia untuk histori.
- [ ] Tenant baru harus mengakui versi aktif sebelum kontrak dapat diaktifkan.
- [ ] Perubahan aturan tidak berlaku retroaktif tanpa proses amendment yang sah.
- [ ] Acknowledgment menyimpan tenant, lease, version, dan waktu secara dapat diaudit.

## Ketergantungan

- EPIC 01 untuk property scope.
- EPIC 02 untuk identity tenant dan consent.
- EPIC 08 untuk pemberitahuan versi baru.
- EPIC 13 untuk audit dan retention.
