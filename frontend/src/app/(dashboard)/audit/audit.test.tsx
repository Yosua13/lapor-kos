import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuditPage from './page';

vi.mock('@/features/properties/PropertyProvider', () => ({
  useActiveProperty: () => ({
    activeProperty: { id: 'prop-123', name: 'Kos Security Suite' },
  }),
}));

vi.mock('@/features/audit/api', () => ({
  listFinancialAudits: vi.fn().mockResolvedValue({
    items: [
      {
        id: 'audit-1',
        property_id: 'prop-123',
        actor_email: 'owner@example.test',
        actor_role: 'owner',
        action: 'payment_verify',
        entity_type: 'payment',
        entity_id: 'pay-456',
        amount_minor: 2500000,
        currency: 'IDR',
        reason: 'Verifikasi transfer bank BCA',
        correlation_id: 'trace-alpha-999',
        created_at: '2026-10-16T10:00:00Z',
      },
    ],
    total: 1,
    page: 1,
    page_size: 20,
    total_pages: 1,
  }),
  getSystemHealth: vi.fn().mockResolvedValue({
    status: 'ready',
    timestamp: '2026-10-16T10:00:00Z',
    database: {
      status: 'connected',
      latency_ms: 1.25,
      total_conns: 5,
      idle_conns: 3,
      acquired_conns: 2,
      max_conns: 20,
      latest_migration: '030_security_audit',
    },
    storage: {
      configured: true,
      main_bucket: 'uploads',
      tenant_doc_bucket: 'tenant-documents',
      private_namespace_enforced: true,
    },
    runtime: {
      goroutines: 12,
      uptime_seconds: 3600,
      environment: 'release',
      version: '1.0.0',
    },
    security: {
      cors_enforced: true,
      security_headers: true,
      rate_limiting_active: true,
      session_revocation_ok: true,
      audit_logging_active: true,
    },
  }),
  getSecurityChecklist: vi.fn().mockResolvedValue({
    secret_scanning_pass: true,
    migrations_in_order: true,
    private_files_enforced: true,
    multi_tenant_isolation_pass: true,
    restore_drill_pass: true,
    release_artifacts_pass: true,
    last_audited_at: '2026-10-16T10:00:00Z',
    active_financial_audit_count: 42,
  }),
  revokeUserSession: vi.fn().mockResolvedValue({
    message: 'User session revoked successfully',
    user_id: 'target-user-1',
  }),
  revokeMySessions: vi.fn().mockResolvedValue({
    message: 'All previous sessions revoked successfully',
  }),
}));

describe('AuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header and financial audit logs table', async () => {
    render(<AuditPage />);

    expect(screen.getByText('Audit, Observability & Keamanan')).toBeInTheDocument();
    expect(screen.getByText('Jejak Audit Finansial')).toBeInTheDocument();
    expect(screen.getByText('Observability & Kesiapan Sistem')).toBeInTheDocument();
    expect(screen.getByText('Kontrol Sesi & Kebijakan File')).toBeInTheDocument();
    expect(screen.getByText('Release Gate Checklist')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Verifikasi Pembayaran')).toBeInTheDocument();
      expect(screen.getByText('Verifikasi transfer bank BCA')).toBeInTheDocument();
      expect(screen.getByText(/trace-alpha-999/)).toBeInTheDocument();
    });
  });

  it('switches to Observability tab and displays readiness and pool metrics', async () => {
    render(<AuditPage />);

    const healthTab = screen.getByText('Observability & Kesiapan Sistem');
    fireEvent.click(healthTab);

    await waitFor(() => {
      expect(screen.getByText(/PostgreSQL Connectivity/)).toBeInTheDocument();
      expect(screen.getByText(/Private Storage Policy/)).toBeInTheDocument();
      expect(screen.getByText(/030_security_audit/)).toBeInTheDocument();
    });
  });

  it('switches to Release Gate tab and shows AC compliance checklist', async () => {
    render(<AuditPage />);

    const releaseGateTab = screen.getByText('Release Gate Checklist');
    fireEvent.click(releaseGateTab);

    await waitFor(() => {
      expect(screen.getByText(/1\. Secret Scanning & Credential Purity/)).toBeInTheDocument();
      expect(screen.getByText(/2\. Sequential Migration Integrity/)).toBeInTheDocument();
      expect(screen.getByText(/3\. Cross-Owner & Multi-Tenant Isolation/)).toBeInTheDocument();
      expect(screen.getByText(/4\. Automated Backup & Restore Drill/)).toBeInTheDocument();
      expect(screen.getByText(/5\. Release Artifact Purity/)).toBeInTheDocument();
    });
  });
});
