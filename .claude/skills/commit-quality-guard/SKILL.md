---
name: Commit Quality Guard
description: Enforce mandatory quality checks before any git commit operation including tests, linting, secret detection, and branch protection
---

# Commit Quality Guard

Automated enforcement of quality gates before git commit operations. This skill ensures that all code changes meet the project's quality standards before being committed to version control.

## Purpose

Prevent bad commits from reaching the repository by enforcing mandatory checks:
- Test suite execution (1211+ tests must pass)
- Code quality linting (zero ESLint errors)
- Secret detection (prevent credential leaks)
- Branch protection (warn on protected branches)
- Merge conflict detection

## When to Use This Skill

This skill should be invoked:
- ✅ **ALWAYS** before any `git commit` operation
- ✅ Automatically by the `/commit` command
- ✅ In pre-commit hooks (Husky)
- ✅ Before any automated commit operations
- ✅ In CI/CD pipelines as validation

**Trigger phrases:**
- "I'm ready to commit"
- "Create a commit"
- "Let me commit these changes"
- Before invoking `/commit` command

## Critical Requirement

From `CLAUDE.md`:

> **CRITICAL**: After EVERY code change, you MUST run:
> 1. `npm test` - Ensure all tests pass
> 2. `npm run lint` - Verify code quality
>
> Never proceed without both passing. No exceptions for "small changes".

This skill enforces this requirement automatically.

## Quality Gate Checks

### Check 1: Git Status Validation

**Purpose**: Ensure repository is in a committable state

**Actions:**
1. Run `git status --porcelain`
2. Check for:
   - Staged changes exist
   - No unresolved merge conflicts
   - No rebase in progress
3. If no changes staged:
   - Show available changes
   - Suggest: `git add <files>`
   - STOP and wait for user to stage files

**Success Criteria:**
- At least one file staged for commit
- No merge conflicts present
- No rebase/cherry-pick in progress

---

### Check 2: Branch Protection

**Purpose**: Prevent accidental commits to protected branches

**Actions:**
1. Get current branch: `git rev-parse --abbrev-ref HEAD`
2. Check if branch is protected:
   - `main`
   - `master`
   - `develop`
   - Any branch matching `release/*` or `hotfix/*`

**If protected branch detected:**
```
⚠️  WARNING: You are on a protected branch: main

Protected branches should not receive direct commits.
Consider creating a feature branch:
  git checkout -b feat/your-feature-name

Do you want to proceed anyway? (yes/no)
```

**Success Criteria:**
- User is on a feature branch, OR
- User explicitly confirms commit to protected branch

---

### Check 3: Test Suite Execution (MANDATORY)

**Purpose**: Ensure all tests pass before committing

**Actions:**
1. Run full test suite:
   ```bash
   npm test
   ```
2. Parse output for:
   - Total tests passed/failed
   - Coverage threshold met (50%)
   - No test timeouts or errors

**Expected Output:**
```
✓ 1211 tests passed
  Test Files  57 passed (57)
  Tests  1211 passed (1211)
  Coverage  55% (exceeds 50% threshold)
  Duration  12.5s
```

**If tests fail:**
```
❌ TEST FAILURE - Cannot proceed with commit

Failed Tests:
  - PromptCard.test.tsx (3 failures)
  - AddPromptForm.test.tsx (1 failure)

You MUST fix failing tests before committing.

Actions:
1. Fix the failing tests
2. Re-run: npm test
3. Try commit again after all tests pass
```

**STOP IMMEDIATELY** if any tests fail. No exceptions.

**Success Criteria:**
- All tests pass (100%)
- Coverage threshold met (≥50%)
- No test errors or timeouts

---

### Check 4: Code Quality Linting (MANDATORY)

**Purpose**: Ensure code meets quality standards

**Actions:**
1. Run ESLint:
   ```bash
   npm run lint
   ```
2. Parse output for errors and warnings

**Expected Output:**
```
✔ No ESLint warnings or errors found
```

**If linting fails:**
```
❌ LINTING FAILURE - Cannot proceed with commit

ESLint Issues Found:
  ✖ 5 problems (3 errors, 2 warnings)

Attempting auto-fix...
  npm run lint:fix
```

**Auto-fix Workflow:**
1. Run `npm run lint:fix`
2. Re-run `npm run lint` to verify
3. If still failing:
   ```
   ⚠️  Auto-fix could not resolve all issues.

   Remaining Issues:
   - src/components/Example.tsx:45 - Unexpected any type
   - src/utils/helper.ts:12 - Missing return type

   Please fix these manually and try again.
   ```

**Success Criteria:**
- Zero ESLint errors
- Zero ESLint warnings
- All files comply with style guide

---

### Check 5: Secret Detection (CRITICAL)

**Purpose**: Prevent accidental credential commits (40% higher leak rate with AI tools)

**Actions:**
1. Get staged changes:
   ```bash
   git diff --cached
   ```
2. Scan for common secret patterns:
   - API keys: `API_KEY`, `APIKEY`
   - Tokens: `TOKEN`, `BEARER`, `JWT`
   - Passwords: `PASSWORD`, `PASSWD`, `PWD`
   - Secrets: `SECRET`, `PRIVATE_KEY`
   - AWS: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
   - Database: `DB_PASSWORD`, `DATABASE_URL` (with credentials)
   - OAuth: `CLIENT_SECRET`, `CLIENT_ID` (if with secret)

**Detection Pattern:**
```bash
git diff --cached | grep -iE "(api[_-]?key|apikey|secret[_-]?key|password|passwd|token|bearer|jwt|private[_-]?key|aws[_-]?access|client[_-]?secret)" --color=always
```

**If potential secret detected:**
```
🚨 POTENTIAL SECRET DETECTED

File: src/config/api.ts
Line: 23
Pattern: API_KEY = "sk_live_..."

⚠️  Committing secrets is a CRITICAL security risk!

Recommended Actions:
1. Remove the secret from the file
2. Use environment variables instead
3. Add to .env file (gitignored)
4. Update .gitignore if needed

Files to check:
- .env (should be in .gitignore)
- config files with credentials
- API keys in source code

Do you want to abort this commit? (yes/no)
```

**Success Criteria:**
- No potential secrets detected, OR
- User explicitly confirms (after review)

---

### Check 6: File Size & Scope Validation

**Purpose**: Encourage atomic commits and catch accidentally large commits

**Actions:**
1. Check number of files changed:
   ```bash
   git diff --cached --numstat | wc -l
   ```
2. Check total lines changed:
   ```bash
   git diff --cached --numstat | awk '{added+=$1; deleted+=$2} END {print added+deleted}'
   ```

**Thresholds:**
- **Warning**: >20 files OR >500 lines changed
- **Suggest split**: >30 files OR >1000 lines changed

**If threshold exceeded:**
```
⚠️  LARGE COMMIT DETECTED

Changes:
  - 35 files modified
  - 1,234 lines changed

This commit may be too large. Consider splitting into smaller, atomic commits:

Suggested split:
1. Component changes (src/components/*)
2. Service layer (src/services/*)
3. Tests (src/**/__tests__/*)

Atomic commits make:
- Code review easier
- Debugging simpler
- Rollbacks safer

Do you want to proceed anyway? (yes/no)
```

**Success Criteria:**
- Changes are reasonably scoped, OR
- User explicitly confirms large commit

---

### Check 7: Forbidden Files Check

**Purpose**: Prevent committing files that should never be in version control

**Forbidden Patterns:**
- `.env` files (except `.env.example`)
- `node_modules/` (should be gitignored)
- `dist/` or `build/` directories (except intentional)
- `.DS_Store` (macOS)
- `*.log` files
- `coverage/` directory
- IDE-specific files (`.vscode/`, `.idea/`)
- Credentials: `credentials.json`, `secrets.yaml`

**Actions:**
```bash
git diff --cached --name-only | grep -E "(^\.env$|node_modules|\.DS_Store|\.log$|credentials\.|secrets\.)"
```

**If forbidden file detected:**
```
❌ FORBIDDEN FILE DETECTED

File: .env
Reason: Environment files should never be committed

Actions Required:
1. Unstage the file: git reset HEAD .env
2. Add to .gitignore if not present
3. Use .env.example for documentation

COMMIT BLOCKED - Remove forbidden files before proceeding.
```

**Success Criteria:**
- No forbidden files in staged changes

---

## Execution Workflow

### Standard Flow

```
┌─────────────────────────────────────────┐
│  COMMIT QUALITY GUARD EXECUTION         │
└─────────────────────────────────────────┘
              ↓
    ┌─────────────────────┐
    │ Check 1: Git Status │
    └─────────────────────┘
              ↓
         [PASS/FAIL]
              ↓
    ┌─────────────────────────┐
    │ Check 2: Branch Protection│
    └─────────────────────────┘
              ↓
         [WARN/PASS]
              ↓
    ┌─────────────────────┐
    │ Check 3: Tests (npm test) │ ← MANDATORY
    └─────────────────────┘
              ↓
         [PASS/FAIL]
              ↓ FAIL → STOP
              ↓ PASS
    ┌─────────────────────┐
    │ Check 4: Linting     │ ← MANDATORY
    └─────────────────────┘
              ↓
         [PASS/FAIL]
              ↓ FAIL → Auto-fix → Retry
              ↓ PASS
    ┌─────────────────────┐
    │ Check 5: Secrets     │ ← CRITICAL
    └─────────────────────┘
              ↓
         [PASS/WARN]
              ↓
    ┌─────────────────────┐
    │ Check 6: File Scope  │
    └─────────────────────┘
              ↓
         [PASS/WARN]
              ↓
    ┌─────────────────────┐
    │ Check 7: Forbidden   │
    └─────────────────────┘
              ↓
         [PASS/FAIL]
              ↓ FAIL → STOP
              ↓ PASS
    ┌─────────────────────┐
    │ ✅ ALL CHECKS PASSED │
    │ Ready to Commit      │
    └─────────────────────┘
```

### Fast Mode (Skip Warnings)

For experienced developers who want to skip warning prompts:

```bash
SKIP_WARNINGS=true
# Errors still block, warnings are logged but don't prompt
```

---

## Integration Points

### 1. Integration with `/commit` Command

The `/commit` command should call this skill at the start:

```markdown
## Phase 0: Quality Gates (NEW)
Task commit-quality-guard()
  ↓
If ALL CHECKS PASS:
  → Proceed to message generation

If ANY CHECK FAILS:
  → Display errors
  → Suggest fixes
  → STOP (do not proceed)
```

### 2. Integration with Husky Hooks

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Existing lint-staged
npx lint-staged

# Add quality guard
echo "Running commit quality checks..."
# Note: This would need Claude Code CLI integration
# For now, rely on /commit command to call this skill
```

### 3. Integration with CI/CD

Can be used in GitHub Actions as validation:

```yaml
- name: Validate Commit Quality
  run: |
    npm test
    npm run lint
    # Additional checks...
```

---

## Common Issues & Solutions

### Issue 1: Tests Timeout

**Symptom:**
```
Error: Test timed out after 5000ms
```

**Solution:**
1. Check for infinite loops in tests
2. Increase timeout for slow tests:
   ```typescript
   it('slow test', async () => {
     // ...
   }, 10000); // 10 second timeout
   ```
3. Use `waitFor` for async operations:
   ```typescript
   await waitFor(() => {
     expect(screen.getByText('Loaded')).toBeInTheDocument();
   });
   ```

### Issue 2: Linting Fails After Auto-fix

**Symptom:**
```
npm run lint:fix completes but errors remain
```

**Solution:**
1. These are likely semantic issues (not formatting)
2. Common culprits:
   - `any` types → use specific types
   - Unused variables → remove or prefix with `_`
   - Missing return types → add explicit types
3. Fix manually and retry

### Issue 3: False Positive Secret Detection

**Symptom:**
```
Detected: API_KEY in comments or test fixtures
```

**Solution:**
1. Review the detection
2. If false positive:
   - Add `// pragma: allowlist secret` comment
   - Or confirm and proceed
3. If real secret:
   - Remove immediately
   - Rotate the credential
   - Add to .env

### Issue 4: Cannot Commit to Feature Branch

**Symptom:**
```
No staged changes detected
```

**Solution:**
1. Stage your files:
   ```bash
   git add <files>
   ```
2. Or stage all:
   ```bash
   git add .
   ```
3. Verify:
   ```bash
   git status
   ```

---

## Statistics & Metrics

### Current Project Stats (as of creation)
- **Total Tests**: 1,211 tests across 57 test files
- **Coverage Threshold**: 50% (statements)
- **ESLint Rules**: Strict TypeScript checking enabled
- **Test Framework**: Vitest with happy-dom
- **Average Test Duration**: ~12-15 seconds

### Expected Impact
- **Blocked Bad Commits**: ~15-20% (based on industry data)
- **Time Saved in Code Review**: ~30% (fewer quality issues)
- **Security Incidents Prevented**: 40% reduction (secret detection)
- **Test Failures Caught Locally**: ~95% (vs catching in CI)

---

## Success Indicators

### All Checks Pass:
```
✅ COMMIT QUALITY GUARD - ALL CHECKS PASSED

Summary:
  ✅ Git status: Clean (12 files staged)
  ✅ Branch: feat/new-feature (safe)
  ✅ Tests: 1211/1211 passed (55% coverage)
  ✅ Linting: 0 errors, 0 warnings
  ✅ Secrets: No issues detected
  ✅ Scope: 8 files, 245 lines (reasonable)
  ✅ Forbidden files: None

Ready to proceed with commit!
Duration: 14.2s
```

### Checks Failed:
```
❌ COMMIT QUALITY GUARD - BLOCKED

Summary:
  ❌ Tests: 3 failures in PromptCard.test.tsx
  ❌ Linting: 2 errors in components/Form.tsx
  ⚠️  Secrets: Potential API_KEY detected (needs review)

COMMIT BLOCKED - Fix issues above before proceeding.

Actions:
1. Fix failing tests
2. Run npm run lint:fix
3. Review secret detection findings
4. Try again: /commit
```

---

## Enforcement Policy

### Hard Blocks (Cannot Proceed):
- ❌ Tests failing
- ❌ ESLint errors (after auto-fix attempt)
- ❌ No staged changes
- ❌ Merge conflicts present
- ❌ Forbidden files in staging

### Soft Warnings (Can Proceed with Confirmation):
- ⚠️  Protected branch detected
- ⚠️  Large commit (>500 lines)
- ⚠️  Potential secret detected (after review)
- ⚠️  ESLint warnings (non-blocking)

### Skippable (Logged Only):
- ℹ️  Branch naming convention
- ℹ️  Commit message suggestions
- ℹ️  Performance hints

---

## Configuration Options

### Environment Variables

```bash
# Skip all warnings (errors still block)
SKIP_WARNINGS=true

# Skip specific checks (use cautiously)
SKIP_SECRET_DETECTION=false
SKIP_BRANCH_CHECK=false
SKIP_SIZE_CHECK=false

# Adjust thresholds
MAX_FILES_WARNING=20
MAX_LINES_WARNING=500
```

### Project-Specific Overrides

Can be configured in `package.json`:

```json
{
  "commitQualityGuard": {
    "skipWarnings": false,
    "secretPatterns": ["CUSTOM_PATTERN"],
    "protectedBranches": ["main", "master", "staging"],
    "maxFiles": 20,
    "maxLines": 500
  }
}
```

---

## Related Documentation

- **CLAUDE.md**: Development workflow and mandatory requirements
- **docs/TESTING.md**: Testing strategies and patterns
- **.husky/pre-commit**: Pre-commit hook configuration
- **.github/workflows/pr-checks.yml**: CI/CD quality gates

---

## Philosophy

**Quality Gates Prevent Technical Debt**

1. **Catch Issues Early**: Fix problems locally vs. in CI (10x faster feedback)
2. **Enforce Standards**: Consistency across all commits
3. **Security First**: Prevent credential leaks before they happen
4. **Fast Feedback**: Developers know immediately if something is wrong
5. **No Exceptions**: "Small changes" often cause big problems

**The Rule:**
> "If it's too broken to test, it's too broken to commit."

Even trivial changes can introduce regressions. Always test. Always lint. No exceptions.

---

## Version History

- **v1.0.0** - Initial implementation with 7 quality checks
- Enforces: tests, linting, secrets, branch protection, scope, forbidden files
- Integrates: /commit command, Husky hooks, CI/CD pipelines

---

**Last Updated**: 2025-10-30
**Skill Version**: 1.0.0
**Maintained By**: Development Team
