/**
 * AC3 of My-Prompt-Manager-ojz.8: the Platform pills of the Welcome's last step come from the config
 * (src/config/platforms.ts), never from a list of their own. A Platform added to the config here gets
 * its pill; Copilot and M365 Copilot, linked there, show once.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import WelcomeHost from '../WelcomeHost';

vi.mock('../../../config/platforms', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../config/platforms')>();
  return {
    ...original,
    SUPPORTED_PLATFORMS: {
      ...original.SUPPORTED_PLATFORMS,
      deepseek: {
        id: 'deepseek',
        hostname: 'chat.deepseek.com',
        displayName: 'DeepSeek',
        priority: 70,
        defaultEnabled: true,
        selectors: ['textarea'],
        strategyClass: 'DefaultStrategy'
      }
    }
  };
});

describe('Welcome step 3: the Platform pills read the config', () => {
  it('a Platform added to the config gets its pill; linked Platforms appear once', () => {
    render(<WelcomeHost step={2} saveStep={vi.fn()} finishWelcome={vi.fn()} />);

    const pills = within(screen.getByRole('list', { name: 'Type // in the chat on' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(pills).toContain('DeepSeek');
    expect(pills.at(-1)).toBe('DeepSeek');
    expect(pills.filter((name) => name?.includes('Copilot'))).toEqual(['Copilot']);
    expect(new Set(pills).size).toBe(pills.length);
  });
});
