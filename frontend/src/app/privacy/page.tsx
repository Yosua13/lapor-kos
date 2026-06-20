'use client';

import Link from 'next/link';
import { ArrowLeft, Home, Shield, Lock, Trash2, EyeOff } from 'lucide-react';

export default function PrivacyPage() {
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
            Pelindungan Data Pribadi (UU PDP)
          </span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#0b1f35] tracking-tight">
            Kebijakan Privasi Data Pengguna
          </h1>
          <p className="text-gray-500 text-sm mt-3 font-medium">
            Terakhir Diperbarui: 20 Juni 2026
          </p>
        </div>

        <div className="bg-white rounded-[28px] border border-gray-200 shadow-sm p-8 md:p-12 space-y-8 animate-fade-up">
          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-[#0b1f35] flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#0e8a7a]" /> Komitmen Pelindungan Data Pribadi
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Kami di **Lapor Kos** menaruh perhatian yang sangat tinggi terhadap privasi dan keamanan informasi Anda. Kebijakan Privasi ini dirancang berdasarkan prinsip-prinsip pelindungan data yang diatur dalam **Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)**. Kami memastikan setiap informasi sensitif yang dikumpulkan diproses dengan cara yang bertanggung jawab dan aman.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-[#0b1f35] flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#0e8a7a]" /> Pengumpulan Informasi & Data Sensitif
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Untuk kelancaran transaksi sewa-menyewa dan verifikasi keamanan, platform kami mengumpulkan data pribadi berikut:
            </p>
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
              <div>
                <p className="text-xs font-bold text-[#0b1f35] uppercase tracking-wide mb-1">Foto KTP & Selfie Wajah</p>
                <p className="text-xs text-gray-500 leading-relaxed">Digunakan secara eksklusif oleh Pemilik Kos untuk keperluan validasi identitas resmi penyewa guna menghindari penipuan atau tindak kejahatan di area kos. Berkas ini disimpan dengan enkripsi di penyimpanan awan aman.</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#0b1f35] uppercase tracking-wide mb-1">Informasi Kontak Darurat</p>
                <p className="text-xs text-gray-500 leading-relaxed">Data kerabat/kontak darurat disimpan semata-mata untuk dihubungi jika terjadi situasi mendesak seperti kondisi medis darurat, bencana, atau ketidakmampuan menghubungi penyewa dalam jangka waktu yang wajar.</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#0b1f35] uppercase tracking-wide mb-1">Bukti Transfer & Pembayaran</p>
                <p className="text-xs text-gray-500 leading-relaxed">Digunakan sebagai alat bukti pelunasan tagihan bulanan kamar, biaya air, listrik, dan deposito. Data ini disimpan dalam log riwayat transaksi keuangan properti.</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-[#0b1f35] flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-[#0e8a7a]" /> Penggunaan & Keamanan Informasi
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Semua informasi data pribadi yang diunggah hanya dapat diakses oleh **Pemilik Kos** yang Anda tuju dan tim administrator sistem Lapor Kos. Kami menerapkan protokol keamanan bertingkat termasuk enkripsi data saat transit (SSL) dan enkripsi data saat disimpan di server database Supabase kami. Kami menjamin **tidak akan pernah** menjual, menukar, atau menyebarluaskan data pribadi Anda ke pihak pengiklan atau pihak ketiga lainnya tanpa izin tertulis dari Anda.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-[#0b1f35] flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-[#0e8a7a]" /> Penghapusan Data (Right to be Forgotten)
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Sesuai dengan hak asasi pelindungan data dalam UU PDP, penyewa memiliki hak penuh untuk meminta penghapusan berkas sensitif (**Foto KTP, Foto Selfie, dan dokumen tambahan**) dari sistem kami. Permintaan ini dapat diajukan setelah kontrak sewa berakhir secara resmi dan seluruh kewajiban administrasi keuangan/sewa telah diselesaikan sepenuhnya. Penghapusan data secara permanen akan dilakukan dalam waktu maksimal 3 x 24 jam kerja sejak permintaan disetujui.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-[#0b1f35] flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#0e8a7a]" /> Hubungi Kami
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Jika Anda memiliki pertanyaan mengenai Kebijakan Privasi ini, ingin memperbarui data pribadi Anda, atau mengajukan permintaan penghapusan berkas KTP/Selfie setelah masa kontrak berakhir, silakan hubungi tim administrasi kami melalui email: **reyyosua29@gmail.com** atau hubungi pengelola kos Anda secara langsung.
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
