/**
 * A Platform page with no composer gets no Prompts button: on chatgpt.com/settings/*, the input
 * selectors of ChatGPT and of the fallback strategy matched the settings' Search box (seen live on
 * 2026-11-15, ticket My-Prompt-Manager-6m8), and inserting a Prompt there makes no sense.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlatformManager } from '../platform-manager';

vi.mock('../../utils/storage', () => ({
  getSettings: vi.fn().mockResolvedValue({ customSites: [], debugMode: false })
}));

/**
 * A settings page, reconstructed (the live page needs sign-in): the sidebar's Search settings box
 * the ticket describes, and a textarea that is made up, a second field the extension must not take
 */
const SETTINGS_PAGE = /* html */ `
  <div>
    <nav aria-label="Settings">
      <input type="text" placeholder="Search settings" aria-label="Search settings">
      <a href="/settings/general">General</a>
      <a href="/settings/appearance">Appearance</a>
    </nav>
    <main>
      <h1>Appearance</h1>
      <label>Custom instructions <textarea placeholder="Message style"></textarea></label>
    </main>
  </div>`;

const COMPOSER_PAGE = readFileSync(resolve(__dirname, '../../../../tests/fixtures/composers/chatgpt.html'), 'utf8');

const realLocation = window.location;

/** A PlatformManager on chatgpt.com, at this path */
async function managerAt(pathname: string): Promise<PlatformManager> {
  Object.defineProperty(window, 'location', {
    value: { hostname: 'chatgpt.com', pathname, href: `https://chatgpt.com${pathname}` },
    writable: true,
    configurable: true
  });
  const manager = new PlatformManager();
  await manager.initializeStrategies();
  return manager;
}

/** The elements of the page that the manager's selectors match */
function matchedFields(manager: PlatformManager): Element[] {
  return manager.getAllSelectors().flatMap((selector) => Array.from(document.querySelectorAll(selector)));
}

describe('pages without a composer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'location', { value: realLocation, writable: true, configurable: true });
  });

  it.each(['/settings', '/settings/appearance', '/settings/personalization'])('on chatgpt.com%s no input field is matched', async (pathname) => {
    document.body.innerHTML = SETTINGS_PAGE;
    const manager = await managerAt(pathname);

    expect(matchedFields(manager)).toEqual([]);
  });

  it.each(['/', '/c/6741a2b0-1234', '/g/g-abc-writer'])('on chatgpt.com%s the composer is still matched', async (pathname) => {
    document.body.innerHTML = COMPOSER_PAGE;
    const editor = document.querySelector('[contenteditable="true"]');
    const manager = await managerAt(pathname);

    expect(matchedFields(manager)).toContain(editor);
  });

  it('a path that only starts with the same letters is not a settings page', async () => {
    document.body.innerHTML = COMPOSER_PAGE;
    const manager = await managerAt('/settingsguide');

    expect(matchedFields(manager).length).toBeGreaterThan(0);
  });
});
