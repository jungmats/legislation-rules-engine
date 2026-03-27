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

function toMap<T extends { id: string }>(arr: T[]): Map<string, T> {
  return new Map(arr.map((item) => [item.id, item]));
}

// Auto-discover all regulation slugs from assets/legislation/*/regulation.json
const regulationMeta = import.meta.glob('../../assets/legislation/*/regulation.json', { eager: true });

export const BUNDLED_REGULATIONS: { slug: string; label: string; shortName: string }[] = Object.keys(regulationMeta)
  .map((path) => {
    // path looks like: ../../assets/legislation/eu-ai-act-2024-1689/regulation.json
    const parts = path.split('/');
    const slug = parts[parts.length - 2] ?? '';
    const reg = (regulationMeta[path] as { default: Regulation }).default;
    return { slug, label: reg.title ?? slug, shortName: reg.short_name ?? reg.title ?? slug };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

export async function loadRegulation(slug: string): Promise<RegulationIndex> {
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
    import(`../../assets/legislation/${slug}/regulation.json`).then((m) => m.default as Regulation),
    import(`../../assets/legislation/${slug}/scope.json`).then((m) => m.default as ScopeEntry[]),
    import(`../../assets/legislation/${slug}/entities.json`).then((m) => m.default as Entity[]),
    import(`../../assets/legislation/${slug}/facts.json`).then((m) => m.default as Fact[]),
    import(`../../assets/legislation/${slug}/obligations.json`).then((m) => m.default as Obligation[]),
    import(`../../assets/legislation/${slug}/deadline_policies.json`).then((m) => m.default as DeadlinePolicy[]),
    import(`../../assets/legislation/${slug}/exemptions.json`).then((m) => m.default as Exemption[]),
    import(`../../assets/legislation/${slug}/rules.json`).then((m) => m.default as Rule[]),
    import(`../../assets/legislation/${slug}/action_templates.json`).then((m) => m.default as ActionTemplate[]),
    import(`../../assets/legislation/${slug}/compliance_evidence.json`).then((m) => m.default as ComplianceEvidence[]),
    import(`../../assets/legislation/${slug}/penalties.json`).then((m) => m.default as Penalty[]),
    // Optional — gracefully absent for skill v1.0 output
    import(`../../assets/legislation/${slug}/interaction_provisions.json`)
      .then((m) => m.default as InteractionProvision[])
      .catch(() => [] as InteractionProvision[]),
    import(`../../assets/legislation/${slug}/role_change_warnings.json`)
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
