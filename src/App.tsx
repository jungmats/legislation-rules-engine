import { useReducer, useEffect, useRef, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { initialState, sessionReducer } from './engine/session';
import type { SessionAction, SessionState } from './engine/session';
import type { RegulationIndex } from './engine/loader';
import { loadRegulation } from './engine/loader';
import RegulationPicker from './ui/steps/RegulationPicker';
import RoleSelector from './ui/steps/RoleSelector';
import Questionnaire from './ui/steps/Questionnaire';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [index, setIndex] = useState<RegulationIndex | null>(null);
  const indexRef = useRef<RegulationIndex | null>(null);
  indexRef.current = index;

  const [state, dispatch] = useReducer(
    (s: SessionState, a: SessionAction) => sessionReducer(s, a, indexRef.current),
    initialState(),
  );

  // Bootstrap session when loading a regulation URL directly
  useEffect(() => {
    const slug = location.pathname.replace(/^\//, '').split('/')[0];
    if (slug) {
      dispatch({ type: 'SELECT_REGULATION', slug });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.regulationSlug) {
      loadRegulation(state.regulationSlug)
        .then(setIndex)
        .catch(() => navigate('/'));
    }
  }, [state.regulationSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate home when session resets to regulation_pick
  useEffect(() => {
    if (state.step === 'regulation_pick' && location.pathname !== '/') {
      navigate('/');
    }
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectRegulation = (slug: string) => {
    dispatch({ type: 'SELECT_REGULATION', slug });
    navigate(`/${slug}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">
            Legislation Rules Engine
          </h1>
          {(state.step === 'questioning' ||
            state.step === 'assessment_intro' ||
            state.step === 'assessment_questioning' ||
            state.step === 'complete') && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => dispatch({ type: 'BACK' })}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                ← Back
              </button>
              <button
                onClick={() => dispatch({ type: 'SELECT_REGULATION', slug: state.regulationSlug! })}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Start over
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={
            <RegulationPicker onSelect={handleSelectRegulation} />
          } />
          <Route path="/:slug" element={
            <>
              {state.step === 'regulation_pick' && (
                <p className="text-gray-500">Loading regulation…</p>
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
              {(state.step === 'questioning' ||
                state.step === 'assessment_intro' ||
                state.step === 'assessment_questioning' ||
                state.step === 'complete') && index && (
                <Questionnaire state={state} index={index} dispatch={dispatch} />
              )}
            </>
          } />
        </Routes>
      </main>
    </div>
  );
}
