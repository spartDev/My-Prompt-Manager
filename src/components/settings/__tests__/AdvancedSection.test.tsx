import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import AdvancedSection from '../AdvancedSection';

describe('AdvancedSection', () => {
  const mockOnDebugModeChange = vi.fn();
  const defaultProps = {
    debugMode: false,
    onDebugModeChange: mockOnDebugModeChange,
    saving: false
  };

  beforeEach(() => {
    mockOnDebugModeChange.mockClear();
  });

  describe('Expand/Collapse Behavior', () => {
    it('renders collapsed by default', () => {
      render(<AdvancedSection {...defaultProps} />);

      expect(screen.getByText('Advanced')).toBeInTheDocument();
      expect(screen.queryByText('Developer Options')).not.toBeInTheDocument();
    });

    it('expands when header is clicked', () => {
      render(<AdvancedSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { expanded: false });
      fireEvent.click(expandButton);

      expect(screen.getByText('Developer Options')).toBeInTheDocument();
      expect(screen.getByText('Debug Mode')).toBeInTheDocument();
    });

    it('collapses when header is clicked again', () => {
      render(<AdvancedSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { expanded: false });

      // Expand
      fireEvent.click(expandButton);
      expect(screen.getByText('Developer Options')).toBeInTheDocument();

      // Collapse
      fireEvent.click(expandButton);
      expect(screen.queryByText('Developer Options')).not.toBeInTheDocument();
    });

    it('has correct aria-expanded attribute', () => {
      render(<AdvancedSection {...defaultProps} />);

      const expandButton = screen.getByRole('button', { expanded: false });
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(expandButton);
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Debug Mode Toggle', () => {
    it('renders debug mode toggle switch', () => {
      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      expect(screen.getByRole('switch', { name: /debug mode/i })).toBeInTheDocument();
    });

    it('shows toggle as unchecked when debugMode is false', () => {
      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const toggle = screen.getByRole('switch', { name: /debug mode/i });
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    it('shows toggle as checked when debugMode is true', () => {
      render(<AdvancedSection {...defaultProps} debugMode={true} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const toggle = screen.getByRole('switch', { name: /debug mode/i });
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });

    it('calls onDebugModeChange when toggle is clicked', () => {
      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const toggle = screen.getByRole('switch', { name: /debug mode/i });
      fireEvent.click(toggle);

      expect(mockOnDebugModeChange).toHaveBeenCalledWith(true);
    });

    it('calls onDebugModeChange with false when toggle is already on', () => {
      render(<AdvancedSection {...defaultProps} debugMode={true} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const toggle = screen.getByRole('switch', { name: /debug mode/i });
      fireEvent.click(toggle);

      expect(mockOnDebugModeChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Debug Mode Status Message', () => {
    it('does not show debug status message when debugMode is false', () => {
      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      expect(screen.queryByText(/debug logging is now active/i)).not.toBeInTheDocument();
    });

    it('shows debug status message when debugMode is true', () => {
      render(<AdvancedSection {...defaultProps} debugMode={true} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      expect(screen.getByText(/debug logging is now active/i)).toBeInTheDocument();
    });
  });

  describe('Disabled State (Saving)', () => {
    it('disables toggle when saving is true', () => {
      render(<AdvancedSection {...defaultProps} saving={true} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const toggle = screen.getByRole('switch', { name: /debug mode/i });
      expect(toggle).toBeDisabled();
    });

    it('toggle is enabled when saving is false', () => {
      render(<AdvancedSection {...defaultProps} saving={false} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const toggle = screen.getByRole('switch', { name: /debug mode/i });
      expect(toggle).not.toBeDisabled();
    });

    it('does not call onDebugModeChange when toggle is disabled', () => {
      render(<AdvancedSection {...defaultProps} saving={true} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const toggle = screen.getByRole('switch', { name: /debug mode/i });
      fireEvent.click(toggle);

      expect(mockOnDebugModeChange).not.toHaveBeenCalled();
    });
  });

  describe('Section Content', () => {
    it('displays section subtitle', () => {
      render(<AdvancedSection {...defaultProps} />);

      expect(screen.getByText('Developer and advanced options')).toBeInTheDocument();
    });

    it('displays debug mode description', () => {
      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      expect(screen.getByText(/enable console logging for development/i)).toBeInTheDocument();
    });

    it('displays help tooltip icon', () => {
      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      // The tooltip text should be in the DOM (even if visually hidden until hover)
      expect(screen.getByText(/enable detailed console logging for debugging/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      render(<AdvancedSection {...defaultProps} />);

      expect(screen.getByRole('heading', { name: /advanced/i })).toBeInTheDocument();
    });

    it('has accessible label for toggle switch', () => {
      render(<AdvancedSection {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const toggle = screen.getByRole('switch', { name: /debug mode/i });
      expect(toggle).toBeInTheDocument();
    });
  });
});
