import { describe, expect, it } from 'vitest';

import { type PlatformDefinition, SUPPORTED_PLATFORMS } from '../../config/platforms';
import { welcomePlatformNames } from '../platforms';

/** A Platform as the config writes one: only what the pills read matters here */
const platform = (id: string, displayName: string, priority: number, linkedPlatforms?: string[]): PlatformDefinition => ({
  id,
  hostname: `${id}.example`,
  displayName,
  priority,
  defaultEnabled: true,
  selectors: ['textarea'],
  strategyClass: 'DefaultStrategy',
  ...(linkedPlatforms ? { linkedPlatforms } : {})
});

describe('The Platform pills of the Welcome', () => {
  it('names every supported Platform by its short name, highest priority first, linked Platforms once', () => {
    expect(welcomePlatformNames()).toEqual(['Claude', 'ChatGPT', 'Mistral', 'Gemini', 'Perplexity', 'Copilot']);
  });

  it('reads the config: a Platform added there gets its pill, under its display name when it has no short name', () => {
    const withNew = { ...SUPPORTED_PLATFORMS, deepseek: platform('deepseek', 'DeepSeek', 70) };

    expect(welcomePlatformNames(withNew)).toEqual(['Claude', 'ChatGPT', 'Mistral', 'Gemini', 'Perplexity', 'Copilot', 'DeepSeek']);
  });

  it('shows a group of linked Platforms once, under the first of the group by priority', () => {
    const platforms = {
      alpha: platform('alpha', 'Alpha', 50, ['beta', 'gamma']),
      beta: platform('beta', 'Beta', 60, ['alpha']),
      gamma: platform('gamma', 'Gamma', 40, ['alpha']),
      delta: platform('delta', 'Delta', 55)
    };

    expect(welcomePlatformNames(platforms)).toEqual(['Beta', 'Delta']);
  });

  it('keeps the order of the config between Platforms of the same priority', () => {
    const platforms = {
      second: platform('second', 'Second', 10),
      first: platform('first', 'First', 10)
    };

    expect(welcomePlatformNames(platforms)).toEqual(['Second', 'First']);
  });

  it('M365 Copilot, linked to Copilot, is never a pill of its own', () => {
    expect(welcomePlatformNames()).not.toContain('M365 Copilot');
    expect(welcomePlatformNames().filter((name) => name.includes('Copilot'))).toEqual(['Copilot']);
  });
});
