import type { RegulationIndex } from '../../engine/loader';
import type { FactMap } from '../../engine/types';
import { evaluateRule } from '../../engine/evaluator';

interface Props {
  index: RegulationIndex;
  factMap: FactMap;
}

export default function WarningsPanel({ index, factMap }: Props) {
  // Role-change warnings whose trigger conditions are confirmed or possible
  const activeWarnings = index.roleChangeWarnings.filter((w) => {
    const fakeRule = { id: w.id, label: w.label, conditions: w.trigger_conditions, obligations: [], source_article: w.source_article, confidence: w.confidence };
    const state = evaluateRule(fakeRule, factMap);
    return state === 'confirmed' || state === 'possible';
  });

  // Interaction provisions relevant to the selected role (show all for now)
  const provisions = index.interactionProvisions;

  if (activeWarnings.length === 0 && provisions.length === 0) {
    return <p className="text-xs text-gray-400 italic">No warnings.</p>;
  }

  return (
    <div className="space-y-4">
      {activeWarnings.map((w) => (
        <div key={w.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
            Role change warning
          </div>
          <p className="text-sm text-amber-900">{w.warning}</p>
          <p className="text-xs text-amber-600 mt-1">{w.source_article}</p>
        </div>
      ))}

      {provisions.map((p) => (
        <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {p.nature}
          </div>
          <p className="text-sm text-gray-700">{p.description}</p>
          <p className="text-xs text-gray-400 mt-1">{p.source_article}</p>
        </div>
      ))}
    </div>
  );
}
