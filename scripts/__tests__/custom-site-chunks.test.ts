import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkCustomSiteChunks, matchesResourcePattern } from '../custom-site-chunks.mjs';

const SCRIPT = path.resolve(__dirname, '..', 'custom-site-chunks.mjs');

const PLATFORM_ENTRY = { matches: ['https://claude.ai/*'], resources: ['assets/*'] };

/** A dist shaped like the build: a loader that imports the content entry, which imports two shared chunks, minified and not. */
type ResourceEntry = { matches: string[]; resources: string[] };

const writeDist = (
  dist: string,
  customSiteResources: string[],
  customSiteMatches = ['https://*/*', 'http://*/*'],
  moreEntries: ResourceEntry[] = []
) => {
  mkdirSync(path.join(dist, 'assets'), { recursive: true });
  const files: Record<string, string> = {
    'assets/index.ts-loader-a1.js': '(function(){import(chrome.runtime.getURL("assets/src-content-index.ts-b2.js"))})();',
    'assets/src-content-index.ts-b2.js': 'import"./content-c3.js";',
    'assets/content-c3.js': 'import{a}from"./rolldown-runtime-d4.js";const m=import(`./categoryChip-e5.js`);',
    'assets/rolldown-runtime-d4.js': 'export const a=1;',
    'assets/categoryChip-e5.js': "import { a } from './rolldown-runtime-d4.js';"
  };
  for (const [file, source] of Object.entries(files)) {
    writeFileSync(path.join(dist, file), source);
  }
  writeFileSync(
    path.join(dist, 'manifest.json'),
    JSON.stringify({
      content_scripts: [{ js: ['assets/index.ts-loader-a1.js'] }],
      web_accessible_resources: [PLATFORM_ENTRY, { matches: customSiteMatches, resources: customSiteResources }, ...moreEntries]
    })
  );
};

const ALL_PATTERNS = ['assets/src-content-index.ts-*.js', 'assets/content-*.js', 'assets/rolldown-runtime-*.js', 'assets/categoryChip-*.js'];

describe('custom-site-chunks', () => {
  let dist: string;

  beforeEach(() => {
    dist = mkdtempSync(path.join(tmpdir(), 'custom-site-chunks-'));
  });

  afterEach(() => {
    rmSync(dist, { recursive: true, force: true });
  });

  it('walks every chunk the loader reaches and finds none unmatched when each has a pattern', () => {
    writeDist(dist, ALL_PATTERNS);

    expect(checkCustomSiteChunks(dist)).toEqual({
      chunks: ['src-content-index.ts-b2.js', 'content-c3.js', 'rolldown-runtime-d4.js', 'categoryChip-e5.js'],
      unmatched: []
    });
  });

  it.each([[['*://*/*']], [['<all_urls>']]])('accepts an entry matching %j as covering both schemes', (matches) => {
    writeDist(dist, ALL_PATTERNS, matches);

    expect(checkCustomSiteChunks(dist).unmatched).toEqual([]);
  });

  it('does not count an entry that matches https origins only', () => {
    writeDist(dist, ALL_PATTERNS, ['https://*/*']);

    expect(checkCustomSiteChunks(dist).unmatched).toHaveLength(4);
  });

  it('combines an https entry and an http entry that each open every chunk', () => {
    writeDist(dist, ALL_PATTERNS, ['https://*/*'], [{ matches: ['http://*/*'], resources: ALL_PATTERNS }]);

    expect(checkCustomSiteChunks(dist).unmatched).toEqual([]);
  });

  it('names a chunk the https entry opens but the http entry does not', () => {
    const withoutCategoryChip = ALL_PATTERNS.filter((pattern) => !pattern.includes('categoryChip'));
    writeDist(dist, ALL_PATTERNS, ['https://*/*'], [{ matches: ['http://*/*'], resources: withoutCategoryChip }]);

    expect(checkCustomSiteChunks(dist).unmatched).toEqual(['categoryChip-e5.js']);
  });

  it('names a chunk whose pattern is missing, though a built-in Platform entry matches it', () => {
    writeDist(
      dist,
      ALL_PATTERNS.filter((pattern) => !pattern.includes('categoryChip'))
    );

    expect(checkCustomSiteChunks(dist).unmatched).toEqual(['categoryChip-e5.js']);
  });

  it('exits 0 on a matched dist and 1, naming the chunk, on an unmatched one', () => {
    writeDist(dist, ALL_PATTERNS);
    const passing = spawnSync(process.execPath, [SCRIPT, dist], { encoding: 'utf8' });
    expect(passing.status).toBe(0);

    writeDist(
      dist,
      ALL_PATTERNS.filter((pattern) => !pattern.includes('rolldown-runtime'))
    );
    const failing = spawnSync(process.execPath, [SCRIPT, dist], { encoding: 'utf8' });
    expect(failing.status).toBe(1);
    expect(failing.stderr).toContain('assets/rolldown-runtime-d4.js');
  });

  it('exits 2 when there is no build to check', () => {
    const result = spawnSync(process.execPath, [SCRIPT, path.join(dist, 'missing')], { encoding: 'utf8' });
    expect(result.status).toBe(2);
  });

  it.each([
    ['assets/content-*.js', 'assets/content-c3.js', true],
    ['assets/content-*.js', 'assets/contentX.js', false],
    ['assets/src-content-index.ts-*.js', 'assets/src-content-index.ts-b2.js', true],
    ['assets/src-content-index.ts-*.js', 'assets/src-content-indexXts-b2.js', false]
  ])('pattern %s matches %s: %s', (pattern, resource, expected) => {
    expect(matchesResourcePattern(pattern, resource)).toBe(expected);
  });
});
