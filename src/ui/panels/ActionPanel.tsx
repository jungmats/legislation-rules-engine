import type { ResolvedObligation, FactMap } from '../../engine/types';
import type { RegulationIndex } from '../../engine/loader';
import { computeDeadline } from '../../engine/deadlines';
import DeadlineBadge from '../components/DeadlineBadge';

interface Props {
  confirmed: ResolvedObligation[];
  index: RegulationIndex;
  factMap: FactMap;
  selectedRole: string | null;
}

export default function ActionPanel({ confirmed, index, factMap, selectedRole }: Props) {
  const factLabels = new Map(Array.from(index.facts.values()).map((f) => [f.id, f.label]));

  // Show actions for the user's role that serve a confirmed obligation
  const confirmedObligationIds = new Set(confirmed.map((o) => o.obligation.id));
  const relevantActions = index.actionTemplates.filter((a) => {
    if (a.responsible_party !== selectedRole) return false;
    if (!a.triggered_by) return true; // no obligation link — always show for role
    return confirmedObligationIds.has(a.triggered_by);
  });

  // Precompute all confirmed deadlines sorted by date, for inheritance fallback
  const sortedDeadlines = confirmed
    .map((o) => computeDeadline(o.deadlinePolicy, factMap, factLabels))
    .filter((d) => d.status === 'computed')
    .sort((a, b) => {
      if (a.status !== 'computed' || b.status !== 'computed') return 0;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  const earliestDeadline = sortedDeadlines[0] ?? null;

  if (relevantActions.length === 0) {
    return (
      <div className="text-xs text-gray-400 italic">
        No actions yet — confirm some obligations first.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {relevantActions.map((action, i) => {
        // Use the specific obligation's deadline if linked; otherwise inherit the earliest confirmed deadline
        const matchedObligation = action.triggered_by
          ? confirmed.find((o) => o.obligation.id === action.triggered_by)
          : undefined;
        const deadline = matchedObligation
          ? computeDeadline(matchedObligation.deadlinePolicy, factMap, factLabels)
          : earliestDeadline;

        return (
          <li key={action.id} className="flex gap-3 text-sm">
            <span className="text-gray-300 font-mono text-xs mt-0.5 w-5 shrink-0">{i + 1}.</span>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-gray-800">{action.label}</span>
                {deadline && <DeadlineBadge result={deadline} />}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{action.source_article}</div>
              {action.evidence_produced && (
                <div className="text-xs text-gray-400">
                  Produces: {index.complianceEvidence.get(action.evidence_produced)?.label ?? action.evidence_produced}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
