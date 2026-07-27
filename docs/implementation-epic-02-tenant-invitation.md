# Implementasi Epic 02 — Tenant Profile, Invitation, dan Aktivasi Akun

Epic ini memisahkan data penghuni per properti dari identitas login global.
Owner atau staf tidak lagi membuat akun tenant beserta kata sandi acak. Mereka
membuat `tenant_profile` dan invitation; calon tenant menentukan kata sandi
sendiri ketika mengaktifkan invitation.

## Alur

1. Staff membuat profile calon tenant dan invitation yang memiliki token acak,
   hash token, status, serta masa berlaku.
2. Server hanya menyimpan hash SHA-256 token. Token mentah dikirim satu kali
   pada respons pembuatan undangan dan tidak pernah dimasukkan ke daftar
   invitation, database, atau log aplikasi.
3. Halaman publik aktivasi memeriksa token, password, dan persetujuan
   kebijakan. Untuk alamat email yang sudah memiliki akun, pemilik akun harus
   memasukkan password yang ada; data global user tidak diubah.
4. Aktivasi baru membuat account tenant belum-terverifikasi dan mengirim email
   verifikasi. Aktivasi akun yang sudah verified langsung menautkan profile.
5. Dokumen identitas ditulis ke namespace private
   `properties/{property}/tenant-profiles/{profile}`. Metadata, checksum, dan
   audit akses disimpan di database. Akses hanya melalui signed URL lima menit.
6. Checkout mengubah profile menjadi `inactive` dan mencatat revocation
   session. Middleware menolak JWT yang telah dicabut.

## Endpoint utama

- `POST/GET/DELETE /api/tenant-invitations` — staff, dengan property scope.
- `GET /api/tenant-invitations/:token` dan `POST /api/tenant-invitations/activate` — publik, rate limited, memakai token capability.
- `GET /api/tenant-profiles` serta endpoint dokumen — staff berizin.
- `GET /api/tenants/me/documents/:document_id/sign` — tenant hanya untuk dokumennya sendiri.

Migrasi yang diperlukan: `backend/migrations/016_tenant_profiles_invitations.sql`.
