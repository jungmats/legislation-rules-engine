import type { Rule, Fact, FactMap, RuleState, ResolvedObligation } from './types';
import { evaluateRule } from './evaluator';

/**
 * Compute gating score for each fact.
 * Score = number of still-possible rules that reference this fact in their conditions.
 * Facts with score 0 are not relevant and should not be asked.
 */
export function computeGatingScores(
  facts: Map<string, Fact>,
  rules: Rule[],
  factMap: FactMap,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const rule of rules) {
    const state: RuleState = evaluateRule(rule, factMap);
    if (state === 'ruled_out') continue; // skip eliminated rules

    for (const condition of rule.conditions) {
      if (factMap.has(condition.fact_id)) continue; // already answered
      scores.set(condition.fact_id, (scores.get(condition.fact_id) ?? 0) + 1);
    }
  }

  // Ensure all facts have an entry (0 if unreferenced)
  for (const id of facts.keys()) {
    if (!scores.has(id)) scores.set(id, 0);
  }

  return scores;
}

/**
 * Return the next fact to ask: highest-scoring unanswered fact
 * among those that appear in at least one possible rule.
 * Returns null when no more questions are needed.
 */
export function nextQuestion(
  facts: Map<string, Fact>,
  rules: Rule[],
  factMap: FactMap,
): Fact | null {
  const scores = computeGatingScores(facts, rules, factMap);

  let best: Fact | null = null;
  let bestScore = 0;

  for (const [factId, score] of scores) {
    if (score === 0) continue;
    if (factMap.has(factId)) continue; // already answered or skipped
    const fact = facts.get(factId);
    if (!fact) continue;
    if (score > bestScore || (score === bestScore && best && factId < best.id)) {
      best = fact;
      bestScore = score;
    }
  }

  return best;
}

/**
 * Return the ordered list of measurement facts still needed for the assessment phase.
 *
 * For each confirmed obligation that has a threshold_type, collect:
 *   baseline_fact (relative only) → measured_fact → threshold_fact (if present)
 * in that order, skipping any already answered or skipped in factMap.
 *
 * Facts are deduplicated: if the same fact id appears across multiple obligations
 * it is only included once (at first occurrence).
 */
export function measurementFactsNeeded(
  confirmed: ResolvedObligation[],
  factMap: FactMap,
  facts: Map<string, Fact>,
): Fact[] {
  const seen = new Set<string>();
  const result: Fact[] = [];

  for (const { obligation } of confirmed) {
    if (!obligation.threshold_type) continue;

    const candidates: (string | undefined)[] = [];

    if (obligation.threshold_type === 'relative') {
      candidates.push(obligation.baseline_fact);
    }
    candidates.push(obligation.measured_fact);
    if (obligation.threshold_fact) {
      candidates.push(obligation.threshold_fact);
    }

    for (const factId of candidates) {
      if (!factId) continue;
      if (seen.has(factId)) continue;
      seen.add(factId);
      if (factMap.has(factId)) continue; // already answered or skipped
      const fact = facts.get(factId);
      if (fact) result.push(fact);
    }
  }

  return result;
}
