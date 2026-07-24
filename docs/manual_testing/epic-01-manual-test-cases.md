# Test Case Manual — Epic 01 Property, Membership, dan Otorisasi

Dokumen ini digunakan untuk validasi manual GitHub Issue #40 pada environment
lokal atau staging. Jalankan backend dan frontend versi terbaru, lalu gunakan
dua akun owner berbeda: **Owner A** dan **Owner B**.

## Persiapan Data

1. Login sebagai Owner A dan buat **Properti A**.
2. Login sebagai Owner B dan buat **Properti B**.
3. Pada masing-masing properti, buat kamar dengan nomor yang sama, misalnya
   `A-01`.
4. Pada Properti B, siapkan minimal satu kontrak, pembayaran, komplain,
   peraturan, dan file bukti pembayaran atau foto komplain. Simpan ID resource
   dan object key file untuk pengujian lintas-properti.
5. Tambahkan satu akun staf ke Properti A untuk menguji role `manager`,
   `finance`, `maintenance`, dan `viewer` secara bergantian.

## Test Case

| ID | Skenario | Langkah | Hasil yang diharapkan |
|---|---|---|---|
| TC-01 | Nomor kamar per properti | Buat `A-01` pada Properti A dan Properti B. | Kedua kamar berhasil dibuat. Tidak ada konflik lintas properti. |
| TC-02 | Properti aktif | Login sebagai owner yang memiliki dua properti, lalu ganti properti melalui selector. | Dashboard, kamar, kontrak, pembayaran, komplain, aturan, kalender, dan laporan menampilkan data properti yang dipilih. |
| TC-03 | Owner | Login sebagai owner properti. | Menu dan aksi administrasi, anggota, kamar, kontrak, pembayaran, laporan, komplain, serta peraturan tersedia sesuai kebutuhan. |
| TC-04 | Manager | Tambahkan staf sebagai `manager`, login dengan staf tersebut. | Dapat mengelola operasional, tetapi tidak dapat mengelola membership atau memverifikasi pembayaran. |
| TC-05 | Finance | Ubah role staf menjadi `finance`, login ulang. | Menu kamar, penghuni/kontrak, pembayaran, laporan, dan kalender tersedia. Aksi ubah kamar/kontrak/komplain tidak tersedia. |
| TC-06 | Maintenance | Ubah role staf menjadi `maintenance`. | Menu kamar, komplain, peraturan, dan kalender tersedia. Tidak ada akses pembayaran, penghuni, atau laporan. |
| TC-07 | Viewer | Ubah role staf menjadi `viewer`. | Hanya menu baca tersedia. Menu penghuni tidak tampil dan semua aksi ubah/hapus tidak tersedia. |
| TC-08 | Membership dicabut | Cabut membership staf dari Properti A, lalu refresh sesi staf. | Properti A hilang dari selector dan request ke Properti A ditolak. |
| TC-09 | Baca lintas properti | Login Owner A. Panggil endpoint resource Properti B dengan header Properti A. | Respons `404`, tanpa data Properti B. |
| TC-10 | Ubah/hapus lintas properti | Dengan Owner A, coba `PUT`, `PATCH`, atau `DELETE` ID kamar, kontrak, pembayaran, komplain, atau aturan milik Properti B. | Respons `404` atau `403`; data Properti B tidak berubah. |
| TC-11 | Laporan/export lintas properti | Pada Properti A buka laporan dan unduh PDF; bandingkan dengan pembayaran Properti B. | Nilai dan transaksi Properti B tidak muncul dalam laporan/PDF Properti A. |
| TC-12 | File lintas properti | Login Owner A dan minta signed URL untuk object key milik Properti B. | Respons `404`; signed URL tidak diterbitkan. |
| TC-13 | Tenant mandiri | Login tenant dari Properti B. | Tenant hanya dapat melihat kontrak, tagihan, kuitansi, dan komplain miliknya; tenant tidak dapat memilih Properti A. |
| TC-14 | Owner baru tanpa properti | Register/login owner baru lalu buka dashboard. | Tampil onboarding untuk membuat properti. Tidak ada request operasional tanpa property context dan tidak ada error API. |

## Contoh Uji Lintas Properti dari Browser

Saat login sebagai Owner A, buka DevTools Console dan jalankan contoh berikut.
Ganti nilai placeholder dengan ID milik Properti A dan resource Properti B.

```js
const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
const propertyA = '<property-id-a>';
const roomB = '<room-id-b>';

fetch(`http://localhost:8081/api/rooms/${roomB}`, {
  headers: {
    Authorization: `Bearer ${token}`,
    'X-Property-ID': propertyA,
  },
}).then(async (response) => ({ status: response.status, body: await response.json() }));
```

Hasil yang benar adalah status `404` dan tidak ada detail kamar Properti B.

Untuk file, gunakan object key seperti
`properties/<property-id-b>/payment-proof_...jpg`:

```js
const objectKeyB = 'properties/<property-id-b>/payment-proof_example.jpg';
fetch(`http://localhost:8081/api/files/sign?key=${encodeURIComponent(objectKeyB)}`, {
  headers: {
    Authorization: `Bearer ${token}`,
    'X-Property-ID': propertyA,
  },
}).then(async (response) => ({ status: response.status, body: await response.json() }));
```

Hasil yang benar adalah `404`; URL bertanda tangan tidak boleh diterbitkan.

## Test Otomatis

Gunakan database pengujian yang telah menjalankan migration `001` sampai `015`:

```powershell
Set-Location D:\project_yosua\lapor-kos\backend
$env:TEST_DATABASE_URL='postgresql://...'
go test -tags=integration ./internal/repository -run TestPropertyIsolationWithTwoOwners -v
```

Test otomatis membuat dua owner dan dua properti di dalam satu transaksi,
memverifikasi read/update/delete/report/file lintas-properti, lalu selalu
melakukan rollback.
