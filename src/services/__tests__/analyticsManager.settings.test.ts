import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

import { getChromeMockFunctions } from '../../test/mocks';
import { AnalyticsManager } from '../analyticsManager';

describe('AnalyticsManager - Settings Integration', () => {
  let manager: AnalyticsManager;

  beforeEach(() => {
    manager = AnalyticsManager.getInstance();
    vi.clearAllMocks();
  });

  it('should track insertion when analytics is enabled', async () => {
    const chromeMock = getChromeMockFunctions();
    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      settings: {
        analyticsEnabled: true
      },
      analytics: {
        events: [],
        achievements: [],
        stats: {
          firstInsertionDate: 0,
          totalInsertions: 0,
          currentStreak: 0,
          longestStreak: 0
        }
      }
    });

    const event = await manager.trackInsertion({
      promptId: 'prompt-123',
      categoryId: 'cat-456',
      platform: 'claude',
      source: 'browse'
    });

    expect(event).toBeDefined();
    expect(event?.id).toBeDefined();
    expect(event?.promptId).toBe('prompt-123');
  });

  it('should NOT track insertion when analytics is disabled', async () => {
    const chromeMock = getChromeMockFunctions();
    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      settings: {
        analyticsEnabled: false
      },
      analytics: {
        events: [],
        achievements: [],
        stats: {
          firstInsertionDate: 0,
          totalInsertions: 0,
          currentStreak: 0,
          longestStreak: 0
        }
      }
    });

    const event = await manager.trackInsertion({
      promptId: 'prompt-123',
      categoryId: 'cat-456',
      platform: 'claude',
      source: 'browse'
    });

    expect(event).toBeNull();

    // Verify storage was not updated
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
  });

  it('should default to enabled when setting is not present', async () => {
    const chromeMock = getChromeMockFunctions();
    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      settings: {}, // No analyticsEnabled field
      analytics: {
        events: [],
        achievements: [],
        stats: {
          firstInsertionDate: 0,
          totalInsertions: 0,
          currentStreak: 0,
          longestStreak: 0
        }
      }
    });

    const event = await manager.trackInsertion({
      promptId: 'prompt-123',
      categoryId: 'cat-456',
      platform: 'claude',
      source: 'browse'
    });

    expect(event).toBeDefined();
    expect(event?.id).toBeDefined();
  });

  it('should default to enabled when settings object is missing', async () => {
    const chromeMock = getChromeMockFunctions();
    (chromeMock.storage.local.get as Mock).mockResolvedValue({
      analytics: {
        events: [],
        achievements: [],
        stats: {
          firstInsertionDate: 0,
          totalInsertions: 0,
          currentStreak: 0,
          longestStreak: 0
        }
      }
    });

    const event = await manager.trackInsertion({
      promptId: 'prompt-123',
      categoryId: 'cat-456',
      platform: 'claude',
      source: 'browse'
    });

    expect(event).toBeDefined();
    expect(event?.id).toBeDefined();
  });
});
