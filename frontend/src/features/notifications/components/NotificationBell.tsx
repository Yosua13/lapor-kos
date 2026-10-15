'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check, ExternalLink, Trash2 } from 'lucide-react';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../api';
import { getCategoryBadgeStyle, getCategoryLabel, formatRelativeTime } from '../format';
import type { InAppNotification } from '../types';

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<InAppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Poll unread count on mount
  const refreshUnread = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshUnread();
    const interval = setInterval(refreshUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch recent notifications when dropdown opened
  const loadRecent = async () => {
    setIsLoading(true);
    try {
      const res = await getNotifications({ limit: 5 });
      setRecentNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      loadRecent();
    }
    setIsOpen((prev) => !prev);
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setRecentNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemClick = async (notif: InAppNotification) => {
    if (!notif.is_read) {
      try {
        await markNotificationRead(notif.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setRecentNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch {
        // ignore
      }
    }
    if (notif.action_url) {
      setIsOpen(false);
      router.push(notif.action_url);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setRecentNotifications((prev) => prev.filter((n) => n.id !== id));
      refreshUnread();
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        aria-label="Pusat Notifikasi"
        onClick={toggleDropdown}
        className="relative rounded-xl p-2.5 text-brand-navy/60 transition-colors hover:bg-brand-teal/5 hover:text-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl z-50 animate-slide-up">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-brand-navy text-sm">Notifikasi</h3>
              <p className="text-xs text-gray-500">
                {unreadCount > 0 ? `${unreadCount} pesan belum dibaca` : 'Semua pesan telah dibaca'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-brand-teal hover:underline flex items-center gap-1"
              >
                <Check className="h-3 w-3" />
                Tandai dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 my-2">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-gray-400">Memuat notifikasi...</div>
            ) : recentNotifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                Belum ada notifikasi saat ini
              </div>
            ) : (
              recentNotifications.map((n) => {
                const badge = getCategoryBadgeStyle(n.category);
                return (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`p-3 rounded-xl transition-colors cursor-pointer hover:bg-gray-50 flex items-start justify-between gap-3 ${
                      !n.is_read ? 'bg-brand-teal/5 font-medium' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {getCategoryLabel(n.category)}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {formatRelativeTime(n.created_at)}
                        </span>
                        {!n.is_read && (
                          <span className="h-2 w-2 rounded-full bg-brand-teal shrink-0" />
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-brand-navy truncate">{n.title}</h4>
                      <p className="text-xs text-gray-600 line-clamp-2 mt-0.5 leading-relaxed">
                        {n.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 mt-1">
                      {n.action_url && (
                        <span title="Buka tautan" className="text-gray-400 hover:text-brand-teal">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <button
                        type="button"
                        title="Hapus notifikasi"
                        onClick={(e) => handleDelete(e, n.id)}
                        className="text-gray-300 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-gray-100 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-brand-teal hover:text-brand-navy block py-1.5 transition-colors"
            >
              Buka Seluruh Kotak Masuk →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
