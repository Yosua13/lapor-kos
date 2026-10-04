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
7. Status pengiriman invitation dan verifikasi kontak dari tautan tersimpan.
   Peristiwa create, delivery, revoke, accept, upload dokumen, dan session
   revocation ditulis ke audit log append-only.

## Endpoint utama

- `POST/GET/DELETE /api/tenant-invitations` — staff, dengan property scope.
  `GET` mendukung pagination server-side melalui `paginated=true`, `page`,
  `page_size`, `status`, dan `search` tanpa mengubah response legacy.
- `GET /api/tenant-invitations/:token` dan `POST /api/tenant-invitations/activate` — publik, rate limited, memakai token capability.
- `GET /api/tenant-profiles` serta endpoint dokumen — staff berizin.
- `GET /api/tenants/me/documents/:document_id/sign` — tenant hanya untuk dokumennya sendiri.

Migrasi diterapkan berurutan:

1. `backend/migrations/016_tenant_profiles_invitations.sql`
2. `backend/migrations/017_add_invitation_delivery_method.sql`
3. `backend/migrations/018_property_scoped_tenant_details.sql`
4. `backend/migrations/019_harden_tenant_lifecycle.sql`

Migration `019` tidak menghapus histori. Migration ini menambahkan constraint
lintas-property, status delivery/contact verification, serta audit log
append-only. Deployment harus berhenti apabila validasi constraint menemukan
row lama yang menghubungkan profile, document, atau file antar-property; data
tersebut harus direkonsiliasi sebelum migration dijalankan ulang.
