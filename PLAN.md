# Implementation Plan

Status legend: `[ ]` todo · `[x]` done · `[-]` skipped

---

## Phase 1 — Project Setup

- [x] 1.1 Initialize Vite + React + TypeScript project
- [x] 1.2 Add Tailwind CSS
- [x] 1.3 Create `src/engine/`, `src/ui/`, `src/data/` directory structure
- [x] 1.4 Copy EU AI Act JSON files into `src/data/eu-ai-act-2024-1689/`

## Phase 2 — Engine (pure TypeScript)

- [ ] 2.1 `types.ts` — interfaces for all 13 JSON file types
- [ ] 2.2 `loader.ts` — load and index JSON files into `RegulationIndex`
- [ ] 2.3 `scorer.ts` — gating score computation, dynamic recomputation after each answer
- [ ] 2.4 `evaluator.ts` — three-state rule evaluation (confirmed / possible / ruled_out)
- [ ] 2.5 `deadlines.ts` — fixed and fact-relative deadline computation
- [ ] 2.6 `session.ts` — session state machine

## Phase 3 — UI

- [ ] 3.1 `App.tsx` + step routing (RegulationPick → RoleSelect → Questioning → Complete)
- [ ] 3.2 `RegulationPicker.tsx` — select regulation from bundled list
- [ ] 3.3 `RoleSelector.tsx` — select entity role for this session
- [ ] 3.4 `FactQuestion.tsx` — renders a question based on fact type (boolean / enum / number / date)
- [ ] 3.5 `Questionnaire.tsx` — sequential question with live results sidebar
- [ ] 3.6 `ObligationPanel.tsx` — confirmed / possible / ruled-out obligations
- [ ] 3.7 `ActionPanel.tsx` — required actions with computed deadlines
- [ ] 3.8 `WarningsPanel.tsx` — exemptions (display only), interaction provisions, role-change warnings

## Phase 4 — Integration & Deploy

- [ ] 4.1 End-to-end test with EU AI Act
- [ ] 4.2 Deploy to GitHub Pages
