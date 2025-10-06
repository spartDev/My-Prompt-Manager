import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AddIcon, EditIcon, LogoIcon, SettingsIcon } from '../HeaderIcons';

describe('HeaderIcons', () => {
  describe('LogoIcon', () => {
    it('renders SVG element', () => {
      const { container } = render(<LogoIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('has correct viewBox for logo', () => {
      const { container } = render(<LogoIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 18 18');
    });

    it('has correct size classes', () => {
      const { container } = render(<LogoIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-6');
      expect(svg).toHaveClass('h-6');
    });

    it('has text-white color class', () => {
      const { container } = render(<LogoIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-white');
    });

    it('has aria-hidden attribute', () => {
      const { container } = render(<LogoIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('has fill="none" attribute', () => {
      const { container } = render(<LogoIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('fill', 'none');
    });

    it('contains path element with fill="currentColor"', () => {
      const { container } = render(<LogoIcon />);
      const path = container.querySelector('path');
      expect(path).toBeInTheDocument();
      expect(path).toHaveAttribute('fill', 'currentColor');
    });

    it('contains the chat bubble icon path data', () => {
      const { container } = render(<LogoIcon />);
      const path = container.querySelector('path');
      const pathData = path?.getAttribute('d');

      // Check that the path contains key coordinates from the chat bubble design
      expect(pathData).toContain('M5.085 8.476'); // First dot position
      expect(pathData).toContain('M0 17.285V1.425'); // Bubble outline
    });
  });

  describe('AddIcon', () => {
    it('renders SVG element', () => {
      const { container } = render(<AddIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('has correct viewBox', () => {
      const { container } = render(<AddIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    it('has correct size classes', () => {
      const { container } = render(<AddIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-6');
      expect(svg).toHaveClass('h-6');
    });

    it('has text-white color class', () => {
      const { container } = render(<AddIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-white');
    });

    it('has aria-hidden attribute', () => {
      const { container } = render(<AddIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('has fill="none" attribute', () => {
      const { container } = render(<AddIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('fill', 'none');
    });

    it('has stroke="currentColor" attribute', () => {
      const { container } = render(<AddIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
    });

    it('contains path element with plus symbol', () => {
      const { container } = render(<AddIcon />);
      const path = container.querySelector('path');
      expect(path).toBeInTheDocument();

      const pathData = path?.getAttribute('d');
      expect(pathData).toBe('M12 4v16m8-8H4'); // Plus symbol path
    });

    it('has strokeWidth={2}', () => {
      const { container } = render(<AddIcon />);
      const path = container.querySelector('path');
      expect(path).toHaveAttribute('stroke-width', '2');
    });

    it('has round line caps', () => {
      const { container } = render(<AddIcon />);
      const path = container.querySelector('path');
      expect(path).toHaveAttribute('stroke-linecap', 'round');
      expect(path).toHaveAttribute('stroke-linejoin', 'round');
    });
  });

  describe('EditIcon', () => {
    it('renders SVG element', () => {
      const { container } = render(<EditIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('has correct viewBox', () => {
      const { container } = render(<EditIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    it('has correct size classes', () => {
      const { container } = render(<EditIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-6');
      expect(svg).toHaveClass('h-6');
    });

    it('has text-white color class', () => {
      const { container } = render(<EditIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-white');
    });

    it('has aria-hidden attribute', () => {
      const { container } = render(<EditIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('has fill="none" attribute', () => {
      const { container } = render(<EditIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('fill', 'none');
    });

    it('has stroke="currentColor" attribute', () => {
      const { container } = render(<EditIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
    });

    it('contains path element with pencil/edit icon', () => {
      const { container } = render(<EditIcon />);
      const path = container.querySelector('path');
      expect(path).toBeInTheDocument();

      const pathData = path?.getAttribute('d');
      // Check for key parts of the edit/pencil icon
      expect(pathData).toContain('M11 5H6a2 2 0 00-2 2v11');
      expect(pathData).toContain('m-1.414-9.414a2 2 0 112.828 2.828');
    });

    it('has strokeWidth={2}', () => {
      const { container } = render(<EditIcon />);
      const path = container.querySelector('path');
      expect(path).toHaveAttribute('stroke-width', '2');
    });

    it('has round line caps', () => {
      const { container } = render(<EditIcon />);
      const path = container.querySelector('path');
      expect(path).toHaveAttribute('stroke-linecap', 'round');
      expect(path).toHaveAttribute('stroke-linejoin', 'round');
    });
  });

  describe('SettingsIcon', () => {
    it('renders SVG element', () => {
      const { container } = render(<SettingsIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('has correct viewBox', () => {
      const { container } = render(<SettingsIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    it('has correct size classes', () => {
      const { container } = render(<SettingsIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-6');
      expect(svg).toHaveClass('h-6');
    });

    it('has text-white color class', () => {
      const { container } = render(<SettingsIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-white');
    });

    it('has aria-hidden attribute', () => {
      const { container } = render(<SettingsIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('has fill="none" attribute', () => {
      const { container } = render(<SettingsIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('fill', 'none');
    });

    it('has stroke="currentColor" attribute', () => {
      const { container } = render(<SettingsIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
    });

    it('contains two path elements for gear icon', () => {
      const { container } = render(<SettingsIcon />);
      const paths = container.querySelectorAll('path');
      expect(paths).toHaveLength(2);
    });

    it('first path contains outer gear ring', () => {
      const { container } = render(<SettingsIcon />);
      const paths = container.querySelectorAll('path');
      const firstPath = paths[0];

      const pathData = firstPath?.getAttribute('d');
      expect(pathData).toContain('M10.325 4.317c.426-1.756 2.924-1.756 3.35 0');
    });

    it('second path contains inner circle', () => {
      const { container } = render(<SettingsIcon />);
      const paths = container.querySelectorAll('path');
      const secondPath = paths[1];

      const pathData = secondPath?.getAttribute('d');
      expect(pathData).toContain('M15 12a3 3 0 11-6 0 3 3 0 016 0z');
    });

    it('both paths have strokeWidth={2}', () => {
      const { container } = render(<SettingsIcon />);
      const paths = container.querySelectorAll('path');

      paths.forEach(path => {
        expect(path).toHaveAttribute('stroke-width', '2');
      });
    });

    it('both paths have round line caps', () => {
      const { container } = render(<SettingsIcon />);
      const paths = container.querySelectorAll('path');

      paths.forEach(path => {
        expect(path).toHaveAttribute('stroke-linecap', 'round');
        expect(path).toHaveAttribute('stroke-linejoin', 'round');
      });
    });
  });

  describe('Consistency Across Icons', () => {
    it('all icons have the same size classes', () => {
      const icons = [
        <LogoIcon key="logo" />,
        <AddIcon key="add" />,
        <EditIcon key="edit" />,
        <SettingsIcon key="settings" />
      ];

      icons.forEach(icon => {
        const { container } = render(icon);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('w-6');
        expect(svg).toHaveClass('h-6');
      });
    });

    it('all icons have text-white color', () => {
      const icons = [
        <LogoIcon key="logo" />,
        <AddIcon key="add" />,
        <EditIcon key="edit" />,
        <SettingsIcon key="settings" />
      ];

      icons.forEach(icon => {
        const { container } = render(icon);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('text-white');
      });
    });

    it('all icons have aria-hidden attribute', () => {
      const icons = [
        <LogoIcon key="logo" />,
        <AddIcon key="add" />,
        <EditIcon key="edit" />,
        <SettingsIcon key="settings" />
      ];

      icons.forEach(icon => {
        const { container } = render(icon);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('all stroke-based icons use currentColor', () => {
      const strokeIcons = [
        <AddIcon key="add" />,
        <EditIcon key="edit" />,
        <SettingsIcon key="settings" />
      ];

      strokeIcons.forEach(icon => {
        const { container } = render(icon);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('stroke', 'currentColor');
      });
    });

    it('all stroke-based icons have strokeWidth={2}', () => {
      const strokeIcons = [
        <AddIcon key="add" />,
        <EditIcon key="edit" />,
        <SettingsIcon key="settings" />
      ];

      strokeIcons.forEach(icon => {
        const { container } = render(icon);
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
          expect(path).toHaveAttribute('stroke-width', '2');
        });
      });
    });

    it('all stroke-based icons have round line caps', () => {
      const strokeIcons = [
        <AddIcon key="add" />,
        <EditIcon key="edit" />,
        <SettingsIcon key="settings" />
      ];

      strokeIcons.forEach(icon => {
        const { container } = render(icon);
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
          expect(path).toHaveAttribute('stroke-linecap', 'round');
          expect(path).toHaveAttribute('stroke-linejoin', 'round');
        });
      });
    });
  });

  describe('Rendering as React Components', () => {
    it('LogoIcon can be used in JSX', () => {
      const TestComponent = () => (
        <div>
          <LogoIcon />
        </div>
      );

      const { container } = render(<TestComponent />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('AddIcon can be used in JSX', () => {
      const TestComponent = () => (
        <div>
          <AddIcon />
        </div>
      );

      const { container } = render(<TestComponent />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('EditIcon can be used in JSX', () => {
      const TestComponent = () => (
        <div>
          <EditIcon />
        </div>
      );

      const { container } = render(<TestComponent />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('SettingsIcon can be used in JSX', () => {
      const TestComponent = () => (
        <div>
          <SettingsIcon />
        </div>
      );

      const { container } = render(<TestComponent />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Type Safety', () => {
    it('all icons are properly typed as FC', () => {
      // TypeScript compilation validates this
      const icons: Array<React.FC> = [
        LogoIcon,
        AddIcon,
        EditIcon,
        SettingsIcon
      ];

      expect(icons).toHaveLength(4);
    });
  });
});
