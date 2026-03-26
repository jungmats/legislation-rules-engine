import type { DeadlineResult } from '../../engine/deadlines';
import { deadlineUrgency } from '../../engine/deadlines';

interface Props {
  result: DeadlineResult;
}

export default function DeadlineBadge({ result }: Props) {
  if (result.status === 'pending') {
    return (
      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
        Requires: {result.requiredFactLabel}
      </span>
    );
  }

  const urgency = deadlineUrgency(result.date);
  const styles = {
    overdue: 'text-red-700 bg-red-50 border-red-200',
    soon:    'text-amber-700 bg-amber-50 border-amber-200',
    future:  'text-gray-600 bg-gray-50 border-gray-200',
  }[urgency];

  return (
    <span className={`text-xs border rounded px-2 py-0.5 ${styles}`}>
      {urgency === 'overdue' ? '⚠ ' : ''}{result.formatted}
    </span>
  );
}
