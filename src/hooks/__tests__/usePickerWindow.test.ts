import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePickerWindow } from '../usePickerWindow';

const activeTabAt = (url: string) => {
  vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url, title: 'Copilot' } as chrome.tabs.Tab] as never);
};

describe('usePickerWindow: whether the site of the current tab is integrated', () => {
  beforeEach(() => {
    vi.mocked(chrome.tabs.query).mockReset();
  });

  it.each(['https://copilot.cloud.microsoft/chat', 'https://m365.cloud.microsoft/chat', 'https://claude.ai/new'])(
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

  it('is not integrated at a site that is no Platform and no Custom site', async () => {
    activeTabAt('https://chat.example.com/');

    const { result } = renderHook(() => usePickerWindow({ interfaceMode: 'popup', siteConfigs: {}, customSites: [] }));

    await waitFor(() => {
      expect(result.current.currentTabState.currentTabUrl).toBe('https://chat.example.com/');
    });
    expect(result.current.currentTabState.isCurrentSiteIntegrated).toBe(false);
  });
});
