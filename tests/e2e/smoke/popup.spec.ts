import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { seedLibrary, createPromptSeed } from '../utils/storage';

test.describe('Popup smoke test', () => {
  test('shows the prompt library empty state by default', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
    await expect(page.getByText(/create first prompt/i)).toBeVisible();
    await expect(page.getByPlaceholder('Search your prompts...')).toBeVisible();
  });
});

test.describe('Storage seeding', () => {
  test('renders prompts seeded into chrome.storage', async ({ page, storage }) => {
    const now = Date.now();

    await seedLibrary(storage, {
      prompts: [
        createPromptSeed({
          id: 'seed-1',
          title: 'Hydration reminder',
          content: 'Drink water before each meeting.',
          category: DEFAULT_CATEGORY,
          createdAt: now,
          updatedAt: now,
        }),
      ],
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'popup',
      },
    });

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Hydration reminder' })).toBeVisible();
    await expect(page.getByText(/1 prompt/i)).toBeVisible();

    const prompts = await storage.getPrompts();
    expect(prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'seed-1',
          title: 'Hydration reminder',
        }),
      ])
    );
  });
});

test.describe('Prompt creation flow', () => {
  test('allows creating a prompt through the popup UI', async ({ page, storage }) => {
    await seedLibrary(storage, {
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'popup',
        defaultCategory: DEFAULT_CATEGORY,
      },
      interfaceMode: 'popup',
    });

    await page.reload();

    const createFirstPrompt = page.getByRole('button', { name: /create first prompt/i });
    const addPrompt = page.getByRole('button', { name: 'Add new prompt' });
    const promptCreationTrigger = createFirstPrompt.or(addPrompt);

    await expect(promptCreationTrigger).toBeVisible();
    await promptCreationTrigger.click();

    await expect(page.getByRole('heading', { name: 'Add New Prompt' })).toBeVisible();

    await page.getByLabel('Title (optional)').fill('Focus Mode Kickoff');
    await page.getByLabel('Content *').fill('Take three deep breaths and outline the top task.');

    const savePromptButton = page.getByRole('button', { name: 'Save Prompt' });
    await expect(savePromptButton).toBeEnabled();
    await savePromptButton.click();

    await expect(page.getByText('Prompt created successfully')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Focus Mode Kickoff' })).toBeVisible();

    const prompts = await storage.getPrompts();
    expect(prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Focus Mode Kickoff',
          content: 'Take three deep breaths and outline the top task.',
          category: DEFAULT_CATEGORY,
        }),
      ])
    );
  });
});

test.describe('Prompt management', () => {
  test('allows editing an existing prompt', async ({ page, storage }) => {
    const originalPrompt = createPromptSeed({
      id: 'prompt-edit-1',
      title: 'Morning checklist',
      content: 'Review calendar and prioritize tasks.',
      category: DEFAULT_CATEGORY,
    });

    await seedLibrary(storage, {
      prompts: [originalPrompt],
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'popup',
      },
      interfaceMode: 'popup',
    });

    await page.reload();

    await expect(page.getByRole('heading', { name: originalPrompt.title })).toBeVisible();

    await page.getByRole('button', { name: `More actions for ${originalPrompt.title}` }).click();
    await page.getByRole('menuitem', { name: `Edit ${originalPrompt.title}` }).click();

    await expect(page.getByRole('heading', { name: 'Edit Prompt' })).toBeVisible();

    await page.getByLabel('Title').fill('Focus Mode Kickoff');
    await page.getByLabel('Content *').fill('Take three deep breaths and outline the top task.');

    const saveButton = page.getByRole('button', { name: 'Save Changes' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(page.getByText('Prompt updated successfully')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Focus Mode Kickoff' })).toBeVisible();

    const prompts = await storage.getPrompts();
    expect(prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: originalPrompt.id,
          title: 'Focus Mode Kickoff',
          content: 'Take three deep breaths and outline the top task.',
          category: DEFAULT_CATEGORY,
        }),
      ])
    );
  });

  test('allows deleting a prompt via the actions menu', async ({ page, storage }) => {
    const promptToDelete = createPromptSeed({
      id: 'prompt-delete-1',
      title: 'Temporary note',
      content: 'This should be removed during the test.',
    });

    await seedLibrary(storage, {
      prompts: [promptToDelete],
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'popup',
      },
    });

    await page.reload();

    await expect(page.getByRole('heading', { name: promptToDelete.title })).toBeVisible();

    await page.getByRole('button', { name: `More actions for ${promptToDelete.title}` }).click();
    await page.getByRole('menuitem', { name: `Delete ${promptToDelete.title}` }).click();

    const confirmDialog = page.getByRole('dialog', { name: 'Delete Prompt' });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('Prompt deleted successfully')).toBeVisible();
    await expect(page.getByRole('heading', { name: promptToDelete.title })).toHaveCount(0);

    const prompts = await storage.getPrompts();
    expect(prompts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: promptToDelete.id }),
      ])
    );
  });
});

test.describe('Settings', () => {
  test('persists interface mode changes', async ({ page, storage }) => {
    await seedLibrary(storage, {
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'popup',
      },
    });

    await page.reload();

    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    const sidePanelOption = page.getByRole('radio', { name: 'Select side panel mode' });
    await sidePanelOption.click();

    await expect(sidePanelOption).toHaveAttribute('aria-checked', 'true');

    await expect.poll(async () => {
      const result = await storage.get<{ interfaceMode?: string }>('interfaceMode');
      return result.interfaceMode;
    }).toBe('sidepanel');
  });

  test('persists theme selection changes', async ({ page, storage }) => {
    await seedLibrary(storage, {
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'popup',
      },
    });

    await page.reload();

    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    const lightButton = page.getByRole('button', { name: 'Light' });
    await lightButton.click();

    await expect.poll(async () => {
      const snapshot = await storage.get<{ settings?: { theme?: string } }>('settings');
      return snapshot.settings?.theme;
    }).toBe('light');
  });

  test('keeps previous theme when storage update fails', async ({ page, storage }) => {
    await seedLibrary(storage, {
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'popup',
      },
    });

    await page.reload();

    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await page.evaluate(() => {
      const originalSet = chrome.storage.local.set.bind(chrome.storage.local);
      chrome.storage.local.set = (items, callback) => {
        if (items && typeof items === 'object' && 'settings' in items) {
          const descriptor = Object.getOwnPropertyDescriptor(chrome.runtime, 'lastError');
          Object.defineProperty(chrome.runtime, 'lastError', {
            configurable: true,
            value: { message: 'Simulated storage failure' }
          });
          callback?.();
          if (descriptor) {
            Object.defineProperty(chrome.runtime, 'lastError', descriptor);
          } else {
            delete (chrome.runtime as Record<string, unknown>).lastError;
          }
          chrome.storage.local.set = originalSet;
          return;
        }

        originalSet(items, callback);
      };
    });

    await page.getByRole('button', { name: 'Light' }).click();

    await expect.poll(async () => {
      const snapshot = await storage.get<{ settings?: { theme?: string } }>('settings');
      return snapshot.settings?.theme;
    }).toBe('system');

    const systemButton = page.getByRole('button', { name: 'System' });
    await expect(systemButton).toHaveAttribute('class', expect.stringContaining('border-purple-500'));
  });
});
