# [EPIC 08] Notification Center dan Delivery Platform

- **Prioritas:** P1
- **Tahap roadmap:** Stage 4 - Operational workflows
- **Aktor utama:** Owner, tenant, staf, system worker

## Ringkasan

Menyediakan pusat notifikasi di aplikasi dan platform delivery yang dapat digunakan oleh seluruh domain. Pengiriman eksternal diproses setelah transaksi bisnis berhasil sehingga kegagalan WhatsApp, email, atau push tidak membatalkan perubahan utama.

## Tujuan

- Menyatukan komunikasi penting dalam inbox yang dapat ditelusuri.
- Mengurangi pesan ganda dan menyediakan retry serta status delivery yang terukur.

## Ruang Lingkup

- Inbox in-app dengan kategori, read/unread, deep link, dan retention.
- Preference pengguna, quiet hours, serta pilihan channel sesuai tipe pesan.
- Template versioned dan siap localization dengan penggunaan PII minimum.
- Outbox event, delivery record, retry, deduplication, provider reference, dan failure reason.
- Tampilan operasional bagi owner untuk memantau dan mencoba ulang delivery tertentu.

## Rencana Implementasi

- **Backend:** membuat event/outbox model, worker delivery, kebijakan retry, dedupe, dan adapter channel.
- **Frontend:** menyediakan inbox pengguna, pengaturan preferensi, badge unread, serta dashboard status delivery bagi role berizin.
- **Integrasi:** mempertahankan WhatsApp sebagai adapter dan menyiapkan email/push tanpa mencampurnya dengan transaksi domain.

## Di Luar Cakupan

- Marketing campaign dan segmentasi massal.
- Push notification lanjutan sebelum kebutuhan PWA disepakati.

## Kriteria Penerimaan

- [ ] Event duplikat tidak menghasilkan spam kepada penerima yang sama.
- [ ] Kegagalan channel eksternal tidak mengubah transaksi bisnis menjadi gagal.
- [ ] Owner dapat melihat status, alasan gagal, dan melakukan retry pesan operasional.
- [ ] Menandai pesan telah dibaca tidak menghapus histori notifikasi.
- [ ] Preference, opt-out, dan quiet hours diterapkan sesuai jenis pesan.

## Ketergantungan

- EPIC 01 untuk property context dan otorisasi.
- EPIC 13 untuk worker observability, audit, secret provider, dan operability.
- Kesepakatan event penting dari setiap domain yang menggunakan platform ini.
