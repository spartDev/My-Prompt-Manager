import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';

import { ThemeProvider } from '../../contexts/ThemeContext';
import { backupManager } from '../../services/backupManager';
import { getChromeMockFunctions, getMockStorageManager } from '../../test/mocks';
import { DEFAULT_SETTINGS } from '../../types';
import SettingsView from '../SettingsView';

const renderSettings = async (showToast = vi.fn()) => {
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
        showToast={showToast}
        toastSettings={mockToastSettings}
        onToastSettingsChange={vi.fn()}
      />
    </ThemeProvider>
  );

  await screen.findByRole('heading', { name: /settings/i });
  return showToast;
};

describe('SettingsView', () => {
  beforeEach(() => {
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

    getMockStorageManager();
  });

  it('disables encrypted backups without a password', async () => {
    const createSpy = vi.spyOn(backupManager, 'createBackup').mockResolvedValue({
      fileName: 'test.json',
      blob: new Blob(['{}'], { type: 'application/json' }),
      metadata: {
        version: '2.0.0',
        createdAt: Date.now(),
        promptCount: 0,
        categoryCount: 0,
        settingsIncluded: false,
        encrypted: true,
        checksum: 'abc',
        fileSize: 0
      },
      raw: {} as never
    });

    await renderSettings();

    const encryptionToggle = await screen.findByLabelText(/password protect backup/i);
    await userEvent.click(encryptionToggle);

    const createButton = await screen.findByRole('button', { name: /create backup/i });
    expect(createButton).toBeDisabled();

    const passwordInput = await screen.findByPlaceholderText(/encryption password/i);
    await userEvent.type(passwordInput, 'secret');
    expect(createButton).not.toBeDisabled();

    await userEvent.click(createButton);
    await waitFor(() => {
      expect(createSpy).toHaveBeenCalled();
    });

    createSpy.mockRestore();
  });

  it('resets settings to defaults and shows a toast', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();
    const showToast = vi.fn();

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

    await renderSettings(showToast);
    await waitFor(() => {
      expect(chromeMock.storage.local.get as Mock).toHaveBeenCalled();
    });

    const aboutToggle = await screen.findByRole('button', { name: /about & reset/i });
    await userEvent.click(aboutToggle);

    const aboutSection = aboutToggle.closest('section') ?? aboutToggle.parentElement;
    expect(aboutSection).not.toBeNull();

    const resetButton = await within(aboutSection as HTMLElement).findByRole('button', { name: /reset to defaults/i });
    await userEvent.click(resetButton);

    const confirmButton = await screen.findByRole('button', { name: /yes, reset settings/i });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      // enabledSites should match the default platforms sorted by priority (highest first)
      // Claude (100), ChatGPT (90), Mistral (85), Gemini (85), Perplexity (80)
      // Note: When priorities are equal, order depends on Object.values() iteration
      const call = (chromeMock.storage.local.set as Mock).mock.calls[0][0];
      const enabledSites = call.promptLibrarySettings.enabledSites;

      // Verify count
      expect(enabledSites).toHaveLength(5);

      // Verify exact order based on priority (highest first)
      expect(enabledSites[0]).toBe('claude.ai');        // Priority 100
      expect(enabledSites[1]).toBe('chatgpt.com');      // Priority 90
      // Priorities 85: mistral comes before gemini in SUPPORTED_PLATFORMS object order
      expect(enabledSites[2]).toBe('chat.mistral.ai');  // Priority 85
      expect(enabledSites[3]).toBe('gemini.google.com'); // Priority 85
      expect(enabledSites[4]).toBe('www.perplexity.ai'); // Priority 80

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

    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/reset to defaults/i), 'success');
  });

  it('changes the interface mode when a different option is selected', async () => {
    const chromeMock = getChromeMockFunctions();
    await renderSettings();

    const sidePanelOption = await screen.findByRole('radio', { name: /select side panel mode/i });
    await userEvent.click(sidePanelOption);

    await waitFor(() => {
      expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ interfaceMode: 'sidepanel' });
    });
  });
});