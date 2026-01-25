import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

import { ThemeProvider } from '../../contexts/ThemeContext';
import { getChromeMockFunctions, getMockStorageManager } from '../../test/mocks';
import { DEFAULT_SETTINGS } from '../../types';
import { Logger } from '../../utils';
import ThemeToggle from '../ThemeToggle';

vi.mock('../../utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils')>();
  return {
    ...actual,
    Logger: {
      ...actual.Logger,
      error: vi.fn()
    }
  };
});

const renderThemeToggle = async (initialTheme: 'light' | 'dark' | 'system' = 'light') => {
  const chromeMock = getChromeMockFunctions();
  const storageMock = getMockStorageManager();

  (chromeMock.storage.local.get as Mock).mockResolvedValue({
    settings: {
      ...DEFAULT_SETTINGS,
      theme: initialTheme
    }
  });

  storageMock.getSettings.mockResolvedValue({
    ...DEFAULT_SETTINGS,
    theme: initialTheme
  });

  vi.mocked(storageMock.updateSettings).mockResolvedValue({
    ...DEFAULT_SETTINGS,
    theme: initialTheme === 'light' ? 'dark' : 'light'
  });

  const user = userEvent.setup();

  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );

  // Wait for theme initialization to complete by checking for theme-specific aria-label
  // This prevents race conditions where assertions run before async theme init finishes
  if (initialTheme === 'dark') {
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
    });
  } else {
    // 'light' or 'system' (which defaults to light in test environment)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument();
    });
  }

  return { user, chromeMock, storageMock };
};

describe('ThemeToggle', () => {
  beforeEach(() => {
    const chromeMock = getChromeMockFunctions();
    (chromeMock.tabs.query as Mock).mockResolvedValue([]);
    vi.mocked(Logger.error).mockReset();
  });

  describe('Rendering', () => {
    it('renders a button with correct styling', async () => {
      await renderThemeToggle('light');

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('p-2', 'rounded-lg', 'transition-colors');
    });

    it('renders moon icon when resolved theme is light', async () => {
      await renderThemeToggle('light');

      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      // Moon icon has stroke but no fill
      expect(svg).toHaveAttribute('stroke', 'currentColor');
      expect(svg).toHaveAttribute('fill', 'none');
    });

    it('renders sun icon when resolved theme is dark', async () => {
      await renderThemeToggle('dark');

      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      // Sun icon has fill but no stroke
      expect(svg).toHaveAttribute('fill', 'currentColor');
      expect(svg).not.toHaveAttribute('stroke');
    });
  });

  describe('Accessibility', () => {
    it('has correct aria-label for light theme (prompts switch to dark)', async () => {
      await renderThemeToggle('light');

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Switch to dark theme');
    });

    it('has correct aria-label for dark theme (prompts switch to light)', async () => {
      await renderThemeToggle('dark');

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Switch to light theme');
    });

    it('has correct title attribute for light theme', async () => {
      await renderThemeToggle('light');

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Switch to dark theme');
    });

    it('has correct title attribute for dark theme', async () => {
      await renderThemeToggle('dark');

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Switch to light theme');
    });
  });

  describe('Theme Toggle Behavior', () => {
    it('toggles from light to dark when clicked', async () => {
      const { user, storageMock } = await renderThemeToggle('light');

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(storageMock.updateSettings).toHaveBeenCalledWith({ theme: 'dark' });
      });
    });

    it('toggles from dark to light when clicked', async () => {
      const { user, storageMock } = await renderThemeToggle('dark');

      vi.mocked(storageMock.updateSettings).mockResolvedValue({
        ...DEFAULT_SETTINGS,
        theme: 'light'
      });

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(storageMock.updateSettings).toHaveBeenCalledWith({ theme: 'light' });
      });
    });

    it('handles system theme with light resolved - toggles to dark', async () => {
      const chromeMock = getChromeMockFunctions();
      const storageMock = getMockStorageManager();

      // Mock matchMedia to return light mode (matches: false for dark scheme)
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false, // Light mode
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn()
        }))
      });

      (chromeMock.storage.local.get as Mock).mockResolvedValue({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: 'system'
        }
      });

      storageMock.getSettings.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        theme: 'system'
      });

      vi.mocked(storageMock.updateSettings).mockResolvedValue({
        ...DEFAULT_SETTINGS,
        theme: 'dark'
      });

      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      );

      // Wait for theme init: system + light resolved shows "switch to dark"
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument();
      });

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(storageMock.updateSettings).toHaveBeenCalledWith({ theme: 'dark' });
      });
    });

    it('handles system theme with dark resolved - toggles to light', async () => {
      const chromeMock = getChromeMockFunctions();
      const storageMock = getMockStorageManager();

      // Mock matchMedia to return dark mode (matches: true for dark scheme)
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: true, // Dark mode
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn()
        }))
      });

      (chromeMock.storage.local.get as Mock).mockResolvedValue({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: 'system'
        }
      });

      storageMock.getSettings.mockResolvedValue({
        ...DEFAULT_SETTINGS,
        theme: 'system'
      });

      vi.mocked(storageMock.updateSettings).mockResolvedValue({
        ...DEFAULT_SETTINGS,
        theme: 'light'
      });

      const user = userEvent.setup();

      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      );

      // Wait for theme init: system + dark resolved shows "switch to light"
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
      });

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(storageMock.updateSettings).toHaveBeenCalledWith({ theme: 'light' });
      });
    });
  });

  describe('Error Handling', () => {
    it('logs error when setTheme fails', async () => {
      const { user, storageMock } = await renderThemeToggle('light');

      const testError = new Error('Storage write error');
      vi.mocked(storageMock.updateSettings).mockRejectedValueOnce(testError);

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        // Error is logged by useTheme hook, not ThemeToggle
        expect(Logger.error).toHaveBeenCalledWith(
          'Failed to update theme',
          expect.any(Error)
        );
      });
    });

    it('continues to function after an error', async () => {
      const { user, storageMock } = await renderThemeToggle('light');

      // First click fails
      vi.mocked(storageMock.updateSettings).mockRejectedValueOnce(new Error('Storage error'));

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(Logger.error).toHaveBeenCalled();
      });

      // Reset mock for successful call
      vi.mocked(storageMock.updateSettings).mockResolvedValue({
        ...DEFAULT_SETTINGS,
        theme: 'dark'
      });

      // Second click should succeed
      await user.click(button);

      await waitFor(() => {
        expect(storageMock.updateSettings).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Icon Display', () => {
    it('displays moon icon with correct classes for light theme', async () => {
      await renderThemeToggle('light');

      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toHaveClass('w-5', 'h-5');
    });

    it('displays sun icon with correct classes for dark theme', async () => {
      await renderThemeToggle('dark');

      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toHaveClass('w-5', 'h-5');
    });
  });
});
