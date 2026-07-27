# Manual Test Cases - Epic 02: Tenant Profile, Invitation, dan Aktivasi Akun

Dokumen ini memvalidasi seluruh ruang lingkup dan kriteria penerimaan
[Epic #41](https://github.com/Yosua13/lapor-kos/issues/41). Jalankan pada
environment lokal atau staging; jangan pernah menempelkan token invitation,
signed URL, kata sandi, atau dokumen identitas asli ke issue maupun screenshot.

## Prasyarat

1. Terapkan migration berurutan `016_tenant_profiles_invitations.sql`,
   `017_add_invitation_delivery_method.sql`, dan
   `018_property_scoped_tenant_details.sql`.
2. Atur `SUPABASE_TENANT_DOCUMENT_BUCKET=tenant-documents` pada `backend/.env`.
   Bucket tersebut harus **private** (`public=false`), dengan batas 5 MB serta
   tipe PDF, JPG/JPEG, PNG, atau WEBP. Restart backend setelah mengubah env.
3. Login sebagai Owner atau Manager yang memiliki akses **Penghuni & Kontrak**
   pada properti aktif.
4. Siapkan:
   - satu email dan nomor WhatsApp baru yang dapat diakses;
   - satu akun tenant existing yang aktif, sudah verifikasi email, dan kata
     sandinya diketahui untuk pengujian link akun;
   - dua properti berbeda atau dua tenant berbeda untuk pengujian isolasi data.
5. Gunakan browser incognito atau profil browser kedua saat bertindak sebagai
   calon tenant/tenant agar token login owner tidak tercampur.

## Ringkasan Hasil

| Area | Status | Catatan / bukti singkat |
|---|---|---|
| Invitation dan aktivasi | Pass / Fail | |
| Existing user dan profile scope | Pass / Fail | |
| Dokumen privat | Pass / Fail | |
| Pencabutan sesi | Pass / Fail | |

## Test Cases

| ID | Skenario | Langkah uji | Hasil yang diharapkan | Status |
|---|---|---|---|---|
| E02-01 | Konfigurasi siap | Buka halaman invitation dan halaman dokumen tenant. Coba unggah file PDF kecil setelah profil tenant aktif. | Tidak ada error `Private document storage is not configured`. Upload hanya bekerja bila bucket tenant private dan backend sudah direstart. | |
| E02-02 | Field invitation wajib | Buka `/tenants/invitations`. Kosongkan nama, email, atau nomor WhatsApp lalu klik kirim. Isi email/nomor tidak valid. | Pesan error muncul di bawah field terkait. Nama, email, dan nomor WhatsApp wajib diisi; nomor mengikuti format `+62 812-3456-7890`. | |
| E02-03 | Buat invitation melalui email | Isi nama, email, dan nomor WhatsApp valid. Pilih kanal **Email** di bagian bawah, lalu kirim. | Invitation baru tampil sebagai `Pending`; tautan aktivasi hanya dikirim ke email. Owner tidak melihat token mentah maupun password. | |
| E02-04 | Buat invitation melalui WhatsApp | Gunakan calon tenant lain. Isi ketiga field yang sama, pilih **WhatsApp**, lalu kirim. | Invitation `Pending`; tautan aktivasi dikirim ke nomor WhatsApp. Email tetap disimpan sebagai data kontak, tetapi pengiriman hanya ke kanal yang dipilih. | |
| E02-05 | Daftar invitation | Buat lebih dari jumlah data per halaman. Ubah jumlah tampilan dan pindah halaman; juga cek saat tidak ada data pada properti baru. | Menampilkan rentang data, pilihan jumlah tampilan, navigasi halaman, status invitation, dan pesan kosong `Belum ada undangan` bila belum ada data. | |
| E02-06 | Aktivasi akun baru - validasi | Buka tautan dari E02-03 pada incognito. Kosongkan password atau checkbox kebijakan, lalu submit. Coba password kurang dari 8 karakter. | Error tampil pada field yang tepat. Aktivasi tidak diproses tanpa password minimal 8 karakter dan persetujuan kebijakan. | |
| E02-07 | Aktivasi akun baru - sukses | Isi password kuat, setujui kebijakan/peraturan, lalu aktifkan. Buka email verifikasi dan selesaikan verifikasi. | Tenant profile menjadi `active`; invitation menjadi `accepted`; tenant menerima verifikasi kontak dan setelah verifikasi diarahkan ke login pada tab yang sama. | |
| E02-08 | Invitation sekali pakai | Setelah E02-07, buka kembali tautan yang sama atau submit ulang request aktivasi. | Ditolak dengan pesan invitation tidak lagi dapat diaktifkan. Tidak ada akun/profile tambahan. | |
| E02-09 | Invitation kedaluwarsa atau dicabut | Buat invitation dengan `expires_in_hours: 1` lewat API lalu uji setelah kedaluwarsa, atau gunakan tombol **Cabut** pada invitation `Pending` dan buka tautannya. | Status daftar menunjukkan `Expired` atau `Revoked`; tautan tidak dapat dipakai untuk aktivasi. | |
| E02-10 | Link akun existing | Buat invitation dengan email akun tenant existing. Pada aktivasi pilih **Saya sudah memiliki akun**, masukkan password akun lama, setujui kebijakan, lalu submit. | Tidak ada password baru yang diminta. Invitation diterima dan profile properti terhubung ke user existing yang sudah aktif serta verified. | |
| E02-11 | Proteksi akun existing | Ulangi E02-10 dengan password existing salah atau akun belum verified. | Aktivasi ditolak; invitation tetap `Pending`; data akun global tidak berubah. | |
| E02-12 | Owner hanya mengubah profile properti | Setelah E02-10, owner ubah nama, nomor, tanggal lahir, pekerjaan, atau kontak darurat pada detail tenant properti A. Login sebagai tenant dan periksa Pengaturan Akun/global profile; lalu lihat tenant tersebut dari properti B bila ada. | Perubahan tersimpan pada profile tenant properti A saja. Email, password, dan identitas login global tidak dapat diubah owner; detail pada properti lain tidak tertimpa. | |
| E02-13 | Tidak ada jalur password bawaan | Dari halaman tambah kamar, coba memasukkan calon tenant yang belum pernah diundang/aktivasi. | Sistem menolak pembuatan akun tenant dari jalur kamar dan mengarahkan owner membuat invitation. Tidak ada password default yang dibuat atau ditampilkan. | |
| E02-14 | Unggah dokumen privat | Buka `/tenants/{tenant-id}/documents` untuk tenant aktif. Unggah KTP, selfie, dan dokumen tambahan dengan file yang diizinkan. Coba file >5 MB atau format selain PDF/JPG/PNG/WEBP. | File valid tersimpan dan hanya metadata yang tampil. File invalid ditolak. Tidak ada URL publik permanen pada respons atau daftar tenant. | |
| E02-15 | Signed URL dan audit | Pada halaman dokumen klik **Lihat** untuk KTP/selfie. Tutup modal lalu buka kembali. | Dokumen terbuka dalam modal menggunakan URL sementara; akses tidak membuka URL permanen di daftar. Setiap klik Lihat menghasilkan catatan audit `signed_url`; URL memiliki masa berlaku 300 detik. | |
| E02-16 | Isolasi dokumen dan endpoint generik | Dengan owner properti B atau tenant lain, coba sign `document_id` milik profile/properti A. Sebagai owner, coba `/api/files/sign?key=properties/{property-A}/tenant-profiles/...`. | Akses lintas profile/properti mendapat `404 Document not found`. Endpoint generik tidak dapat menandatangani namespace `tenant-profiles`; signed URL tidak terbit. | |
| E02-17 | Checkout mencabut sesi | Login sebagai tenant dengan kontrak aktif pada browser kedua. Owner melakukan checkout dari detail tenant. Kembali ke browser tenant dan muat ulang halaman atau panggil API. | Sesi/token lama ditolak dengan `401 Session has been revoked`; tenant perlu login kembali dan profile pada properti tersebut menjadi inactive. | |
| E02-18 | Penonaktifan non-checkout mencabut sesi | Uji salah satu aksi: ubah status kontrak aktif menjadi nonaktif, hapus kontrak aktif, atau hapus kamar dengan opsi mengakhiri tenancy. Setelah aksi, gunakan token tenant lama. | Sesi lama juga dicabut dan tenant profile pada properti tersebut inactive. Ini memastikan policy berlaku di luar tombol checkout. | |

## Pengujian API Tambahan

Jalankan dari DevTools saat login sebagai Owner/Manager berizin. Ganti seluruh
placeholder dan jangan menyimpan nilai token pada dokumen hasil pengujian.

```js
const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
const propertyID = '<property-id>';

fetch('http://localhost:8081/api/tenant-invitations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Property-ID': propertyID,
  },
  body: JSON.stringify({
    full_name: 'Calon Tenant Test',
    email: 'calon.tenant@example.com',
    phone: '+6281234567890',
    delivery_method: 'email',
    expires_in_hours: 72,
  }),
}).then(async (response) => ({ status: response.status, body: await response.json() }));
```

Untuk menguji akses dokumen lintas properti, gunakan token tenant lain atau
owner properti lain. Hasil benar adalah `404` tanpa field `url`.

```js
const documentID = '<document-id-properti-lain>';

fetch(`http://localhost:8081/api/tenants/me/documents/${documentID}/sign`, {
  headers: { Authorization: `Bearer ${token}` },
}).then(async (response) => ({ status: response.status, body: await response.json() }));
```

## Pemeriksaan Database Opsional

Jalankan hanya pada database pengujian. Jangan tampilkan `token_digest`,
signed URL, atau data identitas asli pada laporan hasil.

```sql
-- Invitation diterima/dicabut/kedaluwarsa dan consent aktivasi.
SELECT i.status, i.expires_at, i.used_at, i.revoked_at,
       p.status AS profile_status, c.policy_version, c.accepted_at
FROM tenant_invitations i
JOIN tenant_profiles p ON p.id = i.tenant_profile_id
LEFT JOIN tenant_consent_records c ON c.tenant_profile_id = p.id
ORDER BY i.created_at DESC;

-- Metadata dokumen dan audit akses; object_key bukan URL publik.
SELECT d.document_type, f.object_key, f.visibility,
       l.action, l.created_at AS accessed_at
FROM tenant_documents d
JOIN files f ON f.id = d.file_id
LEFT JOIN tenant_document_access_logs l ON l.tenant_document_id = d.id
ORDER BY d.created_at DESC, l.created_at DESC;

-- Kebijakan pencabutan sesi setelah tenancy berakhir.
SELECT user_id, revoked_after, reason, updated_at
FROM tenant_session_revocations
ORDER BY revoked_after DESC;
```

## Kriteria Lulus Epic #41

Epic dapat dinyatakan lulus bila E02-03 sampai E02-18 yang relevan pada
environment berhasil, khususnya: tidak ada password bawaan, semua tautan yang
tidak valid gagal, existing user tidak tertimpa, dokumen hanya terbuka melalui
signed URL yang teraudit, dan token tenant lama ditolak sesudah tenancy berakhir.
