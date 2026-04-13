import type { SessionState, SessionAction } from '../../engine/session';
import type { RegulationIndex } from '../../engine/loader';
import { computeGatingScores, measurementFactsNeeded } from '../../engine/scorer';
import FactQuestion from '../components/FactQuestion';
import ObligationPanel from '../panels/ObligationPanel';
import ActionPanel from '../panels/ActionPanel';
import WarningsPanel from '../panels/WarningsPanel';
import PenaltiesPanel from '../panels/PenaltiesPanel';
import CompliancePanel from '../panels/CompliancePanel';
import type { ComplianceStatus } from '../../engine/threshold';
import { useState, FormEvent, useEffect } from 'react';

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

const TABS = ['Obligations', 'Actions', 'Penalties', 'Warnings', 'Compliance'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  Obligations: 'Oblig.',
  Actions:     'Actions',
  Penalties:   'Fines',
  Warnings:    'Warnings',
  Compliance:  'Compliance',
};

function complianceBadge(status: ComplianceStatus['status']): string | null {
  switch (status) {
    case 'violation': return '❌';
    case 'risk':      return '⚠️';
    case 'compliant': return '✅';
    default:          return null;
  }
}

export default function Questionnaire({ state, index, dispatch }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Obligations');

  const assessmentStarted =
    state.step === 'assessment_questioning' ||
    state.step === 'complete' && state.complianceResults.length > 0;

  // Auto-switch to Compliance tab when assessment begins
  useEffect(() => {
    if (state.step === 'assessment_questioning') {
      setActiveTab('Compliance');
    }
  }, [state.step]);

  const ruledOutCount = state.evaluatedRules.filter((r) => r.state === 'ruled_out').length;
  const scores = computeGatingScores(index.facts, index.rules, state.factMap);
  const totalRelevant = Array.from(scores.values()).filter((s) => s > 0).length + state.totalQuestionsAsked;

  // Count total measurement facts for progress indicator
  const totalMeasurement = measurementFactsNeeded(state.confirmed, new Map(), index.facts).length;
  const answeredMeasurement = state.measurementHistory.length;

  function whyAsked(factId: string): string {
    const gatedRules = index.rules.filter(
      (r) => r.conditions.some((c) => c.fact_id === factId)
    );
    if (gatedRules.length === 0) return 'Determines regulatory applicability.';
    const obligationCount = new Set(gatedRules.flatMap((r) => r.obligations.map((o) => o.obligation_id))).size;
    return `Determines whether ${obligationCount} obligation${obligationCount !== 1 ? 's' : ''} apply (${gatedRules.map((r) => r.source_article).join(', ')}).`;
  }

  function whyMeasured(factId: string): string {
    const ob = state.confirmed.find(
      (r) =>
        r.obligation.measured_fact === factId ||
        r.obligation.baseline_fact === factId ||
        r.obligation.threshold_fact === factId,
    );
    if (!ob) return 'Required to evaluate compliance.';
    return `Needed to assess: "${ob.obligation.label}"`;
  }

  // Compute per-obligation compliance badge for ObligationPanel
  const complianceBadges = new Map<string, string>();
  for (const result of state.complianceResults) {
    const cs = result.complianceStatus as ComplianceStatus;
    const badge = complianceBadge(cs.status);
    if (badge) complianceBadges.set(result.obligationId, badge);
  }

  const measurableCount = state.confirmed.filter((r) => r.obligation.threshold_type).length;

  return (
    <div className="flex gap-6">
      {/* Left: question / status */}
      <div className="flex-1 min-w-0">

        {/* ── Gating questionnaire ── */}
        {state.step === 'questioning' && (
          <>
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

            {state.currentQuestion ? (
              <>
                <FactQuestion
                  key={state.currentQuestion.id}
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
            ) : null}
          </>
        )}

        {/* ── Assessment intro ── */}
        {state.step === 'assessment_intro' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-blue-700 mb-1">Your obligations are confirmed</h3>
            <p className="text-sm text-gray-500 mb-4">
              You have {state.confirmed.length} confirmed obligation{state.confirmed.length !== 1 ? 's' : ''}.
              {measurableCount > 0 && (
                <> {measurableCount} of them {measurableCount === 1 ? 'has' : 'have'} measurable targets —
                we can check whether you are currently meeting {measurableCount === 1 ? 'it' : 'them'}.</>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => dispatch({ type: 'BEGIN_ASSESSMENT' })}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Assess compliance
              </button>
              <button
                onClick={() => dispatch({ type: 'SKIP_ASSESSMENT' })}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:border-gray-400 transition-colors"
              >
                Skip — show my results
              </button>
            </div>
          </div>
        )}

        {/* ── Assessment questioning ── */}
        {state.step === 'assessment_questioning' && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (answeredMeasurement / Math.max(1, totalMeasurement)) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                Assessing {answeredMeasurement + 1} of {totalMeasurement}
              </span>
            </div>

            {state.currentMeasurementQuestion && (
              <>
                {/* Which obligation this belongs to */}
                {(() => {
                  const ob = state.confirmed.find(
                    (r) =>
                      r.obligation.measured_fact === state.currentMeasurementQuestion!.id ||
                      r.obligation.baseline_fact === state.currentMeasurementQuestion!.id ||
                      r.obligation.threshold_fact === state.currentMeasurementQuestion!.id,
                  );
                  return ob ? (
                    <div className="mb-3 text-xs text-blue-600 font-medium uppercase tracking-wide">
                      Assessing: {ob.obligation.label}
                    </div>
                  ) : null;
                })()}

                <FactQuestion
                  key={state.currentMeasurementQuestion.id}
                  fact={state.currentMeasurementQuestion}
                  questionNumber={answeredMeasurement + 1}
                  whyAsked={whyMeasured(state.currentMeasurementQuestion.id)}
                  onAnswer={(value) => dispatch({ type: 'ANSWER_MEASUREMENT_FACT', factId: state.currentMeasurementQuestion!.id, value })}
                  onSkip={() => dispatch({ type: 'SKIP_MEASUREMENT_FACT', factId: state.currentMeasurementQuestion!.id })}
                />
                <button
                  onClick={() => dispatch({ type: 'SKIP_ASSESSMENT' })}
                  className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline"
                >
                  Stop, show my results
                </button>
              </>
            )}
          </>
        )}

        {/* ── Complete ── */}
        {state.step === 'complete' && (
          <>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-green-700 mb-1">
                {state.complianceResults.length > 0 ? 'Assessment complete' : 'Questionnaire complete'}
              </h3>
              <p className="text-sm text-gray-500">
                {state.complianceResults.length > 0
                  ? 'Review your compliance status in the Compliance tab on the right.'
                  : 'All relevant questions have been answered. Review your obligations on the right.'}
              </p>
            </div>
            <FeedbackForm />
          </>
        )}
      </div>

      {/* Right: live results */}
      <div className="w-[26rem] shrink-0">
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
                {TAB_LABELS[tab]}
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
                complianceBadges={complianceBadges}
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
            {activeTab === 'Compliance' && (
              <CompliancePanel
                complianceResults={state.complianceResults}
                confirmed={state.confirmed}
                index={index}
                factMap={state.factMap}
                assessmentStarted={assessmentStarted}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
