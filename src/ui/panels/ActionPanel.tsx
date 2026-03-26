import type { ResolvedObligation, FactMap } from '../../engine/types';
import type { RegulationIndex } from '../../engine/loader';
import { computeDeadline } from '../../engine/deadlines';
import DeadlineBadge from '../components/DeadlineBadge';

interface Props {
  confirmed: ResolvedObligation[];
  index: RegulationIndex;
  factMap: FactMap;
}

export default function ActionPanel({ confirmed, index, factMap }: Props) {
  const factLabels = new Map(Array.from(index.facts.values()).map((f) => [f.id, f.label]));

  // Collect actions relevant to confirmed obligations
  const relevantActions = index.actionTemplates.filter((a) =>
    confirmed.some(() =>
      a.evidence_produced !== null
    )
  );

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
        // Find the deadline from the first confirmed obligation this action serves
        const matchedObligation = confirmed.find(() =>
          action.evidence_produced === index.complianceEvidence.get(action.evidence_produced ?? '')?.id
        );
        const deadline = matchedObligation
          ? computeDeadline(matchedObligation.deadlinePolicy, factMap, factLabels)
          : null;

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
