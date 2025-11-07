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
      // enabledSites should match the default platforms sorted by priority (highest first)
      // Claude (100), ChatGPT (90), Mistral (85), Gemini (85), Perplexity (80), Copilot (80)
      // Note: When priorities are equal, order depends on Object.values() iteration
      const call = (chromeMock.storage.local.set as Mock).mock.calls[0][0];
      const enabledSites = call.promptLibrarySettings.enabledSites;

      // Verify count
      expect(enabledSites).toHaveLength(6);

      // Verify exact order based on priority (highest first)
      expect(enabledSites[0]).toBe('claude.ai');        // Priority 100
      expect(enabledSites[1]).toBe('chatgpt.com');      // Priority 90
      // Priorities 85: mistral comes before gemini in SUPPORTED_PLATFORMS object order
      expect(enabledSites[2]).toBe('chat.mistral.ai');  // Priority 85
      expect(enabledSites[3]).toBe('gemini.google.com'); // Priority 85
      // Priorities 80: perplexity comes before copilot in SUPPORTED_PLATFORMS object order
      expect(enabledSites[4]).toBe('www.perplexity.ai'); // Priority 80
      expect(enabledSites[5]).toBe('copilot.microsoft.com'); // Priority 80

      expect(call.promptLibrarySettings.customSites).toEqual([]);
      expect(call.promptLibrarySettings.debugMode).toBe(false);
      expect(call.promptLibrarySettings.floatingFallback).toBe(true);
      expect(call.interfaceMode).toBe('popup');
    });

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
});
