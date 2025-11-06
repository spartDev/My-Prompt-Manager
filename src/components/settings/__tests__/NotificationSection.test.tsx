/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { render, screen, fireEvent } from '@testing-library/react';
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

      // Find position buttons - they contain "Top Right" text
      const allButtons = screen.getAllByRole('button');
      const topRightButton = allButtons.find(btn => btn.textContent?.includes('Top Right'));
      expect(topRightButton).toBeInTheDocument();
      expect(topRightButton).toBeVisible();
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

      // Find position buttons - they contain "Bottom Right" text
      const allButtons = screen.getAllByRole('button');
      const bottomRightButton = allButtons.find(btn => btn.textContent?.includes('Bottom Right'));
      expect(bottomRightButton).toBeInTheDocument();
      expect(bottomRightButton).toBeVisible();
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

      // Find position buttons - they contain "Top Right" text
      const allButtons = screen.getAllByRole('button');
      const topRightButton = allButtons.find(btn => btn.textContent?.includes('Top Right'));
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

      // Find position buttons - they contain "Bottom Right" text
      const allButtons = screen.getAllByRole('button');
      const bottomRightButton = allButtons.find(btn => btn.textContent?.includes('Bottom Right'));
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
      // Find the test button by its text and role
      const allButtons = screen.getAllByRole('button');
      const testButton = allButtons.find(btn => btn.textContent?.includes('Test'));
      expect(testButton).toBeDefined();

      // Click 1: Should test Success
      fireEvent.click(testButton!);
      expect(mockOnTestToast).toHaveBeenCalledWith('success');

      // Click 2: Should test Error
      fireEvent.click(testButton!);
      expect(mockOnTestToast).toHaveBeenCalledWith('error');

      // Click 3: Should test Warning
      fireEvent.click(testButton!);
      expect(mockOnTestToast).toHaveBeenCalledWith('warning');

      // Click 4: Should test Info
      fireEvent.click(testButton!);
      expect(mockOnTestToast).toHaveBeenCalledWith('info');

      // Click 5: Should cycle back to Success
      fireEvent.click(testButton!);
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

      // Find the test button by its text and role
      const allButtons = screen.getAllByRole('button');
      const testButton = allButtons.find(btn => btn.textContent?.includes('Test'));
      expect(testButton).toBeDefined();

      // Click 1: Should test Success
      fireEvent.click(testButton!);
      expect(mockOnTestToast).toHaveBeenCalledWith('success');

      // Click 2: Should skip Error and Warning, test Info
      fireEvent.click(testButton!);
      expect(mockOnTestToast).toHaveBeenCalledWith('info');

      // Click 3: Should cycle back to Success (skipping Error and Warning)
      fireEvent.click(testButton!);
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

      // Find the test button by its text and role
      const allButtons = screen.getAllByRole('button');
      const testButton = allButtons.find(btn => btn.textContent?.includes('Test'));
      expect(testButton).toBeDefined();
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

      // Verify that Success and Info toggles are unchecked (disabled)
      const successSwitch = screen.getByRole('switch', { name: /enable success/i });
      const infoSwitch = screen.getByRole('switch', { name: /enable info/i });

      expect(successSwitch).toHaveAttribute('aria-checked', 'false');
      expect(infoSwitch).toHaveAttribute('aria-checked', 'false');
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

    it('displays position options', () => {
      const allButtons = screen.getAllByRole('button');
      const topRightButton = allButtons.find(btn => btn.textContent?.includes('Top Right'));
      const bottomRightButton = allButtons.find(btn => btn.textContent?.includes('Bottom Right'));

      expect(topRightButton).toBeInTheDocument();
      expect(bottomRightButton).toBeInTheDocument();
    });

    it('shows all notification type options', () => {
      // Verify all notification types are visible
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('Info')).toBeInTheDocument();

      // Verify switches are accessible
      expect(screen.getByRole('switch', { name: /enable success/i })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /enable error/i })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /enable warning/i })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /enable info/i })).toBeInTheDocument();
    });
  });
});