# [EPIC 04] Billing dan Invoice Engine

- **Prioritas:** P0/P1
- **Tahap roadmap:** Stage 2 - Revenue integrity
- **Aktor utama:** Owner, finance, tenant, system worker

## Ringkasan

Memisahkan tagihan dari pembayaran dan membangun invoice engine yang konsisten, idempotent, serta mengikuti kebijakan tiap properti. Tagihan disusun dari line item sehingga nominal dan outstanding dapat direkonsiliasi.

## Tujuan

- Mencegah invoice ganda akibat retry atau beberapa worker berjalan bersamaan.
- Mendukung variasi biaya kos tanpa mengorbankan ketepatan perhitungan.

## Ruang Lingkup

- Billing policy per properti, termasuk timezone, periode, due date, dan waktu pembuatan invoice.
- Invoice dan line item dengan snapshot perhitungan.
- Biaya sewa berulang, utility berbasis meter, biaya satu kali, diskon, credit, late fee, dan adjustment beralasan.
- Perhitungan outstanding berdasarkan total invoice, allocation, dan credit yang valid.
- Job run yang idempotent dan dapat dipantau.

## Rencana Implementasi

- **Backend:** membuat model invoice terpisah, calculation service, due policy, idempotency key, dan worker penagihan.
- **Frontend:** menyediakan daftar dan detail invoice, rincian line item, status outstanding, serta preview adjustment bagi role berizin.
- **Data dan pengujian:** memigrasikan data tagihan lama serta menguji tanggal akhir bulan, Februari, retry, dan concurrency.

## Di Luar Cakupan

- Penerimaan pembayaran dan rekonsiliasi bank, yang ditangani EPIC 05.
- Perhitungan pajak usaha yang kompleks.

## Kriteria Penerimaan

- [ ] Job yang dijalankan ulang atau paralel hanya menghasilkan satu invoice untuk periode yang sama.
- [ ] Kebijakan tanggal 28-31 dan Februari menghasilkan due date yang konsisten.
- [ ] Invoice tidak dibuat setelah kontrak berakhir kecuali untuk final settlement.
- [ ] Total invoice selalu sama dengan jumlah line item tanpa kesalahan pembulatan float.
- [ ] Seluruh invoice dan job terikat property serta dapat diaudit.

## Ketergantungan

- EPIC 01 untuk property context.
- EPIC 03 untuk periode dan status kontrak.
- EPIC 13 untuk worker observability, audit, dan migration governance.
