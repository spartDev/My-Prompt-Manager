import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ICON_PLACEMENT_REPAIRS_KEY } from '../../../services/iconPlacementRepairs';
import type { CustomSite } from '../../../types';
import SiteIntegrationSection from '../SiteIntegrationSection';

const baseSiteConfigs = {
  'claude.ai': {
    name: 'Claude.ai',
    icon: () => <span>Claude</span>
  }
};

const noopAsync = async () => { /* adds nothing */ };

const defaultProps = {
  enabledSites: [],
  customSites: [] as CustomSite[],
  siteConfigs: baseSiteConfigs,
  onSiteToggle: vi.fn(),
  onCustomSiteToggle: vi.fn(),
  onRemoveCustomSite: vi.fn(),
  onAddCustomSite: noopAsync,
  interfaceMode: 'popup' as const,
  saving: false,
  onShowToast: vi.fn()
};

const getAddButton = () => screen.getByRole('button', { name: /Add a custom site/ });

describe('SiteIntegrationSection - AI sites group', () => {
  beforeEach(() => {
    const tabsQueryMock = chrome.tabs.query as unknown as Mock;
    tabsQueryMock.mockResolvedValue([]);
  });

  it('lists each Platform with its domain and a switch named after it', () => {
    render(<SiteIntegrationSection {...defaultProps} enabledSites={['claude.ai']} />);

    expect(screen.getByRole('region', { name: 'AI sites' })).toBeInTheDocument();
    expect(screen.getByText('claude.ai')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Claude.ai' })).toHaveAttribute('aria-checked', 'true');
  });

  it('greys and dims the logo of a site that is off', () => {
    render(<SiteIntegrationSection {...defaultProps} enabledSites={[]} />);

    expect(screen.getByTestId('site-logo')).toHaveClass('grayscale', 'opacity-50', 'duration-(--duration-dim)');
  });

  it('shows the linked M365 Copilot domain on the Copilot row, which one switch turns on', () => {
    const siteConfigs = { 'copilot.microsoft.com': { name: 'Microsoft Copilot', icon: () => <span>C</span> } };
    render(<SiteIntegrationSection {...defaultProps} siteConfigs={siteConfigs} />);

    expect(screen.getByText('copilot.microsoft.com · m365.cloud.microsoft')).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(1);
  });

  it('ends with Add a custom site, with or without custom sites', async () => {
    const { rerender } = render(<SiteIntegrationSection {...defaultProps} customSites={[]} />);
    await waitFor(() => { expect(getAddButton()).toBeEnabled(); });

    const customSites: CustomSite[] = [
      { hostname: 'custom.ai', displayName: 'Custom AI', enabled: true, dateAdded: Date.now() }
    ];
    rerender(<SiteIntegrationSection {...defaultProps} customSites={customSites} />);
    expect(getAddButton()).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Custom AI' })).toBeInTheDocument();
  });

  it('opens the way to add a site under the card', async () => {
    const user = userEvent.setup();
    render(<SiteIntegrationSection {...defaultProps} />);

    await waitFor(() => { expect(getAddButton()).toBeEnabled(); });
    await user.click(getAddButton());

    expect(await screen.findByText(/manual/i)).toBeInTheDocument();
  });

  it('keeps a custom site\'s Export and Remove in its menu', async () => {
    const user = userEvent.setup();
    const onRemoveCustomSite = vi.fn();
    const customSites: CustomSite[] = [
      { hostname: 'custom.ai', displayName: 'Custom AI', enabled: true, dateAdded: Date.now() }
    ];
    render(<SiteIntegrationSection {...defaultProps} customSites={customSites} onRemoveCustomSite={onRemoveCustomSite} />);

    await user.click(screen.getByRole('button', { name: 'More actions for Custom AI' }));
    expect(screen.getByRole('menuitem', { name: 'Export configuration' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Remove' }));

    expect(onRemoveCustomSite).toHaveBeenCalledWith('custom.ai');
  });

  it('turns Add a custom site off, and says why, when the current site is already integrated', async () => {
    const customSites: CustomSite[] = [
      { hostname: 'example.com', displayName: 'Example', enabled: true, dateAdded: Date.now() }
    ];
    const tabsQueryMock = chrome.tabs.query as unknown as Mock;
    tabsQueryMock.mockResolvedValue([
      { id: 1, url: 'https://example.com/page', title: 'Example' }
    ] as chrome.tabs.Tab[]);

    render(<SiteIntegrationSection {...defaultProps} customSites={customSites} />);

    await waitFor(() => {
      expect(getAddButton()).toBeDisabled();
    });
    expect(getAddButton()).toHaveTextContent('Current site (example.com) is already integrated');
  });
});

describe('SiteIntegrationSection - a Platform whose icon fell to the Anchored overlay', () => {
  const PICK = { mode: 'custom' as const, placement: 'before' as const, selector: '#send' };
  const storeRepairs = (repairs: unknown) => chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: repairs });

  beforeEach(async () => {
    await chrome.storage.local.clear();
    (chrome.tabs.query as unknown as Mock).mockResolvedValue([]);
    (chrome.runtime.sendMessage as unknown as Mock).mockResolvedValue({ success: true });
  });

  it('shows nothing under a Platform whose icon is in its toolbar', async () => {
    render(<SiteIntegrationSection {...defaultProps} enabledSites={['claude.ai']} />);

    await waitFor(() => { expect(getAddButton()).toBeEnabled(); });
    expect(screen.queryByTestId('site-placement')).not.toBeInTheDocument();
  });

  it('says the toolbar changed and offers Place the icon, which opens the Element picker on the Platform\'s tab', async () => {
    const user = userEvent.setup();
    await storeRepairs({ 'claude.ai': { status: 'overlay' } });
    (chrome.tabs.query as unknown as Mock).mockImplementation(async (query: { url?: string }) =>
      query.url === 'https://claude.ai/*' ? [{ id: 7, active: false }, { id: 9, active: true }] : []);
    render(<SiteIntegrationSection {...defaultProps} enabledSites={['claude.ai']} />);

    const notice = await screen.findByTestId('site-placement');
    expect(notice).toHaveAttribute('data-status', 'overlay');
    expect(notice).toHaveTextContent("Claude.ai's toolbar changed");
    await user.click(screen.getByRole('button', { name: 'Place the icon' }));

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'START_ELEMENT_PICKER',
      data: { tabId: 9, repairHostname: 'claude.ai' }
    });
  });

  describe('closing the popup once the Element picker is open, so it does not cover the page', () => {
    const openedAt = window.location.href;
    afterEach(() => { window.history.replaceState(null, '', openedAt); });

    const placeFrom = async (path: string, interfaceMode: 'popup' | 'sidepanel', currentTab?: { id: number }) => {
      const user = userEvent.setup();
      const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
      window.history.replaceState(null, '', path);
      (chrome.tabs.getCurrent as unknown as Mock).mockResolvedValue(currentTab);
      await storeRepairs({ 'claude.ai': { status: 'overlay' } });
      (chrome.tabs.query as unknown as Mock).mockImplementation(async (query: { url?: string }) =>
        query.url === 'https://claude.ai/*' ? [{ id: 9, active: true }] : []);
      render(<SiteIntegrationSection {...defaultProps} interfaceMode={interfaceMode} enabledSites={['claude.ai']} />);

      await user.click(await screen.findByRole('button', { name: 'Place the icon' }));
      await waitFor(() => { expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'START_ELEMENT_PICKER' })); });
      // The answer to START_ELEMENT_PICKER settles before the popup closes, or does not
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
      const closed = close.mock.calls.length;
      close.mockRestore();
      return closed;
    };

    it.each([
      // The interface mode setting can change while a surface is open: the page says where it is
      { where: 'the action popup', path: '/src/popup.html', interfaceMode: 'popup' as const, closes: 1 },
      { where: 'the action popup after switching the setting to side panel', path: '/src/popup.html', interfaceMode: 'sidepanel' as const, closes: 1 },
      { where: 'the side panel', path: '/src/sidepanel.html', interfaceMode: 'sidepanel' as const, closes: 0 },
      { where: 'the side panel after switching the setting to popup', path: '/src/sidepanel.html', interfaceMode: 'popup' as const, closes: 0 },
      { where: 'the picker window', path: '/src/popup.html?picker=true&tabId=3', interfaceMode: 'popup' as const, closes: 0 }
    ])('$where: closes $closes time(s)', async ({ path, interfaceMode, closes }) => {
      expect(await placeFrom(path, interfaceMode)).toBe(closes);
    });

    it('popup.html opened in a tab stays open', async () => {
      expect(await placeFrom('/src/popup.html', 'popup', { id: 4 })).toBe(0);
    });
  });

  it('keeps the popup open with the reason when the Element picker could not open', async () => {
    const user = userEvent.setup();
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    const openedAt = window.location.href;
    window.history.replaceState(null, '', '/src/popup.html');
    await storeRepairs({ 'claude.ai': { status: 'overlay' } });
    (chrome.tabs.query as unknown as Mock).mockImplementation(async (query: { url?: string }) =>
      query.url === 'https://claude.ai/*' ? [{ id: 9, active: true }] : []);
    (chrome.runtime.sendMessage as unknown as Mock).mockResolvedValue({ success: false, error: 'The tab is not on this platform' });
    render(<SiteIntegrationSection {...defaultProps} interfaceMode="popup" enabledSites={['claude.ai']} />);

    await user.click(await screen.findByRole('button', { name: 'Place the icon' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not open the element picker');
    expect(close).not.toHaveBeenCalled();
    close.mockRestore();
    window.history.replaceState(null, '', openedAt);
  });

  it('says where to go when no tab is on the Platform', async () => {
    const user = userEvent.setup();
    await storeRepairs({ 'claude.ai': { status: 'overlay' } });
    render(<SiteIntegrationSection {...defaultProps} enabledSites={['claude.ai']} />);

    await user.click(await screen.findByRole('button', { name: 'Place the icon' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Open claude.ai in a tab, then place the icon.');
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'START_ELEMENT_PICKER' }));
  });

  it('follows storage: the picked element, then the toolbar found again', async () => {
    await storeRepairs({ 'claude.ai': { status: 'overlay' } });
    render(<SiteIntegrationSection {...defaultProps} enabledSites={['claude.ai']} />);
    expect(await screen.findByRole('button', { name: 'Place the icon' })).toBeInTheDocument();

    await act(async () => { await storeRepairs({ 'claude.ai': { status: 'override', override: PICK } }); });
    expect(screen.getByTestId('site-placement')).toHaveTextContent('The icon sits where you placed it');
    expect(screen.getByRole('button', { name: 'Place again' })).toBeInTheDocument();

    await act(async () => { await storeRepairs({}); });
    expect(screen.queryByTestId('site-placement')).not.toBeInTheDocument();
  });

  it('shows a linked Platform\'s fallback on the row whose switch covers it, and hides it while the site is off', async () => {
    await storeRepairs({ 'm365.cloud.microsoft': { status: 'overlay' } });
    const siteConfigs = { 'copilot.microsoft.com': { name: 'Microsoft Copilot', icon: () => <span>C</span> } };
    const { rerender } = render(<SiteIntegrationSection {...defaultProps} siteConfigs={siteConfigs} enabledSites={['copilot.microsoft.com']} />);

    expect(await screen.findByTestId('site-placement')).toBeInTheDocument();

    rerender(<SiteIntegrationSection {...defaultProps} siteConfigs={siteConfigs} enabledSites={[]} />);
    expect(screen.queryByTestId('site-placement')).not.toBeInTheDocument();
  });
});
