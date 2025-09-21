import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

import type { CustomSite } from '../../../types';
import SiteIntegrationSection from '../SiteIntegrationSection';

const baseSiteConfigs = {
  'claude.ai': {
    name: 'Claude.ai',
    description: 'Claude integration',
    icon: <span>Claude</span>
  }
};

const noopAsync = async () => {};

const defaultProps = {
  enabledSites: [],
  customSites: [] as CustomSite[],
  siteConfigs: baseSiteConfigs,
  onSiteToggle: vi.fn(),
  onCustomSiteToggle: vi.fn(),
  onRemoveCustomSite: vi.fn(),
  onAddCustomSite: noopAsync,
  onEditCustomSite: vi.fn(),
  interfaceMode: 'popup' as const,
  saving: false,
  onShowToast: vi.fn()
};

const getAddCardButton = () => screen.queryByLabelText('Add new custom site integration');

describe('SiteIntegrationSection - Custom Sites UI', () => {
  beforeEach(() => {
    const tabsQueryMock = chrome.tabs.query as unknown as Mock;
    tabsQueryMock.mockResolvedValue([]);
  });

  it('renders the add custom site card when custom sites exist', async () => {
    const customSites: CustomSite[] = [
      {
        hostname: 'custom.ai',
        displayName: 'Custom AI',
        enabled: true,
        dateAdded: Date.now()
      }
    ];

    render(<SiteIntegrationSection {...defaultProps} customSites={customSites} />);

    const addCardButton = await screen.findByLabelText('Add new custom site integration');
    expect(addCardButton).toBeInTheDocument();
    expect(screen.queryByText('New Custom Site')).not.toBeInTheDocument();
  });

  it('does not render header button when no custom sites exist', () => {
    render(<SiteIntegrationSection {...defaultProps} customSites={[]} />);

    expect(getAddCardButton()).not.toBeInTheDocument();
    expect(screen.queryByText('New Custom Site')).not.toBeInTheDocument();
    expect(screen.getByText('Add Your First Site')).toBeInTheDocument();
  });

  it('disables the add custom site card when the current site is already integrated', async () => {
    const customSites: CustomSite[] = [
      {
        hostname: 'example.com',
        displayName: 'Example',
        enabled: true,
        dateAdded: Date.now()
      }
    ];

    const tabsQueryMock = chrome.tabs.query as unknown as Mock;
    tabsQueryMock.mockResolvedValue([
      {
        id: 1,
        url: 'https://example.com/page',
        title: 'Example'
      }
    ] as chrome.tabs.Tab[]);

    render(<SiteIntegrationSection {...defaultProps} customSites={customSites} />);

    const addCardButton = await screen.findByLabelText('Add new custom site integration');

    await waitFor(() => {
      expect(addCardButton).toBeDisabled();
    });

    expect(addCardButton).toHaveAttribute('title', 'Current site (example.com) is already integrated');
  });
});
