import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import {
  BellIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  DatabaseIcon,
  DebugInfoIcon,
  DocumentationIcon,
  ExportIcon,
  FolderIcon,
  FunnelIcon,
  GearIcon,
  GitHubIcon,
  HelpIcon,
  ImportIcon,
  InfoCircleIcon,
  IssueIcon,
  SortIcon,
  TestBellIcon
} from '../SettingsIcons';

describe('SettingsIcons', () => {
  describe('ChevronDownIcon', () => {
    it('should render with default className', () => {
      const { container } = render(<ChevronDownIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('w-5', 'h-5');
    });

    it('should accept custom className', () => {
      const { container } = render(<ChevronDownIcon className="w-4 h-4 text-red-500" />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveClass('w-4', 'h-4', 'text-red-500');
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(<ChevronDownIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('InfoCircleIcon', () => {
    it('should render with default className', () => {
      const { container } = render(<InfoCircleIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('w-5', 'h-5');
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(<InfoCircleIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('GitHubIcon', () => {
    it('should render with default className', () => {
      const { container } = render(<GitHubIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('w-4', 'h-4');
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(<GitHubIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('GearIcon', () => {
    it('should render with default className', () => {
      const { container } = render(<GearIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('w-5', 'h-5');
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(<GearIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('BellIcon', () => {
    it('should render with default className', () => {
      const { container } = render(<BellIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('w-5', 'h-5');
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(<BellIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('DatabaseIcon', () => {
    it('should render with default className', () => {
      const { container } = render(<DatabaseIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('w-5', 'h-5');
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(<DatabaseIcon />);
      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Consistency Across Icons', () => {
    const icons = [
      { component: BellIcon, name: 'Bell' },
      { component: CheckCircleIcon, name: 'CheckCircle' },
      { component: ChevronDownIcon, name: 'ChevronDown' },
      { component: DatabaseIcon, name: 'Database' },
      { component: DebugInfoIcon, name: 'DebugInfo' },
      { component: DocumentationIcon, name: 'Documentation' },
      { component: ExportIcon, name: 'Export' },
      { component: FolderIcon, name: 'Folder' },
      { component: FunnelIcon, name: 'Funnel' },
      { component: GearIcon, name: 'Gear' },
      { component: GitHubIcon, name: 'GitHub' },
      { component: HelpIcon, name: 'Help' },
      { component: ImportIcon, name: 'Import' },
      { component: InfoCircleIcon, name: 'InfoCircle' },
      { component: IssueIcon, name: 'Issue' },
      { component: SortIcon, name: 'Sort' },
      { component: TestBellIcon, name: 'TestBell' }
    ];

    it('should ensure all icons render an SVG element', () => {
      icons.forEach(({ component: Icon }) => {
        const { container, unmount } = render(<Icon />);
        const icon = container.querySelector('svg');
        expect(icon).toBeInTheDocument();
        unmount();
      });
    });

    it('should ensure all icons have aria-hidden attribute', () => {
      icons.forEach(({ component: Icon }) => {
        const { container, unmount } = render(<Icon />);
        const icon = container.querySelector('svg');
        expect(icon).toHaveAttribute('aria-hidden', 'true');
        unmount();
      });
    });

    it('should ensure all icons accept custom className', () => {
      icons.forEach(({ component: Icon }) => {
        const { container, unmount } = render(<Icon className="custom-class" />);
        const icon = container.querySelector('svg');
        expect(icon).toHaveClass('custom-class');
        unmount();
      });
    });
  });
});
