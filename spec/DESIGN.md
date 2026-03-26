# Legislation Rules Engine — Design Document

## Goal

A browser-based tool to explore the structured output of the `legislation-to-rules` skill. Given a set of regulation JSON files, the engine collects facts from the user through an adaptive questionnaire and produces a real-time view of confirmed obligations, possible obligations, required actions, and deadlines.

**v1 scope**: local exploration tool for one regulation, one role per session. Publishable as a static demo with no backend.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| UI | React + TypeScript | Component model fits session state + adaptive UI; TypeScript catches schema mismatches early |
| Build | Vite | Fast local dev; static build deployable to GitHub Pages / Vercel |
| Styling | Tailwind CSS | Utility-first, no design system overhead for a tool UI |
| State | React `useState` / `useReducer` | No external state library needed at v1 scale |
| Backend | None | Static app; data loaded from bundled JSON or file picker |

**Deployment**: `vite build` → static files → GitHub Pages or Vercel. No server required until embedded in a product.

---

## Data Loading

Regulations are bundled at build time. JSON directories from the `legislation-to-rules` skill output are committed to the repo under `src/data/{regulation-slug}/`. The UI lists available regulations at startup.

Adding a new regulation = copy the 13 JSON files into `src/data/{slug}/` and rebuild.

v1 ships with at least one bundled regulation (EU AI Act).

---

## Architecture

```
src/
  engine/             # Pure TypeScript — no React dependency
    types.ts          # TypeScript interfaces mirroring the JSON schema
    loader.ts         # Load and index the 13 JSON files into a RegulationIndex
    scorer.ts         # Compute gating scores per fact
    evaluator.ts      # Three-state rule evaluation against a FactMap
    deadlines.ts      # Compute deadline dates from DeadlinePolicy + FactMap
    session.ts        # Session state machine (see below)

  ui/
    App.tsx
    steps/
      RegulationPicker.tsx   # Select regulation from bundled list
      RoleSelector.tsx       # Select entity role for this session
      Questionnaire.tsx      # Sequential question + live results
    panels/
      ObligationPanel.tsx    # Confirmed / possible / ruled-out obligations
      ActionPanel.tsx        # Actions with computed deadlines
      WarningsPanel.tsx      # Interaction provisions + role-change warnings
    components/
      FactQuestion.tsx       # Renders a single question based on fact type
      DeadlineBadge.tsx      # Displays a deadline (computed or pending)

  data/
    eu-ai-act-2024-1689/     # Bundled regulation JSON files
    decret-tertiaire-2019-771/
```

---

## Engine: Core Algorithms

### 1. RegulationIndex

On load, the engine indexes the 13 JSON files into a lookup structure:

```typescript
interface RegulationIndex {
  regulation: Regulation;
  facts: Map<string, Fact>;               // fact_id → Fact
  obligations: Map<string, Obligation>;   // obligation_id → Obligation
  rules: Rule[];
  deadlinePolicies: Map<string, DeadlinePolicy>;
  exemptions: Exemption[];
  actionTemplates: ActionTemplate[];
  complianceEvidence: Map<string, ComplianceEvidence>;
  interactionProvisions: InteractionProvision[];
  roleChangeWarnings: RoleChangeWarning[];
}
```

### 2. Gating Score

For each fact, computed once after role selection:

```
score(fact) = number of rules (filtered to selected role) that contain fact_id in their conditions
```

Facts with score 0 for the selected role are never asked. Role is pre-answered and excluded from the queue.

After each answer, rules transition state (see §3) and the score is recomputed over still-possible rules only. This ensures questions about ruled-out branches are dropped immediately.

### 3. Three-State Rule Evaluation

Each rule is evaluated against the current `FactMap` (answered facts only):

- **Confirmed**: all conditions are met by answered facts
- **Ruled out**: at least one condition is definitively not met by an answered fact
- **Possible**: no condition is definitively not met, but at least one condition references an unanswered fact

```typescript
type RuleState = 'confirmed' | 'possible' | 'ruled_out';

function evaluateRule(rule: Rule, facts: FactMap): RuleState {
  let hasUnknown = false;
  for (const condition of rule.conditions) {
    const value = facts.get(condition.fact_id);
    if (value === undefined) { hasUnknown = true; continue; }
    if (!conditionMet(condition, value)) return 'ruled_out';
  }
  return hasUnknown ? 'possible' : 'confirmed';
}
```

### 4. Obligation Aggregation

From confirmed and possible rules, collect obligations:

- **Confirmed obligations**: obligations from all confirmed rules (deduplicated by obligation_id)
- **Possible obligations**: obligations from possible rules that are not already confirmed, grouped by the conditions that would confirm them
- Obligations appearing in both confirmed and possible rules are shown only as confirmed

### 5. Exemption Handling

v1 displays relevant exemptions as advisory information only — no application, no automatic waiving of obligations.

When a confirmed obligation has applicable exemptions (from `rules[].applicable_exemptions`), they are shown inline as a note:

```
⚠ Exemption may apply: Art. 6(3) — Annex III system not high-risk
  Conditions: [listed]
  Effect if applicable: waives this obligation
  → Seek legal advice to determine applicability
```

Applying exemptions (and the obligation updates that follow) is post-v1.

### 6. Deadline Computation

For each confirmed obligation, compute its deadline from the associated `DeadlinePolicy`:

- `anchor_type: "fixed_date"` → display the date directly
- `anchor_type: "fact_relative"` → look up the anchor fact in FactMap:
  - If answered: compute `anchor_date + offset_months`
  - If unanswered: display `"deadline requires: [fact label]"` as a prompt

### 7. Next Question Selection

```
next_question = highest-scoring unanswered fact
                among facts that appear in at least one possible rule
```

If no possible rules remain (all rules are confirmed or ruled out), the questionnaire ends. The user can stop at any point and see results on confirmed obligations only.

---

## Session State Machine

```
REGULATION_PICK
  → ROLE_SELECT
    → QUESTIONING  ←──────────────────┐
        ↓ answer recorded              │
        evaluate rules                 │
        recompute scores               │
        if possible rules remain ──────┘
        if no possible rules remain
        ↓
      COMPLETE

At any point from QUESTIONING or COMPLETE:
  → user can view partial/full results
  → user can apply/remove exemptions
  → user can restart session
```

Session state is held in React state (no persistence in v1). A "restart" clears the FactMap and resets to ROLE_SELECT.

---

## UI: Questionnaire Screen Layout

```
┌─────────────────────────────────────────────────────────┐
│  EU AI Act  ·  Role: Provider  ·  Question 4 of ~9      │
├───────────────────────────┬─────────────────────────────┤
│                           │  ✅ Confirmed (14)           │
│  Does your AI system      │  ob_risk_management_system  │
│  directly interact        │  ob_technical_documentation │
│  with users?              │  ...                        │
│                           ├─────────────────────────────┤
│  ○ Yes                    │  ⏳ Possible (1)             │
│  ○ No                     │  If yes → ob_disclose_ai    │
│                           ├─────────────────────────────┤
│  Why this question:       │  ❌ Ruled out (5)            │
│  Determines whether       │  All GPAI obligations       │
│  Art. 50(1) disclosure    │  (is_gpai_model = false)    │
│  obligation applies.      │                             │
│                           ├─────────────────────────────┤
│  [Skip]  [→ Answer]       │  ⚠ Warnings (0)             │
└───────────────────────────┴─────────────────────────────┘
```

Key UX decisions:
- Live results update as each question is answered — no "submit at end"
- Each question explains why it is being asked (which obligations it gates)
- "Skip" leaves the fact unanswered; the obligation stays in "Possible"
- User can stop at any time — confirmed obligations are immediately actionable

---

## Output: Results Screen

After questionnaire completion (or early stop):

### Confirmed Obligations
For each: label, source article, deadline (computed or pending), link to action templates.

### Possible Obligations
For each: label, the specific unanswered condition that would confirm it, a "Go back and answer" link.

### Required Actions
Action templates for confirmed obligations, in prerequisite order, with the evidence each action produces.

### Deadlines Timeline
Chronological list of all computed deadlines. Fact-relative deadlines pending a fact value are listed separately with the required fact highlighted.

### Warnings
Interaction provisions and role-change warnings relevant to the selected role, shown as an advisory section with source article references.

---

## Out of Scope for v1

- **Exemption application**: displayed as advisory only; applying exemptions and updating the obligation list is post-v1
- **Session persistence**: no save/restore; restart clears the session
- **Multi-regulation**: comparing obligations across regulations is post-v1
- **Sharing / export**: PDF export or shareable link is post-v1
- **Product embedding**: when embedded in a server-rendered app, the engine (pure TypeScript) can run server-side unchanged — the React UI is replaced by the product's own UI layer
