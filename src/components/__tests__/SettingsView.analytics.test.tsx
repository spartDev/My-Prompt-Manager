import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

import { ThemeProvider } from '../../contexts/ThemeContext';
import { getChromeMockFunctions, getMockStorageManager } from '../../test/mocks';
import { DEFAULT_SETTINGS } from '../../types';
import SettingsView from '../SettingsView';

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

describe('SettingsView - Analytics Toggle', () => {
  beforeEach(() => {
    const chromeMock = getChromeMockFunctions();
    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      promptLibrarySettings: {
        enabledSites: ['chatgpt.com'],
        customSites: []
      },
      interfaceMode: 'popup',
      settings: {
        ...DEFAULT_SETTINGS,
        analyticsEnabled: true
      }
    });
    (chromeMock.storage.local.set as Mock).mockResolvedValue(undefined);
    (chromeMock.tabs.query as Mock).mockResolvedValue([]);
    const storageMock = getMockStorageManager();
    storageMock.getPrompts.mockResolvedValue([]);
    storageMock.getCategories.mockResolvedValue([]);
  });

  it('should display analytics toggle in settings', async () => {
    await renderSettings();

    await waitFor(() => {
      expect(screen.getByText(/Enable Usage Analytics/i)).toBeInTheDocument();
    });

    // Verify description text
    expect(screen.getByText(/Track prompt usage and unlock achievements/i)).toBeInTheDocument();
  });

  it('should toggle analytics setting when clicked', async () => {
    const chromeMock = getChromeMockFunctions();
    const storageMock = getMockStorageManager();

    await renderSettings();

    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    // Find and click the analytics toggle
    const toggle = await screen.findByRole('switch', { name: /analytics/i });
    await userEvent.click(toggle);

    // Verify setting was saved
    await waitFor(() => {
      expect(storageMock.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          analyticsEnabled: expect.any(Boolean)
        })
      );
    });
  });

  it('should default analytics to enabled for new users', async () => {
    const chromeMock = getChromeMockFunctions();
    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      promptLibrarySettings: {
        enabledSites: ['chatgpt.com'],
        customSites: []
      },
      interfaceMode: 'popup',
      settings: DEFAULT_SETTINGS // No analyticsEnabled set
    });

    const storageMock = getMockStorageManager();
    storageMock.getPrompts.mockResolvedValue([]);
    storageMock.getCategories.mockResolvedValue([]);

    await renderSettings();

    await waitFor(() => {
      const toggle = screen.getByRole('switch', { name: /analytics/i });
      expect(toggle).toBeChecked();
    });
  });
});
