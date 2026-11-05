import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

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

const renderSettings = async (showToastMock = vi.fn(), onStorageRefusedMock = vi.fn()) => {
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

      await userEvent.click(await screen.findByRole('switch', { name: 'Enable Claude integration' }));
      await waitPastTheDebounce();

      const writes = siteSettingsWrites();
      expect(writes).toHaveLength(1);
      const saved = (writes[0][0] as { promptLibrarySettings: { enabledSites: string[] } }).promptLibrarySettings;
      expect(saved.enabledSites).not.toContain('claude.ai');
      expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(7, { action: 'settingsUpdated', settings: saved });
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
});
