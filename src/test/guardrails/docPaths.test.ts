// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');

const read = (file: string): string => readFileSync(path.join(ROOT, file), 'utf8');

/**
 * The agent docs cite source files by path instead of copying the code (My-Prompt-Manager-uxu.3,
 * xds.4). A path that no longer exists sends an agent nowhere, so every src/ or tests/ path cited by
 * a routing file, or by a doc a routing file routes to, must exist. The list of docs is read from the
 * routing files themselves (My-Prompt-Manager-zgcb): a new route is checked with no edit here.
 * Paths from the repository root.
 */

/** The routing files: the two every session reads, and the repo skills */
const SKILLS = readdirSync(path.join(ROOT, '.claude/skills'))
  .map((skill) => `.claude/skills/${skill}/SKILL.md`)
  .filter((skill) => existsSync(path.join(ROOT, skill)));
const ROUTING_FILES = ['AGENTS.md', 'CODING_STANDARDS.md', ...SKILLS];

/**
 * docs/TESTING.md, docs/adr/ (a folder: every .md in it), ../../../docs/RELEASE_WORKFLOW.md (a link
 * from a skill, the repository's docs/ all the same); not docs/ alone, which names the folder and no
 * doc, nor a folder of another name that ends in docs, such as tests/e2e/docs/
 */
const ROUTE = /(?<![\w-])(?<![\w-]\/)docs\/[\w./-]*[\w/]/g;

function routesOf(markdown: string): string[] {
  return [...new Set(markdown.match(ROUTE) ?? [])];
}

const isFolder = (route: string): boolean =>
  statSync(path.join(ROOT, route), { throwIfNoEntry: false })?.isDirectory() ?? false;

/** The folder a route names, with its trailing slash, whether or not the route was written with it */
function folderOf(route: string): string | undefined {
  if (route.endsWith('/')) {
    return route;
  }
  return path.extname(route) === '' && isFolder(route) ? `${route}/` : undefined;
}

/**
 * The docs a route names: a folder's .md files, or the .md file itself. A folder that is gone, and a
 * route with no extension that names no folder, stay, so that their "exists" case fails; a route to
 * another kind of file, such as an image, names no doc.
 */
function docsOf(route: string): string[] {
  const folder = folderOf(route);
  if (folder !== undefined) {
    return isFolder(folder)
      ? readdirSync(path.join(ROOT, folder))
          .filter((file) => file.endsWith('.md'))
          .map((file) => `${folder}${file}`)
      : [folder];
  }
  return route.endsWith('.md') || path.extname(route) === '' ? [route] : [];
}

const ROUTES = ROUTING_FILES.flatMap((file) => routesOf(read(file)));
const ROUTED_DOCS = [...new Set(ROUTES.flatMap(docsOf))].sort();

/**
 * CODING_STANDARDS.md and the docs it routes to by name each cite at least one path, so a regex that
 * stopped matching cannot pass the check below unseen. The docs of a routed folder (the ADRs, even
 * one also named alone), and those only AGENTS.md or a skill routes to, may cite none.
 */
const STANDARDS_ROUTES = routesOf(read('CODING_STANDARDS.md'));
const ROUTED_FOLDERS = ROUTES.map(folderOf).filter((folder) => folder !== undefined);
const CITING_DOCS = [
  'CODING_STANDARDS.md',
  ...STANDARDS_ROUTES.filter((route) => route.endsWith('.md') && !ROUTED_FOLDERS.some((folder) => route.startsWith(folder)))
];

const DOCS = [...new Set([...ROUTING_FILES, ...ROUTED_DOCS])];

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
  it('finds the docs a routing file routes to', () => {
    const doc = 'Read `docs/TESTING.md`, the ADRs in docs/adr/, [the rules](../../../docs/RELEASE_WORKFLOW.md). Grep `docs/`, not tests/e2e/docs/notes.md.';

    expect(routesOf(doc)).toEqual(['docs/TESTING.md', 'docs/adr/', 'docs/RELEASE_WORKFLOW.md']);
    expect(docsOf('docs/adr/')).toContain('docs/adr/ADR-001-store-and-deliver-prompts-verbatim.md');
    expect(docsOf('docs/images/flow.png')).toEqual([]);
  });

  it('reads a folder route written without its slash as the folder, and keeps a route that names nothing', () => {
    expect(folderOf('docs/adr')).toBe('docs/adr/');
    expect(docsOf('docs/adr')).toEqual(docsOf('docs/adr/'));
    expect(docsOf('docs/no-such-folder')).toEqual(['docs/no-such-folder']);
    expect(existsSync(path.join(ROOT, 'docs/no-such-folder'))).toBe(false);
  });

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

  it.each(ROUTED_DOCS)('%s, which a routing file routes to, exists', (doc) => {
    expect(existsSync(path.join(ROOT, doc))).toBe(true);
  });

  it.each(CITING_DOCS)('%s cites at least one path', (doc) => {
    expect(citedPaths(read(doc)).length).toBeGreaterThan(0);
  });

  it.each(DOCS)('every src/ and tests/ path in %s exists', (doc) => {
    const cited = citedPaths(read(doc)).filter((file) => !isPlaceholder(file));

    expect(cited.filter((file) => !existsSync(path.join(ROOT, file)))).toEqual([]);
  });
});
