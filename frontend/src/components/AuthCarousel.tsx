'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

const slides = [
  {
    title: 'Manajemen Kos Pintar',
    description: 'Solusi modern yang dirancang untuk efisiensi bisnis dan kenyamanan penghuni Anda dalam satu genggaman.',
    image: '/images/carousel-1.png',
  },
  {
    title: 'Pembayaran Digital',
    description: 'Pantau tagihan, generate kwitansi digital, dan kelola keuangan kos Anda secara otomatis dan transparan.',
    image: '/images/carousel-2.png',
  },
  {
    title: 'Data Penghuni Aman',
    description: 'Simpan identitas dan riwayat kontrak penghuni dengan enkripsi tingkat tinggi untuk keamanan data maksimal.',
    image: '/images/carousel-3.png',
  },
];

export default function AuthCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative z-10 flex flex-col items-center text-center w-full max-w-[500px]">
      {/* Image Carousel */}
      <div className="relative w-full h-[280px] mb-10 group">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out transform ${
              index === current 
                ? 'opacity-100 scale-100 translate-y-0' 
                : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
            }`}
          >
            <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl shadow-navy/50 ring-1 ring-white/10">
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                className="object-cover"
                priority={index === 0}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/60 to-transparent" />
            </div>
          </div>
        ))}
      </div>

      {/* Text Carousel */}
      <div className="relative h-[120px] w-full">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-all duration-700 ease-in-out ${
              index === current 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 -translate-y-4 pointer-events-none'
            }`}
          >
            <h2 className="font-serif text-[42px] leading-tight text-white mb-4">
              {slide.title.split(' ').map((word, i) => (
                <span key={i} className={word === 'Kos' || word === 'Pintar' || word === 'Digital' || word === 'Aman' ? 'italic text-teal-light' : ''}>
                  {word}{' '}
                </span>
              ))}
            </h2>
            <p className="font-outfit font-light text-[17px] text-text-muted leading-relaxed text-balance px-4">
              {slide.description}
            </p>
          </div>
        ))}
      </div>

      {/* Progress Indicators */}
      <div className="mt-12 flex gap-3">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrent(index)}
            className={`h-2 transition-all duration-500 rounded-full ${
              index === current ? 'w-8 bg-teal' : 'w-2 bg-white/20 hover:bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
