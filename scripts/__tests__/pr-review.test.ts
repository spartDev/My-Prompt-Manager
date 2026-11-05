import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '..', 'pr-review.sh');

const CODEX = { __typename: 'Bot', login: 'chatgpt-codex-connector' };
const OWNER = { __typename: 'User', login: 'spartDev' };

const codexBody = (priority: string, title: string) =>
  `**<sub><sub>![${priority} Badge](https://img.shields.io/badge/${priority}-yellow?style=flat)</sub></sub>  ${title}**\n\nDetails.\n\n<!-- codex-code-review-finding:v1 -->`;

interface Thread {
  id: string;
  isResolved: boolean;
  path: string;
  line: number | null;
  originalLine: number;
  /** The thread's first comment: the finding. */
  first: { databaseId: number; author: { __typename: string; login: string }; body: string };
}

/** One GraphQL response page of `reviewThreads`, as `gh api graphql --paginate --slurp` puts it in its array. */
const page = (threads: Thread[]) => ({
  data: {
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes: threads.map(({ first, ...thread }) => ({ ...thread, comments: { nodes: [first] } })),
        },
      },
    },
  },
});

const thread = (id: number, over: Partial<Thread> = {}): Thread => ({
  id: `PRRT_${id}`,
  isResolved: false,
  path: 'src/a.ts',
  line: 12,
  originalLine: 12,
  first: { databaseId: id, author: CODEX, body: codexBody('P2', `Finding ${id}`) },
  ...over,
});

describe('pr-review.sh', () => {
  let bin: string;

  /** Puts a fake `gh` first on PATH that records its arguments, NUL-separated since the query spans lines, and prints `pages`. */
  const fakeGh = (pages: Thread[][]) => {
    writeFileSync(path.join(bin, 'pages.json'), JSON.stringify(pages.map(page)));
    writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env bash\nprintf '%s\\0' "$@" > "${bin}/args"\ncat "${bin}/pages.json"\n`);
    chmodSync(path.join(bin, 'gh'), 0o755);
  };

  const run = (...args: string[]) =>
    spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  beforeEach(() => {
    bin = mkdtempSync(path.join(tmpdir(), 'pr-review-'));
  });

  afterEach(() => {
    rmSync(bin, { recursive: true, force: true });
  });

  it('lists the unresolved bot threads with comment id, thread id, path, line, priority and title', () => {
    fakeGh([[thread(3, { path: 'src/b.ts', line: 40, first: { databaseId: 3, author: CODEX, body: codexBody('P1', 'Open finding') } })]]);

    const result = run('481');

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('3\tPRRT_3\tsrc/b.ts:40\tP1\tOpen finding\n');
  });

  it('leaves out a resolved thread, even one nobody replied to', () => {
    fakeGh([[thread(1, { isResolved: true }), thread(2)]]);

    expect(run('473').stdout).toBe('2\tPRRT_2\tsrc/a.ts:12\tP2\tFinding 2\n');
  });

  it('keeps a thread that has a reply but is still unresolved, since it still blocks the merge', () => {
    fakeGh([[thread(5)]]);

    expect(run('508').stdout).toBe('5\tPRRT_5\tsrc/a.ts:12\tP2\tFinding 5\n');
  });

  it('leaves out the threads a person started', () => {
    fakeGh([[thread(4, { first: { databaseId: 4, author: OWNER, body: 'A note of my own.' } })]]);

    expect(run('481').stdout).toBe('');
  });

  it('lists the threads of every page', () => {
    fakeGh([[thread(1)], [thread(2)]]);

    expect(run('481').stdout).toBe('1\tPRRT_1\tsrc/a.ts:12\tP2\tFinding 1\n2\tPRRT_2\tsrc/a.ts:12\tP2\tFinding 2\n');
  });

  it('falls back to the original line and marks the thread outdated when the code moved', () => {
    fakeGh([[thread(7, { path: 'scripts/x.mjs', line: null, originalLine: 55 })]]);

    expect(run('505').stdout).toBe('7\tPRRT_7\tscripts/x.mjs:55 (outdated)\tP2\tFinding 7\n');
  });

  it('reads the title of a bot comment written as a heading, such as CodeQL', () => {
    const codeql = { __typename: 'Bot', login: 'github-advanced-security' };
    fakeGh([[thread(9, { first: { databaseId: 9, author: codeql, body: '## CodeQL / Unnecessary use of `cat` process\n\nDetails.' } })]]);

    expect(run('508').stdout).toBe('9\tPRRT_9\tsrc/a.ts:12\t-\tCodeQL / Unnecessary use of `cat` process\n');
  });

  it('asks gh for every page of the review threads of the current repository', () => {
    fakeGh([[]]);

    run('451');

    const args = readFileSync(path.join(bin, 'args'), 'utf8').split('\0');
    expect(args.slice(0, 4)).toEqual(['api', 'graphql', '--paginate', '--slurp']);
    expect(args).toEqual(expect.arrayContaining(['owner={owner}', 'name={repo}', 'number=451']));
    const query = args[args.indexOf('-f') + 1];
    expect(query).toMatch(/^query=/);
    expect(query).toContain('$endCursor');
    expect(query).toContain('pageInfo');
  });

  it.each([[], ['abc'], ['12', '13']])('refuses %j with its usage', (...args) => {
    fakeGh([[]]);

    const result = run(...args);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Usage:');
  });
});
