/**
 * Random path tests for the Legislation Rules Engine.
 *
 * Runs 10 random paths per regulation on every test run.
 * Each path picks a random role and answers every question randomly.
 *
 * On failure, the full path (seed + role + every answer) is printed so you
 * can reproduce the exact session manually.
 */

import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const PATHS_PER_REGULATION = 10;
const LEGISLATION_DIR = join(process.cwd(), 'assets/legislation');

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────

function makePrng(seed: number) {
  let s = seed;
  return function rand(): number {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

// ── Load regulation metadata ──────────────────────────────────────────────────

interface RoleMeta { id: string; label: string }
interface RegulationMeta { slug: string; shortName: string; roles: RoleMeta[] }

function loadRegulationMetas(): RegulationMeta[] {
  return readdirSync(LEGISLATION_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const dir = join(LEGISLATION_DIR, d.name);
      const regulation = JSON.parse(readFileSync(join(dir, 'regulation.json'), 'utf8'));
      const facts: Array<{ id: string; allowed_values?: string[] }> = JSON.parse(
        readFileSync(join(dir, 'facts.json'), 'utf8'),
      );
      const entities: Array<{ id: string; label: string }> = JSON.parse(
        readFileSync(join(dir, 'entities.json'), 'utf8'),
      );
      const entityRoleFact = facts.find((f) => f.id === 'entity_role');
      const selectableIds: string[] = entityRoleFact?.allowed_values ?? entities.map((e) => e.id);
      const roles: RoleMeta[] = selectableIds.map((id) => ({
        id,
        label: entities.find((e) => e.id === id)?.label ?? id,
      }));
      return { slug: d.name, shortName: regulation.short_name ?? d.name, roles };
    });
}

const regulations = loadRegulationMetas();

// ── Random answer helper ──────────────────────────────────────────────────────

interface AnswerRecord {
  question: string;
  answer: string;
}

async function answerRandomly(
  page: Page,
  rand: () => number,
  log: AnswerRecord[],
): Promise<boolean> {
  // Boolean: randomly pick Yes or No
  const yesBtn = page.locator('button', { hasText: 'Yes' }).first();
  const noBtn = page.locator('button', { hasText: 'No' }).first();
  if (await yesBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    const question = await page.locator('h3').first().textContent() ?? '?';
    const choice = rand() < 0.5 ? 'Yes' : 'No';
    log.push({ question, answer: choice });
    await (choice === 'Yes' ? yesBtn : noBtn).click();
    return true;
  }

  // Enum: pick a random option
  const enumBtns = page.locator('div.flex.flex-col.gap-2 button');
  const enumCount = await enumBtns.count();
  if (enumCount > 0) {
    const question = await page.locator('h3').first().textContent() ?? '?';
    const idx = Math.floor(rand() * enumCount);
    const chosen = await enumBtns.nth(idx).textContent() ?? String(idx);
    log.push({ question, answer: chosen.trim().split('\n')[0] });
    await enumBtns.nth(idx).click();
    return true;
  }

  // Number
  const numInput = page.locator('input[type="number"]').first();
  if (await numInput.isVisible({ timeout: 500 }).catch(() => false)) {
    const question = await page.locator('h3').first().textContent() ?? '?';
    // Pick a value that exercises threshold branching: 0, 50, 249, 250, 1000, 10000
    const candidates = [0, 50, 249, 250, 1000, 10000];
    const value = String(pick(candidates, rand));
    log.push({ question, answer: value });
    await numInput.fill(value);
    await page.locator('button', { hasText: 'Confirm' }).first().click();
    return true;
  }

  // Date
  const dateInput = page.locator('input[type="date"]').first();
  if (await dateInput.isVisible({ timeout: 500 }).catch(() => false)) {
    const question = await page.locator('h3').first().textContent() ?? '?';
    const value = '2024-06-15';
    log.push({ question, answer: value });
    await dateInput.fill(value);
    await page.locator('button', { hasText: 'Confirm' }).first().click();
    return true;
  }

  // Text
  const textInput = page.locator('input[type="text"]').first();
  if (await textInput.isVisible({ timeout: 500 }).catch(() => false)) {
    const question = await page.locator('h3').first().textContent() ?? '?';
    log.push({ question, answer: 'test' });
    await textInput.fill('test');
    await page.locator('button', { hasText: 'Confirm' }).first().click();
    return true;
  }

  return false;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

for (const { shortName, roles } of regulations) {
  for (let i = 0; i < PATHS_PER_REGULATION; i++) {
    // Title is stable (no seed) — seed is generated fresh inside the test body
    test(`${shortName} › random path ${i + 1}`, async ({ page }) => {
      const seed = Math.floor(Math.random() * 0xFFFFFFFF);
      const rand = makePrng(seed);
      const role = pick(roles, rand);
      const answerLog: AnswerRecord[] = [];
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => consoleErrors.push(err.message));

      // Helper: build a replay summary for failure messages
      function replaySummary() {
        const lines = [
          ``,
          `  ╔═ REPLAY THIS PATH ══════════════════════════════════════╗`,
          `  ║  Regulation : ${shortName}`,
          `  ║  Role       : ${role.label} (${role.id})`,
          `  ║  Seed       : ${seed}`,
          `  ║  Answers    :`,
          ...answerLog.map((a, n) =>
            `  ║    ${String(n + 1).padStart(2)}. ${a.question.slice(0, 45).padEnd(45)} → ${a.answer}`
          ),
          `  ╚══════════════════════════════════════════════════════════╝`,
        ];
        return lines.join('\n');
      }

      await page.goto('/');

      // Pick regulation
      await page.locator('button', { hasText: shortName }).first().click();
      await expect(page.locator('ul button').first()).toBeVisible({ timeout: 5000 });

      // Pick role
      await page.locator('ul button').filter({ hasText: role.label }).first().click();

      // Walk all questions with random answers
      let safetyLimit = 60;
      while (safetyLimit-- > 0) {
        expect(page.locator('main'), 'blank page detected\n' + replaySummary()).toBeTruthy();

        if (await page.locator('text=Questionnaire complete').isVisible({ timeout: 300 }).catch(() => false)) break;
        if (await page.locator('text=Assessment complete').isVisible({ timeout: 300 }).catch(() => false)) break;

        // Assessment intro — skip to results
        if (await page.locator('text=Your obligations are confirmed').isVisible({ timeout: 300 }).catch(() => false)) {
          await page.locator('button', { hasText: 'Skip' }).first().click();
          break;
        }

        await expect(page.locator('h3').first()).toBeVisible({ timeout: 3000 });

        const hasInput = await page.locator([
          'button:has-text("Yes")',
          'div.flex.flex-col.gap-2 button',
          'input[type="number"]',
          'input[type="text"]',
          'input[type="date"]',
        ].join(', ')).first().isVisible({ timeout: 500 }).catch(() => false);

        const question = await page.locator('h3').first().textContent() ?? '?';
        expect(hasInput, `No input rendered for question "${question}"\n` + replaySummary()).toBe(true);

        const answered = await answerRandomly(page, rand, answerLog);
        if (!answered) {
          const skipBtn = page.locator('button', { hasText: 'Skip' });
          if (await skipBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            const q = await page.locator('h3').first().textContent() ?? '?';
            answerLog.push({ question: q, answer: '(skipped)' });
            await skipBtn.click();
          } else {
            break;
          }
        }
      }

      // Must reach completion
      const isQComplete = await page.locator('text=Questionnaire complete').isVisible({ timeout: 5000 }).catch(() => false);
      const isAComplete = await page.locator('text=Assessment complete').isVisible({ timeout: 1000 }).catch(() => false);
      const isComplete = isQComplete || isAComplete;
      const hasObligations = await page.locator('text=Confirmed').isVisible({ timeout: 1000 }).catch(() => false);
      expect(
        isComplete || hasObligations,
        `Did not reach completion\n` + replaySummary(),
      ).toBe(true);

      // No JS errors
      expect(
        consoleErrors,
        `JS errors: ${consoleErrors.join('; ')}\n` + replaySummary(),
      ).toHaveLength(0);
    });
  }
}
