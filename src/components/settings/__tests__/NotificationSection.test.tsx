/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ToastSettings } from '../../../types/hooks';
import NotificationSection from '../NotificationSection';

describe('NotificationSection', () => {
  const mockOnSettingsChange = vi.fn();
  const mockOnTestToast = vi.fn();

  const defaultSettings: ToastSettings = {
    position: 'top-right',
    enabledTypes: {
      success: true,
      error: true,
      info: true,
      warning: true
    },
    enableGrouping: true,
    groupingWindow: 500
  };

  beforeEach(() => {
    mockOnSettingsChange.mockClear();
    mockOnTestToast.mockClear();
  });

  it('renders collapsed by default', () => {
    render(
      <NotificationSection
        settings={defaultSettings}
        onSettingsChange={mockOnSettingsChange}
        onTestToast={mockOnTestToast}
      />
    );

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.queryByText('Position')).not.toBeInTheDocument();
  });

  it('expands when header is clicked', () => {
    render(
      <NotificationSection
        settings={defaultSettings}
        onSettingsChange={mockOnSettingsChange}
        onTestToast={mockOnTestToast}
      />
    );

    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);

    expect(screen.getByText('Position')).toBeInTheDocument();
    expect(screen.getByText('Notification Types')).toBeInTheDocument();
  });

  it('collapses when header is clicked again', () => {
    render(
      <NotificationSection
        settings={defaultSettings}
        onSettingsChange={mockOnSettingsChange}
        onTestToast={mockOnTestToast}
      />
    );

    const expandButton = screen.getByRole('button', { expanded: false });

    // Expand
    fireEvent.click(expandButton);
    expect(screen.getByText('Position')).toBeInTheDocument();

    // Collapse
    fireEvent.click(expandButton);
    expect(screen.queryByText('Position')).not.toBeInTheDocument();
  });

  describe('Position Settings', () => {
    it('shows top-right as selected by default', () => {
      render(
        <NotificationSection
          settings={defaultSettings}
          onSettingsChange={mockOnSettingsChange}
          onTestToast={mockOnTestToast}
        />
      );

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const topRightButton = screen.getByText('Top Right').closest('button');
      expect(topRightButton).toHaveClass('border-purple-500');
    });

    it('shows bottom-right as selected when position is bottom-right', () => {
      const settings = { ...defaultSettings, position: 'bottom-right' as const };
      render(
        <NotificationSection
          settings={settings}
          onSettingsChange={mockOnSettingsChange}
          onTestToast={mockOnTestToast}
        />
      );

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const bottomRightButton = screen.getByText('Bottom Right').closest('button');
      expect(bottomRightButton).toHaveClass('border-purple-500');
    });

    it('calls onSettingsChange when top-right position is selected', () => {
      const settings = { ...defaultSettings, position: 'bottom-right' as const };
      render(
        <NotificationSection
          settings={settings}
          onSettingsChange={mockOnSettingsChange}
          onTestToast={mockOnTestToast}
        />
      );

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const topRightButton = screen.getByText('Top Right').closest('button');
      fireEvent.click(topRightButton!);

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        position: 'top-right'
      });
    });

    it('calls onSettingsChange when bottom-right position is selected', () => {
      render(
        <NotificationSection
          settings={defaultSettings}
          onSettingsChange={mockOnSettingsChange}
          onTestToast={mockOnTestToast}
        />
      );

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const bottomRightButton = screen.getByText('Bottom Right').closest('button');
      fireEvent.click(bottomRightButton!);

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        position: 'bottom-right'
      });
    });
  });

  describe('Notification Types', () => {
    const renderAndExpand = (settings = defaultSettings) => {
      const utils = render(
        <NotificationSection
          settings={settings}
          onSettingsChange={mockOnSettingsChange}
          onTestToast={mockOnTestToast}
        />
      );
      // Expand the section
      fireEvent.click(screen.getByRole('button', { expanded: false }));
      return utils;
    };

    it('renders all four notification types', () => {
      renderAndExpand();
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('shows correct duration for each type', () => {
      renderAndExpand();
      expect(screen.getByText('Confirmation messages (2.75s)')).toBeInTheDocument();
      expect(screen.getByText('Error messages (7s)')).toBeInTheDocument();
      expect(screen.getByText('Important alerts (5s)')).toBeInTheDocument();
      expect(screen.getByText('Informational messages (2.75s)')).toBeInTheDocument();
    });

    it('renders single rotating test button', () => {
      renderAndExpand();
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('cycles through enabled types when test button is clicked', () => {
      renderAndExpand();
      const testButton = screen.getByText('Test').closest('button')!;

      // Click 1: Should test Success
      fireEvent.click(testButton);
      expect(mockOnTestToast).toHaveBeenCalledWith('success');

      // Click 2: Should test Error
      fireEvent.click(testButton);
      expect(mockOnTestToast).toHaveBeenCalledWith('error');

      // Click 3: Should test Warning
      fireEvent.click(testButton);
      expect(mockOnTestToast).toHaveBeenCalledWith('warning');

      // Click 4: Should test Info
      fireEvent.click(testButton);
      expect(mockOnTestToast).toHaveBeenCalledWith('info');

      // Click 5: Should cycle back to Success
      fireEvent.click(testButton);
      expect(mockOnTestToast).toHaveBeenCalledWith('success');
    });

    it('skips disabled notification types when cycling', () => {
      const settings: ToastSettings = {
        ...defaultSettings,
        enabledTypes: {
          success: true,
          error: false,  // Disabled
          info: true,
          warning: false  // Disabled
        }
      };

      renderAndExpand(settings);

      const testButton = screen.getByText('Test').closest('button')!;

      // Click 1: Should test Success
      fireEvent.click(testButton);
      expect(mockOnTestToast).toHaveBeenCalledWith('success');

      // Click 2: Should skip Error and Warning, test Info
      fireEvent.click(testButton);
      expect(mockOnTestToast).toHaveBeenCalledWith('info');

      // Click 3: Should cycle back to Success (skipping Error and Warning)
      fireEvent.click(testButton);
      expect(mockOnTestToast).toHaveBeenCalledWith('success');
    });

    it('disables test button when all types are disabled', () => {
      const settings: ToastSettings = {
        ...defaultSettings,
        enabledTypes: {
          success: false,
          error: false,
          info: false,
          warning: false
        }
      };

      renderAndExpand(settings);

      const testButton = screen.getByText('Test').closest('button')!;
      expect(testButton).toBeDisabled();
    });
  });

  describe('Toggle Switches', () => {
    beforeEach(() => {
      render(
        <NotificationSection
          settings={defaultSettings}
          onSettingsChange={mockOnSettingsChange}
          onTestToast={mockOnTestToast}
        />
      );
      // Expand the section
      fireEvent.click(screen.getByRole('button', { expanded: false }));
    });

    it('toggles success notification type', () => {
      const successToggle = screen.getByLabelText('Enable success notifications');
      fireEvent.click(successToggle);

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        enabledTypes: {
          success: false,
          error: true,
          info: true,
          warning: true
        }
      });
    });

    it('toggles error notification type', () => {
      const errorToggle = screen.getByLabelText('Enable error notifications');
      fireEvent.click(errorToggle);

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        enabledTypes: {
          success: true,
          error: false,
          info: true,
          warning: true
        }
      });
    });

    it('toggles warning notification type', () => {
      const warningToggle = screen.getByLabelText('Enable warning notifications');
      fireEvent.click(warningToggle);

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        enabledTypes: {
          success: true,
          error: true,
          info: true,
          warning: false
        }
      });
    });

    it('toggles info notification type', () => {
      const infoToggle = screen.getByLabelText('Enable info notifications');
      fireEvent.click(infoToggle);

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        enabledTypes: {
          success: true,
          error: true,
          info: false,
          warning: true
        }
      });
    });
  });

  describe('Disabled State', () => {
    it('shows disabled visual state for disabled notification types', () => {
      const settings: ToastSettings = {
        ...defaultSettings,
        enabledTypes: {
          success: false,
          error: true,
          info: false,
          warning: true
        }
      };

      render(
        <NotificationSection
          settings={settings}
          onSettingsChange={mockOnSettingsChange}
          onTestToast={mockOnTestToast}
        />
      );

      fireEvent.click(screen.getByRole('button', { expanded: false }));

      const successCard = screen.getByText('Success').closest('.flex.items-center.justify-between');
      const infoCard = screen.getByText('Info').closest('.flex.items-center.justify-between');

      // Disabled cards should have opacity-60
      expect(successCard).toHaveClass('opacity-60');
      expect(infoCard).toHaveClass('opacity-60');
    });
  });

  describe('Visual Elements', () => {
    beforeEach(() => {
      render(
        <NotificationSection
          settings={defaultSettings}
          onSettingsChange={mockOnSettingsChange}
          onTestToast={mockOnTestToast}
        />
      );
      fireEvent.click(screen.getByRole('button', { expanded: false }));
    });

    it('displays position preview for top-right', () => {
      const topRightButton = screen.getByText('Top Right').closest('button');
      const preview = topRightButton!.querySelector('.absolute.top-1.right-1');
      expect(preview).toBeInTheDocument();
    });

    it('displays position preview for bottom-right', () => {
      const bottomRightButton = screen.getByText('Bottom Right').closest('button');
      const preview = bottomRightButton!.querySelector('.absolute.bottom-1.right-1');
      expect(preview).toBeInTheDocument();
    });

    it('shows checkmark for selected position', () => {
      const topRightButton = screen.getByText('Top Right').closest('button');
      const checkmark = topRightButton!.querySelector('svg.text-purple-500');
      expect(checkmark).toBeInTheDocument();
    });

    it('shows color indicators for each notification type', () => {
      const successIndicator = screen.getByText('Success').closest('.flex.items-center.justify-between')!.querySelector('.bg-green-500');
      const errorIndicator = screen.getByText('Error').closest('.flex.items-center.justify-between')!.querySelector('.bg-red-500');
      const warningIndicator = screen.getByText('Warning').closest('.flex.items-center.justify-between')!.querySelector('.bg-yellow-500');
      const infoIndicator = screen.getByText('Info').closest('.flex.items-center.justify-between')!.querySelector('.bg-blue-500');

      expect(successIndicator).toBeInTheDocument();
      expect(errorIndicator).toBeInTheDocument();
      expect(warningIndicator).toBeInTheDocument();
      expect(infoIndicator).toBeInTheDocument();
    });
  });
});