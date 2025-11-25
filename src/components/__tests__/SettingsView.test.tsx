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

    it('should not import prompts if category import fails', async () => {
      const storageMock = getMockStorageManager();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      (storageMock.importCategory as Mock).mockRejectedValue(
        new Error('Category import failed')
      );

      await renderSettings();
      await waitFor(() => {
        expect(storageMock.getPrompts).toHaveBeenCalled();
      });

      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      expect(fileInput).not.toBeNull();

      const categories: Category[] = [{ id: 'c1', name: 'Category 1' }];
      const prompts: Prompt[] = [
        { id: 'p1', title: 'Test Prompt', content: 'Test Content', category: 'Category 1', createdAt: 1, updatedAt: 1 }
      ];
      const backupContents = JSON.stringify({ prompts, categories, version: '1.0' });
      const file = createJsonFile(backupContents);

      await userEvent.upload(fileInput as HTMLInputElement, file);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringMatching(/failed to import.*categories/i)
        );
      });

      // Critical: prompts should NOT be imported if categories fail
      expect(storageMock.importPrompt).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });

  describe('Debounced Settings Persistence', () => {
    describe('Flush-on-unmount behavior', () => {
      it('flushes pending changes for debounced settings on unmount', async () => {
        const chromeMock = getChromeMockFunctions();
        const storageMock = getMockStorageManager();

        const { unmount } = render(
          <ThemeProvider>
            <SettingsView
              onBack={vi.fn()}
              showToast={vi.fn()}
              toastSettings={{
                position: 'top-right',
                enabledTypes: { success: true, error: true, info: true, warning: true },
                enableGrouping: true,
                groupingWindow: 500
              }}
              onToastSettingsChange={vi.fn()}
            />
          </ThemeProvider>
        );

        // Wait for initial load
        await waitFor(() => {
          expect(storageMock.getPrompts).toHaveBeenCalled();
        });

        const initialCallCount = (chromeMock.storage.local.set as Mock).mock.calls.length;

        // Expand Advanced section
        const advancedToggle = await screen.findByRole('button', { name: /advanced/i });
        await userEvent.click(advancedToggle);

        // Toggle debug mode (triggers debounced save)
        const debugToggle = await screen.findByRole('switch', { name: /debug mode/i });
        await userEvent.click(debugToggle);

        // Unmount IMMEDIATELY (before 150ms debounce expires) - should flush pending changes
        unmount();

        // Wait for flush operation to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify that flush occurred
        const calls = (chromeMock.storage.local.set as Mock).mock.calls;
        expect(calls.length).toBeGreaterThanOrEqual(initialCallCount + 1);

        // Verify the flushed data contains debug mode change
        const lastCall = calls[calls.length - 1][0];
        expect(lastCall.promptLibrarySettings.debugMode).toBe(true);
      });

      it('does not flush again if debounced save already completed', async () => {
        const chromeMock = getChromeMockFunctions();
        const storageMock = getMockStorageManager();

        // Setup initial state with custom site
        (chromeMock.storage.local.get as Mock).mockResolvedValue({
          promptLibrarySettings: {
            enabledSites: ['chatgpt.com'],
            customSites: [{
              hostname: 'example.com',
              displayName: 'Example',
              enabled: true,
              dateAdded: Date.now()
            }],
            debugMode: false,
            floatingFallback: true
          },
          interfaceMode: 'popup',
          settings: DEFAULT_SETTINGS
        });

        const { unmount } = render(
          <ThemeProvider>
            <SettingsView
              onBack={vi.fn()}
              showToast={vi.fn()}
              toastSettings={{
                position: 'top-right',
                enabledTypes: { success: true, error: true, info: true, warning: true },
                enableGrouping: true,
                groupingWindow: 500
              }}
              onToastSettingsChange={vi.fn()}
            />
          </ThemeProvider>
        );

        // Wait for initial load
        await waitFor(() => {
          expect(storageMock.getPrompts).toHaveBeenCalled();
        });

        // Wait for any initial debounced saves to complete
        await new Promise(resolve => setTimeout(resolve, 200));

        const initialCallCount = (chromeMock.storage.local.set as Mock).mock.calls.length;

        // Toggle custom site OFF (triggers debounced save)
        const customSiteToggle = await screen.findByRole('switch', { name: /example/i });
        await userEvent.click(customSiteToggle);

        // Wait for debounce to complete (200ms - longer than 150ms debounce)
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify debounced save occurred
        await waitFor(() => {
          expect((chromeMock.storage.local.set as Mock).mock.calls.length).toBe(initialCallCount + 1);
        });

        const callCountAfterSave = (chromeMock.storage.local.set as Mock).mock.calls.length;

        // Verify the save contains correct data
        const saveCall = (chromeMock.storage.local.set as Mock).mock.calls[callCountAfterSave - 1][0];
        expect(saveCall.promptLibrarySettings.customSites[0].enabled).toBe(false);

        // Unmount component - should NOT save again (hasPendingChanges is false)
        unmount();

        // Wait to ensure no additional save
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify no additional save occurred
        expect((chromeMock.storage.local.set as Mock).mock.calls.length).toBe(callCountAfterSave);
      });

      it('persists debug mode toggle on immediate navigation', async () => {
        const chromeMock = getChromeMockFunctions();
        const storageMock = getMockStorageManager();

        const { unmount } = render(
          <ThemeProvider>
            <SettingsView
              onBack={vi.fn()}
              showToast={vi.fn()}
              toastSettings={{
                position: 'top-right',
                enabledTypes: { success: true, error: true, info: true, warning: true },
                enableGrouping: true,
                groupingWindow: 500
              }}
              onToastSettingsChange={vi.fn()}
            />
          </ThemeProvider>
        );

        // Wait for initial load
        await waitFor(() => {
          expect(storageMock.getPrompts).toHaveBeenCalled();
        });

        const initialCallCount = (chromeMock.storage.local.set as Mock).mock.calls.length;

        // Expand Advanced section
        const advancedToggle = await screen.findByRole('button', { name: /advanced/i });
        await userEvent.click(advancedToggle);

        // Toggle debug mode ON
        const debugToggle = await screen.findByRole('switch', { name: /debug mode/i });
        await userEvent.click(debugToggle);

        // Immediate navigation (10ms - well before 150ms debounce expires)
        await new Promise(resolve => setTimeout(resolve, 10));
        unmount();

        // Verify flush occurred
        await waitFor(() => {
          const calls = (chromeMock.storage.local.set as Mock).mock.calls;
          expect(calls.length).toBeGreaterThanOrEqual(initialCallCount + 1);

          // Verify Chrome storage contains debug mode change
          const lastCall = calls[calls.length - 1][0];
          expect(lastCall.promptLibrarySettings.debugMode).toBe(true);
        });

        // Verify localStorage was also updated
        expect(localStorage.getItem('prompt-library-debug')).toBe('true');
      });
    });

    describe('Debounce timing', () => {
      it('persists debug mode changes after 150ms debounce window', async () => {
        const chromeMock = getChromeMockFunctions();
        const storageMock = getMockStorageManager();

        render(
          <ThemeProvider>
            <SettingsView
              onBack={vi.fn()}
              showToast={vi.fn()}
              toastSettings={{
                position: 'top-right',
                enabledTypes: { success: true, error: true, info: true, warning: true },
                enableGrouping: true,
                groupingWindow: 500
              }}
              onToastSettingsChange={vi.fn()}
            />
          </ThemeProvider>
        );

        await waitFor(() => {
          expect(storageMock.getPrompts).toHaveBeenCalled();
        });

        const initialCallCount = (chromeMock.storage.local.set as Mock).mock.calls.length;

        // Expand advanced section
        const advancedToggle = await screen.findByRole('button', { name: /advanced/i });
        await userEvent.click(advancedToggle);

        // Toggle debug mode
        const debugToggle = await screen.findByRole('switch', { name: /debug mode/i });
        await userEvent.click(debugToggle);

        // Wait for debounce to complete (150ms + buffer)
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify save occurred
        await waitFor(() => {
          const calls = (chromeMock.storage.local.set as Mock).mock.calls;
          expect(calls.length).toBeGreaterThanOrEqual(initialCallCount + 1);

          // Verify the saved data contains debug mode change
          const lastCall = calls[calls.length - 1][0];
          expect(lastCall.promptLibrarySettings.debugMode).toBe(true);
        });
      });

      it('resets debounce timer on rapid consecutive changes', async () => {
        const chromeMock = getChromeMockFunctions();
        const storageMock = getMockStorageManager();

        render(
          <ThemeProvider>
            <SettingsView
              onBack={vi.fn()}
              showToast={vi.fn()}
              toastSettings={{
                position: 'top-right',
                enabledTypes: { success: true, error: true, info: true, warning: true },
                enableGrouping: true,
                groupingWindow: 500
              }}
              onToastSettingsChange={vi.fn()}
            />
          </ThemeProvider>
        );

        await waitFor(() => {
          expect(storageMock.getPrompts).toHaveBeenCalled();
        });

        const initialCallCount = (chromeMock.storage.local.set as Mock).mock.calls.length;

        // Find Claude toggle (site integration section is always expanded)
        const claudeToggle = await screen.findByRole('switch', { name: /claude/i });

        // Make rapid changes (3 clicks within 120ms)
        // Initial state: Claude is disabled (not in enabledSites)
        await userEvent.click(claudeToggle); // Click 1: Enable
        await new Promise(resolve => setTimeout(resolve, 40));

        await userEvent.click(claudeToggle); // Click 2: Disable
        await new Promise(resolve => setTimeout(resolve, 40));

        await userEvent.click(claudeToggle); // Click 3: Enable

        // Wait for debounce to complete (150ms + buffer)
        await new Promise(resolve => setTimeout(resolve, 200));

        await waitFor(() => {
          const calls = (chromeMock.storage.local.set as Mock).mock.calls;
          // Should have saved the final state (Claude enabled after 3 clicks)
          expect(calls.length).toBeGreaterThanOrEqual(initialCallCount + 1);

          // Verify final state: Claude should be enabled (3 clicks from initial disabled state)
          const lastCall = calls[calls.length - 1][0];
          expect(lastCall.promptLibrarySettings.enabledSites).toContain('claude.ai');
        });
      });
    });

    describe('Error handling', () => {
      it('handles save errors gracefully without crashing', async () => {
        const chromeMock = getChromeMockFunctions();
        const storageMock = getMockStorageManager();

        // Make first save fail, then succeed
        (chromeMock.storage.local.set as Mock)
          .mockRejectedValueOnce(new Error('Storage quota exceeded'))
          .mockResolvedValue(undefined);

        const { unmount } = render(
          <ThemeProvider>
            <SettingsView
              onBack={vi.fn()}
              showToast={vi.fn()}
              toastSettings={{
                position: 'top-right',
                enabledTypes: { success: true, error: true, info: true, warning: true },
                enableGrouping: true,
                groupingWindow: 500
              }}
              onToastSettingsChange={vi.fn()}
            />
          </ThemeProvider>
        );

        await waitFor(() => {
          expect(storageMock.getPrompts).toHaveBeenCalled();
        });

        const initialCallCount = (chromeMock.storage.local.set as Mock).mock.calls.length;

        // Expand advanced section
        const advancedToggle = await screen.findByRole('button', { name: /advanced/i });
        await userEvent.click(advancedToggle);

        // Toggle debug mode
        const debugToggle = await screen.findByRole('switch', { name: /debug mode/i });
        await userEvent.click(debugToggle);

        // Wait for debounce (this save will fail but error is caught)
        await new Promise(resolve => setTimeout(resolve, 200));

        await waitFor(() => {
          // Save attempt should have been made even though it failed
          expect((chromeMock.storage.local.set as Mock).mock.calls.length).toBeGreaterThanOrEqual(initialCallCount + 1);
        });

        // Component should not crash, unmount should work normally
        expect(() => unmount()).not.toThrow();
      });
    });
  });

  describe('Settings Notification System', () => {
    describe('First-time change notifications', () => {
      it('notifies tabs when disabling a site as the first action', async () => {
        const chromeMock = getChromeMockFunctions();
        const storageMock = getMockStorageManager();

        // Setup: ChatGPT is enabled initially
        (chromeMock.storage.local.get as Mock).mockResolvedValue({
          promptLibrarySettings: {
            enabledSites: ['chatgpt.com'],
            customSites: [],
            debugMode: false,
            floatingFallback: true
          },
          interfaceMode: 'popup',
          settings: DEFAULT_SETTINGS
        });

        // Mock open tab on ChatGPT
        const mockTab = { id: 123, url: 'https://chatgpt.com/chat' };
        (chromeMock.tabs.query as Mock).mockResolvedValue([mockTab]);
        (chromeMock.tabs.sendMessage as Mock).mockResolvedValue(undefined);

        await renderSettings();

        // Wait for settings to load
        await waitFor(() => {
          expect(storageMock.getPrompts).toHaveBeenCalled();
        });

        // Find and click ChatGPT toggle to disable it (FIRST ACTION)
        const chatgptToggle = await screen.findByRole('switch', { name: /chatgpt/i });
        expect(chatgptToggle).toBeChecked(); // Initially enabled

        await userEvent.click(chatgptToggle);

        // Wait for debounce (200ms) + persistence (150ms)
        await new Promise(resolve => setTimeout(resolve, 400));

        // Verify chrome.tabs.query was called with correct pattern
        await waitFor(() => {
          expect(chromeMock.tabs.query).toHaveBeenCalledWith({
            url: expect.arrayContaining(['*://chatgpt.com/*'])
          });
        });

        // Verify chrome.tabs.sendMessage was called for the ChatGPT tab
        await waitFor(() => {
          expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
            123,
            expect.objectContaining({
              action: 'settingsUpdated',
              settings: expect.objectContaining({
                enabledSites: expect.not.arrayContaining(['chatgpt.com'])
              })
            })
          );
        });
      });

      it('notifies tabs when disabling a custom site as the first action', async () => {
        const chromeMock = getChromeMockFunctions();
        const storageMock = getMockStorageManager();

        // Setup: Custom site is enabled initially
        const customSite = {
          hostname: 'custom.example.com',
          displayName: 'Custom Site',
          enabled: true,
          dateAdded: Date.now()
        };

        (chromeMock.storage.local.get as Mock).mockResolvedValue({
          promptLibrarySettings: {
            enabledSites: ['chatgpt.com'],
            customSites: [customSite],
            debugMode: false,
            floatingFallback: true
          },
          interfaceMode: 'popup',
          settings: DEFAULT_SETTINGS
        });

        // Mock open tab on custom site
        const mockTab = { id: 456, url: 'https://custom.example.com/page' };
        (chromeMock.tabs.query as Mock).mockResolvedValue([mockTab]);
        (chromeMock.tabs.sendMessage as Mock).mockResolvedValue(undefined);

        await renderSettings();

        // Wait for settings to load
        await waitFor(() => {
          expect(storageMock.getPrompts).toHaveBeenCalled();
        });

        // Find and click custom site toggle to disable it (FIRST ACTION)
        const customToggle = await screen.findByRole('switch', { name: /custom site/i });
        expect(customToggle).toBeChecked(); // Initially enabled

        await userEvent.click(customToggle);

        // Wait for debounce (200ms) + persistence (150ms)
        await new Promise(resolve => setTimeout(resolve, 400));

        // Verify chrome.tabs.query was called with custom site pattern
        await waitFor(() => {
          expect(chromeMock.tabs.query).toHaveBeenCalledWith({
            url: expect.arrayContaining(['*://custom.example.com/*'])
          });
        });

        // Verify chrome.tabs.sendMessage was called
        await waitFor(() => {
          expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
            456,
            expect.objectContaining({
              action: 'settingsUpdated',
              settings: expect.objectContaining({
                customSites: expect.arrayContaining([
                  expect.objectContaining({
                    hostname: 'custom.example.com',
                    enabled: false
                  })
                ])
              })
            })
          );
        });
      });

      it('notifies tabs when enabling a site as the first action', async () => {
        const chromeMock = getChromeMockFunctions();
        const storageMock = getMockStorageManager();

        // Setup: Claude is disabled initially (not in enabledSites)
        (chromeMock.storage.local.get as Mock).mockResolvedValue({
          promptLibrarySettings: {
            enabledSites: ['chatgpt.com'],
            customSites: [],
            debugMode: false,
            floatingFallback: true
          },
          interfaceMode: 'popup',
          settings: DEFAULT_SETTINGS
        });

        // Mock open tab on Claude (even though it's disabled)
        const mockTab = { id: 789, url: 'https://claude.ai/chat' };
        (chromeMock.tabs.query as Mock).mockResolvedValue([mockTab]);
        (chromeMock.tabs.sendMessage as Mock).mockResolvedValue(undefined);

        await renderSettings();

        // Wait for settings to load
        await waitFor(() => {
          expect(storageMock.getPrompts).toHaveBeenCalled();
        });

        // Find and click Claude toggle to enable it (FIRST ACTION)
        const claudeToggle = await screen.findByRole('switch', { name: /claude/i });
        expect(claudeToggle).not.toBeChecked(); // Initially disabled

        await userEvent.click(claudeToggle);

        // Wait for debounce (200ms) + persistence (150ms)
        await new Promise(resolve => setTimeout(resolve, 400));

        // Verify chrome.tabs.query was called with Claude pattern
        await waitFor(() => {
          expect(chromeMock.tabs.query).toHaveBeenCalledWith({
            url: expect.arrayContaining(['*://claude.ai/*'])
          });
        });

        // Verify chrome.tabs.sendMessage was called
        await waitFor(() => {
          expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
            789,
            expect.objectContaining({
              action: 'settingsUpdated',
              settings: expect.objectContaining({
                enabledSites: expect.arrayContaining(['claude.ai', 'chatgpt.com'])
              })
            })
          );
        });
      });
    });

    describe('Edge cases', () => {
      it('handles previousSettingsRef initialization when loading fails', async () => {
        const chromeMock = getChromeMockFunctions();

        // Force loading error
        (chromeMock.storage.local.get as Mock).mockRejectedValue(
          new Error('Storage not available')
        );

        await renderSettings();

        // Wait for component to finish loading (loading state goes false)
        await waitFor(() => {
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        });

        // Reset mocks and allow saving
        (chromeMock.storage.local.get as Mock).mockResolvedValue({
          promptLibrarySettings: {
            enabledSites: [],
            customSites: [],
            debugMode: false,
            floatingFallback: true
          },
          interfaceMode: 'popup',
          settings: DEFAULT_SETTINGS
        });

        const mockTab = { id: 123, url: 'https://chatgpt.com/chat' };
        (chromeMock.tabs.query as Mock).mockResolvedValue([mockTab]);
        (chromeMock.tabs.sendMessage as Mock).mockResolvedValue(undefined);

        // Try to enable ChatGPT (first action after error)
        const chatgptToggle = await screen.findByRole('switch', { name: /chatgpt/i });
        await userEvent.click(chatgptToggle);
        await new Promise(resolve => setTimeout(resolve, 400));

        // Should still notify tabs even though initial load failed
        await waitFor(() => {
          expect(chromeMock.tabs.query).toHaveBeenCalledWith({
            url: expect.arrayContaining(['*://chatgpt.com/*'])
          });
        });
      });

      it('handles rapid toggle changes correctly', async () => {
        const chromeMock = getChromeMockFunctions();
        const storageMock = getMockStorageManager();

        (chromeMock.storage.local.get as Mock).mockResolvedValue({
          promptLibrarySettings: {
            enabledSites: ['chatgpt.com'],
            customSites: [],
            debugMode: false,
            floatingFallback: true
          },
          interfaceMode: 'popup',
          settings: DEFAULT_SETTINGS
        });

        const mockTab = { id: 123, url: 'https://chatgpt.com/chat' };
        (chromeMock.tabs.query as Mock).mockResolvedValue([mockTab]);
        (chromeMock.tabs.sendMessage as Mock).mockResolvedValue(undefined);

        await renderSettings();
        await waitFor(() => {
          expect(storageMock.getPrompts).toHaveBeenCalled();
        });

        // Rapidly toggle ChatGPT 3 times
        const chatgptToggle = await screen.findByRole('switch', { name: /chatgpt/i });

        await userEvent.click(chatgptToggle); // Disable
        await new Promise(resolve => setTimeout(resolve, 50));

        await userEvent.click(chatgptToggle); // Enable
        await new Promise(resolve => setTimeout(resolve, 50));

        await userEvent.click(chatgptToggle); // Disable

        // Wait for final debounce and notification
        await new Promise(resolve => setTimeout(resolve, 400));

        // Should notify with final state (disabled)
        await waitFor(() => {
          const sendMessageCalls = (chromeMock.tabs.sendMessage as Mock).mock.calls;
          expect(sendMessageCalls.length).toBeGreaterThan(0);

          const lastCall = sendMessageCalls[sendMessageCalls.length - 1];
          expect(lastCall[1].settings.enabledSites).not.toContain('chatgpt.com');
        });
      });
    });
  });
});
