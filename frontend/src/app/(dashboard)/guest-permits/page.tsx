'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { CAPABILITIES } from '@/features/authorization/permissions';
import { useActiveProperty } from '@/features/properties/PropertyProvider';
import {
  getVisitorSummary,
  listVisitorPermits,
  tenantListVisitorPermits,
} from '@/features/guest-permits/api';
import type { VisitorPermit, VisitorPermitSummary } from '@/features/guest-permits/types';
import { VisitorSummaryCards } from '@/features/guest-permits/components/VisitorSummaryCards';
import { VisitorPermitList } from '@/features/guest-permits/components/VisitorPermitList';

export default function GuestPermitsPage() {
  const { isTenant, can } = useAuthorization();
  const { activeProperty } = useActiveProperty();

  const [permits, setPermits] = useState<VisitorPermit[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<VisitorPermitSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isOvernightOnly, setIsOvernightOnly] = useState(false);

  const canApprove = can(CAPABILITIES.VISITOR_PERMIT_APPROVE);
  const canCheckInOut = can(CAPABILITIES.VISITOR_PERMIT_CHECK_IN_OUT);

  const fetchPermits = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search.trim() || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        is_overnight: isOvernightOnly ? true : undefined,
      };

      if (isTenant) {
        const res = await tenantListVisitorPermits(params);
        setPermits(res.data || []);
        setTotal(res.total || 0);
      } else {
        const res = await listVisitorPermits(params);
        setPermits(res.data || []);
        setTotal(res.total || 0);
      }
    } catch {
      setPermits([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, isOvernightOnly, isTenant, search, statusFilter, toDate]);

  const fetchSummary = useCallback(async () => {
    if (isTenant) return;
    setIsSummaryLoading(true);
    try {
      const res = await getVisitorSummary();
      setSummary(res);
    } catch {
      setSummary(null);
    } finally {
      setIsSummaryLoading(false);
    }
  }, [isTenant]);

  useEffect(() => {
    fetchPermits();
  }, [fetchPermits]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-md shadow-cyan-600/20">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Izin Tamu & Kerabat Menginap
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isTenant
                  ? 'Ajukan dan pantau status izin tamu atau kerabat menginap di kamar Anda.'
                  : `Kelola permintaan kunjungan, persetujuan, check-in, dan overstay tamu pada ${activeProperty?.name || 'Properti'}.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary metrics for staff */}
      {!isTenant && (
        <VisitorSummaryCards summary={summary} isLoading={isSummaryLoading} />
      )}

      {/* Main List */}
      <VisitorPermitList
        permits={permits}
        total={total}
        isLoading={isLoading}
        isTenant={isTenant}
        canApprove={canApprove}
        canCheckInOut={canCheckInOut}
        onRefresh={() => {
          fetchPermits();
          fetchSummary();
        }}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        search={search}
        onSearchChange={setSearch}
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
        isOvernightOnly={isOvernightOnly}
        onOvernightChange={setIsOvernightOnly}
      />
    </div>
  );
}
