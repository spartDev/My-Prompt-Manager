# Chrome Extension Release Workflow

This document provides comprehensive, step-by-step instructions for releasing the Chrome Extension to production. The project uses GitHub Actions for automated CI/CD, semantic versioning, and Chrome Web Store distribution.

## 📋 Release Overview

The release process consists of two main paths:
- **Automated Release**: Tag-based releases using GitHub Actions
- **Manual Release**: Using GitHub workflow dispatch for custom releases

## 🚨 Prerequisites & Requirements

Before starting any release, ensure:

1. **Code Quality Standards Met**
   - All PRs merged to `main` have passed quality gates
   - Latest `main` branch has clean CI/CD status
   - No outstanding security vulnerabilities

2. **Required Permissions**
   - Write access to repository for creating tags/releases
   - Access to Chrome Web Store Developer Console (for manual publishing)
   - Repository secrets configured (see [Secrets Configuration](#secrets-configuration))

3. **Version Strategy**
   - Follow [semantic versioning](https://semver.org/) (MAJOR.MINOR.PATCH)
   - Version must be incremented from current `package.json` version

## 🔄 Release Process Options

### Option 1: Automated Tag-Based Release (Recommended)

This is the recommended approach for regular releases.

#### Step 1: Pre-Release Preparation

1. **Verify Main Branch Status**
   ```bash
   git checkout main
   git pull origin main
   git status
   ```

2. **Run Mandatory Quality Checks Locally**
   ```bash
   # MANDATORY - Must pass before release
   npm test
   npm run lint
   
   # Optional but recommended
   npm run test:coverage
   npm run build
   ```

3. **Version Consistency Check**
   - Ensure `package.json` version matches planned release
   - Ensure `manifest.json` version matches `package.json`

#### Step 2: Version Bumping

1. **Update Version Numbers**
   ```bash
   # For patch release (1.0.1 -> 1.0.2)
   npm version patch
   
   # For minor release (1.0.1 -> 1.1.0)  
   npm version minor
   
   # For major release (1.0.1 -> 2.0.0)
   npm version major
   ```
   
   This automatically:
   - Updates `package.json` version
   - Creates a git commit with version bump
   - Creates a git tag (e.g., `v1.0.2`)

2. **Push Version Tag**
   ```bash
   git push origin main --follow-tags
   ```

#### Step 3: Automatic Release Execution

Once the tag is pushed, GitHub Actions automatically:
- ✅ **Validates Release**: Runs comprehensive quality gates
- ✅ **Builds Extension**: Creates production-ready Chrome extension
- ✅ **Creates GitHub Release**: With auto-generated release notes
- ✅ **Prepares Web Store Package**: Ready for Chrome Web Store submission
- ✅ **Publishes to Web Store**: If secrets are configured (optional)

#### Step 4: Monitor Release Progress

1. **Watch GitHub Actions**
   - Go to: `https://github.com/[username]/[repo]/actions`
   - Monitor the "🚀 Release & Chrome Web Store" workflow
   - Expected duration: 5-10 minutes

2. **Verify Release Artifacts**
   - GitHub release created with `.zip` file
   - Chrome Web Store package artifact available
   - All quality gates passed

### Option 2: Manual Workflow Dispatch Release

Use this for pre-releases, hotfixes, or custom release scenarios.

#### Step 1: Navigate to GitHub Actions

1. Go to: `https://github.com/[username]/[repo]/actions`
2. Select "🚀 Release & Chrome Web Store" workflow
3. Click "Run workflow" button

#### Step 2: Configure Release Parameters

```yaml
Branch: main (or specific branch for hotfix)
Version: 1.0.2 (must match package.json)
Pre-release: false (true for beta/alpha releases)
```

#### Step 3: Execute and Monitor

- Same monitoring process as automated release
- Manual tag creation if workflow succeeds

## 📊 Release Workflow Details

### Quality Gates (All Must Pass)

The release process enforces these mandatory quality gates:

1. **🔍 Release Validation**
   - Version consistency check (package.json vs release tag)
   - Complete ESLint check with zero tolerance
   - Full test suite execution with coverage
   - Security audit (moderate+ vulnerabilities fail release)
   - Advanced security scanning (CodeQL)

2. **🏗️ Release Build**
   - Production build creation
   - Chrome extension packaging
   - Build verification (manifest validation)
   - Build size analysis and optimization check
   - Supply chain attestation generation

3. **🏷️ GitHub Release Creation**
   - Auto-generated release notes from commits
   - Release asset upload (`.zip` file)
   - Tag creation if not exists
   - Pre-release flag handling

4. **🌐 Chrome Web Store Preparation**
   - Web Store compliance validation
   - Store-specific package creation
   - Icon and manifest verification
   - Final package validation

### Release Artifacts

Each successful release produces:

- **GitHub Release**: With downloadable `.zip` file
- **Chrome Extension Package**: `chrome-extension-release-v[VERSION]`  
- **Chrome Web Store Package**: `chrome-webstore-package-v[VERSION]`
- **Coverage Reports**: Test coverage artifacts
- **Build Attestations**: Supply chain security proof

## 🔒 Secrets Configuration

Configure these repository secrets for full automation:

### Required Secrets
```bash
GITHUB_TOKEN  # Auto-provided by GitHub Actions
```

### Optional Secrets (for Chrome Web Store automation)
```bash
CHROME_WEB_STORE_API_KEYS  # Chrome Web Store API credentials
CHROME_EXTENSION_ID        # Your extension's Web Store ID
CHROME_CLIENT_ID          # OAuth client ID for Web Store API
```

### Optional Notification Secrets
```bash
SLACK_WEBHOOK_URL         # For release notifications
```

## 🚀 Chrome Web Store Publishing

### Automated Publishing

If Chrome Web Store secrets are configured:
- Release workflow automatically submits to Chrome Web Store
- Review process starts immediately
- Extension updates after Google approval (1-3 business days)

### Manual Publishing

If automation isn't configured:

1. **Download Web Store Package**
   - Go to GitHub Actions artifacts
   - Download `chrome-webstore-package-v[VERSION].zip`

2. **Submit to Chrome Web Store**
   - Login to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
   - Select your extension
   - Click "Package" tab
   - Upload the downloaded `.zip` file
   - Update store listing if needed
   - Submit for review

3. **Post-Submission**
   - Review process: 1-3 business days
   - Monitor developer dashboard for approval status
   - Extension auto-updates for users after approval

## ✅ Post-Release Verification

### Immediate Verification (< 5 minutes)

1. **GitHub Release Check**
   - Verify release appears at: `https://github.com/[username]/[repo]/releases`
   - Download and test extension `.zip` file
   - Confirm version numbers match

2. **Build Artifact Validation**
   ```bash
   # Download and extract release
   unzip chrome-extension-release-v[VERSION].zip
   cd dist/
   
   # Verify key files exist
   ls -la manifest.json popup.html
   
   # Verify manifest version
   grep version manifest.json
   ```

3. **Local Testing**
   - Load unpacked extension in Chrome
   - Test core functionality
   - Verify version in extension details

### Chrome Web Store Verification (1-3 days)

1. **Review Status**
   - Monitor Chrome Web Store Developer Dashboard
   - Check for approval notifications

2. **Live Extension Testing**
   - Install from Chrome Web Store after approval
   - Test all features in production environment
   - Verify auto-update functionality

## 🚨 Rollback Procedures

### Immediate Rollback (Within Hours)

If critical issues are discovered immediately after release:

1. **Emergency Workflow Trigger**
   - Failed release workflows automatically trigger rollback procedures
   - Manual rollback available via GitHub Actions

2. **Manual Rollback Steps**
   ```bash
   # Delete problematic tag
   git tag -d v[VERSION]
   git push origin --delete v[VERSION]
   
   # Delete GitHub release
   # Use GitHub UI or gh CLI
   gh release delete v[VERSION]
   ```

3. **Chrome Web Store Actions**
   - Cancel submission if still in review
   - Contact Chrome Web Store support if already published

### Version Revert

For more significant issues requiring version revert:

1. **Create Hotfix Branch**
   ```bash
   git checkout -b hotfix/v[PREVIOUS_VERSION]
   git checkout [PREVIOUS_GOOD_COMMIT]
   ```

2. **Emergency Release Process**
   - Follow normal release process with incremented version
   - Use manual workflow dispatch for speed
   - Mark as hotfix in release notes

## 📈 Release Metrics & Monitoring

### Success Metrics

Track these metrics for each release:

- **Build Success Rate**: Target 100%
- **Test Coverage**: Maintain >80%
- **Build Time**: Target <10 minutes
- **Chrome Web Store Approval Rate**: Target >95%
- **User Adoption Rate**: Monitor via Web Store analytics

### Monitoring Setup

1. **GitHub Actions Monitoring**
   - Enable workflow notifications
   - Set up status checks on main branch
   - Monitor artifact storage usage

2. **Chrome Web Store Analytics**
   - Weekly active users
   - Version adoption rates
   - Review scores and feedback

3. **Error Tracking**
   - Monitor extension error reports
   - Set up alerts for critical failures

## 🛠️ Troubleshooting Guide

### Common Release Issues

#### Version Mismatch Errors
```bash
❌ Version mismatch between package.json (1.0.1) and release (1.0.2)
```
**Solution:**
```bash
# Update package.json version to match tag
npm version [TARGET_VERSION] --no-git-tag-version
git add package.json
git commit -m "chore: update version to [TARGET_VERSION]"
```

#### Linting Failures
```bash
❌ ESLint found issues - release failed
```
**Solution:**
```bash
# Fix linting issues locally
npm run lint:fix
npm run lint  # Verify fixes
git add .
git commit -m "fix: resolve linting issues for release"
```

#### Test Failures
```bash
❌ Test suite failed - release blocked
```
**Solution:**
```bash
# Run tests locally and fix issues
npm test
# Fix failing tests, then:
git add .
git commit -m "fix: resolve test failures for release"
```

#### Build Failures
```bash
❌ Production build failed
```
**Solution:**
```bash
# Test build locally
npm run build
# Fix build issues, then commit fixes
```

#### Chrome Web Store Validation Errors
```bash
❌ Manifest validation failed for Web Store
```
**Solution:**
- Check manifest.json for Chrome Web Store compliance
- Ensure all required fields are present
- Verify icon files exist and meet requirements

### Recovery Procedures

#### Partial Release Failure

If release partially completes but fails at Web Store:

1. **GitHub Release**: Will be created successfully
2. **Web Store Package**: Available in artifacts
3. **Manual Web Store**: Submit manually using artifacts

#### Complete Release Failure

If release fails entirely:

1. **Check Logs**: Review GitHub Actions logs
2. **Fix Issues**: Address root cause locally
3. **Retry Release**: Push new tag or re-run workflow
4. **Emergency Rollback**: If needed, follow rollback procedures

## 📚 Additional Resources

### Documentation Links
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Web Store Developer Guide](https://developer.chrome.com/docs/webstore/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning Specification](https://semver.org/)

### Internal Links
- [CLAUDE.md](../CLAUDE.md) - Development guidelines
- [GitHub Actions Workflows](../.github/workflows/) - CI/CD configuration
- [Chrome Web Store Visuals](./CHROME_STORE_VISUALS.md) - Store listing assets

### Support Channels
- **Technical Issues**: GitHub Issues
- **Release Emergencies**: Repository maintainers
- **Chrome Web Store**: [Developer Support](https://support.google.com/chrome_webstore/contact/developer_policy)

---

## 📋 Release Checklist Template

Copy this checklist for each release:

### Pre-Release
- [ ] All PRs merged to main
- [ ] Quality gates passing on main branch
- [ ] Version numbers updated in package.json
- [ ] Release notes drafted (if manual)
- [ ] Chrome Web Store assets ready (if needed)

### Release Execution
- [ ] Tag created and pushed (automated) OR workflow dispatched (manual)
- [ ] GitHub Actions workflow completed successfully
- [ ] All quality gates passed
- [ ] GitHub release created with assets
- [ ] Chrome Web Store package generated

### Post-Release
- [ ] GitHub release verified and tested
- [ ] Extension manually tested locally
- [ ] Chrome Web Store submission confirmed (if automated)
- [ ] Team notified of successful release
- [ ] Monitoring enabled for new version

### Follow-up (1-3 days)
- [ ] Chrome Web Store approval confirmed
- [ ] Live extension tested from store
- [ ] User feedback monitored
- [ ] Release metrics reviewed
- [ ] Next release planning (if needed)

---

*Last Updated: 2025-09-03*
*Version: 1.0*