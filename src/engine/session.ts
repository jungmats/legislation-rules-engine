import type { Fact, FactMap, EvaluatedRule, ResolvedObligation, PossibleObligation, ComplianceResult } from './types';
import type { RegulationIndex } from './loader';
import { evaluateAllRules, collectObligations } from './evaluator';
import { nextQuestion, measurementFactsNeeded } from './scorer';
import { evaluateThreshold } from './threshold';

export type SessionStep =
  | 'regulation_pick'
  | 'role_select'
  | 'questioning'
  | 'assessment_intro'
  | 'assessment_questioning'
  | 'complete';

export interface SessionState {
  step: SessionStep;
  regulationSlug: string | null;
  selectedRole: string | null;
  factMap: FactMap;
  factHistory: string[];
  evaluatedRules: EvaluatedRule[];
  confirmed: ResolvedObligation[];
  possible: PossibleObligation[];
  currentQuestion: Fact | null;
  totalQuestionsAsked: number;
  /** Current measurement question during assessment phase */
  currentMeasurementQuestion: Fact | null;
  /** Compliance results, updated after each measurement fact is answered */
  complianceResults: ComplianceResult[];
  /** Fact ids answered during the assessment phase (for BACK support) */
  measurementHistory: string[];
}

export function initialState(): SessionState {
  return {
    step: 'regulation_pick',
    regulationSlug: null,
    selectedRole: null,
    factMap: new Map(),
    factHistory: [],
    evaluatedRules: [],
    confirmed: [],
    possible: [],
    currentQuestion: null,
    totalQuestionsAsked: 0,
    currentMeasurementQuestion: null,
    complianceResults: [],
    measurementHistory: [],
  };
}

export type SessionAction =
  | { type: 'SELECT_REGULATION'; slug: string }
  | { type: 'SELECT_ROLE'; roleId: string }
  | { type: 'ANSWER_FACT'; factId: string; value: unknown }
  | { type: 'SKIP_FACT'; factId: string }
  | { type: 'FINISH_EARLY' }
  | { type: 'BEGIN_ASSESSMENT' }
  | { type: 'ANSWER_MEASUREMENT_FACT'; factId: string; value: unknown }
  | { type: 'SKIP_MEASUREMENT_FACT'; factId: string }
  | { type: 'SKIP_ASSESSMENT' }
  | { type: 'BACK' }
  | { type: 'RESTART' };

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
  index: RegulationIndex | null,
): SessionState {
  switch (action.type) {
    case 'SELECT_REGULATION':
      return { ...initialState(), step: 'role_select', regulationSlug: action.slug };

    case 'SELECT_ROLE': {
      if (!index) return state;
      const factMap: FactMap = new Map([['entity_role', action.roleId]]);
      return advance({ ...state, step: 'questioning', selectedRole: action.roleId, factMap }, index);
    }

    case 'ANSWER_FACT': {
      if (!index) return state;
      const factMap = new Map(state.factMap);
      factMap.set(action.factId, action.value);
      return advance({
        ...state,
        factMap,
        factHistory: [...state.factHistory, action.factId],
        totalQuestionsAsked: state.totalQuestionsAsked + 1,
      }, index);
    }

    case 'SKIP_FACT': {
      if (!index) return state;
      const factMap = new Map(state.factMap);
      factMap.set(action.factId, null);
      return advance({
        ...state,
        factMap,
        factHistory: [...state.factHistory, action.factId],
        totalQuestionsAsked: state.totalQuestionsAsked + 1,
      }, index);
    }

    case 'FINISH_EARLY':
      return transitionToAssessmentOrComplete({ ...state }, index);

    case 'BEGIN_ASSESSMENT': {
      if (!index) return state;
      return advanceAssessment({ ...state, step: 'assessment_questioning' }, index);
    }

    case 'ANSWER_MEASUREMENT_FACT': {
      if (!index) return state;
      const factMap = new Map(state.factMap);
      factMap.set(action.factId, action.value);
      return advanceAssessment({
        ...state,
        factMap,
        measurementHistory: [...state.measurementHistory, action.factId],
      }, index);
    }

    case 'SKIP_MEASUREMENT_FACT': {
      if (!index) return state;
      const factMap = new Map(state.factMap);
      factMap.set(action.factId, null);
      return advanceAssessment({
        ...state,
        factMap,
        measurementHistory: [...state.measurementHistory, action.factId],
      }, index);
    }

    case 'SKIP_ASSESSMENT':
      return { ...state, step: 'complete' };

    case 'BACK': {
      if (state.step === 'role_select') {
        return initialState();
      }

      if (state.step === 'assessment_intro') {
        // Go back into the completed questionnaire view
        return { ...state, step: 'questioning' };
      }

      if (state.step === 'assessment_questioning' && index) {
        if (state.measurementHistory.length === 0) {
          return { ...state, step: 'assessment_intro' };
        }
        const measurementHistory = state.measurementHistory.slice(0, -1);
        const lastFactId = state.measurementHistory[state.measurementHistory.length - 1];
        const factMap = new Map(state.factMap);
        factMap.delete(lastFactId);
        return advanceAssessment({ ...state, factMap, measurementHistory }, index);
      }

      if ((state.step === 'questioning' || state.step === 'complete') && index) {
        if (state.factHistory.length === 0) {
          return { ...initialState(), step: 'role_select', regulationSlug: state.regulationSlug };
        }
        const factHistory = state.factHistory.slice(0, -1);
        const lastFactId = state.factHistory[state.factHistory.length - 1];
        const factMap = new Map(state.factMap);
        factMap.delete(lastFactId);
        return advance({
          ...state,
          step: 'questioning',
          factMap,
          factHistory,
          totalQuestionsAsked: state.totalQuestionsAsked - 1,
        }, index);
      }
      return state;
    }

    case 'RESTART':
      return initialState();

    default:
      return state;
  }
}

/** Re-evaluate rules and find next gating question after a fact change */
function advance(state: SessionState, index: RegulationIndex): SessionState {
  const evaluatedRules = evaluateAllRules(index.rules, state.factMap);
  const { confirmed, possible } = collectObligations(evaluatedRules, index);
  const currentQuestion = nextQuestion(index.facts, index.rules, state.factMap);

  if (currentQuestion) {
    return { ...state, step: 'questioning', evaluatedRules, confirmed, possible, currentQuestion };
  }

  // Gating questions exhausted — decide whether to enter assessment
  return transitionToAssessmentOrComplete(
    { ...state, evaluatedRules, confirmed, possible, currentQuestion: null },
    index,
  );
}

/** Decide whether to show the assessment intro or go straight to complete */
function transitionToAssessmentOrComplete(state: SessionState, index: RegulationIndex | null): SessionState {
  if (!index) return { ...state, step: 'complete' };
  const needed = measurementFactsNeeded(state.confirmed, state.factMap, index.facts);
  if (needed.length === 0) return { ...state, step: 'complete' };
  return { ...state, step: 'assessment_intro' };
}

/** Recompute compliance results and advance the measurement question queue */
function advanceAssessment(state: SessionState, index: RegulationIndex): SessionState {
  const needed = measurementFactsNeeded(state.confirmed, state.factMap, index.facts);

  // Recompute compliance for all confirmed threshold obligations
  const complianceResults: ComplianceResult[] = state.confirmed
    .filter((r) => r.obligation.threshold_type)
    .map((r) => ({
      obligationId: r.obligation.id,
      complianceStatus: evaluateThreshold(r.obligation, state.factMap),
    }));

  if (needed.length === 0) {
    return { ...state, step: 'complete', currentMeasurementQuestion: null, complianceResults };
  }

  return {
    ...state,
    step: 'assessment_questioning',
    currentMeasurementQuestion: needed[0],
    complianceResults,
  };
}
