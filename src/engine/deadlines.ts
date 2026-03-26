import type { DeadlinePolicy, FactMap } from './types';

export type DeadlineResult =
  | { status: 'computed'; date: Date; formatted: string }
  | { status: 'pending'; requiredFactId: string; requiredFactLabel: string };

/**
 * Compute the deadline for a given policy.
 * Returns a computed date or a pending indicator when the anchor fact is unknown.
 */
export function computeDeadline(
  policy: DeadlinePolicy,
  factMap: FactMap,
  factLabels: Map<string, string>,
): DeadlineResult {
  if (policy.anchor_type === 'fixed_date') {
    const date = addMonths(new Date(policy.anchor_value), policy.offset_months ?? 0);
    return { status: 'computed', date, formatted: formatDate(date) };
  }

  // fact_relative: anchor_value is a fact_id
  const factId = policy.anchor_value;
  const value = factMap.get(factId);

  if (!value || value === null) {
    return {
      status: 'pending',
      requiredFactId: factId,
      requiredFactLabel: factLabels.get(factId) ?? factId,
    };
  }

  const anchorDate = new Date(value as string);
  if (isNaN(anchorDate.getTime())) {
    return {
      status: 'pending',
      requiredFactId: factId,
      requiredFactLabel: factLabels.get(factId) ?? factId,
    };
  }

  const date = addMonths(anchorDate, policy.offset_months ?? 0);
  return { status: 'computed', date, formatted: formatDate(date) };
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Returns 'overdue', 'soon' (within 90 days), or 'future' */
export function deadlineUrgency(date: Date): 'overdue' | 'soon' | 'future' {
  const now = new Date();
  const diffDays = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 90) return 'soon';
  return 'future';
}
