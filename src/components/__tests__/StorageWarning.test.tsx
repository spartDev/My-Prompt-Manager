import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { StorageManager } from '../../services/storage';
import StorageWarning from '../StorageWarning';

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true
});

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

  describe('warning levels', () => {
    it('should render with safe warning level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(50, 'safe')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });

      expect(screen.getByText('Storage Warning')).toBeInTheDocument();
      expect(screen.getByText(/You have plenty of space available/)).toBeInTheDocument();
    });

    it('should render with warning level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(75, 'warning')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument();
      });

      expect(screen.getByText('Storage Warning')).toBeInTheDocument();
      expect(screen.getByText(/storage is getting low/)).toBeInTheDocument();
    });

    it('should render with critical warning level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(90, 'critical')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('90%')).toBeInTheDocument();
      });

      expect(screen.getByText('Critical Storage Warning')).toBeInTheDocument();
      expect(screen.getByText(/critically low/)).toBeInTheDocument();
    });

    it('should render with danger warning level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(98, 'danger')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('98%')).toBeInTheDocument();
      });

      expect(screen.getByText('Storage Limit Reached')).toBeInTheDocument();
      expect(screen.getByText(/storage is full/)).toBeInTheDocument();
    });
  });

  describe('storage percentage display', () => {
    it('should display correct storage percentage in header', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(65, 'safe')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('65%')).toBeInTheDocument();
      });
    });

    it('should display percentage in warning message', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(82, 'warning')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/82% used/)).toBeInTheDocument();
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

      render(<StorageWarning onClose={mockOnClose} />);

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

      render(<StorageWarning onClose={mockOnClose} />);

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

      render(<StorageWarning onClose={mockOnClose} />);

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

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('0 Bytes')).toBeInTheDocument();
      });
    });
  });

  describe('Clear All Data button visibility', () => {
    it('should not show Clear All Data button for safe level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(50, 'safe')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Continue')).toBeInTheDocument();
      });

      expect(screen.queryByText('Clear All Data')).not.toBeInTheDocument();
    });

    it('should not show Clear All Data button for warning level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(75, 'warning')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Continue')).toBeInTheDocument();
      });

      expect(screen.queryByText('Clear All Data')).not.toBeInTheDocument();
    });

    it('should not show Clear All Data button for critical level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(90, 'critical')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Continue')).toBeInTheDocument();
      });

      expect(screen.queryByText('Clear All Data')).not.toBeInTheDocument();
    });

    it('should show Clear All Data button for danger level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(98, 'danger')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clear All Data' })).toBeInTheDocument();
      });
    });
  });

  describe('confirmation dialog flow', () => {
    it('should show confirmation dialog when Clear All Data is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(98, 'danger')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clear All Data' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Clear All Data' }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(screen.getByText(/Are you sure you want to clear all data/)).toBeInTheDocument();
    });

    it('should close confirmation dialog when Cancel is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(98, 'danger')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clear All Data' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Clear All Data' }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should clear data and reload when confirmation is accepted', async () => {
      const user = userEvent.setup();
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(98, 'danger')
      );
      vi.mocked(mockStorageManager.clearAllData).mockResolvedValue(undefined);

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clear All Data' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Clear All Data' }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Find the confirm button in the dialog (there are two "Clear All Data" buttons)
      const confirmButtons = screen.getAllByRole('button', { name: 'Clear All Data' });
      const dialogConfirmButton = confirmButtons.find(btn =>
        btn.closest('[role="dialog"]')
      );

      expect(dialogConfirmButton).toBeDefined();
      if (dialogConfirmButton) {
        await user.click(dialogConfirmButton);
      }

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

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('progress bar colors', () => {
    it('should render green progress bar for safe level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(50, 'safe')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        const progressBar = document.querySelector('.bg-green-500');
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('should render yellow progress bar for warning level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(75, 'warning')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        const progressBar = document.querySelector('.bg-yellow-500');
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('should render orange progress bar for critical level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(90, 'critical')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        const progressBar = document.querySelector('.bg-orange-500');
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('should render red progress bar for danger level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(98, 'danger')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        const progressBar = document.querySelector('.bg-red-500');
        expect(progressBar).toBeInTheDocument();
      });
    });
  });

  describe('icon colors', () => {
    it('should render green icon for safe level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(50, 'safe')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        const icon = document.querySelector('.text-green-500');
        expect(icon).toBeInTheDocument();
      });
    });

    it('should render yellow icon for warning level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(75, 'warning')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        const icon = document.querySelector('.text-yellow-500');
        expect(icon).toBeInTheDocument();
      });
    });

    it('should render orange icon for critical level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(90, 'critical')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        const icon = document.querySelector('.text-orange-500');
        expect(icon).toBeInTheDocument();
      });
    });

    it('should render red icon for danger level', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(98, 'danger')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        const icon = document.querySelector('.text-red-500');
        expect(icon).toBeInTheDocument();
      });
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

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clear All Data' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Clear All Data' }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButtons = screen.getAllByRole('button', { name: 'Clear All Data' });
      const dialogConfirmButton = confirmButtons.find(btn =>
        btn.closest('[role="dialog"]')
      );

      expect(dialogConfirmButton).toBeDefined();
      if (dialogConfirmButton) {
        await user.click(dialogConfirmButton);
      }

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

      render(<StorageWarning onClose={mockOnClose} />);

      // Should still render the component with default values
      await waitFor(() => {
        expect(screen.getByText('Storage Warning')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });
  });

  describe('help text', () => {
    it('should display tip about exporting data', async () => {
      vi.mocked(mockStorageManager.getStorageUsageWithWarnings).mockResolvedValue(
        createStorageInfo(50, 'safe')
      );

      render(<StorageWarning onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/export your data before clearing/)).toBeInTheDocument();
      });
    });
  });
});
