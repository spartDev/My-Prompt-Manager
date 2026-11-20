# GitHub Actions Workflows

This directory contains comprehensive CI/CD workflows for the Chrome Extension project that enforce strict quality requirements and automate release processes.

## 🚨 Quality Gate Enforcement

All workflows enforce the **MANDATORY** requirements from `CLAUDE.md`:
- ✅ **Zero tolerance** for linting errors (`npm run lint`)
- ✅ **All tests must pass** (`npm test`)
- ✅ **Build verification** for Chrome extension
- ✅ **Security scanning** with `npm audit`
- ✅ **Workflow files pass zizmor** (`uvx zizmor .github/workflows`)

## 📋 Available Workflows

### 1. 🔍 Pull Request Checks (`pr-checks.yml`)

**Triggers**: pull requests to `main` (opened, synchronize, reopened, ready for review). Draft PRs run nothing. A newer push cancels the run in progress.

**Job graph** (job names as GitHub shows them):

```text
📦 Dependencies & Setup (setup)
├── 📘 TypeScript Type Checking (type-check)          npm run typecheck
│   ├── 🧹 Code Quality & Linting (lint)              npm run lint
│   └── 🧪 Test Suite & Coverage (test)               npm test, Node 22.x and 24.x
│       │                                             (coverage on 22.x)
│       └── after type-check, lint and test:
│           ├── 🏗️ Build Verification (build)         npm run build, npm run package
│           └── 🎯 End-to-End Tests (e2e)             npm run test:e2e (Playwright, ~10 min)
└── 🔒 Security & Dependencies (security)             node scripts/audit.mjs (npm audit,
                                                      moderate, minus waivers),
                                                      dependency review, manifest check
🌈 Workflow Lint (workflow-lint)                      zizmor over .github/workflows; needs
                                                      no Setup, fails on any finding
✅ Quality Gate Summary (quality-gate)                needs all eight jobs, always runs,
                                                      comments the results on the PR
```

The Quality Gate passes only when every one of the eight jobs ends in `success`. A job that is skipped (every job but Workflow Lint is skipped once Setup fails) or cancelled fails the gate. A run cancelled by a newer push fails on a commit that is no longer the head of the PR, so it blocks nothing.

**Security audit.** `node scripts/audit.mjs` runs `npm audit` and fails on any advisory of moderate severity or higher, in the Security & Dependencies job, in `main-deploy.yml` and in `release.yml`. `npm audit` cannot waive one advisory, so an advisory with no patched release would fail every run until upstream ships a fix. The script's `WAIVERS` list names such an advisory, the reason its risk is accepted, and an expiry date; past that date the waiver fails the audit, so the advisory gets looked at again. A waiver marked `devOnly` applies only while `package-lock.json` marks every installation of the vulnerable package `dev`; once a runtime dependency brings the package in, the advisory blocks again. It holds one: GHSA-fc5q-39xc-vjpf, the picomatch ReDoS (picomatch 4.0.7 and earlier, no patched release), until 2027-02-17. picomatch is a dev dependency only and does not ship in the extension.

**Workflow Lint** runs [zizmor](https://docs.zizmor.sh/) over `.github/workflows` and fails on any finding: a `${{ }}` expression inside a `run:` script, an action not pinned to a commit, a job with more permissions than it uses, a cache read in a release workflow, a checkout that keeps its credentials. The action pins the zizmor release it runs (1.32.0 at v0.8.1), so Renovate's bump of the action is the bump of zizmor. A finding kept on purpose carries `# zizmor: ignore[rule]` and a one-line reason, as a comment on the line zizmor points at or on a line of the step (`release.yml` keeps `softprops/action-gh-release`, `pr-coverage-comment.yml` its `workflow_run` trigger). Locally, with [uv](https://docs.astral.sh/uv/) installed:

```bash
uvx zizmor .github/workflows                            # the offline audits
GH_TOKEN=$(gh auth token) uvx zizmor .github/workflows  # plus the online audits CI runs
```

### 2. 🚀 Main Branch Deployment (`main-deploy.yml`)

**Triggers**: Push to `main` branch

**Extended Validation**:
- 🔍 Extended validation beyond PR checks
- 📈 Performance testing and analysis
- 📦 Production artifact generation
- 🏥 Health monitoring

**Artifacts**:
- Production Chrome extension builds
- Coverage reports
- Build size tracking
- Performance metrics

### 3. 🚀 Release & Chrome Web Store (`release.yml`)

**Triggers**: a version tag (`v*.*.*`), or a manual run (`workflow_dispatch`, no inputs), which is the rehearsal.

**A tag push**:
- 🔍 Validation: the tag equals `package.json`'s version, lint, tests with coverage, `node scripts/audit.mjs`
- 🏗️ Build: `npm run build`, then one zip of the contents of `dist/` (`manifest.json` at its root), `prompt-library-extension-vX.Y.Z.zip`, attested with `actions/attest-build-provenance`
- 📝 Release notes: the version's section of `CHANGELOG.md`
- 🏷️ GitHub Release with that zip attached under its own name (a name that matches no file fails the step). It fails first, before anything changes, when the Release of the tag, draft or published, holds an asset named or labelled as the zip whose digest is not this run's SHA-256 (or has none), or when the Releases cannot be listed. A "Re-run all jobs" builds a new zip: on a tag run, use "Re-run failed jobs" only
- 🚀 Chrome Web Store Submission, for a tag without `-alpha`, `-beta` or `-rc`: once the owner approves the `chrome-webstore` environment, `google-github-actions/auth` trades the job's OIDC token for a Google access token (Workload Identity Federation), and `node scripts/chrome-web-store.mjs submit` uploads the same zip and submits it for Store review through the Chrome Web Store API V2. A rerun for a version already submitted or published sends nothing; a Submission of another version in Store review fails the job and is never cancelled
- 📊 Release summary: one row per job; a failed or cancelled job fails it

**A manual run** takes its version from `package.json` and runs the validation, the build and the attested zip, the Release notes and, on `main` only, one read-only status call to the store in the `chrome-webstore` environment (`node scripts/chrome-web-store.mjs status`). It creates no GitHub Release and submits nothing. On another branch the status job is skipped and the rest runs.

Job-level permissions throughout, and no read of the Actions cache (a release never restores what another run wrote). Only the build (for its attestation) and the two store jobs hold `id-token: write`. The path, the rules of the Submission and reruns: `docs/RELEASE_WORKFLOW.md`.

### 4. 📊 Coverage Report Comment (`pr-coverage-comment.yml`)

**Triggers**: `workflow_run`, when 🔍 Pull Request Checks completes, whatever its conclusion. It runs the workflow file of the default branch, so a change to it takes effect once merged.

**What it does**: downloads the `coverage-summary` artifact that the `test` job uploads (Node 22.x) into `runner.temp`, and runs `.github/scripts/generate-coverage-comment.cjs`, which keeps one coverage comment on the pull request current: the report, or a notice when the run left no summary. It posts nothing on a draft, or for a run whose commit is no longer the head of the pull request. The artifact comes from the pull request's own code, so the script validates every value before it reaches the comment. Details and the security model: `docs/PR_COVERAGE_REPORTING.md`.

It is not part of the Quality Gate and is not a required check.

## 🎯 Usage Guide

### For Pull Requests

1. **Create PR**: All quality gates run automatically
2. **Review Results**: Check the automated PR comment for status
3. **Fix Issues**: Address any failing quality gates
4. **Merge**: Only possible when all gates pass

### For Releases

1. **Bump**: the `release` skill's bump PR sets the version in `package.json`, `package-lock.json` and `manifest.json`, and the CHANGELOG section
2. **Tag**: push `vX.Y.Z` on the bump's merge commit
3. **Approve**: the Submission job waits for the owner's approval of `chrome-webstore`
4. **Store review**: Google's e-mail to the publisher account gives the result; an approved Release is published at once

To try a change to `release.yml`: `gh workflow run release.yml --ref <branch>` (the rehearsal; see above).

### Manual Testing

```bash
# Test all commands used in workflows
npm run lint          # Must pass with zero errors
npm test             # All tests must pass
npm run test:coverage # Generate coverage reports
npm run build        # Production build
npm run package      # Chrome extension packaging
node scripts/audit.mjs # Security check: npm audit at moderate, minus the waivers
npm run lint:renovate # Validate renovate.json (pinned Renovate, via npx)
uvx zizmor .github/workflows # Workflow lint (zizmor, via uv)
```

## 🔧 Configuration

### Required Repository Settings

Branch protection of `main` requires **one** status check: `✅ Quality Gate Summary`. Do not add the other jobs as required checks: GitHub counts a required check whose conclusion is `skipped` as passing, so a PR whose Setup failed (which skips every other job) got through the old set of required jobs. The Quality Gate turns skipped and cancelled into a failure, so it alone holds every job of the graph above (since #479; the switch was made on 2026-11-02).

Also on `main`: unresolved review conversations block the merge (`required_conversation_resolution`), Codex threads included; no approving review is required.

Check the live settings:

```bash
gh api repos/spartDev/My-Prompt-Manager/branches/main/protection \
  --jq '{checks: .required_status_checks.contexts, conversations: .required_conversation_resolution.enabled}'
```

### Chrome Web Store

`release.yml` reads no store secret. The store jobs run in the environment `chrome-webstore` (the owner is its only required reviewer; only `main` and tags `v*` may deploy to it) and read four repository variables: `CWS_WORKLOAD_IDENTITY_PROVIDER`, `CWS_SERVICE_ACCOUNT`, `CWS_PUBLISHER_ID` and `CWS_EXTENSION_ID`. Setting them up, on Google Cloud, in the Developer Dashboard and on GitHub: `docs/GITHUB_ENVIRONMENTS.md`. `GITHUB_TOKEN` is the only secret any workflow uses.

## 📊 Performance Optimization

**Caching Strategy**:
- 📦 Dependencies: `~/.npm`, `node_modules`
- 🏗️ Build assets: `dist/`, `.vite/`

**Parallel Execution**:
- Lint and test jobs run simultaneously
- Matrix builds for multiple Node.js versions
- Independent artifact generation

## 🚨 Failure Handling

**Immediate Failures**:
- Any linting error fails the entire workflow
- Any test failure stops the pipeline
- Security vulnerabilities block progression

**Recovery**:
1. Check workflow logs for specific errors
2. Fix issues locally using the same commands
3. Push fixes to trigger re-run
4. All quality gates must pass for merge

## 📈 Monitoring

**Workflow Health**:
- Build time tracking
- Success/failure rates
- Bundle size monitoring
- Test coverage trends

**Notifications**:
- PR status comments with detailed results
- Failure notifications for main branch issues
- Release completion summaries

## 🔒 Security Features

- Dependency vulnerability scanning
- Workflow lint with zizmor on every pull request
- Chrome extension manifest validation
- License compliance checking
- Secure artifact handling
- OIDC authentication where applicable

## 📝 Maintenance

**Regular Updates**:
- Node.js version updates in `env.NODE_VERSION` (currently 22.x LTS)
- Matrix testing versions (currently 22.x LTS + 24.x latest)
- Action version updates (`@v4`, `@v3`)
- Security policy adjustments
- Performance optimizations

**Troubleshooting**:
- Check workflow logs in GitHub Actions tab
- Verify local commands work: `npm test && npm run lint`
- Ensure `package.json` version consistency for releases
- Review artifact uploads for size/content issues

---

🎉 **Result**: Bulletproof quality enforcement that ensures every change meets your strict standards while maintaining fast feedback loops for developers!