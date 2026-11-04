# GitHub Actions Workflows

This directory contains comprehensive CI/CD workflows for the Chrome Extension project that enforce strict quality requirements and automate release processes.

## 🚨 Quality Gate Enforcement

All workflows enforce the **MANDATORY** requirements from `CLAUDE.md`:
- ✅ **Zero tolerance** for linting errors (`npm run lint`)
- ✅ **All tests must pass** (`npm test`)
- ✅ **Build verification** for Chrome extension
- ✅ **Security scanning** with `npm audit`

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
└── 🔒 Security & Dependencies (security)             npm audit --audit-level=moderate,
                                                      dependency review, manifest check
✅ Quality Gate Summary (quality-gate)                needs all seven jobs, always runs,
                                                      comments the results on the PR
```

The Quality Gate passes only when every one of the seven jobs ends in `success`. A job that is skipped (every job is skipped once Setup fails) or cancelled fails the gate. A run cancelled by a newer push fails on a commit that is no longer the head of the PR, so it blocks nothing.

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

**Triggers**: 
- Release creation/publication
- Version tags (`v*.*.*`)
- Manual workflow dispatch

**Release Process**:
- 🔍 Release validation and version consistency
- 🏗️ Optimized production builds
- 🏷️ GitHub release creation with assets
- 🌐 Chrome Web Store package preparation
- 📊 Release summary and documentation

## 🎯 Usage Guide

### For Pull Requests

1. **Create PR**: All quality gates run automatically
2. **Review Results**: Check the automated PR comment for status
3. **Fix Issues**: Address any failing quality gates
4. **Merge**: Only possible when all gates pass

### For Releases

1. **Update Version**: Ensure `package.json` version matches release tag
2. **Create Release**: Use GitHub releases or push version tag
3. **Automated Process**: Workflow handles building and packaging
4. **Download Assets**: Get Chrome Web Store package from artifacts

### Manual Testing

```bash
# Test all commands used in workflows
npm run lint          # Must pass with zero errors
npm test             # All tests must pass
npm run test:coverage # Generate coverage reports
npm run build        # Production build
npm run package      # Chrome extension packaging
npm audit --audit-level=moderate # Security check
npm run lint:renovate # Validate renovate.json (pinned Renovate, via npx)
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

### GitHub Secrets (if needed)

- `GITHUB_TOKEN`: Automatically provided
- Additional secrets for Chrome Web Store publishing (if desired)

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