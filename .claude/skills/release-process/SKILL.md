---
name: release-process
description: >
  Automates releases: SemVer bumping from git tags, CHANGELOG.md generation,
  release branch/PR creation, and GitHub release automation via reusable workflow.
  Use when the user says "prepare a release", "cut a release", "bump version",
  "create a release", "release vX.Y.Z", "ship it", "new version", "tag and
  publish", "/release", "write release notes", "update the changelog", or asks
  to ship, tag, version, or publish a new release. Also use when setting up or
  updating the create-release GitHub Actions workflow that automates GitHub
  release creation on PR merge. Trigger this skill even for casual or minimal
  requests like "release" or "ready to ship". Do NOT use for hotfix deployments,
  rollbacks, or cherry-picks; for CI/CD pipeline setup use cicd-engineering
  instead; for PR reviews use creating-pull-requests instead; for debugging
  publish failures in existing workflows, diagnose the pipeline directly.
allowed-tools: Bash Read Write Edit Grep Glob
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Release Process

Prepare and publish releases with SemVer versioning, human-readable changelogs, and automated GitHub releases.

## Philosophy

- **Git tags are the version source of truth** — derive the current version from the latest git tag, not package.json
- **Changelogs are for humans** — group changes by impact, write in plain language, highlight breaking changes
- **Automate the mechanical parts** — version bumps, PR creation, and GitHub release creation are scripted; humans decide *what* to release and *how* to describe it
- **Contributors deserve credit** — every release lists the people who made it happen

## Workflow

### 1. Pre-flight checks

Before starting, verify the working tree is clean and the tooling is available:

```bash
# Ensure no uncommitted changes
git status --porcelain

# Ensure gh CLI is authenticated
gh auth status

# Ensure we're on main and up-to-date
git checkout main && git pull origin main
```

If there are uncommitted changes, warn the user and ask them to commit or stash first. If `gh` is not authenticated, tell the user to run `gh auth login`.

### 2. Analyze changes since last release

Git tags are the version source of truth. Gather everything needed to decide the bump and write the changelog:

```bash
# Get the latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
echo "Current version: $LATEST_TAG"

# List commits since last tag (conventional commit format)
git log "$LATEST_TAG"..HEAD --oneline --no-merges

# Get detailed commit messages for changelog writing
git log "$LATEST_TAG"..HEAD --format="%h %s%n%b---" --no-merges

# List contributors (GitHub usernames via gh)
gh api repos/:owner/:repo/compare/"$LATEST_TAG"...HEAD \
  --jq '[.commits[].author.login] | unique | .[]'

# Show scope of changes
git diff "$LATEST_TAG"..HEAD --stat
```

### 3. Determine version bump

Apply SemVer rules based on the conventional commits found:

| Commits contain | Bump | Example |
|----------------|------|---------|
| `BREAKING CHANGE:` in body or `!` after type | **major** | 1.2.0 -> 2.0.0 |
| `feat:` (new features) | **minor** | 1.2.0 -> 1.3.0 |
| `fix:`, `docs:`, `refactor:`, `perf:`, etc. | **patch** | 1.2.0 -> 1.2.1 |

Present the analysis and recommended bump to the user. The user always has final say on the version number — they may want to override the recommendation.

### 4. Update package.json

Use `npm version` to bump cleanly without creating a git tag (the tag is created later by the GitHub release):

```bash
npm version <major|minor|patch> --no-git-tag-version
```

This updates both `package.json` and `package-lock.json`. If `npm version` fails, fall back to manual editing.

### 5. Generate the changelog entry

Update (or create) `CHANGELOG.md` following the format in [references/changelog-format.md](references/changelog-format.md).

The changelog entry has three parts:

1. **Summary paragraph** — 2-4 sentences in plain language explaining what this release means. Write for a non-technical audience: what can users do now that they couldn't before?
2. **Categorized changes** — group under Added, Changed, Fixed, etc. Link PRs where available. Put Breaking Changes first and make them prominent.
3. **Contributors list** — GitHub usernames of everyone who authored commits in this release. Call out first-time contributors separately.

If `CHANGELOG.md` doesn't exist, create it with the standard header from the reference file.

### 5b. Verify the generated changelog against reality

LLM-generated changelogs can drift from what actually changed — the prose looks plausible but references standards that aren't in the tree, or omits new ones. Run deterministic checks before opening the release PR to catch hallucinations.

**Generic gates (always run these):**

1. **Cited paths resolve** — every path-shaped citation in the new section must resolve at HEAD. Fail if the changelog cites a path that does not exist.

2. **Typed standard mentions are real** — backticked ids followed by a type noun (e.g. `` `foo` skill ``, `` `bar` hook ``) must correspond to a directory in the project's standards tree *and* be registered in the catalog. This is the gate that catches plausible-looking but fabricated standards — the failure mode that motivated this whole step. Fail if either side is missing.

3. **Referenced PRs exist and are merged** — for each `#NNN` in the section, call `gh pr view NNN --json state` and fail if state is not `MERGED`.

4. **Contributors match git log** — compare the contributors list in the changelog with commit authors since the last tag:

   ```bash
   gh api "repos/:owner/:repo/compare/$LATEST_TAG...HEAD" \
     --jq '[.commits[].author.login] | unique | .[]'
   ```

   Every non-bot author must appear in the section. Bots (`dependabot`, `renovate`, `*[bot]`) may be skipped.

If any generic gate fails, stop and fix the changelog. Do not proceed to step 6.

### 5c. Generate release-owned plugin snapshots

If `package.json` defines `plugins:generate`, generate the release snapshot after the package version and changelog are final:

```bash
VERSION="$(node -p 'require("./package.json").version')"
npm run plugins:generate -- --version "$VERSION"
npm run plugins:check -- --version "$VERSION"
npm run plugins:validate
```

Treat root `.claude-plugin/` and `plugins/` as generated release artifacts. Review their diff, but never edit them by hand. If a check fails, fix the canonical standards, profiles, configuration, or generator-owned templates and regenerate. The marketplace may reference the future `v$VERSION` tag; validation must not require that tag to exist before the release PR merges.

**Project-specific gates (run if a hook exists):**

Projects have structural invariants the skill cannot know about — catalogs, registries, manifest consistency, cross-file version constants, plugin metadata, design-system exports. Delegate to a project-defined hook by convention.

Check for a release-verification hook in this order:

1. `npm run release:check` if `package.json` defines a script named `release:check`
2. `./scripts/release-check.sh` if the file exists and is executable
3. None — only generic gates apply

Run the hook after the generic gates pass. Treat any non-zero exit as a hard failure: the hook encodes invariants the project owner considers load-bearing. Surface its stdout and stderr to the user so they can fix the underlying issue, not just re-run until green.

**Why this exists:** a prior release shipped a changelog whose prose described standards that were not actually in the tree. The LLM generated plausible-looking notes from commit messages, and nothing compared that prose to the actual artefacts being shipped. These gates make that class of bug impossible to publish.

### 6. Install the release automation workflow

Check if `.github/workflows/create-release.yaml` exists:

- **Missing**: Copy from [assets/create-release.yaml](assets/create-release.yaml) and tell the user what it does.
- **Exists**: Compare with the template. If outdated, show the diff and offer to update.

This workflow triggers when a release PR merges and automatically creates the GitHub release — no manual steps after merge.

### 7. Create the release branch and PR

```bash
VERSION="X.Y.Z"  # the new version number

git checkout -b "release/v$VERSION"

git add package.json package-lock.json CHANGELOG.md
# Stage generated plugin snapshots when this project produces them
git add .claude-plugin plugins 2>/dev/null
# Also stage the workflow file if it was added/updated
git add .github/workflows/create-release.yaml 2>/dev/null

git commit -m "chore(release): prepare v$VERSION"
git push -u origin "release/v$VERSION"
```

Create the PR with a structured description:

```bash
gh pr create \
  --title "chore(release): v$VERSION" \
  --body "$(cat <<EOF
## Release v$VERSION

<one-paragraph summary from changelog>

### Changes
<bulleted list of key changes>

### Checklist
- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] Generated plugin snapshot matches the release version and passes strict validation (if applicable)
- [ ] Release workflow installed and up-to-date
- [ ] CI passes

> After merging, the \`create-release\` workflow will automatically create
> a GitHub release and trigger npm publishing.
EOF
)" \
  --label "release"
```

Report the PR URL to the user.

## Post-Merge Automation

After the release PR merges, the `create-release.yaml` workflow automatically:

1. Extracts the version from the merged branch name (`release/vX.Y.Z`)
2. Verifies the package version, generated release artifacts, build, tests, and project release checks while the future tag is still absent
3. Reads the release notes for that version from `CHANGELOG.md`
4. Creates a GitHub release tagged `vX.Y.Z` with those notes
5. Publishes the package and deploys versioned documentation only after the tag-backed artifacts pass validation

No manual steps are needed after the PR is merged.

## Error Handling

- **No git tags exist**: Treat as first release. Ask the user for the starting version (default `v1.0.0`).
- **Release branch already exists**: Ask the user if they want to delete and recreate it, or use it as-is.
- **No commits since last tag**: Inform the user there's nothing to release.
- **gh CLI not authenticated**: Tell the user to run `gh auth login`.
- **Dirty working tree**: Warn and ask to commit or stash before proceeding.
- **npm version fails**: Fall back to editing package.json directly with `jq` or a manual edit.
