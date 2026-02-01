import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import AboutSection from '../AboutSection';

describe('AboutSection', () => {
  const mockOnReset = vi.fn();
  const defaultProps = {
    version: '1.0.0',
    onReset: mockOnReset
  };

  beforeEach(() => {
    mockOnReset.mockClear();
    mockOnReset.mockResolvedValue(undefined);
  });

  describe('Expand/Collapse Behavior', () => {
    it('renders collapsed by default', () => {
      render(<AboutSection {...defaultProps} />);

      expect(screen.getByText('About & Reset')).toBeInTheDocument();
      expect(screen.queryByText('Extension Information')).not.toBeInTheDocument();
    });

    it('expands when header is clicked', () => {
      render(<AboutSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { expanded: false });
      fireEvent.click(expandButton);

      expect(screen.getByText('Extension Information')).toBeInTheDocument();
      expect(screen.getByText('Help & Support')).toBeInTheDocument();
      expect(screen.getByText('Reset Settings')).toBeInTheDocument();
    });

    it('collapses when header is clicked again', () => {
      render(<AboutSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { expanded: false });

      // Expand
      fireEvent.click(expandButton);
      expect(screen.getByText('Extension Information')).toBeInTheDocument();

      // Collapse
      fireEvent.click(expandButton);
      expect(screen.queryByText('Extension Information')).not.toBeInTheDocument();
    });

    it('has correct aria-expanded attribute', () => {
      render(<AboutSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { expanded: false });
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(expandButton);
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Version Information', () => {
    it('displays the version number', () => {
      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      expect(screen.getByText('1.0.0')).toBeInTheDocument();
    });

    it('displays author information', () => {
      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      expect(screen.getByText('Thomas Roux')).toBeInTheDocument();
    });

    it('displays license information', () => {
      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      expect(screen.getByText('MIT')).toBeInTheDocument();
    });
  });

  describe('Help & Support Links', () => {
    it('renders GitHub repository link', () => {
      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const link = screen.getByRole('link', { name: /github repository/i });
      expect(link).toHaveAttribute('href', 'https://github.com/spartDev/My-Prompt-Manager');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders Report an Issue link', () => {
      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const link = screen.getByRole('link', { name: /report an issue/i });
      expect(link).toHaveAttribute('href', 'https://github.com/spartDev/My-Prompt-Manager/issues');
    });

    it('renders Documentation link', () => {
      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const link = screen.getByRole('link', { name: /documentation/i });
      expect(link).toHaveAttribute('href', 'https://github.com/spartDev/My-Prompt-Manager/wiki');
    });
  });

  describe('Reset Confirmation Flow', () => {
    it('shows Reset to Defaults button initially', () => {
      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      expect(screen.getByRole('button', { name: /reset to defaults/i })).toBeInTheDocument();
      expect(screen.queryByText(/this will reset all settings/i)).not.toBeInTheDocument();
    });

    it('shows confirmation dialog when Reset to Defaults is clicked', () => {
      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));
      fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));

      expect(screen.getByText(/this will reset all settings to defaults/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /yes, reset settings/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('hides confirmation dialog when Cancel is clicked', () => {
      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));
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
      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));
      fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
      fireEvent.click(screen.getByRole('button', { name: /yes, reset settings/i }));

      await waitFor(() => {
        expect(mockOnReset).toHaveBeenCalledTimes(1);
      });
    });

    it('shows "Resetting..." text while reset is in progress', async () => {
      const resolver = { resolve: () => {} };
      mockOnReset.mockImplementation(() => new Promise<void>((resolve) => {
        resolver.resolve = resolve;
      }));

      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));
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
      const resolver = { resolve: () => {} };
      mockOnReset.mockImplementation(() => new Promise<void>((resolve) => {
        resolver.resolve = resolve;
      }));

      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));
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
      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));
      fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
      fireEvent.click(screen.getByRole('button', { name: /yes, reset settings/i }));

      await waitFor(() => {
        expect(screen.queryByText(/this will reset all settings/i)).not.toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /reset to defaults/i })).toBeInTheDocument();
    });

    it('handles reset error gracefully', async () => {
      mockOnReset.mockRejectedValue(new Error('Reset failed'));

      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));
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

  describe('Accessibility', () => {
    it('section has proper heading structure', () => {
      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      // Main section header
      expect(screen.getByRole('heading', { name: /about & reset/i })).toBeInTheDocument();

      // Sub-section headers
      expect(screen.getByText('Extension Information')).toBeInTheDocument();
      expect(screen.getByText('Help & Support')).toBeInTheDocument();
      expect(screen.getByText('Reset Settings')).toBeInTheDocument();
    });

    it('external links have proper security attributes', () => {
      render(<AboutSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });
  });
});
