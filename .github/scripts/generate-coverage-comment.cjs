/**
 * Posts the test coverage of a pull request as one comment on it, and keeps that one comment
 * current on every push.
 *
 * Run by .github/workflows/pr-coverage-comment.yml (a workflow_run job, which runs with the base
 * repository's token) once "🔍 Pull Request Checks" completes. The coverage summary comes from an
 * artifact that the pull request's own code produced, so everything read from it is untrusted:
 * numbers must be finite percentages and counts, file paths are cut down to a safe character set
 * before they reach the Markdown, and no text of the file is echoed into the comment (not even a
 * JSON parse error, which quotes the input).
 * @file
 */

'use strict';

const fs = require('node:fs');

/** First line of the comment this script owns: how it finds the comment again. */
const COMMENT_MARKER = '<!-- pr-coverage-report -->';

/** Only comments this account wrote are ever updated or deleted. */
const BOT_LOGIN = 'github-actions[bot]';

/**
 * Indicator bands, and MINIMUM: the statements floor that vitest.config.ts enforces
 * (coverage.thresholds.statements). __tests__/generate-coverage-comment.test.ts fails when the
 * two differ.
 */
const COVERAGE_THRESHOLDS = Object.freeze({
  EXCELLENT: 80,
  GOOD: 60,
  FAIR: 40,
  MINIMUM: 80
});

const METRICS = Object.freeze(['statements', 'branches', 'functions', 'lines']);
const MAX_FILE_ROWS = 10;
const MAX_PATH_LENGTH = 100;
/** A coverage-summary.json of this repository is a few hundred KB; anything far larger is not one. */
const MAX_SUMMARY_BYTES = 10 * 1024 * 1024;

/** Coverage data that cannot be reported. Its message is always a fixed text of this file. */
class CoverageDataError extends Error {}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** A percentage read from the artifact: a finite number from 0 to 100, else null. */
function readPct(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    return null;
  }
  return value;
}

/** A count read from the artifact: a non-negative safe integer, else null. */
function readCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/**
 * Parses the text of a coverage-summary.json (the `json-summary` reporter of Vitest).
 * @returns {{ total: Record<string, {pct: number, covered: number, total: number}>, files: Array<object> }}
 * @throws {CoverageDataError} when the text is not a summary that can be reported
 */
function parseSummary(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new CoverageDataError('coverage-summary.json is not valid JSON.');
  }
  if (!isPlainObject(data) || !isPlainObject(data.total)) {
    throw new CoverageDataError('coverage-summary.json has no "total" entry.');
  }

  const total = {};
  for (const metric of METRICS) {
    const entry = isPlainObject(data.total[metric]) ? data.total[metric] : {};
    const pct = readPct(entry.pct);
    const covered = readCount(entry.covered);
    const count = readCount(entry.total);
    if (pct === null || covered === null || count === null || covered > count) {
      throw new CoverageDataError(`total.${metric} is not a percentage from 0 to 100 with covered and total counts.`);
    }
    total[metric] = { pct, covered, total: count };
  }

  // A file entry that is not an object, or has no valid line percentage, cannot be ranked: skip it.
  const files = [];
  for (const [file, metrics] of Object.entries(data)) {
    if (file === 'total' || !isPlainObject(metrics)) {
      continue;
    }
    const row = { file };
    for (const metric of METRICS) {
      row[metric] = isPlainObject(metrics[metric]) ? readPct(metrics[metric].pct) : null;
    }
    if (row.lines !== null) {
      files.push(row);
    }
  }

  return { total, files };
}

/**
 * The path of a covered file as the comment shows it, inside a code span of a table cell: relative
 * to the workspace when it starts with it, every character outside letters, digits and
 * `_ . / @ + - ( ) [ ]` and space replaced by `?`, and its start cut to fit MAX_PATH_LENGTH. A
 * backtick would close the code span, a pipe would split the cell and a line break would end the
 * table row, so none of them can come through.
 */
function displayPath(file, workspace) {
  let shown = String(file);
  const root = workspace ? `${String(workspace).replace(/\/+$/, '')}/` : '';
  if (root !== '/' && root !== '' && shown.startsWith(root)) {
    shown = shown.slice(root.length);
  }
  shown = shown.replace(/[^\w./@+()[\] -]/g, '?').trim();
  if (shown.length > MAX_PATH_LENGTH) {
    shown = `…${shown.slice(-(MAX_PATH_LENGTH - 1))}`;
  }
  return shown === '' ? '?' : shown;
}

const formatPct = (pct) => (pct === null ? '–' : `${Math.round(pct * 100) / 100}%`);

/** The band a percentage falls in, from the best: its row indicator and its title. */
const BANDS = Object.freeze([
  { floor: COVERAGE_THRESHOLDS.EXCELLENT, indicator: '🟢', emoji: '🎉', label: 'Excellent' },
  { floor: COVERAGE_THRESHOLDS.GOOD, indicator: '🟡', emoji: '👍', label: 'Good' },
  { floor: COVERAGE_THRESHOLDS.FAIR, indicator: '🟠', emoji: '⚠️', label: 'Fair' },
  { floor: Number.NEGATIVE_INFINITY, indicator: '🔴', emoji: '🚨', label: 'Needs Improvement' }
]);

const bandOf = (pct) => BANDS.find((band) => pct >= band.floor) ?? BANDS[BANDS.length - 1];
const indicator = (pct) => bandOf(pct).indicator;

/** A 20-cell bar; the percentage is clamped to 0–100 so the repeat counts are never negative. */
function formatBar(pct) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const filled = Math.round(clamped / 5);
  return '█'.repeat(filled) + '░'.repeat(20 - filled);
}

/** The first 7 characters of a commit SHA, or `unknown` for anything that is not one. */
function shortSha(sha) {
  return typeof sha === 'string' && /^[0-9a-f]{40}$/.test(sha) ? sha.slice(0, 7) : 'unknown';
}

/** The workflow run's own link from the event payload, kept only when it is a GitHub https URL. */
function runLink(run) {
  const url = typeof run?.html_url === 'string' ? run.html_url : '';
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/.test(url) ? url : null;
}

function footer(run) {
  const url = runLink(run);
  return url ? `<sub>Coverage by Vitest with the v8 provider. [Workflow run](${url})</sub>` : '<sub>Coverage by Vitest with the v8 provider.</sub>';
}

/** The comment for a parsed summary. */
function buildReport({ summary, run, workspace }) {
  const { total, files } = summary;
  const status = bandOf(total.lines.pct);
  const rows = METRICS.map((metric) => {
    const { pct, covered, total: count } = total[metric];
    const name = metric[0].toUpperCase() + metric.slice(1);
    return `| **${name}** | ${indicator(pct)} ${formatPct(pct)} | ${covered} / ${count} | ${formatBar(pct)} |`;
  });

  const meetsFloor = total.statements.pct >= COVERAGE_THRESHOLDS.MINIMUM;
  const threshold = meetsFloor
    ? `✅ Statements at ${formatPct(total.statements.pct)} meet the ${COVERAGE_THRESHOLDS.MINIMUM}% floor of \`vitest.config.ts\`.`
    : `⚠️ Statements at ${formatPct(total.statements.pct)} are below the ${COVERAGE_THRESHOLDS.MINIMUM}% floor of \`vitest.config.ts\`: \`npm run test:coverage\` fails.`;

  const lowest = [...files]
    .sort((a, b) => a.lines - b.lines || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
    .slice(0, MAX_FILE_ROWS);
  let fileTable = '';
  if (lowest.length > 0) {
    const fileRows = lowest.map(
      (row) =>
        `| \`${displayPath(row.file, workspace)}\` | ${indicator(row.lines)} ${formatPct(row.lines)} | ${formatPct(row.statements)} | ${formatPct(row.functions)} | ${formatPct(row.branches)} |`
    );
    fileTable = [
      '<details>',
      `<summary>📁 The ${lowest.length} files with the lowest line coverage</summary>`,
      '',
      '| File | Lines | Statements | Functions | Branches |',
      '|------|-------|------------|-----------|----------|',
      ...fileRows,
      '',
      '</details>',
      ''
    ].join('\n');
  }

  const { EXCELLENT, GOOD, FAIR } = COVERAGE_THRESHOLDS;
  return [
    COMMENT_MARKER,
    `## ${status.emoji} Test Coverage Report: ${status.label}`,
    '',
    `**Line coverage: ${formatPct(total.lines.pct)}** · Commit \`${shortSha(run.head_sha)}\``,
    '',
    '| Metric | Coverage | Covered / Total | |',
    '|--------|----------|-----------------|-|',
    ...rows,
    '',
    threshold,
    '',
    fileTable,
    `**Legend:** 🟢 ≥${EXCELLENT}% · 🟡 ≥${GOOD}% · 🟠 ≥${FAIR}% · 🔴 <${FAIR}%`,
    '',
    footer(run),
    ''
  ].join('\n');
}

/** The comment when there is no summary to report; `reason` is always a fixed text of this file. */
function buildUnavailable({ reason, run }) {
  const conclusion = typeof run?.conclusion === 'string' && /^[a-z_]+$/.test(run.conclusion) ? run.conclusion : 'unknown';
  return [
    COMMENT_MARKER,
    '## ⚠️ Test Coverage Report Unavailable',
    '',
    `No coverage for commit \`${shortSha(run?.head_sha)}\`. ${reason}`,
    '',
    `The PR checks run ended with the conclusion \`${conclusion}\`.`,
    '',
    footer(run),
    ''
  ].join('\n');
}

const NO_SUMMARY =
  'The PR checks produced no coverage summary. Coverage runs on Node 22.x once `npm test` passes, so a failing test, a cancelled run or a failed coverage step leaves none.';

/** The summary file, read with its size checked first; null when it is not there. */
function readSummaryFile(summaryPath) {
  let stats;
  try {
    stats = fs.lstatSync(summaryPath);
  } catch {
    return null;
  }
  if (!stats.isFile()) {
    return null;
  }
  if (stats.size > MAX_SUMMARY_BYTES) {
    throw new CoverageDataError('coverage-summary.json is larger than any coverage summary of this repository.');
  }
  return fs.readFileSync(summaryPath, 'utf8');
}

/**
 * The open pull request whose head is the commit the run tested, or null. Looked up by head branch
 * rather than read from `workflow_run.pull_requests`, which GitHub leaves empty for a pull request
 * from a fork. Matching the head SHA also drops a stale run: once a newer commit is pushed, the run
 * of the older one finds no pull request and leaves the newer report alone.
 */
async function findPullRequest(github, repo, run) {
  const headOwner = run.head_repository?.owner?.login;
  if (typeof headOwner !== 'string' || typeof run.head_branch !== 'string' || typeof run.head_sha !== 'string') {
    return null;
  }
  const pulls = await github.paginate(github.rest.pulls.list, {
    owner: repo.owner,
    repo: repo.repo,
    state: 'open',
    head: `${headOwner}:${run.head_branch}`,
    per_page: 100
  });
  return pulls.find((pull) => pull.head?.sha === run.head_sha) ?? null;
}

/** Updates this script's comment on the pull request, or creates it; deletes any duplicate of it. */
async function upsertComment(github, repo, issueNumber, body, core) {
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner: repo.owner,
    repo: repo.repo,
    issue_number: issueNumber,
    per_page: 100
  });
  const ours = comments.filter(
    (comment) => comment.user?.login === BOT_LOGIN && typeof comment.body === 'string' && comment.body.startsWith(COMMENT_MARKER)
  );

  if (ours.length === 0) {
    const { data } = await github.rest.issues.createComment({ owner: repo.owner, repo: repo.repo, issue_number: issueNumber, body });
    core.info(`Created coverage comment ${data?.id ?? ''} on #${issueNumber}.`);
    return;
  }

  const [kept, ...duplicates] = ours;
  if (kept.body === body) {
    core.info(`Coverage comment ${kept.id} on #${issueNumber} is already current.`);
  } else {
    await github.rest.issues.updateComment({ owner: repo.owner, repo: repo.repo, comment_id: kept.id, body });
    core.info(`Updated coverage comment ${kept.id} on #${issueNumber}.`);
  }
  for (const duplicate of duplicates) {
    try {
      await github.rest.issues.deleteComment({ owner: repo.owner, repo: repo.repo, comment_id: duplicate.id });
      core.info(`Deleted duplicate coverage comment ${duplicate.id}.`);
    } catch (error) {
      core.warning(`Could not delete duplicate coverage comment ${duplicate.id}: ${error.message}`);
    }
  }
}

/**
 * Entry point, called from the github-script step of pr-coverage-comment.yml.
 * @param {object} args
 * @param {object} args.github Octokit client of actions/github-script
 * @param {object} args.context the workflow_run context
 * @param {object} args.core @actions/core, for logging
 * @param {string} args.summaryPath where the coverage-summary artifact was downloaded
 * @param {string} [args.workspace] the workspace path the covered files start with
 * @returns {Promise<number|null>} the pull request commented on, or null when there was none to comment on
 */
async function generateCoverageComment({ github, context, core, summaryPath, workspace }) {
  const run = context.payload.workflow_run;
  if (!run || run.event !== 'pull_request') {
    core.info('The run was not triggered by a pull request: nothing to report.');
    return null;
  }

  const pull = await findPullRequest(github, context.repo, run);
  if (!pull) {
    core.info(`No open pull request has ${shortSha(run.head_sha)} as its head (a newer commit was pushed, or it was closed): nothing to report.`);
    return null;
  }
  if (pull.draft) {
    core.info(`#${pull.number} is a draft, and PR checks run nothing on a draft: nothing to report.`);
    return null;
  }

  let body;
  try {
    const text = readSummaryFile(summaryPath);
    body = text === null ? buildUnavailable({ reason: NO_SUMMARY, run }) : buildReport({ summary: parseSummary(text), run, workspace });
  } catch (error) {
    if (!(error instanceof CoverageDataError)) {
      throw error;
    }
    core.warning(`Coverage summary rejected: ${error.message}`);
    body = buildUnavailable({ reason: `The coverage summary cannot be reported: ${error.message}`, run });
  }

  await upsertComment(github, context.repo, pull.number, body, core);
  return pull.number;
}

module.exports = {
  COMMENT_MARKER,
  COVERAGE_THRESHOLDS,
  CoverageDataError,
  buildReport,
  buildUnavailable,
  displayPath,
  formatBar,
  generateCoverageComment,
  parseSummary
};
