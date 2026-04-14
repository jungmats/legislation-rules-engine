# Plan: Compliance Assessment Step

**Goal**: After the questionnaire confirms which obligations apply, collect the measurement facts needed to evaluate whether the user is actually meeting each obligation, and surface violation/risk status.

**Context**: The engine currently asks only facts that appear in rule *conditions* (gating facts — "does this regulation apply?"). Facts referenced in obligation fields (`measured_fact`, `baseline_fact`, `threshold_fact`) have zero gating score and are never asked. This plan closes that gap with a second, post-confirmation step.

---

## Background: key concepts

- **Gating facts** — appear in `rules.json` conditions; determine which obligations apply
- **Measurement facts** — appear in `obligations.json` as `measured_fact` / `baseline_fact` / `threshold_fact`; needed to evaluate compliance against a threshold
- **Violation** — `measured_fact` value exceeds the obligation threshold
- **Risk** — `measured_fact` value is within a configurable proximity of the threshold (e.g. within 10%)
- **Threshold calculation**:
  - `relative`: `threshold = baseline_fact_value × (1 - reduction_pct / 100)`; violation if `measured > threshold`
  - `absolute` with `threshold_fact`: violation if `measured > threshold_fact_value`
  - `absolute` with `max_value`: violation if `measured > max_value`

---

## Files to create / modify

### New file: `src/engine/threshold.ts`

Exports one function:

```ts
type ComplianceStatus =
  | { status: 'compliant'; delta: number; unit?: string }
  | { status: 'risk';      delta: number; unit?: string; proximityPct: number }
  | { status: 'violation'; delta: number; unit?: string }
  | { status: 'pending';   missingFacts: string[] }
  | { status: 'not_applicable' }   // obligation has no threshold_type

function evaluateThreshold(
  obligation: Obligation,
  factMap: FactMap,
  riskProximityPct?: number   // default 10
): ComplianceStatus
```

Logic:
1. If `threshold_type` is null/absent → return `not_applicable`
2. Collect required facts; if any missing → return `pending` with `missingFacts` list
3. Compute threshold:
   - relative: `threshold = baseline × (1 - reduction_pct / 100)`
   - absolute/threshold_fact: `threshold = factMap.get(threshold_fact)`
   - absolute/max_value: `threshold = max_value`
4. `delta = measured - threshold`
   - `delta > 0` → violation
   - `0 >= delta > -(threshold × riskProximityPct/100)` → risk
   - otherwise → compliant

### Modified: `src/engine/types.ts`

Add to the session state (after `complete` phase):

```ts
type SessionPhase = 'regulation_pick' | 'role_select' | 'questioning' | 'assessment' | 'complete'

interface ComplianceResult {
  obligationId: string
  status: ComplianceStatus
}
```

Add `complianceResults: ComplianceResult[]` to session state.

### Modified: `src/engine/scorer.ts`

Add a new function `measurementFactsNeeded(confirmedObligations, factMap, index)` that returns the ordered list of measurement facts for confirmed obligations that haven't been answered yet.

**Ordering**: no gating-score mechanism applies here — measurement facts don't appear in any rule condition, so there is no branching to optimise. Instead, group by confirmed obligation in confirmation order. Within each obligation, always ask `baseline_fact` before `measured_fact` (the baseline is needed to compute the threshold, so it should be collected first). `threshold_fact` is asked only if it has no value yet. Every measurement fact for every confirmed threshold obligation is collected — no filtering by impact.

### Modified: `src/engine/session.ts`

**New phase `'assessment'`** inserted between `'questioning'` and `'complete'`.

Entry condition: questioning phase completes AND at least one confirmed obligation has `threshold_type` set. If no confirmed obligations have a threshold, skip straight to `'complete'` as today — no behaviour change for regulations like NIS2 or EU AI Act where obligations are procedural.

- Uses `measurementFactsNeeded()` from scorer.ts to find the next question
- On each answer, calls `evaluateThreshold()` for all confirmed threshold obligations and stores results in `complianceResults[]`
- Advances to `'complete'` when `measurementFactsNeeded()` returns an empty list, or on `SKIP_ASSESSMENT`

New actions: `ANSWER_MEASUREMENT_FACT`, `SKIP_ASSESSMENT`

**Transition interstitial**: when the session first enters `'assessment'` phase, `state.step` becomes `'assessment_intro'` before the first question. The UI uses this to render the transition screen (see UX below). On `BEGIN_ASSESSMENT` action it advances to `'assessment_questioning'`. `SKIP_ASSESSMENT` from the intro goes directly to `'complete'`.

### UX: left panel states

**`assessment_intro`** — transition screen shown once before any measurement questions:
```
Your obligations are confirmed
You have N confirmed obligations. M of them have measurable targets —
we can check whether you're currently meeting them.

[Assess compliance]   [Skip — show my results]
```
"Skip — show my results" dispatches `SKIP_ASSESSMENT` → lands on the existing complete view with feedback form and result tabs, same as "Stop here and see results" today.

**`assessment_questioning`** — one question at a time, reusing `FactQuestion` unchanged. Each question shows which obligation it belongs to above the input:

```
Assessing: "Reduce energy by 40% vs reference year by 2030"

What was your reference year energy consumption?
[number input]   kWh/year

Source: OPERAT platform — annual declaration   ← from facts.json source field
```

Per-question escape: a small "Skip this obligation" link skips remaining measurement facts for that obligation only (marks them as skipped, moves to next obligation). A "Stop, show my results" link dispatches `SKIP_ASSESSMENT`.

**`complete`** (unchanged) — "Questionnaire complete" card + `FeedbackForm` below it, exactly as today. The feedback form placement does not change.

The existing progress bar in the left panel covers the gating phase. During assessment, replace it with a separate indicator: "Assessing obligation 1 of M".

### UX: right sidebar during assessment

The right sidebar (the existing `w-80` panel) continues to show the four tabs throughout. The **Obligations tab** gains a small compliance badge next to each confirmed obligation's `DeadlineBadge`:

- ✅ compliant
- ⚠️ risk  
- ❌ violation
- ⏳ (no badge — pending, still being assessed)

This badge is the only change to `ObligationPanel` — a single icon, no numbers. Space is not an issue.

A new **Compliance tab** is added (fifth tab). It is visible from the moment the assessment phase begins and updates live as each measurement fact is answered. When assessment has not started yet (or was skipped), the tab shows: *"Complete the compliance assessment to see results here."*

### New panel: `src/ui/panels/CompliancePanel.tsx`

One entry per confirmed obligation that has `threshold_type`. Layout per entry:

```
❌  Reduce energy by 40% vs reference year by 2030
    Measured:   350,000 kWh    Target: ≤ 300,000 kWh
    Overshoot:  +50,000 kWh (+17%)       Deadline: 31 Dec 2030
    → Reduce consumption by 50,000 kWh to meet this target

⚠️  Reduce energy by 50% vs reference year by 2040
    Measured:   350,000 kWh    Target: ≤ 250,000 kWh
    Headroom:   −100,000 kWh — on track, monitor pace

⏳  Meet absolute kWh/m²/year threshold by 2030
    Missing: absolute target value (pending ministerial decree)
```

Status colours: ❌ red, ⚠️ amber, ✅ green, ⏳ grey.

Obligations with no `threshold_type` are not shown in this panel — they belong in the Obligations tab only.

### Modified: `src/ui/steps/Questionnaire.tsx`

- Add `'Compliance'` to the `TABS` constant
- Render `CompliancePanel` when active tab is `'Compliance'`
- Render assessment phase UI in the left panel based on `state.step` value (`assessment_intro` / `assessment_questioning`)
- Auto-switch the active tab to `'Compliance'` when the assessment phase begins (so the user sees results appear live without having to find the tab manually)

---

## Implementation order

1. `threshold.ts` — pure function, no dependencies, easiest to test in isolation
2. `types.ts` additions — phase enum, ComplianceResult interface
3. `scorer.ts` — `measurementFactsNeeded()` 
4. `session.ts` — assessment phase, new actions
5. `CompliancePanel.tsx` — display component
6. `Questionnaire.tsx` — wire assessment phase + new tab

---

## Risk proximity configuration

The `riskProximityPct` (default 10%) is not stored in the JSON schema — it's a UI/engine concern. Start with a hardcoded default of 10%. A future improvement could add `risk_proximity_pct` as an optional field on obligations in the schema for cases where the legislation itself specifies a warning threshold.

---

## Alternative obligation handling

When `alternative_obligation_id` is set (e.g. décret tertiaire relative vs absolute), a true violation only exists if *both* alternatives are violated. The compliance panel should group alternatives and show:
- ✅ if either alternative is compliant
- ⚠️ risk if both are in risk range
- ❌ violation only if both are violated
