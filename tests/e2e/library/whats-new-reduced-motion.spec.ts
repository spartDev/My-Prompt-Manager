/**
 * What's new under prefers-reduced-motion, in the real extension (My-Prompt-Manager-d1g.8): the
 * sheet, its backdrop and every tile last 1ms and the tiles rise together, with no cascade; a
 * number key then closes it at once and opens its tile's destination. It runs on the copy of the
 * build at 2.0.0 (fixtures/whats-new-build.ts), opened as after the update of an existing user from
 * 1.9.0; the full coverage is tests/e2e/whats-new.spec.ts (My-Prompt-Manager-d1g.10).
 */

import { WELCOME_KEY } from '../../../src/welcome/storage';
import { WHATS_NEW_KEY } from '../../../src/whatsNew/storage';
import { expect, test } from '../fixtures/extension';
import { WHATS_NEW_UPDATE_EXTENSION_PATH } from '../fixtures/whats-new-build';
import { createPromptSeed, seedLibrary } from '../utils/storage';

test.describe("What's new under reduced motion", () => {
  test.use({ extensionPath: WHATS_NEW_UPDATE_EXTENSION_PATH });

  test('every What\'s new animation is near instant and the tiles do not cascade; a number key opens its tile', async ({ page, storage, extensionId }) => {
    await seedLibrary(storage, { prompts: [createPromptSeed({ id: 'p1', title: 'Draft email', content: 'Hello' })] });
    await storage.seed({ [WHATS_NEW_KEY]: { installedVersion: '1.9.0' }, [WELCOME_KEY]: { status: 'done' } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 400, height: 600 });
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);

    const sheet = page.getByRole('dialog', { name: /what.s new/i });
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveCSS('animation-duration', '0.001s');
    await expect(page.getByTestId('whats-new-backdrop')).toHaveCSS('animation-duration', '0.001s');

    const tiles = sheet.locator('[data-whats-new-tile]');
    expect(await tiles.count()).toBeGreaterThan(1);
    for (const tile of await tiles.all()) {
      await expect(tile).toHaveCSS('animation-duration', '0.001s');
      await expect(tile).toHaveCSS('animation-delay', '0s');
    }
    await expect(page.getByRole('button', { name: 'Got it' })).toBeFocused();

    // Tile 2 of the 2.0.0 notes: Search with ⌘K, the Library with the keyboard in its search field
    await page.keyboard.press('2');
    await expect(sheet).toHaveCount(0);
    await expect(page.getByRole('searchbox', { name: 'Search prompts' })).toBeFocused();
  });
});
