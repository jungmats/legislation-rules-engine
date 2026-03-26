#!/usr/bin/env node
/**
 * Validates referential integrity across all JSON files for a regulation directory.
 *
 * Usage:
 *   node scripts/validate-regulation.js assets/legislation/eu-ai-act-2024-1689
 *   node scripts/validate-regulation.js  # validates all regulations in assets/legislation/
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

// ── Helpers ────────────────────────────────────────────────────────────────────

function load(dir, filename) {
  const path = join(dir, filename);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { _parseError: e.message };
  }
}

function ids(arr) {
  return new Set((arr ?? []).map((x) => x.id));
}

// ── Checks ─────────────────────────────────────────────────────────────────────

function validateDir(dir) {
  const errors = [];
  const warnings = [];

  function err(msg) { errors.push(msg); }
  function warn(msg) { warnings.push(msg); }

  // Load all files
  const files = {
    regulation:            load(dir, 'regulation.json'),
    scope:                 load(dir, 'scope.json'),
    entities:              load(dir, 'entities.json'),
    facts:                 load(dir, 'facts.json'),
    obligations:           load(dir, 'obligations.json'),
    deadline_policies:     load(dir, 'deadline_policies.json'),
    exemptions:            load(dir, 'exemptions.json'),
    rules:                 load(dir, 'rules.json'),
    action_templates:      load(dir, 'action_templates.json'),
    compliance_evidence:   load(dir, 'compliance_evidence.json'),
    penalties:             load(dir, 'penalties.json'),
    interaction_provisions:load(dir, 'interaction_provisions.json'),
    role_change_warnings:  load(dir, 'role_change_warnings.json'),
  };

  // Check parse errors and required files
  const required = ['regulation', 'scope', 'entities', 'facts', 'obligations',
    'deadline_policies', 'exemptions', 'rules', 'action_templates',
    'compliance_evidence', 'penalties', 'interaction_provisions', 'role_change_warnings'];
  for (const name of required) {
    if (files[name] === null) {
      err(`Missing required file: ${name}.json`);
    } else if (files[name]?._parseError) {
      err(`JSON parse error in ${name}.json: ${files[name]._parseError}`);
      files[name] = null; // don't try to use broken data
    }
  }

  // Build lookup sets (safe even if file was null)
  const factIds      = new Set((files.facts ?? []).map((f) => f.id));
  const obligIds     = ids(files.obligations);
  const policyIds    = ids(files.deadline_policies);
  const entityIds    = ids(files.entities);
  const exemptIds    = ids(files.exemptions);
  const actionIds    = ids(files.action_templates);
  const evidenceIds  = ids(files.compliance_evidence);

  // ── facts.json ──────────────────────────────────────────────────────────────
  for (const fact of files.facts ?? []) {
    if (fact.type === 'enum') {
      const isEntityRoleFact = fact.id === 'entity_role';
      if (!isEntityRoleFact) {
        if (!fact.value_descriptions) {
          err(`facts/${fact.id}: enum fact is missing value_descriptions`);
        } else {
          for (const v of fact.allowed_values ?? []) {
            if (!fact.value_descriptions[v]) {
              err(`facts/${fact.id}: value_descriptions missing entry for allowed value "${v}"`);
            }
          }
        }
      }
    }
  }

  // ── scope.json ──────────────────────────────────────────────────────────────
  for (const entry of files.scope ?? []) {
    for (const cond of entry.conditions ?? []) {
      if (!factIds.has(cond.fact_id)) {
        err(`scope/${entry.id}: condition references unknown fact_id "${cond.fact_id}"`);
      }
    }
  }

  // ── deadline_policies.json ──────────────────────────────────────────────────
  for (const policy of files.deadline_policies ?? []) {
    if (policy.anchor_type === 'fact_relative') {
      if (!factIds.has(policy.anchor_value)) {
        err(`deadline_policies/${policy.id}: fact_relative anchor_value "${policy.anchor_value}" is not defined in facts.json`);
      }
    }
  }

  // ── exemptions.json ─────────────────────────────────────────────────────────
  for (const ex of files.exemptions ?? []) {
    for (const cond of ex.trigger_conditions ?? []) {
      if (!factIds.has(cond.fact_id)) {
        err(`exemptions/${ex.id}: trigger_conditions references unknown fact_id "${cond.fact_id}"`);
      }
    }
    if (Array.isArray(ex.obligations_modified)) {
      for (const obId of ex.obligations_modified) {
        if (!obligIds.has(obId)) {
          err(`exemptions/${ex.id}: obligations_modified references unknown obligation_id "${obId}"`);
        }
      }
    }
    if (ex.deadline_policy_id && !policyIds.has(ex.deadline_policy_id)) {
      err(`exemptions/${ex.id}: deadline_policy_id "${ex.deadline_policy_id}" not found in deadline_policies.json`);
    }
  }

  // ── rules.json ──────────────────────────────────────────────────────────────
  for (const rule of files.rules ?? []) {
    for (const cond of rule.conditions ?? []) {
      if (!factIds.has(cond.fact_id)) {
        err(`rules/${rule.id}: condition references unknown fact_id "${cond.fact_id}"`);
      }
    }
    for (const ro of rule.obligations ?? []) {
      if (!obligIds.has(ro.obligation_id)) {
        err(`rules/${rule.id}: obligation_id "${ro.obligation_id}" not found in obligations.json`);
      }
      if (!policyIds.has(ro.deadline_policy_id)) {
        err(`rules/${rule.id}: deadline_policy_id "${ro.deadline_policy_id}" not found in deadline_policies.json`);
      }
    }
    for (const exId of rule.applicable_exemptions ?? []) {
      if (!exemptIds.has(exId)) {
        err(`rules/${rule.id}: applicable_exemptions references unknown exemption_id "${exId}"`);
      }
    }
  }

  // ── action_templates.json ───────────────────────────────────────────────────
  for (const action of files.action_templates ?? []) {
    if (action.responsible_party && !entityIds.has(action.responsible_party)) {
      err(`action_templates/${action.id}: responsible_party "${action.responsible_party}" not found in entities.json`);
    }
    for (const factId of action.required_inputs ?? []) {
      if (!factIds.has(factId)) {
        err(`action_templates/${action.id}: required_inputs references unknown fact_id "${factId}"`);
      }
    }
    if (action.triggered_by) {
      if (!obligIds.has(action.triggered_by)) {
        err(`action_templates/${action.id}: triggered_by "${action.triggered_by}" is not a valid obligation_id — must be an id from obligations.json, not a condition expression`);
      }
    }
    if (action.evidence_produced && !evidenceIds.has(action.evidence_produced)) {
      err(`action_templates/${action.id}: evidence_produced "${action.evidence_produced}" not found in compliance_evidence.json`);
    }
    for (const prereq of action.prerequisites ?? []) {
      if (!actionIds.has(prereq)) {
        err(`action_templates/${action.id}: prerequisites references unknown action_id "${prereq}"`);
      }
    }
  }

  // ── compliance_evidence.json ────────────────────────────────────────────────
  for (const ev of files.compliance_evidence ?? []) {
    if (ev.deadline_policy_id && !policyIds.has(ev.deadline_policy_id)) {
      err(`compliance_evidence/${ev.id}: deadline_policy_id "${ev.deadline_policy_id}" not found in deadline_policies.json`);
    }
  }

  // ── interaction_provisions.json ─────────────────────────────────────────────
  for (const ip of files.interaction_provisions ?? []) {
    for (const entityId of ip.entities_involved ?? []) {
      if (!entityIds.has(entityId)) {
        err(`interaction_provisions/${ip.id}: entities_involved references unknown entity_id "${entityId}"`);
      }
    }
    for (const obId of ip.obligation_ids_at_stake ?? []) {
      if (!obligIds.has(obId)) {
        err(`interaction_provisions/${ip.id}: obligation_ids_at_stake references unknown obligation_id "${obId}"`);
      }
    }
  }

  // ── role_change_warnings.json ───────────────────────────────────────────────
  for (const w of files.role_change_warnings ?? []) {
    for (const cond of w.trigger_conditions ?? []) {
      if (!factIds.has(cond.fact_id)) {
        err(`role_change_warnings/${w.id}: trigger_conditions references unknown fact_id "${cond.fact_id}"`);
      }
    }
    if (w.current_assumed_role && !entityIds.has(w.current_assumed_role)) {
      err(`role_change_warnings/${w.id}: current_assumed_role "${w.current_assumed_role}" not found in entities.json`);
    }
    if (w.potentially_applicable_role && !entityIds.has(w.potentially_applicable_role)) {
      err(`role_change_warnings/${w.id}: potentially_applicable_role "${w.potentially_applicable_role}" not found in entities.json`);
    }
    for (const obId of w.obligations_at_stake ?? []) {
      if (!obligIds.has(obId)) {
        err(`role_change_warnings/${w.id}: obligations_at_stake references unknown obligation_id "${obId}"`);
      }
    }
  }

  // ── obligations.json — successor/alternative chains ─────────────────────────
  for (const ob of files.obligations ?? []) {
    if (ob.successor_obligation_id && !obligIds.has(ob.successor_obligation_id)) {
      err(`obligations/${ob.id}: successor_obligation_id "${ob.successor_obligation_id}" not found in obligations.json`);
    }
    if (ob.alternative_obligation_id && !obligIds.has(ob.alternative_obligation_id)) {
      err(`obligations/${ob.id}: alternative_obligation_id "${ob.alternative_obligation_id}" not found in obligations.json`);
    }
  }

  // ── medium/low confidence warnings ─────────────────────────────────────────
  const allItems = [
    ...(files.facts ?? []).map((x) => ({ file: 'facts', ...x })),
    ...(files.obligations ?? []).map((x) => ({ file: 'obligations', ...x })),
    ...(files.rules ?? []).map((x) => ({ file: 'rules', ...x })),
    ...(files.exemptions ?? []).map((x) => ({ file: 'exemptions', ...x })),
    ...(files.action_templates ?? []).map((x) => ({ file: 'action_templates', ...x })),
    ...(files.interaction_provisions ?? []).map((x) => ({ file: 'interaction_provisions', ...x })),
    ...(files.role_change_warnings ?? []).map((x) => ({ file: 'role_change_warnings', ...x })),
  ];
  for (const item of allItems) {
    if (item.confidence === 'low' || item.confidence === 'medium') {
      warn(`${item.file}/${item.id} [${item.confidence}]: ${item.human_review_note ?? '(no note)'}`);
    }
  }

  return { errors, warnings };
}

// ── Runner ─────────────────────────────────────────────────────────────────────

function printResult(slug, dir, errors, warnings) {
  const ok = errors.length === 0;
  const status = ok ? '\x1b[32m✓ PASS\x1b[0m' : '\x1b[31m✗ FAIL\x1b[0m';
  console.log(`\n${status}  ${slug}  (${dir})`);

  if (errors.length > 0) {
    console.log(`\n  \x1b[31mErrors (${errors.length}):\x1b[0m`);
    for (const e of errors) console.log(`    • ${e}`);
  }
  if (warnings.length > 0) {
    console.log(`\n  \x1b[33mReview needed (${warnings.length} medium/low confidence items):\x1b[0m`);
    for (const w of warnings) console.log(`    ~ ${w}`);
  }
  if (ok && warnings.length === 0) {
    console.log('  All checks passed, no review items.');
  }
}

const arg = process.argv[2];
const legislationRoot = resolve('assets/legislation');

if (arg) {
  const dir = resolve(arg);
  const slug = dir.split('/').at(-1);
  const { errors, warnings } = validateDir(dir);
  printResult(slug, dir, errors, warnings);
  process.exit(errors.length > 0 ? 1 : 0);
} else {
  // Validate all regulation directories
  if (!existsSync(legislationRoot)) {
    console.error(`assets/legislation/ not found. Run from the repo root.`);
    process.exit(1);
  }
  const dirs = readdirSync(legislationRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ slug: d.name, dir: join(legislationRoot, d.name) }));

  if (dirs.length === 0) {
    console.log('No regulation directories found in assets/legislation/');
    process.exit(0);
  }

  let totalErrors = 0;
  for (const { slug, dir } of dirs) {
    const { errors, warnings } = validateDir(dir);
    printResult(slug, dir, errors, warnings);
    totalErrors += errors.length;
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(totalErrors === 0
    ? '\x1b[32mAll regulations passed validation.\x1b[0m'
    : `\x1b[31m${totalErrors} error(s) found across all regulations.\x1b[0m`);
  process.exit(totalErrors > 0 ? 1 : 0);
}
