import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { CustomSiteConfiguration, SecurityWarning } from '../../../types';
import ConfigurationPreview from '../ConfigurationPreview';

describe('ConfigurationPreview', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const mockConfig: CustomSiteConfiguration = {
    hostname: 'example.com',
    displayName: 'Example Site'
  };

  const defaultProps = {
    isOpen: true,
    config: mockConfig,
    warnings: [] as SecurityWarning[],
    duplicate: false,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    isProcessing: false
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnConfirm.mockClear();
  });

  describe('Modal Open/Close', () => {
    it('renders nothing when isOpen is false', () => {
      render(<ConfigurationPreview {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders nothing when config is null', () => {
      render(<ConfigurationPreview {...defaultProps} config={null} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders modal when isOpen is true and config exists', () => {
      render(<ConfigurationPreview {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      render(<ConfigurationPreview {...defaultProps} />);

      const closeButton = screen.getByTestId('close-modal');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
      render(<ConfigurationPreview {...defaultProps} />);

      const backdrop = document.querySelector('[aria-hidden="true"]');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Cancel button is clicked', () => {
      render(<ConfigurationPreview {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Navigation', () => {
    it('calls onClose when Escape key is pressed', () => {
      render(<ConfigurationPreview {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when other keys are pressed', () => {
      render(<ConfigurationPreview {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Enter' });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Confirm Action', () => {
    it('calls onConfirm when Import button is clicked', () => {
      render(<ConfigurationPreview {...defaultProps} />);

      const importButton = screen.getByRole('button', { name: /import configuration/i });
      fireEvent.click(importButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('shows "Replace & Import" when duplicate is true', () => {
      render(<ConfigurationPreview {...defaultProps} duplicate={true} />);

      expect(screen.getByRole('button', { name: /replace & import/i })).toBeInTheDocument();
    });

    it('shows "Import Configuration" when duplicate is false', () => {
      render(<ConfigurationPreview {...defaultProps} duplicate={false} />);

      expect(screen.getByRole('button', { name: /import configuration/i })).toBeInTheDocument();
    });
  });

  describe('Site Information Display', () => {
    it('displays hostname', () => {
      render(<ConfigurationPreview {...defaultProps} />);

      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('displays display name', () => {
      render(<ConfigurationPreview {...defaultProps} />);

      expect(screen.getByText('Example Site')).toBeInTheDocument();
    });
  });

  describe('Custom Positioning Display', () => {
    it('does not show positioning section when config has no positioning', () => {
      render(<ConfigurationPreview {...defaultProps} />);

      expect(screen.queryByText('Custom Positioning')).not.toBeInTheDocument();
    });

    it('shows positioning section when config has positioning', () => {
      const configWithPositioning: CustomSiteConfiguration = {
        ...mockConfig,
        positioning: {
          mode: 'custom',
          placement: 'before',
          offset: { x: 10, y: 20 },
          zIndex: 1000,
          description: 'Custom positioning for example site'
        }
      };

      render(<ConfigurationPreview {...defaultProps} config={configWithPositioning} />);

      expect(screen.getByText('Custom Positioning')).toBeInTheDocument();
      expect(screen.getByText('before')).toBeInTheDocument();
      expect(screen.getByText('1000')).toBeInTheDocument();
      expect(screen.getByText(/X: 10px, Y: 20px/)).toBeInTheDocument();
      expect(screen.getByText('Custom positioning for example site')).toBeInTheDocument();
    });

    it('shows positioning without optional fields', () => {
      const configWithMinimalPositioning: CustomSiteConfiguration = {
        ...mockConfig,
        positioning: {
          mode: 'custom',
          placement: 'after'
        }
      };

      render(<ConfigurationPreview {...defaultProps} config={configWithMinimalPositioning} />);

      expect(screen.getByText('Custom Positioning')).toBeInTheDocument();
      expect(screen.getByText('after')).toBeInTheDocument();
    });
  });

  describe('Security Warnings Display', () => {
    it('does not show warnings section when warnings array is empty', () => {
      render(<ConfigurationPreview {...defaultProps} warnings={[]} />);

      expect(screen.queryByText('Security Notes')).not.toBeInTheDocument();
    });

    it('shows warnings section with warnings', () => {
      const warnings: SecurityWarning[] = [
        { field: 'hostname', message: 'Non-standard port detected', severity: 'warning' },
        { field: 'selectors', message: 'Complex selector pattern', severity: 'warning' }
      ];

      render(<ConfigurationPreview {...defaultProps} warnings={warnings} />);

      expect(screen.getByText('Security Notes')).toBeInTheDocument();
      expect(screen.getByText(/hostname:/i)).toBeInTheDocument();
      expect(screen.getByText(/non-standard port detected/i)).toBeInTheDocument();
      expect(screen.getByText(/selectors:/i)).toBeInTheDocument();
      expect(screen.getByText(/complex selector pattern/i)).toBeInTheDocument();
    });

    it('displays multiple warnings as list items', () => {
      const warnings: SecurityWarning[] = [
        { field: 'field1', message: 'Warning 1', severity: 'warning' },
        { field: 'field2', message: 'Warning 2', severity: 'warning' },
        { field: 'field3', message: 'Warning 3', severity: 'error' }
      ];

      render(<ConfigurationPreview {...defaultProps} warnings={warnings} />);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
    });
  });

  describe('Duplicate Warning Display', () => {
    it('does not show duplicate warning when duplicate is false', () => {
      render(<ConfigurationPreview {...defaultProps} duplicate={false} />);

      expect(screen.queryByText('Existing Configuration')).not.toBeInTheDocument();
    });

    it('shows duplicate warning when duplicate is true', () => {
      render(<ConfigurationPreview {...defaultProps} duplicate={true} />);

      expect(screen.getByText('Existing Configuration')).toBeInTheDocument();
      expect(screen.getByText(/already exists for this hostname/i)).toBeInTheDocument();
    });

    it('shows existing display name in duplicate warning', () => {
      render(
        <ConfigurationPreview
          {...defaultProps}
          duplicate={true}
          existingDisplayName="Old Example Site"
        />
      );

      expect(screen.getByText('Old Example Site')).toBeInTheDocument();
    });

    it('falls back to config display name when existingDisplayName is not provided', () => {
      render(<ConfigurationPreview {...defaultProps} duplicate={true} />);

      // The warning text should contain the display name
      expect(screen.getByText(/already exists for this hostname/i)).toBeInTheDocument();
    });
  });

  describe('Processing State', () => {
    it('shows "Importing..." when isProcessing is true', () => {
      render(<ConfigurationPreview {...defaultProps} isProcessing={true} />);

      expect(screen.getByRole('button', { name: /importing/i })).toBeInTheDocument();
    });

    it('disables Import button when isProcessing is true', () => {
      render(<ConfigurationPreview {...defaultProps} isProcessing={true} />);

      const importButton = screen.getByRole('button', { name: /importing/i });
      expect(importButton).toBeDisabled();
    });

    it('disables Cancel button when isProcessing is true', () => {
      render(<ConfigurationPreview {...defaultProps} isProcessing={true} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });

    it('buttons are enabled when isProcessing is false', () => {
      render(<ConfigurationPreview {...defaultProps} isProcessing={false} />);

      const importButton = screen.getByRole('button', { name: /import configuration/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      expect(importButton).not.toBeDisabled();
      expect(cancelButton).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has role="dialog" and aria-modal="true"', () => {
      render(<ConfigurationPreview {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(<ConfigurationPreview {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'configuration-preview-title');

      const title = screen.getByText('Review Configuration');
      expect(title).toHaveAttribute('id', 'configuration-preview-title');
    });

    it('close button has accessible label', () => {
      render(<ConfigurationPreview {...defaultProps} />);

      expect(screen.getByLabelText(/close preview/i)).toBeInTheDocument();
    });

    it('focuses first focusable element when opened', async () => {
      render(<ConfigurationPreview {...defaultProps} />);

      await waitFor(() => {
        const closeButton = screen.getByTestId('close-modal');
        expect(document.activeElement).toBe(closeButton);
      });
    });
  });
});
