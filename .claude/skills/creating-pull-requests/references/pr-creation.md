<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# PR Creation Guide

Detailed reference for creating pull requests using the `gh` CLI.

## Table of Contents

- [Basic Command](#basic-command)
- [HEREDOC Pattern for Multi-Line Bodies](#heredoc-pattern-for-multi-line-bodies)
- [Common Options](#common-options)
- [Draft PRs](#draft-prs)
- [Specifying the Base Branch](#specifying-the-base-branch)
- [Pre-Creation Checks](#pre-creation-checks)
- [Troubleshooting](#troubleshooting)

## Basic Command

```bash
gh pr create --title "<title>" --body "<body>"
```

## HEREDOC Pattern for Multi-Line Bodies

Always use a HEREDOC to pass the PR body. This preserves markdown formatting and avoids shell escaping issues:

```bash
gh pr create --title "feat(auth): add JWT token refresh endpoint" --body "$(cat <<'EOF'
## Problem
Resolves PROJ-123. Token expiry causes silent logouts during long sessions.

## Solution
Add a refresh endpoint that issues new tokens before expiry using rotating refresh tokens.

## Technical Details
- New `POST /auth/refresh` endpoint in `src/auth/routes.ts`
- Refresh tokens stored in HTTP-only cookies with 7-day TTL
- Added `token-refresh` middleware to auto-refresh on 401 responses

## How to Test
- [ ] Login and wait for token to approach expiry (TTL set to 30s in test config)
- [ ] Verify automatic refresh — no logout, new token in cookies
- [ ] Verify expired refresh token redirects to login

---

## Review Checklist
- [ ] PR addresses a single task / Jira ticket
- [ ] No unrelated changes bundled in
- [ ] Tests added or updated
- [ ] No secrets, credentials, or sensitive data committed
- [ ] Documentation updated (if applicable)
- [ ] Breaking changes documented (if applicable)
EOF
)"
```

## Common Options

| Flag | Purpose | Example |
|------|---------|---------|
| `--title` | PR title (conventional commit format) | `--title "fix(api): handle null response"` |
| `--body` | PR description (use HEREDOC) | See above |
| `--base` | Target branch (default: repo default) | `--base develop` |
| `--draft` | Create as draft PR | `--draft` |
| `--reviewer` | Request reviewers | `--reviewer alice,bob` |
| `--assignee` | Assign the PR | `--assignee @me` |
| `--label` | Add labels | `--label "bug,priority:high"` |
| `--milestone` | Set milestone | `--milestone "v2.1"` |

## Draft PRs

Use draft PRs when:
- The code compiles and passes CI but is not ready for full review
- You want early feedback on the approach
- You are waiting for a dependent PR to merge first

```bash
gh pr create --draft --title "feat(cart): add quantity selector" --body "..."
```

Convert a draft to ready-for-review:

```bash
gh pr ready
```

## Specifying the Base Branch

By default, `gh pr create` targets the repository's default branch. Override when needed:

```bash
# Target a specific branch
gh pr create --base develop --title "..." --body "..."
```

Auto-detect the base branch from common conventions:

```bash
# Check if 'develop' exists, fall back to 'main'
BASE=$(git branch -r | grep -q 'origin/develop' && echo develop || echo main)
gh pr create --base "$BASE" --title "..." --body "..."
```

## Pre-Creation Checks

Before running `gh pr create`, verify:

```bash
# Ensure the branch is pushed to remote
git push -u origin HEAD

# Confirm there are commits ahead of the base
git log main..HEAD --oneline

# Check for uncommitted changes
git status
```

## Troubleshooting

### "pull request already exists"
A PR already exists for this branch. Check it with:
```bash
gh pr view
```

### "gh: not found" or authentication errors
Install and authenticate the GitHub CLI:
```bash
# Install (macOS)
brew install gh

# Authenticate
gh auth login
```

### "no commits between main and HEAD"
The branch has no new commits. Verify you are on the correct branch:
```bash
git branch --show-current
git log main..HEAD --oneline
```

### Push rejected
The remote branch may be behind or diverged. Push first:
```bash
git push -u origin HEAD
```

### Body too long or malformed
If the HEREDOC body causes issues, write it to a temp file:
```bash
# Write body to file
cat > /tmp/pr-body.md <<'EOF'
## Problem
...
EOF

# Create PR from file
gh pr create --title "..." --body-file /tmp/pr-body.md
```
