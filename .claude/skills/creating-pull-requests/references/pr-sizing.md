<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# PR Sizing Guide

Use this guide to evaluate whether a PR is the right size and when to split it.

## Size Categories

| Category | Lines Changed | Files Changed | Review Expectation |
|----------|--------------|---------------|-------------------|
| **Small** | 1 – 100 | 1 – 5 | Quick review, same day |
| **Medium** | 101 – 400 | 5 – 15 | Standard review, 1–2 days |
| **Large** | 401+ | 15+ | Flag to user, suggest splitting |

Measure with:

```bash
git diff "$BASE"...HEAD --shortstat
```

## Signs a PR Should Be Split

- The diff touches **multiple unrelated features or bug fixes**
- The commit history covers **different topics** (`git log main..HEAD --oneline`)
- You had to write "also" or "additionally" in the description more than once
- Tests for different features are mixed together
- The reviewer would need context-switch between domains (e.g., API and UI changes)
- Config/infra changes are bundled with feature code

## Splitting Strategies

### By layer
Separate PRs for backend, frontend, and infrastructure changes when they can land independently.

### By feature slice
If a feature has multiple sub-tasks, submit each sub-task as its own PR.

### Extract refactoring
If a feature requires refactoring existing code, submit the refactor first, then the feature on top.

### Separate tests
If adding test coverage to existing untested code alongside a feature, consider a separate "add tests" PR first.

### Config before logic
Infrastructure or config changes (new env vars, DB migrations, CI changes) can ship in a standalone PR before the code that uses them.

## When Large PRs Are Acceptable

Not every large PR needs splitting. These are valid exceptions:

- **Generated code** — Auto-generated files (OpenAPI clients, protobuf stubs) that inflate line counts but carry low review risk.
- **Bulk renames or moves** — File relocations where the logic is unchanged. Use `git diff --diff-filter=R` to verify.
- **Initial scaffolding** — First commit bootstrapping a new service or module where everything is tightly coupled.
- **Dependency lockfile updates** — `package-lock.json`, `yarn.lock`, or similar files that dominate the diff.
- **Delete-heavy PRs** — Removing dead code or deprecated modules. Deletions are lower risk than additions.

When a large PR is justified, add a note in the PR description explaining why it was not split, so reviewers know it was a conscious choice.
