/**
 * E2E: `npm run composers:capture` in a real browser, on a stand-in page served by route
 * interception (the live Platforms need the maintainer's sign-in). Its unit tests cover the
 * sanitizer and the options; this covers what only a browser can: finding the editor.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { capture, parseCaptureArgs } from '../../../scripts/capture-composers';
import { SUPPORTED_PLATFORMS } from '../../../src/config/platforms';

const STAND_IN = 'https://capture.test/claude';
const CLAUDE_COMPOSER = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/composers/claude.html'), 'utf8');

test.describe('composers:capture in a browser', () => {
  let out: string;

  test.beforeEach(() => {
    out = mkdtempSync(path.join(tmpdir(), 'composers-'));
  });

  test.afterEach(() => {
    rmSync(out, { recursive: true, force: true });
  });

  test('finds the visible editor when a hidden textarea comes before it in the page', async ({ page }) => {
    await page.route('https://capture.test/**', (route) => route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><body><textarea style="display:none" aria-label="Search history"></textarea>${CLAUDE_COMPOSER}</body>`
    }));
    const options = parseCaptureArgs(['--url', `claude=${STAND_IN}`, '--out', out, '--settle', '0', '--timeout', '3000']);

    const result = await capture(page, 'claude', SUPPORTED_PLATFORMS.claude, options);

    expect(result).toMatchObject({ id: 'claude', outcome: 'captured', composerFound: true });
    const fixture = readFileSync(path.join(out, 'claude.html'), 'utf8');
    expect(fixture).toContain('data-testid="chat-input"');
    expect(fixture).toContain('data-testid="composer-dictate"');
    expect(fixture).not.toContain('Search history');
  });

  test('says there is no editor when the only editor is visibility:hidden', async ({ page }) => {
    await page.route('https://capture.test/**', (route) => route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><body><div style="visibility:hidden">${CLAUDE_COMPOSER}</div></body>`
    }));
    const options = parseCaptureArgs(['--url', `claude=${STAND_IN}`, '--out', out, '--settle', '0', '--timeout', '1000']);

    expect(await capture(page, 'claude', SUPPORTED_PLATFORMS.claude, options)).toEqual({ id: 'claude', outcome: 'no-editor', url: STAND_IN });
  });

  test('says there is no editor when the page has none visible', async ({ page }) => {
    await page.route('https://capture.test/**', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><body><textarea style="display:none"></textarea><p>Sign in</p></body>'
    }));
    const options = parseCaptureArgs(['--url', `claude=${STAND_IN}`, '--out', out, '--settle', '0', '--timeout', '1000']);

    expect(await capture(page, 'claude', SUPPORTED_PLATFORMS.claude, options)).toEqual({ id: 'claude', outcome: 'no-editor', url: STAND_IN });
  });
});
