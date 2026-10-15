'use client';

import { useState } from 'react';
import {
  Bell,
  Inbox,
  Sliders,
  Send,
} from 'lucide-react';
import { NotificationCenter } from '@/features/notifications/components/NotificationCenter';
import { NotificationPreferencesForm } from '@/features/notifications/components/NotificationPreferencesForm';
import { DeliveryPlatformMonitor } from '@/features/notifications/components/DeliveryPlatformMonitor';
import { useActiveProperty } from '@/features/properties/PropertyProvider';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { CAPABILITIES } from '@/features/authorization/permissions';

type Tab = 'inbox' | 'preferences' | 'outbox';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const { activeProperty } = useActiveProperty();
  const { can, isTenant } = useAuthorization();

  const canViewOutbox = !isTenant && activeProperty && can(CAPABILITIES.NOTIFICATION_READ);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-[26px] text-brand-navy flex items-center gap-2.5">
            <Bell className="w-7 h-7 text-brand-teal" />
            Pusat Notifikasi & Delivery
          </h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Pantau pesan kotak masuk, sesuaikan jam tenang (quiet hours), dan tinjau status delivery platform
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('inbox')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors ${
            activeTab === 'inbox'
              ? 'border-brand-teal text-brand-teal'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Inbox className="w-4 h-4" />
          Kotak Masuk (Inbox)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors ${
            activeTab === 'preferences'
              ? 'border-brand-teal text-brand-teal'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Preferensi & Jam Tenang
        </button>

        {canViewOutbox && (
          <button
            type="button"
            onClick={() => setActiveTab('outbox')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition-colors ${
              activeTab === 'outbox'
                ? 'border-brand-teal text-brand-teal'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Send className="w-4 h-4" />
            Monitoring Pengiriman (Outbox)
          </button>
        )}
      </div>

      {/* Content */}
      <div className="pt-2">
        {activeTab === 'inbox' && <NotificationCenter />}
        {activeTab === 'preferences' && <NotificationPreferencesForm />}
        {activeTab === 'outbox' && canViewOutbox && (
          <DeliveryPlatformMonitor propertyId={activeProperty.id} />
        )}
      </div>
    </div>
  );
}
