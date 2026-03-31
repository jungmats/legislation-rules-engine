// ── Shared ────────────────────────────────────────────────────────────────────

export type Confidence = 'high' | 'medium' | 'low';

export type Operator = '=' | '!=' | '>=' | '<=' | '>' | '<' | 'in' | 'not_in';

export interface Condition {
  fact_id: string;
  operator: Operator;
  value: unknown;
}

// ── regulation.json ───────────────────────────────────────────────────────────

export interface Regulation {
  id: string;
  title: string;
  short_name: string;
  number: string;
  publication_date: string;
  effective_date: string;
  jurisdiction: string;
  source_url: string;
  amendment_chain?: string[];
}

// ── scope.json ────────────────────────────────────────────────────────────────

export interface ScopeEntry {
  id: string;
  label: string;
  type: 'in_scope' | 'exclusion';
  conditions: Condition[];
  description: string;
  source_article: string;
  confidence: Confidence;
  human_review_note?: string;
}

// ── entities.json ─────────────────────────────────────────────────────────────

export interface Entity {
  id: string;
  label: string;
  description?: string;
  definition?: string;
  note?: string;
  source_article?: string;
}

// ── facts.json ────────────────────────────────────────────────────────────────

export type FactType = 'boolean' | 'enum' | 'number' | 'integer' | 'string' | 'date';

export interface Fact {
  id: string;
  label: string;
  type: FactType;
  unit?: string;
  allowed_values?: string[];
  value_descriptions?: Record<string, string>;
  source?: string;
  source_article?: string;
  confidence: Confidence;
  human_review_note?: string;
}

// ── obligations.json ──────────────────────────────────────────────────────────

export interface Obligation {
  id: string;
  label: string;
  description: string;
  threshold_type?: 'relative' | 'absolute';
  reduction_pct?: number;
  reference_fact?: string;
  target_fact?: string;
  max_value?: number;
  unit?: string;
  alternative_obligation_id?: string;
  successor_obligation_id?: string;
  source_article: string;
  confidence: Confidence;
  human_review_note?: string;
}

// ── deadline_policies.json ────────────────────────────────────────────────────

export interface DeadlinePolicy {
  id: string;
  label: string;
  anchor_type: 'fixed_date' | 'fact_relative';
  anchor_value: string;
  offset_months?: number;
  recurrence: 'one_time' | 'annual' | 'periodic';
  period_months?: number;
  source_article?: string;
}

// ── exemptions.json ───────────────────────────────────────────────────────────

export interface Exemption {
  id: string;
  label: string;
  trigger_conditions: Condition[];
  effect: 'waived' | 'reduced' | 'deferred';
  reduction_pct?: number;
  deadline_policy_id?: string;
  description: string;
  obligations_modified: string[] | 'all' | string;
  source_article: string;
  confidence: Confidence;
  human_review_note?: string;
}

// ── rules.json ────────────────────────────────────────────────────────────────

export interface RuleObligation {
  obligation_id: string;
  deadline_policy_id: string;
}

export interface Rule {
  id: string;
  label: string;
  conditions: Condition[];
  obligations: RuleObligation[];
  applicable_exemptions?: string[];
  source_article: string;
  confidence: Confidence;
  human_review_note?: string;
}

// ── action_templates.json ─────────────────────────────────────────────────────

export interface ActionTemplate {
  id: string;
  label: string;
  description: string;
  responsible_party: string;
  required_inputs: string[];
  evidence_produced: string | null;
  prerequisites: string[];
  triggered_by?: string;
  source_article: string;
  confidence: Confidence;
}

// ── compliance_evidence.json ──────────────────────────────────────────────────

export interface RequiredSection {
  section_id: string;
  label: string;
  description: string;
  required: boolean;
}

export interface ComplianceEvidence {
  id: string;
  label: string;
  description: string;
  platform: string;
  required_fields?: string[];
  required_sections?: RequiredSection[];
  required_sections_confidence?: Confidence;
  required_sections_note?: Record<string, string>;
  documentation_template?: string;
  frequency: string;
  retention_years?: number;
  deadline_policy_id?: string;
  source_article: string;
  confidence: Confidence;
}

// ── penalties.json ────────────────────────────────────────────────────────────

export interface Penalty {
  id: string;
  label: string;
  penalty_type: 'fine' | 'publication' | 'injunction' | 'criminal';
  trigger: string;
  amount_or_description: string;
  amount_max_eur?: number;
  amount_max_pct_global_turnover?: number;
  higher_of_two?: boolean;
  sme_startup_rule?: string;
  authority: string;
  source_article: string;
  confidence: Confidence;
  human_review_note?: string;
}

// ── interaction_provisions.json ───────────────────────────────────────────────

export type InteractionNature =
  | 'upstream-supplies-document'
  | 'obligation-passthrough'
  | 'shared-liability'
  | 'role-change-trigger';

export interface InteractionProvision {
  id: string;
  label: string;
  source_article: string;
  entities_involved: string[];
  nature: InteractionNature;
  description: string;
  obligation_ids_at_stake: string[];
  confidence: Confidence;
}

// ── role_change_warnings.json ─────────────────────────────────────────────────

export interface RoleChangeWarning {
  id: string;
  label: string;
  source_article: string;
  trigger_conditions: Condition[];
  current_assumed_role: string;
  potentially_applicable_role: string;
  warning: string;
  obligations_at_stake: string[];
  confidence: Confidence;
}

// ── Engine runtime types ───────────────────────────────────────────────────────

/** All facts answered so far in a session. Value is null when skipped. */
export type FactMap = Map<string, unknown | null>;

export type RuleState = 'confirmed' | 'possible' | 'ruled_out';

export interface EvaluatedRule {
  rule: Rule;
  state: RuleState;
  /** For possible rules: which fact_ids are still unanswered */
  unknownFacts: string[];
}

export interface ResolvedObligation {
  obligation: Obligation;
  deadlinePolicy: DeadlinePolicy;
  /** Rules that confirmed this obligation */
  confirmedByRules: string[];
  /** Applicable exemptions (display only in v1) */
  applicableExemptions: Exemption[];
}

export interface PossibleObligation {
  obligation: Obligation;
  deadlinePolicy: DeadlinePolicy;
  /** The unanswered conditions that would confirm this obligation */
  pendingConditions: Condition[];
}
