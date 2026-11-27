import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '..', 'pr-review.sh');

const CODEX = { __typename: 'Bot', login: 'chatgpt-codex-connector' };
const CODERABBIT = { __typename: 'Bot', login: 'coderabbitai' };
const CODEQL = { __typename: 'Bot', login: 'github-advanced-security' };
const OWNER = { __typename: 'User', login: 'spartDev' };

const codexBody = (priority: string, title: string) =>
  `**<sub><sub>![${priority} Badge](https://img.shields.io/badge/${priority}-yellow?style=flat)</sub></sub>  ${title}**\n\nDetails.\n\n<!-- codex-code-review-finding:v1 -->`;

const CODERABBIT_ICON =
  '<picture><img src="https://storage.googleapis.com/coderabbit_public_assets/review-comment-icons-v1/amber-16.svg" width="16" height="16" align="absmiddle" alt=""></picture>';

/** A CodeRabbit finding as it posts one: the badge line, `before` (what some findings put ahead of the title), the title, the text, then the folded prompt for agents. */
const coderabbitBody = (
  severity: string,
  title: string,
  { badges = `**${CODERABBIT_ICON} ${severity}** · **Functional Correctness** · **Quick win**`, before = [] as string[] } = {}
) =>
  [
    '<!-- coderabbit-ai-generated:v1 -->',
    '',
    badges,
    '',
    ...before,
    `**${title}**`,
    '',
    'If the field is empty, the check passes. Reject it.',
    '',
    '<!-- ai-agent-prompt:start -->',
    '',
    '<details>',
    '<summary>Prompt for AI Agents</summary>',
    '',
    '```',
    '**A bold line in the prompt.**',
    '```',
    '',
    '</details>',
    '',
    '<!-- ai-agent-prompt:end -->',
    '',
    '<!-- This is an auto-generated reply by CodeRabbit -->',
  ].join('\n');

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

  /**
   * Puts a fake `gh` first on PATH. Each call records its arguments in `call-<n>`, NUL-separated since a query
   * spans lines, then answers from the response file its endpoint names: `pages` for the review threads,
   * `resolve` for the mutation, `comment` for a review comment, `reply` for a new reply. Like gh, it applies
   * the call's `--jq` to the response and prints strings raw.
   */
  const fakeGh = (responses: { pages?: Thread[][]; comment?: object; reply?: object; resolve?: object }) => {
    const { pages = [[]], ...others } = responses;
    writeFileSync(path.join(bin, 'pages.json'), JSON.stringify(pages.map(page)));
    for (const [name, response] of Object.entries(others)) {
      writeFileSync(path.join(bin, `${name}.json`), JSON.stringify(response));
    }
    writeFileSync(
      path.join(bin, 'gh'),
      `#!/usr/bin/env bash
bin="${bin}"
n=$(find "$bin" -name 'call-*' | wc -l | tr -d ' ')
printf '%s\\0' "$@" > "$bin/call-$n"
response=pages
for arg; do case $arg in query=*mutation*) response=resolve ;; esac; done
case $2 in */replies) response=reply ;; repos/*) response=comment ;; esac
filter= prev=
for arg; do [ "$prev" = --jq ] && filter=$arg; prev=$arg; done
if [ -n "$filter" ]; then jq -r "$filter" "$bin/$response.json"; else cat "$bin/$response.json"; fi
`
    );
    chmodSync(path.join(bin, 'gh'), 0o755);
  };

  /** The arguments of each call the script made to gh, in order. */
  const calls = () =>
    readdirSync(bin)
      .filter((name) => name.startsWith('call-'))
      .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
      .map((name) => readFileSync(path.join(bin, name), 'utf8').split('\0').slice(0, -1));

  const run = (args: string[], input?: string) =>
    spawnSync('bash', [SCRIPT, ...args], {
      encoding: 'utf8',
      input,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    });

  beforeEach(() => {
    bin = mkdtempSync(path.join(tmpdir(), 'pr-review-'));
  });

  afterEach(() => {
    rmSync(bin, { recursive: true, force: true });
  });

  describe('listing', () => {
    it('lists the unresolved bot threads with comment id, thread id, bot, path, line, priority and title', () => {
      fakeGh({ pages: [[thread(3, { path: 'src/b.ts', line: 40, first: { databaseId: 3, author: CODEX, body: codexBody('P1', 'Open finding') } })]] });

      const result = run(['481']);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('3\tPRRT_3\tchatgpt-codex-connector\tsrc/b.ts:40\tP1\tOpen finding\n');
    });

    it('keeps the threads Codex, CodeRabbit and CodeQL started and leaves out the one a person started', () => {
      fakeGh({
        pages: [
          [
            thread(1),
            thread(2, { first: { databaseId: 2, author: CODERABBIT, body: coderabbitBody('Major', 'Reject an empty field.') } }),
            thread(3, { first: { databaseId: 3, author: CODEQL, body: '## CodeQL / Incomplete URL substring sanitization\n\nDetails.' } }),
            thread(4, { first: { databaseId: 4, author: OWNER, body: 'A note of my own.' } }),
          ],
        ],
      });

      expect(run(['606']).stdout).toBe(
        [
          '1\tPRRT_1\tchatgpt-codex-connector\tsrc/a.ts:12\tP2\tFinding 1',
          '2\tPRRT_2\tcoderabbitai\tsrc/a.ts:12\tMajor\tReject an empty field.',
          '3\tPRRT_3\tgithub-advanced-security\tsrc/a.ts:12\t-\tCodeQL / Incomplete URL substring sanitization',
          '',
        ].join('\n')
      );
    });

    it('reads the severity and the title of a CodeRabbit finding past its comments and its folded analysis', () => {
      const analysis = [
        '<details>',
        '<summary>Supported by static analysis</summary>',
        '<details>',
        '<summary>Script executed:</summary>',
        '**A bold line in a nested block.**',
        '</details>',
        '**A bold line in the outer block.**',
        '</details>',
        '',
      ];
      fakeGh({ pages: [[thread(5, { first: { databaseId: 5, author: CODERABBIT, body: coderabbitBody('Minor', 'Compare the normalized text.', { before: analysis }) } })]] });

      expect(run(['547']).stdout).toBe('5\tPRRT_5\tcoderabbitai\tsrc/a.ts:12\tMinor\tCompare the normalized text.\n');
    });

    it('reads the title of a CodeRabbit security finding, not its category', () => {
      const security = [
        '<!-- cr-reachability -->',
        '',
        '**Sensitive Data Exposure**',
        '',
        '**Reachability:** External  ',
        '**Exploitability:** Moderate  ',
        '**CWE:** [CWE-538](https://cwe.mitre.org/data/definitions/538.html)',
        '',
        '[View Security blast radius](https://app.coderabbit.ai/blast-radius)',
        '',
      ];
      const badges = `**${CODERABBIT_ICON} Major** · **Security & Privacy** · **${CODERABBIT_ICON} Detected with Advanced Tier** · **Quick win**`;
      fakeGh({
        pages: [[thread(6, { first: { databaseId: 6, author: CODERABBIT, body: coderabbitBody('Major', 'Redact the URL before printing it.', { badges, before: security }) } })]],
      });

      expect(run(['571']).stdout).toBe('6\tPRRT_6\tcoderabbitai\tsrc/a.ts:12\tMajor\tRedact the URL before printing it.\n');
    });

    it('reads a title that names <details> in backticks as a title, not as a folded block', () => {
      fakeGh({
        pages: [
          [
            thread(1, { first: { databaseId: 1, author: CODEX, body: codexBody('P2', 'Keep the `<details>` disclosure open on Enter') } }),
            thread(2, { first: { databaseId: 2, author: CODERABBIT, body: coderabbitBody('Minor', 'Close the `<details >` block before its summary.') } }),
            thread(3),
          ],
        ],
      });

      expect(run(['612']).stdout).toBe(
        [
          '1\tPRRT_1\tchatgpt-codex-connector\tsrc/a.ts:12\tP2\tKeep the `` disclosure open on Enter',
          '2\tPRRT_2\tcoderabbitai\tsrc/a.ts:12\tMinor\tClose the `` block before its summary.',
          '3\tPRRT_3\tchatgpt-codex-connector\tsrc/a.ts:12\tP2\tFinding 3',
          '',
        ].join('\n')
      );
    });

    it('reads a title that names a raw <details> tag mid-line, since a block opens only at the start of a line', () => {
      fakeGh({ pages: [[thread(9, { first: { databaseId: 9, author: CODEX, body: codexBody('P2', 'Close the <details> element on Escape') } })]] });

      expect(run(['612']).stdout).toBe('9\tPRRT_9\tchatgpt-codex-connector\tsrc/a.ts:12\tP2\tClose the  element on Escape\n');
    });

    it('shows the lines after a folded block that closes one tag too many', () => {
      const analysis = ['<details>', '<summary>Supported by static analysis</summary>', '**A bold line in the folded block.**', '</details></details>', ''];
      fakeGh({ pages: [[thread(10, { first: { databaseId: 10, author: CODERABBIT, body: coderabbitBody('Minor', 'Keep the depth at zero.', { before: analysis }) } })]] });

      expect(run(['547']).stdout).toBe('10\tPRRT_10\tcoderabbitai\tsrc/a.ts:12\tMinor\tKeep the depth at zero.\n');
    });

    it('keeps a folded block folded past a `</details>` named in backticks inside it', () => {
      const analysis = [
        '<details>',
        '<summary>Supported by static analysis</summary>',
        'The summary sits before `</details>` here.',
        '**A bold line in the folded block.**',
        '</details>',
        '',
      ];
      fakeGh({ pages: [[thread(8, { first: { databaseId: 8, author: CODERABBIT, body: coderabbitBody('Minor', 'Fold the analysis.', { before: analysis }) } })]] });

      expect(run(['547']).stdout).toBe('8\tPRRT_8\tcoderabbitai\tsrc/a.ts:12\tMinor\tFold the analysis.\n');
    });

    it('leaves out a resolved thread, even one nobody replied to', () => {
      fakeGh({ pages: [[thread(1, { isResolved: true }), thread(2)]] });

      expect(run(['473']).stdout).toBe('2\tPRRT_2\tchatgpt-codex-connector\tsrc/a.ts:12\tP2\tFinding 2\n');
    });

    it('keeps a thread that has a reply but is still unresolved, since it still blocks the merge', () => {
      fakeGh({ pages: [[thread(5)]] });

      expect(run(['508']).stdout).toBe('5\tPRRT_5\tchatgpt-codex-connector\tsrc/a.ts:12\tP2\tFinding 5\n');
    });

    it('lists the threads of every page', () => {
      fakeGh({ pages: [[thread(1)], [thread(2)]] });

      expect(run(['481']).stdout).toBe(
        '1\tPRRT_1\tchatgpt-codex-connector\tsrc/a.ts:12\tP2\tFinding 1\n2\tPRRT_2\tchatgpt-codex-connector\tsrc/a.ts:12\tP2\tFinding 2\n'
      );
    });

    it('falls back to the original line and marks the thread outdated when the code moved', () => {
      fakeGh({ pages: [[thread(7, { path: 'scripts/x.mjs', line: null, originalLine: 55 })]] });

      expect(run(['505']).stdout).toBe('7\tPRRT_7\tchatgpt-codex-connector\tscripts/x.mjs:55 (outdated)\tP2\tFinding 7\n');
    });

    it('asks gh for every page of the review threads of the current repository', () => {
      fakeGh({});

      run(['451']);

      const [args] = calls();
      expect(args.slice(0, 4)).toEqual(['api', 'graphql', '--paginate', '--slurp']);
      expect(args).toEqual(expect.arrayContaining(['owner={owner}', 'name={repo}', 'number=451']));
      const query = args[args.indexOf('-f') + 1];
      expect(query).toMatch(/^query=/);
      expect(query).toContain('$endCursor');
      expect(query).toContain('pageInfo');
    });
  });

  describe('reply', () => {
    const REPLY_LINK = 'https://github.com/o/r/pull/606#discussion_r900';

    it('replies in the thread of the comment, on its pull request, and prints the reply link', () => {
      fakeGh({ comment: { id: 4621007600, pull_request_url: 'https://api.github.com/repos/o/r/pulls/606' }, reply: { html_url: REPLY_LINK } });

      const result = run(['reply', '4621007600', 'Fixed in abc1234.']);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`${REPLY_LINK}\n`);
      const [lookup, post] = calls();
      expect(lookup.slice(0, 2)).toEqual(['api', 'repos/{owner}/{repo}/pulls/comments/4621007600']);
      expect(post.slice(0, 2)).toEqual(['api', 'repos/{owner}/{repo}/pulls/606/comments/4621007600/replies']);
      expect(post).toEqual(expect.arrayContaining(['-f', 'body=Fixed in abc1234.']));
    });

    it('answers in the thread when given the id of a reply, since GitHub takes only the first comment', () => {
      fakeGh({ comment: { id: 901, in_reply_to_id: 4621007600, pull_request_url: 'https://api.github.com/repos/o/r/pulls/606' }, reply: { html_url: REPLY_LINK } });

      run(['reply', '901', 'Done.']);

      expect(calls()[1][1]).toBe('repos/{owner}/{repo}/pulls/606/comments/4621007600/replies');
    });

    it('reads the body from stdin when it is -, quotes and lines kept', () => {
      fakeGh({ comment: { id: 7, pull_request_url: 'https://api.github.com/repos/o/r/pulls/606' }, reply: { html_url: REPLY_LINK } });
      const body = "Not reproduced: `npm test` passes.\n\nThe field isn't empty there.";

      run(['reply', '7', '-'], body);

      expect(calls()[1]).toEqual(expect.arrayContaining([`body=${body}`]));
    });
  });

  describe('resolve', () => {
    it('resolves the thread and prints the link of its first comment', () => {
      const link = 'https://github.com/o/r/pull/606#discussion_r4621007600';
      fakeGh({ resolve: { data: { resolveReviewThread: { thread: { isResolved: true, comments: { nodes: [{ url: link }] } } } } } });

      const result = run(['resolve', 'PRRT_kwDOPU-UM865NM1r']);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`${link}\n`);
      const [args] = calls();
      expect(args.slice(0, 2)).toEqual(['api', 'graphql']);
      expect(args).toEqual(expect.arrayContaining(['thread=PRRT_kwDOPU-UM865NM1r']));
      expect(args.find((arg) => arg.startsWith('query='))).toContain('resolveReviewThread(input: {threadId: $thread})');
    });

    it('fails when GitHub answers that the thread is still unresolved', () => {
      fakeGh({ resolve: { data: { resolveReviewThread: { thread: { isResolved: false, comments: { nodes: [{ url: 'x' }] } } } } } });

      const result = run(['resolve', 'PRRT_1']);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('PRRT_1 is still unresolved');
    });
  });

  it.each([
    { refused: 'no argument', args: [] },
    { refused: 'a PR that is not a number', args: ['abc'] },
    { refused: 'two PR numbers', args: ['12', '13'] },
    { refused: 'a reply to an id that is not a number', args: ['reply', 'abc', 'body'] },
    { refused: 'a reply without a body', args: ['reply', '12'] },
    { refused: 'a reply with an empty body', args: ['reply', '12', ''] },
    { refused: 'a resolve without a thread id', args: ['resolve'] },
    { refused: 'a resolve given a comment id', args: ['resolve', '4621007600'] },
  ])('refuses $refused with its usage', ({ args }) => {
    fakeGh({});

    const result = run(args);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Usage:');
    expect(calls()).toEqual([]);
  });

  it('refuses an empty body read from stdin', () => {
    fakeGh({});

    const result = run(['reply', '12', '-'], '');

    expect(result.status).toBe(2);
    expect(calls()).toEqual([]);
  });
});
