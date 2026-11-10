/**
 * E2E Acceptance: Pinned Prompts first in the injected prompt picker (My-Prompt-Manager-dqu)
 *
 * Runs the built extension's content script on a mocked Claude page. Also captures
 * light/dark screenshots of the opened picker as visual proof (test-results/picker-pinned/).
 */

import type { BrowserContext, Page } from '@playwright/test';

import { DEFAULT_SETTINGS, type Prompt } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { listedTitles, promptSelector, promptsButton } from '../fixtures/platform-pages';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const MOCK_HOST = 'https://claude.ai/';
const SCREENSHOT_DIR = 'test-results/picker-pinned';
const MOCK_BODY = /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Claude Mock</title>
    <style>
      body { font-family: sans-serif; padding: 24px; }
      .flex { display: flex; gap: 8px; align-items: center; }
      .ProseMirror { min-height: 120px; border: 1px solid #ddd; padding: 12px; }
    </style>
  </head>
  <body>
    <main>
      <div class="flex gap-2 items-center">
        <div class="ProseMirror" contenteditable="true" role="textbox">Start writing here…</div>
      </div>
    </main>
  </body>
</html>
`;

// Storage order: the Pinned Prompt is last, so "first in the picker" proves the partition
const prompts: Prompt[] = [
  createPromptSeed({
    id: 'dev',
    title: 'Dev — Ticket → Test-First Plan',
    content: 'Read this ticket and write a test-first plan. List the failing tests first.',
    category: 'Development',
  }),
  createPromptSeed({
    id: 'notes',
    title: 'Meeting Notes → Decisions and Owners',
    content: 'Turn these raw meeting notes into decisions, owners and due dates.',
    category: 'Writing',
  }),
  createPromptSeed({
    id: 'release',
    title: 'Release Notes Draft',
    content: 'Write user-facing release notes from this changelog. Keep it short and friendly.',
    category: 'Writing',
    pinned: true,
  }),
];

const seed = async (storage: ExtensionStorage, theme: 'light' | 'dark') => {
  await seedLibrary(storage, {
    prompts,
    settings: { ...DEFAULT_SETTINGS, interfaceMode: 'popup', theme },
  });
};

const openPicker = async (context: BrowserContext): Promise<Page> => {
  await context.route('https://claude.ai/**', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: MOCK_BODY });
    } else {
      await route.abort();
    }
  });

  const targetPage = await context.newPage();
  await targetPage.setViewportSize({ width: 900, height: 700 });
  await targetPage.goto(MOCK_HOST, { waitUntil: 'domcontentloaded' });

  await expect(promptsButton(targetPage)).toHaveCount(1);
  await promptsButton(targetPage).click();
  await expect(promptSelector(targetPage)).toBeVisible();
  return targetPage;
};

const pickerTitles = (page: Page) => listedTitles(page);

test.describe('Prompt picker & Pinned Prompts', () => {
  test('AT2: the Pinned Prompt is listed first in the injected picker, others keep their order', async ({ context, storage }) => {
    await seed(storage, 'light');
    const page = await openPicker(context);

    await expect.poll(() => pickerTitles(page)).toEqual([
      'Release Notes Draft',
      'Dev — Ticket → Test-First Plan',
      'Meeting Notes → Decisions and Owners',
    ]);

    // Searching keeps the Pinned Prompt first among the matches
    await page.keyboard.type('notes');
    await expect.poll(() => pickerTitles(page)).toEqual([
      'Release Notes Draft',
      'Meeting Notes → Decisions and Owners',
    ]);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`PROOF: prompt picker screenshot with Pinned Prompt first (${theme} mode)`, async ({ context, storage }) => {
      await seed(storage, theme);
      const page = await openPicker(context);

      await expect(page.locator('#mpm-prompt-selector')).toHaveAttribute('data-theme', theme);
      await expect.poll(() => pickerTitles(page)).toContain('Release Notes Draft');
      expect((await pickerTitles(page))[0]).toBe('Release Notes Draft');

      await page.screenshot({ path: `${SCREENSHOT_DIR}/picker${theme === 'dark' ? '-dark' : ''}.png`, animations: 'disabled' });
    });
  }
});
