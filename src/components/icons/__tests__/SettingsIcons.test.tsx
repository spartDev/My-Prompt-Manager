import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  DebugInfoIcon,
  DocumentationIcon,
  ExportIcon,
  FolderIcon,
  FunnelIcon,
  GitHubIcon,
  ImportIcon,
  IssueIcon
} from '../SettingsIcons';

describe('SettingsIcons', () => {
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

  describe('Consistency Across Icons', () => {
    const icons = [
      { component: DebugInfoIcon, name: 'DebugInfo' },
      { component: DocumentationIcon, name: 'Documentation' },
      { component: ExportIcon, name: 'Export' },
      { component: FolderIcon, name: 'Folder' },
      { component: FunnelIcon, name: 'Funnel' },
      { component: GitHubIcon, name: 'GitHub' },
      { component: ImportIcon, name: 'Import' },
      { component: IssueIcon, name: 'Issue' }
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
