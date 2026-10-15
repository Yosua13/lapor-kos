'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Inbox,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Filter,
  RefreshCw,
  Bell,
} from 'lucide-react';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../api';
import { getCategoryBadgeStyle, getCategoryLabel, formatRelativeTime } from '../format';
import type { InAppNotification, NotificationCategory } from '../types';

const CATEGORIES: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Semua' },
  { id: 'billing', label: 'Keuangan' },
  { id: 'operations', label: 'Operasional' },
  { id: 'complaint', label: 'Komplain' },
  { id: 'contract', label: 'Kontrak' },
  { id: 'announcement', label: 'Pengumuman' },
  { id: 'security', label: 'Keamanan' },
];

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await getNotifications({
        category: selectedCategory,
        unread_only: unreadOnly,
        limit: 50,
      });
      setNotifications(res.notifications || []);
      setTotalCount(res.total_count || 0);
      setUnreadCount(res.unread_count || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, unreadOnly]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotalCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal">
            <Inbox className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-brand-navy">Kotak Masuk Notifikasi</h2>
            <p className="text-xs text-gray-500">
              {unreadCount > 0 ? `${unreadCount} pesan belum dibaca` : 'Seluruh pesan telah dibaca'} • Total {totalCount} pesan tersimpan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            title="Muat ulang"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-brand-teal text-white shadow-sm hover:bg-brand-teal/90 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              Tandai Semua Dibaca
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs & Filter Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-brand-navy text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-600 select-none">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
          />
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          Hanya belum dibaca
        </label>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-sm text-gray-400">
            Memuat pesan...
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Bell className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h4 className="font-bold text-brand-navy text-sm">Tidak ada notifikasi</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {unreadOnly
                ? 'Tidak ada notifikasi baru yang belum dibaca pada kategori ini.'
                : 'Kotak masuk Anda bersih. Notifikasi penting seputar kontrak, tagihan, dan operasional akan tampil di sini.'}
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const badge = getCategoryBadgeStyle(n.category);
            return (
              <div
                key={n.id}
                className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-sm hover:shadow flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                  !n.is_read ? 'border-brand-teal/40 bg-brand-teal/[0.02]' : 'border-gray-100'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      {getCategoryLabel(n.category)}
                    </span>
                    <span className="text-xs text-gray-400">{formatRelativeTime(n.created_at)}</span>
                    {!n.is_read && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-teal">
                        <span className="h-2 w-2 rounded-full bg-brand-teal animate-pulse" />
                        Baru
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-brand-navy">{n.title}</h3>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{n.message}</p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0">
                  {n.action_url && (
                    <Link
                      href={n.action_url}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-brand-teal hover:text-white transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Buka
                    </Link>
                  )}

                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Tandai Dibaca
                    </button>
                  )}

                  <button
                    type="button"
                    title="Hapus / Arsipkan"
                    onClick={() => handleDelete(n.id)}
                    className="p-2 rounded-xl text-gray-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
