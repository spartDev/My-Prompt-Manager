/**
 * Generate a formatted coverage comment for pull requests
 * This script is called by the coverage-comment workflow
 * @file
 */

/* global require, module, console */

const fs = require('fs');

// Coverage threshold constants - sync with vitest.config.ts
const COVERAGE_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  FAIR: 40,
  MINIMUM: 50 // From vitest.config.ts
};

async function generateCoverageComment(github, context) {
  // RELIABILITY: Use workflow_run.pull_requests array (most reliable for forks)
  // This works for both fork PRs and same-repo PRs
  const prNumber = context.payload.workflow_run.pull_requests?.[0]?.number;

  if (!prNumber) {
    console.error('No PR number found in workflow_run event');
    console.error('This workflow should only run for pull_request events');
    return null;
  }

  console.log(`Found PR #${prNumber}`);

  // Check if coverage file exists
  const coveragePath = 'coverage-summary.json';
  if (!fs.existsSync(coveragePath)) {
    console.error('Coverage summary file not found - artifact may not have been downloaded');
    console.error('Check that the coverage-reports artifact was uploaded in pr-checks.yml');

    // Post explanatory comment for better user experience
    try {
      await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber,
        body: '⚠️ **Coverage Report Unavailable**\n\nThe coverage artifact could not be found. This may happen if:\n- Tests did not run on Node 22.x\n- Coverage generation failed\n- Artifact download timed out\n\nCheck the [workflow logs](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.payload.workflow_run.id}) for details.'
      });
    } catch (error) {
      console.error(`Failed to post missing coverage comment: ${error.message}`);
    }
    return null;
  }

  // DATA VALIDATION: Parse and validate coverage data structure
  let coverageData;
  try {
    coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));

    // Validate expected structure
    if (coverageData?.total?.lines?.pct === undefined ||
        coverageData?.total?.lines?.pct === null ||
        typeof coverageData.total.lines.pct !== 'number') {
      throw new Error('Invalid coverage data structure: missing total.lines.pct');
    }

    // Validate all required metrics exist
    const requiredMetrics = ['statements', 'branches', 'functions', 'lines'];
    for (const metric of requiredMetrics) {
      if (coverageData.total[metric] === undefined ||
          coverageData.total[metric] === null ||
          coverageData.total[metric].pct === undefined ||
          coverageData.total[metric].pct === null ||
          typeof coverageData.total[metric].pct !== 'number') {
        throw new Error(`Invalid coverage data: missing total.${metric}.pct`);
      }
    }
  } catch (error) {
    console.error(`Failed to parse coverage data: ${error.message}`);

    // Post error comment
    try {
      await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber,
        body: `⚠️ **Coverage Report Error**\n\nFailed to parse coverage data: ${error.message}\n\nThis may indicate a problem with the coverage generation or file format.`
      });
    } catch (commentError) {
      console.error(`Failed to post error comment: ${commentError.message}`);
    }
    return null;
  }

  const total = coverageData.total;

  // Helper function to format percentage with color indicator
  const formatCoverage = (metric) => {
    const pct = metric.pct;
    let indicator;
    if (pct >= COVERAGE_THRESHOLDS.EXCELLENT) indicator = '🟢';
    else if (pct >= COVERAGE_THRESHOLDS.GOOD) indicator = '🟡';
    else if (pct >= COVERAGE_THRESHOLDS.FAIR) indicator = '🟠';
    else indicator = '🔴';

    return `${indicator} ${pct}%`;
  };

  // Helper function to sanitize strings for markdown to prevent injection
  const sanitizeForMarkdown = (str) => {
    // Escape backticks, pipes, and backslashes
    return str.replace(/[`|\\]/g, (char) => `\\${char}`);
  };

  // Helper function to format coverage bar
  const formatBar = (pct) => {
    const filled = Math.round(pct / 5);
    const empty = 20 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  };

  // Calculate overall status
  const overallPct = total.lines.pct;
  let overallStatus, overallEmoji;
  if (overallPct >= COVERAGE_THRESHOLDS.EXCELLENT) {
    overallStatus = 'Excellent';
    overallEmoji = '🎉';
  } else if (overallPct >= COVERAGE_THRESHOLDS.GOOD) {
    overallStatus = 'Good';
    overallEmoji = '👍';
  } else if (overallPct >= COVERAGE_THRESHOLDS.FAIR) {
    overallStatus = 'Fair';
    overallEmoji = '⚠️';
  } else {
    overallStatus = 'Needs Improvement';
    overallEmoji = '🚨';
  }

  // Build file-level coverage table
  let fileTable = '';
  const files = Object.entries(coverageData)
    .filter(([key]) => key !== 'total')
    .map(([file, metrics]) => ({
      file: file.replace(/^.*\/src\//, 'src/'),
      lines: metrics.lines.pct,
      statements: metrics.statements.pct,
      functions: metrics.functions.pct,
      branches: metrics.branches.pct
    }))
    .sort((a, b) => a.lines - b.lines)
    .slice(0, 10);

  if (files.length > 0) {
    fileTable = '\n\n<details>\n<summary>📁 Files Needing Attention (Top 10 by Line Coverage)</summary>\n\n';
    fileTable += '| File | Lines | Statements | Functions | Branches |\n';
    fileTable += '|------|-------|------------|-----------|----------|\n';

    for (const file of files) {
      const indicator = file.lines >= COVERAGE_THRESHOLDS.EXCELLENT ? '🟢' :
                        file.lines >= COVERAGE_THRESHOLDS.GOOD ? '🟡' :
                        file.lines >= COVERAGE_THRESHOLDS.FAIR ? '🟠' : '🔴';
      // SECURITY: Sanitize file paths to prevent markdown injection
      fileTable += `| \`${sanitizeForMarkdown(file.file)}\` | ${indicator} ${file.lines}% | ${file.statements}% | ${file.functions}% | ${file.branches}% |\n`;
    }

    fileTable += '\n</details>';
  }

  // Build coverage comment
  const coverageComment = `## ${overallEmoji} Test Coverage Report - ${overallStatus}

**Overall Coverage: ${overallPct}%** | **Commit:** \`${context.payload.workflow_run.head_sha.substring(0, 7)}\`

### 📊 Coverage Metrics

| Metric | Coverage | Covered / Total | Visual |
|--------|----------|-----------------|--------|
| **Statements** | ${formatCoverage(total.statements)} | ${total.statements.covered} / ${total.statements.total} | ${formatBar(total.statements.pct)} |
| **Branches** | ${formatCoverage(total.branches)} | ${total.branches.covered} / ${total.branches.total} | ${formatBar(total.branches.pct)} |
| **Functions** | ${formatCoverage(total.functions)} | ${total.functions.covered} / ${total.functions.total} | ${formatBar(total.functions.pct)} |
| **Lines** | ${formatCoverage(total.lines)} | ${total.lines.covered} / ${total.lines.total} | ${formatBar(total.lines.pct)} |

### 📈 Coverage Threshold

Current threshold: **${COVERAGE_THRESHOLDS.MINIMUM}% statements** (configured in \`vitest.config.ts\`)

${overallPct >= COVERAGE_THRESHOLDS.MINIMUM ? '✅ Meeting threshold requirements' : '⚠️ Below threshold - consider increasing coverage'}

${fileTable}

---

**Legend:** 🟢 ≥${COVERAGE_THRESHOLDS.EXCELLENT}% | 🟡 ${COVERAGE_THRESHOLDS.GOOD}-${COVERAGE_THRESHOLDS.EXCELLENT - 1}% | 🟠 ${COVERAGE_THRESHOLDS.FAIR}-${COVERAGE_THRESHOLDS.GOOD - 1}% | 🔴 <${COVERAGE_THRESHOLDS.FAIR}%

<sub>💡 Coverage reports are generated by Vitest with v8 provider. [View detailed report](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.payload.workflow_run.id})</sub>
`;

  // Find and delete previous coverage comments
  const commentsResponse = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber
  });
  const comments = commentsResponse.data;

  // SECURITY: Filter by exact bot username to avoid deleting comments from other bots
  const coverageComments = comments.filter(comment =>
    comment.user.login === 'github-actions[bot]' &&
    comment.body.startsWith('## ') &&
    comment.body.includes('Test Coverage Report')
  );

  // Delete old coverage comments
  for (const comment of coverageComments) {
    try {
      await github.rest.issues.deleteComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: comment.id
      });
      console.log(`Deleted old coverage comment ${comment.id}`);
    } catch (error) {
      console.log(`Could not delete comment ${comment.id}: ${error.message}`);
    }
  }

  // Post the new coverage comment
  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
    body: coverageComment
  });

  console.log(`Posted coverage comment to PR #${prNumber}`);
  return prNumber;
}

module.exports = { generateCoverageComment };
