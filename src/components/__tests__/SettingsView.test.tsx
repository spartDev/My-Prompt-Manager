import { render, screen, waitFor, act } from '@testing-library/react';
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

interface RenderSettingsOptions {
  showToastMock?: ReturnType<typeof vi.fn>;
  onBackMock?: ReturnType<typeof vi.fn>;
  onToastSettingsChangeMock?: ReturnType<typeof vi.fn>;
}

const renderSettings = async (showToastMockOrOpts: ReturnType<typeof vi.fn> | RenderSettingsOptions = vi.fn()) => {
  const opts: RenderSettingsOptions = typeof showToastMockOrOpts === 'function'
    ? { showToastMock: showToastMockOrOpts }
    : showToastMockOrOpts;

  const showToastMock = opts.showToastMock ?? vi.fn();
  const onBackMock = opts.onBackMock ?? vi.fn();
  const onToastSettingsChangeMock = opts.onToastSettingsChangeMock ?? vi.fn();

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
        onBack={onBackMock as unknown as () => void}
        showToast={showToastMock as unknown as (message: string, type?: any) => void}
        toastSettings={mockToastSettings}
        onToastSettingsChange={onToastSettingsChangeMock as unknown as (settings: any) => void}
      />
    </ThemeProvider>
  );

  await screen.findByRole('heading', { name: /settings/i });
  return { showToastMock, onBackMock, onToastSettingsChangeMock };
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
    (chromeMock.storage.local.get as Mock).mockReturnValue(new Promise(() => {}));

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

    expect(screen.getByText(/loading settings/i)).toBeInTheDocument();
  });

  it('falls back to default settings when loadSettings throws', async () => {
    const chromeMock = getChromeMockFunctions();
    (chromeMock.storage.local.get as Mock).mockRejectedValue(new Error('Storage access denied'));

    await act(async () => {
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
        return call[0]?.promptLibrarySettings && (!sites || !sites.includes('chatgpt.com'));
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
        (call: any[]) => call[0]?.promptLibrarySettings?.enabledSites?.includes('claude.ai')
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

  it('calls onBack when back button is clicked', async () => {
    const storageMock = getMockStorageManager();
    const onBackMock = vi.fn();

    const { onBackMock: capturedBack } = await renderSettings({ onBackMock });
    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    const backButton = screen.getByRole('button', { name: /back/i });
    await userEvent.click(backButton);

    expect(capturedBack).toHaveBeenCalledTimes(1);
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
