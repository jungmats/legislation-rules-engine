import type { Entity } from '../../engine/types';

interface Props {
  entities: Entity[];
  onSelect: (roleId: string) => void;
}

export default function RoleSelector({ entities, onSelect }: Props) {
  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-semibold mb-2">What is your role?</h2>
      <p className="text-gray-500 mb-6">
        Select the role that best describes your relationship to the AI system or product.
        Each session covers one role — you can restart to explore a different one.
      </p>
      <ul className="space-y-3">
        {entities.map((entity) => (
          <li key={entity.id}>
            <button
              onClick={() => onSelect(entity.id)}
              className="w-full text-left px-5 py-4 rounded-lg border border-gray-200 bg-white hover:border-blue-500 hover:shadow-sm transition-all"
            >
              <div className="font-medium">{entity.label}</div>
              {entity.description && (
                <div className="text-sm text-gray-500 mt-1">{entity.description}</div>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
