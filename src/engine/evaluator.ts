import type {
  Rule, Condition, FactMap, RuleState, EvaluatedRule,
  ResolvedObligation, PossibleObligation,
  Exemption,
} from './types';
import type { RegulationIndex } from './loader';

/** Evaluate a single condition against the fact map */
function conditionMet(condition: Condition, value: unknown): boolean {
  const { operator, value: target } = condition;
  switch (operator) {
    case '=':      return value === target;
    case '!=':     return value !== target;
    case '>':      return (value as number) > (target as number);
    case '<':      return (value as number) < (target as number);
    case '>=':     return (value as number) >= (target as number);
    case '<=':     return (value as number) <= (target as number);
    case 'in':     return Array.isArray(target) && target.includes(value);
    case 'not_in': return Array.isArray(target) && !target.includes(value);
    default:       return false;
  }
}

/** Three-state evaluation of a single rule */
export function evaluateRule(rule: Rule, factMap: FactMap): RuleState {
  let hasUnknown = false;

  for (const condition of rule.conditions) {
    const answered = factMap.has(condition.fact_id);
    if (!answered) {
      hasUnknown = true;
      continue;
    }
    const value = factMap.get(condition.fact_id);
    // Skipped facts (null) are treated as unknown, not as false
    if (value === null) {
      hasUnknown = true;
      continue;
    }
    if (!conditionMet(condition, value)) return 'ruled_out';
  }

  return hasUnknown ? 'possible' : 'confirmed';
}

/** Evaluate all rules and return their states */
export function evaluateAllRules(
  rules: Rule[],
  factMap: FactMap,
): EvaluatedRule[] {
  return rules.map((rule) => {
    const state = evaluateRule(rule, factMap);
    const unknownFacts = state === 'possible'
      ? rule.conditions
          .filter((c) => !factMap.has(c.fact_id) || factMap.get(c.fact_id) === null)
          .map((c) => c.fact_id)
      : [];
    return { rule, state, unknownFacts };
  });
}

/** Collect confirmed and possible obligations from evaluated rules */
export function collectObligations(
  evaluated: EvaluatedRule[],
  index: RegulationIndex,
): {
  confirmed: ResolvedObligation[];
  possible: PossibleObligation[];
} {
  const confirmedMap = new Map<string, ResolvedObligation>();
  const possibleMap = new Map<string, PossibleObligation>();

  for (const { rule, state, unknownFacts } of evaluated) {
    if (state === 'ruled_out') continue;

    for (const ro of rule.obligations) {
      const obligation = index.obligations.get(ro.obligation_id);
      const deadlinePolicy = index.deadlinePolicies.get(ro.deadline_policy_id);
      if (!obligation || !deadlinePolicy) continue;

      if (state === 'confirmed') {
        if (confirmedMap.has(ro.obligation_id)) {
          // Merge: add this rule to confirmedByRules
          confirmedMap.get(ro.obligation_id)!.confirmedByRules.push(rule.id);
        } else {
          const applicableExemptions = resolveExemptions(rule, index);
          confirmedMap.set(ro.obligation_id, {
            obligation,
            deadlinePolicy,
            confirmedByRules: [rule.id],
            applicableExemptions,
          });
        }
        // Remove from possible if it was there
        possibleMap.delete(ro.obligation_id);
      } else if (state === 'possible' && !confirmedMap.has(ro.obligation_id)) {
        if (possibleMap.has(ro.obligation_id)) {
          // Merge pending conditions
          const existing = possibleMap.get(ro.obligation_id)!;
          const existingIds = new Set(existing.pendingConditions.map((c) => c.fact_id));
          for (const c of rule.conditions.filter((c) => unknownFacts.includes(c.fact_id))) {
            if (!existingIds.has(c.fact_id)) existing.pendingConditions.push(c);
          }
        } else {
          const pendingConditions = rule.conditions.filter((c) =>
            unknownFacts.includes(c.fact_id),
          );
          possibleMap.set(ro.obligation_id, { obligation, deadlinePolicy, pendingConditions });
        }
      }
    }
  }

  return {
    confirmed: Array.from(confirmedMap.values()),
    possible: Array.from(possibleMap.values()),
  };
}

function resolveExemptions(rule: Rule, index: RegulationIndex): Exemption[] {
  if (!rule.applicable_exemptions?.length) return [];
  return rule.applicable_exemptions
    .map((id) => index.exemptions.get(id))
    .filter((e): e is Exemption => e !== undefined);
}
