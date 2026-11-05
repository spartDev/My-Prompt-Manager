/**
 * E2E Acceptance: Library cards & Pinned Prompts (My-Prompt-Manager-z2u)
 *
 * Runs against the built extension. Also captures light/dark screenshots of the
 * Library as visual proof of the card redesign (test-results/library-cards/).
 */

import type { Page } from '@playwright/test';

import type { Category, Prompt } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { LibraryPage } from '../pages/LibraryPage';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SIDEPANEL_URL = 'src/sidepanel.html';
const SCREENSHOT_DIR = 'test-results/library-cards';

const categories: Category[] = [
  { id: 'dev', name: 'Development', color: '#16A34A' },
  { id: 'po', name: 'Product Owner', color: '#2563EB' },
  { id: 'writing', name: 'Writing', color: '#7C3AED' },
];

const MONTH_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000;

const prompts: Prompt[] = [
  createPromptSeed({
    id: 'dev',
    title: 'Dev — Ticket → Test-First Plan & Steps',
    content: 'You are a staff engineer. Read this ticket and write a test-first plan. Ticket: ___ Stack: ___ List the failing tests first, then the smallest steps to make them pass.',
    category: 'Development',
    usageCount: 18,
    createdAt: MONTH_AGO,
    updatedAt: MONTH_AGO + 3000,
  }),
  createPromptSeed({
    id: 'po',
    title: 'PO — Backlog Refinement & WSJF Scoring',
    content: 'Score each backlog item with WSJF: business value, time criticality, risk reduction and job size. Backlog: ___ Return a ranked table.',
    category: 'Product Owner',
    usageCount: 12,
    createdAt: MONTH_AGO,
    updatedAt: MONTH_AGO + 2000,
  }),
  createPromptSeed({
    id: 'notes',
    title: 'Meeting Notes → Decisions & Owners',
    content: 'Turn these raw meeting notes into decisions, owners and due dates. Flag anything left unresolved. Notes: ___',
    category: 'Writing',
    usageCount: 1,
    createdAt: MONTH_AGO,
    updatedAt: MONTH_AGO + 1000,
  }),
  createPromptSeed({
    id: 'fresh',
    title: 'Release Notes Draft',
    content: 'Write user-facing release notes from this changelog. Keep it short and friendly.',
    category: 'Writing',
    usageCount: 0,
    createdAt: MONTH_AGO,
    updatedAt: MONTH_AGO,
  }),
];

const seed = async (storage: ExtensionStorage, seedPrompts: Prompt[], theme: 'light' | 'dark') => {
  await seedLibrary(storage, { prompts: seedPrompts, categories, settings: { theme } });
};

const openLibrary = async (page: Page, extensionId: string) => {
  await page.setViewportSize({ width: 400, height: 760 });
  await page.goto(`chrome-extension://${extensionId}/${SIDEPANEL_URL}`);
  const library = new LibraryPage(page);
  await expect(page.getByTestId('prompt-card')).toHaveCount(prompts.length);
  return library;
};

test.describe('Library cards & Pinned Prompts', () => {
  test('AT7: pinning a prompt moves it to the top and it stays there after reload', async ({ page, storage, extensionId }) => {
    await seed(storage, prompts, 'light');
    const library = await openLibrary(page, extensionId);

    // Default sort is "recently updated": the last card is the oldest one
    expect(await library.getPromptTitles()).toEqual([
      'Dev — Ticket → Test-First Plan & Steps',
      'PO — Backlog Refinement & WSJF Scoring',
      'Meeting Notes → Decisions & Owners',
      'Release Notes Draft',
    ]);

    await library.togglePin('Release Notes Draft');

    await expect(page.getByRole('button', { name: 'Unpin Release Notes Draft' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => library.getPromptTitles()).toEqual([
      'Release Notes Draft',
      'Dev — Ticket → Test-First Plan & Steps',
      'PO — Backlog Refinement & WSJF Scoring',
      'Meeting Notes → Decisions & Owners',
    ]);

    // Persisted, and pinning is not an edit (updatedAt unchanged)
    const stored = (await storage.getPrompts()).find(p => p.id === 'fresh');
    expect(stored?.pinned).toBe(true);
    expect(stored?.updatedAt).toBe(MONTH_AGO);

    await page.reload();
    await expect(page.getByTestId('prompt-card')).toHaveCount(prompts.length);
    expect((await library.getPromptTitles())[0]).toBe('Release Notes Draft');

    // Unpinning puts it back in its sorted place
    await library.togglePin('Release Notes Draft');
    await expect.poll(async () => (await library.getPromptTitles()).slice(-1)[0]).toBe('Release Notes Draft');
  });

  test('f3h AT3: a double click on the star ends unpinned, a single click pins (after reload)', async ({ page, storage, extensionId }) => {
    await seed(storage, prompts, 'light');
    const library = await openLibrary(page, extensionId);

    // Two clicks before the first write resolves must cancel each other out
    await page.getByRole('button', { name: 'Pin Release Notes Draft' }).dblclick();
    await page.waitForTimeout(500);
    expect((await storage.getPrompts()).find(p => p.id === 'fresh')?.pinned ?? false).toBe(false);

    await page.reload();
    await expect(page.getByTestId('prompt-card')).toHaveCount(prompts.length);
    await expect(page.getByRole('button', { name: 'Pin Release Notes Draft' })).toHaveAttribute('aria-pressed', 'false');
    expect((await library.getPromptTitles()).slice(-1)[0]).toBe('Release Notes Draft');

    await library.togglePin('Release Notes Draft');
    await expect(page.getByRole('button', { name: 'Unpin Release Notes Draft' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.getByTestId('prompt-card')).toHaveCount(prompts.length);
    await expect(page.getByRole('button', { name: 'Unpin Release Notes Draft' })).toHaveAttribute('aria-pressed', 'true');
    expect((await library.getPromptTitles())[0]).toBe('Release Notes Draft');
  });

  test('AT4: card shows preview, category and usage; clicking the card body opens the editor', async ({ page, storage, extensionId }) => {
    await seed(storage, prompts, 'light');
    await openLibrary(page, extensionId);

    const devCard = page.getByTestId('prompt-card').filter({ hasText: 'Dev — Ticket' });
    await expect(devCard.getByText('Development')).toBeVisible();
    await expect(devCard.getByText('18 uses')).toBeVisible();
    await expect(page.getByTestId('prompt-card').filter({ hasText: 'Meeting Notes' }).getByText('1 use')).toBeVisible();
    await expect(page.getByTestId('prompt-card').filter({ hasText: 'Release Notes' }).getByText('Never used')).toBeVisible();

    // Click on the preview text (not the title): the stretched overlay opens the editor
    // Real mouse click at the preview's position (hit-testing goes through the card overlay)
    const preview = await devCard.getByText(/You are a staff engineer/).boundingBox();
    expect(preview).not.toBeNull();
    if (preview) {
      await page.mouse.click(preview.x + preview.width / 2, preview.y + preview.height / 2);
    }
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
  });

  test('AT5: deleting from the edit form asks for confirmation then removes the prompt', async ({ page, storage, extensionId }) => {
    await seed(storage, prompts, 'light');
    const library = await openLibrary(page, extensionId);

    await library.deletePrompt('Release Notes Draft');
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByTestId('prompt-card')).toHaveCount(prompts.length - 1);
    expect(await library.getPromptTitles()).not.toContain('Release Notes Draft');
    expect((await storage.getPrompts()).map(p => p.id)).not.toContain('fresh');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`PROOF: Library cards screenshot (${theme} mode)`, async ({ page, storage, extensionId }) => {
      const pinnedFirst = prompts.map(p => (p.id === 'po' ? { ...p, pinned: true } : p));
      await seed(storage, pinnedFirst, theme);
      await openLibrary(page, extensionId);

      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
      await expect(page.getByRole('button', { name: /^Unpin PO/ })).toHaveAttribute('aria-pressed', 'true');

      await page.screenshot({ path: `${SCREENSHOT_DIR}/library-${theme}.png` });
    });
  }
});
