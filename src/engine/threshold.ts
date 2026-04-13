import type { Obligation, FactMap } from './types';

export type ComplianceStatus =
  | { status: 'compliant'; measured: number; threshold: number; delta: number; unit?: string }
  | { status: 'risk';      measured: number; threshold: number; delta: number; unit?: string; proximityPct: number }
  | { status: 'violation'; measured: number; threshold: number; delta: number; unit?: string }
  | { status: 'pending';   missingFacts: string[] }
  | { status: 'not_applicable' };

const DEFAULT_RISK_PROXIMITY_PCT = 10;

/**
 * Evaluate whether a confirmed obligation is currently being met.
 *
 * Returns:
 * - not_applicable  — obligation has no threshold_type
 * - pending         — one or more required facts are not yet answered
 * - compliant       — measured value is below the threshold
 * - risk            — measured value is within riskProximityPct% of the threshold
 * - violation       — measured value exceeds the threshold
 */
export function evaluateThreshold(
  obligation: Obligation,
  factMap: FactMap,
  riskProximityPct: number = DEFAULT_RISK_PROXIMITY_PCT,
): ComplianceStatus {
  if (!obligation.threshold_type) {
    return { status: 'not_applicable' };
  }

  const missing: string[] = [];

  // Collect measured value
  if (!obligation.measured_fact) {
    return { status: 'not_applicable' };
  }
  const measuredRaw = factMap.get(obligation.measured_fact);
  if (measuredRaw === undefined || measuredRaw === null) {
    missing.push(obligation.measured_fact);
  }

  // Collect threshold value depending on type
  let threshold: number | undefined;

  if (obligation.threshold_type === 'relative') {
    if (!obligation.baseline_fact) return { status: 'not_applicable' };
    const baselineRaw = factMap.get(obligation.baseline_fact);
    if (baselineRaw === undefined || baselineRaw === null) {
      missing.push(obligation.baseline_fact);
    } else if (obligation.reduction_pct != null) {
      threshold = (baselineRaw as number) * (1 - obligation.reduction_pct / 100);
    }
  } else {
    // absolute
    if (obligation.threshold_fact) {
      const tfRaw = factMap.get(obligation.threshold_fact);
      if (tfRaw === undefined || tfRaw === null) {
        missing.push(obligation.threshold_fact);
      } else {
        threshold = tfRaw as number;
      }
    } else if (obligation.max_value != null) {
      threshold = obligation.max_value;
    } else {
      // No threshold available yet (e.g. max_value is null pending a decree)
      missing.push('threshold value (pending ministerial decree)');
    }
  }

  if (missing.length > 0) {
    return { status: 'pending', missingFacts: missing };
  }

  const measured = measuredRaw as number;
  const delta = measured - threshold!;
  const unit = obligation.unit;
  const riskWindow = threshold! * (riskProximityPct / 100);

  if (delta > 0) {
    return { status: 'violation', measured, threshold: threshold!, delta, unit };
  }
  if (delta > -riskWindow) {
    return { status: 'risk', measured, threshold: threshold!, delta, unit, proximityPct: riskProximityPct };
  }
  return { status: 'compliant', measured, threshold: threshold!, delta, unit };
}
