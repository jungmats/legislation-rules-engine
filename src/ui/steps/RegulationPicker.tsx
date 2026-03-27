import { BUNDLED_REGULATIONS } from '../../engine/loader';

interface Props {
  onSelect: (slug: string) => void;
}

export default function RegulationPicker({ onSelect }: Props) {
  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-semibold mb-2">Select a regulation</h2>
      <p className="text-gray-500 mb-6">
        Choose a regulation to explore. The engine will guide you through a short questionnaire
        and show your applicable obligations in real time.
      </p>
      <ul className="space-y-3">
        {BUNDLED_REGULATIONS.map((reg) => (
          <li key={reg.slug}>
            <button
              onClick={() => onSelect(reg.slug)}
              className="w-full text-left px-5 py-4 rounded-lg border border-gray-200 bg-white hover:border-blue-500 hover:shadow-sm transition-all"
            >
              <span className="font-semibold text-gray-900">{reg.shortName}</span>
              <span className="block text-sm text-gray-500 mt-0.5">{reg.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
