---
name: creating-pull-requests
description: Standardized pull request creation with structured descriptions, conventional commit title format, Jira ticket linking, and review checklists. Use when the user says "create a PR", "open a pull request", "submit a PR", "/pr", or asks to prepare changes for review. Ensures PRs follow team conventions for description format, single-responsibility scope, and reviewer guidance. Do NOT use for reviewing existing PRs, managing branches, or resolving merge conflicts.
allowed-tools: Bash Read Grep Glob
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Pull Request

Create standardized pull requests using `gh pr create` with structured descriptions that make reviews easier and faster.

## Philosophy

- **Reviewer-first** — Optimize for the person reviewing, not the author
- **Context over detail** — Explain *why*, link to *how*
- **Scannable** — Busy reviewers skim; make it easy
- **Actionable** — Clear testing steps, obvious risks
- **Honest** — Flag complexity, don't hide it

## Workflow

1. **Gather context** — Run the commands in [Gathering Context](#gathering-context) to understand all changes on the branch.
2. **Check PR size** — Evaluate the diff size against [references/pr-sizing.md](references/pr-sizing.md). If the PR is large (>500 lines), warn the user and suggest splitting.
3. **Determine type and scope** — Choose the conventional commit type and optional scope from the [PR Title Format](#pr-title-format) section.
4. **Identify Jira ticket** — Extract from the branch name (e.g., `feature/PROJ-123-add-login`). If not found, ask the user.
5. **Generate description** — Follow [references/pr-description.md](references/pr-description.md) to write a size-appropriate description using the [references/pr-template.md](references/pr-template.md) template.
6. **Create the PR** — Use `gh pr create` following the patterns in [references/pr-creation.md](references/pr-creation.md).
7. **Report** — Print the PR URL so the user can open it directly.

## Gathering Context

Before creating a PR, detect the base branch and gather information about the changes:

```bash
# Detect the base branch (develop if it exists, otherwise main)
BASE=$(git branch -r | grep -q 'origin/develop' && echo develop || echo main)

# Compare branch changes against base
git diff "$BASE"...HEAD

# List modified files with stats
git diff "$BASE"...HEAD --stat

# Review commit history (one-line summary)
git log "$BASE"..HEAD --oneline

# Get detailed commit messages
git log "$BASE"..HEAD --format="%B---"

# Count lines changed (additions + deletions)
git diff "$BASE"...HEAD --shortstat
```

Use this information to determine the commit type, scope, PR size category, and to populate the description sections.

## PR Title Format

Follow the conventional commit format:

```text
<type>(<optional scope>): <description>
```

For **breaking changes**, add `!` after the type/scope:

```text
<type>(<optional scope>)!: <description>
```

**Examples:**
- `feat(auth): add JWT token refresh endpoint`
- `feat(api)!: remove deprecated v1 endpoints`

### Types

Use standard conventional commit types (`feat`, `fix`, `refactor`, `perf`, `style`, `test`, `docs`, `build`, `chore`) plus:

| Type | Use when |
|------|----------|
| `ops` | affect infrastructure, deployment, CI/CD, monitoring, or recovery |

### Scope

- Optional — provides additional context (e.g., `auth`, `api`, `dashboard`)
- Project-specific; do **not** use Jira issue IDs as scopes

### Title examples

```text
feat(cart): add quantity selector to checkout page
fix(api): handle null response from payment gateway
refactor: simplify user validation logic
docs(readme): update local development instructions
ops(ci): add staging deployment pipeline
test(auth): add integration tests for login flow
```

## PR Scope Rules

Each PR must address a **single** Jira ticket, feature, or bug fix. Before creating:

- Verify all changes relate to one task
- If unrelated changes are staged, warn the user and suggest splitting into separate PRs
- If the diff exceeds the size thresholds in [references/pr-sizing.md](references/pr-sizing.md), flag this and ask if the PR can be broken down
- See [references/pr-sizing.md](references/pr-sizing.md) for size categories, splitting strategies, and exceptions

## Quick Reference

| Task | Guide |
|------|-------|
| Sizing and splitting PRs | [references/pr-sizing.md](references/pr-sizing.md) |
| Writing PR descriptions | [references/pr-description.md](references/pr-description.md) |
| PR body template | [references/pr-template.md](references/pr-template.md) |
| Creating PRs with gh CLI | [references/pr-creation.md](references/pr-creation.md) |

## Error Handling

- If `gh` CLI is not installed or not authenticated, tell the user to run `gh auth login`.
- If the branch has no commits ahead of main, inform the user there is nothing to open a PR for.
- If `gh pr create` fails due to an existing PR, suggest `gh pr view` to check the current state.
- If the remote branch does not exist yet, push first with `git push -u origin HEAD`.
- If merge conflicts are detected, notify the user and suggest resolving them before creating the PR.
