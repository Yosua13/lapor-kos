# Manual Test Cases — Epic #42 Contract Lifecycle dan Dokumen

## Prasyarat

- Migration `001` sampai `020` sudah diterapkan berurutan.
- Tersedia satu properti, owner/manager dengan akses kontrak, dua kamar tersedia, dan dua akun tenant aktif.
- Profil tenant berisi nama, email, nomor HP, serta minimal satu dokumen bertipe KTP.
- Gunakan properti A sebagai property aktif. Siapkan properti B untuk uji isolasi.

## Alur utama

### CL-01 — Membuat draft tanpa mengubah kamar atau keuangan

1. Buat kontrak untuk tenant dan kamar yang tersedia.
2. Buka `/contracts/{contract_id}` dari tombol **Kelola Lifecycle & Histori** di detail tenant.
3. Periksa status, kamar, dan daftar pembayaran.

Hasil yang diharapkan: status `draft`, version 1 dan event `created` tersedia; kamar tetap `available`; payment belum dibuat.

### CL-02 — Tenant review dan persetujuan

1. Owner mengubah draft menjadi **Menunggu tenant**.
2. Login sebagai tenant dan buka dashboard.
3. Pilih **Tinjau kontrak & histori** dan periksa snapshot.
4. Pastikan tombol persetujuan belum aktif sebelum checkbox aturan dicentang.
5. Centang persetujuan snapshot kontrak dan aturan properti, lalu klik **Setujui kontrak**.

Hasil yang diharapkan: request tanpa `policy_accepted: true` ditolak; status menjadi `scheduled` hanya setelah persetujuan eksplisit; persetujuan terkait current version tercatat satu kali; owner tidak dapat memalsukan persetujuan dari UI pengelola.

### CL-03 — Aktivasi dengan seluruh prasyarat

1. Login kembali sebagai owner/manager.
2. Pada lifecycle kontrak terjadwal, pilih **Ubah ke Aktif**.
3. Periksa kamar, occupancy, payment, dan kalender.

Hasil yang diharapkan: perubahan terjadi atomik; status `active`; tepat satu occupancy terbuka; kamar `occupied`; tagihan awal dibuat sekali; kalender memakai tanggal akhir dan status yang sama.

### CL-04 — Aktivasi ditolak jika prasyarat tidak lengkap

Ulangi CL-01 sampai CL-02, kemudian coba setiap variasi berikut secara terpisah:

- hapus/tidak sediakan KTP;
- kosongkan nomor HP profil;
- gunakan harga bulanan nol;
- gunakan kamar yang sudah memiliki occupancy pada periode sama;
- coba aktivasi tanpa persetujuan tenant.

Hasil yang diharapkan: API mengembalikan `409`; kontrak tetap pada status sebelumnya; tidak ada occupancy, payment, atau perubahan kamar setengah jadi.

### CL-05 — Transisi ilegal

1. Pada draft, kirim transisi langsung ke `active`.
2. Pada kontrak ended/cancelled, coba aktifkan kembali.
3. Coba termination tanpa alasan.

Hasil yang diharapkan: seluruh permintaan ditolak `409`; status dan audit trail tidak berubah.

### CL-06 — Amendment mempertahankan histori

1. Pada kontrak aktif, pilih **Amendment**.
2. Ubah tanggal akhir atau harga, isi alasan, lalu simpan.
3. Periksa daftar versi dan audit trail.

Hasil yang diharapkan: version baru dibuat dan menjadi current version; version lama tetap utuh; tanggal mulai kontrak aktif tidak dapat diubah; occupancy mengikuti tanggal akhir baru tanpa overlap.

Jika amendment dibuat saat status masih `scheduled`, status harus kembali ke `pending_tenant` dan tenant wajib menyetujui version baru sebelum kontrak dapat diaktifkan.

### CL-07 — PDF immutable dan hash

1. Klik **Terbitkan PDF**.
2. Unduh dokumen dan simpan hash yang tampil.
3. Buat amendment, lalu terbitkan PDF lagi.
4. Login sebagai tenant pemilik kontrak dan unduh kedua PDF dari halaman review.

Hasil yang diharapkan: tiap version maksimal memiliki satu PDF; nama dokumen menyebut version; SHA-256 tersedia; PDF lama tidak berubah dan amendment menghasilkan dokumen/version baru; tenant pemilik dapat mengunduh dokumen, sedangkan tenant lain menerima `404`.

### CL-08 — Renewal tidak menimpa kontrak lama

1. Pada kontrak aktif, pilih **Renewal**.
2. Masukkan tanggal mulai tepat satu hari setelah kontrak lama berakhir, harga, dan alasan.
3. Jalankan review tenant dan aktivasi untuk kontrak renewal.

Hasil yang diharapkan: kontrak baru dibuat sebagai draft dengan `renewed_from_contract_id`; kontrak lama tetap aktif sampai renewal diaktifkan; saat aktivasi, kontrak lama menjadi `renewed`, occupancy lama ditutup, occupancy baru dibuat tanpa overlap.

### CL-09 — End dan termination

1. Pada kontrak aktif, pilih `ended` atau `terminated`, isi alasan dan tanggal efektif.
2. Periksa status kamar, occupancy, sesi tenant, dan event.

Hasil yang diharapkan: occupancy ditutup, kamar tersedia bila tidak ada occupancy lain, alasan/event tersimpan, dan sesi tenant dicabut.

### CL-10 — Property scope dan role

1. Sebagai user properti A, coba baca/mutasi/download kontrak properti B dengan ID valid.
2. Login sebagai role `viewer` atau `finance` dan buka detail kontrak.
3. Login sebagai tenant lain dan coba membuka `/contracts/{id}/review` milik tenant pertama.

Hasil yang diharapkan: lintas properti/tenant mengembalikan `404` atau `403`; viewer/finance dapat membaca sesuai permission tetapi tidak melihat tombol mutasi; tenant hanya dapat melihat dan menerima kontraknya sendiri.

## Regression checklist

- Daftar tenant, dashboard, pembayaran, kamar, dan kalender masih dapat dimuat.
- Endpoint `PUT /contracts/:id` menghasilkan version baru dan tidak mengubah status secara langsung.
- Endpoint `DELETE /contracts/:id` melakukan cancel pada draft/pending/scheduled, bukan hard delete; kontrak aktif ditolak.
- Perpanjangan dari halaman tenant lama membuat draft renewal dan tidak langsung membuat payment/occupancy.
- Tampilan lifecycle responsif pada lebar mobile, tablet, dan desktop; dialog dapat ditutup dan error field alasan tampil di bawah field.
