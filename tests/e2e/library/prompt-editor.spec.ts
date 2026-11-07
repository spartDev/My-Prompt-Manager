/**
 * E2E Acceptance: the Prompt editor (My-Prompt-Manager-3sr, design Atelier 1C)
 *
 * One editor for a new Prompt and an edit: header bar Cancel / heading / Save, Category chips (one
 * Category per Prompt) with "New category", the text with its Variables highlighted and listed,
 * Cmd/Ctrl+S, and the "Discard changes?" question. Runs against the built extension and captures
 * light/dark screenshots of the popup and the side panel (test-results/prompt-editor/).
 */

import type { Page } from '@playwright/test';

import type { Category } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/prompt-editor';

const categories: Category[] = [
  { id: 'po', name: 'Product Owner', color: '#2563EB' },
  { id: 'email', name: 'Email', color: '#DB2777' },
  { id: 'writing', name: 'Writing', color: '#9333EA' },
  { id: 'dev', name: 'Development', color: '#4D7C0F' }
];

const followUp = createPromptSeed({
  id: 'follow-up',
  title: 'Follow-up email after a demo',
  content: 'Write a concise email to {{recipient}}.\nGoal: {{goal}}\nTone: {{tone}}\n\nKeep it short and end with one clear next step.',
  category: 'Email'
});

const SURFACES = [
  { name: 'popup', url: 'src/popup.html', size: { width: 400, height: 500 } },
  { name: 'sidepanel', url: 'src/sidepanel.html', size: { width: 400, height: 860 } }
] as const;

const open = async (
  page: Page,
  storage: ExtensionStorage,
  extensionId: string,
  { theme = 'light', surface = SURFACES[0] }: { theme?: 'light' | 'dark'; surface?: (typeof SURFACES)[number] } = {}
) => {
  await seedLibrary(storage, { prompts: [followUp], categories, settings: { theme } });
  await page.setViewportSize(surface.size);
  await page.goto(`chrome-extension://${extensionId}/${surface.url}`);
  await expect(page.getByRole('heading', { name: followUp.title })).toBeVisible();
};

const categoryChip = (page: Page, name: string) =>
  page.getByRole('radiogroup', { name: 'Category' }).getByRole('radio', { name, exact: true });

test.describe('Prompt editor', () => {
  test('writes a new Prompt with a new Category and Variables, saved with Cmd/Ctrl+S', async ({ page, storage, extensionId }) => {
    await open(page, storage, extensionId);
    await page.getByTestId('new-prompt-button').click();
    await expect(page.getByRole('heading', { name: 'New prompt', exact: true })).toBeVisible();
    await expect(categoryChip(page, 'Uncategorized')).toBeChecked();

    // New category, admitted on the way in: surrounding spaces are removed from the name
    await page.getByRole('button', { name: 'New category' }).click();
    await page.getByLabel('New category name').fill('  Research  ');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Category created', { exact: true })).toBeVisible();
    await expect(categoryChip(page, 'Research')).toBeChecked();
    await expect(categoryChip(page, 'Uncategorized')).not.toBeChecked();

    // A Category name that is already taken, ignoring case, is refused with the reason
    await page.getByRole('button', { name: 'New category' }).click();
    await page.getByLabel('New category name').fill('email');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('already exists');
    await page.getByRole('button', { name: 'Cancel new category' }).click();

    await page.getByLabel('Title', { exact: true }).fill('Interview notes');
    const content = '  Summarize {{transcript}} for {{audience}}.\n';
    await page.getByLabel('Content', { exact: true }).fill(content);
    await expect(page.getByTestId('variable-mirror').locator('mark')).toHaveText(['{{transcript}}', '{{audience}}']);
    await expect(page.getByRole('region', { name: 'Variables' }).getByRole('listitem')).toHaveText(['transcript', 'audience']);

    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();
    await expect(page.getByText('Prompt created', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Interview notes' })).toBeVisible();

    const saved = (await storage.getPrompts()).find(p => p.title === 'Interview notes');
    // Verbatim: the spaces and the line break around the text are kept
    expect(saved).toMatchObject({ content, category: 'Research' });
    expect((await storage.getCategories()).map(c => c.name)).toContain('Research');
  });

  test('asks before discarding an edit, and leaves at once without changes', async ({ page, storage, extensionId }) => {
    await open(page, storage, extensionId);
    await page.getByRole('button', { name: `Edit ${followUp.title}` }).click();
    await expect(page.getByRole('heading', { name: 'Edit prompt', exact: true })).toBeVisible();
    await expect(categoryChip(page, 'Email')).toBeChecked();

    await categoryChip(page, 'Writing').click();
    await page.keyboard.press('Escape');
    const dialog = page.getByRole('dialog', { name: 'Discard changes?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(categoryChip(page, 'Writing')).toBeChecked();

    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await dialog.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByRole('heading', { name: followUp.title })).toBeVisible();
    expect((await storage.getPrompts())[0].category).toBe('Email');

    await page.getByRole('button', { name: `Edit ${followUp.title}` }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('heading', { name: followUp.title })).toBeVisible();
  });

  for (const surface of SURFACES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`looks like the design in the ${surface.name} (${theme})`, async ({ page, storage, extensionId }) => {
        await open(page, storage, extensionId, { theme, surface });

        await page.getByTestId('new-prompt-button').click();
        await expect(page.getByRole('heading', { name: 'New prompt', exact: true })).toBeVisible();
        await page.screenshot({ path: `${SCREENSHOT_DIR}/new-${surface.name}-${theme}.png` });

        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.getByRole('button', { name: `Edit ${followUp.title}` }).click();
        await expect(page.getByTestId('variable-mirror').locator('mark')).toHaveCount(3);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/edit-${surface.name}-${theme}.png` });
      });
    }
  }
});
