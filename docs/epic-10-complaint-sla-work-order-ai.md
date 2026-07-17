# [EPIC 10] Complaint, SLA, Work Order, dan AI Advisory

- **Prioritas:** P1
- **Tahap roadmap:** Stage 4 - Operational workflows
- **Aktor utama:** Tenant, owner, maintenance, vendor, sistem, AI

## Ringkasan

Mengembangkan komplain sederhana menjadi proses penyelesaian maintenance yang terukur. Setiap tiket memiliki prioritas, SLA, PIC, timeline, pekerjaan vendor, dan biaya, sedangkan AI hanya memberikan saran yang dapat dikoreksi manusia.

## Tujuan

- Mempercepat respons terhadap masalah penting dan mengukur kualitas penyelesaiannya.
- Memberikan transparansi kepada tenant tanpa membocorkan catatan internal atau data vendor sensitif.

## Ruang Lingkup

- Ticket dengan category, priority, impact, SLA, assignee, lokasi, access window, dan attachment.
- Timeline append-only untuk komentar, status, assignment, kunjungan, biaya, dan resolution.
- Work order vendor dengan jadwal, estimasi, biaya aktual, serta invoice attachment.
- AI suggestion untuk summary, category, priority, dan response dengan confidence serta human override.
- Alert dan pesan eksternal melalui notification outbox.

## Rencana Implementasi

- **Backend:** memperluas complaint domain, menambahkan SLA policy, ticket event, work order, vendor, dan AI suggestion record.
- **Frontend:** menyediakan form komplain, timeline aman bagi tenant, queue operasional, assignment, work order, dan dashboard SLA.
- **Integrasi:** menjalankan AI dan pengiriman eksternal secara asynchronous dengan fallback yang jelas.

## Di Luar Cakupan

- Keputusan otomatis AI tanpa persetujuan manusia.
- Marketplace vendor atau procurement lengkap.

## Kriteria Penerimaan

- [ ] Tiket prioritas tinggi mengikuti aturan triage dan menghasilkan alert terukur.
- [ ] Tenant hanya melihat timeline yang relevan dan aman.
- [ ] Tenant dapat mengonfirmasi penyelesaian atau membuka kembali tiket.
- [ ] Dashboard menghitung first response time dan resolution time berdasarkan SLA.
- [ ] Kegagalan AI atau channel eksternal tidak menghilangkan tiket maupun perubahan status.

## Ketergantungan

- EPIC 01 untuk property scope dan akses staf.
- EPIC 08 untuk outbox dan delivery.
- EPIC 13 untuk private attachment, AI privacy, audit, dan observability.
