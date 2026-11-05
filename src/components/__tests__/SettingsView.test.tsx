import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { ThemeProvider } from '../../contexts/ThemeContext';
import { AdmissionRefusedError } from '../../services/promptAdmission';
import { getChromeMockFunctions, getMockStorageManager, triggerChromeStorageChange } from '../../test/mocks';
import { type Category, DEFAULT_SETTINGS, type Prompt } from '../../types';
import SettingsView from '../SettingsView';

const createJsonFile = (contents: string): File => {
  const file = new File([contents], 'backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    value: () => Promise.resolve(contents),
    configurable: true
  });
  return file;
};

// Renders Settings without waiting for it to load
const renderSettingsView = (showToastMock = vi.fn(), onStorageRefusedMock = vi.fn()) => {
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
        showToast={showToastMock}
        toastSettings={mockToastSettings}
        onToastSettingsChange={vi.fn()}
        onStorageRefused={onStorageRefusedMock}
      />
    </ThemeProvider>
  );
};

const renderSettings = async (showToastMock = vi.fn(), onStorageRefusedMock = vi.fn()) => {
  renderSettingsView(showToastMock, onStorageRefusedMock);
  await screen.findByRole('heading', { name: /settings/i });
  return { showToastMock, onStorageRefusedMock };
};

const STORAGE_REFUSAL = 'Storage quota exceeded. Please delete old prompts to free up space.';
const storageRefusal = () => Object.assign(new Error(STORAGE_REFUSAL), { type: 'STORAGE_QUOTA_EXCEEDED' });

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
    const showToastMock = vi.fn();

    await renderSettings(showToastMock);
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

    expect(showToastMock).toHaveBeenCalledWith(expect.stringMatching(/successfully imported/i), 'success');
    expect((chromeMock.storage.local.get as Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('skips a refused item, restores the rest, and says what was skipped', async () => {
    const storageMock = getMockStorageManager();
    const showToastMock = vi.fn();
    (storageMock.importPrompt as unknown as Mock).mockImplementation((prompt: Prompt) => {
      if (prompt.id === 'bad') {
        return Promise.reject(
          new AdmissionRefusedError({
            content: {
              field: 'content',
              reason: 'too_long',
              length: 20_001,
              max: 20_000,
              message: 'Content cannot exceed 20,000 characters'
            }
          })
        );
      }
      return Promise.resolve(prompt);
    });

    await renderSettings(showToastMock);
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    const prompts: Prompt[] = [
      { id: 'good', title: 'Fine', content: 'Hello', category: 'Uncategorized', createdAt: 1, updatedAt: 1 },
      { id: 'bad', title: 'Too long', content: 'x', category: 'Uncategorized', createdAt: 1, updatedAt: 1 },
      { id: 'good2', title: 'Also fine', content: 'Hi', category: 'Uncategorized', createdAt: 1, updatedAt: 1 }
    ];
    await userEvent.upload(
      fileInput as HTMLInputElement,
      createJsonFile(JSON.stringify({ prompts, categories: [], version: '1.0' }))
    );

    await waitFor(() => {
      expect(storageMock.importPrompt).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith('Imported 2 prompts and 0 categories. Skipped 1: see Backup & Restore.', 'warning');
    });
    const report = screen.getByRole('status', { name: 'Import report' });
    expect(within(report).getByText('"Too long"')).toBeInTheDocument();
    expect(within(report).getByText('Content cannot exceed 20,000 characters')).toBeInTheDocument();
  });

  // My-Prompt-Manager-1xi: a toast shows 80 characters, so the skipped titles and reasons stay in
  // the Backup & Restore card, every one of them, until dismissed; the toast only points there
  it('lists every skipped Prompt with its reason in full, past what a toast shows', async () => {
    const storageMock = getMockStorageManager();
    const refusal = () => new AdmissionRefusedError({
      content: { field: 'content', reason: 'too_long', length: 20_001, max: 20_000, message: 'Content cannot exceed 20,000 characters' }
    });
    (storageMock.importPrompt as unknown as Mock).mockImplementation((prompt: Prompt) =>
      prompt.id.startsWith('bad') ? Promise.reject(refusal()) : Promise.resolve(prompt)
    );

    const { showToastMock } = await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    const titles = [
      'Quarterly business review summary for the leadership team, with every open risk',
      'Detailed onboarding checklist for new engineers joining the platform squad this year',
      'Long-form blog post outline about migrating a legacy monolith to small services'
    ];
    const prompts: Prompt[] = [
      { id: 'good', title: 'Fine', content: 'Hello', category: 'Uncategorized', createdAt: 1, updatedAt: 1 },
      ...titles.map((title, i) => ({ id: `bad${String(i)}`, title, content: 'x', category: 'Uncategorized', createdAt: 1, updatedAt: 1 }))
    ];
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, createJsonFile(JSON.stringify({ prompts, categories: [], version: '1.0' })));

    const report = await screen.findByRole('status', { name: 'Import report' });
    expect(within(report).getByText('Skipped 3 items')).toBeInTheDocument();
    for (const title of titles) {
      const item = within(report).getByText(`"${title}"`).closest('li') as HTMLElement;
      expect(item).toHaveTextContent('Content cannot exceed 20,000 characters');
    }
    const toast = (showToastMock.mock.calls.find(call => call[1] === 'warning') as [string])[0];
    expect(toast).toBe('Imported 1 prompt and 0 categories. Skipped 3: see Backup & Restore.');
    expect(toast.length).toBeLessThanOrEqual(80);

    await userEvent.click(within(report).getByRole('button', { name: 'Dismiss import report' }));
    expect(screen.queryByRole('status', { name: 'Import report' })).not.toBeInTheDocument();
  });

  // My-Prompt-Manager-lqu: one reads in the singular, and the Categories a restore creates for the
  // Prompts that name them (PR #487) count with the Backup's own
  it('says "1 prompt and 1 category", counting the Category a restore creates', async () => {
    const storageMock = getMockStorageManager();
    let library: Category[] = [];
    storageMock.getCategories.mockImplementation(() => Promise.resolve(library));
    (storageMock.importPrompt as unknown as Mock).mockImplementation((prompt: Prompt) => {
      library = [...library, { id: 'created', name: prompt.category }];
      return Promise.resolve(prompt);
    });

    const { showToastMock } = await renderSettings();
    await waitFor(() => {
      expect(storageMock.getCategories).toHaveBeenCalled();
    });

    const prompt = { id: 'p1', title: 'Chess opening drill', content: 'Hello', category: 'Play', createdAt: 1, updatedAt: 1 };
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, createJsonFile(JSON.stringify({ prompts: [prompt], version: '1.0' })));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith('Successfully imported 1 prompt and 1 category!', 'success');
    });
  });

  it('says in an error toast, not an alert, that a file which is not JSON is invalid', async () => {
    const storageMock = getMockStorageManager();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    const { showToastMock } = await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
      expect(storageMock.getCategories).toHaveBeenCalled();
    });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    const badFile = createJsonFile('not-json');

    await userEvent.upload(fileInput as HTMLInputElement, badFile);

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(expect.stringMatching(/invalid json/i), 'error');
    });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(storageMock.importPrompt).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it.each([
    ['a null entry', null],
    ['a Prompt without an id', { title: 'No id', content: 'Hello', category: 'Uncategorized' }]
  ])('rejects a backup with %s before restoring anything', async (_label, badEntry) => {
    const storageMock = getMockStorageManager();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    const { showToastMock } = await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    const good = { id: 'good', title: 'Fine', content: 'Hello', category: 'Uncategorized', createdAt: 1, updatedAt: 1 };
    await userEvent.upload(
      fileInput as HTMLInputElement,
      createJsonFile(JSON.stringify({ prompts: [good, badEntry], categories: [], version: '1.0' }))
    );

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(expect.stringMatching(/one or more prompts have invalid structure/i), 'error');
    });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(storageMock.importPrompt).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('rejects a backup with a null Category entry before restoring anything', async () => {
    const storageMock = getMockStorageManager();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    const { showToastMock } = await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    await userEvent.upload(
      fileInput as HTMLInputElement,
      createJsonFile(JSON.stringify({ prompts: [], categories: [{ id: 'c1', name: 'Custom' }, null], version: '1.0' }))
    );

    // A toast shows 80 characters: the whole message fits
    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(expect.stringMatching(/^Import failed: Invalid backup file: one or more categories .*\.$/), 'error');
    });
    expect((showToastMock.mock.calls[0] as [string])[0].length).toBeLessThanOrEqual(80);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(storageMock.importCategory).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  // My-Prompt-Manager-ag4: the Prompts imported before the refusal stay in the Library, so the
  // refusal says how many; like a refused save, it opens the storage warning (PR #465)
  it('opens the storage warning, saying how many Prompts were imported, when storage stops an import', async () => {
    const storageMock = getMockStorageManager();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    let stored = 0;
    (storageMock.importPrompt as unknown as Mock).mockImplementation((prompt: Prompt) => {
      if (stored === 2) {
        return Promise.reject(storageRefusal());
      }
      stored += 1;
      return Promise.resolve(prompt);
    });

    const { showToastMock, onStorageRefusedMock } = await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });
    const loadsBeforeImport = storageMock.getPrompts.mock.calls.length;

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    const prompts: Prompt[] = Array.from({ length: 4 }, (_, i) => (
      { id: `p${String(i)}`, title: `Prompt ${String(i)}`, content: 'Hello', category: 'Uncategorized', createdAt: 1, updatedAt: 1 }
    ));
    await userEvent.upload(
      fileInput as HTMLInputElement,
      createJsonFile(JSON.stringify({ prompts, categories: [], version: '1.0' }))
    );

    await waitFor(() => {
      expect(onStorageRefusedMock).toHaveBeenCalledWith(
        `The import stopped when storage was full: 2 of 4 prompts were imported. ${STORAGE_REFUSAL}`
      );
    });
    expect(storageMock.importPrompt).toHaveBeenCalledTimes(3);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalledWith(expect.anything(), 'error');
    // Settings shows the Prompts that were imported
    await waitFor(() => {
      expect(storageMock.getPrompts.mock.calls.length).toBeGreaterThan(loadsBeforeImport);
    });
    alertSpy.mockRestore();
  });

  // My-Prompt-Manager-5ar: the Prompts imported before the error stay in the Library, so an import
  // stopped by an error other than storage says how many, and why it stopped
  it('says how many Prompts were imported, and why, when another error stops an import', async () => {
    const storageMock = getMockStorageManager();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    let stored = 0;
    (storageMock.importPrompt as unknown as Mock).mockImplementation((prompt: Prompt) => {
      if (stored === 2) {
        return Promise.reject(
          Object.assign(new Error('Storage API is unavailable. Please try again later.'), { type: 'STORAGE_UNAVAILABLE' })
        );
      }
      stored += 1;
      return Promise.resolve(prompt);
    });

    const { showToastMock, onStorageRefusedMock } = await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });
    const loadsBeforeImport = storageMock.getPrompts.mock.calls.length;

    const prompts: Prompt[] = Array.from({ length: 4 }, (_, i) => (
      { id: `p${String(i)}`, title: `Prompt ${String(i)}`, content: 'Hello', category: 'Uncategorized', createdAt: 1, updatedAt: 1 }
    ));
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, createJsonFile(JSON.stringify({ prompts, categories: [], version: '1.0' })));

    const report = await screen.findByRole('status', { name: 'Import report' });
    expect(report).toHaveTextContent('The import stopped: 2 of 4 prompts were imported.');
    expect(report).toHaveTextContent('Storage API is unavailable. Please try again later.');
    expect(showToastMock).toHaveBeenCalledWith('Import stopped: 2 of 4 prompts were imported. See Backup & Restore.', 'error');
    expect(storageMock.importPrompt).toHaveBeenCalledTimes(3);
    expect(onStorageRefusedMock).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    // Settings shows the Prompts that were imported
    await waitFor(() => {
      expect(storageMock.getPrompts.mock.calls.length).toBeGreaterThan(loadsBeforeImport);
    });
    alertSpy.mockRestore();
  });

  // Chrome takes the keyboard away from a disabled button: Import stays focusable, so the keyboard
  // can come back to it when the storage warning closes, but does nothing until the import ends
  it('keeps Import focusable but inactive while an import runs', async () => {
    const storageMock = getMockStorageManager();
    let finishImport: () => void = () => undefined;
    (storageMock.importPrompt as unknown as Mock).mockImplementation((prompt: Prompt) =>
      new Promise(resolve => { finishImport = () => { resolve(prompt); }; })
    );

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
    const prompt = { id: 'p1', title: 'Fine', content: 'Hello', category: 'Uncategorized', createdAt: 1, updatedAt: 1 };
    await userEvent.upload(fileInput, createJsonFile(JSON.stringify({ prompts: [prompt], categories: [], version: '1.0' })));

    const importing = await screen.findByRole('button', { name: /importing/i });
    expect(importing).toHaveAttribute('aria-disabled', 'true');
    expect(importing).toBeEnabled();
    const openFileChooser = vi.spyOn(fileInput, 'click');
    await userEvent.click(importing);
    expect(openFileChooser).not.toHaveBeenCalled();

    finishImport();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Import' })).toHaveAttribute('aria-disabled', 'false');
    });
  });

  // My-Prompt-Manager-71n: the bar shows what Chrome counts (getBytesInUse) against its quota (QUOTA_BYTES)
  it('shows the bytes Chrome stores against its quota in the Data & Storage bar', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getStorageUsage.mockResolvedValue({ used: 4_404_019, total: 10_485_760 });

    await renderSettings();

    const bar = await screen.findByRole('progressbar', { name: 'Storage usage' });
    await waitFor(() => {
      expect(bar).toHaveAttribute('aria-valuenow', '42');
    });
    expect(screen.getByText('4.2 MB / 10 MB (42%)')).toBeInTheDocument();
    expect(bar.firstElementChild).toHaveStyle({ width: '42%' });
  });

  // Review round 1 (Codex): writes land after the first reading (the default Category written on load,
  // the site settings saved after it, Clear All Data), so the bar reads Chrome's use again after each
  it('reads Chrome storage use again after every write to local storage', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getStorageUsage.mockResolvedValue({ used: 80, total: 10_485_760 });

    await renderSettings();
    expect(await screen.findByText('80 Bytes / 10 MB (0%)')).toBeInTheDocument();

    storageMock.getStorageUsage.mockResolvedValue({ used: 309, total: 10_485_760 });
    await act(async () => {
      triggerChromeStorageChange({ promptLibrarySettings: { newValue: { enabledSites: [] } } });
      await Promise.resolve();
    });

    expect(await screen.findByText('309 Bytes / 10 MB (0%)')).toBeInTheDocument();
  });

  it('clears all data through StorageManager, which takes the storage locks', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();
    const showToastMock = vi.fn();

    await renderSettings(showToastMock);
    await userEvent.click(await screen.findByRole('button', { name: 'Clear All Data' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, Clear All Data' }));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith('All data has been cleared.', 'success');
    });
    expect(storageMock.clearAllData).toHaveBeenCalledTimes(1);
    // The one clear is StorageManager's: a direct clear would skip the locks another context's write holds
    expect(chromeMock.storage.local.clear).toHaveBeenCalledTimes(1);
  });

  it('resets settings to defaults after confirmation', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();
    const showToastMock = vi.fn();

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

    await renderSettings(showToastMock);
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

    expect(showToastMock).toHaveBeenCalledWith(expect.stringMatching(/reset to defaults/i), 'success');
  });

  it('shows the saved Library sort and saves a new one in its natural direction', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();
    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      promptLibrarySettings: { enabledSites: ['chatgpt.com'], customSites: [] },
      interfaceMode: 'popup',
      settings: { ...DEFAULT_SETTINGS, sortOrder: 'usageCount', sortDirection: 'asc' }
    });
    vi.mocked(storageMock.updateSettings).mockResolvedValue({ ...DEFAULT_SETTINGS, sortOrder: 'title', sortDirection: 'asc' });
    await renderSettings();

    const select = await screen.findByLabelText('Sort prompts by');
    expect(select).toHaveValue('usageCount');

    await userEvent.selectOptions(select, 'title');

    await waitFor(() => {
      expect(storageMock.updateSettings).toHaveBeenCalledWith({ sortOrder: 'title', sortDirection: 'asc' });
    });
    expect(select).toHaveValue('title');
  });

  // My-Prompt-Manager-see: loading the site settings is not a change, so opening Settings saves nothing
  describe('site settings persistence', () => {
    const PAST_THE_DEBOUNCE_MS = 400;
    const waitPastTheDebounce = () => act(async () => {
      await new Promise(resolve => { setTimeout(resolve, PAST_THE_DEBOUNCE_MS); });
    });
    const siteSettingsWrites = () =>
      (getChromeMockFunctions().storage.local.set as Mock).mock.calls.filter(
        ([items]) => (items as Record<string, unknown>).promptLibrarySettings !== undefined
      );

    beforeEach(() => {
      const chromeMock = getChromeMockFunctions();
      (chromeMock.tabs.query as Mock).mockResolvedValue([{ id: 7, url: 'https://claude.ai/new' }]);
      (chromeMock.tabs.sendMessage as Mock).mockResolvedValue(undefined);
    });

    it('opening Settings neither saves the site settings nor sends them to the tabs', async () => {
      const chromeMock = getChromeMockFunctions();
      // A save that never ends keeps the interface mode locked, so a save on open would show
      (chromeMock.storage.local.set as Mock).mockImplementation((items: Record<string, unknown>) =>
        items.promptLibrarySettings === undefined ? Promise.resolve() : new Promise<void>(() => undefined)
      );

      await renderSettings();
      await screen.findByRole('switch', { name: 'Enable ChatGPT integration' });
      await waitPastTheDebounce();

      expect(siteSettingsWrites()).toHaveLength(0);
      expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled();
      expect(screen.getByRole('radio', { name: /select side panel mode/i })).toBeEnabled();
    });

    // My-Prompt-Manager-ds8: React re-renders on its own scheduler, not on setTimeout, so with only the
    // timers faked the debounce timer of the first render, which holds the empty settings Settings starts
    // with, fires after the load and before the re-render that would have cleared it
    describe('with fake timers', () => {
      const SAVE_DEBOUNCE_MS = 150;
      const fakeTheTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      // Lets promise callbacks run, and not the re-render React schedules
      const flushPromises = async () => {
        for (let tick = 0; tick < 5; tick++) {
          // eslint-disable-next-line no-await-in-loop -- each tick lets the next callback run
          await Promise.resolve();
        }
      };

      afterEach(() => {
        vi.useRealTimers();
      });

      it('saves nothing when the debounce timer of the first render fires after the load', async () => {
        const chromeMock = getChromeMockFunctions();
        fakeTheTimers();

        renderSettingsView();
        await flushPromises();
        // The load has read the site settings and gone on to the Prompts: only the re-render is left
        expect(getMockStorageManager().getPrompts).toHaveBeenCalled();
        vi.advanceTimersByTime(PAST_THE_DEBOUNCE_MS);
        await flushPromises();

        expect(siteSettingsWrites()).toEqual([]);
        expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled();
      });

      it('saves a site setting the user changes 150 ms after the change', async () => {
        await renderSettings();
        const claude = await screen.findByRole('switch', { name: 'Enable Claude integration' });
        await waitPastTheDebounce();
        fakeTheTimers();

        act(() => { claude.click(); });
        vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1);
        expect(siteSettingsWrites()).toHaveLength(0);
        vi.advanceTimersByTime(1);
        await flushPromises();

        expect(siteSettingsWrites()).toHaveLength(1);
      });
    });

    it('saves a site setting the user changes once, and sends it to the tabs', async () => {
      const chromeMock = getChromeMockFunctions();

      await renderSettings();
      await waitPastTheDebounce();
      await userEvent.click(await screen.findByRole('switch', { name: 'Enable Claude integration' }));
      await waitPastTheDebounce();

      const writes = siteSettingsWrites();
      expect(writes).toHaveLength(1);
      const saved = (writes[0][0] as { promptLibrarySettings: { enabledSites: string[] } }).promptLibrarySettings;
      expect(saved.enabledSites).toEqual(expect.arrayContaining(['chatgpt.com', 'claude.ai']));
      expect(chromeMock.tabs.sendMessage).toHaveBeenCalledTimes(1);
      expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(7, { action: 'settingsUpdated', settings: saved });
    });

    // Review round 1 (Codex): a load that fails shows the default settings, and a change to them is still saved
    it('saves a site setting the user changes after the settings failed to load', async () => {
      const chromeMock = getChromeMockFunctions();
      (chromeMock.storage.local.get as Mock).mockRejectedValue(new Error('storage unavailable'));

      await renderSettings();
      await waitPastTheDebounce();
      expect(siteSettingsWrites()).toHaveLength(0);

      // The defaults are shown: Claude is on, where storage would have had it off
      const claudeSwitch = await screen.findByRole('switch', { name: 'Enable Claude integration' });
      expect(claudeSwitch).toHaveAttribute('aria-checked', 'true');
      await userEvent.click(claudeSwitch);
      await waitPastTheDebounce();

      const writes = siteSettingsWrites();
      expect(writes).toHaveLength(1);
      const saved = (writes[0][0] as { promptLibrarySettings: { enabledSites: string[] } }).promptLibrarySettings;
      expect(saved.enabledSites).not.toContain('claude.ai');
      expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(7, { action: 'settingsUpdated', settings: saved });
    });

    // My-Prompt-Manager-3v1: the site settings loaded, so a failed Prompts read must not replace them with the defaults
    it('keeps the stored site settings when the Prompts fail to load, and saves nothing', async () => {
      const chromeMock = getChromeMockFunctions();
      (chromeMock.storage.local.get as Mock).mockResolvedValue({
        promptLibrarySettings: {
          enabledSites: ['chatgpt.com'],
          customSites: [{ hostname: 'my-ai.example.com', displayName: 'My AI', enabled: true, dateAdded: 1 }]
        },
        interfaceMode: 'sidepanel',
        settings: DEFAULT_SETTINGS
      });
      getMockStorageManager().getPrompts.mockRejectedValue(new Error('locked'));

      await renderSettings();
      // Updates made inside an async act flush when it ends: the first wait lets the load finish,
      // the second lets a save armed by it run
      await waitPastTheDebounce();
      await waitPastTheDebounce();

      expect(siteSettingsWrites()).toHaveLength(0);
      expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled();
      expect(screen.getByRole('switch', { name: 'Enable ChatGPT integration' })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('switch', { name: 'Enable Claude integration' })).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByRole('switch', { name: /enable my ai integration/i })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('radio', { name: /select side panel mode/i })).toBeChecked();
    });
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

  it('shows loading state before settings are loaded', () => {
    const chromeMock = getChromeMockFunctions();
    // Make storage.local.get hang indefinitely so loading stays true
    (chromeMock.storage.local.get as Mock).mockReturnValue(new Promise(() => undefined));

    render(
      <ThemeProvider>
        <SettingsView
          showToast={vi.fn()}
          toastSettings={{
            position: 'top-right',
            enabledTypes: { success: true, error: true, info: true, warning: true },
            enableGrouping: true,
            groupingWindow: 500
          }}
          onToastSettingsChange={vi.fn()}
          onStorageRefused={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/loading settings/i)).toBeInTheDocument();
  });

  it('falls back to default settings when loadSettings throws', async () => {
    const chromeMock = getChromeMockFunctions();
    (chromeMock.storage.local.get as Mock).mockRejectedValue(new Error('Storage access denied'));

    await act(async () => {
      render(
        <ThemeProvider>
          <SettingsView
            showToast={vi.fn()}
            toastSettings={{
              position: 'top-right',
              enabledTypes: { success: true, error: true, info: true, warning: true },
              enableGrouping: true,
              groupingWindow: 500
            }}
            onToastSettingsChange={vi.fn()}
            onStorageRefused={vi.fn()}
          />
        </ThemeProvider>
      );
    });

    // After error, loading completes and the settings heading is shown with defaults
    await screen.findByRole('heading', { name: /settings/i });
    // The component should have rendered (no crash)
    expect(screen.getByText(/customize your experience/i)).toBeInTheDocument();
  });

  it('toggles a supported site and triggers debounced save', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();

    // ChatGPT starts enabled
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

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // Find the ChatGPT toggle (it's currently enabled) and disable it
    const chatgptToggle = screen.getByRole('switch', { name: /enable chatgpt integration/i });
    expect(chatgptToggle).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(chatgptToggle);

    // The toggle should now be off
    await waitFor(() => {
      expect(chatgptToggle).toHaveAttribute('aria-checked', 'false');
    });

    // Advance past the 150ms debounce to trigger the save
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // Verify that chrome.storage.local.set was called with the updated settings
    await waitFor(() => {
      const setCalls = (chromeMock.storage.local.set as Mock).mock.calls;
      const saveCall = setCalls.find((call: any[]) => {
        const sites: string[] | undefined = call[0]?.promptLibrarySettings?.enabledSites;
        return call[0]?.promptLibrarySettings && !sites?.some((site) => site === 'chatgpt.com');
      });
      expect(saveCall).toBeDefined();
    });

    vi.useRealTimers();
  });

  it('enables a site that was previously disabled', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();

    // Claude starts disabled
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

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    const claudeToggle = screen.getByRole('switch', { name: /enable claude integration/i });
    expect(claudeToggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(claudeToggle);

    await waitFor(() => {
      expect(claudeToggle).toHaveAttribute('aria-checked', 'true');
    });

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      const setCalls = (chromeMock.storage.local.set as Mock).mock.calls;
      const saveCall = setCalls.find(
        (call: any[]) => call[0]?.promptLibrarySettings?.enabledSites?.some((site: string) => site === 'claude.ai')
      );
      expect(saveCall).toBeDefined();
    });

    vi.useRealTimers();
  });

  it('saves settings and notifies content scripts in open tabs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();

    // Mock tabs.query to return some HTTP tabs
    (chromeMock.tabs.query as Mock).mockResolvedValue([
      { id: 1, url: 'https://chatgpt.com/chat' },
      { id: 2, url: 'https://claude.ai' },
      { id: 3, url: 'chrome://extensions/' } // Should be filtered out
    ]);
    (chromeMock.tabs.sendMessage as Mock).mockResolvedValue(undefined);

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // Toggle a site to trigger saveSettings
    const chatgptToggle = screen.getByRole('switch', { name: /enable chatgpt integration/i });
    await userEvent.click(chatgptToggle);

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // Wait for save to complete and tabs to be queried
    await waitFor(() => {
      expect(chromeMock.tabs.query).toHaveBeenCalledWith({});
    });

    // Verify sendMessage was called for HTTP tabs only (tab ids 1 and 2)
    await waitFor(() => {
      const sendMessageCalls = (chromeMock.tabs.sendMessage as Mock).mock.calls;
      const settingsUpdateCalls = sendMessageCalls.filter(
        (call: any[]) => call[1]?.action === 'settingsUpdated'
      );
      expect(settingsUpdateCalls.length).toBe(2);
    });

    vi.useRealTimers();
  });

  it('toggles debug mode on and sets localStorage', async () => {
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

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // Expand the Advanced section
    const advancedToggle = await screen.findByRole('button', { name: /advanced/i });
    await userEvent.click(advancedToggle);

    // Find the debug mode toggle
    const debugToggle = await screen.findByRole('switch', { name: /debug mode/i });
    expect(debugToggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(debugToggle);

    // Verify localStorage was set
    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith('prompt-library-debug', 'true');
    });

    // Verify settings saved with debugMode: true
    await waitFor(() => {
      const setCalls = (chromeMock.storage.local.set as Mock).mock.calls;
      const debugCall = setCalls.find(
        (call: any[]) => call[0]?.promptLibrarySettings?.debugMode === true
      );
      expect(debugCall).toBeDefined();
    });
  });

  it('toggles debug mode off and removes localStorage', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();

    // Start with debug mode ON
    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      promptLibrarySettings: {
        enabledSites: ['chatgpt.com'],
        customSites: [],
        debugMode: true,
        floatingFallback: true
      },
      interfaceMode: 'popup',
      settings: DEFAULT_SETTINGS
    });

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    const advancedToggle = await screen.findByRole('button', { name: /advanced/i });
    await userEvent.click(advancedToggle);

    const debugToggle = await screen.findByRole('switch', { name: /debug mode/i });
    expect(debugToggle).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(debugToggle);

    await waitFor(() => {
      expect(localStorage.removeItem).toHaveBeenCalledWith('prompt-library-debug');
    });

    await waitFor(() => {
      const setCalls = (chromeMock.storage.local.set as Mock).mock.calls;
      const debugCall = setCalls.find(
        (call: any[]) => call[0]?.promptLibrarySettings?.debugMode === false
      );
      expect(debugCall).toBeDefined();
    });
  });

  it('clears all data after confirmation', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();
    const showToastMock = vi.fn();

    await renderSettings(showToastMock);
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // Click "Clear All Data" button to show confirmation
    const clearButton = await screen.findByRole('button', { name: /clear all data/i });
    await userEvent.click(clearButton);

    // Confirm the clear action
    const confirmClearButton = await screen.findByRole('button', { name: /yes, clear all data/i });
    await userEvent.click(confirmClearButton);

    await waitFor(() => {
      expect(chromeMock.storage.local.clear).toHaveBeenCalled();
    });

    expect(showToastMock).toHaveBeenCalledWith('All data has been cleared.', 'success');
  });

  it('cancels the clear data confirmation', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // Click "Clear All Data" to show confirmation
    const clearButton = await screen.findByRole('button', { name: /clear all data/i });
    await userEvent.click(clearButton);

    // Cancel instead of confirming
    const cancelButton = await screen.findByRole('button', { name: /cancel/i });
    await userEvent.click(cancelButton);

    // storage.local.clear should NOT have been called
    expect(chromeMock.storage.local.clear).not.toHaveBeenCalled();

    // The initial "Clear All Data" button should be back
    expect(screen.getByRole('button', { name: /clear all data/i })).toBeInTheDocument();
  });

  it('loads settings without saved user settings (userSettings null path)', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();

    // No 'settings' key in storage - userSettings will be null
    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      promptLibrarySettings: {
        enabledSites: ['chatgpt.com'],
        customSites: []
      },
      interfaceMode: 'popup'
      // Note: no 'settings' key
    });

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // The component should render without crashing
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });

  it('reset without user settings does not call updateSettings', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();
    const showToastMock = vi.fn();

    // No 'settings' key so userSettings is null
    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      promptLibrarySettings: { enabledSites: [], customSites: [] },
      interfaceMode: 'popup'
      // No 'settings' key
    });

    await renderSettings(showToastMock);
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // Expand About section and reset
    const aboutToggle = await screen.findByRole('button', { name: /about & reset/i });
    await userEvent.click(aboutToggle);

    const resetButton = await screen.findByRole('button', { name: /reset to defaults/i });
    await userEvent.click(resetButton);

    const confirmButton = await screen.findByRole('button', { name: /yes, reset settings/i });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(chromeMock.storage.local.set).toHaveBeenCalled();
    });

    // updateSettings should NOT be called when userSettings is null
    expect(storageMock.updateSettings).not.toHaveBeenCalled();

    expect(showToastMock).toHaveBeenCalledWith(expect.stringMatching(/reset to defaults/i), 'success');
  });

  it('displays prompts and categories counts from loaded data', async () => {
    const storageMock = getMockStorageManager();
    const prompts: Prompt[] = [
      { id: 'p1', title: 'A', content: 'a', category: 'Uncategorized', createdAt: 1, updatedAt: 1 },
      { id: 'p2', title: 'B', content: 'b', category: 'Uncategorized', createdAt: 2, updatedAt: 2 },
      { id: 'p3', title: 'C', content: 'c', category: 'Uncategorized', createdAt: 3, updatedAt: 3 }
    ];
    const categories: Category[] = [
      { id: 'c1', name: 'Work' },
      { id: 'c2', name: 'Personal' }
    ];

    storageMock.getPrompts.mockResolvedValue(prompts);
    storageMock.getCategories.mockResolvedValue(categories);

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // The DataStorageSection shows count info
    expect(screen.getByText('3 prompts')).toBeInTheDocument();
    expect(screen.getByText('2 categories')).toBeInTheDocument();
  });

  it('handles export button click without crashing', async () => {
    const storageMock = getMockStorageManager();

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // Find and click the Export button
    const exportButton = screen.getByRole('button', { name: /export/i });
    await userEvent.click(exportButton);

    // The test passes if no error is thrown
    expect(exportButton).toBeInTheDocument();
  });

  it('notification section expands and shows test button', async () => {
    const storageMock = getMockStorageManager();
    const showToastMock = vi.fn();

    await renderSettings(showToastMock);
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // Expand the Notifications section
    const notificationsToggle = await screen.findByRole('button', { name: /notifications/i });
    await userEvent.click(notificationsToggle);

    // Find and click the Test button
    const testButton = await screen.findByRole('button', { name: /test/i });
    await userEvent.click(testButton);

    // showToast should be called with a test notification
    expect(showToastMock).toHaveBeenCalledWith(
      expect.stringMatching(/this is a .+ notification/i),
      expect.any(String)
    );
  });

  it('renders all section headers on the page', async () => {
    const storageMock = getMockStorageManager();

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // Verify key section headings are present (use heading role for specificity)
    expect(screen.getByRole('heading', { name: /^Appearance$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Site Integration$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Data & Storage$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Notifications$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Advanced$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^About & Reset$/i })).toBeInTheDocument();
  });

  it('loads and applies saved interface mode from storage', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();

    // Sidepanel is saved as the interface mode
    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      promptLibrarySettings: {
        enabledSites: ['chatgpt.com'],
        customSites: []
      },
      interfaceMode: 'sidepanel',
      settings: DEFAULT_SETTINGS
    });

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // The sidepanel radio should be checked
    const sidePanelOption = screen.getByRole('radio', { name: /select side panel mode/i });
    expect(sidePanelOption).toBeChecked();
  });

  it('renders custom sites and allows toggling them', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();

    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      promptLibrarySettings: {
        enabledSites: ['chatgpt.com'],
        customSites: [
          {
            hostname: 'my-ai.example.com',
            displayName: 'My AI',
            enabled: true,
            dateAdded: Date.now()
          }
        ],
        debugMode: false,
        floatingFallback: true
      },
      interfaceMode: 'popup',
      settings: DEFAULT_SETTINGS
    });

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // The custom site should be rendered
    expect(screen.getByText('My AI')).toBeInTheDocument();
    expect(screen.getByText('my-ai.example.com')).toBeInTheDocument();

    // Find the custom site's toggle and click it to toggle off
    const customSiteToggle = screen.getByRole('switch', { name: /enable my ai integration/i });
    expect(customSiteToggle).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(customSiteToggle);

    // Verify saveSettings was called with the custom site disabled
    await waitFor(() => {
      const setCalls = (chromeMock.storage.local.set as Mock).mock.calls;
      const saveCall = setCalls.find(
        (call: any[]) => {
          const customSites = call[0]?.promptLibrarySettings?.customSites;
          return customSites && customSites[0]?.enabled === false;
        }
      );
      expect(saveCall).toBeDefined();
    });
  });

  it('renders custom sites with remove button and removes on click', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();

    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      promptLibrarySettings: {
        enabledSites: ['chatgpt.com'],
        customSites: [
          {
            hostname: 'removable.example.com',
            displayName: 'Removable Site',
            enabled: true,
            dateAdded: Date.now()
          }
        ],
        debugMode: false,
        floatingFallback: true
      },
      interfaceMode: 'popup',
      settings: DEFAULT_SETTINGS
    });

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    expect(screen.getByText('Removable Site')).toBeInTheDocument();

    // Click the Remove button for the custom site
    const removeButton = screen.getByRole('button', { name: /remove/i });
    await userEvent.click(removeButton);

    // Verify saveSettings was called with the custom site removed
    await waitFor(() => {
      const setCalls = (chromeMock.storage.local.set as Mock).mock.calls;
      const saveCall = setCalls.find(
        (call: any[]) => {
          const customSites = call[0]?.promptLibrarySettings?.customSites;
          return customSites && customSites.length === 0;
        }
      );
      expect(saveCall).toBeDefined();
    });
  });

  it('handles saveSettings error gracefully without crashing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // Make storage.local.set reject for the next call
    (chromeMock.storage.local.set as Mock).mockRejectedValueOnce(new Error('Write failed'));

    // Toggle a site to trigger debounced save
    const chatgptToggle = screen.getByRole('switch', { name: /enable chatgpt integration/i });
    await userEvent.click(chatgptToggle);

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // The component should still be functional (no crash)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('handles handleInterfaceModeChange error gracefully', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();

    await renderSettings();
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // Make storage.local.set reject for the interface mode change
    (chromeMock.storage.local.set as Mock).mockRejectedValueOnce(new Error('Permission denied'));

    const sidePanelOption = screen.getByRole('radio', { name: /select side panel mode/i });
    await userEvent.click(sidePanelOption);

    // Component should not crash - settings heading still visible
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    });
  });
});
