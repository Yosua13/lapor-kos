# [EPIC 09] Izin Tamu dan Kerabat Menginap

- **Prioritas:** P1/P2
- **Tahap roadmap:** Stage 4 - Operational workflows
- **Aktor utama:** Tenant, owner, staf, petugas keamanan, tamu

## Ringkasan

Menyediakan proses formal untuk permintaan kunjungan atau menginap agar keputusan tidak hanya terjadi melalui chat informal. Data tamu dibatasi pada kebutuhan minimum dan mengikuti aturan serta periode hunian tenant.

## Tujuan

- Memberikan proses approval yang jelas bagi tenant dan pengelola properti.
- Menjaga keamanan properti dengan audit trail tanpa menyimpan data tamu secara berlebihan.

## Ruang Lingkup

- Request berisi data tamu minimum, hubungan, tujuan, waktu mulai/selesai, overnight, dan kendaraan bila diperlukan.
- Validasi terhadap active occupancy, lease end, kapasitas, jam, durasi, dan peraturan properti.
- Keputusan approve, reject, atau request change beserta alasan.
- Notifikasi kepada tenant dan staf terkait.
- Check-in/out serta overstay alert yang dapat diaktifkan per properti; visitor pass bersifat opsional.

## Rencana Implementasi

- **Backend:** membuat visitor request/event, rule validation, approval flow, retention policy, dan audit log.
- **Frontend:** menyediakan form permintaan, status keputusan, detail aturan, antrean approval, dan filter riwayat.
- **Integrasi:** mengirim notifikasi serta menyiapkan visitor pass sederhana bila dibutuhkan operasional.

## Di Luar Cakupan

- Integrasi perangkat gerbang, CCTV, atau pemindaian identitas pemerintah.
- Sistem reservasi fasilitas umum.

## Kriteria Penerimaan

- [ ] Tenant hanya dapat mengajukan izin untuk active occupancy miliknya.
- [ ] Request yang melewati akhir kontrak atau melanggar aturan wajib ditolak atau ditandai jelas.
- [ ] Setiap keputusan menyimpan actor, waktu, status, dan alasan.
- [ ] Data tamu hanya dapat diakses role terkait dan mengikuti masa retensi pendek.
- [ ] Riwayat dapat difilter berdasarkan property, tanggal, dan status.

## Ketergantungan

- EPIC 01 untuk property dan membership.
- EPIC 03 untuk active occupancy dan lease end.
- EPIC 08 untuk notifikasi serta EPIC 11 untuk rule version.
- EPIC 13 untuk privacy, audit, dan retention.
