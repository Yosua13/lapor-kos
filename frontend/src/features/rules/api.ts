import { apiFetch } from '@/lib/api';
import type {
  ActiveRulesResponse,
  AcknowledgeRuleRequest,
  PublishRuleVersionRequest,
  RuleAcknowledgment,
  RuleTemplateItem,
  RuleVersion,
  SaveDraftRulesRequest,
} from './types';

// Fetch current active rules (strictly read-only query)
export const fetchRules = async (): Promise<any[]> => {
  return apiFetch<any[]>('/api/rules');
};

// Fetch standard rule templates without any database write
export const fetchRuleTemplates = async (): Promise<RuleTemplateItem[]> => {
  const res = await apiFetch<{ templates: RuleTemplateItem[] }>('/api/rules/templates');
  return res.templates || [];
};

// Fetch active published rules and user's acknowledgment status
export const fetchActiveRules = async (): Promise<ActiveRulesResponse> => {
  return apiFetch<ActiveRulesResponse>('/api/rules/active');
};

// List all versions (draft, published, superseded) for current property
export const fetchRuleVersions = async (): Promise<RuleVersion[]> => {
  const res = await apiFetch<{ versions: RuleVersion[] }>('/api/rules/versions');
  return res.versions || [];
};

// Fetch detailed single rule version with items
export const fetchRuleVersion = async (versionID: string): Promise<RuleVersion> => {
  return apiFetch<RuleVersion>(`/api/rules/versions/${versionID}`);
};

// Save or update draft rule set
export const saveDraftRules = async (req: SaveDraftRulesRequest): Promise<RuleVersion> => {
  const res = await apiFetch<{ draft: RuleVersion }>('/api/rules/draft', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return res.draft;
};

// Publish draft rule version to become active and immutable
export const publishRuleVersion = async (
  versionID: string,
  req: PublishRuleVersionRequest,
): Promise<RuleVersion> => {
  const res = await apiFetch<{ published: RuleVersion }>(`/api/rules/versions/${versionID}/publish`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return res.published;
};

// Tenant acknowledgment of active house rules
export const acknowledgeRules = async (
  req: AcknowledgeRuleRequest,
): Promise<RuleAcknowledgment> => {
  const res = await apiFetch<{ acknowledgment: RuleAcknowledgment }>('/api/rules/active/acknowledge', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return res.acknowledgment;
};

// List audit trail of acknowledgments for a specific version
export const fetchRuleAcknowledgments = async (
  versionID: string,
): Promise<RuleAcknowledgment[]> => {
  const res = await apiFetch<{ acknowledgments: RuleAcknowledgment[] }>(
    `/api/rules/versions/${versionID}/acknowledgments`,
  );
  return res.acknowledgments || [];
};
