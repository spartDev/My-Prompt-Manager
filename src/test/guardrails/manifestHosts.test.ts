// @vitest-environment node
/**
 * The hosts and the API permissions of manifest.json stay those of 1.9.0. Chrome counts a host the
 * installed version did not have, in host_permissions or in a content script's matches, as a
 * permission increase: an update from the Chrome Web Store then disables the extension for every
 * user, until each one accepts the new permission in a dialog that also offers Remove, which deletes
 * their Library. A new API permission that shows a warning, such as "history", does the same. One
 * without a warning does not, but `permissions` is pinned whole, so that the owner decides each one.
 * Proven on 2026-11-20 with packed 1.9.0 and 2.0.0 builds (ticket My-Prompt-Manager-totf), which is
 * why 2.0.0 left copilot.cloud.microsoft out (ticket My-Prompt-Manager-j74b brings it back through
 * the optional host permission the user grants).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');

/** host_permissions and the content script matches of manifest.json at v1.9.0, the Release on the Chrome Web Store */
const HOSTS_OF_1_9_0 = [
  'https://claude.ai/*',
  'https://chatgpt.com/*',
  'https://gemini.google.com/*',
  'https://www.perplexity.ai/*',
  'https://chat.mistral.ai/*',
  'https://copilot.microsoft.com/*',
  'https://m365.cloud.microsoft/*'
];

/** permissions of manifest.json at v1.9.0 */
const PERMISSIONS_OF_1_9_0 = ['storage', 'activeTab', 'tabs', 'sidePanel', 'scripting'];

const NEEDS_THE_OWNER =
  'A host or an API permission added here disables the extension on update for every user until they accept it (ticket My-Prompt-Manager-totf). ' +
  'Changing these lists needs the owner\'s decision: ask before you change them, and update HOSTS_OF_1_9_0 or PERMISSIONS_OF_1_9_0 only once they have decided';

describe('manifest.json hosts and permissions: a new one disables the extension on update for every user (ticket My-Prompt-Manager-totf)', () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')) as {
    permissions: string[];
    host_permissions: string[];
    content_scripts: Array<{ matches: string[] }>;
  };
  const sorted = (values: readonly string[]) => [...values].sort();

  it('host_permissions equals 1.9.0\'s', () => {
    expect(sorted(manifest.host_permissions), NEEDS_THE_OWNER).toEqual(sorted(HOSTS_OF_1_9_0));
  });

  it('each content script matches 1.9.0\'s hosts', () => {
    expect(manifest.content_scripts.length, NEEDS_THE_OWNER).toBeGreaterThan(0);
    for (const script of manifest.content_scripts) {
      expect(sorted(script.matches), NEEDS_THE_OWNER).toEqual(sorted(HOSTS_OF_1_9_0));
    }
  });

  it('permissions equals 1.9.0\'s', () => {
    expect(sorted(manifest.permissions), NEEDS_THE_OWNER).toEqual(sorted(PERMISSIONS_OF_1_9_0));
  });
});
