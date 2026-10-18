<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# PR Description Template

Use this structure as the PR body when running `gh pr create`. Adapt sections based on PR size.

## Full Template (Medium and Large PRs)

```markdown
## Problem

[Resolves PROJ-XXX. Describe the issue or requirement. Explain WHY this change is needed — what user pain, bug, or business need does it address?]

## Solution

[Describe the approach taken. Explain WHAT was done at a high level and WHY this approach was chosen over alternatives.]

## Technical Details

[Describe implementation specifics: key files changed, patterns used, architectural decisions. Keep it concise — reviewers can read the diff for exact changes.]

## How to Test

[Step-by-step instructions to verify the changes work correctly:]
- [ ] Prerequisites (environment, data, feature flags)
- [ ] Steps to reproduce the original issue (if bug fix)
- [ ] Steps to verify the fix/feature
- [ ] Edge cases to check

## Configuration

[List any new or changed configuration. Omit this section entirely if none.]

- **Environment variables**: `VAR_NAME` — description, default value
- **Feature flags**: flag name — description
- **Dependencies**: new packages or services required

---

## Review Checklist

- [ ] PR addresses a single task / Jira ticket
- [ ] No unrelated changes bundled in
- [ ] Tests added or updated
- [ ] No secrets, credentials, or sensitive data committed
- [ ] Documentation updated (if applicable)
- [ ] Breaking changes documented (if applicable)
```

## Condensed Template (Small PRs)

For small PRs (1–100 lines), omit Technical Details and Configuration:

```markdown
## Problem

[Resolves PROJ-XXX. Brief description of the issue.]

## Solution

[What was done and why.]

## How to Test

- [ ] [Verification step 1]
- [ ] [Verification step 2]

---

## Review Checklist

- [ ] PR addresses a single task / Jira ticket
- [ ] No unrelated changes bundled in
- [ ] Tests added or updated
- [ ] No secrets, credentials, or sensitive data committed
```

## Large PR Additions

For large PRs (401+ lines), add these sections after Technical Details:

```markdown
## Architecture / Flow

[Optional: ASCII or Mermaid diagram showing how the change fits into the system. Include when the change affects request flow, data pipelines, or component relationships.]

## File Summary

| File | Change |
|------|--------|
| `path/to/file.ts` | [What changed and why] |
| ... | ... |

## Why This PR Is Large

[Explain why the PR was not split — e.g., tightly coupled changes, generated code, bulk rename.]
```
