import type { SessionState, SessionAction } from '../../engine/session';
import type { RegulationIndex } from '../../engine/loader';
import { computeGatingScores } from '../../engine/scorer';
import FactQuestion from '../components/FactQuestion';
import ObligationPanel from '../panels/ObligationPanel';
import ActionPanel from '../panels/ActionPanel';
import WarningsPanel from '../panels/WarningsPanel';
import PenaltiesPanel from '../panels/PenaltiesPanel';
import { useState, FormEvent } from 'react';

function FeedbackForm() {
  const [useful, setUseful] = useState<'yes' | 'no' | null>(null);
  const [why, setWhy] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch('https://formspree.io/f/xgonzwrp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ useful, why, email }),
    });
    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mt-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6">
        <p className="text-sm text-green-700 font-medium">Thank you — your feedback means a lot.</p>
      </div>
    );
  }

  return (
    <>
    <div className="mt-8 flex items-center gap-3">
      <div className="flex-1 border-t border-gray-200" />
      <span className="text-xs text-gray-400 uppercase tracking-wide shrink-0">Before you go</span>
      <div className="flex-1 border-t border-gray-200" />
    </div>

    <form onSubmit={handleSubmit} className="mt-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 space-y-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Research feedback</p>
      <p className="text-sm text-gray-600">
        This is an experiment to find out if determining compliance obligations can be simplified
        and automated. Your feedback is invaluable.
      </p>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Was this useful?</p>
        <div className="flex gap-2">
          {(['yes', 'no'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setUseful(v)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                ${useful === v
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}
            >
              {v === 'yes' ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Why / why not?
        </label>
        <input
          type="text"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Tell us more…"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || useful === null}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
      >
        {submitting ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
    </>
  );
}

interface Props {
  state: SessionState;
  index: RegulationIndex;
  dispatch: (action: SessionAction) => void;
}

const TABS = ['Obligations', 'Actions', 'Penalties', 'Warnings'] as const;
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
          <>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-green-700 mb-1">Questionnaire complete</h3>
              <p className="text-sm text-gray-500">
                All relevant questions have been answered. Review your obligations on the right.
              </p>
            </div>
            <FeedbackForm />
          </>
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
                selectedRole={state.selectedRole}
              />
            )}
            {activeTab === 'Penalties' && (
              <PenaltiesPanel index={index} />
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
