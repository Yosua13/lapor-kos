'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  DoorOpen, 
  TrendingUp, 
  Wallet,
  ArrowRight,
  Plus
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalRooms: 12,
    occupiedRooms: 8,
    totalTenants: 8,
    monthlyRevenue: 12000000
  });

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-navy">Ringkasan Properti</h1>
          <p className="text-text-mid mt-1">Pantau status kos Anda dalam satu tampilan.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/tenants" 
            className="bg-white hover:bg-gray-50 text-navy font-semibold px-5 py-3 rounded-xl border border-gray-100 transition-all flex items-center gap-2"
          >
            <span>Data Penghuni</span>
          </Link>
          <Link 
            href="/rooms" 
            className="bg-teal hover:bg-teal-light text-white font-semibold px-5 py-3 rounded-xl shadow-lg shadow-teal/20 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kamar</span>
          </Link>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Kamar', value: stats.totalRooms, icon: DoorOpen, color: 'teal' },
          { label: 'Terisi', value: stats.occupiedRooms, icon: Users, color: 'blue' },
          { label: 'Total Penghuni', value: stats.totalTenants, icon: TrendingUp, color: 'orange' },
          { label: 'Pendapatan (Bln)', value: `Rp ${(stats.monthlyRevenue / 1000000).toFixed(1)}jt`, icon: Wallet, color: 'emerald' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 bg-${stat.color}/10 rounded-2xl flex items-center justify-center mb-4 text-${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-text-muted mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold text-navy">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity or Placeholder */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-serif text-xl text-navy">Kamar Terakhir Diperbarui</h3>
            <Link href="/rooms" className="text-sm font-semibold text-teal hover:underline flex items-center gap-1">
              Lihat Semua <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="space-y-4">
            {[1, 2, 3].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 hover:bg-cream/30 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-navy/5 rounded-xl flex items-center justify-center font-bold text-navy">
                    {100 + i + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-navy">Kamar {100 + i + 1}</h4>
                    <p className="text-xs text-text-muted">Lt. 1 • Kamar Mandi Dalam</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-teal/10 text-teal text-[10px] font-bold uppercase tracking-wider rounded-full">
                    Tersedia
                  </span>
                  <p className="text-sm font-medium text-navy mt-1">Rp 1.500.000</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions / Tips */}
        <div className="bg-navy rounded-3xl p-8 text-white relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-teal/20 blur-3xl rounded-full"></div>
          <div>
            <h3 className="font-serif text-xl mb-4">Tips Kelola Kos</h3>
            <p className="text-text-muted text-sm leading-relaxed mb-6">
              Pastikan data penghuni selalu update untuk memudahkan penagihan setiap bulannya. Gunakan fitur pengingat untuk penagihan tepat waktu.
            </p>
            <button className="bg-teal hover:bg-teal-light text-white text-sm font-bold py-3 px-6 rounded-xl transition-all">
              Baca Selengkapnya
            </button>
          </div>
          <div className="mt-12 bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-teal rounded-full animate-pulse"></div>
              <p className="text-xs font-medium">Sistem berjalan normal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
