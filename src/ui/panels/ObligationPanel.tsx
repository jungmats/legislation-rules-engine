import type { ResolvedObligation, PossibleObligation, FactMap } from '../../engine/types';
import type { RegulationIndex } from '../../engine/loader';
import { computeDeadline } from '../../engine/deadlines';
import DeadlineBadge from '../components/DeadlineBadge';

interface Props {
  confirmed: ResolvedObligation[];
  possible: PossibleObligation[];
  ruledOutCount: number;
  index: RegulationIndex;
  factMap: FactMap;
}

export default function ObligationPanel({ confirmed, possible, ruledOutCount, index, factMap }: Props) {
  const factLabels = new Map(Array.from(index.facts.values()).map((f) => [f.id, f.label]));

  return (
    <div className="space-y-4">
      {/* Confirmed */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-green-700 mb-2">
          ✅ Confirmed ({confirmed.length})
        </h3>
        {confirmed.length === 0
          ? <p className="text-xs text-gray-400 italic">None yet</p>
          : <ul className="space-y-2">
              {confirmed.map(({ obligation, deadlinePolicy, applicableExemptions }) => {
                const deadline = computeDeadline(deadlinePolicy, factMap, factLabels);
                return (
                  <li key={obligation.id} className="text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-gray-800">{obligation.label}</span>
                      <DeadlineBadge result={deadline} />
                    </div>
                    {applicableExemptions.length > 0 && (
                      <div className="mt-1 text-xs text-amber-600">
                        ⚠ Exemption may apply: {applicableExemptions.map(e => e.label).join(', ')}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
        }
      </section>

      {/* Possible */}
      {possible.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">
            ⏳ Possible ({possible.length})
          </h3>
          <ul className="space-y-2">
            {possible.map(({ obligation, pendingConditions }) => (
              <li key={obligation.id} className="text-sm text-gray-500">
                <div>{obligation.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Depends on: {pendingConditions.map((c) => factLabels.get(c.fact_id) ?? c.fact_id).join(', ')}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ruled out */}
      {ruledOutCount > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
            ❌ Ruled out ({ruledOutCount} rules)
          </h3>
        </section>
      )}
    </div>
  );
}
