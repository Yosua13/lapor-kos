export interface FinancialAuditLog {
  id: string;
  property_id: string;
  actor_id?: string;
  actor_email: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  amount_minor: number;
  currency: string;
  reason: string;
  correlation_id: string;
  ip_address?: string;
  user_agent?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface FinancialAuditFilter {
  property_id?: string;
  entity_type?: string;
  action?: string;
  correlation_id?: string;
  actor_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface FinancialAuditListResult {
  items: FinancialAuditLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DatabaseHealth {
  status: string;
  latency_ms: number;
  total_conns: number;
  idle_conns: number;
  acquired_conns: number;
  max_conns: number;
  latest_migration: string;
}

export interface StorageHealth {
  configured: boolean;
  main_bucket: string;
  tenant_doc_bucket: string;
  private_namespace_enforced: boolean;
}

export interface RuntimeHealth {
  goroutines: number;
  uptime_seconds: number;
  environment: string;
  version: string;
}

export interface SecuritySummary {
  cors_enforced: boolean;
  security_headers: boolean;
  rate_limiting_active: boolean;
  session_revocation_ok: boolean;
  audit_logging_active: boolean;
}

export interface SystemHealthStatus {
  status: 'ready' | 'degraded' | 'unhealthy';
  timestamp: string;
  database: DatabaseHealth;
  storage: StorageHealth;
  runtime: RuntimeHealth;
  security: SecuritySummary;
}

export interface SecurityChecklist {
  secret_scanning_pass: boolean;
  migrations_in_order: boolean;
  private_files_enforced: boolean;
  multi_tenant_isolation_pass: boolean;
  restore_drill_pass: boolean;
  release_artifacts_pass: boolean;
  last_audited_at: string;
  active_financial_audit_count: number;
}

export interface RevokeSessionPayload {
  user_id: string;
  reason: string;
}
