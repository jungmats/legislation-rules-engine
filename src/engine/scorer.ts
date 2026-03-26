import type { Rule, Fact, FactMap, RuleState } from './types';
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
