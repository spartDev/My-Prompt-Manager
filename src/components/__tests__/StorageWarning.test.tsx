import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StorageManager } from '../../services/storage';
import StorageWarning from '../StorageWarning';

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true
});

const REASON = 'Storage quota exceeded. Please delete old prompts to free up space.';

describe('StorageWarning', () => {
  const mockOnClose = vi.fn();
  let mockStorageManager: ReturnType<typeof StorageManager.getInstance>;

  beforeEach(() => {
    mockOnClose.mockClear();
    mockReload.mockClear();
    mockStorageManager = StorageManager.getInstance();
  });

  const createStorageInfo = (percentage: number, warningLevel: 'safe' | 'warning' | 'critical' | 'danger') => ({
    used: percentage * 52428.8, // percentage of 5MB
    total: 5242880, // 5MB
    percentage,
    warningLevel
  });

  // The warning opens only after a refused save, and the app's own limits (5,000 Prompts, 8 MB
  // estimated) can refuse it while Chrome storage is far from full
  describe.each([
    ['safe', 40],
    ['warning', 75],
    ['critical', 90],
    ['danger', 98]
  ] as const)('a save refused at the %s level', (level, percentage) => {
    it('says the limit is reached, gives the reason and offers to clear the data', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(percentage, level)
      );

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(`${String(percentage)}%`)).toBeInTheDocument();
      });
      expect(screen.getByRole('dialog', { name: 'Storage Limit Reached' })).toBeInTheDocument();
      expect(screen.getByText(REASON)).toBeInTheDocument();
      expect(screen.queryByText(/plenty of space|getting low|critically low/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear All Data' })).toBeInTheDocument();
    });
  });

  // A modal: the keyboard handles the warning first, and the form behind it is out of reach
  describe('keyboard', () => {
    it('focuses Continue when it opens', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(createStorageInfo(40, 'safe'));

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus();
      });
    });

    it('keeps Tab and Shift+Tab between its two buttons', async () => {
      const user = userEvent.setup();
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(createStorageInfo(40, 'safe'));
      render(
        <>
          <button type="button">Save Prompt</button>
          <StorageWarning reason={REASON} onClose={mockOnClose} />
          <button type="button">After</button>
        </>
      );
      const continueButton = screen.getByRole('button', { name: 'Continue' });
      const clearButton = screen.getByRole('button', { name: 'Clear All Data' });
      await waitFor(() => { expect(continueButton).toHaveFocus(); });

      await user.tab({ shift: true });
      expect(clearButton).toHaveFocus();
      await user.tab();
      expect(continueButton).toHaveFocus();
      await user.tab();
      expect(clearButton).toHaveFocus();
      await user.tab();
      expect(continueButton).toHaveFocus();
    });

    it('closes on Escape, like Continue', async () => {
      const user = userEvent.setup();
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(createStorageInfo(40, 'safe'));
      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);
      await waitFor(() => { expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus(); });

      await user.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('leaves the keyboard to the Clear All Data confirmation, then takes it back on Clear All Data', async () => {
      const user = userEvent.setup();
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(createStorageInfo(40, 'safe'));
      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);
      await waitFor(() => { expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus(); });

      await user.click(screen.getByRole('button', { name: 'Clear All Data' }));
      const confirmation = screen.getByRole('dialog', { name: 'Clear All Data' });
      expect(within(confirmation).getByRole('button', { name: 'Cancel' })).toHaveFocus();
      await user.tab();
      expect(within(confirmation).getByRole('button', { name: 'Clear All Data' })).toHaveFocus();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog', { name: 'Clear All Data' })).not.toBeInTheDocument();
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Clear All Data' })).toHaveFocus();
    });
  });

  describe('storage percentage display', () => {
    it('should display correct storage percentage in header', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(65, 'safe')
      );

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('65%')).toBeInTheDocument();
      });
    });
  });

  describe('byte formatting', () => {
    it('should format bytes correctly', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue({
        used: 1024,
        total: 5242880,
        percentage: 0.02,
        warningLevel: 'safe'
      });

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('1 KB')).toBeInTheDocument();
      });
    });

    it('should format megabytes correctly', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue({
        used: 2097152, // 2MB
        total: 5242880, // 5MB
        percentage: 40,
        warningLevel: 'safe'
      });

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('2 MB')).toBeInTheDocument();
        expect(screen.getByText('5 MB')).toBeInTheDocument();
      });
    });

    it('should format gigabytes correctly', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue({
        used: 1073741824, // 1GB
        total: 2147483648, // 2GB
        percentage: 50,
        warningLevel: 'safe'
      });

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('1 GB')).toBeInTheDocument();
        expect(screen.getByText('2 GB')).toBeInTheDocument();
      });
    });

    it('should display 0 Bytes for empty storage', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue({
        used: 0,
        total: 5242880,
        percentage: 0,
        warningLevel: 'safe'
      });

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('0 Bytes')).toBeInTheDocument();
      });
    });
  });

  describe('confirmation dialog flow', () => {
    it('should show confirmation dialog when Clear All Data is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(98, 'danger')
      );

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clear All Data' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Clear All Data' }));

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Clear All Data' })).toBeInTheDocument();
      });

      expect(screen.getByText(/Are you sure you want to clear all data/)).toBeInTheDocument();
    });

    it('should close confirmation dialog when Cancel is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(98, 'danger')
      );

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clear All Data' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Clear All Data' }));

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Clear All Data' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Clear All Data' })).not.toBeInTheDocument();
      });
    });

    it('should clear data and reload when confirmation is accepted', async () => {
      const user = userEvent.setup();
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(98, 'danger')
      );
      vi.mocked(mockStorageManager.clearAllData).mockResolvedValue(undefined);

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clear All Data' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Clear All Data' }));

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Clear All Data' })).toBeInTheDocument();
      });

      // The confirmation has its own "Clear All Data" button
      const confirmDialog = screen.getByRole('dialog', { name: 'Clear All Data' });
      await user.click(within(confirmDialog).getByRole('button', { name: 'Clear All Data' }));

      await waitFor(() => {
        expect(mockStorageManager.clearAllData).toHaveBeenCalled();
      });

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockReload).toHaveBeenCalled();
    });
  });

  describe('Continue button', () => {
    it('should call onClose when Continue button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(50, 'safe')
      );

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  // The bar keeps one state family per level (success, warning with critical, danger); the icon
  // stays danger, since the save was refused
  describe.each([
    ['safe', 50, 'bg-success'],
    ['warning', 75, 'bg-warning'],
    ['critical', 90, 'bg-warning'],
    ['danger', 98, 'bg-danger']
  ] as const)('%s level', (level, percentage, barClass) => {
    it(`colors the progress bar ${barClass} and the icon text-danger`, async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(percentage, level)
      );

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(document.querySelector(`[style*="width: ${String(percentage)}%"]`)).toHaveClass(barClass);
      });
      expect(document.querySelector('svg.h-8')).toHaveClass('text-danger');
    });
  });

  describe('loading state', () => {
    it('should show Clearing... text during data clear', async () => {
      const user = userEvent.setup();
      let resolveClears: (() => void) | undefined;
      const clearPromise = new Promise<void>(resolve => {
        resolveClears = resolve;
      });

      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(98, 'danger')
      );
      vi.mocked(mockStorageManager.clearAllData).mockImplementation(() => clearPromise);

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clear All Data' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Clear All Data' }));

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Clear All Data' })).toBeInTheDocument();
      });

      const confirmDialog = screen.getByRole('dialog', { name: 'Clear All Data' });
      await user.click(within(confirmDialog).getByRole('button', { name: 'Clear All Data' }));

      await waitFor(() => {
        expect(screen.getByText('Clearing...')).toBeInTheDocument();
      });

      // Resolve the pending clear promise
      if (resolveClears) {
        resolveClears();
      }
    });
  });

  describe('error handling', () => {
    it('should handle storage info fetch error gracefully', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockRejectedValue(
        new Error('Failed to get storage info')
      );

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      // Still says why the save was refused, without the usage figures
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Storage Limit Reached' })).toBeInTheDocument();
      });
      expect(screen.getByText(REASON)).toBeInTheDocument();

      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });
  });

  describe('help text', () => {
    it('should display tip about exporting data', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(50, 'safe')
      );

      render(<StorageWarning reason={REASON} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/export your data before clearing/)).toBeInTheDocument();
      });
    });
  });
});
