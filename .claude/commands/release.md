---
allowed-tools: Bash, Read, Write, Edit, MultiEdit, Task, Grep, Glob, TodoWrite
description: Complete SEMVER release preparation including version updates, validation, and release readiness
---

# Release

This command performs a comprehensive release preparation process, determining the new SEMVER version and updating all necessary files for a Chrome extension release.

## Instructions

### Phase 1: Analysis & Planning
1. **Use TodoWrite** to create a comprehensive task list for tracking progress
2. **Check git status** and ensure working directory is clean:
   - Stash or commit any uncommitted changes
   - Ensure current branch is up to date with remote
3. **Create release branch** for version management:
   ```bash
   git checkout -b release/v{NEW_VERSION}
   # Example: git checkout -b release/v1.4.1
   ```
4. **Analyze git history** since the last version bump:
   - Look for version bump commits (e.g., "chore: bump version", "release:")
   - Identify all changes since the last release
   - Categorize changes: features, fixes, breaking changes, docs, etc.
5. **Determine current version** from both `package.json` and `manifest.json`
6. **Calculate new SEMVER version** based on changes:
   - **PATCH (x.x.1)**: Bug fixes, documentation, minor improvements
   - **MINOR (x.1.0)**: New features, new platform support, significant enhancements
   - **MAJOR (1.0.0)**: Breaking changes, major architectural changes
7. **Validate version consistency** between package.json and manifest.json

### Phase 2: Comprehensive File Updates
1. **Update core version files**:
   - `package.json` - Main project version
   - `manifest.json` - Chrome extension version

2. **Search for hardcoded version references** using subagent:
   - Search entire codebase for old version strings
   - Check TypeScript/JavaScript files for hardcoded versions
   - Look in component files (especially SettingsView.tsx or similar)
   - Find any version displays in UI components
   - **IMPORTANT**: Replace hardcoded versions with dynamic imports:
     ```typescript
     // ❌ Bad - hardcoded version
     version="1.4.1"

     // ✅ Good - dynamic import
     import manifest from '../../manifest.json';
     version={manifest.version}
     ```

3. **Update documentation files**:
   - `README.md`:
     - **Version badge** at the top (e.g., `version-1.7.0-blue.svg`)
     - **Tests badge** with current test count (e.g., `tests-1169%20passing-brightgreen.svg`)
     - **Tech Stack table** with current dependency versions:
       - Vite version (check package.json)
       - DOMPurify version (check package.json)
       - Other major dependencies as needed
     - **Available Scripts table**: Update test count in description (e.g., "Run test suite (1169+ tests)")
     - **Testing section**: Update test file count (e.g., "1169+ tests across 56 test files")
     - **Package naming** that includes version (e.g., `prompt-library-extension-v1.7.0.zip`)
     - Any version-specific feature references
   - `CLAUDE.md`: Check for version-specific instructions or references

4. **Regenerate lockfiles**:
   - Run `npm install` to update `package-lock.json` with new version
   - Verify no dependency conflicts

### Phase 3: Validation & Testing
1. **Run comprehensive checks**:
   ```bash
   npm test          # Ensure all tests pass
   npm run lint      # Verify code quality
   npm run build     # Ensure build succeeds
   npm run typecheck # Check TypeScript compilation
   ```

2. **Chrome Extension specific validation**:
   - Verify manifest.json is valid
   - Check that build creates proper `dist/` folder
   - Validate extension icons and permissions

3. **Final version verification**:
   - Search codebase one more time for any missed version references
   - Ensure all version strings are consistent
   - Verify no old version numbers remain in built assets

### Phase 4: Release Preparation
1. **Generate comprehensive release report** including:
   - **Version Summary**: Old → New version with justification
   - **Changes Since Last Release**: Categorized list of commits
   - **Files Updated**: Complete list with specific changes
   - **SEMVER Justification**: Explanation of version bump type
   - **Validation Results**: Test, lint, and build status
   - **Next Steps**: Commands to run for final release

2. **Prepare release artifacts** (but don't execute unless requested):
   - **Stage all changes for commit**:
     ```bash
     git add package.json manifest.json README.md CHANGELOG.md package-lock.json
     # Add any other files that were updated (e.g., src/components/SettingsView.tsx)
     ```
   - **Prepare commit message**:
     ```bash
     git commit -m "chore: bump version to {NEW_VERSION}

     - Update package.json and manifest.json to {NEW_VERSION}
     - Update CHANGELOG.md with release notes
     - Update README.md: version badges, test counts, tech stack versions
     - Replace hardcoded versions with dynamic imports (if any)

     🤖 Generated with Claude Code"
     ```
   - **Prepare git tag** (to be created after PR approval):
     ```bash
     # Note: Tag will be created after PR is merged
     # git tag -a v{NEW_VERSION} -m "Release v{NEW_VERSION}"
     # Example: git tag -a v1.4.1 -m "Release v1.4.1"
     ```
   - **Create Pull Request for review**:
     ```bash
     # Push release branch
     git push origin release/v{NEW_VERSION}

     # Create PR using GitHub CLI (if available)
     gh pr create \
       --title "Release v{NEW_VERSION}" \
       --body "$(cat <<'EOF'
     ## Release v{NEW_VERSION}

     ### Changes
     - Update package.json and manifest.json to v{NEW_VERSION}
     - Update CHANGELOG.md with release notes
     - Update README.md: version badges, test counts, tech stack versions
     - Replace hardcoded versions with dynamic imports (if any)
     - Run comprehensive quality checks (tests, lint, build)

     ### Files Changed
     - `package.json` - Version bump
     - `manifest.json` - Version bump
     - `CHANGELOG.md` - Release notes added
     - `README.md` - Version badges, test counts, tech stack versions
     - `src/components/SettingsView.tsx` - Dynamic version import (if needed)
     - `package-lock.json` - Regenerated

     ### Quality Assurance
     - ✅ All tests pass (532/532)
     - ✅ Linting passes
     - ✅ Build succeeds
     - ✅ TypeScript compilation clean

     🤖 Generated with Claude Code
     EOF
     )" \
       --base main \
       --head release/v{NEW_VERSION}
     ```
   - **Alternative: Manual PR creation**:
     ```bash
     # If gh CLI not available, provide PR creation link
     echo "Create PR manually at:"
     echo "https://github.com/[USER]/[REPO]/compare/main...release/v{NEW_VERSION}"
     ```
   - **Note packaging command for Chrome Web Store**:
     ```bash
     npm run package  # Creates distribution ZIP
     ```

## Context & Resources

### Git Analysis
- **Git history**: Use `git log --oneline -n 20` for recent commits
- **Last version bump**: Search for version/release related commits
- **Change analysis**: `git log --grep="feat\|fix\|breaking"` for categorization
- **Branch management**: Work on `release/v{VERSION}` branch for isolation

### File References
- **Package.json**: `@package.json` - Main project configuration
- **Manifest.json**: `@manifest.json` - Chrome extension manifest
- **CHANGELOG.md**: `@CHANGELOG.md` - Release history and notes
- **Package-lock.json**: `@package-lock.json` - Dependency lockfile
- **README**: `@README.md` - Project documentation (includes version badges, test counts)
- **CLAUDE.md**: `@CLAUDE.md` - Development instructions

### Chrome Extension Specific
This is a Chrome extension project, so:
- Both `package.json` and `manifest.json` must have matching versions
- Consider Chrome Web Store requirements
- Validate extension permissions and content security policy
- Test extension loading after build

### Quality Assurance Requirements
- **MANDATORY**: All tests must pass (`npm test`)
- **MANDATORY**: Linting must pass (`npm run lint`)
- **MANDATORY**: Build must succeed (`npm run build`)
- **MANDATORY**: TypeScript compilation must succeed (`npm run typecheck`)

## Expected Output

1. **Comprehensive task tracking** using TodoWrite throughout the process
2. **Detailed analysis** of git history and changes
3. **Complete file updates** with version synchronization
4. **Dynamic version imports** replacing all hardcoded versions
5. **Validation results** from all quality checks
6. **Professional release report** with next steps
7. **No missed version references** anywhere in the codebase

## Error Handling

- **If git working directory is dirty**: Stash or commit changes before starting
- **If tests fail**: **DO NOT** proceed with version updates until fixed
- **If version inconsistencies found**: Resolve before continuing
- **If hardcoded versions found**: Replace with dynamic imports (see example above)
- **If hardcoded versions missed**: Use subagent to find and fix all instances
- **If builds fail**: Address build issues before finalizing release
- **If release branch exists**: Either delete old branch or use different version number

## Best Practices

### Git Workflow
- **Release branches**: Always create `release/v{VERSION}` branches for version updates
- **Clean working directory**: Ensure no uncommitted changes before starting
- **Pull Request workflow**: Create PR for code review, never merge directly to main
- **Proper tagging**: Tag releases after PR approval and merge
- **Branch cleanup**: Delete release branches after successful PR merge

### Version Management
- **Never hardcode versions** in source code
- **Always use dynamic imports** for version display:
  ```typescript
  import manifest from '../path/to/manifest.json';
  // Use manifest.version in components
  ```
- **Single source of truth**: manifest.json is the primary version source
- **Automatic synchronization**: This prevents version sync issues forever

### Release Process
1. **Preparation**: Clean git state, create release branch
2. **Implementation**: Update versions, fix hardcoded references
3. **Validation**: Run all tests and quality checks
4. **Documentation**: Update release notes and version references
5. **Review**: Create PR for code review and approval
6. **Integration**: After PR approval, tag and merge to main

This command should leave the codebase in a completely release-ready state with proper git workflow and all version references updated and validated.