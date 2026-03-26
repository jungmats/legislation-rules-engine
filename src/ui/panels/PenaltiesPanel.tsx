import type { RegulationIndex } from '../../engine/loader';

interface Props {
  index: RegulationIndex;
}

export default function PenaltiesPanel({ index }: Props) {
  const penalties = index.penalties;

  if (penalties.length === 0) {
    return <p className="text-xs text-gray-400 italic">No penalties defined for this regulation.</p>;
  }

  return (
    <ul className="space-y-3">
      {penalties.map((p) => (
        <li key={p.id} className="rounded-lg border border-red-100 bg-red-50 p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-red-900">{p.label}</span>
            <span className="text-xs text-red-600 uppercase shrink-0">{p.penalty_type}</span>
          </div>
          <p className="text-xs text-red-800 mt-1">{p.amount_or_description}</p>
          {p.sme_startup_rule && (
            <p className="text-xs text-red-600 mt-1">SME/startup rule: {p.sme_startup_rule}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">{p.authority}</span>
            <span className="text-xs text-gray-400">{p.source_article}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
