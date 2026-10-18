---
disable-model-invocation: true
argument-hint: "[<pr-number>|<file-paths>]"
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Code Review

Spawns the `code-reviewer` agent to execute the review workflow.

Follow the agent's workflow to resolve the review scope, load project conventions, apply the five-axis review methodology, and produce a structured review report with categorized findings.

## Arguments

`$ARGUMENTS` - Optional review configuration:

- `<pr-number>` - Review a specific PR (e.g., `123` or `#123`)
- `<file-paths>` - Review specific files (e.g., `src/auth.ts src/utils.ts`)
- `--base <branch>` - Compare against a specific branch (default: auto-detected)
- `--focus <axis>` - Narrow review to a single axis: `correctness`, `readability`, `architecture`, `security`, or `performance`
