import { useReducer, useEffect, useRef, useState } from 'react';
import { initialState, sessionReducer } from './engine/session';
import type { SessionAction, SessionState } from './engine/session';
import type { RegulationIndex } from './engine/loader';
import { loadRegulation } from './engine/loader';
import RegulationPicker from './ui/steps/RegulationPicker';
import RoleSelector from './ui/steps/RoleSelector';
import Questionnaire from './ui/steps/Questionnaire';

export default function App() {
  const [index, setIndex] = useState<RegulationIndex | null>(null);
  const indexRef = useRef<RegulationIndex | null>(null);
  indexRef.current = index;

  const [state, dispatch] = useReducer(
    (s: SessionState, a: SessionAction) => sessionReducer(s, a, indexRef.current),
    initialState(),
  );

  useEffect(() => {
    if (state.regulationSlug) {
      loadRegulation(state.regulationSlug).then(setIndex);
    }
  }, [state.regulationSlug]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">
            Legislation Rules Engine
          </h1>
          {state.step !== 'regulation_pick' && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => dispatch({ type: 'BACK' })}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                ← Back
              </button>
              <button
                onClick={() => dispatch({ type: 'RESTART' })}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Start over
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {state.step === 'regulation_pick' && (
          <RegulationPicker onSelect={(slug) => dispatch({ type: 'SELECT_REGULATION', slug })} />
        )}
        {state.step === 'role_select' && (
          index
            ? <RoleSelector
                entities={index.entities}
                entityRoleFact={index.facts.get('entity_role')}
                onSelect={(roleId) => dispatch({ type: 'SELECT_ROLE', roleId })}
              />
            : <p className="text-gray-500">Loading regulation…</p>
        )}
        {(state.step === 'questioning' || state.step === 'complete') && index && (
          <Questionnaire state={state} index={index} dispatch={dispatch} />
        )}
      </main>
    </div>
  );
}
