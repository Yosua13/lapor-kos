'use client';

import { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import { apiFetch } from '@/lib/api';
import { 
  Calendar as CalendarIcon, 
  DoorOpen, 
  User, 
  DollarSign,
  AlertTriangle,
  FileText,
  CreditCard,
  X
} from 'lucide-react';
import Link from 'next/link';

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState('all'); // all, contract, payment
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Ref to fullcalendar instance if needed
  const calendarRef = useRef<FullCalendar>(null);

  const fetchEvents = async (dateInfo?: any) => {
    setIsLoading(true);
    try {
      let month = new Date().getMonth() + 1;
      let year = new Date().getFullYear();
      
      if (dateInfo) {
        // use the middle of the current view to determine the month
        const midDate = new Date((dateInfo.start.getTime() + dateInfo.end.getTime()) / 2);
        month = midDate.getMonth() + 1;
        year = midDate.getFullYear();
      }

      const data = await apiFetch(`/api/calendar/events?month=${month}&year=${year}`);
      
      // format events for FullCalendar
      const formattedEvents = data.map((ev: any) => {
        let bgColor = '#10b981'; // green (default)
        let borderColor = '#059669';
        
        if (ev.color_status === 'yellow') {
          bgColor = '#f59e0b';
          borderColor = '#d97706';
        } else if (ev.color_status === 'red') {
          bgColor = '#f43f5e';
          borderColor = '#e11d48';
        }

        return {
          id: ev.id,
          title: ev.title,
          start: ev.date,
          backgroundColor: bgColor,
          borderColor: borderColor,
          textColor: '#ffffff',
          extendedProps: {
            ...ev
          }
        };
      });

      setEvents(formattedEvents);
    } catch (err) {
      console.error('Failed to fetch events', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const filteredEvents = events.filter((ev) => {
    if (filter === 'all') return true;
    if (filter === 'contract' && ev.extendedProps.type === 'contract_expiry') return true;
    if (filter === 'payment' && ev.extendedProps.type === 'payment_due') return true;
    return false;
  });

  const handleEventClick = (clickInfo: any) => {
    clickInfo.jsEvent.preventDefault();
    setSelectedEvent(clickInfo.event.extendedProps);
  };

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold text-brand-navy/50 uppercase tracking-widest mb-1">PETA AKTIVITAS</p>
          <h1 className="text-3xl font-display font-bold text-brand-navy">Kalender</h1>
          <p className="text-sm text-gray-500 mt-1">Pantau jatuh tempo dan masa sewa</p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === 'all' ? 'bg-brand-navy text-white shadow-md' : 'bg-white text-brand-navy/60 hover:bg-white/80 border border-brand-navy/10'}`}
          >
            Semua Event
          </button>
          <button 
            onClick={() => setFilter('contract')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === 'contract' ? 'bg-brand-navy text-white shadow-md' : 'bg-white text-brand-navy/60 hover:bg-white/80 border border-brand-navy/10'}`}
          >
            Kontrak Habis
          </button>
          <button 
            onClick={() => setFilter('payment')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === 'payment' ? 'bg-brand-navy text-white shadow-md' : 'bg-white text-brand-navy/60 hover:bg-white/80 border border-brand-navy/10'}`}
          >
            Jatuh Tempo Pembayaran
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0F172A] border-[1.5px] border-gray-200 dark:border-[#1E293B] rounded-3xl p-6 shadow-sm">
          <style dangerouslySetInnerHTML={{__html: `
            .fc .fc-toolbar-title {
              font-family: 'Outfit', sans-serif;
              font-weight: 700;
              color: var(--color-brand-navy);
              font-size: 1.5rem;
            }
            .fc .fc-button-primary {
              background-color: var(--color-gray-100) !important;
              border-color: var(--color-gray-200) !important;
              color: var(--color-brand-navy) !important;
              border-radius: 0.75rem;
              font-family: 'Plus Jakarta Sans', sans-serif;
              font-weight: 600;
              text-transform: capitalize;
            }
            .fc .fc-button-primary:hover {
              background-color: var(--color-gray-200) !important;
            }
            .fc .fc-button-primary:not(:disabled).fc-button-active,
            .fc .fc-button-primary:not(:disabled):active {
              background-color: var(--color-brand-teal) !important;
              border-color: var(--color-brand-teal) !important;
              color: #ffffff !important;
            }
            .fc-theme-standard th {
              border: none;
              padding: 12px 0;
              font-family: 'Plus Jakarta Sans', sans-serif;
              font-weight: 700;
              color: var(--color-gray-500);
              text-transform: uppercase;
              font-size: 0.75rem;
              background-color: transparent !important;
            }
            .fc-theme-standard td, .fc-theme-standard th {
              border-color: var(--color-gray-200) !important;
            }
            .fc-daygrid-day-number,
            .fc-col-header-cell-cushion,
            .fc-multimonth-day {
              font-family: 'Outfit', sans-serif;
              font-weight: 600;
              color: var(--color-brand-navy) !important;
              text-decoration: none !important;
            }
            .fc-multimonth-title {
              font-family: 'Outfit', sans-serif;
              font-weight: 700;
              color: var(--color-brand-navy) !important;
            }
            .fc-event {
              cursor: pointer;
              border-radius: 6px;
              padding: 2px 4px;
              font-family: 'Plus Jakarta Sans', sans-serif;
              font-size: 0.7rem;
              font-weight: 600;
              box-shadow: 0 1px 2px rgba(0,0,0,0.05);
              border-width: 1px;
            }
            .fc-event-main {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .fc-day,
            .fc-multimonth-day,
            .fc-multimonth-month,
            .fc-multimonth,
            .fc-multimonth-daygrid,
            .fc-multimonth-header,
            .fc-scrollgrid,
            .fc-view,
            .fc-view-harness,
            .fc-theme-standard {
              background-color: transparent !important;
              background: transparent !important;
            }
            .fc-day-today {
              background-color: rgba(20, 184, 166, 0.15) !important;
            }
            .fc-day-other {
              opacity: 0.4;
            }
            .fc-col-header {
              background-color: transparent !important;
            }
          `}} />
          <FullCalendar
            ref={calendarRef}
            plugins={[ dayGridPlugin, multiMonthPlugin ]}
            initialView="dayGridMonth"
            events={filteredEvents}
            datesSet={fetchEvents}
            eventClick={handleEventClick}
            height="auto"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'multiMonthYear,dayGridMonth,dayGridWeek'
            }}
            buttonText={{
              today: 'Hari Ini',
              year: 'Tahun',
              month: 'Bulan',
              week: 'Minggu'
            }}
          />
        </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-brand-navy/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className={`p-6 text-white ${selectedEvent.color_status === 'red' ? 'bg-rose-500' : selectedEvent.color_status === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                  {selectedEvent.type === 'contract_expiry' ? (
                    <FileText className="w-6 h-6 text-white" />
                  ) : (
                    <CreditCard className="w-6 h-6 text-white" />
                  )}
                </div>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h2 className="text-xl font-display font-bold">
                {selectedEvent.type === 'contract_expiry' ? 'Kontrak Habis' : 'Jatuh Tempo Pembayaran'}
              </h2>
              <p className="text-white/80 text-sm font-medium mt-1">
                {new Date(selectedEvent.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1"><DoorOpen className="w-3 h-3"/> Kamar</p>
                  <p className="font-bold text-brand-navy">{selectedEvent.details.room_number}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1"><User className="w-3 h-3"/> Penghuni</p>
                  <p className="font-bold text-brand-navy truncate">{selectedEvent.details.tenant_name}</p>
                </div>
              </div>

              {selectedEvent.type === 'payment_due' && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3"/> Total Tagihan</p>
                  <p className="font-bold text-brand-navy text-lg">{formatRupiah(selectedEvent.details.amount)}</p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors"
                >
                  Tutup
                </button>
                {selectedEvent.type === 'contract_expiry' ? (
                  <Link 
                    href="/tenants"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-navy hover:bg-brand-navy-light text-white font-bold rounded-xl transition-colors"
                  >
                    Lihat Penghuni & Kontrak
                  </Link>
                ) : (
                  <Link 
                    href="/payments"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-navy hover:bg-brand-navy-light text-white font-bold rounded-xl transition-colors"
                  >
                    Lihat Pembayaran
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
