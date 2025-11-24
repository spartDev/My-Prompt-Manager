import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

import { ThemeProvider } from '../../contexts/ThemeContext';
import { getChromeMockFunctions, getMockStorageManager } from '../../test/mocks';
import { DEFAULT_SETTINGS, type Prompt, type Category } from '../../types';
import SettingsView from '../SettingsView';

const createJsonFile = (contents: string): File => {
  const file = new File([contents], 'backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    value: () => Promise.resolve(contents),
    configurable: true
  });
  return file;
};

const renderSettings = async () => {
  const mockToastSettings = {
    position: 'top-right' as const,
    enabledTypes: {
      success: true,
      error: true,
      info: true,
      warning: true
    },
    enableGrouping: true,
    groupingWindow: 500
  };

  render(
    <ThemeProvider>
      <SettingsView
        onBack={vi.fn()}
        showToast={vi.fn()}
        toastSettings={mockToastSettings}
        onToastSettingsChange={vi.fn()}
      />
    </ThemeProvider>
  );

  await screen.findByRole('heading', { name: /settings/i });
};

// Helper to find the reset call among multiple storage.local.set calls
const findResetCall = (calls: Array<any>) =>
  calls.find(call =>
    call[0]?.promptLibrarySettings?.enabledSites &&
    call[0]?.interfaceMode
  );

// Helper to assert that a priority group contains all expected sites
const assertPriorityGroup = (sites: string[], group: string[]) => {
  group.forEach(site => expect(sites).toContain(site));
};

describe('SettingsView', () => {
  beforeEach(() => {
    // Ensure window.alert exists for spying
    window.alert = vi.fn();

    const chromeMock = getChromeMockFunctions();
    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      promptLibrarySettings: {
        enabledSites: ['chatgpt.com'],
        customSites: []
      },
      interfaceMode: 'popup',
      settings: DEFAULT_SETTINGS
    });
    (chromeMock.storage.local.set as Mock).mockResolvedValue(undefined);
    (chromeMock.storage.local.clear as Mock).mockResolvedValue(undefined);
    (chromeMock.tabs.query as Mock).mockResolvedValue([]);
    const storageMock = getMockStorageManager();
    storageMock.getPrompts.mockResolvedValue([]);
    storageMock.getCategories.mockResolvedValue([]);
  });

  it('imports prompts and categories from a valid backup', async () => {
    const storageMock = getMockStorageManager();
    const chromeMock = getChromeMockFunctions();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
      expect(storageMock.getCategories).toHaveBeenCalled();
    });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();

    const prompts: Prompt[] = [
      { id: 'p1', title: 'Greeting', content: 'Hello', category: 'Uncategorized', createdAt: 1, updatedAt: 1 }
    ];
    const categories: Category[] = [{ id: 'c1', name: 'Custom' }];
    const backupContents = JSON.stringify({ prompts, categories, version: '1.0' });
    const file = createJsonFile(backupContents);

    await userEvent.upload(fileInput as HTMLInputElement, file);

    await waitFor(() => {
      expect(storageMock.importCategory).toHaveBeenCalledWith(categories[0]);
      expect(storageMock.importPrompt).toHaveBeenCalledWith(prompts[0]);
    });

    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/successfully imported/i));
    expect((chromeMock.storage.local.get as Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
    alertSpy.mockRestore();
  });

  it('alerts when import JSON is invalid', async () => {
    const storageMock = getMockStorageManager();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
      expect(storageMock.getCategories).toHaveBeenCalled();
    });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    const badFile = createJsonFile('not-json');

    await userEvent.upload(fileInput as HTMLInputElement, badFile);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/invalid json/i));
    });
    expect(storageMock.importPrompt).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('resets settings to defaults after confirmation', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      promptLibrarySettings: { enabledSites: [], customSites: [] },
      interfaceMode: 'sidepanel',
      settings: {
        ...DEFAULT_SETTINGS,
        theme: 'dark',
        sortOrder: 'createdAt',
        defaultCategory: 'Work'
      }
    });

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
      expect(storageMock.getCategories).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(chromeMock.storage.local.get as Mock).toHaveBeenCalled();
    });

    const aboutToggle = await screen.findByRole('button', { name: /about & reset/i });
    await userEvent.click(aboutToggle);

    // After expanding, find the reset button directly
    const resetButton = await screen.findByRole('button', { name: /reset to defaults/i });
    await userEvent.click(resetButton);

    const confirmButton = await screen.findByRole('button', { name: /yes, reset settings/i });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(chromeMock.storage.local.set).toHaveBeenCalled();
    });

    // The component makes multiple chrome.storage.local.set calls during its lifecycle.
    // Use helper to find the reset call with the specific signature.
    const calls = (chromeMock.storage.local.set as Mock).mock.calls;
    const resetCall = findResetCall(calls);

    expect(resetCall).toBeDefined();
    // TypeScript doesn't narrow types after toBeDefined(), so we assert the type
    const { promptLibrarySettings, interfaceMode } = (resetCall as typeof calls[0])[0];

    // Verify enabledSites contains all default platforms sorted by priority
    // Claude (100), ChatGPT (90), Mistral (85), Gemini (85), Perplexity (80), Copilot (80), M365Copilot (80)
    expect(promptLibrarySettings.enabledSites).toHaveLength(7);

    // Priority groups (equal priorities may have non-deterministic order)
    expect(promptLibrarySettings.enabledSites[0]).toBe('claude.ai'); // Priority 100
    expect(promptLibrarySettings.enabledSites[1]).toBe('chatgpt.com'); // Priority 90

    // Use helper to assert priority groups contain expected sites
    const p85 = promptLibrarySettings.enabledSites.slice(2, 4); // Priority 85
    assertPriorityGroup(p85, ['chat.mistral.ai', 'gemini.google.com']);

    const p80 = promptLibrarySettings.enabledSites.slice(4, 7); // Priority 80
    assertPriorityGroup(p80, ['www.perplexity.ai', 'copilot.microsoft.com', 'm365.cloud.microsoft']);

    // Verify other reset values
    expect(promptLibrarySettings.customSites).toEqual([]);
    expect(promptLibrarySettings.debugMode).toBe(false);
    expect(promptLibrarySettings.floatingFallback).toBe(true);
    expect(interfaceMode).toBe('popup');

    expect(storageMock.updateSettings).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      theme: 'system',
      sortOrder: 'updatedAt',
      defaultCategory: 'Uncategorized'
    });

    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/reset to defaults/i));
    alertSpy.mockRestore();
  });

  it('changes the interface mode when a different option is selected', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();
    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    const sidePanelOption = await screen.findByRole('radio', { name: /select side panel mode/i });
    await userEvent.click(sidePanelOption);

    await waitFor(() => {
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ interfaceMode: 'sidepanel' });
    });
  });

  describe('Parallel Import Performance', () => {
    it('imports multiple categories in parallel', async () => {
      const storageMock = getMockStorageManager();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // Track call order to ensure parallelism
      const callOrder: string[] = [];
      (storageMock.importCategory as Mock).mockImplementation(async (category: Category) => {
        callOrder.push(`category-${category.id}-start`);
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async work
        callOrder.push(`category-${category.id}-end`);
        return category;
      });

      await renderSettings();
      await waitFor(() => {
        expect(storageMock.getPrompts).toHaveBeenCalled();
      });

      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      expect(fileInput).not.toBeNull();

      const categories: Category[] = [
        { id: 'c1', name: 'Category 1' },
        { id: 'c2', name: 'Category 2' },
        { id: 'c3', name: 'Category 3' }
      ];
      const prompts: Prompt[] = [
        { id: 'p1', title: 'Test Prompt', content: 'Test Content', category: 'Category 1', createdAt: 1, updatedAt: 1 }
      ];
      const backupContents = JSON.stringify({ prompts, categories, version: '1.0' });
      const file = createJsonFile(backupContents);

      await userEvent.upload(fileInput as HTMLInputElement, file);

      await waitFor(() => {
        expect(storageMock.importCategory).toHaveBeenCalledTimes(3);
        expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/successfully imported/i));
      });

      // Verify parallel execution: all starts should happen before any ends
      const firstEndIndex = callOrder.findIndex(c => c.endsWith('-end'));
      const startsBeforeFirstEnd = callOrder.slice(0, firstEndIndex).filter(c => c.endsWith('-start')).length;

      // If truly parallel, multiple starts should occur before first end
      expect(startsBeforeFirstEnd).toBeGreaterThan(1);
      alertSpy.mockRestore();
    });

    it('imports multiple prompts in parallel', async () => {
      const storageMock = getMockStorageManager();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // Track call order
      const callOrder: string[] = [];
      (storageMock.importPrompt as Mock).mockImplementation(async (prompt: Prompt) => {
        callOrder.push(`prompt-${prompt.id}-start`);
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async work
        callOrder.push(`prompt-${prompt.id}-end`);
        return prompt;
      });

      await renderSettings();
      await waitFor(() => {
        expect(storageMock.getPrompts).toHaveBeenCalled();
      });

      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      expect(fileInput).not.toBeNull();

      const categories: Category[] = [{ id: 'c1', name: 'Uncategorized' }];
      const prompts: Prompt[] = [
        { id: 'p1', title: 'Prompt 1', content: 'Content 1', category: 'Uncategorized', createdAt: 1, updatedAt: 1 },
        { id: 'p2', title: 'Prompt 2', content: 'Content 2', category: 'Uncategorized', createdAt: 1, updatedAt: 1 },
        { id: 'p3', title: 'Prompt 3', content: 'Content 3', category: 'Uncategorized', createdAt: 1, updatedAt: 1 }
      ];
      const backupContents = JSON.stringify({ prompts, categories, version: '1.0' });
      const file = createJsonFile(backupContents);

      await userEvent.upload(fileInput as HTMLInputElement, file);

      await waitFor(() => {
        expect(storageMock.importPrompt).toHaveBeenCalledTimes(3);
        expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/successfully imported/i));
      });

      // Verify parallel execution
      const firstEndIndex = callOrder.findIndex(c => c.endsWith('-end'));
      const startsBeforeFirstEnd = callOrder.slice(0, firstEndIndex).filter(c => c.endsWith('-start')).length;

      expect(startsBeforeFirstEnd).toBeGreaterThan(1);
      alertSpy.mockRestore();
    });

    it('handles partial category import failures correctly', async () => {
      const storageMock = getMockStorageManager();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // Make second category fail
      (storageMock.importCategory as Mock).mockImplementation(async (category: Category) => {
        if (category.id === 'c2') {
          throw new Error('Duplicate category name');
        }
        return category;
      });

      await renderSettings();
      await waitFor(() => {
        expect(storageMock.getPrompts).toHaveBeenCalled();
      });

      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      expect(fileInput).not.toBeNull();

      const categories: Category[] = [
        { id: 'c1', name: 'Category 1' },
        { id: 'c2', name: 'Category 2' },
        { id: 'c3', name: 'Category 3' }
      ];
      const prompts: Prompt[] = [];
      const backupContents = JSON.stringify({ prompts, categories, version: '1.0' });
      const file = createJsonFile(backupContents);

      await userEvent.upload(fileInput as HTMLInputElement, file);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringMatching(/failed to import.*1 of 3 categories/i)
        );
      });

      // Prompts should not be imported if categories failed
      expect(storageMock.importPrompt).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('handles partial prompt import failures correctly', async () => {
      const storageMock = getMockStorageManager();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // Make second prompt fail (by ID, not by call count)
      (storageMock.importPrompt as Mock).mockImplementation(async (prompt: Prompt) => {
        if (prompt.id === 'p2') {
          throw new Error('Quota exceeded');
        }
        return prompt;
      });

      await renderSettings();
      await waitFor(() => {
        expect(storageMock.getPrompts).toHaveBeenCalled();
      });

      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      expect(fileInput).not.toBeNull();

      const categories: Category[] = [{ id: 'c1', name: 'Uncategorized' }];
      const prompts: Prompt[] = [
        { id: 'p1', title: 'Prompt 1', content: 'Content 1', category: 'Uncategorized', createdAt: 1, updatedAt: 1 },
        { id: 'p2', title: 'Prompt 2', content: 'Content 2', category: 'Uncategorized', createdAt: 1, updatedAt: 1 },
        { id: 'p3', title: 'Prompt 3', content: 'Content 3', category: 'Uncategorized', createdAt: 1, updatedAt: 1 }
      ];
      const backupContents = JSON.stringify({ prompts, categories, version: '1.0' });
      const file = createJsonFile(backupContents);

      await userEvent.upload(fileInput as HTMLInputElement, file);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringMatching(/failed to import.*1 of 3 prompts.*2 succeeded/i)
        );
      });

      alertSpy.mockRestore();
    });
  });
});
