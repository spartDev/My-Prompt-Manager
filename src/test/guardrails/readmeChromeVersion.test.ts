// @vitest-environment node
/**
 * README.md states the minimum Chrome version in its badge and in its text; each statement equals
 * manifest.json minimum_chrome_version, so a change to the manifest updates the README too
 * (My-Prompt-Manager-90c).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');

/** Chrome-116%2B (badge), Chrome 116+, Chrome Browser](…) 116+, | Edge | 116+ |: Edge follows Chromium's numbers */
const CHROME_VERSION = /\b(?:Chrome|Edge)\b[^\d\n]*(\d+)(?:\+|%2B)/g;
const BADGE = /img\.shields\.io\/badge\/Chrome-(\d+)%2B/;

function chromeVersionsIn(markdown: string): { line: number; version: string }[] {
  return markdown.split('\n').flatMap((text, index) =>
    [...text.matchAll(CHROME_VERSION)].map((match) => ({ line: index + 1, version: match[1] }))
  );
}

describe('README Chrome version', () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')) as { minimum_chrome_version: string };
  const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');

  it('badge equals manifest.json minimum_chrome_version', () => {
    expect(readme.match(BADGE)?.[1], 'Chrome badge').toBe(manifest.minimum_chrome_version);
  });

  it('every Chrome and Edge version in the text equals manifest.json minimum_chrome_version', () => {
    const found = chromeVersionsIn(readme);

    expect(found.length, 'Chrome versions found in README.md').toBeGreaterThan(1);
    expect(found.filter(({ version }) => version !== manifest.minimum_chrome_version)).toEqual([]);
  });

  it('finds the versions in each form the README uses', () => {
    const sample = [
      '[![Chrome](https://img.shields.io/badge/Chrome-110%2B-yellow.svg)](https://www.google.com/chrome/)',
      '✅ **Side Panel Support:** Chrome 111+ dual interface mode',
      '- [Chrome Browser](https://www.google.com/chrome/) 112+',
      '| Edge | 113+ | ✅ Fully Supported |',
      '| Opera | 102+ | ⚠️ Should work (untested) |'
    ].join('\n');

    expect(chromeVersionsIn(sample).map(({ version }) => version)).toEqual(['110', '111', '112', '113']);
  });
});
