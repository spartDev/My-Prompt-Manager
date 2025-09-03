# GitHub Repository Environments Setup

This document provides instructions for setting up GitHub repository environments for the Chrome extension release workflow.

## Overview

The release workflow uses GitHub Environments to provide additional security and control over sensitive operations like Chrome Web Store publishing and emergency rollbacks.

## Required Environments

### 1. `chrome-webstore` Environment

This environment protects Chrome Web Store publishing operations.

**Setup Steps:**
1. Go to your repository Settings → Environments
2. Click "New environment" 
3. Name it `chrome-webstore`
4. Configure protection rules:
   - ✅ **Required reviewers**: Add 1-2 repository maintainers
   - ✅ **Wait timer**: Set to 5 minutes (allows time to cancel if needed)
   - ✅ **Deployment branches**: Restrict to `main` branch only

**Required Secrets:**
```
CHROME_EXTENSION_ID         # Your extension's ID from Chrome Web Store
CHROME_CLIENT_ID           # OAuth2 client ID for Chrome Web Store API
CHROME_CLIENT_SECRET       # OAuth2 client secret for Chrome Web Store API
CHROME_REFRESH_TOKEN       # OAuth2 refresh token for API access
CHROME_WEB_STORE_API_KEYS  # JSON object with all Chrome Web Store API credentials
```

**Environment Variables:**
```
ENVIRONMENT=production
STORE_ENVIRONMENT=chrome-webstore
```

### 2. `emergency-rollback` Environment

This environment protects emergency rollback operations.

**Setup Steps:**
1. Create environment named `emergency-rollback`
2. Configure protection rules:
   - ✅ **Required reviewers**: Add senior maintainers/leads only
   - ✅ **Wait timer**: Set to 2 minutes
   - ✅ **Deployment branches**: Allow all branches (for emergency situations)

**Required Secrets:**
```
SLACK_WEBHOOK_URL          # Slack webhook for emergency notifications (optional)
GITHUB_TOKEN              # Automatically provided by GitHub Actions
```

## Chrome Web Store API Setup

To enable automated Chrome Web Store publishing, you need to set up API credentials:

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Chrome Web Store API

### Step 2: Create OAuth2 Credentials
1. Go to APIs & Services → Credentials
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Application type: "Desktop application"
4. Download the credentials JSON file

### Step 3: Generate Refresh Token
Use the Chrome Web Store API documentation or tools like:
```bash
# Using chrome-webstore-upload-cli
npm install -g chrome-webstore-upload-cli
chrome-webstore-upload-cli --help
```

### Step 4: Configure Repository Secrets

Add the following secrets to your `chrome-webstore` environment:

```yaml
# Individual secrets approach
CHROME_EXTENSION_ID: "your-extension-id-from-webstore"
CHROME_CLIENT_ID: "your-oauth2-client-id"
CHROME_CLIENT_SECRET: "your-oauth2-client-secret" 
CHROME_REFRESH_TOKEN: "your-oauth2-refresh-token"

# Combined API keys approach (recommended)
CHROME_WEB_STORE_API_KEYS: |
  {
    "extensionId": "your-extension-id",
    "clientId": "your-oauth2-client-id",
    "clientSecret": "your-oauth2-client-secret",
    "refreshToken": "your-oauth2-refresh-token"
  }
```

## Environment Protection Best Practices

### Security Recommendations

1. **Principle of Least Privilege**
   - Only grant access to necessary team members
   - Use different reviewer requirements for different environments

2. **Audit Trail**
   - All environment deployments are logged
   - Review deployment history regularly

3. **Branch Protection**
   - Restrict production environments to `main` branch
   - Allow emergency environments broader access when needed

4. **Secret Rotation**
   - Rotate Chrome Web Store API credentials quarterly
   - Update secrets immediately if compromised

### Operational Guidelines

1. **Pre-release Checklist**
   - Verify all required secrets are present and valid
   - Test API credentials in development environment first
   - Ensure reviewers are available for approval

2. **Release Process**
   - Workflow will automatically request approval for protected environments
   - Approvers should verify release notes and version numbers
   - Monitor Chrome Web Store submission status after approval

3. **Emergency Procedures**
   - Emergency rollback environment should only be used for critical issues
   - Document all emergency actions taken
   - Follow up with post-mortem analysis

## Environment Variables Reference

### Common Variables
```bash
ENVIRONMENT=production|staging|development
NODE_ENV=production
CI=true
FORCE_COLOR=1
```

### Release-Specific Variables
```bash
RELEASE_VERSION=${version}          # Automatically set by workflow
BUILD_NUMBER=${github.run_number}   # GitHub Actions run number
COMMIT_SHA=${github.sha}            # Git commit SHA
```

### Chrome Web Store Variables
```bash
STORE_ENVIRONMENT=chrome-webstore
WEBSTORE_UPLOAD_TIMEOUT=300000     # 5 minute timeout
WEBSTORE_VERBOSE_LOGGING=true      # Enable detailed logs
```

## Troubleshooting

### Common Issues

**Environment Not Found**
- Ensure environment name matches exactly (case-sensitive)
- Check that environment is created in correct repository

**Approval Timeout**
- Default timeout is 6 hours for manual approval
- Approvers must have appropriate repository permissions

**API Authentication Failures**
- Verify all Chrome Web Store API credentials
- Check that OAuth2 tokens haven't expired
- Ensure Google Cloud project has Chrome Web Store API enabled

**Secret Access Denied**
- Verify secrets are added to correct environment (not repository-level)
- Check that workflow job specifies correct environment
- Ensure secret names match exactly (case-sensitive)

### Debug Commands

```bash
# Check environment configuration via GitHub CLI
gh api repos/OWNER/REPO/environments

# List environment secrets
gh api repos/OWNER/REPO/environments/chrome-webstore/secrets

# View recent deployments
gh api repos/OWNER/REPO/deployments
```

## Support and Resources

- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [Chrome Web Store API Documentation](https://developer.chrome.com/docs/webstore/using_webstore_api/)
- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)

For additional support, please create an issue in the repository or contact the DevOps team.