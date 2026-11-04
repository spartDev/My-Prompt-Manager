// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The docs that CODING_STANDARDS.md sends agents to cite source files by path instead of copying
 * the code (My-Prompt-Manager-uxu.3). A path that no longer exists sends an agent nowhere, so every
 * src/ or tests/ path they cite must exist. Paths from the repository root.
 */
const DOCS = ['docs/COMPONENTS.md', 'docs/SERVICES_AND_HOOKS.md', 'docs/TESTING.md'];

const ROOT = path.resolve(__dirname, '../../..');

/**
 * src/services/storage.ts, ../tests/e2e/pages/ (a link from docs/), src/hooks/useNow.ts:10 (the line
 * is dropped); not a folder of another name that ends in src, such as foo/src/
 */
const CITED_PATH = /(?<![\w-])(?<![\w-]\/)(?:src|tests)\/[\w./-]*[\w/]/g;

function citedPaths(markdown: string): string[] {
  return [...new Set(markdown.match(CITED_PATH) ?? [])];
}

describe('Paths cited by the agent docs', () => {
  it('finds the paths a doc cites', () => {
    const doc = 'See `src/services/storage.ts`, [the pages](../tests/e2e/pages/) and src/hooks/useNow.ts:10.';

    expect(citedPaths(doc)).toEqual(['src/services/storage.ts', 'tests/e2e/pages/', 'src/hooks/useNow.ts']);
  });

  it.each(DOCS)('every src/ and tests/ path in %s exists', (doc) => {
    const cited = citedPaths(readFileSync(path.join(ROOT, doc), 'utf8'));

    expect(cited.length).toBeGreaterThan(0);
    expect(cited.filter((file) => !existsSync(path.join(ROOT, file)))).toEqual([]);
  });
});
