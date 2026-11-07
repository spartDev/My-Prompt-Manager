// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');

/**
 * CODING_STANDARDS.md and the docs it routes to cite source files by path instead of copying the
 * code (My-Prompt-Manager-uxu.3, xds.4). A path that no longer exists sends an agent nowhere, so
 * every src/ or tests/ path they cite must exist. Paths from the repository root.
 */
const ROUTED_DOCS = [
  'CODING_STANDARDS.md',
  'docs/ARCHITECTURE.md',
  'docs/COMPONENTS.md',
  'docs/DESIGN_GUIDELINES.md',
  'docs/ELEMENT_FINGERPRINTING_DESIGN.md',
  'docs/SERVICES_AND_HOOKS.md',
  'docs/TESTING.md'
];

/** The ADRs and the repo skills are checked the same way, but one of them may cite no path at all. */
const ADRS = readdirSync(path.join(ROOT, 'docs/adr'))
  .filter((file) => file.endsWith('.md'))
  .map((file) => `docs/adr/${file}`);
const SKILLS = readdirSync(path.join(ROOT, '.claude/skills'))
  .map((skill) => `.claude/skills/${skill}/SKILL.md`)
  .filter((skill) => existsSync(path.join(ROOT, skill)));

const DOCS = [...ROUTED_DOCS, ...ADRS, ...SKILLS];

/**
 * src/services/storage.ts, ../tests/e2e/pages/ (a link from docs/), src/hooks/useNow.ts:10 (the line
 * is dropped), tests/e2e/codex-repro-<id>.spec.ts (a <placeholder> segment is kept, so that
 * isPlaceholder sees it); not a folder of another name that ends in src, such as foo/src/
 */
const CITED_PATH = /(?<![\w-])(?<![\w-]\/)(?:src|tests)\/(?:[\w./-]|<\w+>)*(?:[\w/]|<\w+>)/g;

/**
 * A worked example names a Platform that does not exist (docs/ARCHITECTURE.md, the add-platform
 * skill), and a path with a <placeholder> segment is one the reader creates (the codex-review skill).
 */
const PLACEHOLDER = /\/(?:yourplatform|your-platform|newplatform|newreactplatform)-|<\w+>/;

function citedPaths(markdown: string): string[] {
  return [...new Set(markdown.match(CITED_PATH) ?? [])];
}

function isPlaceholder(cited: string): boolean {
  return PLACEHOLDER.test(cited);
}

describe('Paths cited by the agent docs', () => {
  it('finds the paths a doc cites', () => {
    const doc = 'See `src/services/storage.ts`, [the pages](../tests/e2e/pages/) and src/hooks/useNow.ts:10.';

    expect(citedPaths(doc)).toEqual(['src/services/storage.ts', 'tests/e2e/pages/', 'src/hooks/useNow.ts']);
  });

  it('tells a placeholder from a path', () => {
    const doc = 'Copy `src/content/platforms/yourplatform-strategy.ts`, then `tests/e2e/codex-repro-<id>.spec.ts` in tests/e2e/<folder>.';

    expect(citedPaths(doc)).toEqual([
      'src/content/platforms/yourplatform-strategy.ts',
      'tests/e2e/codex-repro-<id>.spec.ts',
      'tests/e2e/<folder>'
    ]);
    expect(citedPaths(doc).every(isPlaceholder)).toBe(true);
    expect(isPlaceholder('src/content/platforms/claude-strategy.ts')).toBe(false);
  });

  it.each(ROUTED_DOCS)('%s cites at least one path', (doc) => {
    expect(citedPaths(readFileSync(path.join(ROOT, doc), 'utf8')).length).toBeGreaterThan(0);
  });

  it.each(DOCS)('every src/ and tests/ path in %s exists', (doc) => {
    const cited = citedPaths(readFileSync(path.join(ROOT, doc), 'utf8')).filter((file) => !isPlaceholder(file));

    expect(cited.filter((file) => !existsSync(path.join(ROOT, file)))).toEqual([]);
  });
});
