# Pull Request Coverage Reporting

Automated test coverage reporting for GitHub pull requests with formatted tables and visual indicators.

## Overview

This feature automatically generates and posts detailed test coverage reports as PR comments whenever the PR checks workflow completes successfully. The coverage report includes:

- Overall coverage percentage with status indicators
- Detailed metrics table (statements, branches, functions, lines)
- Visual progress bars for each metric
- Top 10 files needing attention (sorted by lowest coverage first)
- Threshold compliance status

## Files

### Workflow Files

| File | Purpose |
|------|---------|
| `.github/workflows/pr-coverage-comment.yml` | Triggered by workflow_run event, downloads coverage artifacts and posts comment |
| `.github/workflows/pr-checks.yml` | Updated to include coverage-summary.json in artifacts |

### Script Files

| File | Purpose |
|------|---------|
| `.github/scripts/generate-coverage-comment.js` | Generates formatted coverage report from coverage-summary.json |

## How It Works

### 1. PR Checks Workflow

When a PR is opened or updated:

1. The `test` job runs `npm run test:coverage` (Node 22.x only)
2. Vitest generates coverage reports including `coverage-summary.json`
3. The coverage reports are uploaded as artifacts named `coverage-reports`

### 2. Coverage Comment Workflow

After the PR checks workflow completes successfully:

1. The `workflow_run` trigger activates the coverage comment workflow
2. The workflow:
   - Downloads the `coverage-reports` artifact
   - Executes `generate-coverage-comment.js`
   - Finds the associated PR
   - Parses `coverage-summary.json`
   - Generates formatted markdown table
   - Deletes old coverage comments (keeps PR clean)
   - Posts new coverage comment

### 3. Coverage Report Format

The posted comment includes:

```markdown
## 🎉 Test Coverage Report - Excellent

**Overall Coverage: 85.3%** | **Commit:** `abc1234`

### 📊 Coverage Metrics

| Metric | Coverage | Covered / Total | Visual |
|--------|----------|-----------------|--------|
| **Statements** | 🟢 85.3% | 1234 / 1447 | ████████████████████ |
| **Branches** | 🟢 82.1% | 456 / 555 | ████████████████░░░░ |
| **Functions** | 🟢 88.5% | 231 / 261 | █████████████████░░░ |
| **Lines** | 🟢 85.3% | 1198 / 1404 | ████████████████████ |

### 📈 Coverage Threshold

Current threshold: **50% statements** (configured in `vitest.config.ts`)

✅ Meeting threshold requirements

<details>
<summary>📁 Files Needing Attention (Top 10 by Line Coverage)</summary>

| File | Lines | Statements | Functions | Branches |
|------|-------|------------|-----------|----------|
| `src/utils/validation.ts` | 🟠 45.2% | 42.1% | 38.9% | 51.3% |
| ... | ... | ... | ... | ... |

</details>

---

**Legend:** 🟢 ≥80% | 🟡 60-79% | 🟠 40-59% | 🔴 <40%
```

## Coverage Indicators

### Color-Coded Status

| Indicator | Range | Status |
|-----------|-------|--------|
| 🟢 | ≥ 80% | Excellent |
| 🟡 | 60-79% | Good |
| 🟠 | 40-59% | Fair |
| 🔴 | < 40% | Needs Improvement |

### Overall Status

Based on line coverage percentage:

- **🎉 Excellent**: ≥80%
- **👍 Good**: 60-79%
- **⚠️ Fair**: 40-59%
- **🚨 Needs Improvement**: <40%

## Security & Reliability

### Security Model

The coverage reporting workflow uses the `workflow_run` trigger, which provides important security guarantees:

1. **Runs in base repository context**: The workflow executes with the permissions of the base repository, not the fork
2. **No untrusted code execution**: The workflow doesn't execute any code from the PR itself
3. **Separate trusted context**: Runs after PR checks complete in an isolated environment
4. **Minimal permissions**: Only has `contents: read` and `pull-requests: write`

### Reliability Features

1. **Robust PR Detection**: Uses `workflow_run.pull_requests` array for reliable PR identification (works for both forks and same-repo PRs)
2. **JSON Validation**: Comprehensive validation of coverage data structure before processing
3. **Error Handling**: Try-catch blocks with user-friendly error messages
4. **Graceful Degradation**: Posts explanatory comments when coverage data is unavailable
5. **Comment Deduplication**: Automatically deletes old coverage comments to keep PRs clean
6. **Markdown Injection Prevention**: Sanitizes file paths to prevent markdown injection attacks
7. **Bot Verification**: Only deletes comments from `github-actions[bot]`, not other bots

### Configuration Constants

All threshold values are centralized in `generate-coverage-comment.js`:

```javascript
const COVERAGE_THRESHOLDS = {
  EXCELLENT: 80,  // 🟢 Green indicator
  GOOD: 60,       // 🟡 Yellow indicator
  FAIR: 40,       // 🟠 Orange indicator
  MINIMUM: 50     // From vitest.config.ts
};
```

## Configuration

### Vitest Coverage Config

Located in `vitest.config.ts`:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  thresholds: {
    statements: 50
  },
  exclude: [
    'node_modules/',
    'src/test/',
    '**/*.d.ts',
    'dist/',
    // ... other exclusions
  ]
}
```

### Workflow Permissions

The coverage comment workflow requires:

```yaml
permissions:
  contents: read        # To checkout repository
  pull-requests: write  # To post/delete PR comments
```

## Testing

To test the coverage reporting locally:

```bash
# Generate coverage report
npm run test:coverage

# Check that coverage-summary.json was created
ls -la coverage/coverage-summary.json

# View the JSON structure
cat coverage/coverage-summary.json | jq '.'
```

## Code Review & Quality Assurance

This implementation has been reviewed by a specialized code review agent and includes the following security and reliability improvements:

### Security Enhancements

| Enhancement | Purpose |
|------------|---------|
| **Reliable PR Detection** | Uses `workflow_run.pull_requests` array instead of branch-based lookup (prevents fork PR detection failures) |
| **Markdown Sanitization** | Escapes special characters in file paths to prevent markdown injection |
| **Exact Bot Verification** | Filters by `github-actions[bot]` username instead of generic "Bot" type |
| **JSON Validation** | Comprehensive structure validation before processing coverage data |
| **SHA-Pinned Actions** | All actions use SHA-pinned versions to prevent supply chain attacks |

### Reliability Improvements

| Enhancement | Purpose |
|------------|---------|
| **Error Handling** | Try-catch blocks around JSON parsing with detailed error messages |
| **User Feedback** | Posts explanatory comments when coverage data is unavailable |
| **Graceful Degradation** | Continues with meaningful messages instead of silent failures |
| **Centralized Constants** | Threshold values defined in one place for easier maintenance |
| **Input Validation** | Validates all coverage metrics exist and are numbers before use |

### Code Quality Score: 7/10

**Strengths:**
- Proper security isolation with `workflow_run` trigger
- SHA-pinned action versions
- Comprehensive error handling
- Excellent documentation

**Addressed Issues:**
- ✅ Fixed PR detection for fork PRs
- ✅ Added JSON validation
- ✅ Improved comment deletion filter
- ✅ Added markdown injection prevention
- ✅ Centralized threshold constants

## Troubleshooting

### Comment Not Posted

**Possible causes:**

1. **Workflow didn't run**: Check that PR checks workflow completed successfully
2. **No coverage artifact**: Ensure `test` job ran on Node 22.x
3. **Permission denied**: Verify workflow has `pull-requests: write` permission
4. **Wrong branch**: Workflow only runs for PRs against `main` branch
5. **Invalid coverage data**: Check workflow logs for JSON parsing errors

**Debug steps:**

```bash
# Check workflow runs
gh run list --workflow=pr-coverage-comment.yml

# View workflow logs
gh run view <run-id> --log
```

### Coverage Data Missing

**Possible causes:**

1. **Test job skipped**: Matrix only runs coverage on Node 22.x
2. **Coverage not generated**: Vitest coverage config issue
3. **Artifact upload failed**: Check `test` job logs

**Debug steps:**

```bash
# Download artifacts manually
gh run download <run-id> --name coverage-reports

# Verify coverage-summary.json exists
ls -la coverage-summary.json
```

### Duplicate Comments

The workflow automatically deletes old coverage comments before posting new ones. If you see duplicates:

1. Check that the bot user type detection is correct
2. Verify the comment body includes "Test Coverage Report"

## Maintenance

### Updating Coverage Thresholds

Edit `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    statements: 70,  // Increase from 50
    branches: 65,
    functions: 75,
    lines: 70
  }
}
```

### Customizing Comment Format

Edit `.github/scripts/generate-coverage-comment.js`:

- Modify `formatCoverage()` to change indicator thresholds
- Edit `formatBar()` to adjust visual bar appearance
- Update `coverageComment` template for different layout

### Changing File Count

Currently shows top 10 files needing attention. To change:

```javascript
.slice(0, 10);  // Change to desired number
```

## Best Practices

1. **Keep comments clean**: Workflow automatically deletes old comments
2. **Focus on trends**: Monitor coverage changes over time
3. **Address red flags**: Prioritize files with 🔴 indicators
4. **Set realistic thresholds**: Balance coverage goals with development velocity
5. **Exclude generated code**: Ensure coverage config excludes build artifacts

## References

- [Vitest Coverage Documentation](https://vitest.dev/guide/coverage.html)
- [GitHub Actions workflow_run Trigger](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_run)
- [actions/github-script](https://github.com/actions/github-script)
- [actions/download-artifact](https://github.com/actions/download-artifact)
