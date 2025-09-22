import { test as base } from '@playwright/test';

import { DEFAULT_SETTINGS } from '../../../src/types';
import { withExtensionFixtures } from '../fixtures/extension';
import { seedLibrary } from '../utils/storage';

const test = withExtensionFixtures(base);
const expect = test.expect;

test.describe('Element picker integration', () => {
  test('displays selected element after picker flow completes', async ({ context, page, storage, extensionId }) => {
    await seedLibrary(storage, {
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'sidepanel',
      },
      interfaceMode: 'sidepanel',
    });

    const background = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));

    await page.reload();

    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await page.evaluate(() => {
      const originalSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
      chrome.runtime.sendMessage = (message, responseCallback) => {
        if (message && typeof message === 'object' && (message as { type?: string }).type === 'START_ELEMENT_PICKER') {
          responseCallback?.({ success: true });
          return;
        }

        return originalSendMessage(
          message as Parameters<typeof chrome.runtime.sendMessage>[0],
          responseCallback as Parameters<typeof chrome.runtime.sendMessage>[1]
        );
      };
    });

    await page.getByRole('button', { name: 'Add Your First Site' }).click();
    await page.getByRole('button', { name: 'Add manually' }).click();

    await page.getByLabel('Website URL').fill('https://claude.ai/qa');

    const pickElementButton = page.getByRole('button', { name: 'Pick Element' });
    await pickElementButton.scrollIntoViewIfNeeded();
    await pickElementButton.click();

    await background.evaluate(() => {
      chrome.runtime.sendMessage({
        type: 'ELEMENT_PICKER_RESULT',
        data: {
          selector: 'body',
          elementType: 'BODY',
          hostname: 'claude.ai',
        },
      });
    });

    await expect(page.getByText('Selected Element')).toBeVisible();
    await expect(page.getByText(/body/i)).toBeVisible();
  });
});
