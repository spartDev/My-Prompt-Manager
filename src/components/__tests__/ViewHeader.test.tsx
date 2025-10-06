import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import ViewHeader from '../ViewHeader';

describe('ViewHeader', () => {
  describe('Rendering', () => {
    it('renders with title', () => {
      render(<ViewHeader title="Test Title" />);
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('renders with subtitle when provided', () => {
      render(<ViewHeader title="Test Title" subtitle="Test Subtitle" />);
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
    });

    it('does not render subtitle when not provided', () => {
      render(<ViewHeader title="Test Title" />);
      expect(screen.queryByText('Test Subtitle')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <ViewHeader title="Test" className="custom-class" />
      );
      const header = container.querySelector('header');
      expect(header).toHaveClass('custom-class');
    });

    it('renders as semantic header element', () => {
      const { container } = render(<ViewHeader title="Test" />);
      const header = container.querySelector('header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveAttribute('role', 'banner');
    });

    it('renders with correct ARIA label for icon', () => {
      render(<ViewHeader title="My Title" icon="logo" />);
      expect(screen.getByLabelText('My Title icon')).toBeInTheDocument();
    });
  });

  describe('Predefined Icons', () => {
    it('renders with logo icon by default', () => {
      const { container } = render(<ViewHeader title="Test" />);
      const icon = container.querySelector('[role="img"]');
      expect(icon).toBeInTheDocument();
    });

    it('renders with logo icon when specified', () => {
      const { container } = render(<ViewHeader title="Test" icon="logo" />);
      const icon = container.querySelector('[role="img"]');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('aria-label', 'Test icon');
    });

    it('renders with add icon when specified', () => {
      const { container } = render(<ViewHeader title="Test" icon="add" />);
      const icon = container.querySelector('[role="img"]');
      expect(icon).toBeInTheDocument();
    });

    it('renders with edit icon when specified', () => {
      const { container } = render(<ViewHeader title="Test" icon="edit" />);
      const icon = container.querySelector('[role="img"]');
      expect(icon).toBeInTheDocument();
    });

    it('renders with settings icon when specified', () => {
      const { container } = render(<ViewHeader title="Test" icon="settings" />);
      const icon = container.querySelector('[role="img"]');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Custom Icon', () => {
    it('renders with custom ReactElement icon', () => {
      const CustomIcon = () => (
        <svg data-testid="custom-icon" className="w-6 h-6">
          <path d="M12 0L24 24H0z" />
        </svg>
      );

      render(
        <ViewHeader
          title="Test"
          icon={<CustomIcon />}
        />
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  describe('Back Button', () => {
    it('renders back button when onBack provided', () => {
      const onBack = vi.fn();
      render(<ViewHeader title="Test" onBack={onBack} />);
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    });

    it('does not render back button when onBack not provided', () => {
      render(<ViewHeader title="Test" />);
      expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument();
    });

    it('calls onBack when back button clicked', async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();
      render(<ViewHeader title="Test" onBack={onBack} />);

      const backButton = screen.getByRole('button', { name: /go back/i });
      await user.click(backButton);

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('displays "Back" text in back button', () => {
      const onBack = vi.fn();
      render(<ViewHeader title="Test" onBack={onBack} />);
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
  });

  describe('Settings Button', () => {
    it('renders settings button when onSettings provided', () => {
      const onSettings = vi.fn();
      render(<ViewHeader title="Test" onSettings={onSettings} />);
      expect(screen.getByRole('button', { name: /open settings/i })).toBeInTheDocument();
    });

    it('does not render settings button when onSettings not provided', () => {
      render(<ViewHeader title="Test" />);
      expect(screen.queryByRole('button', { name: /open settings/i })).not.toBeInTheDocument();
    });

    it('calls onSettings when settings button clicked', async () => {
      const user = userEvent.setup();
      const onSettings = vi.fn();
      render(<ViewHeader title="Test" onSettings={onSettings} />);

      const settingsButton = screen.getByRole('button', { name: /open settings/i });
      await user.click(settingsButton);

      expect(onSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('Close Button', () => {
    it('renders close button when onClose provided', () => {
      const onClose = vi.fn();
      render(<ViewHeader title="Test" onClose={onClose} />);
      expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument();
    });

    it('does not render close button when onClose not provided', () => {
      render(<ViewHeader title="Test" />);
      expect(screen.queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument();
    });

    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<ViewHeader title="Test" onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /^close$/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Enter key pressed on close button', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<ViewHeader title="Test" onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /^close$/i });
      closeButton.focus();
      await user.keyboard('{Enter}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Space key pressed on close button', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<ViewHeader title="Test" onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /^close$/i });
      closeButton.focus();
      await user.keyboard(' ');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('has correct aria-label in popup context', () => {
      const onClose = vi.fn();
      render(<ViewHeader title="Test" onClose={onClose} context="popup" />);
      expect(screen.getByLabelText(/^close$/i)).toBeInTheDocument();
    });

    it('has correct aria-label in sidepanel context', () => {
      const onClose = vi.fn();
      render(<ViewHeader title="Test" onClose={onClose} context="sidepanel" />);
      expect(screen.getByLabelText(/close side panel/i)).toBeInTheDocument();
    });

    it('has correct title in popup context', () => {
      const onClose = vi.fn();
      render(<ViewHeader title="Test" onClose={onClose} context="popup" />);
      const closeButton = screen.getByRole('button', { name: /^close$/i });
      expect(closeButton).toHaveAttribute('title', 'Close');
    });

    it('has correct title in sidepanel context', () => {
      const onClose = vi.fn();
      render(<ViewHeader title="Test" onClose={onClose} context="sidepanel" />);
      const closeButton = screen.getByRole('button', { name: /close side panel/i });
      expect(closeButton).toHaveAttribute('title', 'Close side panel');
    });
  });

  describe('Custom Actions', () => {
    it('renders custom actions in actions slot', () => {
      const customActions = (
        <button data-testid="custom-action">Custom Action</button>
      );

      render(<ViewHeader title="Test" actions={customActions} />);
      expect(screen.getByTestId('custom-action')).toBeInTheDocument();
    });

    it('does not render actions slot when not provided', () => {
      render(<ViewHeader title="Test" />);
      expect(screen.queryByTestId('custom-action')).not.toBeInTheDocument();
    });
  });

  describe('Context Awareness', () => {
    it('defaults to popup context', () => {
      const onClose = vi.fn();
      render(<ViewHeader title="Test" onClose={onClose} />);
      expect(screen.getByLabelText(/^close$/i)).toBeInTheDocument();
    });

    it('handles popup context explicitly', () => {
      const onClose = vi.fn();
      render(<ViewHeader title="Test" onClose={onClose} context="popup" />);
      expect(screen.getByLabelText(/^close$/i)).toBeInTheDocument();
    });

    it('handles sidepanel context', () => {
      const onClose = vi.fn();
      render(<ViewHeader title="Test" onClose={onClose} context="sidepanel" />);
      expect(screen.getByLabelText(/close side panel/i)).toBeInTheDocument();
    });
  });

  describe('Multiple Actions', () => {
    it('renders all action buttons when all callbacks provided', () => {
      const onBack = vi.fn();
      const onSettings = vi.fn();
      const onClose = vi.fn();

      render(
        <ViewHeader
          title="Test"
          onBack={onBack}
          onSettings={onSettings}
          onClose={onClose}
        />
      );

      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /open settings/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument();
    });

    it('renders back button before custom actions', () => {
      const onBack = vi.fn();
      const customActions = (
        <button data-testid="custom-action">Custom</button>
      );

      const { container } = render(
        <ViewHeader
          title="Test"
          onBack={onBack}
          actions={customActions}
        />
      );

      const actionContainer = container.querySelector('.flex.items-center.space-x-2');
      const buttons = actionContainer?.querySelectorAll('button');

      expect(buttons?.[0]).toHaveAttribute('aria-label', 'Go back');
      expect(buttons?.[1]).toHaveAttribute('data-testid', 'custom-action');
    });
  });

  describe('Styling', () => {
    it('has correct base styling classes', () => {
      const { container } = render(<ViewHeader title="Test" />);
      const header = container.querySelector('header');

      expect(header).toHaveClass('flex-shrink-0');
      expect(header).toHaveClass('p-6');
      expect(header).toHaveClass('bg-white/80');
      expect(header).toHaveClass('dark:bg-gray-800/80');
      expect(header).toHaveClass('backdrop-blur-sm');
      expect(header).toHaveClass('border-b');
      expect(header).toHaveClass('border-purple-100');
      expect(header).toHaveClass('dark:border-gray-700');
    });

    it('icon container has gradient background', () => {
      const { container } = render(<ViewHeader title="Test" />);
      const iconContainer = container.querySelector('[role="img"]');

      expect(iconContainer).toHaveClass('bg-gradient-to-br');
      expect(iconContainer).toHaveClass('from-purple-600');
      expect(iconContainer).toHaveClass('to-indigo-600');
      expect(iconContainer).toHaveClass('rounded-xl');
    });

    it('title has correct text styling', () => {
      render(<ViewHeader title="Test Title" />);
      const title = screen.getByText('Test Title');

      expect(title).toHaveClass('text-xl');
      expect(title).toHaveClass('font-bold');
      expect(title).toHaveClass('text-gray-900');
      expect(title).toHaveClass('dark:text-gray-100');
    });

    it('subtitle has correct text styling', () => {
      render(<ViewHeader title="Test" subtitle="Subtitle" />);
      const subtitle = screen.getByText('Subtitle');

      expect(subtitle).toHaveClass('text-sm');
      expect(subtitle).toHaveClass('text-gray-500');
      expect(subtitle).toHaveClass('dark:text-gray-400');
    });
  });

  describe('Accessibility', () => {
    it('all buttons have proper focus styles', () => {
      const onBack = vi.fn();
      const onSettings = vi.fn();
      const onClose = vi.fn();

      render(
        <ViewHeader
          title="Test"
          onBack={onBack}
          onSettings={onSettings}
          onClose={onClose}
        />
      );

      const backButton = screen.getByRole('button', { name: /go back/i });
      const settingsButton = screen.getByRole('button', { name: /open settings/i });
      const closeButton = screen.getByRole('button', { name: /^close$/i });

      expect(backButton).toHaveClass('focus-interactive');
      expect(settingsButton).toHaveClass('focus-interactive');
      expect(closeButton).toHaveClass('focus-interactive');
    });

    it('all buttons have title attributes', () => {
      const onBack = vi.fn();
      const onSettings = vi.fn();
      const onClose = vi.fn();

      render(
        <ViewHeader
          title="Test"
          onBack={onBack}
          onSettings={onSettings}
          onClose={onClose}
        />
      );

      expect(screen.getByRole('button', { name: /go back/i })).toHaveAttribute('title', 'Go back');
      expect(screen.getByRole('button', { name: /open settings/i })).toHaveAttribute('title', 'Settings');
      expect(screen.getByRole('button', { name: /^close$/i })).toHaveAttribute('title', 'Close');
    });

    it('all SVG icons have aria-hidden attribute', () => {
      const onBack = vi.fn();
      const onSettings = vi.fn();
      const onClose = vi.fn();

      const { container } = render(
        <ViewHeader
          title="Test"
          onBack={onBack}
          onSettings={onSettings}
          onClose={onClose}
        />
      );

      // Get all SVGs within buttons (excluding the main icon)
      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        const svg = button.querySelector('svg');
        if (svg) {
          expect(svg).toHaveAttribute('aria-hidden', 'true');
        }
      });
    });
  });
});
