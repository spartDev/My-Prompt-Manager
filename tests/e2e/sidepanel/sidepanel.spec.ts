import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { seedLibrary, createPromptSeed } from '../utils/storage';

test.describe('Side panel experience', () => {
  test('renders stored prompts in sidepanel context', async ({ context, storage, extensionId }) => {
    const prompt = createPromptSeed({
      id: 'sidepanel-prompt-1',
      title: 'Sidepanel Focus Routine',
      content: 'Outline top task and enable focus mode.',
      category: DEFAULT_CATEGORY,
    });

    await seedLibrary(storage, {
      prompts: [prompt],
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'sidepanel',
      },
      interfaceMode: 'sidepanel',
    });

    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

    await expect(sidepanelPage.locator('.sidepanel')).toBeVisible();
    await expect(sidepanelPage.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
    await expect(sidepanelPage.getByRole('heading', { name: prompt.title })).toBeVisible();
    await expect(sidepanelPage.getByRole('button', { name: 'Add new prompt' })).toBeVisible();
  });

  test('persists interface mode toggle changes from settings menu', async ({ context, storage, extensionId }) => {
    await seedLibrary(storage, {
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'sidepanel',
      },
      interfaceMode: 'sidepanel',
    });

    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

    await sidepanelPage.getByRole('button', { name: 'Settings' }).click();
    const popupRadio = sidepanelPage.getByRole('radio', { name: 'Select popup window mode' });
    await popupRadio.click();

    await expect(popupRadio).toHaveAttribute('aria-checked', 'true');

    const storageSnapshot = await context.serviceWorkers()[0].evaluate(() => new Promise((resolve) => {
      chrome.storage.local.get('interfaceMode', resolve);
    }));

    expect(storageSnapshot.interfaceMode).toBe('popup');
  });

  test('persists theme selection changes from settings menu', async ({ context, storage, extensionId }) => {
    await seedLibrary(storage, {
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'sidepanel',
      },
      interfaceMode: 'sidepanel',
    });

    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

    await sidepanelPage.getByRole('button', { name: 'Settings' }).click();
    const lightThemeButton = sidepanelPage.getByRole('button', { name: 'Light' });
    await lightThemeButton.click();

    // Wait for the async storage operation to complete by checking for the visual indicator
    // The theme button shows a checkmark when selected, indicating the update is complete
    await sidepanelPage.waitForTimeout(200);

    const storageSnapshot = await context.serviceWorkers()[0].evaluate(() => new Promise((resolve) => {
      chrome.storage.local.get('settings', resolve);
    }));

    expect(storageSnapshot.settings?.theme).toBe('light');
  });
});
