/**
 * E2E: the app shell and the Library on the color tokens (My-Prompt-Manager-el4.3)
 *
 * The header and the tab bar are seamless on bg-app: the line under the header shows only once the
 * list has scrolled, the line above the tab bar only while content remains below. Cards, search,
 * pills, tabs and card actions take the colors of the reference canvas. Also captures light/dark
 * screenshots as visual proof (test-results/library-shell/): popup and side panel, at the top of
 * the list and scrolled.
 */

import type { Page } from '@playwright/test';

import type { Category, Prompt } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/library-shell';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const EXPECTED = {
  light: {
    app: 'rgb(244, 241, 250)', card: 'rgb(255, 255, 255)', border: 'rgb(236, 230, 245)', strong: 'rgb(220, 212, 234)',
    input: 'rgb(143, 135, 165)', secondary: 'rgb(92, 83, 112)', accent: 'rgb(109, 40, 217)',
    selected: 'rgb(237, 229, 255)', accentBorder: 'rgb(196, 181, 253)', accentStrong: 'rgb(76, 29, 149)',
    accentSubtle: 'rgb(241, 235, 253)', accentText: 'rgb(91, 33, 182)', pin: 'rgb(217, 119, 6)'
  },
  dark: {
    app: 'rgb(18, 14, 27)', card: 'rgb(35, 28, 52)', border: 'rgb(53, 44, 76)', strong: 'rgb(65, 55, 90)',
    input: 'rgb(118, 108, 142)', secondary: 'rgb(188, 179, 208)', accent: 'rgb(132, 75, 242)',
    selected: 'rgb(56, 41, 106)', accentBorder: 'rgb(109, 79, 196)', accentStrong: 'rgb(221, 211, 254)',
    accentSubtle: 'rgb(47, 35, 80)', accentText: 'rgb(196, 181, 253)', pin: 'rgb(251, 191, 36)'
  }
} as const;

const categories: Category[] = [
  { id: 'writing', name: 'Rédaction', color: '#2563EB' },
  { id: 'code', name: 'Code', color: '#0F766E' }
];

const prompts: Prompt[] = Array.from({ length: 8 }, (_, index) =>
  createPromptSeed({
    id: `prompt-${String(index)}`,
    title: `Résumé de réunion ${String(index + 1)}`,
    content: 'Résume la transcription ci-dessous en 5 points clés, puis liste les décisions prises.',
    category: index % 2 === 0 ? 'Rédaction' : 'Code',
    pinned: index === 0,
    updatedAt: Date.now() - index * 1000
  })
);

type Surface = 'popup' | 'sidepanel';

const openLibrary = async (
  page: Page,
  storage: ExtensionStorage,
  extensionId: string,
  { theme, surface = 'popup', library = prompts }: { theme: 'light' | 'dark'; surface?: Surface; library?: Prompt[] }
) => {
  await seedLibrary(storage, { prompts: library, categories, settings: { theme } });
  await page.setViewportSize(surface === 'popup' ? { width: 400, height: 500 } : { width: 400, height: 800 });
  await page.goto(`chrome-extension://${extensionId}/src/${surface}.html`);
  await expect(page.getByTestId('prompt-card')).toHaveCount(library.length);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

const scrollList = (page: Page, to: 'top' | 'middle' | 'bottom') =>
  page.locator('main[data-scroll-container]').evaluate((list, position) => {
    list.scrollTo({ top: position === 'top' ? 0 : position === 'middle' ? 120 : list.scrollHeight, behavior: 'instant' });
  }, to);

test.describe('App shell and Library on the tokens', () => {
  for (const theme of ['light', 'dark'] as const) {
    const colors = EXPECTED[theme];

    test(`the header and tab bar lines show only where content scrolls under them (${theme})`, async ({ page, storage, extensionId }) => {
      await openLibrary(page, storage, extensionId, { theme });
      const header = page.getByRole('banner');
      const tabBar = page.getByRole('navigation', { name: 'Main navigation' });

      await expect(header).toHaveCSS('background-color', colors.app);
      await expect(tabBar).toHaveCSS('background-color', colors.app);

      // Top of the list: nothing under the header, cards hidden under the tab bar
      await expect(header).toHaveCSS('border-bottom-color', TRANSPARENT);
      await expect(tabBar).toHaveCSS('border-top-color', colors.strong);

      await scrollList(page, 'middle');
      await expect(header).toHaveCSS('border-bottom-color', colors.strong);
      await expect(tabBar).toHaveCSS('border-top-color', colors.strong);

      await scrollList(page, 'bottom');
      await expect(header).toHaveCSS('border-bottom-color', colors.strong);
      await expect(tabBar).toHaveCSS('border-top-color', TRANSPARENT);

      await scrollList(page, 'top');
      await expect(header).toHaveCSS('border-bottom-color', TRANSPARENT);
    });

    test(`the Add and Edit forms show the header line once they scroll (${theme})`, async ({ page, storage, extensionId }) => {
      await openLibrary(page, storage, extensionId, { theme, library: [{ ...prompts[0], content: 'Ligne\n'.repeat(40) }] });
      const header = page.getByRole('banner');

      for (const form of ['add', 'edit'] as const) {
        await page.getByRole('button', { name: form === 'add' ? 'Add new prompt' : `Edit ${prompts[0].title}` }).click();
        await expect(header).toHaveCSS('border-bottom-color', TRANSPARENT);

        await page.locator(`#${form}-prompt-form`).hover({ position: { x: 8, y: 8 } });
        await page.mouse.wheel(0, 300);
        await expect(header, `${form} form scrolled`).toHaveCSS('border-bottom-color', colors.strong);

        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.getByTestId('prompt-card')).toHaveCount(1);
      }
    });

    test(`a list that fits shows neither line (${theme})`, async ({ page, storage, extensionId }) => {
      await openLibrary(page, storage, extensionId, { theme, library: prompts.slice(0, 1) });

      await expect(page.getByRole('banner')).toHaveCSS('border-bottom-color', TRANSPARENT);
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCSS('border-top-color', TRANSPARENT);
    });

    test(`search, pills, tabs and cards take the ${theme} colors of the reference canvas`, async ({ page, storage, extensionId }) => {
      await openLibrary(page, storage, extensionId, { theme });

      await expect(page.getByRole('img', { name: 'My Prompt Manager icon' })).toHaveCSS('background-image', /linear-gradient/);
      await expect(page.getByTestId('new-prompt-button')).toHaveCSS('background-color', colors.accent);

      const search = page.getByRole('searchbox');
      await expect(search).toHaveCSS('background-color', colors.card);
      await expect(search).toHaveCSS('border-top-color', colors.input);

      const chosenPill = page.getByTestId('library-filter-all');
      await expect(chosenPill).toHaveCSS('background-color', colors.selected);
      await expect(chosenPill).toHaveCSS('border-top-color', colors.accentBorder);
      await expect(chosenPill).toHaveCSS('color', colors.accentStrong);
      const otherPill = page.getByTestId('library-filter-pinned');
      await expect(otherPill).toHaveCSS('background-color', colors.card);
      await expect(otherPill).toHaveCSS('border-top-color', colors.border);
      await expect(otherPill).toHaveCSS('color', colors.secondary);

      const activeTab = page.getByTestId('tab-library');
      await expect(activeTab).toHaveCSS('background-color', colors.selected);
      await expect(activeTab).toHaveCSS('color', colors.accentStrong);

      const card = page.getByTestId('prompt-card').first();
      await expect(card).toHaveCSS('background-color', colors.card);
      await expect(card).toHaveCSS('border-top-color', colors.border);
      await expect(card.getByRole('button', { name: /^Unpin / })).toHaveCSS('color', colors.pin);
      await expect(page.getByRole('button', { name: /^Pin / }).first()).toHaveCSS('color', colors.input);
      const copy = card.getByRole('button', { name: /^Copy content of / });
      await expect(copy).toHaveCSS('background-color', colors.accentSubtle);
      await expect(copy).toHaveCSS('color', colors.accentText);
    });

    for (const surface of ['popup', 'sidepanel'] as const) {
      test(`PROOF: ${surface} Library at the top and scrolled (${theme} mode)`, async ({ page, storage, extensionId }) => {
        const library = surface === 'popup' ? prompts : [...prompts, ...prompts.map(prompt => ({ ...prompt, id: `${prompt.id}-more`, pinned: false }))];
        await openLibrary(page, storage, extensionId, { theme, surface, library });

        await page.screenshot({ path: `${SCREENSHOT_DIR}/${surface}-top-${theme}.png` });
        await scrollList(page, 'middle');
        await expect(page.getByRole('banner')).toHaveCSS('border-bottom-color', colors.strong);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/${surface}-scrolled-${theme}.png` });
      });
    }

    // ViewHeader is shared: the other views get the seamless header before their own migration tickets
    test(`PROOF: the header of every other view (${theme} mode)`, async ({ page, storage, extensionId }) => {
      await openLibrary(page, storage, extensionId, { theme });

      for (const section of ['categories', 'analytics', 'settings'] as const) {
        await page.getByTestId(`tab-${section}`).click();
        await expect(page.getByRole('banner')).toHaveCSS('background-color', colors.app);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/header-${section}-${theme}.png` });
      }
      await page.getByTestId('tab-library').click();
      await page.getByTestId('new-prompt-button').click();
      await expect(page.getByRole('img', { name: /icon$/ })).toHaveCSS('background-color', colors.accentSubtle);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/header-add-${theme}.png` });
    });
  }
});
