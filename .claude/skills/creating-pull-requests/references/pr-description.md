<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# PR Description Writing Guide

Write descriptions that are adapted to the PR size. Small PRs need less ceremony; large PRs need more structure.

## Table of Contents

- [Size-Adaptive Descriptions](#size-adaptive-descriptions)
- [Section Writing Guidelines](#section-writing-guidelines)
- [Extracting Context from Git](#extracting-context-from-git)

## Size-Adaptive Descriptions

### Small PRs (1–100 lines)

Use a condensed format. Include Problem, Solution, and the Review Checklist. Omit Technical Details and Configuration sections if not relevant.

```markdown
## Problem
Resolves PROJ-123. Users see a 500 error when submitting an empty form.

## Solution
Add null check before accessing `request.body.email` in the validation middleware.

## How to Test
- [ ] Submit the form with all fields empty — should return 400 with validation message
- [ ] Submit with valid data — should succeed as before

---

## Review Checklist
- [ ] PR addresses a single task / Jira ticket
- [ ] No unrelated changes bundled in
- [ ] Tests added or updated
- [ ] No secrets, credentials, or sensitive data committed
```

### Medium PRs (101–400 lines)

Use the full template. All sections are expected.

### Large PRs (401+ lines)

Use the full template **plus** add:
- An **architecture or flow diagram** (ASCII or Mermaid) showing the change in context
- A **file-by-file summary table** for reviewers to navigate the diff
- A note explaining **why the PR was not split** (if applicable)

```markdown
## File Summary

| File | Change |
|------|--------|
| `src/auth/jwt.ts` | New token refresh logic |
| `src/auth/middleware.ts` | Hook refresh into request pipeline |
| `src/auth/__tests__/jwt.test.ts` | Unit tests for refresh flow |
| `docs/auth.md` | Updated auth flow documentation |
```

## Section Writing Guidelines

### Problem
- Start with the Jira ticket ID: `Resolves PROJ-123.`
- Explain the **user impact** or business need — not just the technical symptom
- Keep to 2–3 sentences

### Solution
- Describe the approach at a high level: what was done and *why this approach*
- If you considered alternatives, briefly mention why they were rejected
- Do not repeat the diff line-by-line

### Technical Details
- Focus on **decisions**, not descriptions — reviewers can read the diff
- Mention: key files, patterns used, architectural changes, trade-offs
- If the change touches shared utilities or APIs, call that out

### How to Test
- Write as checkboxes so reviewers can follow along
- Include prerequisites (environment, test data, feature flags)
- Cover the happy path, at least one edge case, and rollback steps if applicable
- For bug fixes, include steps to reproduce the original issue

### Configuration
- Only include if there are new env vars, feature flags, or dependencies
- Format: `VAR_NAME` — description, default value, required/optional
- Omit this section entirely if nothing changed

### Review Checklist
- Always include the standard checklist
- Add project-specific items if needed (e.g., "Accessibility tested", "Migration reversible")

## Extracting Context from Git

Use these commands to gather information for the description:

```bash
# Use the base branch detected in the SKILL.md gathering context step
# (defaults to main, may be develop or another branch)

# Understand what changed and why
git log "$BASE"..HEAD --format="%s%n%b---"

# See which areas of the codebase were touched
git diff "$BASE"...HEAD --stat

# Check for large binary files or unexpected additions
git diff "$BASE"...HEAD --numstat | sort -k1 -rn | head -10

# Identify if tests were added
git diff "$BASE"...HEAD --name-only | grep -i test
```
