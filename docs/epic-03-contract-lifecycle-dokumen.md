# [EPIC 03] Contract Lifecycle dan Dokumen

- **Prioritas:** P1
- **Tahap roadmap:** Stage 3 - Contract lifecycle
- **Aktor utama:** Owner, staf, tenant, sistem

## Ringkasan

Membangun siklus kontrak yang dapat ditelusuri dari draft hingga berakhir, diperpanjang, atau dihentikan. Perubahan kontrak tidak lagi menimpa histori, dan setiap kontrak yang diterbitkan memiliki snapshot dokumen yang tetap.

## Tujuan

- Menjaga konsistensi status kontrak, hunian kamar, dan kalender.
- Menyediakan histori perubahan serta dokumen kontrak yang dapat diaudit.

## Ruang Lingkup

- Status kontrak: draft, pending tenant, scheduled, active, ended, terminated, renewed, dan cancelled.
- Validasi aktivasi berdasarkan ketersediaan kamar, data tenant minimum, persetujuan aturan, dan snapshot harga.
- Amendment, renewal, dan termination melalui version serta event yang menyimpan alasan.
- Occupancy period untuk menjaga histori penempatan tenant dan mencegah periode tumpang tindih.
- Pembuatan PDF kontrak beserta version dan hash dokumen.

## Rencana Implementasi

- **Backend:** membuat state machine kontrak, pencatatan version/event, occupancy period, dan layanan penerbitan dokumen.
- **Frontend:** menyediakan alur draft, review, aktivasi, amendment, renewal, termination, dan tampilan histori.
- **Integrasi:** menyelaraskan calendar serta modul lain agar membaca status dan tanggal dari sumber kontrak yang sama.

## Di Luar Cakupan

- Tanda tangan elektronik tersertifikasi.
- Negosiasi kontrak real-time di dalam aplikasi.

## Kriteria Penerimaan

- [ ] Perpindahan status yang tidak sah ditolak tanpa meninggalkan data setengah jadi.
- [ ] Satu kontrak aktif memiliki occupancy period yang valid dan tidak overlap.
- [ ] Amendment dan renewal mempertahankan versi serta histori sebelumnya.
- [ ] PDF yang diterbitkan merujuk snapshot kontrak yang tidak berubah.
- [ ] Kalender menampilkan status dan tanggal yang sama dengan contract service.

## Ketergantungan

- EPIC 01 untuk property scope dan otorisasi.
- EPIC 02 untuk tenant profile serta aktivasi akun.
- EPIC 11 untuk rule acknowledgment sebelum aktivasi.
- EPIC 13 untuk private document dan audit.
