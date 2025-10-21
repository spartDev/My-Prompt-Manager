# Release Automation Skill

Automated release preparation for My Prompt Manager Chrome extension.

## Quick Start

```bash
# Run the skill (interactive mode)
/release-automation

# Preview what would happen (no changes)
/release-automation --dry-run

# Specify version manually
/release-automation --version 1.7.0
```

## What This Skill Does

### Automated Steps (Local)

1. ✅ Analyzes git history using conventional commits
2. ✅ Recommends SEMVER version bump (MAJOR/MINOR/PATCH)
3. ✅ Generates professional changelog (Keep a Changelog format)
4. ✅ Updates `package.json`, `manifest.json`, `README.md`
5. ✅ Creates release branch (`release/v1.7.0`)
6. ✅ Commits changes with detailed message
7. ✅ Creates Pull Request for review

### After PR Merge (Manual or Automatic)

8. ✅ Create git tag: `git tag -a v1.7.0 -m "Release v1.7.0"`
9. ✅ Push tag: `git push origin v1.7.0`

### GitHub Actions Takes Over (Automatic)

10. ✅ Runs quality gates (tests, lint, security)
11. ✅ Builds production extension
12. ✅ Creates GitHub release with changelog
13. ✅ Packages for Chrome Web Store
14. ✅ Publishes to Chrome Web Store

## Requirements

- Clean git working directory
- On `main` branch
- GitHub CLI (`gh`) authenticated
- Conventional commit messages

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────┐
│              Release Automation Skill                    │
│                    (LOCAL)                               │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────┐
        │  Analyze Git History      │
        │  (conventional commits)   │
        └───────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────┐
        │  Determine SEMVER Bump    │
        │  (MAJOR/MINOR/PATCH)      │
        └───────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────┐
        │  Generate Changelog       │
        │  (Keep a Changelog)       │
        └───────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────┐
        │  Update Version Files     │
        │  (pkg, manifest, readme)  │
        └───────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────┐
        │  Create Release Branch    │
        │  & Pull Request           │
        └───────────────────────────┘
                        │
                        ▼
            ┌───────────────────┐
            │  USER REVIEWS PR  │
            └───────────────────┘
                        │
                        ▼
            ┌───────────────────┐
            │    MERGE PR       │
            └───────────────────┘
                        │
                        ▼
        ┌───────────────────────────┐
        │  Create & Push Tag        │
        │  (v1.7.0)                 │
        └───────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│           .github/workflows/release.yml                 │
│                (GITHUB ACTIONS)                          │
└─────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Validate │    │  Build   │    │  Test    │
  │          │    │          │    │          │
  └──────────┘    └──────────┘    └──────────┘
        │               │               │
        └───────────────┼───────────────┘
                        ▼
        ┌───────────────────────────┐
        │  Create GitHub Release    │
        │  (with changelog)         │
        └───────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────┐
        │  Publish Chrome Web Store │
        └───────────────────────────┘
```

## SEMVER Analysis Logic

The skill analyzes commits since the last tag and determines the version bump:

| Commit Pattern | SEMVER Bump | Example |
|----------------|-------------|---------|
| `feat!:` or `BREAKING CHANGE:` | **MAJOR** | `1.6.0 → 2.0.0` |
| `feat:` | **MINOR** | `1.6.0 → 1.7.0` |
| `fix:`, `perf:` | **PATCH** | `1.6.0 → 1.6.1` |
| Only `chore:`, `docs:`, etc. | **PATCH** | `1.6.0 → 1.6.1` |

## Changelog Generation

Parses conventional commits and categorizes into:

- **Security** - CVE fixes, vulnerability patches
- **Breaking Changes** - API changes, incompatible updates
- **Added** - New features (`feat:`)
- **Changed** - Improvements (`perf:`, `refactor:`)
- **Fixed** - Bug fixes (`fix:`)

**Links to PRs when available, commit hashes as fallback.**

## Example Output

```markdown
## [1.7.0] - 2025-10-21

### Added
- **ui**: Icon-based compact filter/sort controls ([#114](https://github.com/user/repo/pull/114))
- **skills**: Claude Code skills system ([#112](https://github.com/user/repo/pull/112))
- TypeScript type-checking in PR workflow ([#113](https://github.com/user/repo/pull/113))

### Fixed
- Padding consistency in library view components ([#102](https://github.com/user/repo/pull/102))

[1.7.0]: https://github.com/user/repo/compare/v1.6.0...v1.7.0
```

## Conventional Commit Format

Ensure commits follow this pattern:

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer]
```

**Examples:**
```
feat(content): add Gemini platform support (#142)
fix: resolve icon positioning bug (#143)
feat!: remove legacy API (BREAKING CHANGE)
chore(deps): update dompurify to 3.3.0
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `perf:` - Performance improvement
- `refactor:` - Code refactoring
- `chore:` - Maintenance (not in changelog)
- `docs:` - Documentation (not in changelog)
- `test:` - Tests (not in changelog)
- `ci:` - CI/CD (not in changelog)

## FAQ

### Q: Can I skip the PR and create the tag directly?

**A:** Not recommended. The PR workflow allows for:
- Code review
- CI validation (tests, lint)
- Manual verification before release

### Q: What if I want to release a specific version number?

**A:** Use `--version` flag:
```bash
/release-automation --version 2.0.0
```

### Q: How do I create a pre-release (beta, alpha)?

**A:** Add the flag when running:
```bash
/release-automation --prerelease beta
# Creates v1.7.0-beta.1
```

### Q: What happens if the skill fails halfway through?

**A:** The skill includes automatic rollback:
- Deletes release branch (local and remote)
- Restores files to original state
- No persistent changes if error occurs

### Q: Can I manually edit the changelog before creating the PR?

**A:** Yes! After the skill generates the changelog, you can:
1. Pause before PR creation
2. Edit `CHANGELOG.md`
3. Continue with PR creation

### Q: What if package.json and manifest.json versions don't match?

**A:** The skill will error and ask you to fix manually:
```bash
npm version 1.6.0 --no-git-tag-version
# Edit manifest.json to match
```

## Troubleshooting

### "Working directory not clean"

**Solution:**
```bash
git status
git add .
git commit -m "chore: prepare for release"
```

### "GitHub CLI not authenticated"

**Solution:**
```bash
gh auth login
```

### "No commits since last release"

**Solution:** Commit some changes first, then run the skill.

### "Tag already exists"

**Solution:**
```bash
# Delete tag if you want to recreate
git tag -d v1.7.0
git push origin :refs/tags/v1.7.0
```

## Best Practices

1. ✅ Use conventional commits consistently
2. ✅ Include PR numbers in commit messages: `feat: add feature (#123)`
3. ✅ Run tests locally before releasing
4. ✅ Review changelog before merging PR
5. ✅ Delete release branches after merge: `git branch -d release/v1.7.0`
6. ✅ Monitor GitHub Actions workflow after tag push

## Integration Points

- **`.github/workflows/release.yml`** - Triggered by tag push
- **`.github/workflows/pr-checks.yml`** - Validates release PR
- **Conventional Commits** - Powers SEMVER analysis
- **GitHub CLI** - Creates PRs and manages releases

## Resources

- [Skill Documentation](./SKILL.md) - Complete technical reference
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
