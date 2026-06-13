'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronRight,
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  UploadCloud,
  Home,
  Users,
  Info,
  Save,
  Loader2,
  FileText
} from 'lucide-react';
import { apiFetch, API_URL } from '@/lib/api';

const STEPS = [
  { id: 1, title: 'Data Kamar' },
  { id: 2, title: 'Data Penghuni' },
  { id: 3, title: 'Kontrak & Pembayaran' },
  { id: 4, title: 'Review' },
];

export default function AddRoomPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [roomData, setRoomData] = useState({ room_number: '', price_per_month: '', description: '', type: '', status: '', floor: '' });
  const [tenantData, setTenantData] = useState({ name: '', phone: '', email: '' });
  const [contractData, setContractData] = useState({
    entry_date: '',
    rental_duration: '',
    electricity_bill: '',
    water_bill: '',
    other_bills: '',
    payment_due_day: '',
    notes: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftId, setDraftId] = useState<string | null>(null);

  // File states (files can't be saved in localStorage easily, so they are kept in memory)
  const [files, setFiles] = useState<{ ktp: File | null, selfie: File | null }>({ ktp: null, selfie: null });
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Mount logic
  useEffect(() => {
    setMounted(true);
  }, []);

  const formatPhoneNumber = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
    else if (!cleaned.startsWith('62') && cleaned.length > 0) cleaned = '62' + cleaned;
    
    if (cleaned.length <= 2) return ''; // Clear input if only 62 is left
    
    cleaned = cleaned.substring(0, 14); // max 14 digits total (including +62)
    let res = '+62';
    let rest = cleaned.substring(2);
    if (rest.length > 0) res += '-' + rest.substring(0, 3);
    if (rest.length > 3) res += '-' + rest.substring(3, 7);
    if (rest.length > 7) res += '-' + rest.substring(7, 12);
    return res;
  };

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!roomData.status) newErrors.status = 'Status Ketersediaan wajib dipilih!';
      if (!roomData.room_number) newErrors.room_number = 'Nomor Kamar wajib diisi!';
      if (!roomData.type) newErrors.type = 'Tipe Kamar wajib dipilih!';
      if (!roomData.floor) newErrors.floor = 'Lantai Ke- wajib dipilih!';
      if (!roomData.price_per_month) newErrors.price_per_month = 'Harga Sewa wajib diisi!';
      if (!roomData.description) newErrors.description = 'Fasilitas wajib diisi!';
    } else if (step === 2) {
      if (roomData.status === 'occupied') {
        if (!tenantData.name) newErrors.tenant_name = 'Nama Lengkap wajib diisi!';
        if (!tenantData.phone) {
          newErrors.tenant_phone = 'Nomor HP / WA wajib diisi!';
        } else {
          const rawPhone = tenantData.phone.replace(/\D/g, '');
          if (rawPhone.length < 10 || rawPhone.length > 14) {
            newErrors.tenant_phone = 'Nomor HP harus 10-14 digit!';
          }
        }
        if (!tenantData.email) newErrors.tenant_email = 'Email wajib diisi!';
        if (!files.ktp) newErrors.ktp = 'Foto KTP wajib diupload!';
        if (!files.selfie) newErrors.selfie = 'Foto Selfie wajib diupload!';
      }
    } else if (step === 3) {
      if (roomData.status === 'occupied') {
        if (!contractData.entry_date) newErrors.entry_date = 'Tanggal Masuk wajib diisi!';
        if (!contractData.rental_duration) newErrors.duration = 'Durasi Kontrak wajib dipilih!';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;

    if (currentStep === 1 && roomData.status === 'available') {
      setCurrentStep(4);
      return;
    }
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
    else router.push('/rooms');
  };

  const submitToServer = async (isDraft: boolean) => {
    setIsSubmitting(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];

      const data = new FormData();
      data.append('room_number', roomData.room_number);
      data.append('price_per_month', roomData.price_per_month.replace(/\./g, ''));
      
      const cleanDescription = roomData.description
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .join(', ');
      data.append('description', cleanDescription);
      data.append('status', roomData.status);
      data.append('type', roomData.type);
      data.append('floor', roomData.floor);
      data.append('is_draft', isDraft ? 'true' : 'false');
      if (draftId) data.append('room_id', draftId);

      data.append('name', tenantData.name);
      data.append('phone', tenantData.phone);
      data.append('email', tenantData.email);
      data.append('entry_date', contractData.entry_date);
      data.append('rental_duration', contractData.rental_duration);
      data.append('electricity_bill', contractData.electricity_bill || '0');
      data.append('water_bill', contractData.water_bill || '0');
      data.append('other_bills', contractData.other_bills || '0');
      data.append('payment_due_day', contractData.payment_due_day || '1');
      data.append('notes', contractData.notes);

      if (files.ktp) data.append('ktp', files.ktp);
      if (files.selfie) data.append('selfie', files.selfie);

      const response = await fetch(`${API_URL}/api/rooms/with-tenant`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: data
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal menyimpan data');
      }

      const resData = await response.json();

      if (isDraft) {
        if (resData.room && resData.room.id) {
          setDraftId(resData.room.id);
        }
        alert('Draft berhasil disimpan ke database!');
      } else {
        localStorage.removeItem('add_room_draft');
        router.push('/rooms');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat menyimpan data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveDraft = () => {
    if (!validateStep(currentStep)) return;
    submitToServer(true);
  };

  const handleSubmit = async () => {
    submitToServer(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'ktp' | 'selfie') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran file maksimal 2MB!');
        return;
      }
      setFiles({ ...files, [type]: file });
      if (errors[type]) setErrors({ ...errors, [type]: '' });
    }
  };

  // Calculations
  const rawPrice = parseInt(roomData.price_per_month.replace(/\./g, '')) || 0;
  const duration = parseInt(contractData.rental_duration) || 1;
  const totalSewa = rawPrice * duration;
  const electricity = parseInt(contractData.electricity_bill.replace(/\./g, '')) || 0;
  const water = parseInt(contractData.water_bill.replace(/\./g, '')) || 0;
  const otherBills = parseInt(contractData.other_bills.replace(/\./g, '')) || 0;
  const totalBiaya = totalSewa + electricity + water + otherBills;

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] lg:min-h-[calc(100vh-120px)] w-full animate-slide-up -mt-4 lg:-mt-8">
      {/* Header */}
      <div className="shrink-0 mb-6 flex items-center gap-4">
        <button
          onClick={() => router.push('/rooms')}
          className="w-12 h-12 bg-white rounded-[16px] border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-[28px] font-display font-extrabold text-brand-navy">Tambah Kamar Baru</h1>
          <p className="text-[15px] text-gray-500 mt-1">Alur pendaftaran kamar & penghuni secara terpadu. Ikuti langkah demi langkah hingga selesai.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-[20px] p-6 border border-gray-200 shadow-sm mb-6 shrink-0">
        <div className="flex items-center justify-between relative max-w-4xl mx-auto">
          {/* Progress Line */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-100 z-0"></div>

          {STEPS.map((step, index) => {
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id;
            const isPending = currentStep < step.id;

            return (
              <div key={step.id} className="relative z-10 flex items-center bg-white px-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] transition-colors ${isCompleted ? 'bg-[#3bb185] text-white' :
                      isActive ? 'border-2 border-[#3bb185] text-[#3bb185] bg-white' : 'bg-[#e3e5e9] text-[#4b5563]'
                    }`}>
                    {isCompleted ? <Check className="w-5 h-5" /> : step.id}
                  </div>
                  <div className="hidden md:block">
                    <p className={`text-[14px] font-bold ${isActive || isCompleted ? 'text-[#1f2937]' : 'text-gray-400'}`}>{step.id}. {step.title}</p>
                    <p className={`text-[11px] font-medium ${isActive ? 'text-emerald-500' : isCompleted ? 'text-gray-500' : 'text-gray-400'}`}>
                      {isCompleted ? 'Selesai' : isActive ? 'Sedang diisi' : 'Belum diisi'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1">
        {/* Left Form Area */}
        <div className="flex-1 bg-white rounded-[24px] border border-gray-200 shadow-sm p-8 flex flex-col">
          <div className="mb-8">
            <h2 className="text-[20px] font-bold text-brand-navy mb-1">{STEPS[currentStep - 1].title}</h2>
            <p className="text-[13px] text-gray-500">
              {currentStep === 1 ? 'Lengkapi informasi kamar baru yang akan didaftarkan.' :
                currentStep === 2 ? 'Lengkapi informasi berikut untuk mendaftarkan penghuni pada kamar ini.' :
                  currentStep === 3 ? 'Atur durasi sewa dan detail kontrak lainnya.' :
                    'Periksa kembali data yang telah Anda masukkan sebelum menyimpan.'}
            </p>
          </div>

          <div className="space-y-6 flex-1">
            {/* STEP 1: Data Kamar */}
            {currentStep === 1 && (
              <>
                <div className="flex gap-6">
                  <div className="flex-1">
                    <label className="block text-[13px] font-bold text-gray-700 mb-2">Status Ketersediaan <span className="text-red-500">*</span></label>
                    <select
                      value={roomData.status}
                      onChange={e => {
                        setRoomData({ ...roomData, status: e.target.value });
                        if (errors.status) setErrors({ ...errors, status: '' });
                      }}
                      className={`w-full bg-white border ${errors.status ? 'border-red-500' : 'border-gray-200'} rounded-[14px] px-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors`}
                    >
                      <option value="" disabled>Silahkan pilih...</option>
                      <option value="available">Tersedia / Kosong</option>
                      <option value="occupied">Terisi</option>
                    </select>
                    {errors.status && <p className="text-red-500 text-[12px] mt-1">{errors.status}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-gray-700 mb-2">Nomor Kamar <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Home className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={roomData.room_number}
                      onChange={e => {
                        setRoomData({ ...roomData, room_number: e.target.value });
                        if (errors.room_number) setErrors({ ...errors, room_number: '' });
                      }}
                      placeholder="Contoh: A-101"
                      className={`w-full bg-white border ${errors.room_number ? 'border-red-500' : 'border-gray-200'} rounded-[14px] pl-12 pr-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors`}
                    />
                  </div>
                  {errors.room_number && <p className="text-red-500 text-[12px] mt-1">{errors.room_number}</p>}
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-gray-700 mb-2">Tipe Kamar <span className="text-red-500">*</span></label>
                  <select
                    value={roomData.type}
                    onChange={e => {
                      setRoomData({ ...roomData, type: e.target.value });
                      if (errors.type) setErrors({ ...errors, type: '' });
                    }}
                    className={`w-full bg-white border ${errors.type ? 'border-red-500' : 'border-gray-200'} rounded-[14px] px-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors`}
                  >
                    <option value="" disabled>Silahkan pilih...</option>
                    <option value="Standar">Standar</option>
                    <option value="VIP">VIP</option>
                    <option value="VVIP">VVIP</option>
                  </select>
                  {errors.type && <p className="text-red-500 text-[12px] mt-1">{errors.type}</p>}
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-gray-700 mb-2">Lantai Ke- <span className="text-red-500">*</span></label>
                  <select
                    value={roomData.floor}
                    onChange={e => {
                      setRoomData({ ...roomData, floor: e.target.value });
                      if (errors.floor) setErrors({ ...errors, floor: '' });
                    }}
                    className={`w-full bg-white border ${errors.floor ? 'border-red-500' : 'border-gray-200'} rounded-[14px] px-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors`}
                  >
                    <option value="" disabled>Silahkan pilih...</option>
                    {[1, 2, 3, 4, 5].map(num => (
                      <option key={num} value={num.toString()}>Lantai {num}</option>
                    ))}
                  </select>
                  {errors.floor && <p className="text-red-500 text-[12px] mt-1">{errors.floor}</p>}
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-gray-700 mb-2">Harga Sewa / Bulan <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-500">Rp</span>
                    <input
                      type="text"
                      value={roomData.price_per_month}
                      onChange={e => {
                        // Remove all non-numeric characters
                        const rawValue = e.target.value.replace(/\D/g, '');
                        // Format with thousands separator (.)
                        const formattedValue = rawValue ? parseInt(rawValue, 10).toLocaleString('id-ID') : '';
                        
                        setRoomData({ ...roomData, price_per_month: formattedValue });
                        if (errors.price_per_month) setErrors({ ...errors, price_per_month: '' });
                      }}
                      placeholder="1.500.000"
                      className={`w-full bg-white border ${errors.price_per_month ? 'border-red-500' : 'border-gray-200'} rounded-[14px] pl-12 pr-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors`}
                    />
                  </div>
                  {errors.price_per_month && <p className="text-red-500 text-[12px] mt-1">{errors.price_per_month}</p>}
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-gray-700 mb-2">Deskripsi / Fasilitas <span className="text-red-500">*</span></label>
                  
                  <div className={`w-full bg-white border ${errors.description ? 'border-red-500' : 'border-gray-200'} rounded-[14px] p-2 focus-within:border-brand-teal focus-within:ring-4 focus-within:ring-brand-teal/10 transition-all shadow-sm flex flex-col min-h-[90px]`}>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {roomData.description.split(',').map(s => s.trim()).filter(Boolean).map(tag => {
                        const isCurrentlyTyping = roomData.description.endsWith(tag) && !roomData.description.endsWith(', ');
                        if (isCurrentlyTyping) return null; // Don't render as chip if it's the active input word
                        return (
                          <div key={tag} className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg">
                            <span className="text-[12px] font-bold text-brand-navy">{tag}</span>
                            <button 
                              type="button" 
                              onClick={() => {
                                const current = roomData.description.split(',').map(s => s.trim()).filter(Boolean);
                                const newCurrent = current.filter(t => t !== tag);
                                setRoomData({ ...roomData, description: newCurrent.join(', ') + (newCurrent.length > 0 ? ', ' : '') });
                              }} 
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          </div>
                        );
                      })}
                      <input
                        type="text"
                        value={roomData.description.split(',').pop()?.trimStart() || ''}
                        onChange={e => {
                          const parts = roomData.description.split(',');
                          parts.pop(); // Remove the last partial part
                          const newDesc = [...parts, (parts.length > 0 ? ' ' : '') + e.target.value].join(',');
                          setRoomData({ ...roomData, description: newDesc });
                          if (errors.description) setErrors({ ...errors, description: '' });
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            if (roomData.description.trim() && !roomData.description.endsWith(', ')) {
                              setRoomData({ ...roomData, description: roomData.description + ', ' });
                            }
                          } else if (e.key === 'Backspace') {
                            const lastPart = roomData.description.split(',').pop() || '';
                            if (lastPart === '' || lastPart === ' ') {
                              e.preventDefault();
                              const parts = roomData.description.split(',').map(s => s.trim()).filter(Boolean);
                              parts.pop();
                              setRoomData({ ...roomData, description: parts.join(', ') + (parts.length > 0 ? ', ' : '') });
                            }
                          }
                        }}
                        placeholder={!roomData.description ? "Ketik fasilitas lalu Enter (misal: AC)..." : ""}
                        className="flex-1 min-w-[120px] bg-transparent border-none py-1.5 px-2 text-brand-navy font-semibold text-[13px] focus:outline-none placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                  {errors.description && <p className="text-red-500 text-[12px] mt-1">{errors.description}</p>}

                  <div className="flex flex-wrap gap-2 mt-3">
                    {(() => {
                      const currentFacilities = roomData.description ? roomData.description.split(',').map(s => s.trim()).filter(Boolean) : [];
                      const lastTypedRaw = roomData.description.split(',').pop() || '';
                      const lastTyped = lastTypedRaw.trim();
                      const baseSuggestions = ['AC', 'WiFi', 'Kasur', 'Lemari Pakaian', 'Meja Belajar', 'Kursi', 'Kamar Mandi Dalam', 'Water Heater', 'Kulkas', 'Dapur Dalam', 'Parkir Motor', 'Parkir Mobil', 'Kolam Renang', 'Gym', 'Laundry', 'Security 24/7', 'CCTV', 'Bantal', 'Guling', 'Selimut', 'Peralatan Masak', 'Peralatan Makan', 'Peralatan Mandi', 'Meja Makan', 'Kursi Makan'];

                      const filteredSuggestions = lastTyped
                        ? baseSuggestions.filter(s => s.toLowerCase().includes(lastTyped.toLowerCase()) && (!currentFacilities.includes(s) || s.toLowerCase() === lastTyped.toLowerCase()))
                        : baseSuggestions.filter(s => !currentFacilities.includes(s));

                      // If last typed exact matches a suggestion, hide suggestion if it's the only one
                      if (filteredSuggestions.length === 1 && filteredSuggestions[0].toLowerCase() === lastTyped.toLowerCase()) {
                         return null;
                      }

                      return filteredSuggestions.map(f => (
                        <button
                          type="button"
                          key={f}
                          onClick={() => {
                            let current = roomData.description ? roomData.description.split(',').map(s => s.trim()).filter(Boolean) : [];
                            const lastT = roomData.description.split(',').pop()?.trim() || '';

                            if (lastT && f.toLowerCase().includes(lastT.toLowerCase())) {
                              current.pop();
                            }

                            if (!current.includes(f)) current.push(f);

                            // Add a comma and space at the end to prepare for next input
                            setRoomData({ ...roomData, description: current.join(', ') + ', ' });
                          }}
                          className="px-3 py-1.5 bg-brand-teal/5 text-brand-teal hover:bg-brand-teal/10 font-bold border border-brand-teal/20 rounded-lg text-[12px] transition-colors"
                        >
                          + {f}
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              </>
            )}

            {/* STEP 2: Data Penghuni */}
            {currentStep === 2 && (
              <>
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  <div className="w-full lg:w-40 shrink-0 mt-3">
                    <label className="text-[13px] font-bold text-gray-700">Nama Lengkap</label>
                  </div>
                  <div className="relative flex-1 w-full">
                    <User className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={tenantData.name}
                      onChange={e => {
                        setTenantData({ ...tenantData, name: e.target.value });
                        if (errors.tenant_name) setErrors({ ...errors, tenant_name: '' });
                      }}
                      placeholder="Masukkan nama lengkap sesuai KTP"
                      className={`w-full bg-white border ${errors.tenant_name ? 'border-red-500' : 'border-gray-200'} rounded-[14px] pl-12 pr-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors`}
                    />
                    {errors.tenant_name && <p className="text-red-500 text-[12px] mt-1">{errors.tenant_name}</p>}
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  <div className="w-full lg:w-40 shrink-0 mt-3">
                    <label className="text-[13px] font-bold text-gray-700">Nomor HP / WA</label>
                  </div>
                  <div className="relative flex-1 w-full">
                    <Phone className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={tenantData.phone}
                      onChange={e => {
                        setTenantData({ ...tenantData, phone: formatPhoneNumber(e.target.value) });
                        if (errors.tenant_phone) setErrors({ ...errors, tenant_phone: '' });
                      }}
                      placeholder="+62-8xx-xxxx-xxxx"
                      className={`w-full bg-white border ${errors.tenant_phone ? 'border-red-500' : 'border-gray-200'} rounded-[14px] pl-12 pr-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors`}
                    />
                    {errors.tenant_phone && <p className="text-red-500 text-[12px] mt-1">{errors.tenant_phone}</p>}
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  <div className="w-full lg:w-40 shrink-0 mt-3">
                    <label className="text-[13px] font-bold text-gray-700">Email <span className="text-red-500">*</span></label>
                  </div>
                  <div className="relative flex-1 w-full">
                    <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={tenantData.email}
                      onChange={e => {
                        setTenantData({ ...tenantData, email: e.target.value });
                        if (errors.tenant_email) setErrors({ ...errors, tenant_email: '' });
                      }}
                      placeholder="nama@email.com"
                      className={`w-full bg-white border ${errors.tenant_email ? 'border-red-500' : 'border-gray-200'} rounded-[14px] pl-12 pr-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors`}
                    />
                    {errors.tenant_email && <p className="text-red-500 text-[12px] mt-1">{errors.tenant_email}</p>}
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  <div className="w-full lg:w-40 shrink-0 mt-1">
                    <label className="text-[13px] font-bold text-gray-700 block mb-1">Upload KTP <span className="text-red-500">*</span></label>
                    <p className="text-[11px] text-gray-400 leading-tight">Upload foto atau scan KTP yang masih berlaku.</p>
                  </div>
                  <div className="flex-1 w-full">
                    {files.ktp ? (
                      <div className="relative rounded-[16px] overflow-hidden border border-gray-200 group w-full h-32 md:h-48 bg-gray-50 flex items-center justify-center cursor-pointer" onClick={() => setPreviewImage(URL.createObjectURL(files.ktp!))}>
                        <img src={URL.createObjectURL(files.ktp)} alt="KTP Preview" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white font-bold text-sm bg-black/50 px-4 py-2 rounded-lg">Lihat Foto</span>
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFiles({ ...files, ktp: null }); }}
                          className="absolute top-2 right-2 w-8 h-8 bg-white/90 hover:bg-white text-red-500 rounded-full flex items-center justify-center shadow-sm transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </div>
                    ) : (
                      <div className={`border-2 border-dashed ${errors.ktp ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50'} rounded-[16px] p-6 hover:border-brand-teal transition-colors flex items-center justify-center cursor-pointer relative`}>
                        <input type="file" onChange={e => { handleFileChange(e, 'ktp'); if (errors.ktp) setErrors({ ...errors, ktp: '' }); }} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/jpeg,image/png" />
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 ${errors.ktp ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-[#0e8a7a]'} rounded-xl flex items-center justify-center shrink-0`}>
                            <FileText className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-[14px] text-brand-navy">Klik untuk upload atau drag & drop</p>
                            <p className={`text-[12px] ${errors.ktp ? 'text-red-500 font-medium' : 'text-gray-500'}`}>Format JPG, PNG (Maks. 2MB)</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {errors.ktp && <p className="text-red-500 text-[12px] mt-2">{errors.ktp}</p>}
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  <div className="w-full lg:w-40 shrink-0 mt-1">
                    <label className="text-[13px] font-bold text-gray-700 block mb-1">Upload Selfie <span className="text-red-500">*</span></label>
                    <p className="text-[11px] text-gray-400 leading-tight">Upload selfie terbaru penghuni (wajah jelas).</p>
                  </div>
                  <div className="flex-1 w-full">
                    {files.selfie ? (
                      <div className="relative rounded-[16px] overflow-hidden border border-gray-200 group w-full h-32 md:h-48 bg-gray-50 flex items-center justify-center cursor-pointer" onClick={() => setPreviewImage(URL.createObjectURL(files.selfie!))}>
                        <img src={URL.createObjectURL(files.selfie)} alt="Selfie Preview" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white font-bold text-sm bg-black/50 px-4 py-2 rounded-lg">Lihat Foto</span>
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFiles({ ...files, selfie: null }); }}
                          className="absolute top-2 right-2 w-8 h-8 bg-white/90 hover:bg-white text-red-500 rounded-full flex items-center justify-center shadow-sm transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </div>
                    ) : (
                      <div className={`border-2 border-dashed ${errors.selfie ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50'} rounded-[16px] p-6 hover:border-brand-teal transition-colors flex items-center justify-center cursor-pointer relative`}>
                        <input type="file" onChange={e => { handleFileChange(e, 'selfie'); if (errors.selfie) setErrors({ ...errors, selfie: '' }); }} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/jpeg,image/png" />
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 ${errors.selfie ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-[#0e8a7a]'} rounded-xl flex items-center justify-center shrink-0`}>
                            <User className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-[14px] text-brand-navy">Klik untuk upload atau drag & drop</p>
                            <p className={`text-[12px] ${errors.selfie ? 'text-red-500 font-medium' : 'text-gray-500'}`}>Format JPG, PNG (Maks. 2MB)</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {errors.selfie && <p className="text-red-500 text-[12px] mt-2">{errors.selfie}</p>}
                  </div>
                </div>


              </>
            )}

            {/* STEP 3: Kontrak & Pembayaran */}
            {currentStep === 3 && (
              <>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3 mb-6">
                  <Info className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-bold text-amber-800 text-[13px]">Sistem Pembayaran Bulanan</h4>
                    <p className="text-[12px] text-amber-700 mt-1">Durasi sewa akan menentukan panjang kontrak di sistem. Tagihan akan otomatis dibuat berdasarkan harga kamar setiap bulannya.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[13px] font-bold text-gray-700 mb-2">Tanggal Masuk <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Calendar className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="date"
                        value={contractData.entry_date}
                        onChange={e => {
                          setContractData({ ...contractData, entry_date: e.target.value });
                          if (errors.entry_date) setErrors({ ...errors, entry_date: '' });
                        }}
                        className={`w-full bg-white border ${errors.entry_date ? 'border-red-500' : 'border-gray-200'} rounded-[14px] pl-12 pr-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors`}
                      />
                      {errors.entry_date && <p className="text-red-500 text-[12px] mt-1">{errors.entry_date}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-gray-700 mb-2">Durasi Kontrak (Bulan) <span className="text-red-500">*</span></label>
                    <select
                      value={contractData.rental_duration}
                      onChange={e => {
                        setContractData({ ...contractData, rental_duration: e.target.value });
                        if (errors.duration) setErrors({ ...errors, duration: '' });
                      }}
                      className={`w-full bg-white border ${errors.duration ? 'border-red-500' : 'border-gray-200'} rounded-[14px] px-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors`}
                    >
                      <option value="" disabled>Silahkan pilih...</option>
                      {[1, 2, 3, 4, 5, 6, 12].map(num => (
                        <option key={num} value={num}>{num} Bulan</option>
                      ))}
                    </select>
                    {errors.duration && <p className="text-red-500 text-[12px] mt-1">{errors.duration}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[13px] font-bold text-gray-700 mb-2">Tagihan Listrik</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-500">Rp</span>
                      <input
                        type="text"
                        value={contractData.electricity_bill}
                        onChange={e => {
                          const rawValue = e.target.value.replace(/\D/g, '');
                          const formattedValue = rawValue ? parseInt(rawValue, 10).toLocaleString('id-ID') : '';
                          setContractData({ ...contractData, electricity_bill: formattedValue });
                        }}
                        placeholder="0"
                        className="w-full bg-white border border-gray-200 rounded-[14px] pl-12 pr-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-gray-700 mb-2">Tagihan Air</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-500">Rp</span>
                      <input
                        type="text"
                        value={contractData.water_bill}
                        onChange={e => {
                          const rawValue = e.target.value.replace(/\D/g, '');
                          const formattedValue = rawValue ? parseInt(rawValue, 10).toLocaleString('id-ID') : '';
                          setContractData({ ...contractData, water_bill: formattedValue });
                        }}
                        placeholder="0"
                        className="w-full bg-white border border-gray-200 rounded-[14px] pl-12 pr-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-gray-700 mb-2">Biaya Lainnya</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-500">Rp</span>
                      <input
                        type="text"
                        value={contractData.other_bills}
                        onChange={e => {
                          const rawValue = e.target.value.replace(/\D/g, '');
                          const formattedValue = rawValue ? parseInt(rawValue, 10).toLocaleString('id-ID') : '';
                          setContractData({ ...contractData, other_bills: formattedValue });
                        }}
                        placeholder="0"
                        className="w-full bg-white border border-gray-200 rounded-[14px] pl-12 pr-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[13px] font-bold text-gray-700 mb-2">Jatuh Tempo Pembayaran (Tanggal)</label>
                    <select
                      value={contractData.payment_due_day}
                      onChange={e => setContractData({ ...contractData, payment_due_day: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-[14px] px-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors"
                    >
                      <option value="" disabled>Silahkan pilih...</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>Tanggal {num}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-gray-700 mb-2">Catatan Tambahan</label>
                    <input
                      type="text"
                      value={contractData.notes}
                      onChange={e => setContractData({ ...contractData, notes: e.target.value })}
                      placeholder="Catatan kontrak..."
                      className="w-full bg-white border border-gray-200 rounded-[14px] px-4 py-3.5 text-[14px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors"
                    />
                  </div>
                </div>

                <div className="bg-[#f0f9f8] border border-[#0e8a7a]/20 rounded-[16px] p-5 mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[13px] font-bold text-gray-600">Sewa Bulanan ({contractData.rental_duration || '1'} Bulan)</span>
                    <span className="text-[14px] font-bold text-brand-navy">Rp {totalSewa.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[13px] font-bold text-gray-600">Tagihan Listrik</span>
                    <span className="text-[14px] font-bold text-brand-navy">Rp {electricity.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[13px] font-bold text-gray-600">Tagihan Air</span>
                    <span className="text-[14px] font-bold text-brand-navy">Rp {water.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[13px] font-bold text-gray-600">Biaya Lainnya</span>
                    <span className="text-[14px] font-bold text-brand-navy">Rp {otherBills.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="h-px bg-[#0e8a7a]/20 w-full mb-4"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-[15px] font-extrabold text-brand-navy">Total Harga</span>
                    <span className="text-[20px] font-extrabold text-[#0e8a7a]">
                      Rp {totalBiaya.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* STEP 4: Review */}
            {currentStep === 4 && (
              <div className="animate-fade-in flex flex-col gap-6">
                {/* Header Status */}
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <Check className="w-8 h-8" />
                  </div>
                  <h3 className="text-[20px] font-extrabold text-brand-navy mb-2">Semua Data Sudah Lengkap</h3>
                  <p className="text-gray-500 max-w-md text-[14px]">
                    Silakan tinjau kembali rincian data di bawah ini. Jika sudah sesuai, klik "Simpan" untuk mendaftarkannya ke sistem.
                  </p>
                </div>

                {/* Grid layout for Kamar and Penghuni */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Kamar Card */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 text-emerald-700 font-bold mb-6 pb-4 border-b border-gray-100 text-[15px]">
                      <Home className="w-5 h-5" /> Ringkasan Kamar
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="text-gray-500">Nomor Kamar</span>
                        <span className="font-bold text-brand-navy">{roomData.room_number || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="text-gray-500">Lantai</span>
                        <span className="font-bold text-brand-navy">{roomData.floor ? `Lantai ${roomData.floor}` : '-'}</span>
                      </div>
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="text-gray-500">Tipe Kamar</span>
                        <span className="font-bold text-brand-navy">{roomData.type || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="text-gray-500">Harga Sewa / Bulan</span>
                        <span className="font-bold text-brand-navy">{roomData.price_per_month ? `Rp ${roomData.price_per_month}` : '-'}</span>
                      </div>
                      <div className="flex flex-col gap-1 text-[14px] pt-2 mt-2 border-t border-gray-100">
                        <span className="text-gray-500">Fasilitas</span>
                        <span className="font-bold text-brand-navy line-clamp-2">{roomData.description || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Penghuni Card */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 text-[#7c3aed] font-bold mb-6 pb-4 border-b border-gray-100 text-[15px]">
                      <Users className="w-5 h-5" /> Ringkasan Penghuni
                    </div>
                    <div className="space-y-4">
                      {roomData.status === 'occupied' ? (
                        <>
                          <div className="flex justify-between items-center text-[14px]">
                            <span className="text-gray-500">Nama Lengkap</span>
                            <span className="font-bold text-brand-navy truncate max-w-[150px]">{tenantData.name || '-'}</span>
                          </div>
                          <div className="flex justify-between items-center text-[14px]">
                            <span className="text-gray-500">Nomor HP / WA</span>
                            <span className="font-bold text-brand-navy">{tenantData.phone || '-'}</span>
                          </div>
                          <div className="flex justify-between items-center text-[14px]">
                            <span className="text-gray-500">Email</span>
                            <span className="font-bold text-brand-navy truncate max-w-[150px]">{tenantData.email || '-'}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-400 text-sm font-medium py-8">
                          Tidak ada penghuni (Kamar Kosong)
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Kontrak Card (Full Width) */}
                {roomData.status === 'occupied' && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 text-amber-700 font-bold mb-6 pb-4 border-b border-gray-100 text-[15px]">
                      <Calendar className="w-5 h-5" /> Ringkasan Kontrak & Pembayaran
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="text-gray-500">Tanggal Masuk</span>
                        <span className="font-bold text-brand-navy">{contractData.entry_date || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="text-gray-500">Durasi Kontrak</span>
                        <span className="font-bold text-brand-navy">{contractData.rental_duration ? `${contractData.rental_duration} Bulan` : '-'}</span>
                      </div>
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="text-gray-500">Tagihan Listrik</span>
                        <span className="font-bold text-brand-navy">{electricity ? `Rp ${electricity.toLocaleString('id-ID')}` : '-'}</span>
                      </div>
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="text-gray-500">Tagihan Air</span>
                        <span className="font-bold text-brand-navy">{water ? `Rp ${water.toLocaleString('id-ID')}` : '-'}</span>
                      </div>
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="text-gray-500">Biaya Lainnya</span>
                        <span className="font-bold text-brand-navy">{otherBills ? `Rp ${otherBills.toLocaleString('id-ID')}` : '-'}</span>
                      </div>
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="text-gray-500">Jatuh Tempo</span>
                        <span className="font-bold text-brand-navy">{contractData.payment_due_day ? `Tanggal ${contractData.payment_due_day}` : '-'}</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-gray-700 text-[15px]">Total Biaya</span>
                        <span className="font-extrabold text-[#0e8a7a] text-[20px]">{totalBiaya ? `Rp ${totalBiaya.toLocaleString('id-ID')}` : '-'}</span>
                      </div>
                      {contractData.notes && (
                        <div className="flex flex-col gap-1 text-[13px] p-4 bg-gray-50 rounded-xl">
                          <span className="text-gray-500 font-bold">Catatan Tambahan</span>
                          <span className="font-medium text-gray-700 leading-relaxed">{contractData.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 shrink-0">
            <button
              onClick={handlePrev}
              className="px-6 py-3 border border-gray-200 text-gray-600 font-bold text-[14px] rounded-[12px] hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>

            <div className="flex gap-4">
              {currentStep < 4 && !(currentStep === 1 && roomData.status === 'occupied') && (
                <button
                  onClick={saveDraft}
                  className="px-6 py-3 border border-gray-200 text-gray-600 font-bold text-[14px] rounded-[12px] hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Simpan Draft
                </button>
              )}

              {currentStep < 4 ? (
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-[#0e8a7a] text-white font-bold text-[14px] rounded-[12px] hover:bg-[#0c7567] transition-all flex items-center gap-2 shadow-sm"
                >
                  Lanjutkan <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-[#0e8a7a] text-white font-bold text-[14px] rounded-[12px] hover:bg-[#0c7567] transition-all flex items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Ringkasan */}
        {currentStep < 4 && (
          <div className="w-full lg:w-[350px] shrink-0 animate-fade-in">

          <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm p-6 sticky top-6">
            <h3 className="text-[16px] font-extrabold text-brand-navy mb-5">Ringkasan</h3>

            {/* Kamar Card */}
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 text-emerald-700 font-bold mb-4 text-[13px]">
                <Home className="w-4 h-4" /> Ringkasan Kamar
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-500">Nomor Kamar</span>
                  <span className="font-bold text-brand-navy">{roomData.room_number || '-'}</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-500">Lantai</span>
                  <span className="font-bold text-brand-navy">{roomData.floor ? `Lantai ${roomData.floor}` : '-'}</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-500">Tipe Kamar</span>
                  <span className="font-bold text-brand-navy">{roomData.type || '-'}</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-500">Harga Sewa / Bulan</span>
                  <span className="font-bold text-brand-navy">{roomData.price_per_month ? `Rp ${roomData.price_per_month}` : '-'}</span>
                </div>
                <div className="flex flex-col gap-1 text-[13px] pt-1 mt-1 border-t border-emerald-100/50">
                  <span className="text-gray-500">Fasilitas</span>
                  <span className="font-bold text-brand-navy line-clamp-2">{roomData.description || '-'}</span>
                </div>
              </div>
            </div>

            {/* Penghuni Card */}
            <div className="bg-[#fcfaff] border border-[#f3eefe] rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 text-[#7c3aed] font-bold mb-4 text-[13px]">
                <Users className="w-4 h-4" /> Ringkasan Penghuni
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-500">Nama Lengkap</span>
                  <span className="font-bold text-brand-navy truncate max-w-[150px]">{tenantData.name || '-'}</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-500">Nomor HP / WA</span>
                  <span className="font-bold text-brand-navy">{tenantData.phone || '-'}</span>
                </div>
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-500">Email</span>
                  <span className="font-bold text-brand-navy truncate max-w-[150px]">{tenantData.email || '-'}</span>
                </div>
              </div>
            </div>

            {/* Kontrak & Pembayaran Card */}
            {roomData.status === 'occupied' && (
              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-2 text-amber-700 font-bold mb-4 text-[13px]">
                  <Calendar className="w-4 h-4" /> Ringkasan Kontrak & Pembayaran
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-gray-500">Tanggal Masuk</span>
                    <span className="font-bold text-brand-navy">{contractData.entry_date || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-gray-500">Durasi Kontrak</span>
                    <span className="font-bold text-brand-navy">{contractData.rental_duration ? `${contractData.rental_duration} Bulan` : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-gray-500">Tagihan Listrik</span>
                    <span className="font-bold text-brand-navy">{electricity ? `Rp ${electricity.toLocaleString('id-ID')}` : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-gray-500">Tagihan Air</span>
                    <span className="font-bold text-brand-navy">{water ? `Rp ${water.toLocaleString('id-ID')}` : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-gray-500">Biaya Lainnya</span>
                    <span className="font-bold text-brand-navy">{otherBills ? `Rp ${otherBills.toLocaleString('id-ID')}` : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-gray-500">Jatuh Tempo</span>
                    <span className="font-bold text-brand-navy">{contractData.payment_due_day ? `Tanggal ${contractData.payment_due_day}` : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px] pt-2 mt-2 border-t border-amber-100/50">
                    <span className="font-bold text-gray-700">Total Biaya</span>
                    <span className="font-extrabold text-[#0e8a7a]">{totalBiaya ? `Rp ${totalBiaya.toLocaleString('id-ID')}` : '-'}</span>
                  </div>
                  {contractData.notes && (
                    <div className="flex flex-col gap-1 text-[13px] pt-2 mt-2 border-t border-amber-100/50">
                      <span className="text-gray-500">Catatan</span>
                      <span className="font-bold text-brand-navy line-clamp-2">{contractData.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tips Card */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-blue-700 font-bold mb-2 text-[13px]">
                <Info className="w-4 h-4" /> Tips
              </div>
              <p className="text-[12px] text-blue-800 leading-relaxed">Pastikan data sudah benar untuk mempercepat proses kontrak dan pembayaran.</p>
            </div>

          </div>
        </div>
      )}
      </div>
      {/* Full Screen Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-200" />
        </div>
      )}
    </div>
  );
}
