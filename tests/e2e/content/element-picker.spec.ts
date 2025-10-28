import type { BrowserContext, Worker } from '@playwright/test';

import { DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { seedLibrary } from '../utils/storage';

const resolveBackgroundWorker = async (context: BrowserContext): Promise<Worker> => {
  const [existingWorker] = context.serviceWorkers();
  if (existingWorker) {
    return existingWorker;
  }

  return context.waitForEvent('serviceworker', {
    predicate: (candidate) => candidate.url().startsWith('chrome-extension://'),
  });
};

test.describe('Element picker integration', () => {
  test('displays selected element after picker flow completes', async ({ context, page, storage }) => {
    await seedLibrary(storage, {
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'sidepanel',
      },
      interfaceMode: 'sidepanel',
    });

    const background = await resolveBackgroundWorker(context);

    await page.reload();

    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await page.evaluate(() => {
      const originalTabsQuery = chrome.tabs.query.bind(chrome.tabs);
      const originalTabsGet = chrome.tabs.get.bind(chrome.tabs);
      const originalTabsSendMessage = chrome.tabs.sendMessage.bind(chrome.tabs);
      const originalTabsUpdate = chrome.tabs.update.bind(chrome.tabs);
      const originalWindowsUpdate = chrome.windows.update.bind(chrome.windows);

      // Mock chrome.tabs.query to return a fake web tab for element picker
      chrome.tabs.query = (queryInfo) => {
        // For active tab queries, return a fake web page tab
        if (queryInfo.active && queryInfo.currentWindow) {
          return Promise.resolve([
            {
              id: 123,
              url: 'https://claude.ai/qa',
              title: 'Claude QA',
              active: true,
              windowId: 1,
              status: 'complete'
            } as chrome.tabs.Tab
          ]);
        }
        return originalTabsQuery(queryInfo);
      };

      // Mock chrome.tabs.get to return the fake tab
      chrome.tabs.get = (tabId) => {
        if (tabId === 123) {
          return Promise.resolve({
            id: 123,
            url: 'https://claude.ai/qa',
            title: 'Claude QA',
            active: true,
            windowId: 1,
            status: 'complete'
          } as chrome.tabs.Tab);
        }
        return originalTabsGet(tabId);
      };

      // Mock chrome.tabs.sendMessage to simulate successful message sending to content script
      chrome.tabs.sendMessage = (tabId, message, responseCallback) => {
        if (tabId === 123) {
          // Simulate successful message delivery
          if (responseCallback) {
            responseCallback({ success: true });
          }
          return Promise.resolve({ success: true });
        }
        return originalTabsSendMessage(tabId, message, responseCallback);
      };

      // Mock chrome.tabs.update to simulate tab activation
      chrome.tabs.update = (tabId, updateProperties) => {
        if (tabId === 123) {
          return Promise.resolve({
            id: 123,
            url: 'https://claude.ai/qa',
            title: 'Claude QA',
            active: true,
            windowId: 1,
            status: 'complete'
          } as chrome.tabs.Tab);
        }
        return originalTabsUpdate(tabId, updateProperties);
      };

      // Mock chrome.windows.update to simulate window focus
      chrome.windows.update = (windowId, updateInfo) => {
        if (windowId === 1) {
          return Promise.resolve({ id: 1, focused: true } as chrome.windows.Window);
        }
        return originalWindowsUpdate(windowId, updateInfo);
      };

      // Mock chrome.permissions methods to bypass permission checks
      chrome.permissions.request = () => Promise.resolve(true);
      chrome.permissions.contains = () => Promise.resolve(true);
    });

    await page.getByRole('button', { name: 'Add Your First Site' }).click();
    await page.getByRole('button', { name: /Manual Configuration/i }).click();

    await page.getByLabel('Website URL').fill('https://claude.ai/qa');

    const pickElementButton = page.getByRole('button', { name: 'Pick Element' });
    await pickElementButton.scrollIntoViewIfNeeded();
    await pickElementButton.click();

    // Wait for the picker to start (button should show "Picking...")
    await expect(page.getByRole('button', { name: 'Picking...' })).toBeVisible();

    // Simulate element picker result - send message directly to the page context
    // This simulates what would happen when the content script sends ELEMENT_SELECTED to background,
    // and background broadcasts ELEMENT_PICKER_RESULT to all listeners
    await page.evaluate(() => {
      // Trigger the message listener directly in the page context
      chrome.runtime.onMessage.dispatch({
        type: 'ELEMENT_PICKER_RESULT',
        data: {
          selector: 'body',
          elementType: 'BODY',
          hostname: 'claude.ai',
        },
      });
    });

    // Wait for the selector value to be populated (indicates message was received)
    // The positioning options should appear after the element picker result is processed
    await expect(page.getByLabel('Placement')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('combobox', { name: 'Placement' })).toBeVisible();
  });
});
