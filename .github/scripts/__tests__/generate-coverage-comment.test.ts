import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import vitestConfig from '../../../vitest.config';

const require = createRequire(import.meta.url);
const {
  COMMENT_MARKER,
  COVERAGE_THRESHOLDS,
  buildReport,
  displayPath,
  formatBar,
  generateCoverageComment,
  parseSummary
} = require('../generate-coverage-comment.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const WORKSPACE = '/home/runner/work/My-Prompt-Manager/My-Prompt-Manager';
const HEAD_SHA = 'a1b2c3d'.padEnd(40, '0');
const RUN_URL = 'https://github.com/spartDev/My-Prompt-Manager/actions/runs/123456';

type Metric = { total: number; covered: number; skipped: number; pct: unknown };
type Entry = Record<string, Metric>;

const metric = (pct: unknown, covered = 85, total = 100): Metric => ({ total, covered, skipped: 0, pct });
const entry = (pct: unknown): Entry => ({
  lines: metric(pct),
  statements: metric(pct),
  functions: metric(pct),
  branches: metric(pct)
});
const summaryText = (files: Record<string, unknown> = {}, total: Entry = entry(85)) => JSON.stringify({ total, ...files });

/** The table rows of a comment: every line that starts a Markdown table row. */
const tableRows = (body: string) => body.split('\n').filter((line) => line.startsWith('|'));

const run = (overrides: Record<string, unknown> = {}) => ({
  event: 'pull_request',
  conclusion: 'success',
  head_sha: HEAD_SHA,
  head_branch: 'feature/pr-coverage-reporting',
  head_repository: { full_name: 'spartDev/My-Prompt-Manager', owner: { login: 'spartDev' } },
  html_url: RUN_URL,
  pull_requests: [],
  ...overrides
});

const contextFor = (workflowRun: Record<string, unknown>) => ({
  repo: { owner: 'spartDev', repo: 'My-Prompt-Manager' },
  payload: { workflow_run: workflowRun }
});

type Pull = { number: number; draft?: boolean; head: { sha: string; ref: string; repo: { owner: { login: string } } } };
type Comment = { id: number; user: { login: string }; body: string };

const pull = (number: number, { owner = 'spartDev', ref = 'feature/pr-coverage-reporting', sha = HEAD_SHA, draft = false } = {}): Pull => ({
  number,
  draft,
  head: { sha, ref, repo: { owner: { login: owner } } }
});

/** An Octokit stand-in: pulls.list filters on `owner:branch` as GitHub's `head` parameter does. */
function fakeGithub({ pulls = [] as Pull[], comments = [] as Comment[] } = {}) {
  const rest = {
    pulls: { list: vi.fn() },
    issues: {
      listComments: vi.fn(),
      createComment: vi.fn(async () => ({ data: { id: 1000 } })),
      updateComment: vi.fn(async () => ({ data: {} })),
      deleteComment: vi.fn(async () => ({ data: {} }))
    }
  };
  const paginate = vi.fn(async (method: unknown, params: { head?: string }) => {
    if (method === rest.pulls.list) {
      return pulls.filter((p) => `${p.head.repo.owner.login}:${p.head.ref}` === params.head);
    }
    if (method === rest.issues.listComments) {
      return comments;
    }
    throw new Error('unexpected paginate call');
  });
  return { rest, paginate };
}

const core = () => ({ info: vi.fn(), warning: vi.fn() });

describe('parseSummary', () => {
  it('accepts a 0% total, which is a real coverage and not a missing one', () => {
    const { total } = parseSummary(summaryText({}, entry(0)));
    expect(total.lines.pct).toBe(0);
  });

  it.each([
    ['above 100', 150],
    ['below 0', -10],
    ['a string', '85'],
    ['"Unknown", as istanbul writes for nothing covered', 'Unknown'],
    ['null', null]
  ])('rejects a total percentage that is %s', (_label, pct) => {
    expect(() => parseSummary(summaryText({}, entry(pct)))).toThrow(/total\.statements/);
  });

  it('rejects 1e999, which JSON.parse turns into Infinity', () => {
    const text = summaryText().replace('"pct":85', '"pct":1e999');
    expect(() => parseSummary(text)).toThrow(/not a percentage/);
  });

  it('rejects counts that are not counts, or more covered than total', () => {
    const notCounts = entry(85);
    notCounts.lines = { ...metric(85), covered: '85' as unknown as number };
    expect(() => parseSummary(summaryText({}, notCounts))).toThrow(/total\.lines/);

    const overCovered = entry(85);
    overCovered.branches = metric(85, 120, 100);
    expect(() => parseSummary(summaryText({}, overCovered))).toThrow(/total\.branches/);
  });

  it('rejects a file with no total entry, or that is not an object', () => {
    expect(() => parseSummary('[]')).toThrow(/no "total" entry/);
    expect(() => parseSummary(JSON.stringify({ 'src/a.ts': entry(10) }))).toThrow(/no "total" entry/);
  });

  it('never quotes the input in its error, as JSON.parse errors do', () => {
    const poisoned = '{"total": "@spartDev please [click](https://evil.example)';
    let message = '';
    try {
      parseSummary(poisoned);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe('coverage-summary.json is not valid JSON.');
  });

  it('skips a file entry that is null, a string, an array or has no line percentage, instead of throwing', () => {
    const { files } = parseSummary(
      summaryText({
        [`${WORKSPACE}/src/null.ts`]: null,
        [`${WORKSPACE}/src/string.ts`]: 'x',
        [`${WORKSPACE}/src/array.ts`]: [],
        [`${WORKSPACE}/src/no-lines.ts`]: { statements: metric(10) },
        [`${WORKSPACE}/src/kept.ts`]: { ...entry(40), branches: metric('NaN') }
      })
    );
    expect(files).toEqual([{ file: `${WORKSPACE}/src/kept.ts`, lines: 40, statements: 40, functions: 40, branches: null }]);
  });
});

describe('displayPath', () => {
  it('shows the path relative to the workspace', () => {
    expect(displayPath(`${WORKSPACE}/src/content/core/injector.ts`, WORKSPACE)).toBe('src/content/core/injector.ts');
    expect(displayPath(`${WORKSPACE}/src/content/src/nested.ts`, `${WORKSPACE}/`)).toBe('src/content/src/nested.ts');
  });

  it('replaces every character that could end the code span, the cell or the row', () => {
    const shown = displayPath('src/a.ts`\n| injected | row |\r\n@someone <img src=x>\u0000', WORKSPACE);
    expect(shown).not.toMatch(/[`|\r\n<>]/);
    expect(shown).not.toContain('\u0000');
    expect(shown).toBe('src/a.ts??? injected ? row ???@someone ?img src?x??');
  });

  it('keeps the end of a long path', () => {
    const shown = displayPath(`src/${'deep/'.repeat(40)}file.ts`, WORKSPACE);
    expect(shown).toHaveLength(100);
    expect(shown.startsWith('…')).toBe(true);
    expect(shown.endsWith('/file.ts')).toBe(true);
  });

  it('never shows an empty code span', () => {
    expect(displayPath('', WORKSPACE)).toBe('?');
  });
});

describe('formatBar', () => {
  it.each([-10, 0, 42.5, 100, 150, Number.NaN])('draws 20 cells for %s without a RangeError', (pct) => {
    expect([...formatBar(pct)]).toHaveLength(20);
  });
});

describe('buildReport', () => {
  const report = (files: Record<string, unknown>, total: Entry = entry(85)) =>
    buildReport({ summary: parseSummary(summaryText(files, total)), run: run(), workspace: WORKSPACE });

  it('lists the 10 files with the lowest line coverage, lowest first', () => {
    const files = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`${WORKSPACE}/src/f${String(i).padStart(2, '0')}.ts`, entry(90 - i * 5)]));
    const fileRows = tableRows(report(files)).filter((line) => line.startsWith('| `'));
    expect(fileRows).toHaveLength(10);
    expect(fileRows[0]).toContain('`src/f11.ts`');
    expect(fileRows[9]).toContain('`src/f02.ts`');
  });

  it('keeps a crafted file name inside its one table row', () => {
    const body = report({
      [`${WORKSPACE}/src/a.ts\n\n## Approved by @spartDev\n| x | y |`]: entry(10),
      [`${WORKSPACE}/src/b\`.ts\`](https://evil.example)`]: entry(20)
    });
    expect(body).not.toContain('\n## Approved');
    expect(body).not.toContain('](https://evil.example)');
    // 2 header rows + 4 metrics, 2 header rows + 2 files: a newline in a key adds no row.
    expect(tableRows(body)).toHaveLength(10);
  });

  it('says whether statements meet the floor of vitest.config.ts', () => {
    const floor = COVERAGE_THRESHOLDS.MINIMUM;
    expect(report({}, entry(floor))).toContain(`✅ Statements at ${floor}% meet the ${floor}% floor`);
    expect(report({}, entry(floor - 0.5))).toContain(`⚠️ Statements at ${floor - 0.5}% are below the ${floor}% floor`);
  });

  it('starts with the marker and names the commit and the run', () => {
    const body = report({});
    expect(body.startsWith(`${COMMENT_MARKER}\n`)).toBe(true);
    expect(body).toContain('Commit `a1b2c3d`');
    expect(body).toContain(`[Workflow run](${RUN_URL})`);
  });
});

describe('generateCoverageComment', () => {
  let dir: string;
  let summaryPath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'coverage-comment-'));
    summaryPath = path.join(dir, 'coverage-summary.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const call = (github: ReturnType<typeof fakeGithub>, workflowRun = run(), log = core()) =>
    generateCoverageComment({ github, context: contextFor(workflowRun), core: log, summaryPath, workspace: WORKSPACE });

  it('creates the report on the pull request whose head is the tested commit', async () => {
    writeFileSync(summaryPath, summaryText({ [`${WORKSPACE}/src/a.ts`]: entry(30) }));
    const github = fakeGithub({ pulls: [pull(383)] });

    await expect(call(github)).resolves.toBe(383);

    expect(github.rest.issues.createComment).toHaveBeenCalledTimes(1);
    const [{ issue_number, body }] = github.rest.issues.createComment.mock.calls[0] as unknown as [{ issue_number: number; body: string }];
    expect(issue_number).toBe(383);
    expect(body).toContain('## 🎉 Test Coverage Report: Excellent');
    expect(body).toContain('`src/a.ts`');
  });

  it('finds a pull request from a fork, for which workflow_run.pull_requests is empty', async () => {
    writeFileSync(summaryPath, summaryText());
    const github = fakeGithub({ pulls: [pull(7, { owner: 'someone' }), pull(8, { owner: 'contributor', ref: 'fix-typo' })] });
    const forkRun = run({
      head_branch: 'fix-typo',
      head_repository: { full_name: 'contributor/My-Prompt-Manager', owner: { login: 'contributor' } },
      pull_requests: []
    });

    await expect(call(github, forkRun)).resolves.toBe(8);
    expect(github.paginate).toHaveBeenCalledWith(github.rest.pulls.list, expect.objectContaining({ head: 'contributor:fix-typo', state: 'open' }));
  });

  it('leaves the comment alone when a newer commit is the head of the pull request', async () => {
    writeFileSync(summaryPath, summaryText());
    const github = fakeGithub({ pulls: [pull(383, { sha: 'f'.repeat(40) })] });

    await expect(call(github)).resolves.toBeNull();
    expect(github.paginate).not.toHaveBeenCalledWith(github.rest.issues.listComments, expect.anything());
    expect(github.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it('posts nothing on a draft, where PR checks run nothing', async () => {
    const github = fakeGithub({ pulls: [pull(383, { draft: true })] });

    await expect(call(github)).resolves.toBeNull();
    expect(github.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it('posts nothing for a run that a pull request did not trigger', async () => {
    const github = fakeGithub({ pulls: [pull(383)] });

    await expect(call(github, run({ event: 'push' }))).resolves.toBeNull();
    expect(github.paginate).not.toHaveBeenCalled();
  });

  it('updates its own comment in place and deletes duplicates, leaving every other comment', async () => {
    writeFileSync(summaryPath, summaryText());
    const bot = { login: 'github-actions[bot]' };
    const comments: Comment[] = [
      { id: 1, user: { login: 'spartDev' }, body: `${COMMENT_MARKER}\nquoted by a person` },
      { id: 2, user: bot, body: '## 🎉 Quality Gate Results ✅ PASSED' },
      { id: 3, user: bot, body: `${COMMENT_MARKER}\n## old report` },
      { id: 4, user: bot, body: `${COMMENT_MARKER}\n## ⚠️ Test Coverage Report Unavailable` }
    ];
    const github = fakeGithub({ pulls: [pull(383)], comments });

    await call(github);

    expect(github.rest.issues.createComment).not.toHaveBeenCalled();
    expect(github.rest.issues.updateComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 3 }));
    expect(github.rest.issues.deleteComment).toHaveBeenCalledTimes(1);
    expect(github.rest.issues.deleteComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 4 }));
  });

  it('replaces an older report with a notice when the checks left no summary', async () => {
    const github = fakeGithub({
      pulls: [pull(383)],
      comments: [{ id: 3, user: { login: 'github-actions[bot]' }, body: `${COMMENT_MARKER}\n## 🎉 Test Coverage Report: Excellent` }]
    });

    await expect(call(github, run({ conclusion: 'failure' }))).resolves.toBe(383);

    const [{ comment_id, body }] = github.rest.issues.updateComment.mock.calls[0] as unknown as [{ comment_id: number; body: string }];
    expect(comment_id).toBe(3);
    expect(body).toContain('## ⚠️ Test Coverage Report Unavailable');
    expect(body).toContain('The PR checks produced no coverage summary.');
    expect(body).toContain('conclusion `failure`');
  });

  it('reports a rejected summary without echoing any of it', async () => {
    writeFileSync(summaryPath, '{"total": {"lines": "@spartDev [click](https://evil.example)"}}');
    const github = fakeGithub({ pulls: [pull(383)] });
    const log = core();

    await call(github, run(), log);

    const [{ body }] = github.rest.issues.createComment.mock.calls[0] as unknown as [{ body: string }];
    expect(body).toContain('The coverage summary cannot be reported: total.statements is not a percentage');
    expect(body).not.toContain('evil.example');
    expect(body).not.toContain('@spartDev');
    expect(log.warning).toHaveBeenCalledTimes(1);
  });

  it('treats a symlink as no summary rather than follow it', async () => {
    const target = path.join(dir, 'elsewhere.json');
    writeFileSync(target, summaryText());
    symlinkSync(target, summaryPath);
    const github = fakeGithub({ pulls: [pull(383)] });

    await call(github);

    const [{ body }] = github.rest.issues.createComment.mock.calls[0] as unknown as [{ body: string }];
    expect(body).toContain('The PR checks produced no coverage summary.');
  });
});

describe('the workflows and Vitest config that the script depends on', () => {
  const readRepoFile = (file: string) => readFileSync(path.join(REPO_ROOT, file), 'utf8');
  const coverage = vitestConfig.test?.coverage as { reporter?: string[]; thresholds?: { statements?: number } } | undefined;

  it('uses the statements floor that vitest.config.ts enforces', () => {
    expect(COVERAGE_THRESHOLDS.MINIMUM).toBe(coverage?.thresholds?.statements);
  });

  it('gets a coverage-summary.json from Vitest', () => {
    expect(coverage?.reporter).toContain('json-summary');
  });

  it('downloads the artifact that PR checks uploads, into runner.temp, after the run of PR checks', () => {
    const prChecks = readRepoFile('.github/workflows/pr-checks.yml');
    const commentWorkflow = readRepoFile('.github/workflows/pr-coverage-comment.yml');
    const prChecksName = /^name:\s*(.+)$/m.exec(prChecks)?.[1]?.trim();

    expect(prChecks).toMatch(/name: coverage-summary\n\s+path: coverage\/coverage-summary\.json\n/);
    expect(commentWorkflow).toContain(`workflows: ["${prChecksName?.replace(/^"|"$/g, '')}"]`);
    expect(commentWorkflow).toMatch(/name: coverage-summary\n\s+path: \$\{\{ runner\.temp \}\}\/coverage-summary\n/);
    expect(commentWorkflow).toContain('COVERAGE_SUMMARY: ${{ runner.temp }}/coverage-summary/coverage-summary.json');
  });
});
