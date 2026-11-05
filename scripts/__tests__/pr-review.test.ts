import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '..', 'pr-review.sh');

const CODEX = { login: 'chatgpt-codex-connector[bot]', type: 'Bot' };
const OWNER = { login: 'spartDev', type: 'User' };

const codexBody = (priority: string, title: string) =>
  `**<sub><sub>![${priority} Badge](https://img.shields.io/badge/${priority}-yellow?style=flat)</sub></sub>  ${title}**\n\nDetails.\n\n<!-- codex-code-review-finding:v1 -->`;

interface Comment {
  id: number;
  user: { login: string; type: string };
  path: string;
  line: number | null;
  original_line: number;
  body: string;
  in_reply_to_id?: number;
}

describe('pr-review.sh', () => {
  let bin: string;

  /** Puts a fake `gh` first on PATH that records its arguments and prints `pages`, as `gh api --paginate --slurp` does. */
  const fakeGh = (pages: Comment[][]) => {
    writeFileSync(path.join(bin, 'pages.json'), JSON.stringify(pages));
    writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" > "${bin}/args"\ncat "${bin}/pages.json"\n`);
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

  it('lists only the bot comments nobody replied to, with id, path, line, priority and title', () => {
    fakeGh([
      [
        { id: 1, user: CODEX, path: 'src/a.ts', line: 12, original_line: 10, body: codexBody('P1', 'Answered finding') },
        { id: 2, user: OWNER, path: 'src/a.ts', line: 12, original_line: 10, body: 'Fixed in abc123.', in_reply_to_id: 1 },
        { id: 3, user: CODEX, path: 'src/b.ts', line: 40, original_line: 40, body: codexBody('P2', 'Open finding') },
      ],
      [{ id: 4, user: OWNER, path: 'src/c.ts', line: 5, original_line: 5, body: 'A note of my own.' }],
    ]);

    const result = run('481');

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('3\tsrc/b.ts:40\tP2\tOpen finding\n');
  });

  it('counts a reply that sits on a later page of the API', () => {
    fakeGh([
      [{ id: 1, user: CODEX, path: 'src/a.ts', line: 12, original_line: 12, body: codexBody('P1', 'Answered finding') }],
      [{ id: 2, user: OWNER, path: 'src/a.ts', line: 12, original_line: 12, body: 'Fixed.', in_reply_to_id: 1 }],
    ]);

    expect(run('481').stdout).toBe('');
  });

  it('falls back to the original line and marks the comment outdated when the code moved', () => {
    fakeGh([[{ id: 7, user: CODEX, path: 'scripts/x.mjs', line: null, original_line: 55, body: codexBody('P2', 'Moved code') }]]);

    expect(run('505').stdout).toBe('7\tscripts/x.mjs:55 (outdated)\tP2\tMoved code\n');
  });

  it('reads the title of a bot comment written as a heading, such as CodeQL', () => {
    const codeql = { login: 'github-advanced-security[bot]', type: 'Bot' };
    fakeGh([[{ id: 9, user: codeql, path: 'src/a.ts', line: 3, original_line: 3, body: '## CodeQL / Unnecessary use of `cat` process\n\nDetails.' }]]);

    expect(run('508').stdout).toBe('9\tsrc/a.ts:3\t-\tCodeQL / Unnecessary use of `cat` process\n');
  });

  it('asks gh for every page of the pull request comments of the current repository', () => {
    fakeGh([[]]);

    run('451');

    expect(readFileSync(path.join(bin, 'args'), 'utf8')).toBe(
      'api --paginate --slurp repos/{owner}/{repo}/pulls/451/comments\n'
    );
  });

  it.each([[], ['abc'], ['12', '13']])('refuses %j with its usage', (...args) => {
    fakeGh([[]]);

    const result = run(...args);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Usage:');
  });
});
