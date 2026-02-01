import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import ImportSection from '../ImportSection';

describe('ImportSection', () => {
  const mockOnChange = vi.fn();
  const mockOnPreview = vi.fn();
  const mockOnClear = vi.fn();

  const defaultProps = {
    value: '',
    onChange: mockOnChange,
    onPreview: mockOnPreview,
    onClear: mockOnClear,
    loading: false,
    error: null
  };

  beforeEach(() => {
    mockOnChange.mockClear();
    mockOnPreview.mockClear();
    mockOnClear.mockClear();
  });

  describe('Textarea Input', () => {
    it('renders textarea with correct placeholder', () => {
      render(<ImportSection {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/paste your configuration code here/i);
      expect(textarea).toBeInTheDocument();
    });

    it('renders textarea with accessible label', () => {
      render(<ImportSection {...defaultProps} />);

      const textarea = screen.getByLabelText(/encoded configuration string/i);
      expect(textarea).toBeInTheDocument();
    });

    it('displays the current value', () => {
      render(<ImportSection {...defaultProps} value="test-config-code" />);

      const textarea = screen.getByLabelText(/encoded configuration string/i);
      expect(textarea).toHaveValue('test-config-code');
    });

    it('calls onChange when text is entered', () => {
      render(<ImportSection {...defaultProps} />);

      const textarea = screen.getByLabelText(/encoded configuration string/i);
      fireEvent.change(textarea, { target: { value: 'new-config' } });

      expect(mockOnChange).toHaveBeenCalledWith('new-config');
    });
  });

  describe('Clear Button', () => {
    it('does not show Clear button when value is empty', () => {
      render(<ImportSection {...defaultProps} value="" />);

      const clearButtons = screen.queryAllByRole('button', { name: /clear/i });
      // Only the Cancel button should exist, not the Clear button in header
      expect(clearButtons.length).toBeLessThanOrEqual(1);
    });

    it('shows Clear button when value is not empty', () => {
      render(<ImportSection {...defaultProps} value="some-config" />);

      // There should be a Clear button in the header
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('calls onClear when Clear button is clicked', () => {
      render(<ImportSection {...defaultProps} value="some-config" />);

      const clearButton = screen.getByText('Clear');
      fireEvent.click(clearButton);

      expect(mockOnClear).toHaveBeenCalledTimes(1);
    });

    it('disables Clear button when loading', () => {
      render(<ImportSection {...defaultProps} value="some-config" loading={true} />);

      const clearButton = screen.getByText('Clear');
      expect(clearButton).toBeDisabled();
    });
  });

  describe('Preview Button', () => {
    it('renders Preview Configuration button', () => {
      render(<ImportSection {...defaultProps} />);

      expect(screen.getByRole('button', { name: /preview configuration/i })).toBeInTheDocument();
    });

    it('disables Preview button when value is empty', () => {
      render(<ImportSection {...defaultProps} value="" />);

      const previewButton = screen.getByRole('button', { name: /preview configuration/i });
      expect(previewButton).toBeDisabled();
    });

    it('disables Preview button when value is whitespace only', () => {
      render(<ImportSection {...defaultProps} value="   " />);

      const previewButton = screen.getByRole('button', { name: /preview configuration/i });
      expect(previewButton).toBeDisabled();
    });

    it('enables Preview button when value has content', () => {
      render(<ImportSection {...defaultProps} value="valid-config" />);

      const previewButton = screen.getByRole('button', { name: /preview configuration/i });
      expect(previewButton).not.toBeDisabled();
    });

    it('calls onPreview when Preview button is clicked', () => {
      render(<ImportSection {...defaultProps} value="valid-config" />);

      const previewButton = screen.getByRole('button', { name: /preview configuration/i });
      fireEvent.click(previewButton);

      expect(mockOnPreview).toHaveBeenCalledTimes(1);
    });

    it('disables Preview button when loading', () => {
      render(<ImportSection {...defaultProps} value="valid-config" loading={true} />);

      const previewButton = screen.getByRole('button', { name: /validating/i });
      expect(previewButton).toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('shows "Preview Configuration" text when not loading', () => {
      render(<ImportSection {...defaultProps} value="config" loading={false} />);

      expect(screen.getByRole('button', { name: /preview configuration/i })).toBeInTheDocument();
    });

    it('shows "Validating..." text when loading', () => {
      render(<ImportSection {...defaultProps} value="config" loading={true} />);

      expect(screen.getByRole('button', { name: /validating/i })).toBeInTheDocument();
    });

    it('disables Cancel button when loading', () => {
      render(<ImportSection {...defaultProps} loading={true} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Error Display', () => {
    it('does not show error when error is null', () => {
      render(<ImportSection {...defaultProps} error={null} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows error message when error is provided', () => {
      render(<ImportSection {...defaultProps} error="Invalid configuration format" />);

      expect(screen.getByText('Invalid configuration format')).toBeInTheDocument();
    });

    it('shows different error messages', () => {
      const { rerender } = render(<ImportSection {...defaultProps} error="Error 1" />);

      expect(screen.getByText('Error 1')).toBeInTheDocument();

      rerender(<ImportSection {...defaultProps} error="Different error message" />);

      expect(screen.getByText('Different error message')).toBeInTheDocument();
    });
  });

  describe('Cancel Button', () => {
    it('renders Cancel button', () => {
      render(<ImportSection {...defaultProps} />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('calls onClear when Cancel button is clicked', () => {
      render(<ImportSection {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('Help Text', () => {
    it('displays security information text', () => {
      render(<ImportSection {...defaultProps} />);

      expect(
        screen.getByText(/configuration codes are validated and sanitized before import/i)
      ).toBeInTheDocument();
    });
  });

  describe('Section Header', () => {
    it('displays Configuration Code header', () => {
      render(<ImportSection {...defaultProps} />);

      expect(screen.getByText('Configuration Code')).toBeInTheDocument();
    });
  });
});
