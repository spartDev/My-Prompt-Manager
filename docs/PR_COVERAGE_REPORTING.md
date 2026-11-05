# Pull Request Coverage Comment

Every pull request gets one comment with its test coverage, and that one comment is updated on each push. It shows the four Vitest metrics, whether statements meet the floor of `vitest.config.ts`, and the 10 files with the lowest line coverage.

## Files

| File | Role |
|------|------|
| `.github/workflows/pr-checks.yml` | The `test` job writes the coverage summary and uploads it as the `coverage-summary` artifact |
| `.github/workflows/pr-coverage-comment.yml` | Runs once PR checks complete, downloads the artifact, runs the script |
| `.github/scripts/generate-coverage-comment.cjs` | Validates the summary, builds the comment, creates or updates it |
| `.github/scripts/__tests__/generate-coverage-comment.test.ts` | Unit tests of the script, and checks that the workflows and `vitest.config.ts` still match it |

## How it runs

1. **PR checks.** On Node 22.x, `npm run test:coverage` writes `coverage/coverage-summary.json` (the `json-summary` reporter of `vitest.config.ts`). The job uploads it as the `coverage-summary` artifact, also when the coverage step failed on a missed threshold: Vitest writes the summary before it checks the thresholds. A failing `npm test` skips the coverage step, so that run has no artifact.
2. **Coverage comment.** `pr-coverage-comment.yml` starts on `workflow_run` when "🔍 Pull Request Checks" completes, whatever its conclusion. It checks out `.github/scripts` of the default branch, downloads the artifact into `runner.temp`, and calls the script.
3. **Script.** It looks for the open pull request whose head is the commit the run tested, by head branch (`owner:branch`) and then head SHA. `workflow_run.pull_requests` is not used: GitHub leaves it empty for a pull request from a fork. Then:
   - No such pull request: a newer commit was pushed (that run reports instead) or the pull request was closed. Nothing is posted.
   - A draft: PR checks run nothing on a draft. Nothing is posted.
   - A valid summary: the coverage report.
   - No summary, or one that fails validation: a "Test Coverage Report Unavailable" notice that says why and gives the conclusion of the PR checks run. It replaces an older report, so the comment never shows the coverage of an earlier commit as the current one.

   The comment starts with the marker `<!-- pr-coverage-report -->`. The script updates the comment by `github-actions[bot]` that starts with it, creates one when there is none, and deletes any duplicate. It never touches another comment.

## What the comment shows

- **Title** by line coverage: 🎉 Excellent (≥80%), 👍 Good (≥60%), ⚠️ Fair (≥40%), 🚨 Needs Improvement.
- **Metrics table**: statements, branches, functions and lines, each with its percentage, covered / total and a 20-cell bar.
- **Threshold**: whether statements meet `coverage.thresholds.statements` of `vitest.config.ts`. Below it, `npm run test:coverage` fails.
- **Files**: the 10 files with the lowest line coverage, lowest first, with paths relative to the repository.

## Security model

`workflow_run` runs the workflow file and the script of the default branch, never code from the pull request, with a token that can write pull request comments (`pull-requests: write`, `actions: read`, `contents: read`, and nothing else). The one input from the pull request is the artifact, and its code wrote it: a pull request, from a fork too, can change `pr-checks.yml` and upload anything as `coverage-summary`. So:

- The artifact is downloaded into `runner.temp`, outside the workspace, so it cannot replace the script or anything a later step loads (CodeQL's artifact poisoning check).
- Checkout keeps no credentials (`persist-credentials: false`) and takes only `.github/scripts`.
- Every percentage must be a finite number from 0 to 100, every count a non-negative integer, and covered at most total. A summary whose `total` fails is reported as unavailable; a file entry that fails is left out of the table.
- A file path keeps letters, digits, space and `_ . / @ + - ( ) [ ]`; every other character becomes `?`. A backtick, a pipe or a line break would end the code span, the cell or the table row, so a crafted path cannot add Markdown to the comment.
- The comment never quotes the artifact: a rejected summary gets a fixed reason (a `JSON.parse` error would quote the input). A summary over 10 MB, or a symlink, is not read.

## Changing it

- **The floor.** Change `coverage.thresholds.statements` in `vitest.config.ts` and `COVERAGE_THRESHOLDS.MINIMUM` in the script together; the unit test fails when they differ.
- **The bands.** `COVERAGE_THRESHOLDS.EXCELLENT`, `GOOD` and `FAIR` in the script.
- **Renaming** the PR checks workflow (its `name:`), the artifact or its path: the unit test checks that both workflows still agree.

## Testing

```bash
npx vitest run .github/scripts
```

`workflow_run` runs the workflow file of the default branch, so a pull request that changes `pr-coverage-comment.yml` or the script does not run its own version: the change shows on the pull requests opened after it merges.

## Troubleshooting

- **No comment.** Open the "📊 Coverage Report Comment" run in the Actions tab: the script logs why it posted nothing (stale run, draft, closed pull request).
- **"Unavailable".** The PR checks run produced no summary: a test failed, the run was cancelled, or the coverage step failed before it wrote the summary. Its conclusion is in the notice, and the link opens the run.
