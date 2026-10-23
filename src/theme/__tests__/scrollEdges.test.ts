// @vitest-environment node
/**
 * The lines under the header and above the tab bar (src/popup.css) are scroll-driven animations on a
 * timeline shared through timeline-scope, which Chrome ships from 116. The manifest must not accept an
 * older Chrome: the header and the tab bar would lose their lines there (PR #451 review).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');

describe('Header and tab bar lines', () => {
  it('ship only to a Chrome with timeline-scope (116 or later)', () => {
    const popupCss = readFileSync(path.join(ROOT, 'src/popup.css'), 'utf8');
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')) as { minimum_chrome_version: string };

    expect(popupCss).toMatch(/timeline-scope:\s*--section-scroll/);
    expect(Number(manifest.minimum_chrome_version)).toBeGreaterThanOrEqual(116);
  });
});
