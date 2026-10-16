export type RuleCategory =
  | 'keamanan'
  | 'kebersihan'
  | 'fasilitas'
  | 'pembayaran'
  | 'ketertiban'
  | 'tamu'
  | 'umum';

export type RuleSeverity = 'critical' | 'major' | 'standard' | 'minor';

export type RuleVersionStatus = 'draft' | 'published' | 'superseded' | 'archived';

export interface RuleItem {
  id: string;
  rule_version_id: string;
  category: RuleCategory;
  title: string;
  description: string;
  details: string[];
  severity: RuleSeverity;
  order_index: number;
  penalty_description?: string;
  created_at: string;
}

export interface RuleVersion {
  id: string;
  rule_set_id: string;
  property_id: string;
  version_number: number;
  status: RuleVersionStatus;
  effective_from?: string;
  change_summary?: string;
  published_by?: string;
  published_by_name?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  items: RuleItem[];
  total_items: number;
  acknowledged?: boolean;
  acknowledged_at?: string;
}

export interface RuleSet {
  id: string;
  property_id: string;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface RuleAcknowledgment {
  id: string;
  property_id: string;
  rule_version_id: string;
  version_number: number;
  tenant_user_id: string;
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  room_number?: string;
  contract_id?: string;
  acknowledged_at: string;
  source_ip?: string;
  user_agent?: string;
  consent_text: string;
  amendment_notes?: string;
  created_at: string;
}

export interface RuleTemplateItem {
  category: RuleCategory;
  title: string;
  description: string;
  details: string[];
  severity: RuleSeverity;
}

export interface SaveDraftRulesRequest {
  title?: string;
  description?: string;
  change_summary?: string;
  items: Array<{
    category: RuleCategory;
    title: string;
    description: string;
    details: string[];
    severity: RuleSeverity;
    order_index?: number;
    penalty_description?: string;
  }>;
}

export interface PublishRuleVersionRequest {
  effective_from?: string;
  change_summary?: string;
}

export interface AcknowledgeRuleRequest {
  rule_version_id: string;
  contract_id?: string;
  consent_text: string;
}

export interface ActiveRulesResponse {
  rule_set?: RuleSet;
  version?: RuleVersion;
  acknowledged: boolean;
  acknowledgment?: RuleAcknowledgment;
  pending_new_version?: boolean;
}
