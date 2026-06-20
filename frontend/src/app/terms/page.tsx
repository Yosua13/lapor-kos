'use client';

import Link from 'next/link';
import { ArrowLeft, Home, FileText, CheckCircle } from 'lucide-react';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#fbfbf9] text-[#0b1f35] font-outfit antialiased">
      {/* HEADER */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0e8a7a] rounded-xl flex items-center justify-center shadow-md shadow-[#0e8a7a]/15">
              <Home className="text-white w-5 h-5" />
            </div>
            <span className="font-serif text-xl font-bold text-[#0b1f35]">
              Lapor <span className="italic text-[#0e8a7a]">Kos</span>
            </span>
          </div>
          <Link
            href="/register"
            className="flex items-center gap-2 text-xs font-bold text-[#0e8a7a] hover:text-[#0c7567] bg-[#0e8a7a]/5 hover:bg-[#0e8a7a]/10 px-4 py-2 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar
          </Link>
        </div>
      </header>

      {/* CONTENT BODY */}
      <article className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <div className="text-center mb-12 animate-fade-up">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0e8a7a]/10 text-[#0e8a7a] text-[10px] font-extrabold uppercase tracking-widest rounded-full mb-3">
            Dokumen Hukum Resmi
          </span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#0b1f35] tracking-tight">
            Syarat & Ketentuan Penggunaan
          </h1>
          <p className="text-gray-500 text-sm mt-3 font-medium">
            Terakhir Diperbarui: 20 Juni 2026
          </p>
        </div>

        <div className="bg-white rounded-[28px] border border-gray-200 shadow-sm p-8 md:p-12 space-y-8 animate-fade-up">
          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-[#0b1f35] flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#0e8a7a]/10 text-[#0e8a7a] text-xs font-bold">1</span>
              Ketentuan Umum
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Dengan mendaftar, mengakses, atau menggunakan platform **Lapor Kos**, Anda menyatakan bahwa Anda telah membaca, memahami, dan menyetujui untuk terikat oleh Syarat dan Ketentuan ini. Jika Anda bertindak atas nama orang lain (seperti mendaftarkan kerabat), Anda menyatakan memiliki kewenangan hukum untuk mengikat mereka.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-[#0b1f35] flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#0e8a7a]/10 text-[#0e8a7a] text-xs font-bold">2</span>
              Verifikasi Identitas & Keabsahan Dokumen
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              Platform Lapor Kos memproses data pribadi yang bersifat sangat rahasia untuk tujuan verifikasi sewa kos demi menjamin keamanan dan ketertiban. Oleh karena itu:
            </p>
            <ul className="space-y-3 pl-2">
              <li className="flex items-start gap-3 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-[#0e8a7a] shrink-0 mt-0.5" />
                <span>Pengguna wajib mengunggah dokumen identitas diri (**KTP**) asli yang sah dan masih berlaku.</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-[#0e8a7a] shrink-0 mt-0.5" />
                <span>Foto **Selfie** wajah yang diunggah harus jelas, terbaru, dan sesuai dengan dokumen identitas diri yang dilampirkan.</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-[#0e8a7a] shrink-0 mt-0.5" />
                <span>Tindakan mengunggah identitas palsu, memanipulasi dokumen, atau menggunakan identitas milik orang lain tanpa hak merupakan pelanggaran hukum berat dan akan langsung dilaporkan ke pihak kepolisian.</span>
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-[#0b1f35] flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#0e8a7a]/10 text-[#0e8a7a] text-xs font-bold">3</span>
              Kontrak Sewa & Jatuh Tempo Pembayaran
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Penyewaan kamar kos diatur berdasarkan kontrak sewa yang disetujui bersama antara Pemilik Kos dan Penghuni. Pembayaran bulanan wajib diselesaikan sebelum atau tepat pada tanggal **Jatuh Tempo** yang telah disepakati. Kegagalan melunasi tagihan dapat berakibat pada denda keterlambatan atau pengakhiran sewa secara sepihak oleh pemilik kos.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-[#0b1f35] flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#0e8a7a]/10 text-[#0e8a7a] text-xs font-bold">4</span>
              Bukti Transfer & Transaksi Keuangan
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Setiap pembayaran yang dilakukan melalui transfer bank atau e-wallet wajib disertai dengan unggahan **Bukti Transfer** asli yang valid. Pengguna dilarang keras mengunggah struk transfer palsu, duplikat struk lama, atau struk hasil rekayasa digital. Lapor Kos dan Pemilik Properti memiliki sistem rekonsiliasi mutasi rekening otomatis untuk melacak keaslian dana.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-[#0b1f35] flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#0e8a7a]/10 text-[#0e8a7a] text-xs font-bold">5</span>
              Kontak Darurat
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Penghuni wajib memberikan nomor kontak darurat kerabat terdekat. Kontak darurat ini hanya akan dihubungi oleh Pemilik Kos dalam situasi darurat medis, keterlambatan pembayaran kronis tanpa kabar, atau pelanggaran disiplin berat yang merugikan properti kos.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-[#0b1f35] flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#0e8a7a]/10 text-[#0e8a7a] text-xs font-bold">6</span>
              Batasan Tanggung Jawab Platform
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Lapor Kos bertindak sebagai platform digital penyedia layanan manajemen kos. Segala perselisihan hubungan perdata sewa menyewa, kehilangan barang di lingkungan properti, atau kerusakan fasilitas fisik kos merupakan tanggung jawab bersama secara langsung antara Pemilik Kos dan Penghuni secara personal, di luar tanggung jawab Lapor Kos.
            </p>
          </section>
        </div>

        <div className="mt-10 text-center text-xs text-gray-400">
          © 2026 Lapor Kos. Hak Cipta Dilindungi Undang-Undang.
        </div>
      </article>
    </main>
  );
}
