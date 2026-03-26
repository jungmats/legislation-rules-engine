import type { SessionState, SessionAction } from '../../engine/session';
import type { RegulationIndex } from '../../engine/loader';
import { computeGatingScores } from '../../engine/scorer';
import FactQuestion from '../components/FactQuestion';
import ObligationPanel from '../panels/ObligationPanel';
import ActionPanel from '../panels/ActionPanel';
import WarningsPanel from '../panels/WarningsPanel';
import { useState } from 'react';

interface Props {
  state: SessionState;
  index: RegulationIndex;
  dispatch: (action: SessionAction) => void;
}

const TABS = ['Obligations', 'Actions', 'Warnings'] as const;
type Tab = typeof TABS[number];

export default function Questionnaire({ state, index, dispatch }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Obligations');

  const ruledOutCount = state.evaluatedRules.filter((r) => r.state === 'ruled_out').length;
  const scores = computeGatingScores(index.facts, index.rules, state.factMap);
  const totalRelevant = Array.from(scores.values()).filter((s) => s > 0).length + state.totalQuestionsAsked;

  // Compute "why is this fact being asked" from which obligations it gates
  function whyAsked(factId: string): string {
    const gatedRules = index.rules.filter(
      (r) => r.conditions.some((c) => c.fact_id === factId)
    );
    if (gatedRules.length === 0) return 'Determines regulatory applicability.';
    const obligationCount = new Set(gatedRules.flatMap((r) => r.obligations.map((o) => o.obligation_id))).size;
    return `Determines whether ${obligationCount} obligation${obligationCount !== 1 ? 's' : ''} apply (${gatedRules.map((r) => r.source_article).join(', ')}).`;
  }

  return (
    <div className="flex gap-8">
      {/* Left: question */}
      <div className="flex-1 min-w-0">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, (state.totalQuestionsAsked / Math.max(1, totalRelevant)) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 shrink-0">
            {state.totalQuestionsAsked} answered
          </span>
        </div>

        {state.step === 'questioning' && state.currentQuestion ? (
          <>
            <FactQuestion
              fact={state.currentQuestion}
              questionNumber={state.totalQuestionsAsked + 1}
              whyAsked={whyAsked(state.currentQuestion.id)}
              onAnswer={(value) => dispatch({ type: 'ANSWER_FACT', factId: state.currentQuestion!.id, value })}
              onSkip={() => dispatch({ type: 'SKIP_FACT', factId: state.currentQuestion!.id })}
            />
            <button
              onClick={() => dispatch({ type: 'FINISH_EARLY' })}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline"
            >
              Stop here and see results
            </button>
          </>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-green-700 mb-1">Questionnaire complete</h3>
            <p className="text-sm text-gray-500">
              All relevant questions have been answered. Review your obligations on the right.
            </p>
          </div>
        )}
      </div>

      {/* Right: live results */}
      <div className="w-80 shrink-0">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-xs font-medium py-3 transition-colors
                  ${activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'}`}
              >
                {tab}
                {tab === 'Obligations' && state.confirmed.length > 0 && (
                  <span className="ml-1 text-green-600">({state.confirmed.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4">
            {activeTab === 'Obligations' && (
              <ObligationPanel
                confirmed={state.confirmed}
                possible={state.possible}
                ruledOutCount={ruledOutCount}
                index={index}
                factMap={state.factMap}
              />
            )}
            {activeTab === 'Actions' && (
              <ActionPanel
                confirmed={state.confirmed}
                index={index}
                factMap={state.factMap}
              />
            )}
            {activeTab === 'Warnings' && (
              <WarningsPanel index={index} factMap={state.factMap} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
