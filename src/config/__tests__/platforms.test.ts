import { describe, it, expect } from 'vitest';

import {
  SUPPORTED_PLATFORMS,
  getDefaultEnabledPlatforms,
  getPlatformByHostname,
  getPlatformById,
  getAllSupportedHostnames,
  getAllHostnamePatterns,
  isHostnameSupported,
  getPlatformsByPriority,
  getLinkedPlatformHostnames
} from '../platforms';

describe('Copilot Platform Configuration', () => {
  it('should include copilot in SUPPORTED_PLATFORMS', () => {
    expect(SUPPORTED_PLATFORMS.copilot).toBeDefined();
    expect(SUPPORTED_PLATFORMS.copilot.id).toBe('copilot');
    expect(SUPPORTED_PLATFORMS.copilot.hostname).toBe('copilot.microsoft.com');
  });

  it('should have correct priority (80)', () => {
    expect(SUPPORTED_PLATFORMS.copilot.priority).toBe(80);
  });

  it('should be enabled by default', () => {
    expect(SUPPORTED_PLATFORMS.copilot.defaultEnabled).toBe(true);
  });

  it('should have correct selectors', () => {
    const selectors = SUPPORTED_PLATFORMS.copilot.selectors;
    expect(selectors).toContain('textarea[data-testid="composer-input"]');
    expect(selectors).toContain('textarea#userInput');
    expect(selectors).toContain('textarea[placeholder*="Message"]');
  });

  it('should use CopilotStrategy', () => {
    expect(SUPPORTED_PLATFORMS.copilot.strategyClass).toBe('CopilotStrategy');
  });

  it('should be included in default enabled platforms', () => {
    const defaultPlatforms = getDefaultEnabledPlatforms();
    expect(defaultPlatforms).toContain('copilot.microsoft.com');
  });

  it('should be detectable by hostname', () => {
    expect(isHostnameSupported('copilot.microsoft.com')).toBe(true);
  });

  it('should match hostname patterns', () => {
    const patterns = getAllHostnamePatterns();
    expect(patterns).toContain('copilot.microsoft');
  });

  it('should be retrievable by hostname', () => {
    const platform = getPlatformByHostname('copilot.microsoft.com');
    expect(platform).toBeDefined();
    expect(platform?.id).toBe('copilot');
  });

  it('should be retrievable by ID', () => {
    const platform = getPlatformById('copilot');
    expect(platform).toBeDefined();
    expect(platform?.hostname).toBe('copilot.microsoft.com');
  });

  it('should have button container selector', () => {
    expect(SUPPORTED_PLATFORMS.copilot.buttonContainerSelector).toBe(
      '.relative.bottom-0.flex.justify-between.pb-0\\.5.pe-2\\.5.ps-1\\.5 > .flex.gap-2.items-center:last-child'
    );
  });

  it('should define iconMethod for custom Copilot icon styling', () => {
    expect(SUPPORTED_PLATFORMS.copilot.iconMethod).toBe('createCopilotIcon');
  });

  it('should be included in all supported hostnames', () => {
    const hostnames = getAllSupportedHostnames();
    expect(hostnames).toContain('copilot.microsoft.com');
  });

  it('should be correctly sorted by priority', () => {
    const platforms = getPlatformsByPriority();
    const copilotIndex = platforms.findIndex(p => p.id === 'copilot');
    const perplexityIndex = platforms.findIndex(p => p.id === 'perplexity');

    // Copilot (80) should be after Gemini/Mistral (85)
    const geminiIndex = platforms.findIndex(p => p.id === 'gemini');
    expect(copilotIndex).toBeGreaterThan(geminiIndex);

    // Copilot and Perplexity both have priority 80, order depends on object iteration
    expect(Math.abs(copilotIndex - perplexityIndex)).toBeLessThanOrEqual(1);
  });
});

describe('Platform Configuration - General', () => {
  it('should have 7 total platforms', () => {
    const platformKeys = Object.keys(SUPPORTED_PLATFORMS);
    expect(platformKeys).toHaveLength(7);
    expect(platformKeys).toContain('claude');
    expect(platformKeys).toContain('chatgpt');
    expect(platformKeys).toContain('gemini');
    expect(platformKeys).toContain('mistral');
    expect(platformKeys).toContain('perplexity');
    expect(platformKeys).toContain('copilot');
    expect(platformKeys).toContain('m365copilot');
  });

  it('should have all platforms with required fields', () => {
    Object.values(SUPPORTED_PLATFORMS).forEach(platform => {
      expect(platform.id).toBeDefined();
      expect(platform.hostname).toBeDefined();
      expect(platform.displayName).toBeDefined();
      expect(platform.priority).toBeGreaterThan(0);
      expect(typeof platform.defaultEnabled).toBe('boolean');
      expect(Array.isArray(platform.selectors)).toBe(true);
      expect(platform.selectors.length).toBeGreaterThan(0);
      expect(platform.strategyClass).toBeDefined();
    });
  });

  it('should configure icon methods for platforms with custom UI', () => {
    expect(SUPPORTED_PLATFORMS.mistral.iconMethod).toBe('createMistralIcon');
    expect(SUPPORTED_PLATFORMS.gemini.iconMethod).toBe('createGeminiIcon');
    expect(SUPPORTED_PLATFORMS.copilot.iconMethod).toBe('createCopilotIcon');
  });
});

describe('Platform Linking Configuration', () => {
  it('should configure copilot with linkedPlatforms to m365copilot', () => {
    expect(SUPPORTED_PLATFORMS.copilot.linkedPlatforms).toBeDefined();
    expect(SUPPORTED_PLATFORMS.copilot.linkedPlatforms).toEqual(['m365copilot']);
  });

  it('should configure m365copilot with linkedPlatforms to copilot', () => {
    expect(SUPPORTED_PLATFORMS.m365copilot.linkedPlatforms).toBeDefined();
    expect(SUPPORTED_PLATFORMS.m365copilot.linkedPlatforms).toEqual(['copilot']);
  });

  it('should have bidirectional relationship between copilot platforms', () => {
    const copilotLinks = SUPPORTED_PLATFORMS.copilot.linkedPlatforms || [];
    const m365Links = SUPPORTED_PLATFORMS.m365copilot.linkedPlatforms || [];

    expect(copilotLinks).toContain('m365copilot');
    expect(m365Links).toContain('copilot');
  });

  it('should not configure linkedPlatforms for non-linked platforms', () => {
    expect(SUPPORTED_PLATFORMS.claude.linkedPlatforms).toBeUndefined();
    expect(SUPPORTED_PLATFORMS.chatgpt.linkedPlatforms).toBeUndefined();
    expect(SUPPORTED_PLATFORMS.gemini.linkedPlatforms).toBeUndefined();
    expect(SUPPORTED_PLATFORMS.mistral.linkedPlatforms).toBeUndefined();
    expect(SUPPORTED_PLATFORMS.perplexity.linkedPlatforms).toBeUndefined();
  });
});

describe('getLinkedPlatformHostnames', () => {
  it('should return both copilot hostnames when given copilot.microsoft.com', () => {
    const linked = getLinkedPlatformHostnames('copilot.microsoft.com');
    expect(linked).toContain('copilot.microsoft.com');
    expect(linked).toContain('m365.cloud.microsoft');
    expect(linked).toHaveLength(2);
  });

  it('should return both copilot hostnames when given m365.cloud.microsoft', () => {
    const linked = getLinkedPlatformHostnames('m365.cloud.microsoft');
    expect(linked).toContain('copilot.microsoft.com');
    expect(linked).toContain('m365.cloud.microsoft');
    expect(linked).toHaveLength(2);
  });

  it('should return just the hostname for non-linked platforms', () => {
    expect(getLinkedPlatformHostnames('claude.ai')).toEqual(['claude.ai']);
    expect(getLinkedPlatformHostnames('chatgpt.com')).toEqual(['chatgpt.com']);
    expect(getLinkedPlatformHostnames('gemini.google.com')).toEqual(['gemini.google.com']);
    expect(getLinkedPlatformHostnames('chat.mistral.ai')).toEqual(['chat.mistral.ai']);
    expect(getLinkedPlatformHostnames('www.perplexity.ai')).toEqual(['www.perplexity.ai']);
  });

  it('should return just the hostname for unknown platforms', () => {
    const unknownHostname = 'unknown.example.com';
    const result = getLinkedPlatformHostnames(unknownHostname);
    expect(result).toEqual([unknownHostname]);
  });

  it('should deduplicate hostnames in the result', () => {
    const linked = getLinkedPlatformHostnames('copilot.microsoft.com');
    const uniqueHostnames = new Set(linked);
    expect(uniqueHostnames.size).toBe(linked.length);
  });

  it('should always include the original hostname in the result', () => {
    const hostname = 'copilot.microsoft.com';
    const linked = getLinkedPlatformHostnames(hostname);
    expect(linked).toContain(hostname);
  });
});
