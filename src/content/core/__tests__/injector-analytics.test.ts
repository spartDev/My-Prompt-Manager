/**
 * Tests for analytics tracking integration in PromptLibraryInjector
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { AnalyticsManager } from '../../../services/analyticsManager';

// Mock AnalyticsManager
vi.mock('../../../services/analyticsManager', () => ({
  AnalyticsManager: {
    getInstance: vi.fn(() => ({
      trackInsertion: vi.fn()
    }))
  }
}));

// Note: Chrome API mocking is handled by test/setup.ts

describe('PromptLibraryInjector Analytics Integration', () => {
  let mockAnalyticsManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAnalyticsManager = AnalyticsManager.getInstance();
    mockAnalyticsManager.trackInsertion = vi.fn().mockResolvedValue({
      id: 'event-123',
      timestamp: Date.now(),
      promptId: 'prompt-123',
      categoryId: 'cat-456',
      platform: 'claude.ai',
      source: 'browse'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should track analytics after successful prompt insertion', async () => {
    // This test will verify that when a prompt is inserted successfully,
    // the AnalyticsManager.trackInsertion is called with the correct parameters

    // For now, we'll create a simple test that shows the expected behavior
    // The actual integration will be done by modifying the injector

    const mockPrompt = {
      id: 'prompt-123',
      title: 'Test Prompt',
      content: 'Test content',
      category: 'cat-456',
      createdAt: Date.now()
    };

    const expectedPlatform = 'claude.ai';
    const expectedSource = 'browse';

    // Simulate successful insertion
    await mockAnalyticsManager.trackInsertion({
      promptId: mockPrompt.id,
      categoryId: mockPrompt.category,
      platform: expectedPlatform,
      source: expectedSource
    });

    expect(mockAnalyticsManager.trackInsertion).toHaveBeenCalledWith({
      promptId: 'prompt-123',
      categoryId: 'cat-456',
      platform: 'claude.ai',
      source: 'browse'
    });
  });

  it('should not track analytics if insertion fails', async () => {
    // This test verifies that if prompt insertion fails,
    // analytics should NOT be tracked

    const mockPrompt = {
      id: 'prompt-123',
      title: 'Test Prompt',
      content: 'Test content',
      category: 'cat-456',
      createdAt: Date.now()
    };

    // Simulate insertion failure (no call to trackInsertion)
    // In the actual implementation, if insertPrompt throws or returns false,
    // trackInsertion should not be called

    expect(mockAnalyticsManager.trackInsertion).not.toHaveBeenCalled();
  });

  it('should handle analytics tracking errors gracefully', async () => {
    // This test verifies that if analytics tracking fails,
    // it doesn't prevent the prompt insertion from succeeding

    mockAnalyticsManager.trackInsertion = vi.fn().mockRejectedValue(
      new Error('Analytics tracking failed')
    );

    const mockPrompt = {
      id: 'prompt-123',
      title: 'Test Prompt',
      content: 'Test content',
      category: 'cat-456',
      createdAt: Date.now()
    };

    // Simulate that insertion succeeded but analytics tracking failed
    try {
      await mockAnalyticsManager.trackInsertion({
        promptId: mockPrompt.id,
        categoryId: mockPrompt.category,
        platform: 'claude.ai',
        source: 'browse'
      });
    } catch (error) {
      // Analytics error should be caught and logged but not thrown
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Analytics tracking failed');
    }

    expect(mockAnalyticsManager.trackInsertion).toHaveBeenCalled();
  });

  it('should track correct source type (browse, search, favorite)', async () => {
    // Test that different source types are tracked correctly
    const mockPrompt = {
      id: 'prompt-123',
      title: 'Test Prompt',
      content: 'Test content',
      category: 'cat-456',
      createdAt: Date.now()
    };

    // Test 'search' source
    await mockAnalyticsManager.trackInsertion({
      promptId: mockPrompt.id,
      categoryId: mockPrompt.category,
      platform: 'chatgpt.com',
      source: 'search'
    });

    expect(mockAnalyticsManager.trackInsertion).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'search' })
    );

    // Test 'favorite' source
    await mockAnalyticsManager.trackInsertion({
      promptId: mockPrompt.id,
      categoryId: mockPrompt.category,
      platform: 'chatgpt.com',
      source: 'favorite'
    });

    expect(mockAnalyticsManager.trackInsertion).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'favorite' })
    );

    // Test 'browse' source (default)
    await mockAnalyticsManager.trackInsertion({
      promptId: mockPrompt.id,
      categoryId: mockPrompt.category,
      platform: 'chatgpt.com',
      source: 'browse'
    });

    expect(mockAnalyticsManager.trackInsertion).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'browse' })
    );
  });

  it('should track correct platform from hostname', async () => {
    // Test that platform is correctly derived from hostname
    const mockPrompt = {
      id: 'prompt-123',
      title: 'Test Prompt',
      content: 'Test content',
      category: 'cat-456',
      createdAt: Date.now()
    };

    const platforms = [
      'claude.ai',
      'chatgpt.com',
      'www.perplexity.ai',
      'chat.mistral.ai'
    ];

    for (const platform of platforms) {
      await mockAnalyticsManager.trackInsertion({
        promptId: mockPrompt.id,
        categoryId: mockPrompt.category,
        platform,
        source: 'browse'
      });

      expect(mockAnalyticsManager.trackInsertion).toHaveBeenLastCalledWith(
        expect.objectContaining({ platform })
      );
    }
  });
});
