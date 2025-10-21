---
name: Release Automation
description: Automate version bumping, changelog generation, and release preparation. Creates release PR that triggers GitHub Actions workflow for building, testing, and publishing.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, TodoWrite
---

# Release Automation Skill

## Overview

This skill automates the complete pre-release workflow for the My Prompt Manager Chrome extension:

1. **Analyzes git history** to determine appropriate SEMVER version bump
2. **Generates professional changelog** from conventional commits
3. **Updates all version files** (package.json, manifest.json, README.md)
4. **Creates release branch and PR** for review
5. **After PR merge:** Creates git tag that triggers `.github/workflows/release.yml`

**What happens after tag creation (automatic via GitHub Actions):**
- Quality gates (tests, lint, security audit)
- Production build and packaging
- GitHub release creation with changelog
- Chrome Web Store publishing

## Prerequisites

- Clean git working directory
- On `main` branch (or specify `--from-branch`)
- Conventional commit messages (feat:, fix:, chore:, etc.)
- GitHub CLI (`gh`) authenticated

## Usage

```bash
# Interactive mode (recommended)
/release-automation

# Specify version manually (skip auto-detection)
/release-automation --version 1.7.0

# Preview changelog without making changes
/release-automation --dry-run

# Create pre-release
/release-automation --prerelease beta
```

## Instructions

### Phase 1: Analysis & Planning

**Create comprehensive task list:**

```
1. Validate prerequisites (git status, branch, gh auth)
2. Analyze git history for SEMVER recommendation
3. Parse conventional commits for changelog
4. Generate changelog markdown
5. Update version files (package.json, manifest.json)
6. Update documentation (README.md)
7. Create release branch
8. Commit changes
9. Push and create PR
10. Wait for PR merge
11. Create and push git tag
```

**Determine version information:**

```bash
# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $CURRENT_VERSION"

# Get last release - try git tags first, then fall back to version bump commits
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
  echo "🏷️  Last release (git tag): $LAST_TAG"
  RANGE="${LAST_TAG}..HEAD"
  LAST_VERSION=$(echo "$LAST_TAG" | sed 's/^v//')
else
  # No tags found, look for version bump commits
  LAST_BUMP_COMMIT=$(git log --all --pretty=format:"%H|%s" --grep="chore: bump version to" | head -1)

  if [ -n "$LAST_BUMP_COMMIT" ]; then
    COMMIT_HASH=$(echo "$LAST_BUMP_COMMIT" | cut -d'|' -f1)
    COMMIT_MSG=$(echo "$LAST_BUMP_COMMIT" | cut -d'|' -f2)
    LAST_VERSION=$(echo "$COMMIT_MSG" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')

    echo "📌 Last release (version bump commit): v$LAST_VERSION"
    echo "   Commit: $COMMIT_HASH"
    RANGE="${COMMIT_HASH}..HEAD"
  else
    echo "⚠️  No previous releases found (no tags or version bump commits)"
    echo "   This will be the first release."
    LAST_VERSION="0.0.0"
    RANGE="HEAD"
  fi
fi

# Count commits since last release
COMMIT_COUNT=$(git rev-list --count $RANGE)
echo "📊 Commits since v$LAST_VERSION: $COMMIT_COUNT"

if [ "$COMMIT_COUNT" -eq 0 ]; then
  echo "❌ No commits since last release. Nothing to release."
  exit 1
fi
```

**Get repository information:**

```bash
# Extract GitHub repo URL for changelog links
REPO_URL=$(git remote get-url origin | sed 's/\.git$//' | sed 's/git@github.com:/https:\/\/github.com\//')
echo "🔗 Repository: $REPO_URL"

# Get repo owner and name for gh CLI
REPO_OWNER=$(echo $REPO_URL | sed 's/.*github.com\///' | cut -d'/' -f1)
REPO_NAME=$(echo $REPO_URL | sed 's/.*github.com\///' | cut -d'/' -f2)
echo "👤 Owner: $REPO_OWNER"
echo "📦 Repo: $REPO_NAME"
```

### Phase 2: SEMVER Analysis

**Analyze commits to determine version bump:**

```bash
# Get all commits since last release
git log $RANGE --pretty=format:"%s" --no-merges > /tmp/commits.txt

# Initialize counters
BREAKING=0
FEATURES=0
FIXES=0

# Analyze each commit
while IFS= read -r commit; do
  # Check for breaking changes
  if echo "$commit" | grep -qE "^[a-z]+(\([^)]+\))?!:|BREAKING CHANGE"; then
    BREAKING=$((BREAKING + 1))
  # Check for features
  elif echo "$commit" | grep -qE "^feat(\([^)]+\))?:"; then
    FEATURES=$((FEATURES + 1))
  # Check for fixes
  elif echo "$commit" | grep -qE "^fix(\([^)]+\))?:"; then
    FIXES=$((FIXES + 1))
  fi
done < /tmp/commits.txt

# Determine SEMVER bump
if [ $BREAKING -gt 0 ]; then
  BUMP_TYPE="MAJOR"
  JUSTIFICATION="$BREAKING breaking change(s) detected"
elif [ $FEATURES -gt 0 ]; then
  BUMP_TYPE="MINOR"
  JUSTIFICATION="$FEATURES new feature(s) added"
elif [ $FIXES -gt 0 ]; then
  BUMP_TYPE="PATCH"
  JUSTIFICATION="$FIXES bug fix(es) applied"
else
  BUMP_TYPE="PATCH"
  JUSTIFICATION="Maintenance release (chores, docs, etc.)"
fi

echo ""
echo "📊 SEMVER Analysis Results"
echo "=========================="
echo "💥 Breaking changes: $BREAKING"
echo "✨ New features: $FEATURES"
echo "🐛 Bug fixes: $FIXES"
echo ""
echo "📈 Recommended bump: $BUMP_TYPE"
echo "💡 Justification: $JUSTIFICATION"
```

**Calculate new version:**

```bash
# Parse current version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Remove any pre-release suffix from PATCH
PATCH=$(echo "$PATCH" | sed 's/-.*//')

# Calculate new version based on bump type
case "$BUMP_TYPE" in
  MAJOR)
    NEW_VERSION="$((MAJOR + 1)).0.0"
    ;;
  MINOR)
    NEW_VERSION="${MAJOR}.$((MINOR + 1)).0"
    ;;
  PATCH)
    NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
    ;;
esac

echo ""
echo "🎯 Version Update"
echo "================="
echo "Current: v$CURRENT_VERSION"
echo "New:     v$NEW_VERSION"
echo ""

# Ask for confirmation
read -p "Proceed with v$NEW_VERSION? (Y/n): " CONFIRM
if [[ "$CONFIRM" =~ ^[Nn] ]]; then
  echo "❌ Release cancelled by user"
  exit 1
fi
```

### Phase 3: Changelog Generation

**Parse conventional commits and categorize:**

```bash
# Create temporary file for changelog
CHANGELOG_FILE="/tmp/changelog-v${NEW_VERSION}.md"

# Initialize categories
cat > /tmp/changelog-data.json <<'EOF'
{
  "breaking": [],
  "added": [],
  "changed": [],
  "fixed": [],
  "security": []
}
EOF

# Parse commits
git log $RANGE --pretty=format:"%H|%s|%b" --no-merges | while IFS='|' read -r HASH SUBJECT BODY; do

  # Skip version bump commits
  if echo "$SUBJECT" | grep -qE "bump version|release v[0-9]"; then
    continue
  fi

  # Parse conventional commit format
  if echo "$SUBJECT" | grep -qE "^(feat|fix|perf|refactor)(\([^)]+\))?(!)?:"; then

    # Extract components
    TYPE=$(echo "$SUBJECT" | sed -E 's/^([a-z]+).*/\1/')
    SCOPE=$(echo "$SUBJECT" | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/; t; d')
    BREAKING_MARKER=$(echo "$SUBJECT" | grep -o '!' || echo "")
    DESC=$(echo "$SUBJECT" | sed -E 's/^[a-z]+(\([^)]+\))?!?:\s*//')

    # Extract PR number
    PR=$(echo "$DESC" | grep -oE '#[0-9]+' | head -1 | sed 's/#//')

    # Remove PR from description
    DESC=$(echo "$DESC" | sed -E 's/\s*\(#[0-9]+\)$//' | sed -E 's/\s*#[0-9]+$//')

    # Format line
    if [ -n "$SCOPE" ]; then
      LINE="- **${SCOPE}**: ${DESC}"
    else
      LINE="- ${DESC}"
    fi

    # Add link
    if [ -n "$PR" ]; then
      LINE="${LINE} ([#${PR}](${REPO_URL}/pull/${PR}))"
    else
      SHORT_HASH=$(echo "$HASH" | cut -c1-7)
      LINE="${LINE} ([${SHORT_HASH}](${REPO_URL}/commit/${HASH}))"
    fi

    # Categorize
    if [ -n "$BREAKING_MARKER" ] || echo "$BODY" | grep -q "BREAKING CHANGE"; then
      echo "$LINE" >> /tmp/breaking.txt
    elif echo "$SUBJECT $BODY" | grep -qiE "security|vulnerability|cve-"; then
      echo "$LINE" >> /tmp/security.txt
    else
      case "$TYPE" in
        feat)
          echo "$LINE" >> /tmp/added.txt
          ;;
        fix)
          echo "$LINE" >> /tmp/fixed.txt
          ;;
        perf|refactor)
          echo "$LINE" >> /tmp/changed.txt
          ;;
      esac
    fi
  fi
done
```

**Generate changelog markdown:**

```bash
DATE=$(date +%Y-%m-%d)

# Create changelog header
cat > "$CHANGELOG_FILE" <<EOF
## [${NEW_VERSION}] - ${DATE}

EOF

# Add Security section
if [ -f /tmp/security.txt ]; then
  cat >> "$CHANGELOG_FILE" <<EOF
### 🔒 Security

EOF
  cat /tmp/security.txt >> "$CHANGELOG_FILE"
  echo "" >> "$CHANGELOG_FILE"
fi

# Add Breaking Changes section
if [ -f /tmp/breaking.txt ]; then
  cat >> "$CHANGELOG_FILE" <<EOF
### ⚠️ Breaking Changes

EOF
  cat /tmp/breaking.txt >> "$CHANGELOG_FILE"
  echo "" >> "$CHANGELOG_FILE"
fi

# Add Added section
if [ -f /tmp/added.txt ]; then
  cat >> "$CHANGELOG_FILE" <<EOF
### ✨ Added

EOF
  cat /tmp/added.txt >> "$CHANGELOG_FILE"
  echo "" >> "$CHANGELOG_FILE"
fi

# Add Changed section
if [ -f /tmp/changed.txt ]; then
  cat >> "$CHANGELOG_FILE" <<EOF
### 🔄 Changed

EOF
  cat /tmp/changed.txt >> "$CHANGELOG_FILE"
  echo "" >> "$CHANGELOG_FILE"
fi

# Add Fixed section
if [ -f /tmp/fixed.txt ]; then
  cat >> "$CHANGELOG_FILE" <<EOF
### 🐛 Fixed

EOF
  cat /tmp/fixed.txt >> "$CHANGELOG_FILE"
  echo "" >> "$CHANGELOG_FILE"
fi

# Add version comparison links
cat >> "$CHANGELOG_FILE" <<EOF
[${NEW_VERSION}]: ${REPO_URL}/compare/${LAST_TAG}...v${NEW_VERSION}
EOF

# Display generated changelog
echo ""
echo "📝 Generated Changelog Preview"
echo "=============================="
cat "$CHANGELOG_FILE"
echo "=============================="
echo ""
```

**Update CHANGELOG.md file:**

```bash
# Check if CHANGELOG.md exists
if [ ! -f CHANGELOG.md ]; then
  # Create new CHANGELOG.md with header
  cat > CHANGELOG.md <<EOF
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

EOF
fi

# Insert new changelog section after Unreleased
# First, save everything after the Unreleased section
awk '/## \[Unreleased\]/{flag=1;next}/^## \[/{flag=0}flag' CHANGELOG.md > /tmp/unreleased-content.txt

# Rebuild CHANGELOG.md
{
  # Keep everything up to and including Unreleased header
  awk '/## \[Unreleased\]/,0' CHANGELOG.md | head -1

  # Add unreleased content if any
  cat /tmp/unreleased-content.txt

  # Add new version section
  echo ""
  cat "$CHANGELOG_FILE"
  echo ""

  # Add rest of changelog (skip unreleased section)
  awk '/^## \[/{flag=1}flag' CHANGELOG.md | grep -v "## \[Unreleased\]"
} > CHANGELOG.md.new

mv CHANGELOG.md.new CHANGELOG.md

echo "✅ Updated CHANGELOG.md"
echo ""
echo "📋 Note: This changelog will be automatically extracted by GitHub Actions"
echo "   and included in the GitHub release notes when the tag is pushed."
```

### Phase 4: Version File Updates

**Update package.json:**

```bash
# Use npm version to update package.json (without git tag)
npm version "$NEW_VERSION" --no-git-tag-version

echo "✅ Updated package.json to v$NEW_VERSION"
```

**Update manifest.json:**

```bash
# Update version in manifest.json using jq or sed
if command -v jq >/dev/null 2>&1; then
  # Prefer jq for clean JSON manipulation
  jq --arg version "$NEW_VERSION" '.version = $version' manifest.json > manifest.json.tmp
  mv manifest.json.tmp manifest.json
else
  # Fallback to sed
  sed -i.bak "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" manifest.json
  rm manifest.json.bak
fi

echo "✅ Updated manifest.json to v$NEW_VERSION"
```

**Update README.md badges and references:**

```bash
# Update version badges in README.md
if [ -f README.md ]; then
  # Update version badge
  sed -i.bak "s/version-[0-9.]\+-/version-$NEW_VERSION-/" README.md

  # Update any hardcoded version references
  sed -i.bak "s/v$CURRENT_VERSION/v$NEW_VERSION/g" README.md

  rm README.md.bak

  echo "✅ Updated README.md version references"
fi
```

**Verify no hardcoded versions remain:**

```bash
# Search for old version strings in source code
echo "🔍 Checking for hardcoded version strings..."

OLD_VERSION_FOUND=false

# Check TypeScript/JavaScript files
if grep -r "version.*['\"]$CURRENT_VERSION['\"]" src/ 2>/dev/null | grep -v "node_modules" | grep -v ".test."; then
  echo "⚠️  Warning: Found hardcoded version strings in source code"
  echo "💡 Consider using: import manifest from '../manifest.json'; const version = manifest.version;"
  OLD_VERSION_FOUND=true
fi

if [ "$OLD_VERSION_FOUND" = false ]; then
  echo "✅ No hardcoded version strings found"
fi
```

### Phase 5: Git Workflow - Release Branch & PR

**Create release branch:**

```bash
RELEASE_BRANCH="release/v$NEW_VERSION"

# Ensure we're on main
git checkout main

# Pull latest changes
git pull origin main

# Create release branch
git checkout -b "$RELEASE_BRANCH"

echo "✅ Created branch: $RELEASE_BRANCH"
```

**Stage and commit changes:**

```bash
# Stage all version-related files
git add package.json package-lock.json manifest.json CHANGELOG.md

# Add README if it was updated
if git diff --cached --quiet README.md 2>/dev/null; then
  : # No changes
else
  git add README.md
fi

# Create commit message
git commit -m "$(cat <<EOF
chore: bump version to v$NEW_VERSION

- Update package.json and manifest.json to v$NEW_VERSION
- Generate changelog for v$NEW_VERSION release
- Update version references in documentation

SEMVER Analysis:
- Bump type: $BUMP_TYPE
- Justification: $JUSTIFICATION
- Commits analyzed: $COMMIT_COUNT
- Breaking changes: $BREAKING
- New features: $FEATURES
- Bug fixes: $FIXES

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

echo "✅ Created commit with version updates"
```

**Push branch and create PR:**

```bash
# Push release branch to remote
git push origin "$RELEASE_BRANCH"

echo "✅ Pushed branch to origin/$RELEASE_BRANCH"

# Generate PR description from changelog
PR_BODY=$(cat <<EOF
## Release v$NEW_VERSION

### 📊 SEMVER Analysis
- **Bump Type**: $BUMP_TYPE
- **Justification**: $JUSTIFICATION
- **Commits Since Last Release**: $COMMIT_COUNT
  - 💥 Breaking Changes: $BREAKING
  - ✨ New Features: $FEATURES
  - 🐛 Bug Fixes: $FIXES

### 📝 Changelog

$(cat "$CHANGELOG_FILE")

### 📦 Files Changed
- \`package.json\` - Version bump to v$NEW_VERSION
- \`manifest.json\` - Version bump to v$NEW_VERSION
- \`CHANGELOG.md\` - Added v$NEW_VERSION section
- \`README.md\` - Updated version references
- \`package-lock.json\` - Regenerated

### ✅ Pre-Release Validation
- Version consistency verified
- Changelog generated from conventional commits
- All version files updated
- No hardcoded version strings detected

### 🚀 After Merge
Once this PR is merged, run:
\`\`\`bash
git checkout main
git pull origin main
git tag -a v$NEW_VERSION -m "Release v$NEW_VERSION"
git push origin v$NEW_VERSION
\`\`\`

This will trigger the \`.github/workflows/release.yml\` workflow which will:
1. Run quality gates (tests, lint, security audit)
2. Build production extension
3. Create GitHub release
4. Package for Chrome Web Store
5. Publish to Chrome Web Store (if configured)

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)

# Create PR using gh CLI
gh pr create \
  --title "Release v$NEW_VERSION" \
  --body "$PR_BODY" \
  --base main \
  --head "$RELEASE_BRANCH" \
  --label "release" \
  --label "$BUMP_TYPE"

echo "✅ Created pull request for review"

# Get PR URL
PR_URL=$(gh pr view "$RELEASE_BRANCH" --json url -q .url)
echo ""
echo "🔗 Pull Request: $PR_URL"
```

### Phase 6: Post-PR Workflow

**Display next steps:**

```bash
echo ""
echo "======================================"
echo "🎉 Release Preparation Complete!"
echo "======================================"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. ✅ Review the pull request: $PR_URL"
echo "2. ✅ Request code review from team members"
echo "3. ✅ Ensure CI checks pass (tests, lint, build)"
echo "4. ✅ Merge the pull request when approved"
echo ""
echo "5. 🏷️  After PR is merged, create the release tag:"
echo ""
echo "   git checkout main"
echo "   git pull origin main"
echo "   git tag -a v$NEW_VERSION -m \"Release v$NEW_VERSION\""
echo "   git push origin v$NEW_VERSION"
echo ""
echo "6. 🚀 The tag push will trigger .github/workflows/release.yml which will:"
echo "   - Run quality gates (tests, lint, security)"
echo "   - Build production extension"
echo "   - Create GitHub release with changelog"
echo "   - Package for Chrome Web Store"
echo "   - Publish to Chrome Web Store (if secrets configured)"
echo ""
echo "7. 📊 Monitor the release workflow:"
echo "   gh run watch"
echo ""
echo "======================================"
```

**Prompt user for tag creation (optional):**

```bash
echo ""
read -p "Would you like me to wait for PR merge and create the tag automatically? (y/N): " AUTO_TAG

if [[ "$AUTO_TAG" =~ ^[Yy] ]]; then
  echo ""
  echo "⏳ Waiting for PR to be merged..."
  echo "   (You can safely cancel with Ctrl+C and create the tag manually later)"
  echo ""

  # Poll PR status every 30 seconds
  while true; do
    PR_STATE=$(gh pr view "$RELEASE_BRANCH" --json state -q .state 2>/dev/null || echo "UNKNOWN")

    if [ "$PR_STATE" = "MERGED" ]; then
      echo "✅ PR has been merged!"
      echo ""

      # Switch to main and pull
      git checkout main
      git pull origin main

      # Create and push tag
      echo "🏷️  Creating and pushing tag v$NEW_VERSION..."
      git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
      git push origin "v$NEW_VERSION"

      echo ""
      echo "🚀 Tag pushed! GitHub Actions release workflow is now running."
      echo "📊 Monitor progress: gh run watch"
      echo ""

      # Open workflow in browser
      read -p "Open workflow in browser? (y/N): " OPEN_WORKFLOW
      if [[ "$OPEN_WORKFLOW" =~ ^[Yy] ]]; then
        gh run list --workflow=release.yml --limit 1 | head -1 | awk '{print "https://github.com/'$REPO_OWNER'/'$REPO_NAME'/actions/runs/"$7}' | xargs open
      fi

      break
    elif [ "$PR_STATE" = "CLOSED" ]; then
      echo "❌ PR was closed without merging"
      echo "🔧 Please merge the PR manually or create a new release"
      exit 1
    fi

    echo "⏳ PR status: $PR_STATE (checking again in 30s...)"
    sleep 30
  done
else
  echo ""
  echo "✅ Release preparation complete!"
  echo "📋 Follow the steps above to merge PR and create the tag when ready."
fi
```

## Error Handling

### Pre-flight Validation

```bash
# Check git working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Error: Working directory has uncommitted changes"
  echo "🔧 Please commit or stash changes before creating a release"
  git status --short
  exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
  echo "⚠️  Warning: Not on main/master branch (current: $CURRENT_BRANCH)"
  read -p "Continue anyway? (y/N): " CONTINUE
  if [[ ! "$CONTINUE" =~ ^[Yy] ]]; then
    exit 1
  fi
fi

# Check GitHub CLI authentication
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ Error: GitHub CLI not authenticated"
  echo "🔧 Run: gh auth login"
  exit 1
fi

# Check for uncommitted package-lock.json changes
if git diff package-lock.json --quiet; then
  : # No changes
else
  echo "⚠️  Warning: package-lock.json has uncommitted changes"
  echo "🔧 This may indicate dependency issues"
fi
```

### Rollback on Failure

```bash
# If any step fails before PR creation
cleanup_on_failure() {
  echo ""
  echo "❌ Release preparation failed!"
  echo "🔧 Rolling back changes..."

  # Delete release branch if it was created
  if git rev-parse --verify "$RELEASE_BRANCH" >/dev/null 2>&1; then
    git checkout main
    git branch -D "$RELEASE_BRANCH" 2>/dev/null
    echo "✅ Deleted local branch: $RELEASE_BRANCH"
  fi

  # Delete remote branch if it was pushed
  if git ls-remote --heads origin "$RELEASE_BRANCH" | grep -q "$RELEASE_BRANCH"; then
    git push origin --delete "$RELEASE_BRANCH" 2>/dev/null
    echo "✅ Deleted remote branch: origin/$RELEASE_BRANCH"
  fi

  # Restore original files
  git checkout main
  git reset --hard origin/main

  echo "✅ Rollback complete. Repository restored to clean state."
  exit 1
}

trap cleanup_on_failure ERR
```

## Best Practices

### Conventional Commit Messages

Ensure commits follow this format for accurate SEMVER analysis:

```
<type>[optional scope][optional !]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat:` - New feature (MINOR bump)
- `fix:` - Bug fix (PATCH bump)
- `perf:` - Performance improvement (PATCH bump)
- `refactor:` - Code refactoring (PATCH bump)
- `feat!:` or `BREAKING CHANGE:` - Breaking change (MAJOR bump)
- `chore:`, `docs:`, `test:`, `ci:` - Not included in changelog

**Examples:**
```
feat(content): add Gemini platform support (#142)
fix: resolve icon positioning on mobile devices (#143)
feat!: remove legacy storage API (BREAKING CHANGE)
chore(deps): update dompurify to 3.3.0 (#111)
```

### Pre-Release Checklist

Before running this skill:
- ✅ All features merged to main
- ✅ All tests passing locally
- ✅ Lint checks passing
- ✅ Manual testing completed
- ✅ Documentation updated
- ✅ Breaking changes documented (if any)

### Post-Release Checklist

After GitHub Actions completes:
- ✅ Verify GitHub release created
- ✅ Download and test Chrome extension package
- ✅ Verify Chrome Web Store listing (if auto-published)
- ✅ Delete release branch: `git branch -d release/v1.7.0`
- ✅ Announce release (if applicable)

## Examples

### Successful Release Workflow

```
User runs: release-automation skill

SKILL OUTPUT:
📦 Current version: 1.6.0
🏷️  Last release: v1.6.0
📊 Commits since last release: 25

📊 SEMVER Analysis Results
==========================
💥 Breaking changes: 0
✨ New features: 3
🐛 Bug fixes: 1

📈 Recommended bump: MINOR
💡 Justification: 3 new feature(s) added

🎯 Version Update
=================
Current: v1.6.0
New:     v1.7.0

Proceed with v1.7.0? (Y/n): y

📝 Generated Changelog Preview
==============================
## [1.7.0] - 2025-10-21

### Added
- **ui**: Icon-based compact filter/sort controls (#114)
- **skills**: Claude Code skills system (#112)
- TypeScript type-checking in PR workflow (#113)

### Fixed
- Padding consistency in library view components (#102)

[1.7.0]: https://github.com/user/repo/compare/v1.6.0...v1.7.0
==============================

✅ Updated CHANGELOG.md
✅ Updated package.json to v1.7.0
✅ Updated manifest.json to v1.7.0
✅ Updated README.md version references
✅ No hardcoded version strings found
✅ Created branch: release/v1.7.0
✅ Created commit with version updates
✅ Pushed branch to origin/release/v1.7.0
✅ Created pull request for review

🔗 Pull Request: https://github.com/user/repo/pull/123

======================================
🎉 Release Preparation Complete!
======================================

📋 Next Steps:

1. ✅ Review the pull request: https://github.com/user/repo/pull/123
2. ✅ Request code review from team members
3. ✅ Ensure CI checks pass
4. ✅ Merge the pull request when approved

5. 🏷️  After PR is merged, create the release tag:

   git checkout main
   git pull origin main
   git tag -a v1.7.0 -m "Release v1.7.0"
   git push origin v1.7.0

6. 🚀 The tag push will trigger .github/workflows/release.yml
```

## Troubleshooting

### Issue: "No commits since last release"

**Cause:** No changes committed since last version tag
**Solution:** Make some changes, commit them, then run the skill again

### Issue: "Working directory has uncommitted changes"

**Cause:** Uncommitted files in working directory
**Solution:**
```bash
git status
git add .
git commit -m "chore: prepare for release"
# OR
git stash
```

### Issue: "GitHub CLI not authenticated"

**Cause:** `gh` CLI not logged in
**Solution:**
```bash
gh auth login
# Follow prompts to authenticate
```

### Issue: "Version mismatch between package.json and manifest.json"

**Cause:** Versions are out of sync before running skill
**Solution:**
```bash
# Manually sync versions first
npm version 1.6.0 --no-git-tag-version
# Edit manifest.json to match
# Then run skill
```

### Issue: PR creation fails

**Cause:** Branch protection rules or permissions
**Solution:**
```bash
# Create PR manually
gh pr create --base main --head release/v1.7.0
# Or use GitHub web interface
```

## Integration with Existing Workflows

This skill is designed to work seamlessly with:

- **`.github/workflows/release.yml`** - Triggered by tag push, handles building and publishing
- **`.github/workflows/pr-checks.yml`** - Validates release PR (tests, lint, coverage)
- **Husky pre-commit hooks** - Ensures code quality before commits
- **Conventional Commits** - Powers accurate SEMVER analysis and changelog generation

## References

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub CLI Manual](https://cli.github.com/manual/)
