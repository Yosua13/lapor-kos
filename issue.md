# PROMPT — Perbaikan UI Seluruh Halaman Lapor Kos (Owner)

## Konteks
Perbaiki tampilan 4 halaman utama aplikasi Lapor Kos tanpa mengubah logika bisnis, API call, atau struktur data. Hanya perubahan UI/CSS/komponen. Ikuti design system yang sudah ada

---

## HALAMAN 1 — Dashboard (`/dashboard`)

### Masalah yang harus diperbaiki:

**A. Hapus panel kanan yang mengambang (Estimasi Pendapatan + Tingkat Hunian)**
Panel gelap navy yang menimpa konten utama harus dihilangkan. Ganti dengan layout grid proper di bawah stat cards:

```tsx
// Layout baru dashboard (bawah stat cards):
<div className="grid grid-cols-3 gap-4">
  <div className="col-span-2">
    {/* Kamar Terbaru — tabel seperti sekarang */}
  </div>
  <div className="flex flex-col gap-4">
    {/* Card 1: Revenue mini chart */}
    {/* Card 2: Occupancy donut */}
  </div>
</div>
```

**B. Perbaikan Stat Cards (4 kartu)**

Ganti badge "AKTIF" yang seragam dengan informasi yang berarti:

| Card | Badge Baru | Progress Bar |
|------|-----------|-------------|
| Total Kamar | `Total: N` (neutral) | 100% penuh selalu |
| Kamar Terisi | `X%` hunian (amber jika <50%, teal jika ≥50%) | proporsional: `(terisi/total)*100%` |
| Total Penghuni | `Aktif` (green) | proporsional terhadap kamar |
| Pendapatan | `X% target` (amber/green/red) | proporsional terhadap target |

Tambahkan ikon berwarna di pojok kiri atas setiap card:
```tsx
// Contoh card dengan ikon
<div className="stat-card">
  <div className="flex items-start justify-between mb-3">
    <div className="icon-box bg-teal-50 text-teal-700 rounded-lg p-2">
      <BuildingIcon size={18} />
    </div>
    <span className="badge">{occupancyPercent}%</span>
  </div>
  <p className="label">Kamar Terisi</p>
  <p className="value">{occupied}<span>/{total}</span></p>
  <div className="progress-bar">
    <div style={{ width: `${(occupied/total)*100}%` }} />
  </div>
  <p className="sub">{total - occupied} kamar masih kosong</p>
</div>
```

---

## HALAMAN 2 — Manajemen Kamar (`/rooms`)

### Perbaikan Room Card

Setiap room card harus menampilkan informasi lebih lengkap:

**Jika kamar KOSONG:**
```tsx
<div className="room-card" style={{ borderLeft: '3px solid #f59e0b' }}>
  <div className="flex justify-between items-start mb-2">
    <div>
      <h3>Kamar {number}</h3>
      <p className="text-muted">Lantai {floor}</p>
    </div>
    <Badge variant="amber">Kosong</Badge>
  </div>

  {/* Tombol cepat */}
  <button className="btn-ghost w-full mt-3">
    + Tambah Penghuni
  </button>

  <div className="flex justify-between items-center mt-2">
    <span className="price">Rp {price.toLocaleString('id')}/bln</span>
    <div className="facilities">
      {facilities.slice(0, 2).map(f => <Tag>{f}</Tag>)}
    </div>
  </div>
</div>
```

**Jika kamar TERISI:**
```tsx
<div className="room-card" style={{ borderLeft: '3px solid #0e8a7a' }}>
  <div className="flex justify-between items-start mb-2">
    <div>
      <h3>Kamar {number}</h3>
      <p className="text-muted">Lantai {floor}</p>
    </div>
    <Badge variant="green">Terisi</Badge>
  </div>

  {/* Info penghuni — INI YANG KURANG SEKARANG */}
  <div className="tenant-info bg-gray-50 rounded-lg p-2 mb-3 flex items-center gap-2">
    <Avatar src={tenant.selfie_photo_url} fallback={tenant.name[0]} size="sm" />
    <div>
      <p className="font-medium text-sm">{tenant.name}</p>
      <p className="text-xs text-muted">s/d {formatDate(contract.end_date)}</p>
    </div>
  </div>

  <div className="flex justify-between items-center">
    <span className="price">Rp {price.toLocaleString('id')}/bln</span>
    <div className="facilities">
      {facilities.slice(0, 2).map(f => <Tag>{f}</Tag>)}
    </div>
  </div>
</div>
```

**Data yang perlu di-fetch:**
Pastikan `GET /api/rooms` mengembalikan data penghuni aktif jika kamar terisi:
```json
{
  "id": "uuid",
  "room_number": "5",
  "status": "occupied",
  "price": 450000,
  "facilities": ["Peralatan Mandi"],
  "active_tenant": {
    "name": "Keziaa",
    "selfie_photo_url": "https://..."
  },
  "active_contract": {
    "end_date": "2026-12-01"
  }
}
```

---

## HALAMAN 3 — Data Penghuni (`/tenants`)

### Perbaikan Stat Cards

Ganti "BELUM BAYAR" yang labelnya kurang jelas dengan label yang lebih informatif:

```
Card 4: Bukan "BELUM BAYAR" tapi "Tagihan Jatuh Tempo"
Badge: "N tagihan" dengan warna merah jika > 0, hijau jika 0
```

### Perbaikan Tenant Card

Tambahkan payment status yang lebih visual:

```tsx
// Tambahkan di bagian bawah status badges:
<div className="payment-progress mt-2 p-2 bg-gray-50 rounded-lg">
  <div className="flex justify-between text-xs mb-1">
    <span className="text-muted">Tagihan bulan ini</span>
    <span className={isPaid ? 'text-green' : 'text-red'}>
      {isPaid ? 'Lunas' : `Belum - Rp ${billAmount.toLocaleString('id')}`}
    </span>
  </div>
</div>
```

---

## HALAMAN 4 — Manajemen Kontrak (`/contracts`)

### Perbaikan Contract Card

Ini perubahan terbesar — tambahkan visual timeline/progress kontrak:

```tsx
// Hitung progress kontrak
const startDate = new Date(contract.start_date)
const endDate = new Date(contract.end_date)
const today = new Date()
const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24)
const elapsedDays = (today - startDate) / (1000 * 60 * 60 * 24)
const progressPercent = Math.min(Math.round((elapsedDays / totalDays) * 100), 100)
const remainingDays = Math.max(Math.round((endDate - today) / (1000 * 60 * 60 * 24)), 0)

// Warna progress berdasarkan sisa waktu
const progressColor = remainingDays > 60 ? '#0e8a7a' : remainingDays > 30 ? '#d97706' : '#dc2626'
```

```tsx
<div className="contract-card">
  <div className="flex justify-between items-start mb-3">
    <div>
      <p className="text-xs text-muted">Kamar {room.room_number} · Lantai {room.floor}</p>
      <h3 className="font-semibold">{tenant.name}</h3>
    </div>
    <Badge variant={contract.status === 'active' ? 'green' : 'gray'}>
      {contract.status === 'active' ? 'Aktif' : 'Berakhir'}
    </Badge>
  </div>

  {/* Timeline row — TAMBAHAN BARU */}
  <div className="flex items-center gap-3 mb-3">
    <div>
      <p className="text-xs text-muted">Mulai</p>
      <p className="text-sm font-medium">{formatDate(contract.start_date)}</p>
    </div>
    <div className="flex-1 px-2">
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div style={{ width: `${progressPercent}%`, background: progressColor }} className="h-full rounded-full transition-all" />
      </div>
      <p className="text-xs text-muted text-center mt-1">{progressPercent}%</p>
    </div>
    <div className="text-right">
      <p className="text-xs text-muted">Berakhir</p>
      <p className="text-sm font-medium">{formatDate(contract.end_date)}</p>
    </div>
  </div>

  {/* Footer row */}
  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
    <div>
      <p className="text-xs text-muted">Jatuh tempo tagihan</p>
      <p className="text-sm font-medium">Tanggal {contract.payment_due_day} setiap bulan</p>
    </div>
    <div className="text-right">
      <p className="text-xs text-muted">Sisa</p>
      <p className={`text-sm font-semibold ${remainingDays <= 30 ? 'text-red-600' : 'text-teal-600'}`}>
        {remainingDays} hari
      </p>
    </div>
  </div>
</div>
```

---

## Perubahan Global (Berlaku di Semua Halaman)

### Badge consistency
Buat komponen `<StatusBadge>` yang konsisten:

```tsx
// components/StatusBadge.tsx
type StatusType = 'active' | 'vacant' | 'occupied' | 'paid' | 'unpaid' | 'overdue' | 'partial' | 'expiring'

const statusMap: Record<StatusType, { label: string; className: string }> = {
  active:     { label: 'Aktif',        className: 'bg-green-50 text-green-800' },
  vacant:     { label: 'Kosong',       className: 'bg-amber-50 text-amber-800' },
  occupied:   { label: 'Terisi',       className: 'bg-teal-50 text-teal-800' },
  paid:       { label: 'Lunas',        className: 'bg-green-50 text-green-800' },
  unpaid:     { label: 'Belum Bayar',  className: 'bg-gray-100 text-gray-600' },
  overdue:    { label: 'Terlambat',    className: 'bg-red-50 text-red-800' },
  partial:    { label: 'Sebagian',     className: 'bg-amber-50 text-amber-800' },
  expiring:   { label: 'Segera Habis', className: 'bg-orange-50 text-orange-800' },
}

export function StatusBadge({ status }: { status: StatusType }) {
  const { label, className } = statusMap[status]
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}
```

### Progress Bar komponen
```tsx
// components/ProgressBar.tsx
export function ProgressBar({ value, max, colorClass = 'bg-teal-500' }: {
  value: number; max: number; colorClass?: string
}) {
  const percent = Math.min(Math.round((value / max) * 100), 100)
  return (
    <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-2">
      <div
        className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
```

---

## Yang TIDAK Boleh Diubah
- Semua API call dan endpoint tetap sama
- Struktur routing Next.js tidak berubah
- Sidebar navigation tidak berubah
- Warna tema utama tidak berubah
- Tidak perlu tambah library baru — cukup Tailwind + komponen yang sudah ada