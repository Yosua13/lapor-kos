# [EPIC 02] Tenant Profile, Invitation, dan Aktivasi Akun

- **Prioritas:** P0
- **Tahap roadmap:** Stage 3 - Contract lifecycle
- **Aktor utama:** Owner, staf, calon tenant, tenant

## Ringkasan

Mengganti pembuatan akun tenant dengan password bawaan menjadi proses invitation yang aman. Data calon penghuni, identitas login, persetujuan kebijakan, dan dokumen pribadi dikelola terpisah tetapi tetap saling terhubung.

## Tujuan

- Memberikan kontrol kepada tenant untuk mengaktifkan dan mengamankan akunnya sendiri.
- Melindungi dokumen identitas serta mencegah owner mengubah identitas login global milik pengguna.

## Ruang Lingkup

- Tenant profile dapat dibuat sebelum akun login tersedia.
- Invitation bersifat sekali pakai, memiliki masa berlaku, dapat dicabut, dan terikat property serta tenant.
- Aktivasi akun mencakup pembuatan password, verifikasi kontak, dan persetujuan policy/rules yang berlaku.
- Penyimpanan KTP, selfie, dan dokumen tenant secara private dengan signed URL berumur pendek.
- Pengaitan existing user ke tenant profile setelah proses verifikasi.

## Rencana Implementasi

- **Backend:** memisahkan tenant profile dari auth user, menambahkan invitation, consent record, session policy, dan kontrol akses file.
- **Frontend:** menyediakan alur undangan, aktivasi akun, verifikasi kontak, persetujuan kebijakan, dan status invitation bagi owner.
- **Keamanan:** mencatat akses dokumen dan mendukung pencabutan sesi ketika tenant tidak lagi aktif.

## Di Luar Cakupan

- Verifikasi biometrik atau layanan KYC pihak ketiga.
- Login sosial dan single sign-on.

## Kriteria Penerimaan

- [ ] Tidak ada password default di source code maupun database.
- [ ] Invitation yang sudah dipakai, kedaluwarsa, atau dicabut tidak dapat digunakan kembali.
- [ ] Existing user dapat ditautkan tanpa datanya ditimpa oleh owner.
- [ ] Dokumen identitas hanya tersedia melalui akses berizin dan signed URL singkat yang diaudit.
- [ ] Sesi tenant dapat dicabut sesuai kebijakan saat checkout atau penonaktifan.

## Ketergantungan

- EPIC 01 untuk property scope dan membership.
- EPIC 13 untuk private storage, session revocation, dan audit log.
- Integrasi acknowledgment peraturan dilanjutkan melalui EPIC 11 setelah fondasi invitation tersedia.
