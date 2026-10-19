/**
 * E2E harness contract: data seeded at the start of a test is what the extension sees.
 *
 * Regression for My-Prompt-Manager-2br: the `page` fixture used to open popup.html before
 * the test seeded storage, and the popup's first getCategories() could overwrite the
 * seeded categories with [Uncategorized].
 */

import type { Category } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { seedLibrary, createPromptSeed } from '../utils/storage';

const categories: Category[] = [
  { id: 'dev', name: 'Development', color: '#16A34A' },
  { id: 'writing', name: 'Writing', color: '#7C3AED' },
];

test.describe('E2E fixture seeding', () => {
  test('hands over a page that has not started the extension app yet', async ({ page }) => {
    expect(page.url()).toBe('about:blank');
  });

  test('keeps seeded categories: the app shows them and does not overwrite them', async ({ page, storage, extensionId }) => {
    await seedLibrary(storage, {
      categories,
      prompts: [
        createPromptSeed({ id: 'p1', title: 'Ticket plan', content: 'Plan', category: 'Development' }),
        createPromptSeed({ id: 'p2', title: 'Notes', content: 'Notes', category: 'Writing' }),
      ],
    });

    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);

    await expect(page.getByTestId('prompt-card').filter({ hasText: 'Ticket plan' }).getByText('Development')).toBeVisible();
    await expect(page.getByTestId('prompt-card').filter({ hasText: 'Notes' }).getByText('Writing')).toBeVisible();

    const stored = await storage.get<{ categories: Category[] }>('categories');
    expect(stored.categories.map(c => c.name)).toEqual(expect.arrayContaining(['Development', 'Writing']));
  });
});
