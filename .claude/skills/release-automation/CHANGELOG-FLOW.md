# Changelog Flow Documentation

This document explains how the changelog is generated, stored, and published throughout the release process.

## Overview

The changelog is generated once by the release-automation skill and then automatically extracted by GitHub Actions for the GitHub release.

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│         1. Release Automation Skill (LOCAL)              │
│                                                          │
│  Analyzes git commits since last release                │
│  Parses conventional commits (feat:, fix:, etc.)        │
│  Categorizes into sections (Added, Fixed, Changed, etc.)│
│  Links to PRs automatically                             │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
              Generates Changelog
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   CHANGELOG.md                           │
│                                                          │
│  # Changelog                                            │
│                                                          │
│  ## [Unreleased]                                        │
│                                                          │
│  ## [1.7.0] - 2025-10-21                                │
│                                                          │
│  ### Added                                              │
│  - Feature A ([#123])                                   │
│  - Feature B ([#124])                                   │
│                                                          │
│  ### Fixed                                              │
│  - Bug fix ([#125])                                     │
│                                                          │
│  [1.7.0]: https://github.com/.../compare/v1.6.0...1.7.0│
└─────────────────────────────────────────────────────────┘
                        │
                        │ (Committed in release PR)
                        ▼
┌─────────────────────────────────────────────────────────┐
│              2. Git Repository (REMOTE)                  │
│                                                          │
│  main branch contains CHANGELOG.md with v1.7.0 section │
└─────────────────────────────────────────────────────────┘
                        │
                        │ (Tag v1.7.0 pushed)
                        ▼
┌─────────────────────────────────────────────────────────┐
│     3. GitHub Actions Workflow (.github/workflows)       │
│                                                          │
│  Step 1: Checkout repository                            │
│  Step 2: Extract changelog section for v1.7.0           │
│          ↓                                               │
│          Uses awk to extract:                            │
│          /^## \[1.7.0\]/ to /^## \[/                   │
│          ↓                                               │
│          Creates: changelog-excerpt.txt                  │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              changelog-excerpt.txt                       │
│                                                          │
│  ## [1.7.0] - 2025-10-21                                │
│                                                          │
│  ### Added                                              │
│  - Feature A ([#123])                                   │
│  - Feature B ([#124])                                   │
│                                                          │
│  ### Fixed                                              │
│  - Bug fix ([#125])                                     │
│                                                          │
│  [1.7.0]: https://github.com/.../compare/v1.6.0...1.7.0│
└─────────────────────────────────────────────────────────┘
                        │
                        │ (Combined with additional info)
                        ▼
┌─────────────────────────────────────────────────────────┐
│              release-notes.md (Generated)                │
│                                                          │
│  # Chrome Extension v1.7.0                              │
│                                                          │
│  ## [1.7.0] - 2025-10-21                                │
│                                                          │
│  ### Added                                              │
│  - Feature A ([#123])                                   │
│  - Feature B ([#124])                                   │
│                                                          │
│  ### Fixed                                              │
│  - Bug fix ([#125])                                     │
│                                                          │
│  [1.7.0]: https://github.com/.../compare/v1.6.0...1.7.0│
│                                                          │
│  ---                                                    │
│                                                          │
│  ## 📦 Installation                                     │
│  [Installation instructions...]                         │
│                                                          │
│  ## 🔧 Technical Details                                │
│  - Version: 1.7.0                                       │
│  - Build Date: 2025-10-21                               │
│  [Technical details...]                                 │
│                                                          │
│  ## 🛠️ Key Features                                     │
│  [Feature list...]                                      │
│                                                          │
│  ## 🐛 Bug Reports & Feature Requests                   │
│  [Links to issues, discussions, security...]            │
│                                                          │
│  ## 📚 Documentation                                    │
│  [Links to docs...]                                     │
└─────────────────────────────────────────────────────────┘
                        │
                        │ (Used by GitHub release action)
                        ▼
┌─────────────────────────────────────────────────────────┐
│          4. GitHub Release (PUBLISHED)                   │
│                                                          │
│  Title: Chrome Extension v1.7.0                         │
│  Tag: v1.7.0                                            │
│  Assets: chrome-extension-v1.7.0.zip                    │
│  Body: [Full content of release-notes.md]              │
└─────────────────────────────────────────────────────────┘
```

## Technical Implementation

### Step 1: Skill Generates Changelog (CHANGELOG.md)

**Location:** `.claude/skills/release-automation/SKILL.md`

**Process:**
```bash
# Parse commits since last tag
git log v1.6.0..HEAD --pretty=format:"%H|%s|%b" --no-merges

# Categorize by conventional commit type
feat: → Added section
fix:  → Fixed section
perf: → Changed section
breaking (!) → Breaking Changes section

# Format as Keep a Changelog
## [1.7.0] - 2025-10-21

### Added
- Feature description ([#PR](link))

### Fixed
- Bug fix description ([#PR](link))

[1.7.0]: comparison-link
```

**Output:** Updates `CHANGELOG.md` file in repository

### Step 2: GitHub Actions Extracts Changelog

**Location:** `.github/workflows/release.yml` (lines 275-403)

**Process:**
```bash
# Extract section for specific version
awk -v version="$version" '
  /^## \['$version'\]/ { found=1; print; next }
  /^## \[/ { if (found) exit }
  found { print }
' CHANGELOG.md > changelog-excerpt.txt

# Combine with installation instructions and metadata
cat > release-notes.md << EOF
# Chrome Extension v$version

$(cat changelog-excerpt.txt)

---

## 📦 Installation
[Installation instructions]

## 🔧 Technical Details
[Build metadata]

## 🛠️ Key Features
[Feature list]

## 🐛 Bug Reports
[Links to issues/discussions]

## 📚 Documentation
[Links to docs]
EOF
```

**Output:** Creates `release-notes.md` for GitHub release

### Step 3: Create GitHub Release

**Location:** `.github/workflows/release.yml` (lines 405-416)

**Process:**
```yaml
- name: Create GitHub Release
  uses: softprops/action-gh-release@v2
  with:
    tag_name: v${{ needs.validate-release.outputs.version }}
    name: Chrome Extension v${{ needs.validate-release.outputs.version }}
    body_path: release-notes.md  # ← Uses extracted changelog
    files: chrome-extension-v$version.zip
```

**Output:** Published GitHub release with professional changelog

## Changelog Format Standards

### Keep a Changelog Format

The skill follows the [Keep a Changelog](https://keepachangelog.com/) standard:

```markdown
## [1.7.0] - 2025-10-21

### Security
- Fixed security vulnerability CVE-2025-XXXX ([#123])

### Breaking Changes
- Removed legacy API endpoint ([#124])

### Added
- **ui**: New feature with scope ([#125])
- Another feature without scope ([#126])

### Changed
- **performance**: Optimization description ([#127])
- Refactoring description ([#128])

### Fixed
- Bug fix description ([#129])
- Another bug fix ([#130])

[1.7.0]: https://github.com/owner/repo/compare/v1.6.0...v1.7.0
```

### Section Order (Priority)

1. **Security** (highest priority)
2. **Breaking Changes**
3. **Added**
4. **Changed**
5. **Fixed**

### Link Format

**PR links (preferred):**
```markdown
- Feature description ([#123](https://github.com/owner/repo/pull/123))
```

**Commit links (fallback):**
```markdown
- Feature description ([abc1234](https://github.com/owner/repo/commit/abc1234567))
```

## Changelog Extraction Logic

The GitHub Actions workflow uses `awk` to extract the version-specific section:

```bash
awk -v version="1.7.0" '
  /^## \[1.7.0\]/ {
    found=1      # Start capturing
    print        # Include the header
    next
  }
  /^## \[/ {
    if (found) exit  # Stop at next version
  }
  found { print }    # Print all lines in this section
' CHANGELOG.md
```

**Extraction Rules:**
1. Starts capturing at `## [1.7.0]`
2. Continues until next `## [` (version boundary)
3. Includes all content between versions
4. Preserves markdown formatting

## Fallback Behavior

### If CHANGELOG.md Missing

```markdown
## What's New in v1.7.0

See commit history for details.

## 📦 Installation
[Basic instructions]

## 🐛 Bug Reports
[GitHub issues link]
```

### If Version Section Not Found

```markdown
## What's New in v1.7.0

See CHANGELOG.md for details.

## 📦 Installation
[Basic instructions]

## 🐛 Bug Reports
[GitHub issues link]
```

## Best Practices

### 1. Commit Message Format

Always use conventional commits for accurate categorization:

```bash
✅ Good:
feat(ui): add dark mode toggle (#123)
fix: resolve memory leak in storage (#124)
feat!: remove deprecated API (BREAKING CHANGE)

❌ Bad:
added feature
fixed bug
updates
```

### 2. PR Linking

Include PR numbers in commit messages:

```bash
feat: add feature (#123)  # ✅ Auto-linked in changelog
feat: add feature         # ⚠️ Uses commit hash instead
```

### 3. Version Consistency

Ensure package.json, manifest.json, and CHANGELOG.md all use the same version:

```bash
package.json:  "version": "1.7.0"
manifest.json: "version": "1.7.0"
CHANGELOG.md:  ## [1.7.0] - 2025-10-21
```

### 4. Changelog Review

Always review the generated changelog before merging the release PR:

1. Check for accuracy
2. Verify PR links work
3. Ensure categorization is correct
4. Fix any typos or formatting issues
5. Add migration notes for breaking changes

## Testing

### Preview Changelog Locally

```bash
# Run skill in dry-run mode
/release-automation --dry-run

# Or manually extract from CHANGELOG.md
awk '/^## \[1.7.0\]/,/^## \[/' CHANGELOG.md
```

### Test GitHub Actions Extraction

```bash
# Simulate the extraction locally
version="1.7.0"
awk -v version="$version" '
  /^## \['$version'\]/ { found=1; print; next }
  /^## \[/ { if (found) exit }
  found { print }
' CHANGELOG.md
```

## Troubleshooting

### Issue: Changelog not appearing in GitHub release

**Cause:** Version mismatch between tag and CHANGELOG.md
**Solution:**
```bash
# Check CHANGELOG.md for version section
grep "## \[1.7.0\]" CHANGELOG.md

# Ensure version format matches (no 'v' prefix in CHANGELOG.md)
## [1.7.0] - 2025-10-21  # ✅ Correct
## [v1.7.0] - 2025-10-21 # ❌ Wrong (includes 'v')
```

### Issue: Empty changelog in release

**Cause:** Awk extraction failed to find section
**Solution:**
```bash
# Check CHANGELOG.md format
head -50 CHANGELOG.md

# Ensure proper markdown headers
## [1.7.0] - 2025-10-21  # ✅ Must have ## prefix
[1.7.0] - 2025-10-21    # ❌ Missing ##
```

### Issue: Changelog includes wrong content

**Cause:** Multiple version sections with same number
**Solution:**
```bash
# Check for duplicate version headers
grep "## \[1.7.0\]" CHANGELOG.md

# Should only return one result
```

## Example Release Notes Output

Here's what users see in the GitHub release:

```markdown
# Chrome Extension v1.7.0

## [1.7.0] - 2025-10-21

### Added
- **ui**: Icon-based compact filter/sort controls for mobile-first UI ([#114](https://github.com/user/repo/pull/114))
- **skills**: Claude Code skills system for project workflows ([#112](https://github.com/user/repo/pull/112))
- TypeScript type-checking in PR workflow ([#113](https://github.com/user/repo/pull/113))

### Fixed
- Padding consistency in library view components ([#102](https://github.com/user/repo/pull/102))

[1.7.0]: https://github.com/user/repo/compare/v1.6.0...v1.7.0

---

## 📦 Installation

### Chrome Web Store (Recommended)
- Visit the [Chrome Web Store](https://chrome.google.com/webstore) listing
- Click "Add to Chrome" to install
- Extension will auto-update with new releases

### Manual Installation (Developer Mode)
1. Download the `chrome-extension-v1.7.0.zip` file from release assets
2. Extract the ZIP file to a folder
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **Developer mode** (toggle in top-right corner)
5. Click **Load unpacked** and select the extracted folder
6. The extension should now appear in your browser toolbar

## 🔧 Technical Details

- **Version**: 1.7.0
- **Manifest Version**: 3
- **Build Date**: 2025-10-21 14:23:45 UTC
- **Commit**: abc123def456
- **Node Version**: 22.x

## 🛠️ Key Features

- 📝 Popup interface for prompt management
- 🤖 Content script integration with AI platforms (Claude, ChatGPT, Perplexity)
- 💾 Secure local storage using Chrome Storage API
- 🌓 Dark/light theme support with system preference detection
- 📤 Export/import functionality for prompt libraries
- 🔍 Advanced search and filtering
- 🏷️ Category management and organization

## 🐛 Bug Reports & Feature Requests

- **Issues**: [GitHub Issues](https://github.com/user/repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/user/repo/discussions)
- **Security**: Report via [Security Advisory](https://github.com/user/repo/security/advisories/new)

## 📚 Documentation

- [Installation Guide](https://github.com/user/repo#installation)
- [User Guide](https://github.com/user/repo#usage)
- [Contributing](https://github.com/user/repo/blob/main/CONTRIBUTING.md)
- [Changelog](https://github.com/user/repo/blob/main/CHANGELOG.md)
```

## Summary

The changelog flows through three stages:

1. **Generation** (Release Skill) → `CHANGELOG.md` in repository
2. **Extraction** (GitHub Actions) → `release-notes.md` temporary file
3. **Publishing** (GitHub Release) → Visible on GitHub releases page

This ensures a single source of truth (CHANGELOG.md) while providing rich, formatted release notes on GitHub.
