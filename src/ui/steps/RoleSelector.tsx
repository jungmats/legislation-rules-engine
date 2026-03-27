import type { Entity, Fact } from '../../engine/types';

interface Props {
  entities: Map<string, Entity>;
  entityRoleFact: Fact | undefined;
  onSelect: (roleId: string) => void;
}

export default function RoleSelector({ entities, entityRoleFact, onSelect }: Props) {
  // Only show entities that are selectable user roles (those listed in entity_role.allowed_values)
  const selectableIds: string[] = entityRoleFact?.allowed_values ?? Array.from(entities.keys());
  const selectableEntities = selectableIds
    .map((id) => entities.get(id))
    .filter((e): e is Entity => e !== undefined);

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-semibold mb-2">What is your role?</h2>
      <p className="text-gray-500 mb-6">
        Select the role that best describes your relationship to the subject of this regulation.
        Each session covers one role — you can restart to explore a different one.
      </p>
      <ul className="space-y-3">
        {selectableEntities.map((entity) => {
          const description = entity.definition ?? entity.description;
          return (
            <li key={entity.id}>
              <button
                onClick={() => onSelect(entity.id)}
                className="w-full text-left px-5 py-4 rounded-lg border border-gray-200 bg-white hover:border-blue-500 hover:shadow-sm transition-all"
              >
                <div className="font-medium">{entity.label}</div>
                {description && (
                  <div className="text-sm text-gray-500 mt-1">{description}</div>
                )}
                {entity.note && (
                  <div className="text-xs text-amber-600 mt-1">⚠ {entity.note}</div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
