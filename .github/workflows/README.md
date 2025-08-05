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

**Triggers**: Pull requests to `main` branch

**Quality Gates**:
- 📦 Dependencies & Setup
- 🧹 Code Quality & Linting (zero tolerance)
- 🧪 Test Suite & Coverage (all must pass)
- 🏗️ Build Verification (dev + production)
- 🔒 Security & Dependencies
- ✅ Quality Gate Summary with PR comments

**Features**:
- Parallel job execution for speed
- Matrix testing (Node.js 18.x, 20.x)
- Smart caching (dependencies, builds, ESLint)
- Fail-fast strategy
- Chrome extension validation
- Automated PR status comments

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
```

## 🔧 Configuration

### Required Repository Settings

**Branch Protection Rules** (recommended):
```yaml
main:
  required_status_checks:
    - "Dependencies & Setup"
    - "Code Quality & Linting" 
    - "Test Suite & Coverage"
    - "Build Verification"
    - "Security & Dependencies"
  require_pull_request_reviews: true
  restrict_pushes: true
```

### GitHub Secrets (if needed)

- `GITHUB_TOKEN`: Automatically provided
- Additional secrets for Chrome Web Store publishing (if desired)

## 📊 Performance Optimization

**Caching Strategy**:
- 📦 Dependencies: `~/.npm`, `node_modules`
- 🏗️ Build assets: `dist/`, `.vite/`
- 🧹 ESLint cache: `.eslintcache`

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
- Node.js version updates in `env.NODE_VERSION`
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