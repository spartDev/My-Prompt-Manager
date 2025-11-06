import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AddIcon, EditIcon, LogoIcon, SettingsIcon } from '../HeaderIcons';

describe('HeaderIcons', () => {
  describe('LogoIcon', () => {
    it('should render icon', () => {
      const { container } = render(<LogoIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(<LogoIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('AddIcon', () => {
    it('should render icon', () => {
      const { container } = render(<AddIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(<AddIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('EditIcon', () => {
    it('should render icon', () => {
      const { container } = render(<EditIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(<EditIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('SettingsIcon', () => {
    it('should render icon', () => {
      const { container } = render(<SettingsIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(<SettingsIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Consistency Across Icons', () => {
    it('should ensure all icons have aria-hidden attribute', () => {
      const icons = [
        { component: LogoIcon, name: 'logo' },
        { component: AddIcon, name: 'add' },
        { component: EditIcon, name: 'edit' },
        { component: SettingsIcon, name: 'settings' }
      ];

      icons.forEach(({ component: Icon }) => {
        const { container, unmount } = render(<Icon />);
        const icon = container.querySelector('svg');
        expect(icon).toHaveAttribute('aria-hidden', 'true');
        unmount();
      });
    });
  });
});
