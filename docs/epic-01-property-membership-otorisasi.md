# [EPIC 01] Property, Membership, dan Otorisasi

- **Prioritas:** P0
- **Tahap roadmap:** Stage 1 - Tenant boundary
- **Aktor utama:** Owner, staf properti, administrator sistem

## Ringkasan

Membangun fondasi multi-property agar seluruh data operasional selalu terikat pada properti yang benar. Epic ini memastikan owner dan staf hanya dapat melihat serta mengelola data sesuai membership aktif sehingga data antar-owner tidak tercampur.

## Tujuan

- Mendukung satu owner mengelola satu atau beberapa properti dengan aman.
- Menyediakan pembagian akses dasar bagi owner dan staf tanpa membuka akses lintas properti.

## Ruang Lingkup

- Pembuatan properti dan pemilihan properti aktif.
- Membership dengan peran minimum: owner, manager, finance, maintenance, dan viewer.
- Property context wajib pada kamar, tenant, kontrak, tagihan, komplain, laporan, dan file.
- Nomor kamar unik di dalam satu properti, tetapi boleh sama pada properti berbeda.
- Validasi akses berdasarkan membership aktif di sisi server.

## Rencana Implementasi

- **Backend:** menambahkan domain property dan membership, pemeriksaan otorisasi terpusat, serta repository yang selalu menggunakan property scope.
- **Frontend:** menyediakan pemilih properti aktif dan menyesuaikan menu maupun aksi berdasarkan peran pengguna.
- **Data dan pengujian:** melakukan migrasi data lama ke property yang valid, menambahkan constraint, dan membuat pengujian isolasi minimal untuk dua owner.

## Di Luar Cakupan

- Pembuat peran kustom yang sangat rinci.
- Analitik perbandingan antar-properti.

## Kriteria Penerimaan

- [ ] Dua owner dapat memiliki nomor kamar yang sama tanpa konflik.
- [ ] Percobaan mengakses data milik properti lain ditolak tanpa membocorkan data sensitif.
- [ ] Perpindahan properti aktif memperbarui dashboard dan filter secara konsisten.
- [ ] Seluruh alur utama memiliki pengujian read, update, delete, report, export, dan akses file lintas-owner.
- [ ] Query operasional utama selalu menggunakan property scope.

## Ketergantungan

- Kontrol awal EPIC 13 untuk secret, private file, audit, dan tata kelola migrasi.
- Keputusan pemetaan data lama ke property sebelum migrasi produksi.
