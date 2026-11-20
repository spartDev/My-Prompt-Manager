import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withTheWorkAccountHost } from '../../test/helpers/work-account-host';
import { usePickerWindow } from '../usePickerWindow';

const activeTabAt = (url: string) => {
  vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url, title: 'Copilot' } as chrome.tabs.Tab] as never);
};

describe('usePickerWindow: whether the site of the current tab is integrated', () => {
  beforeEach(() => {
    vi.mocked(chrome.tabs.query).mockReset();
  });

  it.each(['https://m365.cloud.microsoft/chat', 'https://claude.ai/new'])(
    'is integrated at %s, a host of a Platform, whatever rows Settings lists',
    async (url) => {
      activeTabAt(url);

      const { result } = renderHook(() => usePickerWindow({ interfaceMode: 'popup', siteConfigs: {}, customSites: [] }));

      await waitFor(() => {
        expect(result.current.currentTabState.currentTabUrl).toBe(url);
      });
      expect(result.current.currentTabState.isCurrentSiteIntegrated).toBe(true);
    }
  );

  // copilot.cloud.microsoft is no Platform's host in 2.0.0 (ticket My-Prompt-Manager-totf)
  it.each(['https://chat.example.com/', 'https://copilot.cloud.microsoft/chat'])('is not integrated at %s, a site that is no Platform and no Custom site', async (url) => {
    activeTabAt(url);

    const { result } = renderHook(() => usePickerWindow({ interfaceMode: 'popup', siteConfigs: {}, customSites: [] }));

    await waitFor(() => {
      expect(result.current.currentTabState.currentTabUrl).toBe(url);
    });
    expect(result.current.currentTabState.isCurrentSiteIntegrated).toBe(false);
  });

  describe('once ticket My-Prompt-Manager-j74b gives copilot.cloud.microsoft back to M365 Copilot', () => {
    withTheWorkAccountHost();

    it('is integrated at copilot.cloud.microsoft, a host of a Platform without a row of its own in Settings', async () => {
      activeTabAt('https://copilot.cloud.microsoft/chat');

      const { result } = renderHook(() => usePickerWindow({ interfaceMode: 'popup', siteConfigs: {}, customSites: [] }));

      await waitFor(() => {
        expect(result.current.currentTabState.currentTabUrl).toBe('https://copilot.cloud.microsoft/chat');
      });
      expect(result.current.currentTabState.isCurrentSiteIntegrated).toBe(true);
    });
  });
});
