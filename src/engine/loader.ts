import type {
  Regulation, ScopeEntry, Entity, Fact, Obligation, DeadlinePolicy,
  Exemption, Rule, ActionTemplate, ComplianceEvidence, Penalty,
  InteractionProvision, RoleChangeWarning,
} from './types';

export interface RegulationIndex {
  regulation: Regulation;
  scope: ScopeEntry[];
  entities: Map<string, Entity>;
  facts: Map<string, Fact>;
  obligations: Map<string, Obligation>;
  deadlinePolicies: Map<string, DeadlinePolicy>;
  exemptions: Map<string, Exemption>;
  rules: Rule[];
  actionTemplates: ActionTemplate[];
  complianceEvidence: Map<string, ComplianceEvidence>;
  penalties: Penalty[];
  interactionProvisions: InteractionProvision[];
  roleChangeWarnings: RoleChangeWarning[];
}

/** Each bundled regulation exports a loader function of this shape */
export type RegulationLoader = () => Promise<RegulationIndex>;

function toMap<T extends { id: string }>(arr: T[]): Map<string, T> {
  return new Map(arr.map((item) => [item.id, item]));
}

export async function loadRegulation(slug: string): Promise<RegulationIndex> {
  // Dynamic imports — Vite will bundle each regulation's JSON at build time
  const [
    regulation,
    scope,
    entities,
    facts,
    obligations,
    deadlinePolicies,
    exemptions,
    rules,
    actionTemplates,
    complianceEvidence,
    penalties,
    interactionProvisions,
    roleChangeWarnings,
  ] = await Promise.all([
    import(`../data/${slug}/regulation.json`).then((m) => m.default as Regulation),
    import(`../data/${slug}/scope.json`).then((m) => m.default as ScopeEntry[]),
    import(`../data/${slug}/entities.json`).then((m) => m.default as Entity[]),
    import(`../data/${slug}/facts.json`).then((m) => m.default as Fact[]),
    import(`../data/${slug}/obligations.json`).then((m) => m.default as Obligation[]),
    import(`../data/${slug}/deadline_policies.json`).then((m) => m.default as DeadlinePolicy[]),
    import(`../data/${slug}/exemptions.json`).then((m) => m.default as Exemption[]),
    import(`../data/${slug}/rules.json`).then((m) => m.default as Rule[]),
    import(`../data/${slug}/action_templates.json`).then((m) => m.default as ActionTemplate[]),
    import(`../data/${slug}/compliance_evidence.json`).then((m) => m.default as ComplianceEvidence[]),
    import(`../data/${slug}/penalties.json`).then((m) => m.default as Penalty[]),
    // Optional files — gracefully absent for regulations extracted with skill v1.0
    import(`../data/${slug}/interaction_provisions.json`)
      .then((m) => m.default as InteractionProvision[])
      .catch(() => [] as InteractionProvision[]),
    import(`../data/${slug}/role_change_warnings.json`)
      .then((m) => m.default as RoleChangeWarning[])
      .catch(() => [] as RoleChangeWarning[]),
  ]);

  return {
    regulation,
    scope,
    entities: toMap(entities),
    facts: toMap(facts),
    obligations: toMap(obligations),
    deadlinePolicies: toMap(deadlinePolicies),
    exemptions: toMap(exemptions),
    rules,
    actionTemplates,
    complianceEvidence: toMap(complianceEvidence),
    penalties,
    interactionProvisions,
    roleChangeWarnings,
  };
}

/** Registry of available bundled regulations */
export const BUNDLED_REGULATIONS: { slug: string; label: string }[] = [
  { slug: 'eu-ai-act-2024-1689', label: 'EU AI Act (Regulation 2024/1689)' },
];
