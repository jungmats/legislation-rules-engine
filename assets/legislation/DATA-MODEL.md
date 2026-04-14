# Legislation Data Model — JSON File Reference

Each regulation lives in its own directory under `assets/legislation/` and contains thirteen JSON files. Together they form a complete, machine-readable representation of a regulation that the rules engine can evaluate.

---

## regulation.json

The identity card of the regulation. Contains the official title, short name, publication date, effective date, jurisdiction, source URL, and any amendment history. May also include notes about implementing decrees, article renumbering, or other context that helps a reviewer understand what version of the law is captured.

---

## entities.json

The actors named by the regulation — roles like "owner", "tenant", "operator", "data processor". Each entity has a label, a description of its legal position, and optionally a list of its responsibilities under the regulation. The questionnaire uses this file to let the user pick their role before questions begin.

---

## facts.json

The questions the tool needs to ask. Each fact represents a single piece of information that is either known to the user (e.g. floor area, type of activity) or can be measured (e.g. annual energy consumption). Facts have a type — boolean, enum, number, integer, string, or date — and optionally a unit, a list of allowed values with descriptions, and a reference to the source article that requires this information.

Facts come in two flavours:
- **Gating facts** are used in rule conditions to determine which obligations apply.
- **Measurement facts** are referenced by obligations (as `baseline_fact`, `measured_fact`, or `threshold_fact`) and are collected during the compliance assessment phase.

---

## scope.json

Narrative descriptions of who is in scope and who is excluded, each tied to a source article. These are informational — the actual logic of who is in or out is encoded in `rules.json` as conditions. Scope entries give a human-readable explanation and can be linked from rules.

---

## rules.json

The core logic file. Each rule says: "if these conditions are all true, then these obligations apply." Conditions are fact-based comparisons (e.g. floor area ≥ 1000 m²). Obligations are referenced by ID, each paired with a deadline policy.

A rule can also carry:
- **applicable_exemptions** — exemptions that may reduce or waive the resulting obligations
- **trigger_event** — marks rules that are activated by a real-world event (e.g. changing energy type) rather than by questionnaire answers; these are excluded from evaluation and shown as "possible" until the event occurs

The engine evaluates each rule as confirmed (all conditions met), possible (some conditions unanswered), or ruled out (at least one condition false).

---

## obligations.json

What the subject must actually do. Each obligation has a label, description, and source article. Obligations with measurable targets also carry:
- **threshold_type**: `relative` (reduce by X% from a baseline) or `absolute` (stay below a fixed value)
- **baseline_fact** / **measured_fact** / **threshold_fact**: references to facts in `facts.json` that provide the numbers needed to evaluate compliance
- **reduction_pct** or **max_value**: the numeric target itself
- **alternative_obligation_id**: points to an alternative obligation when the regulation allows the subject to meet either one (e.g. relative reduction OR absolute consumption cap)
- **successor_obligation_id**: points to the next obligation in a sequence (e.g. the 2040 target that follows the 2030 target)

---

## deadline_policies.json

When obligations must be met. A deadline policy is either a fixed date (e.g. 31 December 2030) or a date computed relative to a fact (e.g. 12 months after the building permit date). It also specifies whether the deadline recurs annually or is a one-time target. Obligations reference deadline policies rather than hardcoding dates, so the same policy can be reused across obligations.

---

## exemptions.json

Conditions under which an obligation is reduced, deferred, or waived entirely. Each exemption lists the trigger conditions that activate it and specifies its effect. Exemptions are linked from rules — when a rule is confirmed, its applicable exemptions are surfaced alongside the resulting obligations so the user can see which relief mechanisms might apply to them.

---

## action_templates.json

The concrete steps a subject needs to take to comply. Each action has a responsible party, a list of required input facts, and optionally a reference to the compliance evidence it produces and any prerequisite actions that must be completed first. Actions are displayed in the Actions tab of the tool grouped by obligation.

---

## compliance_evidence.json

The documents or records that demonstrate compliance. Each evidence item names the platform or system where it must be submitted, the fields required, how frequently it must be produced, and any retention period. Evidence items are typically produced as outputs of action templates.

---

## penalties.json

What happens if the subject fails to comply. Each penalty has a type (fine, publication, injunction, or criminal), a description of what triggers it, the amount or nature of the penalty, and the authority responsible for enforcement. The Fines tab in the tool displays these.

---

## How the files connect

```
entities.json       ← user picks their role here
     │
facts.json          ← gating conditions reference fact IDs
     │                 measurement obligations reference fact IDs
rules.json ─────────→ obligations.json ──→ deadline_policies.json
     │                      │
     └──→ exemptions.json   └──→ action_templates.json
                                        │
                            compliance_evidence.json

scope.json          ← narrative context, linked from rules
penalties.json      ← independent, displayed in Fines tab
```

The engine reads all files at startup and links everything by ID. The questionnaire asks gating facts to evaluate rules; confirmed obligations with measurable targets trigger a second round of questions to collect measurement facts; the compliance panel then computes and displays the result.
