<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Changelog Format

Based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## File Header

Every `CHANGELOG.md` starts with this header:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
```

## Release Entry Template

```markdown
## [X.Y.Z] - YYYY-MM-DD

<summary paragraph: 2-4 sentences in plain language describing what this
release means for users. Focus on outcomes, not implementation details.>

### Breaking Changes

- Description of what broke and how to migrate ([#PR](link))

### Added

- New feature or capability ([#PR](link))

### Changed

- Modification to existing behavior ([#PR](link))

### Deprecated

- Feature that will be removed in a future release ([#PR](link))

### Removed

- Feature that was removed ([#PR](link))

### Fixed

- Bug that was resolved ([#PR](link))

### Security

- Vulnerability that was addressed ([#PR](link))

### Contributors

- @username1
- @username2
- @username3 (new contributor)
```

## Writing Guidelines

### Summary Paragraph

- Write 2-4 sentences explaining the release in plain language
- A non-technical stakeholder should understand what changed and why it matters
- Focus on "so what?" — what can users do now that they couldn't before?
- Avoid jargon, acronyms, and implementation details

**Good**: "This release adds Cursor IDE support, letting teams install standards
with a single command regardless of their editor. Six new skills cover
architecture documentation, CI/CD engineering, and more."

**Bad**: "Added dual-target support for Cursor via CLI refactoring of the
installer module. Vendored vercel-labs agent skills into the registry."

### Change Entries

- Start each entry with a past-tense verb: "Added", "Fixed", "Removed"
- One bullet per logical change (a PR may contain multiple, or multiple PRs may
  be one logical change)
- Link the PR number: `([#42](https://github.com/org/repo/pull/42))`
- Include scope in parentheses when helpful: "Added new `--global` flag to the
  install command"

### Categories

Only include categories that have entries. Order matters:

1. **Breaking Changes** — always first, always prominent
2. **Added** — new features and capabilities
3. **Changed** — changes to existing functionality
4. **Deprecated** — soon-to-be-removed features
5. **Removed** — features that were removed
6. **Fixed** — bug fixes
7. **Security** — vulnerability fixes
8. **Contributors** — always last

### Contributors

- List GitHub usernames with `@` prefix
- Include everyone who authored commits in this release
- Mark first-time contributors with "(new contributor)"
- If known, also credit significant reviewers

### Link Footer

At the bottom of `CHANGELOG.md`, maintain a link reference section:

```markdown
[1.3.0]: https://github.com/org/repo/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/org/repo/compare/v1.1.0...v1.2.0
```

## Example Entry

```markdown
## [1.3.0] - 2025-03-15

This release adds Cursor IDE support and brings six new skills to the catalog.
Teams using Cursor can now install standards with a single command, and all
users benefit from new guidance on architecture documentation, ADR writing,
and CI/CD engineering.

### Added

- Dual-target Cursor support for all installers ([#21](link))
- Architecture documentation skill with C4 model patterns ([#16](link))
- ADR writing skill with MADR template and review checklist ([#15](link))
- CI/CD engineering skill with ENG-CI compliance checklists ([#20](link))
- Elements Charts skill with runtime discovery ([#23](link))
- Vendored curated Vercel Labs agent skills into registry ([#24](link))

### Fixed

- Update notify-update test to match new upgrade command text ([#19](link))

### Contributors

- @alice
- @bob
- @charlie (new contributor)
```
