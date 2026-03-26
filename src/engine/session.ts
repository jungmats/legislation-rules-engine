import type { Fact, FactMap, EvaluatedRule, ResolvedObligation, PossibleObligation } from './types';
import type { RegulationIndex } from './loader';
import { evaluateAllRules, collectObligations } from './evaluator';
import { nextQuestion } from './scorer';

export type SessionStep =
  | 'regulation_pick'
  | 'role_select'
  | 'questioning'
  | 'complete';

export interface SessionState {
  step: SessionStep;
  regulationSlug: string | null;
  selectedRole: string | null;         // entity id from entities.json
  factMap: FactMap;
  evaluatedRules: EvaluatedRule[];
  confirmed: ResolvedObligation[];
  possible: PossibleObligation[];
  currentQuestion: Fact | null;
  totalQuestionsAsked: number;
}

export function initialState(): SessionState {
  return {
    step: 'regulation_pick',
    regulationSlug: null,
    selectedRole: null,
    factMap: new Map(),
    evaluatedRules: [],
    confirmed: [],
    possible: [],
    currentQuestion: null,
    totalQuestionsAsked: 0,
  };
}

export type SessionAction =
  | { type: 'SELECT_REGULATION'; slug: string }
  | { type: 'SELECT_ROLE'; roleId: string }
  | { type: 'ANSWER_FACT'; factId: string; value: unknown }
  | { type: 'SKIP_FACT'; factId: string }
  | { type: 'FINISH_EARLY' }
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
      // Pre-answer the entity_role fact
      const factMap: FactMap = new Map([['entity_role', action.roleId]]);
      return advance({ ...state, step: 'questioning', selectedRole: action.roleId, factMap }, index);
    }

    case 'ANSWER_FACT': {
      if (!index) return state;
      const factMap = new Map(state.factMap);
      factMap.set(action.factId, action.value);
      return advance({ ...state, factMap, totalQuestionsAsked: state.totalQuestionsAsked + 1 }, index);
    }

    case 'SKIP_FACT': {
      if (!index) return state;
      const factMap = new Map(state.factMap);
      factMap.set(action.factId, null); // null = skipped
      return advance({ ...state, factMap, totalQuestionsAsked: state.totalQuestionsAsked + 1 }, index);
    }

    case 'FINISH_EARLY':
      return { ...state, step: 'complete' };

    case 'BACK':
      if (state.step === 'role_select' || state.step === 'questioning' || state.step === 'complete') {
        // questioning/complete → role_select: clear fact answers but keep slug
        if (state.step === 'questioning' || state.step === 'complete') {
          return {
            ...initialState(),
            step: 'role_select',
            regulationSlug: state.regulationSlug,
          };
        }
        // role_select → regulation_pick
        return initialState();
      }
      return state;

    case 'RESTART':
      return initialState();

    default:
      return state;
  }
}

/** Re-evaluate rules and find next question after a fact change */
function advance(state: SessionState, index: RegulationIndex): SessionState {
  const evaluatedRules = evaluateAllRules(index.rules, state.factMap);
  const { confirmed, possible } = collectObligations(evaluatedRules, index);
  const currentQuestion = nextQuestion(index.facts, index.rules, state.factMap);
  const step = currentQuestion ? 'questioning' : 'complete';

  return { ...state, step, evaluatedRules, confirmed, possible, currentQuestion };
}
