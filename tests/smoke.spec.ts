/**
 * Smoke tests for the Legislation Rules Engine.
 *
 * For every regulation × role combination:
 *  1. No JS console errors
 *  2. Role selector renders buttons
 *  3. After role selection, a question is shown OR questionnaire completes — never a blank page
 *  4. Every question renders a visible input (no unhandled fact type)
 *  5. Answering/skipping all questions reaches the complete step without errors
 *  6. At least one obligation or "no obligations" message is shown at the end
 *  7. Back button returns to previous question (not role selector) when questions have been answered
 */

import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEGISLATION_DIR = join(process.cwd(), 'assets/legislation');

interface RoleMeta {
  id: string;
  label: string;
}

interface RegulationMeta {
  slug: string;
  shortName: string;
  roles: RoleMeta[];
}

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

/**
 * Answer or skip the current question. Returns true if a question was acted on.
 */
async function answerCurrentQuestion(page: Page): Promise<boolean> {
  // Boolean: click Yes
  const yesBtn = page.locator('button', { hasText: 'Yes' }).first();
  if (await yesBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await yesBtn.click();
    return true;
  }

  // Enum: click the first option (inside the question div with flex-col gap-2)
  const enumBtn = page.locator('div.flex.flex-col.gap-2 button').first();
  if (await enumBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await enumBtn.click();
    return true;
  }

  // Number / string / date input
  const input = page.locator('input[type="number"], input[type="text"], input[type="date"]').first();
  if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
    const type = await input.getAttribute('type');
    if (type === 'number') await input.fill('100');
    else if (type === 'date') await input.fill('2024-01-01');
    else await input.fill('test');
    await page.locator('button', { hasText: 'Confirm' }).first().click();
    return true;
  }

  return false;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

for (const { shortName, roles } of regulations) {
  for (const role of roles) {
    test(`${shortName} › ${role.id} › no blank page, all questions render`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => consoleErrors.push(err.message));

      await page.goto('/');

      // ── 1. Pick the regulation ──────────────────────────────────────────────
      await page.locator('button', { hasText: shortName }).first().click();

      // ── 2. Role selector must show buttons ──────────────────────────────────
      await expect(page.locator('ul button').first()).toBeVisible({ timeout: 5000 });

      // ── 3. Select this role by its label text ───────────────────────────────
      await page.locator('ul button').filter({ hasText: role.label }).first().click();

      // ── 4. Walk all questions ───────────────────────────────────────────────
      let safetyLimit = 60;
      while (safetyLimit-- > 0) {
        // Never a blank page
        await expect(page.locator('main')).not.toBeEmpty();

        // Done if complete step is showing
        if (await page.locator('text=Questionnaire complete').isVisible({ timeout: 300 }).catch(() => false)) break;
        if (await page.locator('text=Assessment complete').isVisible({ timeout: 300 }).catch(() => false)) break;

        // If assessment intro is showing, skip it to reach complete
        if (await page.locator('text=Your obligations are confirmed').isVisible({ timeout: 300 }).catch(() => false)) {
          await page.locator('button', { hasText: 'Skip' }).first().click();
          break;
        }

        // A question card must be visible
        await expect(page.locator('h3').first()).toBeVisible({ timeout: 3000 });

        // The question must have a visible interactive element
        const hasInput = await page.locator([
          'button:has-text("Yes")',
          'button:has-text("No")',
          'div.flex.flex-col.gap-2 button',
          'input[type="number"]',
          'input[type="text"]',
          'input[type="date"]',
        ].join(', ')).first().isVisible({ timeout: 500 }).catch(() => false);

        expect(
          hasInput,
          `Question rendered no input for role "${role.id}" in "${shortName}"`,
        ).toBe(true);

        const answered = await answerCurrentQuestion(page);
        if (!answered) {
          // Fallback: skip
          const skipBtn = page.locator('button', { hasText: 'Skip' });
          if (await skipBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await skipBtn.click();
          } else {
            // Hit "Stop here" if somehow stuck
            const stopBtn = page.locator('button', { hasText: 'Stop here' });
            if (await stopBtn.isVisible({ timeout: 500 }).catch(() => false)) await stopBtn.click();
            break;
          }
        }
      }

      // ── 5. Complete state must be visible ───────────────────────────────────
      const isQComplete = await page.locator('text=Questionnaire complete').isVisible({ timeout: 5000 }).catch(() => false);
      const isAComplete = await page.locator('text=Assessment complete').isVisible({ timeout: 1000 }).catch(() => false);
      const hasObligations = await page.locator('text=Confirmed').isVisible({ timeout: 1000 }).catch(() => false);
      const isComplete = isQComplete || isAComplete;
      expect(
        isComplete || hasObligations,
        `Did not reach completion for role "${role.id}" in "${shortName}"`,
      ).toBe(true);

      // ── 6. No JS errors ─────────────────────────────────────────────────────
      expect(
        consoleErrors,
        `JS errors for "${shortName}" › "${role.id}": ${consoleErrors.join('; ')}`,
      ).toHaveLength(0);
    });
  }
}

// ── Back button test ──────────────────────────────────────────────────────────

test('Back button undoes one question at a time', async ({ page }) => {
  await page.goto('/');

  // Use EU AI Act / provider — has several questions
  await page.locator('button', { hasText: 'EU AI Act' }).first().click();
  await page.locator('ul button').filter({ hasText: /provider/i }).first().click();

  // Capture the first question text
  const firstQuestion = page.locator('h3').first();
  await expect(firstQuestion).toBeVisible({ timeout: 3000 });
  const firstText = await firstQuestion.textContent();

  // Answer first question
  await answerCurrentQuestion(page);

  // Should now be on a different question
  await expect(page.locator('h3').first()).not.toHaveText(firstText ?? '');

  // Hit Back
  await page.locator('button', { hasText: '← Back' }).click();

  // Should return to the first question, not the role selector
  await expect(page.locator('h3').first()).toHaveText(firstText ?? '');
  await expect(page.locator('text=What is your role?')).not.toBeVisible();
});
