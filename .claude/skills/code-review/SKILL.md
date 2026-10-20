---
name: code-review
description: >
  Multi-axis code review across correctness, readability, architecture, security, and performance.
  Use when reviewing code before merge, evaluating changes written by yourself or another agent,
  assessing code quality after a feature implementation or bug fix, or when user says "review this",
  "check this code", "code review", or "/review".
  Produces categorized findings with severity labels and a structured verdict.
  Do NOT use for creating pull requests — use creating-pull-requests instead.
  Do NOT use for reviewing skill file quality — use skill-reviewer instead.
allowed-tools: Read Grep Glob Bash
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Code Review

Review code changes across five axes before merge. Every change gets reviewed — no exceptions.

## Approval Standard

Approve a change when it **definitely improves overall code health**, even if it isn't perfect. Perfect code doesn't exist — the goal is continuous improvement. Don't block a change because it isn't exactly how you would have written it. If it improves the codebase and follows the project's conventions, approve it.

## Workflow

1. **Determine scope** — Identify which files changed. Use the git commands in [Gathering the Diff](#gathering-the-diff), or review specific files if provided.
2. **Load project context** — Read the project's `CLAUDE.md`, `AGENTS.md`, or equivalent convention file. Extract project-specific review rules (component libraries, naming conventions, query patterns, framework constraints). These rules **take precedence** over generic checks for project-specific conventions.
3. **Review tests first** — Tests reveal intent and coverage. Check them before the implementation.
4. **Review implementation** — Walk each changed file through the [Five-Axis Review](#the-five-axis-review).
5. **Apply project-specific checks** — Layer in any rules discovered in step 2 (e.g., required component libraries, query key factories, logging formats).
6. **Classify findings** — Label every finding with a severity from the [Severity Classification](#severity-classification) table.
7. **Render output** — Use the template in [assets/review-report.template.md](assets/review-report.template.md) to produce the structured review.

**Focused review:** When `--focus <axis>` is specified, apply only that axis from the five-axis review. In the output template, show the focused axis status and omit the others from the Stats table. The verdict still applies: APPROVE if no critical/important issues found on that axis, REQUEST CHANGES otherwise.

## Gathering the Diff

```bash
# Detect the base branch
BASE=$(git branch -r | grep -q 'origin/develop' && echo develop || echo main)

# See what changed
git diff "$BASE"...HEAD --stat
git diff "$BASE"...HEAD

# Review commit history
git log "$BASE"..HEAD --oneline

# Count lines changed
git diff "$BASE"...HEAD --shortstat
```

If reviewing a specific PR, use `gh pr diff <number>` instead.

## The Five-Axis Review

### 1. Correctness

Does the code do what it claims to do?

- Does it match the spec or task requirements?
- Are edge cases handled (null, empty, boundary values)?
- Are error paths handled (not just the happy path)?
- Does it pass all tests? Are the tests testing the right things?
- Are there off-by-one errors, race conditions, or state inconsistencies?

### 2. Readability

Can another engineer understand this code without the author explaining it?

- Are names descriptive and consistent with project conventions?
- Is the control flow straightforward (no nested ternaries, deep callbacks)?
- Is the code organized logically (related code grouped, clear module boundaries)?
- Could this be done with less complexity? (1000 lines where 100 suffice is a failure)
- Are abstractions earning their complexity? (Don't generalize until the third use case)
- Are there dead code artifacts: no-op variables, backwards-compat shims, `// removed` comments?

### 3. Architecture

Does the change fit the system's design?

- Does it follow existing patterns or introduce a new one? If new, is it justified?
- Does it maintain clean module boundaries?
- Is there code duplication that should be shared?
- Are dependencies flowing in the right direction (no circular dependencies)?
- Is the abstraction level appropriate (not over-engineered, not too coupled)?

### 4. Security

Does the change introduce vulnerabilities? For detailed checks, see [references/security-checklist.md](references/security-checklist.md).

- Is user input validated and sanitized at system boundaries?
- Are secrets kept out of code, logs, and version control?
- Is authentication/authorization checked where needed?
- Are SQL queries parameterized (no string concatenation)?
- Are outputs encoded to prevent XSS?
- Are dependencies from trusted sources with no known vulnerabilities?
- Is data from external sources treated as untrusted?

### 5. Performance

Does the change introduce performance problems? For detailed checks, see [references/performance-checklist.md](references/performance-checklist.md).

- Any N+1 query patterns?
- Any unbounded loops or unconstrained data fetching?
- Any synchronous operations that should be async?
- Any unnecessary re-renders in UI components?
- Any missing pagination on list endpoints?
- Any large objects created in hot paths?

## Severity Classification

Label every finding so the author knows what's required vs optional:

| Severity | Meaning | Author Action |
|----------|---------|---------------|
| **Critical** | Blocks merge — security vulnerability, data loss, broken functionality | Must fix |
| **Important** | Should fix — missing test, wrong abstraction, poor error handling | Must address or justify deferral |
| **Nit** | Minor, optional — formatting, style preferences | May ignore |
| **Consider** | Suggestion — worth considering but not required | Optional |
| **FYI** | Informational — context for future reference | No action needed |

## Dependency Review

Part of code review is dependency review. Before accepting a new dependency:

1. Does the existing stack solve this? (Often it does.)
2. How large is the dependency? (Check bundle impact.)
3. Is it actively maintained? (Check last commit, open issues.)
4. Does it have known vulnerabilities? (`npm audit`)
5. What's the license? (Must be compatible with the project.)

Prefer standard library and existing utilities over new dependencies. Every dependency is a liability.

## Honesty Rules

- **Don't rubber-stamp.** "LGTM" without evidence of review helps no one.
- **Don't soften real issues.** "This might be a minor concern" when it's a production bug is dishonest.
- **Quantify problems.** "This N+1 query will add ~50ms per item" is better than "this could be slow."
- **Push back directly.** If the implementation has issues, say so and propose alternatives.
- **If uncertain, say so.** Suggest investigation rather than guessing.
- **Accept override gracefully.** If the author has full context and disagrees, defer to their judgment.
- **Acknowledge what's done well.** Specific praise motivates good practices — always include at least one positive observation.

## Handling Disagreements

When resolving review disputes, apply this hierarchy:

1. **Technical facts and data** override opinions and preferences
2. **Style guides** are the absolute authority on style matters
3. **Software design** must be evaluated on engineering principles, not personal preference
4. **Codebase consistency** is acceptable if it doesn't degrade overall health

Don't accept "I'll clean it up later." Deferred cleanup rarely happens. Require cleanup before submission unless it's a genuine emergency.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It works, that's good enough" | Working code that's unreadable, insecure, or architecturally wrong creates debt that compounds |
| "I wrote it, so I know it's correct" | Authors are blind to their own assumptions. Every change benefits from another set of eyes |
| "We'll clean it up later" | Later never comes. The review is the quality gate — use it |
| "AI-generated code is probably fine" | AI code needs more scrutiny, not less. It's confident and plausible, even when wrong |
| "The tests pass, so it's good" | Tests are necessary but not sufficient. They don't catch architecture problems, security issues, or readability concerns |

## Red Flags

- PRs merged without any review
- Review that only checks if tests pass (ignoring other axes)
- "LGTM" without evidence of actual review
- Security-sensitive changes without security-focused review
- Large PRs that are "too big to review properly" (split them)
- No regression tests with bug fix PRs
- Review comments without severity labels
- Accepting "I'll fix it later"

## Quick Reference

| Resource | Path |
|----------|------|
| Security checklist | [references/security-checklist.md](references/security-checklist.md) |
| Performance checklist | [references/performance-checklist.md](references/performance-checklist.md) |
| Sanofi baseline rules | [references/sanofi-baseline.md](references/sanofi-baseline.md) |
| Review output template | [assets/review-report.template.md](assets/review-report.template.md) |

## Error Handling

- If no changed files are found and no files were specified: "No changes detected. Specify files or a PR number to review."
- If CLAUDE.md or AGENTS.md is not found: proceed with generic checks only and note this in the output.
- If a referenced file cannot be read: skip it and note it in the review output.
