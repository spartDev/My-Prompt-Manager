import { describe, it, expect, vi, beforeEach } from 'vitest';

import { migrateToAnalytics } from '../background';

describe('Analytics Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize analytics for users without data', async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValue({});
    const setSpy = vi.mocked(chrome.storage.local.set);

    await migrateToAnalytics();

    expect(setSpy).toHaveBeenCalledWith({
      analytics: expect.objectContaining({
        events: [],
        achievements: [],
        stats: expect.objectContaining({
          firstInsertionDate: expect.any(Number),
          totalInsertions: 0,
          currentStreak: 0,
          longestStreak: 0
        })
      })
    });
  });

  it('should not overwrite existing analytics data', async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      analytics: {
        events: [{ id: 'existing' }],
        achievements: [],
        stats: {
          firstInsertionDate: 12345,
          totalInsertions: 5,
          currentStreak: 2,
          longestStreak: 3
        }
      }
    });
    const setSpy = vi.mocked(chrome.storage.local.set);

    await migrateToAnalytics();

    expect(setSpy).not.toHaveBeenCalled();
  });
});
