import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdvancedSection from '../AdvancedSection';

describe('AdvancedSection', () => {
  const mockOnDebugModeChange = vi.fn();
  const mockOnReset = vi.fn<() => Promise<void>>();
  const defaultProps = {
    debugMode: false,
    onDebugModeChange: mockOnDebugModeChange,
    saving: false,
    onReset: mockOnReset
  };

  beforeEach(() => {
    mockOnDebugModeChange.mockClear();
    mockOnReset.mockReset();
    mockOnReset.mockResolvedValue(undefined);
  });

  describe('Group', () => {
    it('is the Advanced group, open from the start', () => {
      render(<AdvancedSection {...defaultProps} />);

      expect(screen.getByRole('region', { name: 'Advanced' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Advanced' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { expanded: false })).not.toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Debug mode' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset to Defaults' })).toBeInTheDocument();
    });
  });

  describe('Debug mode', () => {
    it('reflects debugMode', () => {
      const { rerender } = render(<AdvancedSection {...defaultProps} />);
      expect(screen.getByRole('switch', { name: 'Debug mode' })).toHaveAttribute('aria-checked', 'false');

      rerender(<AdvancedSection {...defaultProps} debugMode={true} />);
      expect(screen.getByRole('switch', { name: 'Debug mode' })).toHaveAttribute('aria-checked', 'true');
    });

    it('asks for the opposite state', () => {
      const { rerender } = render(<AdvancedSection {...defaultProps} />);
      fireEvent.click(screen.getByRole('switch', { name: 'Debug mode' }));
      expect(mockOnDebugModeChange).toHaveBeenLastCalledWith(true);

      rerender(<AdvancedSection {...defaultProps} debugMode={true} />);
      fireEvent.click(screen.getByRole('switch', { name: 'Debug mode' }));
      expect(mockOnDebugModeChange).toHaveBeenLastCalledWith(false);
    });

    it('says debug logging is active only while it is on', () => {
      const { rerender } = render(<AdvancedSection {...defaultProps} />);
      expect(screen.queryByText(/debug logging is now active/i)).not.toBeInTheDocument();

      rerender(<AdvancedSection {...defaultProps} debugMode={true} />);
      expect(screen.getByText(/debug logging is now active/i)).toBeInTheDocument();
    });

    it('cannot change while Settings saves', () => {
      render(<AdvancedSection {...defaultProps} saving={true} />);

      const toggle = screen.getByRole('switch', { name: 'Debug mode' });
      expect(toggle).toBeDisabled();
      fireEvent.click(toggle);
      expect(mockOnDebugModeChange).not.toHaveBeenCalled();
    });
  });

  describe('Reset Confirmation Flow', () => {
    it('shows Reset to Defaults button initially', () => {
      render(<AdvancedSection {...defaultProps} />);


      expect(screen.getByRole('button', { name: /reset to defaults/i })).toBeInTheDocument();
      expect(screen.queryByText(/this will reset all settings/i)).not.toBeInTheDocument();
    });

    it('shows confirmation dialog when Reset to Defaults is clicked', () => {
      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));

      expect(screen.getByText(/this will reset all settings to defaults/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /yes, reset settings/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('hides confirmation dialog when Cancel is clicked', () => {
      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));

      // Confirmation visible
      expect(screen.getByText(/this will reset all settings/i)).toBeInTheDocument();

      // Cancel
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      // Confirmation hidden
      expect(screen.queryByText(/this will reset all settings/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset to defaults/i })).toBeInTheDocument();
    });

    it('calls onReset when confirm button is clicked', async () => {
      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
      fireEvent.click(screen.getByRole('button', { name: /yes, reset settings/i }));

      await waitFor(() => {
        expect(mockOnReset).toHaveBeenCalledTimes(1);
      });
    });

    it('shows "Resetting..." text while reset is in progress', async () => {
      const resolver = { resolve: () => { /* replaced by the pending reset's resolve */ } };
      mockOnReset.mockImplementation(() => new Promise<void>((resolve) => {
        resolver.resolve = resolve;
      }));

      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
      fireEvent.click(screen.getByRole('button', { name: /yes, reset settings/i }));

      // Should show "Resetting..." while in progress
      expect(screen.getByText('Resetting...')).toBeInTheDocument();

      // Resolve the promise
      resolver.resolve();

      await waitFor(() => {
        expect(screen.queryByText('Resetting...')).not.toBeInTheDocument();
      });
    });

    it('disables buttons while reset is in progress', async () => {
      const resolver = { resolve: () => { /* replaced by the pending reset's resolve */ } };
      mockOnReset.mockImplementation(() => new Promise<void>((resolve) => {
        resolver.resolve = resolve;
      }));

      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
      fireEvent.click(screen.getByRole('button', { name: /yes, reset settings/i }));

      // Both buttons should be disabled
      expect(screen.getByText('Resetting...')).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

      // Resolve the promise
      resolver.resolve();

      await waitFor(() => {
        expect(screen.queryByText('Resetting...')).not.toBeInTheDocument();
      });
    });

    it('hides confirmation after successful reset', async () => {
      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
      fireEvent.click(screen.getByRole('button', { name: /yes, reset settings/i }));

      await waitFor(() => {
        expect(screen.queryByText(/this will reset all settings/i)).not.toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /reset to defaults/i })).toBeInTheDocument();
    });

    it('handles reset error gracefully', async () => {
      mockOnReset.mockRejectedValue(new Error('Reset failed'));

      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
      fireEvent.click(screen.getByRole('button', { name: /yes, reset settings/i }));

      // Should recover from error and not crash
      await waitFor(() => {
        expect(screen.queryByText('Resetting...')).not.toBeInTheDocument();
      });

      // Confirmation should still be visible after error (not auto-hidden)
      expect(screen.getByText(/this will reset all settings/i)).toBeInTheDocument();
    });
  });

});
