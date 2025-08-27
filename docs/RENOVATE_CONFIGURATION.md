# Renovate Configuration Guide

## Overview

This document explains the Renovate bot configuration for the My Prompt Manager Chrome extension project. Renovate helps keep dependencies up-to-date automatically while maintaining stability and security.

## Configuration Strategy

### 1. **Update Schedule**
- **Weekly Updates**: Runs before 3am on Monday mornings
- **Timezone**: Europe/Paris
- Allows weekend for any critical fixes before the work week

### 2. **Grouping Strategy**

Dependencies are grouped logically to reduce PR noise:

| Group | Packages | Rationale |
|-------|----------|-----------|
| **React packages** | react, react-dom, @types/react* | Core framework - test together |
| **TypeScript & Linting** | typescript, eslint, @typescript-eslint/* | Development tooling compatibility |
| **Build tools** | vite, @vitejs/*, @crxjs/* | Build system integrity |
| **Testing libraries** | vitest, @testing-library/*, jsdom | Test suite compatibility |
| **Tailwind CSS** | tailwindcss, autoprefixer, postcss | CSS processing chain |
| **Chrome types** | @types/chrome | Extension API compatibility |
| **GitHub Actions** | All actions | CI/CD consistency |
| **Git hooks** | husky, lint-staged | Pre-commit workflow |

### 3. **Priority System**

Updates are prioritized based on importance:

1. **Security vulnerabilities** (Priority: 20) - Immediate attention
2. **Chrome extension types** (Priority: 5) - Critical for extension functionality  
3. **Regular updates** (Priority: 0) - Standard priority
4. **Major updates** (Priority: -1) - Requires careful review

### 4. **Automerge Rules**

#### Automatically Merged:
- ✅ DevDependencies patches (low risk)
- ✅ GitHub Actions updates (well-tested)
- ✅ Minor/patch updates after 3-day stability period

#### Manual Review Required:
- ⚠️ Major version updates
- ⚠️ Chrome extension critical dependencies (@crxjs/vite-plugin)
- ⚠️ Security-sensitive packages (dompurify)
- ⚠️ React major versions (7-day stability period)

### 5. **Stability Measures**

- **Minimum Release Age**: 3 days for most packages
- **React Stability**: 7 days minimum before considering updates
- **Rebase Strategy**: Automatically rebase when behind base branch
- **PR Limits**: Max 3 concurrent PRs, 2 per hour

## Special Considerations for Chrome Extensions

### Critical Dependencies

The following packages are handled with extra care:

1. **@crxjs/vite-plugin** - Pinned version, manual review only
   - Breaking changes can affect extension building
   - Test thoroughly after updates

2. **@types/chrome** - Never auto-merged
   - API changes can break extension functionality
   - Review Chrome extension documentation for compatibility

3. **manifest.json** - Not managed by Renovate
   - Manual updates only for manifest version changes

### Testing Requirements

After dependency updates, always:

1. **Run full test suite**: `npm test`
2. **Build extension**: `npm run build`
3. **Manual testing**:
   - Load extension in Chrome developer mode
   - Test popup interface functionality
   - Verify content script on all supported platforms:
     - Claude.ai
     - ChatGPT.com
     - Perplexity.ai
   - Check custom site configuration

## Dependency Dashboard

Renovate creates a dashboard issue showing:
- Pending updates
- Ignored updates
- Rate-limited updates
- Recently closed PRs

Access via: Issues → "🔄 Dependency Updates Dashboard"

## Handling Renovate PRs

### For Minor/Patch Updates:

1. Review the changelog (Renovate provides links)
2. Check CI/CD status (automated tests)
3. For grouped updates, ensure compatibility
4. Merge if all checks pass

### For Major Updates:

1. Read breaking changes carefully
2. Check migration guides
3. Update code if necessary
4. Run full test suite locally
5. Test extension manually
6. Update documentation if needed

### For Security Updates:

1. **Priority**: Address immediately
2. Review the vulnerability details
3. Test affected functionality
4. Deploy quickly after verification

## Common Commands

### Renovate Control Comments

Add these comments to PRs to control Renovate:

- `@renovate-bot rebase` - Manually trigger rebase
- `@renovate-bot recreate` - Recreate the PR
- `@renovate-bot retry` - Retry failed status checks

### Temporarily Disable Updates

Add to renovate.json:
```json
{
  "enabled": false
}
```

Or for specific packages:
```json
{
  "ignoreDeps": ["package-name"]
}
```

## Best Practices

1. **Don't ignore security updates** - Address them promptly
2. **Test grouped updates together** - They're grouped for compatibility
3. **Read changelogs** - Especially for minor updates that might have features
4. **Keep dashboard clean** - Close or merge PRs regularly
5. **Update major versions during low activity** - Plan for potential issues

## Customization Options

### Adding New Package Groups

```json
{
  "packageRules": [
    {
      "description": "Group description",
      "matchPackagePatterns": ["pattern"],
      "groupName": "group-name",
      "groupSlug": "group-slug"
    }
  ]
}
```

### Changing Schedule

```json
{
  "schedule": ["after 10pm on weekdays", "before 5am on weekdays"]
}
```

### Adjusting Automerge

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["safe-package"],
      "automerge": true,
      "automergeType": "branch"
    }
  ]
}
```

## Troubleshooting

### Issue: Too many PRs at once
**Solution**: Adjust `prConcurrentLimit` and `prHourlyLimit`

### Issue: Updates breaking CI
**Solution**: Increase `minimumReleaseAge` and `stabilityDays`

### Issue: Missing updates
**Check**: 
- Dependency Dashboard for ignored/blocked updates
- Repository settings for Renovate app permissions
- Branch protection rules

### Issue: Failing to rebase
**Solution**: Check for merge conflicts, may need manual intervention

## Resources

- [Renovate Documentation](https://docs.renovatebot.com/)
- [Renovate Presets](https://docs.renovatebot.com/presets-default/)
- [Configuration Options](https://docs.renovatebot.com/configuration-options/)
- [Package Rules](https://docs.renovatebot.com/configuration-options/#packagerules)

## Support

For Renovate issues:
1. Check the Dependency Dashboard first
2. Review Renovate logs in PR comments
3. Visit [Renovate Discussions](https://github.com/renovatebot/renovate/discussions)

For project-specific issues:
1. Create an issue in the repository
2. Tag with `dependencies` label
3. Include Renovate PR link if applicable